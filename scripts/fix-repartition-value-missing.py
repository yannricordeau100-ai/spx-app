#!/usr/bin/env python3
"""
Fix value_missing in 18 stés: compute missing values from total_revenue + share_pct,
or set share_pct from value / total_revenue.
"""
import json, os, sys

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "v2-pipeline")

TARGETS = [
    "AES", "ANA.MC", "BARC.L", "EDP.LS", "EXPN.L", "HEIA.AS", "JDEP.AS",
    "LOGN.SW", "MCHP", "MPWR", "MRK.DE", "MSCI", "NESN.SW", "PHIA.AS",
    "REL.L", "SAND.ST", "SOON.SW", "VNA.DE"
]

def get_total_revenue(data):
    """Try to extract total revenue from KPIs."""
    kpis = data.get("kpis", [])
    for kpi in kpis:
        short = kpi.get("short", "").lower()
        if short in ("rev", "revenue", "total_rev", "total_revenue", "revenues"):
            h = kpi.get("history", [])
            if h and h[-1] is not None:
                return h[-1]
    # Fallback: look for any revenue-like KPI
    for kpi in kpis:
        name = kpi.get("name_en", kpi.get("name_fr", "")).lower()
        if "revenue" in name or "chiffre d'affaires" in name or "turnover" in name:
            h = kpi.get("history", [])
            if h and h[-1] is not None:
                return h[-1]
    return None

def fix_slices(slices, total_revenue, label):
    """Fix missing values or share_pct in slices."""
    fixed = 0
    for sl in slices:
        v = sl.get("value")
        pct = sl.get("share_pct")
        if v is not None and (pct is None or pct == 0):
            if total_revenue and total_revenue != 0:
                sl["share_pct"] = round(v / total_revenue * 100, 1)
                fixed += 1
        elif pct is not None and pct != 0 and v is None:
            if total_revenue:
                sl["value"] = round(total_revenue * pct / 100, 1)
                fixed += 1
    return fixed

results = []
for tk in TARGETS:
    fname = os.path.join(BASE, tk.lower() + ".json")
    if not os.path.exists(fname):
        results.append(f"⚠️  {tk}: file not found")
        continue
    with open(fname) as f:
        data = json.load(f)
    total_rev = get_total_revenue(data)
    fixed_count = 0

    # Fix geography
    geo = data.get("geography") or data.get("f_repartition", {}).get("geography")
    if isinstance(geo, dict):
        slices = geo.get("slices", [])
        fixed_count += fix_slices(slices, total_rev, "geo")
    # Also check top-level
    if "geography" in data:
        fixed_count += fix_slices(data["geography"].get("slices", []), total_rev, "geo")

    # Fix segments
    seg = data.get("segments") or data.get("f_repartition", {}).get("segments")
    if isinstance(seg, dict):
        slices = seg.get("slices", [])
        fixed_count += fix_slices(slices, total_rev, "seg")
    if "segments" in data:
        fixed_count += fix_slices(data["segments"].get("slices", []), total_rev, "seg")

    if fixed_count > 0:
        with open(fname, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        results.append(f"✅ {tk}: {fixed_count} valeurs fixées (total_rev={total_rev})")
    else:
        results.append(f"⚠️  {tk}: 0 valeurs fixées (total_rev={total_rev})")

for r in results:
    print(r)
print(f"\nTotal: {sum(1 for r in results if r.startswith('✅'))} fixées / {len(TARGETS)}")
