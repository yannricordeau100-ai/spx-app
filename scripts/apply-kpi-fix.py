#!/usr/bin/env python3
"""
apply-kpi-fix.py — applique un fix KPI à v2-pipeline (base) ET v2-pipeline-enrich.

La contamination vit souvent dans la couche ENRICH (kpis / kpis_supplementary),
pas la base. On patche donc TOUTES les occurrences du short dans les 2 fichiers.

Usage : python3 scripts/apply-kpi-fix.py <ticker> <fix.json>
fix.json = {"short": "...", "history": [...], "value": ..., "period_type": "...",
            "last_data_date": "...", "unit": "...", "source": "..."}
"""
import json
import sys

if len(sys.argv) < 3:
    print("usage: apply-kpi-fix.py <ticker> <fix.json>")
    sys.exit(2)

ticker = sys.argv[1].lower()
fix = json.load(open(sys.argv[2]))
short = str(fix["short"]).strip()
FIELDS = ("history", "value", "period_type", "last_data_date", "unit")


def patch(path):
    try:
        d = json.load(open(path))
    except FileNotFoundError:
        return 0
    n = 0
    for arr in ("kpis", "kpis_supplementary"):
        for k in d.get(arr, []):
            if isinstance(k, dict) and str(k.get("short", "")).strip() == short:
                for f in FIELDS:
                    if f in fix and fix[f] is not None:
                        k[f] = fix[f]
                k["_kpi_fix_applied"] = str(fix.get("source", "fix"))[:200]
                n += 1
    if n:
        json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    return n


nb = patch(f"src/data/v2-pipeline/{ticker}.json") + patch(f"src/data/v2-pipeline-enrich/{ticker}.json")
hn = len(fix.get("history", []))
if nb == 0:
    print(f"❌ {ticker.upper()} '{short}' : introuvable (base + enrich)")
    sys.exit(1)
print(f"✅ {ticker.upper()} '{short}' : {nb} occurrence(s), history={hn}pts, value={fix.get('value')}")
