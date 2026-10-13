#!/usr/bin/env python3
"""13 oct 2026 : applique docs/cahier/kpi/_reclassement.json a src/data/kpi-industries-etat.json
(pastille « n/N institutionnels » et KPI jaunes de la fiche, industrie GICS a 6 chiffres).

Pour chaque societe reclassee dont l industrie a 6 chiffres change (code_gics[:6]) :
 - retiree de l ancienne industrie (stes et tous les statuts de ses KPI) ;
 - ajoutee a la nouvelle, avec le statut de chaque KPI lu dans kpi_industrie_6 :
   present -> stes_avec + shorts_fiche {ticker: [codes de la fiche]} (rattachement explicite,
   lu par src/lib/kpi-instit-fiche.ts) ; non_applicable -> sans_objet + non_applicable ;
   non_publie -> non_publie ; a_rechercher -> a_rechercher (raison dans stes_sans pour ces trois derniers).
Seules ces societes sont touchees. Idempotent. A relancer apres scripts/kpi-instit-statuts-integrer.py
(qui efface et reconstruit non_applicable / non_publie / a_rechercher de toutes les societes).
Usage : python3 scripts/kpi-instit-reclasser.py [--simulation]"""
import json, os, sys
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT = os.path.join(RACINE, "src/data/kpi-industries-etat.json")
RECL = os.path.join(RACINE, "docs/cahier/kpi/_reclassement.json")
SIM = "--simulation" in sys.argv

etat = json.load(open(ETAT, encoding="utf-8"))
recl = {t: v for t, v in json.load(open(RECL, encoding="utf-8")).items() if not t.startswith("_")}
par_code = {i["code"]: i for i in etat["industries"]}


def retirer(ind, t):
    if t in ind["stes"]:
        ind["stes"].remove(t)
    for k in ind["kpis"]:
        for champ in ("stes_avec", "sans_objet"):
            if t in (k.get(champ) or []):
                k[champ].remove(t)
        for champ in ("stes_sans", "non_applicable", "non_publie", "a_rechercher", "shorts_fiche"):
            if isinstance(k.get(champ), dict):
                k[champ].pop(t, None)
                if champ == "shorts_fiche" and not k[champ]:
                    k.pop(champ)


trace = etat.setdefault("reclassements", {})
for t, r in sorted(recl.items()):
    k6 = r.get("kpi_industrie_6") or {}
    cible = (r.get("code_gics") or "")[:6]
    actuelle = next((i for i in etat["industries"] if t in i["stes"]), None)
    origine = (trace.get(t) or {}).get("de") or (actuelle or {}).get("code")
    if not k6.get("kpis"):
        print(f"{t}: inchange ({k6.get('inchange') or 'pas de statuts kpi_industrie_6'})")
        continue
    ind = par_code.get(cible)
    if not ind or k6.get("code") != cible:
        print(f"{t}: ERREUR industrie {cible} absente ou incoherente")
        continue
    for i in etat["industries"]:
        retirer(i, t)
    ind["stes"].append(t)
    n_pres = n_app = 0
    for k in ind["kpis"]:
        s = k6["kpis"].get(k["en"])
        if not s:
            print(f"{t}: ERREUR statut manquant pour {k['en']}")
            continue
        st, raison = s["statut"], s.get("raison") or ""
        if st == "present":
            k.setdefault("stes_avec", []).append(t)
            k.setdefault("shorts_fiche", {})[t] = list(s.get("shorts") or [])
            n_pres += 1; n_app += 1
        elif st == "non_applicable":
            k.setdefault("sans_objet", []).append(t)
            k.setdefault("non_applicable", {})[t] = raison
            k.setdefault("stes_sans", {})[t] = raison
        elif st in ("non_publie", "a_rechercher"):
            k.setdefault(st, {})[t] = raison
            k.setdefault("stes_sans", {})[t] = raison
            n_app += 1
    trace[t] = {"de": origine, "vers": cible, "code_gics": r.get("code_gics"), "date": r.get("date")}
    print(f"{t}: {origine} -> {cible} {ind['industrie']} : {n_pres}/{n_app}")

if not SIM:
    with open(ETAT, "w", encoding="utf-8") as fh:
        json.dump(etat, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
