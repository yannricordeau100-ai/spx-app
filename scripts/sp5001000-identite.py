#!/usr/bin/env python3
"""Identite des fiches du niveau 1 (vague sp5001000) : customer_type, tagline, founded, ipo. 12 oct 2026.

Dans l univers principal ces champs viennent du PL (extraction par modele de
langue des 10-K, dont enrich-sp500-cerebras-blocs-unified.py pour
customer_type, « Cerebras Qwen-3 10-K »). Les cles Cerebras etant fermees, ce
script passe par scripts/moteur_gratuit.py (Cerebras, puis Groq, puis Gemini ;
JAMAIS l API Anthropic) avec le meme schema, sur la section « Item 1 Business »
du dernier 10-K deja telecharge (data-lake/<T>/10K).

Controles (rien n est pose s il echoue) :
  - customer_type.primary dans la liste admise ; libelle francais sans tiret long ;
  - founded : annee citee DANS une phrase recopiee mot pour mot du 10-K
    (verifiee dans le texte) qui parle de fondation / creation / constitution ;
  - tagline (anglais, 14 mots max) et tagline_fr : aucun chiffre absent du texte,
    aucun tiret long ;
  - ipo : SANS modele, annee de premiere cotation Yahoo Finance
    (firstTradeDateMilliseconds) retenue seulement si un formulaire S-1 / F-1 de
    la societe est dans data-lake/<T>/S1 et la precede de moins de 2 ans.

Ecrit customer_type, tagline, founded, ipo dans src/data/v2-pipeline/<t>.json
(le chargeur ne lit ces champs que la ; sp5001000-onboard.py les conserve,
CLES_ENRICHIES_PL) et tagline_fr dans src/data/v2-pipeline-enrich/<t>.json
(fusionne en tagline_i18n.fr). Ne remplace jamais un champ deja rempli.

Usage : python3 scripts/sp5001000-identite.py --tickers-file src/data/univers-sp5001000.json [--limit N] [--sans-llm]
"""
import argparse
import datetime as dt
import glob
import gzip
import html
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 12 oct 2026 : « formed / incorporated / organized » seuls designent souvent la societe holding
# creee pour l introduction en bourse (PLNT « Delaware corporation formed on March 16, 2015 »,
# fondee en 1992) : refuses. Il faut un mot de fondation.
FONDATION = re.compile(r"\bfound(ed|ing|er)|\bestablished|\bpioneer|\bbegan\b|\bcommenced\b|\borigins?\b|\bstarted\b", re.I)
TYPES = ("B2B", "B2C", "Mixed", "Government", "Wholesale", "Healthcare")
PROMPT = """Tu lis la section « Business » du dernier rapport annuel 10-K de {name} ({ticker}).
Réponds UNIQUEMENT en JSON :
{{"customer_type": "B2B" | "B2C" | "Mixed" | "Government" | "Wholesale" | "Healthcare" | null,
 "customer_type_label": "une phrase en français (100 caractères max) qui dit à qui la société vend, d'après le texte",
 "tagline": "short English tagline of what the company does, 14 words max, no numbers, in the company's own wording when possible",
 "tagline_fr": "la même accroche en français, 14 mots maximum, sans chiffre",
 "founded_year": année de fondation ou de constitution de la société si le texte la donne explicitement, sinon null,
 "founded_quote": "la phrase EXACTE du texte, recopiée mot pour mot, qui donne cette année" | null}}
Règles : jamais inventer ; null si le texte ne permet pas de répondre ; pas de tiret long.
Texte :
---
{ctx}
---"""


