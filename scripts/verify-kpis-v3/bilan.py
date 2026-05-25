#!/usr/bin/env python3
"""Bilan post-extraction CONV-VERIF-KPIS-V3."""
import json
from pathlib import Path

ENRICH = Path("/Users/yann/spx-app/src/data/v2-pipeline-enrich")

stats = {
    "stes_with_v3_file": 0,
    "stes_with_at_least_1_kpi": 0,
    "total_kpis_extracted": 0,
    "stes_rejected_only": 0,
    "stes_quota_skipped": 0,
    "total_rejected": 0,
    "rejection_reasons": {},
}

files = list(ENRICH.glob("*.kpis-v3.json"))
for f in files:
    try:
        d = json.loads(f.read_text())
    except Exception:
        continue
    stats["stes_with_v3_file"] += 1
    kpis = d.get("kpis_v3", []) or []
    if kpis:
        stats["stes_with_at_least_1_kpi"] += 1
        stats["total_kpis_extracted"] += len(kpis)
    rej = d.get("_rejected", []) or []
    if rej and not kpis:
        stats["stes_rejected_only"] += 1
    stats["total_rejected"] += len(rej)
    for r in rej:
        reason = r.get("reason", "_unknown")
        stats["rejection_reasons"][reason] = stats["rejection_reasons"].get(reason, 0) + 1
    if d.get("_skipped_reasons"):
        for s in d["_skipped_reasons"]:
            if s.get("reason") == "_quota_exhausted":
                stats["stes_quota_skipped"] += 1

print(json.dumps(stats, indent=2, ensure_ascii=False))
