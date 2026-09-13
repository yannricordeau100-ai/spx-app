#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mise a jour des transcripts d earnings call des societes americaines
a partir de MarketBeat (HTML statique, curl / urllib avec User-Agent Mozilla).

Usage :
  python3 scripts/marketbeat-transcripts.py --dry-run --limit 5
  python3 scripts/marketbeat-transcripts.py --tickers AAPL,MSFT
  python3 scripts/marketbeat-transcripts.py

Journal  : .conv-state/marketbeat-transcripts.log
Rapport  : .conv-state/marketbeat-transcripts-rapport.json
"""

import argparse
import html as htmllib
import json
import os
import re
import sys
import time
import subprocess
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")
TRANSCRIPTS_DIR = os.path.join(ROOT, "src", "data", "transcripts")
STATE_DIR = os.path.join(ROOT, ".conv-state")
LOG_PATH = os.path.join(STATE_DIR, "marketbeat-transcripts.log")
RAPPORT_PATH = os.path.join(STATE_DIR, "marketbeat-transcripts-rapport.json")

BASE = "https://www.marketbeat.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
EXCHANGES = ["NASDAQ", "NYSE", "NYSEAMERICAN", "BATS"]
SUFFIXES_NON_US = (".PA", ".DE", ".SW", ".AS", ".L", ".KS", ".T", ".MI",
                   ".BR", ".MC", ".ST", ".CO", ".HE", ".LS", ".VI", ".OL", ".IR")
DATE_SEUIL = "2026-06-01"
PAUSE = 2.0
MIN_LEN = 2000

_log_file = None


def log(msg):
    line = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    if _log_file:
        _log_file.write(line + "\n")
        _log_file.flush()


def fetch(url, timeout=45, essais=3):
    """Retourne (code, texte). code 0 = erreur reseau. Passe par curl."""
    dernier = (0, "")
    for essai in range(essais):
        try:
            p = subprocess.run(
                ["curl", "-sS", "-L", "--max-time", str(timeout),
                 "-A", UA,
                 "-H", "Accept: text/html,application/xhtml+xml",
                 "-H", "Accept-Language: en-US,en;q=0.9",
                 "-w", "\n@@HTTP@@%{http_code}", url],
                capture_output=True, timeout=timeout + 15)
            out = p.stdout.decode("utf-8", errors="replace")
            i = out.rfind("\n@@HTTP@@")
            if i < 0:
                dernier = (0, p.stderr.decode("utf-8", errors="replace")[:200])
            else:
                code = int(out[i + 9:].strip() or 0)
                body = out[:i]
                if code == 200 or code == 404:
                    return code, body
                dernier = (code, body)
        except Exception as e:
            dernier = (0, "%s: %s" % (type(e).__name__, e))
        if essai < essais - 1:
            time.sleep(5)
    return dernier


# ---------------------------------------------------------------- nettoyage

def clean_text(fragment):
    """HTML -> texte simple (balises, entites, espaces)."""
    s = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", fragment)
    s = re.sub(r"(?is)<br\s*/?>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = s.replace(" ", " ").replace("​", "")
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n\s*\n\s*", "\n\n", s)
    return s.strip()


# ---------------------------------------------------------------- extraction

RE_REPORT = re.compile(r'/earnings/reports/(\d{4})-(\d{1,2})-(\d{1,2})-([a-z0-9\-]+)/')
RE_SECTION = re.compile(r'(?is)<section class="transcript-line[^"]*">(.*?)</section>')
RE_SPEAKER = re.compile(r'(?is)<div class="transcript-line-speaker.*?<div class="font-weight-bold">(.*?)</div>\s*(?:<time[^>]*>([^<]*)</time>)?')
RE_TITRE_ROLE = re.compile(r'(?is)<div class="secondary-title[^"]*">(.*?)</div>')
RE_PARA = re.compile(r'(?is)<p[^>]*>(.*?)</p>')
RE_H3_TITLE = re.compile(r'(?is)<h3>([^<]*Earnings Call Transcript)</h3>')
RE_QY = re.compile(r'\bQ([1-4])\s+(\d{4})\b')


def liste_rapports(ticker):
    """Retourne (liste de (date_iso, url), exchange) pour un ticker."""
    variantes = [ticker.upper()]
    if "." in ticker:
        variantes += [ticker.upper().replace(".", "-"), ticker.upper().replace(".", "")]
    for tk in variantes:
        for ex in EXCHANGES:
            url = "%s/stocks/%s/%s/earnings/" % (BASE, ex, tk)
            code, body = fetch(url)
            time.sleep(PAUSE)
            if code != 200 or not body:
                continue
            vus = {}
            for m in RE_REPORT.finditer(body):
                y, mo, d, slug = m.groups()
                iso = "%04d-%02d-%02d" % (int(y), int(mo), int(d))
                vus[iso] = "%s/earnings/reports/%s-%s-%s-%s/" % (BASE, y, int(mo), int(d), slug)
            if vus:
                rapports = sorted(vus.items(), key=lambda kv: kv[0], reverse=True)
                return rapports, ex
    return [], None


def extrait_transcript(body):
    """Retourne dict {content, quarter, year, key_takeaways} ou None."""
    i = body.find('id="transcriptPresentation"')
    if i < 0:
        return None
    j = body.find("</article>", i)
    if j < 0:
        j = len(body)
    zone = body[i:j]

    blocs = []
    for sec in RE_SECTION.finditer(zone):
        raw = sec.group(1)
        m = RE_SPEAKER.search(raw)
        nom = clean_text(m.group(1)) if m else ""
        # le nom peut contenir le role imbrique
        role = ""
        mr = RE_TITRE_ROLE.search(m.group(1)) if m else None
        if mr:
            role = clean_text(mr.group(1))
            nom = clean_text(re.sub(r'(?is)<div class="secondary-title.*', "", m.group(1)))
        ts = (m.group(2) or "").strip() if m else ""
        paras = [clean_text(p) for p in RE_PARA.findall(raw)]
        paras = [p for p in paras if p]
        if not paras:
            continue
        entete = nom or "Intervenant"
        if role:
            entete += " (%s)" % role
        if ts:
            entete += " [%s]" % ts
        blocs.append("%s: %s" % (entete, "\n".join(paras)))

    if not blocs:
        return None
    content = "\n\n".join(blocs)

    quarter, year = None, None
    mt = RE_H3_TITLE.search(body)
    if mt:
        mq = RE_QY.search(clean_text(mt.group(1)))
        if mq:
            quarter, year = int(mq.group(1)), int(mq.group(2))

    takeaways = []
    k = body.find("Key Takeaways")
    if k >= 0:
        zone_kt = body[k:k + 12000]
        for li in re.finditer(r'(?is)<li class="(positive|negative|neutral)">(.*?)</li>', zone_kt):
            sent = {"positive": "positif", "negative": "negatif", "neutral": "neutre"}[li.group(1)]
            txt = clean_text(li.group(2))
            txt = re.sub(r'^(Positive|Negative|Neutral) Sentiment:\s*', "", txt)
            if txt:
                takeaways.append({"sentiment": sent, "texte": txt})

    return {"content": content, "quarter": quarter, "year": year,
            "key_takeaways": takeaways}


# ---------------------------------------------------------------- cible

def est_us(ticker):
    up = ticker.upper()
    return not any(up.endswith(s) for s in SUFFIXES_NON_US)


def date_existante(ticker):
    p = os.path.join(TRANSCRIPTS_DIR, ticker.lower() + ".json")
    if not os.path.exists(p):
        return None
    try:
        j = json.load(open(p, encoding="utf-8"))
        return (j.get("latest") or {}).get("date") or ""
    except Exception:
        return ""


def calcule_cible():
    univers = json.load(open(UNIVERS, encoding="utf-8"))
    tickers = univers["tickers"] if isinstance(univers, dict) else univers
    cible = []
    for tk in tickers:
        if not est_us(tk):
            continue
        d = date_existante(tk)
        if d is None or d < DATE_SEUIL:
            cible.append(tk)
    return cible


# ---------------------------------------------------------------- traitement

def traite(ticker, dry_run=False):
    """Retourne (categorie, detail)."""
    existant = date_existante(ticker)
    rapports, ex = liste_rapports(ticker)
    if not rapports:
        return "sans_page", None

    date_mb, url = rapports[0]
    if existant and existant >= date_mb:
        return "plus_recent_deja", date_mb

    code, body = fetch(url)
    time.sleep(PAUSE)
    if code != 200 or not body:
        return "erreurs", "HTTP %s sur %s" % (code, url)

    extrait = extrait_transcript(body)
    if not extrait or len(extrait["content"]) < MIN_LEN:
        # on tente le rapport precedent si le plus recent n a pas de transcript
        for date_alt, url_alt in rapports[1:3]:
            if existant and existant >= date_alt:
                break
            code, body = fetch(url_alt)
            time.sleep(PAUSE)
            if code == 200 and body:
                alt = extrait_transcript(body)
                if alt and len(alt["content"]) >= MIN_LEN:
                    extrait, date_mb, url = alt, date_alt, url_alt
                    break
        else:
            return "sans_transcript", date_mb
        if not extrait or len(extrait["content"]) < MIN_LEN:
            return "sans_transcript", date_mb

    y, m, d = date_mb.split("-")
    quarter = extrait["quarter"] or ((int(m) - 1) // 3) or 4
    year = extrait["year"] or int(y)

    doc = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "marketbeat",
        "latest": {
            "quarter": quarter,
            "year": year,
            "date": date_mb,
            "content": extrait["content"],
            "source_url": url,
        },
    }
    if extrait["key_takeaways"]:
        doc["key_takeaways"] = extrait["key_takeaways"]

    if not dry_run:
        os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
        p = os.path.join(TRANSCRIPTS_DIR, ticker.lower() + ".json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
    return "fait", "%s Q%s %s %d car." % (date_mb, quarter, year, len(extrait["content"]))


def main():
    global _log_file
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--tickers", type=str, default="")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    os.makedirs(STATE_DIR, exist_ok=True)
    _log_file = open(LOG_PATH, "a", encoding="utf-8")
    log("=== demarrage %s dry_run=%s ===" % (datetime.now().isoformat(), args.dry_run))

    if args.tickers:
        cible = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    else:
        cible = calcule_cible()
    if args.limit:
        cible = cible[:args.limit]
    log("cible : %d tickers" % len(cible))

    rapport = {"fait": [], "sans_page": [], "sans_transcript": [],
               "plus_recent_deja": [], "erreurs": []}

    for n, tk in enumerate(cible, 1):
        try:
            cat, detail = traite(tk, dry_run=args.dry_run)
        except Exception as e:
            cat, detail = "erreurs", "%s: %s" % (type(e).__name__, e)
        if cat == "erreurs":
            rapport["erreurs"].append({"ticker": tk, "detail": detail})
        else:
            rapport[cat].append(tk)
        log("%d/%d %s -> %s%s" % (n, len(cible), tk, cat,
                                  (" | " + str(detail)) if detail else ""))
        if n % 10 == 0 or n == len(cible):
            with open(RAPPORT_PATH, "w", encoding="utf-8") as f:
                json.dump(rapport, f, ensure_ascii=False, indent=2)

    with open(RAPPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)

    log("=== fin : fait=%d sans_page=%d sans_transcript=%d plus_recent_deja=%d erreurs=%d ===" % (
        len(rapport["fait"]), len(rapport["sans_page"]), len(rapport["sans_transcript"]),
        len(rapport["plus_recent_deja"]), len(rapport["erreurs"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