def texte_10k(t):
    fs = [f for f in sorted(glob.glob(f"{ROOT}/data-lake/{t}/10K/{t}_*.htm.gz")) if "_ER_" not in f and "ex99" not in f.lower()]
    if len(fs) >= 2:
        fs = [max(fs[-2:], key=os.path.getsize)]
    if not fs:
        return None
    brut = gzip.open(fs[-1], "rt", encoding="utf-8", errors="ignore").read()
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", brut)))
    pos = [m.start() for m in re.finditer(r"item\s*1\.?\s*business", txt, re.I)]
    debut = pos[1] if len(pos) > 1 else (pos[0] if pos else len(txt) // 10)
    return txt[debut: debut + 9000]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def chiffres_ok(s, src):
    return all(n in src for n in re.findall(r"\d+", s or ""))


def ipo_yahoo(t):
    s1 = sorted(glob.glob(f"{ROOT}/data-lake/{t}/S1/*"))
    if not s1:
        return None
    m = re.search(r"_(\d{4}-\d{2}-\d{2})", os.path.basename(s1[0]))
    if not m:
        return None
    import yfinance as yf
    try:
        ms = (yf.Ticker(t).info or {}).get("firstTradeDateMilliseconds")
    except Exception:
        return None
    if not ms:
        return None
    premier = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).date()
    depot = dt.date.fromisoformat(m.group(1))
    if 0 <= (premier - depot).days <= 730:
        return premier.year
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sans-llm", action="store_true")
    ap.add_argument("--tranche", default="0/1", help="i/n : traite les societes de rang i modulo n (processus paralleles)")
    a = ap.parse_args()
    from moteur_gratuit import appelle, MoteurIndisponible
    d = json.load(open(a.tickers_file))
    tickers = d["tickers"] if isinstance(d, dict) else d
    if a.limit:
        tickers = tickers[: a.limit]
    i, n = (int(x) for x in a.tranche.split("/"))
    tickers = [t for k, t in enumerate(tickers) if k % n == i]
    bilan = {"customer_type": 0, "tagline": 0, "tagline_fr": 0, "founded": 0, "ipo": 0, "sans_10k": 0, "refus": 0, "moteur_indispo": 0}
    for t in tickers:
        pp = f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json"
        pe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        if not os.path.exists(pp):
            continue
        pl = json.load(open(pp))
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        poser_pl, poser_en = {}, {}
        if not pl.get("ipo"):
            y = ipo_yahoo(t)
            if y:
                poser_pl["ipo"] = y
        besoin = not pl.get("customer_type") or not pl.get("tagline") or not pl.get("founded") or not en.get("tagline_fr")
        if besoin and not a.sans_llm:
            ctx = texte_10k(t)
            if not ctx:
                bilan["sans_10k"] += 1
            else:
                try:
                    rep, moteur = appelle(PROMPT.format(name=pl.get("name") or t, ticker=t, ctx=ctx), json_attendu=True)
                except MoteurIndisponible:
                    bilan["moteur_indispo"] += 1
                    print("MOTEUR INDISPONIBLE, pause 120 s", flush=True)
                    time.sleep(120)
                    rep, moteur = None, None
                except Exception:
                    rep, moteur = None, None
                if isinstance(rep, dict):
                    src = ctx
                    ct, lab = rep.get("customer_type"), rep.get("customer_type_label")
                    if not pl.get("customer_type") and ct in TYPES and isinstance(lab, str) and 10 < len(lab) <= 160 and "—" not in lab:
                        poser_pl["customer_type"] = {"primary": ct, "label": lab.strip(), "_source": f"10-K Item 1, moteur gratuit ({moteur})"}
                    tg = rep.get("tagline")
                    if not pl.get("tagline") and isinstance(tg, str) and 3 <= len(tg.split()) <= 14 and "—" not in tg and chiffres_ok(tg, src):
                        poser_pl["tagline"] = tg.strip().rstrip(".")
                    tf = rep.get("tagline_fr")
                    if not en.get("tagline_fr") and (poser_pl.get("tagline") or pl.get("tagline")) and isinstance(tf, str) \
                            and 3 <= len(tf.split()) <= 16 and "—" not in tf and chiffres_ok(tf, src):
                        poser_en["tagline_fr"] = tf.strip().rstrip(".")
                    fy, fq = rep.get("founded_year"), rep.get("founded_quote")
                    try:
                        fy = int(fy) if fy is not None else None
                    except (TypeError, ValueError):
                        fy = None
                    if not pl.get("founded") and fy and 1700 <= fy <= dt.date.today().year and isinstance(fq, str) \
                            and str(fy) in fq and len(norm(fq)) > 20 and norm(fq) in norm(src) \
                            and re.search(FONDATION, fq):
                        poser_pl["founded"] = fy
                        poser_en["_founded_source"] = f"10-K Item 1 : « {fq.strip()[:240]} »"
                    if not poser_pl and not poser_en:
                        bilan["refus"] += 1
        if poser_pl:
            pl = json.load(open(pp))  # relu juste avant ecriture (autres agents)
            for k, v in poser_pl.items():
                if not pl.get(k):
                    pl[k] = v
                    bilan[k] += 1
            with open(pp, "w", encoding="utf-8") as f:
                json.dump(pl, f, ensure_ascii=False, indent=1)
        if poser_en:
            en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
            for k, v in poser_en.items():
                if not en.get(k):
                    en[k] = v
                    if k in bilan:
                        bilan[k] += 1
            with open(pe, "w", encoding="utf-8") as f:
                json.dump(en, f, ensure_ascii=False, indent=2)
    print(json.dumps(bilan, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
