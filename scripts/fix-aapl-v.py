#!/usr/bin/env python3
"""Heros AAPL (iPhone quarterly) + V (Payments Volume) — verbatim agents."""
import json

def load(p): return json.load(open(p))
def save(p, d): json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)

def upd(d, short, fields):
    found = False
    for arr in ("kpis", "kpis_supplementary"):
        for k in d.get(arr, []):
            if isinstance(k, dict) and str(k.get("short", "")).strip() == short:
                k.update(fields); found = True
    return found

# AAPL : iPhone Revenue en quarterly (20 trim déjà présents mais en annuel) + hero
IPH = [65.597,47.938,39.57,38.868,71.628,50.57,40.665,42.626,65.775,51.334,39.669,43.805,69.702,45.963,39.296,46.222,69.138,46.841,44.582,49.025]
af = {"period_type": "quarter", "history": IPH, "value": 49.025, "unit": "Mds $", "last_data_date": "2025-09-27"}
ab, ae = load("src/data/v2-pipeline/aapl.json"), load("src/data/v2-pipeline-enrich/aapl.json")
upd(ab, "iPhone Revenue", af); upd(ae, "iPhone Revenue", af)
ae["hero_kpi_override"] = "iPhone Revenue"
ae["_hero_kpi_override_reason"] = "iPhone = 1er revenu produit Apple (Yann 9 juin 2026)"
save("src/data/v2-pipeline/aapl.json", ab); save("src/data/v2-pipeline-enrich/aapl.json", ae)

# V : Payments Volume 20 trim + hero
PV = [2085,2270,2361,2130,2349,2475,2423,2784,2963,2775,2929,3018,2957,3198,3280,3172,3410,3524,3344,3732]
pv = {"short": "Payments Volume", "name_fr": "Volume de paiements", "name_en": "Payments Volume",
      "unit": "Mds $", "period_type": "quarter", "history": PV, "value": 3732, "last_data_date": "2025-09-30",
      "type": "Demand", "nature": "Structurel", "comparable": "Comparable",
      "signal": "Volume de paiements traité par Visa, moteur du revenu.", "is_wow": True}
vb, ve = load("src/data/v2-pipeline/v.json"), load("src/data/v2-pipeline-enrich/v.json")
if not upd(vb, "Payments Volume", pv):
    vb.setdefault("kpis", []).append(pv)
if not upd(ve, "Payments Volume", pv):
    ve.setdefault("kpis", []).append(pv)
ve["hero_kpi_override"] = "Payments Volume"
ve["_hero_kpi_override_reason"] = "Payments Volume = métrique phare Visa (Yann 9 juin 2026)"
save("src/data/v2-pipeline/v.json", vb); save("src/data/v2-pipeline-enrich/v.json", ve)
print("AAPL hero=iPhone Revenue (quarterly 20q) | V hero=Payments Volume (20q)")
