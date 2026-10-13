#!/usr/bin/env python3
"""13 oct 2026 : rattache aux KPI institutionnels les KPI de fiche trouves par les preuves
(data-lake/_kpi-instit/preuves/<T>.json : statuts publie_ajoute, deja_present*, publie_deja_present).
Pose type_comparable (origine referentiel) sur le KPI de kpis-haut s il n en a pas, et ajoute la societe
a stes_avec du KPI d industrie (retiree de non_publie / stes_sans / a_rechercher). --simulation pour compter."""
import json, glob, re, sys, os
os.chdir("/Users/yann/spx-app")
SIM = "--simulation" in sys.argv
E = "src/data/kpi-industries-etat.json"
etat = json.load(open(E))
OK = ("publie_ajoute", "deja_present", "deja_present_fiche", "publie_deja_present")
norm = lambda s: re.sub(r"\s+", " ", (s or "").lower().replace("’", "'")).strip()
n_tc = n_avec = 0; manques = []
for f in sorted(glob.glob("data-lake/_kpi-instit/preuves/*.json")):
    p = json.load(open(f)); T = p["ticker"]
    ind = next((i for i in etat["industries"] if T in i["stes"]), None)
    kh = f".batches-drafts-safe/kpis-haut/{T}.json"
    if not ind or not os.path.exists(kh): continue
    d = json.load(open(kh)); ks = d["kpis"] if isinstance(d, dict) else d
    shorts = {k.get("short"): k for k in ks if k.get("short")}
    modif = False
    for a in p.get("autres", []):
        if a.get("statut") not in OK: continue
        nom = norm(a["kpi"])
        ki = next((k for k in ind["kpis"] if norm(k["fr"]) in nom or nom.startswith(norm(k["fr"])[:25]) or norm(k["en"]) in nom), None)
        texte = json.dumps({x: y for x, y in a.items() if x not in ("kpi", "preuve")}, ensure_ascii=False)
        trouves = [s for s in shorts if re.search(r"(?<![A-Za-z0-9_])" + re.escape(s) + r"(?![A-Za-z0-9_])", texte)]
        if not ki or not trouves: manques.append(f"{T}:{a['kpi'][:40]}"); continue
        for s in trouves:
            k = shorts[s]
            if not (k.get("type_comparable") or {}).get("origine") == "referentiel":
                k["type_comparable"] = {"fr": ki["fr"], "en": ki["en"], "origine": "referentiel"}; n_tc += 1; modif = True
        if T not in ki.setdefault("stes_avec", []):
            ki["stes_avec"].append(T); n_avec += 1
            for champ in ("non_publie", "stes_sans", "a_rechercher"):
                if isinstance(ki.get(champ), dict): ki[champ].pop(T, None)
                elif isinstance(ki.get(champ), list) and T in ki[champ]: ki[champ].remove(T)
    if modif and not SIM:
        json.dump(d, open(kh, "w"), ensure_ascii=False, indent=2); open(kh, "a").write("\n")
if not SIM:
    json.dump(etat, open(E, "w"), ensure_ascii=False, indent=1); open(E, "a").write("\n")
print(f"type_comparable poses {n_tc}, stes_avec ajoutes {n_avec}, non rattaches {len(manques)}")
for m in manques: print("  ", m)
