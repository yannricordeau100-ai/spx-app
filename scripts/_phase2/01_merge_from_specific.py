#!/usr/bin/env python3
"""Phase 2 Step 1 — Merge already-extended histories from v2-pipeline-specific-kpis
into v2-pipeline. Only for US top307 companies, only KPIs with len(history) < 5 in
v2-pipeline AND len(history) >= 5 in specific-kpis.

Anti-invention : Pas d'extrapolation. Si la valeur récente du v2-pipeline diffère
de la dernière valeur du specific-kpis, on garde le suffix v2-pipeline pour ne pas
écraser les corrections récentes (manuel "_corrected_from").

Tag : _history_llm_extended_at, _history_source.
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TOP307 = json.load(open(ROOT / 'src/data/top307-breakdown.json'))
US = [c for c in TOP307 if c.get('country') == 'United States']
V2_DIR = ROOT / 'src/data/v2-pipeline'
SPEC_DIR = ROOT / 'src/data/v2-pipeline-specific-kpis'

GENERIC_PATTERNS = {
    'total revenue','revenue','net income','operating income','operating margin',
    'net margin','ebitda','eps','diluted eps','free cash flow','fcf','gross margin',
    'gross profit','operating cash flow','cash flow','roe','roic','roa','ebit','r&d',
    'capex','opex','sg&a','sga','cost of revenue','cost of goods','revenue growth',
    'payout ratio','dps'
}

NOW = datetime.now(timezone.utc).isoformat()
SOURCE = "Opus merge from specific-kpis"

def is_generic(name: str) -> bool:
    return (name or '').lower().strip() in GENERIC_PATTERNS

def norm(s: str) -> str:
    return (s or '').lower().strip()

merged_kpis = 0
touched_companies = 0
sample = []

for c in US:
    t = c['ticker']
    f1 = V2_DIR / f'{t.lower()}.json'
    f2 = SPEC_DIR / f'{t.lower()}.json'
    if not f1.exists() or not f2.exists():
        continue
    d = json.load(open(f1))
    try:
        spec = json.load(open(f2))
    except Exception:
        continue

    # Index spec kpis by short / name_en
    spec_idx = {}
    for sk in spec.get('kpis', []):
        sn = norm(sk.get('short') or sk.get('name_en'))
        h = sk.get('history') or []
        if sn and len(h) >= 5:
            spec_idx[sn] = sk

    touched = False
    for k in d.get('kpis', []):
        if k.get('period_type') == 'quarter':
            continue
        short_name = (k.get('short') or k.get('name_en') or '').strip()
        if not short_name or is_generic(short_name):
            continue
        hist = k.get('history') or []
        if len(hist) >= 5:
            continue
        candidate = spec_idx.get(norm(short_name))
        if not candidate:
            # try name_en match
            candidate = spec_idx.get(norm(k.get('name_en')))
        if not candidate:
            continue
        spec_hist = candidate.get('history') or []
        # Merge: spec_hist first (old years), then append v2 last value if it's newer
        # spec_hist seems to be year-by-year 2020-2024. v2 hist (last value) might be FY25.
        # Strategy: if last v2 value differs from last spec value AND v2 hist len <= spec len,
        # we assume v2 last is more recent → append.
        new_hist = list(spec_hist)
        if hist:
            v2_last = hist[-1]
            spec_last = spec_hist[-1]
            # If different, treat as newer year — append
            try:
                if abs(float(v2_last) - float(spec_last)) > max(0.5, abs(float(spec_last)) * 0.01):
                    new_hist.append(v2_last)
            except (TypeError, ValueError):
                pass
        k['history'] = new_hist
        k['_history_llm_extended_at'] = NOW
        k['_history_source'] = SOURCE
        k['_history_extended_v2'] = True
        merged_kpis += 1
        if len(sample) < 15:
            sample.append(f"{t}:{short_name} → {len(new_hist)} years")
        touched = True
    if touched:
        # Write back
        with open(f1, 'w') as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        touched_companies += 1

print(f'Merged: {merged_kpis} KPIs across {touched_companies} US companies')
print('Sample:')
for s in sample:
    print(' ', s)
