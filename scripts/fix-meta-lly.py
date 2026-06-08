#!/usr/bin/env python3
"""Chirurgie enrich flagships META + LLY (Yann 9 juin 2026). Verbatim agents."""
import json

def load(p): return json.load(open(p))
def save(p, d): json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)

# ===== META =====
mb = load("src/data/v2-pipeline/meta.json")
me = load("src/data/v2-pipeline-enrich/meta.json")
ARPP = [9.57,9.87,9.44,10.68,9.47,10.42,10.93,12.33,11.20,11.89,12.29,14.25,12.36,13.65,14.46,16.56]
RL = [0.727,0.339,0.276,0.21,1.071,0.44,0.353,0.27,1.083,0.412,0.37,0.47,0.955]
DAP = [2.72,2.76,2.81,2.82,2.87,2.88,2.93,2.96,3.02,3.07,3.14,3.19,3.24,3.27,3.29,3.35,3.43,3.48,3.54,3.58]
# retire FoA Revenue (= CA total, contaminé)
me["kpis"] = [k for k in me.get("kpis", []) if k.get("short") != "FoA Revenue"]
# ajoute ARPP
me["kpis"].append({
    "short": "ARPP", "name_fr": "Revenu moyen par personne", "name_en": "Average Revenue Per Person",
    "explanation": "Revenu Family of Apps divisé par la moyenne de personnes actives quotidiennes. Mesure la monétisation de l'audience.",
    "value": 16.56, "unit": "$", "yoy": "+16.2%", "type": "Monétisation", "nature": "Structurel",
    "comparable": "Comparable", "signal": "Meta monétise de mieux en mieux son audience.",
    "history": ARPP, "period_type": "quarter", "last_data_date": "2025-12-31", "is_wow": True,
})
# corrige RL Revenue (vrai segment Reality Labs)
for k in me["kpis"]:
    if k.get("short") == "RL Revenue":
        k.update({"history": RL, "value": 0.955, "period_type": "quarter", "last_data_date": "2025-12-31", "unit": "Mds $"})
# dedup DAP (retire le doublon annuel des supplémentaires)
me["kpis_supplementary"] = [k for k in me.get("kpis_supplementary", []) if k.get("short") != "Daily Active People (Family)"]
# étend DAP (hero) à 20 trim dans la base
for k in mb.get("kpis", []):
    if k.get("short") == "DAP":
        k.update({"history": DAP, "value": 3.58, "period_type": "quarter", "last_data_date": "2025-12-31"})
me["_flagship_fix_at"] = "2026-06-09"
save("src/data/v2-pipeline/meta.json", mb)
save("src/data/v2-pipeline-enrich/meta.json", me)
print("META: -FoA +ARPP(16q) | RL corrigé(13q) | DAP→20q | dedup DAP")

# ===== LLY =====
lb = load("src/data/v2-pipeline/lly.json")
le = load("src/data/v2-pipeline-enrich/lly.json")
MJ = [0.016,0.187,0.279,0.569,0.98,1.409,2.206,1.807,3.091,3.113,3.53,3.842,5.199,6.515,7.41]
# retire Top Drug contaminé (base + enrich) ; le vrai "Mounjaro Revenue" reste
lb["kpis"] = [k for k in lb.get("kpis", []) if k.get("short") != "Top Drug"]
le["kpis"] = [k for k in le.get("kpis", []) if k.get("short") != "Top Drug"]
# corrige Mounjaro Revenue -> trimestriel réel
for arr in ("kpis", "kpis_supplementary"):
    for k in le.get(arr, []):
        if k.get("short") == "Mounjaro Revenue":
            k.update({"history": MJ, "value": 7.41, "period_type": "quarter", "last_data_date": "2025-12-31", "unit": "Mds $"})
le["_flagship_fix_at"] = "2026-06-09"
save("src/data/v2-pipeline/lly.json", lb)
save("src/data/v2-pipeline-enrich/lly.json", le)
print("LLY: -Top Drug(contaminé) | Mounjaro Revenue→trimestriel 15q")
