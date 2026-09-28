#!/usr/bin/env python3
"""Retire des textes des KPI (signal, description, explication) toute precision de
source : « (10-Q) », « (Exercice 2017, table 'Net revenue by platform') »,
« selon le 10-K »... Regle Yann 28 sept 2026 : jamais ce genre de precision, sur
aucune societe ni aucun KPI. Usage : python3 scripts/nettoie-sources-kpi.py [--ecrit]"""
import json, glob, re, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOTS = r"(?:\btable\b|\btableau\b|\bExercice \d{4}\s*,|\b10-K\b|\b10-Q\b|\b20-F\b|\b8-K\b|\b6-K\b|\bnote \d|\bnotes? (?:de |des |sur les |annexe)|\bpage \d|\bp\. ?\d|rapport annuel|annual report|communiqu[ée]|press release|earnings release|\bsource\b|\bURD\b|DEF ?14A|\bItem \d|\bXBRL\b|document d.enregistrement|\bslide|pr[ée]sentation (?:investisseurs|des r[ée]sultats)|conference call|call de r[ée]sultats|transcript)"
PAREN = re.compile(r"\s*\((?=[^()]*" + MOTS + r")[^()]*\)", re.I)
PHRASE = re.compile(r",?\s*(?:selon|d.apr[èe]s|dans|tir[ée] d[eu]s?|issu d[eu]s?|publi[ée] dans|source\s*:)\s+(?:le |la |les |l.)?(?:dernier |derni[èe]re )?(?:10-K|10-Q|20-F|8-K|rapport annuel|communiqu[ée] de r[ée]sultats|communiqu[ée]|document d.enregistrement universel)\b[^.;)]*", re.I)
SOURCE_FIN = re.compile(r"\s*\bSources?\s*:\s*[^.]*(?:\.|$)", re.I)
CHAMPS = ("signal", "description", "description_fr", "explanation", "explanation_fr", "signal_fr")
def nettoie(v):
    n = PAREN.sub("", v)
    n = PHRASE.sub("", n)
    n = SOURCE_FIN.sub("", n)
    n = re.sub(r"\s+([.,])", r"\1", n)
    n = re.sub(r"\s{2,}", " ", n).strip()
    return n
fichiers = glob.glob(".batches-drafts-safe/kpis-haut/*.json") + glob.glob("src/data/v2-pipeline/*.json") + glob.glob("src/data/v2-pipeline-enrich/*.json") + glob.glob("src/data/v2-pipeline-specific-kpis/*.json")
total = 0; nf = 0; ex = []
for f in fichiers:
    if "bak" in f or "_merged" in f: continue
    try: s = open(f).read(); d = json.loads(s)
    except Exception: continue
    ch = 0
    def walk(o):
        global total
        nonlocal_ch = 0
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if k in CHAMPS and isinstance(v, str):
                    n = nettoie(v)
                    if n != v and n:
                        o[k] = n; total_add.append(1)
                        if len(ex) < 8: ex.append((f.split("/")[-1], v[:120], n[:120]))
                else: walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    total_add = []
    walk(d)
    if total_add:
        total += len(total_add); nf += 1
        if "--ecrit" in sys.argv:
            ind = 2 if '\n  "' in s[:40] else (1 if '\n "' in s[:40] else None)
            json.dump(d, open(f, "w"), ensure_ascii=False, indent=ind)
print("textes nettoyes", total, "fichiers", nf)
for e in ex: print(" -", e[0], "|", e[1], "=>", e[2])
