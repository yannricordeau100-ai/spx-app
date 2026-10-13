#!/usr/bin/env python3
"""Integre le classement des KPI des institutionnels (data-lake/_kpi-instit/<code>.json)
dans src/data/kpi-industries-etat.json : par KPI, trois dictionnaires {ticker: raison}
non_applicable (rouge), non_publie (orange), a_rechercher (jaune).
stes_avec, stes_sans et sans_objet ne sont pas modifies (API et bouton existants).
Usage : python3 scripts/kpi-instit-statuts-integrer.py [AAAA-MM-JJ]"""
import glob, json, os, sys
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT = os.path.join(RACINE, "src/data/kpi-industries-etat.json")
date = sys.argv[1] if len(sys.argv) > 1 else "2026-10-13"
d = json.load(open(ETAT, encoding="utf-8"))
par_code = {i["code"]: i for i in d["industries"]}
for i in d["industries"]:
    for k in i["kpis"]:
        for champ in ("non_applicable", "non_publie", "a_rechercher"):
            k.pop(champ, None)
n = {"non_applicable": 0, "non_publie": 0, "a_rechercher": 0}
inconnus = 0
for f in sorted(glob.glob(os.path.join(RACINE, "data-lake/_kpi-instit/[0-9]*.json"))):
    j = json.load(open(f, encoding="utf-8"))
    ind = par_code.get(j["code"])
    if not ind:
        inconnus += len(j.get("paires", []))
        continue
    kpis = {k["fr"]: k for k in ind["kpis"]}
    for p in j.get("paires", []):
        k = kpis.get(p["kpi_fr"])
        if not k or p["statut"] not in n or p["ticker"] in k.get("stes_avec", []):
            inconnus += 1
            continue
        k.setdefault(p["statut"], {})[p["ticker"]] = p.get("raison") or ""
        n[p["statut"]] += 1
d["statuts_maj"] = date
with open(ETAT, "w", encoding="utf-8") as fh:
    json.dump(d, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print(n, "ignores:", inconnus)
