#!/usr/bin/env python3
"""Phase 2 Step 6 — Cleanup: remove spurious last-value appends, dedup adjacent duplicates,
and revert KPIs where extraction looks unreliable."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
V2 = ROOT / 'src/data/v2-pipeline'

stats = {'fixed_scale': 0, 'fixed_dup': 0, 'reverted': 0}

def cleanup(h):
    # Remove duplicate at end (last == second-last)
    while len(h) >= 2 and h[-1] == h[-2]:
        h.pop()
    return h

def detect_scale_mismatch(h):
    """If last value is 800-1100x the previous, it's a scale mismatch (Bn appended to M)."""
    if len(h) < 2: return False
    try:
        a, b = float(h[-1]), float(h[-2])
        if a == 0 or b == 0: return False
        ratio = max(abs(a), abs(b)) / min(abs(a), abs(b))
        if 500 < ratio < 1500:
            return True
    except: return False
    return False

for f in V2.glob('*.json'):
    try: d = json.load(open(f))
    except: continue
    if not isinstance(d, dict): continue
    touched = False
    for k in d.get('kpis', []):
        if not isinstance(k, dict): continue
        if k.get('_history_source') != 'Opus 10-K narrative': continue
        h = list(k.get('history') or [])
        if not h: continue
        orig = list(h)
        # 1. Scale mismatch — drop last value
        if detect_scale_mismatch(h):
            h = h[:-1]
            stats['fixed_scale'] += 1
        # 2. Trim trailing duplicates
        h2 = cleanup(list(h))
        if len(h2) < len(h):
            stats['fixed_dup'] += 1
            h = h2
        # 3. If still many duplicates (>=3 same value at end), revert
        if len(h) >= 3:
            distinct = list(dict.fromkeys(h))
            if len(distinct) < len(h) - 1 and len(distinct) <= 2:
                # Very flat extraction → unreliable
                for key in ('_history_llm_extended_at', '_history_source', '_history_extended_v2'):
                    k.pop(key, None)
                k['history'] = []  # clean
                stats['reverted'] += 1
                touched = True
                continue
        if h != orig:
            k['history'] = h
            touched = True
    if touched:
        with open(f, 'w') as g:
            json.dump(d, g, indent=2, ensure_ascii=False)

print(stats)
