#!/usr/bin/env python3
"""Date du document le plus recent de chaque societe dans le data-lake (9 sept 2026).
Ecrit src/data/_data-lake-dernier-doc.json {ticker: "YYYY-MM-DD"}. Sert de reference
de publication a /sandbox/synchro quand la date SEC manque dans enrich : le data-lake
n est pas deploye sur Vercel, ce fichier l est. Relance chaque nuit par earnings-refresh.sh."""
import json, os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uni = json.load(open(os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")))["tickers"]
DOSS = ["10Q", "10K", "8K", "ir/S1", "ir/URD", "ir/COMMUNIQUES", "ir/SLIDES"]
out = {}
for t in uni:
    m = None
    for d in DOSS:
        for f in glob.glob(os.path.join(ROOT, "data-lake", t, d, "*")):
            mm = re.search(r"(20\d{2}-\d{2}-\d{2})", os.path.basename(f))
            if mm and (m is None or mm.group(1) > m): m = mm.group(1)
    if m: out[t] = m
json.dump({"genere": __import__("datetime").date.today().isoformat(), "regle": "date la plus recente dans les noms de fichiers 10Q, 10K, 8K, ir/*", "dates": out},
          open(os.path.join(ROOT, "src/data/_data-lake-dernier-doc.json"), "w"), ensure_ascii=False, indent=0)
print(len(out), "societes datees sur", len(uni))
