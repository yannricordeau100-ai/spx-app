#!/usr/bin/env python3
"""
apply-kpi-fix.py — applique un fix KPI (retour d'agent) à v2-pipeline/<ticker>.json.

Usage : python3 scripts/apply-kpi-fix.py <ticker> <fix.json>
fix.json = {"short": "...", "history": [...], "value": ..., "period_type": "...",
            "last_data_date": "...", "source": "..."}  (champs optionnels sauf short)

Met à jour le KPI dont short == fix.short (history/value/period_type/last_data_date),
pose un flag _kpi_fix_applied (provenance), préserve tout le reste. Anti-écrasement :
ne touche QUE le KPI ciblé.
"""
import json
import sys

if len(sys.argv) < 3:
    print("usage: apply-kpi-fix.py <ticker> <fix.json>")
    sys.exit(2)

ticker = sys.argv[1].lower()
fix = json.load(open(sys.argv[2]))
path = f"src/data/v2-pipeline/{ticker}.json"
d = json.load(open(path))
kpis = d.get("kpis", [])
short = fix["short"]

found = None
for k in kpis:
    if str(k.get("short", "")).strip() == short.strip():
        found = k
        break
if found is None:
    print(f"❌ KPI '{short}' introuvable dans {path}")
    print("   shorts dispo:", [k.get("short") for k in kpis][:25])
    sys.exit(1)

for field in ("history", "value", "period_type", "last_data_date", "unit"):
    if field in fix and fix[field] is not None:
        found[field] = fix[field]
found["_kpi_fix_applied"] = str(fix.get("source", "fix"))[:200]

json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
hn = len(fix.get("history", found.get("history", [])))
print(f"✅ {ticker.upper()} '{short}' : history={hn} pts, value={found.get('value')}, period={found.get('period_type')}")
