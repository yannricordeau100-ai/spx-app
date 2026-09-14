#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Transcripts d earnings calls depuis stockanalysis.com (texte complet, gratuit).
Couvre toutes les places : US (/stocks/<T>/transcripts/) et Europe / Asie
(/quote/<place>/<T>/transcripts/). Complement de MarketBeat (US seulement).

Usage :
  python3 scripts/stockanalysis-transcripts.py --dry-run --limit 5
  python3 scripts/stockanalysis-transcripts.py --tickers MC.PA,SAP.DE
  python3 scripts/stockanalysis-transcripts.py            # non-US par defaut
  python3 scripts/stockanalysis-transcripts.py --all      # toutes les societes

Ne remplace un fichier src/data/transcripts/<t>.json que par un transcript
plus recent. Journal : .conv-state/stockanalysis-transcripts.log
Rapport : .conv-state/stockanalysis-transcripts-rapport.json
"""

import argparse
import html as htmllib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")
TRANSCRIPTS_DIR = os.path.join(ROOT, "src", "data", "transcripts")
STATE_DIR = os.path.join(ROOT, ".conv-state")
LOG_PATH = os.path.join(STATE_DIR, "stockanalysis-transcripts.log")
RAPPORT_PATH = os.path.join(STATE_DIR, "stockanalysis-transcripts-rapport.json")

BASE = "https://stockanalysis.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
# suffixe Yahoo -> code de place stockanalysis
PLACES = {".PA": "epa", ".DE": "etr", ".AS": "ams", ".SW": "swx", ".L": "lon",
          ".BR": "ebr", ".MC": "bme", ".VI": "vie", ".OL": "osl", ".HE": "hel",
          ".T": "tyo", ".MI": "mil", ".LS": "lis", ".ST": "sto", ".CO": "cph"}
PAUSE = 2.0
MIN_LEN = 2000
MOIS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun",
                                        "jul", "aug", "sep", "oct", "nov", "dec"])}

_log_file = None


def log(msg):
    line = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    if _log_file:
        _log_file.write(line + "\n")
        _log_file.flush()


def fetch(url, timeout=45, essais=3):
    dernier = (0, "")
    for essai in range(essais):
        try:
            p = subprocess.run(
                ["curl", "-sS", "-L", "--max-time", str(timeout), "-A", UA,
                 "-H", "Accept: text/html,application/xhtml+xml",
                 "-H", "Accept-Language: en-US,en;q=0.9",
                 "-w", "\n__CODE__%{http_code}", url],
                capture_output=True, text=True, timeout=timeout + 10)
            out = p.stdout
            k = out.rfind("\n__CODE__")
            if k < 0:
                dernier = (0, "")
            else:
                code = int(out[k + 9:].strip() or 0)
                dernier = (code, out[:k])
                if code in (200, 404):
                    return dernier
        except Exception:
            dernier = (0, "")
        time.sleep(3 * (essai + 1))
    return dernier


def clean_text(fragment):
    s = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", fragment)
    s = re.sub(r"(?is)<br\s*/?>", " ", s)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = s.replace(" ", " ").replace("​", "")
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    return s.strip()


CACHE_SYMBOLES = os.path.join(STATE_DIR, "stockanalysis-symboles.json")
_cache = None


def cache_symboles():
    global _cache
    if _cache is None:
        try:
            _cache = json.load(open(CACHE_SYMBOLES, encoding="utf-8"))
        except Exception:
            _cache = {}
    return _cache


def enregistre_symbole(ticker, chemin_ok):
    c = cache_symboles()
    if c.get(ticker.upper()) != chemin_ok:
        c[ticker.upper()] = chemin_ok
        os.makedirs(STATE_DIR, exist_ok=True)
        json.dump(c, open(CACHE_SYMBOLES, "w"), ensure_ascii=False, indent=1, sort_keys=True)


def nom_societe(ticker):
    p = os.path.join(ROOT, "src", "data", "v2-pipeline", ticker.lower() + ".json")
    try:
        return json.load(open(p, encoding="utf-8")).get("name") or ""
    except Exception:
        return ""


PLACES_EU = ("epa", "etr", "ams", "swx", "lon", "ebr", "bme", "vie", "osl", "hel",
             "mil", "sto", "cph", "lis", "fra", "ham", "dus", "stu", "ber")


GENERIQUES = {"deutsche", "group", "groupe", "holding", "holdings", "company",
              "compagnie", "international", "corporation", "corp", "inc", "plc",
              "aktiengesellschaft", "societe", "generale", "banque", "bank",
              "industries", "technologies", "systems", "services", "the"}


def mots_distinctifs(nom):
    """Mots propres a une societe, accents et formes juridiques retires."""
    import unicodedata
    t = unicodedata.normalize("NFKD", nom.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return {m for m in re.findall(r"[a-z0-9]{3,}", t) if m not in GENERIQUES}


def nom_page(body):
    m = re.search(r'(?is)<h1[^>]*>(.*?)</h1>', body)
    return clean_text(m.group(1)) if m else ""


def recherche_symboles(ticker):
    """Resout un ticker vers les adresses stockanalysis par le moteur de
    recherche du site (les symboles different : VOW.DE -> etr/VOW3,
    DPW.DE -> etr/DHL, UNA.AS -> lon/ULVR...)."""
    nom = nom_societe(ticker)
    if not nom:
        return []
    # Plusieurs libelles possibles : « Deutsche Post (DHL Group) » se cherche
    # aussi bien sous « Deutsche Post » que sous « DHL ».
    requetes = []
    entre_parentheses = re.findall(r"\(([^)]+)\)", nom)
    sans_parentheses = re.sub(r"\s*\([^)]*\)", "", nom)
    for brut in [sans_parentheses] + entre_parentheses + [nom]:
        q = re.sub(r"[,.]", " ", brut)
        q = re.sub(r"\s+(SE|AG|NV|SA|PLC|KGaA|Group|Holding|Holdings|Inc|Corp)\b", " ", q, flags=re.I)
        q = re.sub(r"\s+", " ", q).strip()
        if q and q.lower() not in [x.lower() for x in requetes]:
            requetes.append(q)
    data = []
    for q in requetes[:3]:
        url = "%s/api/search?q=%s&type=full" % (BASE, q.replace(" ", "%20"))
        code, body = fetch(url)
        time.sleep(PAUSE)
        if code != 200 or not body:
            continue
        try:
            lot = json.loads(body).get("data") or []
        except Exception:
            lot = []
        data += lot
        if any(mots_distinctifs(nom) & mots_distinctifs(e.get("n") or "") for e in lot):
            break
    if not data:
        return []
    mots = mots_distinctifs(nom)
    sorties = []
    for e in data:
        sym = e.get("s") or ""
        if "/" not in sym or e.get("st") != "s":
            continue
        place = sym.split("/")[0]
        # Nom identique exige sur un mot distinctif : « Deutsche Post » ne doit
        # jamais tomber sur « Deutsche Borse » (mot commun « deutsche » ecarte).
        if not (mots & mots_distinctifs(e.get("n") or "")):
            continue
        rang = 0 if place in PLACES_EU[:5] else (1 if place in PLACES_EU else 2)
        sorties.append((rang, "%s/quote/%s/transcripts/" % (BASE, sym)))
    sorties.sort()
    return [u for _, u in sorties][:6]


def chemins(ticker):
    """Adresses candidates (place principale d abord, puis les autres places
    europeennes : Airbus AIR.DE est cote chez stockanalysis sous epa/AIR)."""
    up = ticker.upper()
    for suf, place in PLACES.items():
        if up.endswith(suf):
            base = up[: -len(suf)]
            autres = [pl for pl in ("epa", "etr", "ams", "swx", "lon") if pl != place]
            return ["%s/quote/%s/%s/transcripts/" % (BASE, pl, base) for pl in [place] + autres]
    return ["%s/stocks/%s/transcripts/" % (BASE, up.lower())]


def chemins_complets(ticker):
    """Adresses directes, puis celles connues du cache, puis la recherche."""
    connue = cache_symboles().get(ticker.upper())
    liste = ([connue] if connue else []) + [u for u in chemins(ticker) if u != connue]
    return liste


def chemin(ticker):
    return chemins(ticker)[0]


RE_LIEN = re.compile(r'href="(/(?:quote/[a-z]+|stocks)/[^/"]+/transcripts/(\d+)-([a-z0-9\-]+)/)"')
RE_PERIODE = re.compile(r'^(?:q([1-4])|h([12])|fy)-(\d{4})$')


def periode_norm(slug):
    """14 sept 2026 : exercices a cheval (Sonova « h2-25-26 ») ramenes a l annee de cloture."""
    return re.sub(r'-(\d{2})-(\d{2})$', lambda m: '-20' + m.group(2), slug)
RE_DATE = re.compile(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}), (\d{4})\b')
RE_H1 = re.compile(r'(?is)<h1[^>]*>(.*?)</h1>')


def liste_transcripts(ticker):
    """Retourne (liste de (id, slug, url)) dans l ordre de la page (recent d abord), code."""
    code, body, trouve = 0, "", None
    essais = chemins_complets(ticker)
    directes = len(essais)
    mots = mots_distinctifs(nom_societe(ticker))
    i = 0
    while i < len(essais):
        url = essais[i]
        i += 1
        code, body = fetch(url)
        time.sleep(PAUSE)
        if code == 200 and body and ("Earnings Call:" in body or "Earnings Call Transcripts" in body):  # 14 sept 2026 : pages sans libelle par ligne (Sonova, semestres)
            # adresse issue de la recherche : on verifie que la page est bien
            # celle de la societe (titre) avant d y prendre un transcript
            if i > directes and mots and not (mots & mots_distinctifs(nom_page(body))):
                log("  %s : page ecartee (%s)" % (ticker, nom_page(body)[:60]))
                continue
            trouve = url
            break
        # la recherche du site n est interrogee que si aucune adresse directe
        # ne rend une page d appels de resultats (un appel reseau de plus)
        if i == len(essais) and not trouve and len(essais) <= len(chemins_complets(ticker)):
            essais = essais + recherche_symboles(ticker)
    if not trouve:
        return [], code
    enregistre_symbole(ticker, trouve)
    vus, sorties = set(), []
    for m in RE_LIEN.finditer(body):
        href, ident, slug = m.groups()
        if ident in vus:
            continue
        vus.add(ident)
        if not RE_PERIODE.match(periode_norm(slug)):
            continue  # lancements produit, journees investisseurs, etc.
        sorties.append((ident, slug, BASE + href))
    return sorties, code


def extrait_transcript(body):
    """Retourne dict {content, quarter, year, date} ou None."""
    marqueur = '<div class="border-t border-sharp pt-5 first:border-t-0 first:pt-0">'
    morceaux = body.split(marqueur)
    if len(morceaux) < 2:
        return None
    blocs = []
    for raw in morceaux[1:]:
        m = re.search(r'(?is)<div class="text-lg font-bold[^"]*">(.*?)</div>', raw)
        nom = clean_text(m.group(1)) if m else "Intervenant"
        mr = re.search(r'(?is)<div class="text-sm italic text-muted[^"]*">(.*?)</div>', raw)
        role = clean_text(mr.group(1)) if mr else ""
        paras = [clean_text(p) for p in re.findall(r'(?is)<p[^>]*>(.*?)</p>', raw)]
        paras = [p for p in paras if p]
        if not paras:
            continue
        entete = nom + (" (%s)" % role if role else "")
        blocs.append("%s: %s" % (entete, "\n".join(paras)))
    if not blocs:
        return None
    content = "\n\n".join(blocs)

    quarter, year = None, None
    mh = RE_H1.search(body)
    if mh:
        mq = re.search(r'\b(?:Q([1-4])|H([12]))\s+(\d{4})\b', clean_text(mh.group(1)))
        if mq:
            year = int(mq.group(3))
            quarter = int(mq.group(1)) if mq.group(1) else int(mq.group(2)) * 2
    date_iso = None
    # la date de l appel suit le titre h1 ; avant lui figurent la date du cours du jour
    md = RE_DATE.search(body, mh.end() if mh else 0)
    if md:
        date_iso = "%04d-%02d-%02d" % (int(md.group(3)), MOIS[md.group(1).lower()[:3]], int(md.group(2)))
    return {"content": content, "quarter": quarter, "year": year, "date": date_iso}


def date_existante(ticker):
    p = os.path.join(TRANSCRIPTS_DIR, ticker.lower() + ".json")
    if not os.path.exists(p):
        return None
    try:
        j = json.load(open(p, encoding="utf-8"))
        return (j.get("latest") or {}).get("date") or ""
    except Exception:
        return ""


def est_us(ticker):
    up = ticker.upper()
    return not any(up.endswith(s) for s in PLACES)


def calcule_cible(tous):
    univers = json.load(open(UNIVERS, encoding="utf-8"))
    tickers = univers["tickers"] if isinstance(univers, dict) else univers
    return [tk for tk in tickers if tous or not est_us(tk)]


def traite(ticker, dry_run=False):
    existant = date_existante(ticker)
    liste, code = liste_transcripts(ticker)
    if not liste:
        return "sans_page", "HTTP %s" % code

    for ident, slug, url in liste[:2]:
        code, body = fetch(url)
        time.sleep(PAUSE)
        if code != 200 or not body:
            return "erreurs", "HTTP %s sur %s" % (code, url)
        ex = extrait_transcript(body)
        if not ex or len(ex["content"]) < MIN_LEN:
            continue
        date_sa = ex["date"]
        if not date_sa:
            return "erreurs", "date introuvable sur %s" % url
        if existant and existant >= date_sa:
            return "plus_recent_deja", date_sa
        mp = RE_PERIODE.match(periode_norm(slug))
        quarter = ex["quarter"]
        year = ex["year"]
        if mp:
            year = year or int(mp.group(3))
            if quarter is None:
                quarter = int(mp.group(1)) if mp.group(1) else (int(mp.group(2)) * 2 if mp.group(2) else 4)
        if quarter is None:
            quarter = ((int(date_sa[5:7]) - 2) // 3) or 4
        doc = {
            "ticker": ticker.upper(),
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "stockanalysis",
            "latest": {
                "quarter": quarter,
                "year": year or int(date_sa[:4]),
                "date": date_sa,
                "content": ex["content"],
                "source_url": url,
            },
        }
        if not dry_run:
            os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
            with open(os.path.join(TRANSCRIPTS_DIR, ticker.lower() + ".json"), "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
        return "fait", "%s Q%s %s %d car." % (date_sa, quarter, doc["latest"]["year"], len(ex["content"]))
    return "sans_transcript", liste[0][2]


def main():
    global _log_file
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="")
    ap.add_argument("--all", action="store_true", help="toutes les societes (par defaut : non-US)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    os.makedirs(STATE_DIR, exist_ok=True)
    _log_file = open(LOG_PATH, "a", encoding="utf-8")

    cible = [t.strip() for t in a.tickers.split(",") if t.strip()] if a.tickers else calcule_cible(a.all)
    if a.limit:
        cible = cible[: a.limit]
    log("stockanalysis : %d societes a traiter%s" % (len(cible), " (dry-run)" if a.dry_run else ""))
    rapport = {"debut": datetime.now().isoformat(timespec="seconds"), "fait": [], "plus_recent_deja": [],
               "sans_page": [], "sans_transcript": [], "erreurs": []}
    for i, tk in enumerate(cible, 1):
        try:
            cat, detail = traite(tk, a.dry_run)
        except Exception as e:  # noqa
            cat, detail = "erreurs", repr(e)[:200]
        rapport.setdefault(cat, []).append([tk, detail])
        log("%d/%d %s : %s %s" % (i, len(cible), tk, cat, detail or ""))
        if i % 10 == 0:
            with open(RAPPORT_PATH, "w", encoding="utf-8") as f:
                json.dump(rapport, f, ensure_ascii=False, indent=2)
    rapport["fin"] = datetime.now().isoformat(timespec="seconds")
    with open(RAPPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)
    log("bilan : " + ", ".join("%s %d" % (k, len(v)) for k, v in rapport.items() if isinstance(v, list)))


if __name__ == "__main__":
    main()
