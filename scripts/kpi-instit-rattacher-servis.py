#!/usr/bin/env python3
"""13 oct 2026 : un KPI SERVI sur la fiche (tableau, hero compris, stories exclues) qui porte un KPI
d industrie comme type comparable du referentiel (type_comparable.origine = "referentiel", meme
libelle anglais) compte comme present dans src/data/kpi-industries-etat.json : la societe est
ajoutee a stes_avec du KPI d industrie (retiree de a_rechercher).

Avant ce script, le hero et certains KPI du tableau n etaient jamais comptes (ex. FGR.PA, hero
BACKLOG_FY, laisse « a rechercher » sur le carnet de commandes).

Garde-fous :
 - jamais contre un statut verifie : societe en non_publie, non_applicable, sans_objet ou stes_sans
   pour ce KPI -> ignoree ;
 - REFUS : rapprochements faux verifies a la main ;
 - KPI servis lus dans le cache de scripts/build-kpi-industrie-par-societe.py (champ servi, tc_origine,
   ajout = hero / tableau), univers principal seulement.
Usage : python3 scripts/kpi-instit-rattacher-servis.py [--simulation] [--cache <jsonl>]"""
import json, os, sys
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT = os.path.join(RACINE, "src/data/kpi-industries-etat.json")
CACHE = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else "/tmp/fiches-kpi-cache.jsonl"
SIM = "--simulation" in sys.argv
# (ticker, code de la fiche) : type comparable faux, verifie a la main le 13 oct 2026
REFUS = {
    ("HBAN", "AvgCommLoans"),  # encours moyen de prets C&I (niveau) et non croissance des prets
    ("WFC", "IB Fees"),        # commissions de banque d investissement, une partie seulement des commissions
    ("WFC", "NCO"),            # pertes nettes en M$, pas un ratio
}
VERIFIES = ("non_publie", "non_applicable", "sans_objet", "stes_sans")

uni = set(json.load(open(os.path.join(RACINE, "src/data/v1-9-5-clean-all-tickers.json"), encoding="utf-8"))["tickers"])
etat = json.load(open(ETAT, encoding="utf-8"))
fiches = {}
for l in open(CACHE, encoding="utf-8"):
    if l.strip():
        d = json.loads(l)
        if d.get("ticker") in uni and "kpis" in d:
            fiches[d["ticker"]] = d
if not any("tc_origine" in k for f in fiches.values() for k in f["kpis"]):
    sys.exit("cache sans tc_origine : reconstruire avec scripts/build-kpi-industrie-par-societe.py --cache")

ajouts = []
for t, f in sorted(fiches.items()):
    ind = next((i for i in etat["industries"] if t in i["stes"]), None)
    if not ind:
        continue
    par_en = {k["en"].strip().lower(): k for k in ind["kpis"]}
    for k in f["kpis"]:
        if not k.get("servi") or k.get("tc_origine") != "referentiel" or not k.get("tc_en"):
            continue
        if (t, k["short"]) in REFUS:
            continue
        ki = par_en.get(k["tc_en"].strip().lower())
        if not ki or t in (ki.get("stes_avec") or []):
            continue
        if any(t in (ki.get(c) or {}) for c in VERIFIES):
            continue
        ki.setdefault("stes_avec", []).append(t)
        if isinstance(ki.get("a_rechercher"), dict):
            ki["a_rechercher"].pop(t, None)
        ki.setdefault("rattaches_servis", {})[t] = k["short"]
        ajouts.append((t, k["short"], ki["en"], k.get("ajout") or ""))

for a in ajouts:
    print("  ", *a)
print(f"stes_avec ajoutes : {len(ajouts)} ({len({a[0] for a in ajouts})} societes)")
if not SIM:
    etat["servis_maj"] = "2026-10-13"
    with open(ETAT, "w", encoding="utf-8") as fh:
        json.dump(etat, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
