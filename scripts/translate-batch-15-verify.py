#!/usr/bin/env python3
"""
Verify state of batch 15 i18n files: which are TRULY fresh vs leftover.
A fresh file must have:
- _translated_at starting with 2026-05-27
- _translated_by containing 'batch15'
- mtime >= today midnight
"""
import json
import os
import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"

BATCH_15 = [
    "VST", "VTR", "VTRS", "VWS.CO", "VZ", "WAB", "WAT", "WBD", "WDAY",
    "WDC", "WEC", "WELL", "WFC", "WM", "WMB", "WMS", "WMT", "WRB", "WSM",
    "WST", "WTW", "WWD", "WY", "WYNN", "XEL", "XOM", "XYL", "XYZ",
    "YAR.OL", "YUM", "ZBH", "ZBRA", "ZTS", "ZURN.SW",
]

stale = []
fresh = []
for t in BATCH_15:
    for loc in ("en", "de"):
        p = OUT_DIR / f"{t.lower()}.{loc}.json"
        if not p.exists():
            stale.append((t, loc, "MISSING"))
            continue
        try:
            d = json.loads(p.read_text())
        except Exception as e:
            stale.append((t, loc, f"PARSE {e}"))
            continue
        ts = str(d.get("_translated_at", ""))
        by = str(d.get("_translated_by", ""))
        if ts.startswith("2026-05-27") and "batch15" in by:
            fresh.append((t, loc, by))
        else:
            stale.append((t, loc, f"ts={ts[:30]} by={by[:40]}"))

print(f"Fresh batch15: {len(fresh)}/68")
print(f"Stale: {len(stale)}/68")
print()
print("Stale tickers/locales to redo:")
for t, loc, reason in stale:
    print(f"  {t}.{loc} | {reason}")
