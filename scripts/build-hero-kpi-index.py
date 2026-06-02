"""
Build src/data/v2-pipeline/_hero-kpi-index.json — compact mapping
ticker (uppercase) → { short, value, unit, yoy } extracted from hero KPI.

Used by <CompanySearch /> to display hero KPI on the right of each result.
Source: src/data/v2-pipeline/_merged.json (44 MB) — kept server-only.
Output: < 200 KB, safe to ship to client bundle.

Only include entries where hero_kpi can be matched to a KPI with non-null value.
"""
import json
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
MERGED = ROOT / "src/data/v2-pipeline/_merged.json"
OUT = ROOT / "src/data/v2-pipeline/_hero-kpi-index.json"

with MERGED.open() as f:
    data = json.load(f)

index = {}
n_total = 0
n_with_hero = 0
for ticker, co in data.items():
    if not isinstance(co, dict):
        continue
    n_total += 1
    hero_short = co.get("hero_kpi")
    if not hero_short:
        continue
    kpis = co.get("kpis") or []
    if not isinstance(kpis, list):
        continue
    hero_kpi = None
    for k in kpis:
        if isinstance(k, dict) and k.get("short") == hero_short:
            hero_kpi = k
            break
    if not hero_kpi:
        continue
    value = hero_kpi.get("value")
    if value is None or value == "":
        continue
    entry = {
        "s": hero_short,           # short (label)
        "v": value,                # value (string or number)
        "u": hero_kpi.get("unit") or "",
        "y": hero_kpi.get("yoy") or "",
        "t": hero_kpi.get("type") or "",
    }
    index[ticker.upper()] = entry
    n_with_hero += 1

with OUT.open("w") as f:
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

size_kb = OUT.stat().st_size / 1024
print(f"Total stés in merged: {n_total}")
print(f"With hero KPI matched: {n_with_hero}")
print(f"Output: {OUT}")
print(f"Size: {size_kb:.1f} KB")

# Sample
import random
random.seed(42)
samples = random.sample(list(index.items()), min(5, len(index)))
print("\nSamples:")
for k, v in samples:
    print(f"  {k}: {v}")
