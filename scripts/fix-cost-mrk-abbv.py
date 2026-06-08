#!/usr/bin/env python3
"""Chirurgie contamination COST + MRK + ABBV (Yann 9 juin 2026). Verbatim agents."""
import json

def load(p): return json.load(open(p))
def save(p, d): json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)

def upsert(d, kpi):
    """Met à jour le KPI (par short) dans kpis/kpis_supplementary, sinon l'ajoute à kpis."""
    sh = kpi["short"]
    for arr in ("kpis", "kpis_supplementary"):
        for k in d.get(arr, []):
            if isinstance(k, dict) and str(k.get("short", "")).strip() == sh:
                k.update(kpi)
                return
    d.setdefault("kpis", []).append(kpi)

def remove(d, short):
    for arr in ("kpis", "kpis_supplementary"):
        if arr in d:
            d[arr] = [k for k in d[arr] if str(k.get("short", "")).strip() != short]

def mk(short, val, hist, fr, signal):
    return {"short": short, "name_fr": fr, "name_en": short, "value": val, "unit": "Mds $",
            "period_type": "quarter", "history": hist, "last_data_date": "2025-12-31",
            "type": "Demand", "nature": "Structurel", "comparable": "Comparable",
            "signal": signal, "is_wow": True}

# ===== COST : Membership Fee Revenue (base + enrich contaminé) =====
cb, ce = load("src/data/v2-pipeline/cost.json"), load("src/data/v2-pipeline-enrich/cost.json")
MF = [0.901,1.234,0.946,0.967,0.984,1.327,1.0,1.027,1.044,1.509,1.082,1.111,1.123,1.512,1.166,1.193,1.24,1.724,1.329,1.355]
mf = mk("Membership Fee Revenue", 1.355, MF, "Revenu cotisations membres", "Cotisations Costco : revenu récurrent à haute marge.")
for d in (cb, ce): upsert(d, mf)
save("src/data/v2-pipeline/cost.json", cb); save("src/data/v2-pipeline-enrich/cost.json", ce)

# ===== MRK : Keytruda (n°1) + hero =====
mb, me = load("src/data/v2-pipeline/mrk.json"), load("src/data/v2-pipeline-enrich/mrk.json")
KEY = [3.899,4.176,4.534,4.577,4.809,5.252,5.426,5.45,5.795,6.271,6.338,6.607,6.947,7.27,7.429,7.836,7.205,7.956,8.142,8.338]
key = mk("Keytruda Revenue", 8.338, KEY, "Revenu Keytruda", "Keytruda : médicament n°1 de Merck en immuno-oncologie.")
for d in (mb, me): upsert(d, key)
me["hero_kpi_override"] = "Keytruda Revenue"
me["_hero_kpi_override_reason"] = "Keytruda n°1 par revenu (Yann 9 juin 2026)"
save("src/data/v2-pipeline/mrk.json", mb); save("src/data/v2-pipeline-enrich/mrk.json", me)

# ===== ABBV : retire R&D Pipeline contaminé + 3 médicaments + hero Skyrizi =====
ab, ae = load("src/data/v2-pipeline/abbv.json"), load("src/data/v2-pipeline-enrich/abbv.json")
remove(ab, "R&D Pipeline"); remove(ae, "R&D Pipeline")
SKY = [0.574,0.674,0.796,0.895,0.94,1.252,1.397,1.576,1.36,1.883,2.126,2.394,2.008,2.727,3.205,3.778,3.425,4.423,4.708,5.006]
RIN = [0.303,0.378,0.453,0.517,0.465,0.592,0.695,0.77,0.686,0.918,1.11,1.255,1.093,1.43,1.614,1.834,1.718,2.028,2.184,2.374]
HUM = [4.867,5.068,5.425,5.334,4.736,5.363,5.559,5.579,3.541,4.012,3.547,3.304,2.27,2.814,2.227,1.682,1.121,1.18,0.993,1.246]
upsert(ae, mk("Skyrizi Revenue", 5.006, SKY, "Revenu Skyrizi", "Skyrizi : blockbuster immunologie en forte croissance."))
upsert(ae, mk("Rinvoq Revenue", 2.374, RIN, "Revenu Rinvoq", "Rinvoq : 2e moteur immunologie d'AbbVie."))
upsert(ae, mk("Humira Revenue", 1.246, HUM, "Revenu Humira", "Humira : déclin post perte d'exclusivité (LOE)."))
ae["hero_kpi_override"] = "Skyrizi Revenue"
ae["_hero_kpi_override_reason"] = "Skyrizi nouveau moteur AbbVie (Yann 9 juin 2026)"
save("src/data/v2-pipeline/abbv.json", ab); save("src/data/v2-pipeline-enrich/abbv.json", ae)

# ===== BAC : 4 segments (enrich contaminé = total revenue) =====
bb, be = load("src/data/v2-pipeline/bac.json"), load("src/data/v2-pipeline-enrich/bac.json")
BAC = {
 "Consumer Banking": (11.201, [8.069,8.186,8.838,8.912,8.813,9.136,9.904,10.782,10.706,10.524,10.472,10.329,10.166,10.206,10.418,10.646,10.493,10.813,11.166,11.201]),
 "GWIM Revenue": (6.618, [4.971,5.065,5.31,5.402,5.476,5.433,5.429,5.41,5.315,5.242,5.321,5.227,5.591,5.574,5.762,6.002,6.016,5.937,6.312,6.618]),
 "Global Banking": (6.196, [4.633,5.089,5.244,5.908,5.194,5.006,5.591,6.438,6.203,6.462,6.203,5.928,5.98,6.053,5.834,6.091,5.977,5.69,6.245,6.196]),
 "Global Markets": (5.308, [6.198,4.72,4.519,3.818,5.292,4.502,4.483,3.861,5.626,4.871,4.942,4.088,5.883,5.459,5.63,4.84,6.584,5.98,6.224,5.308]),
}
for short, (val, hist) in BAC.items():
    for d in (bb, be):
        for arr in ("kpis", "kpis_supplementary"):
            for k in d.get(arr, []):
                if isinstance(k, dict) and str(k.get("short", "")).strip() == short:
                    k.update({"history": hist, "value": val, "period_type": "quarter", "last_data_date": "2025-12-31", "unit": "Mds $"})
save("src/data/v2-pipeline/bac.json", bb); save("src/data/v2-pipeline-enrich/bac.json", be)
print("OK COST + MRK(hero Keytruda) + ABBV(-R&D Pipeline +Skyrizi/Rinvoq/Humira, hero Skyrizi) + BAC(4 segments)")
