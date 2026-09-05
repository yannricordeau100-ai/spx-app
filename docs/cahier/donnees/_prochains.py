#!/usr/bin/env python3
"""Etat des lots de recherche de donnees KPI : faits / partiels / a lancer, dans l ordre des secteurs."""
import json, glob, os, sys
R = os.path.dirname(os.path.abspath(__file__))
ORDRE = ["45", "20", "40", "35", "25", "30", "15", "55", "60", "50", "10"]
faits = {json.load(open(f))["ticker"] for f in glob.glob(os.path.join(R, "[A-Z]*.json"))}
lots = []
for f in sorted(glob.glob(os.path.join(R, "_lots", "*.json"))):
    nom = os.path.basename(f)[:-5]; sec = nom.split("-")[0]
    tk = [r["ticker"] for r in json.load(open(f))]
    ok = [t for t in tk if t in faits]
    lots.append((ORDRE.index(sec) if sec in ORDRE else 99, nom, len(ok), len(tk), [t for t in tk if t not in faits]))
lots.sort()
complets = [l for l in lots if l[2] == l[3]]; partiels = [l for l in lots if 0 < l[2] < l[3]]; alancer = [l for l in lots if l[2] == 0]
print(f"societes faites : {len(faits)} / 666 | lots complets {len(complets)} | partiels {len(partiels)} | a lancer {len(alancer)}")
for sec in ORDRE:
    n = sum(l[2] for l in lots if l[1].startswith(sec + "-")); tot = sum(l[3] for l in lots if l[1].startswith(sec + "-"))
    print(f"  secteur {sec} : {n} / {tot}")
if "--prochains" in sys.argv:
    k = int(sys.argv[sys.argv.index("--prochains") + 1]) if len(sys.argv) > sys.argv.index("--prochains") + 1 else 6
    for l in (partiels + alancer)[:k]: print("LOT", l[1], "restants", l[4])
