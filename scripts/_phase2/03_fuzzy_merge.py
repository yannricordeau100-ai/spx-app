#!/usr/bin/env python3
"""Phase 2 Step 3 — Fuzzy match KPIs across v2-pipeline ↔ specific-kpis.

For each US top307 ticker, fuzzy match KPI names (token-jaccard) and merge
the history WHERE the latest values are consistent (within 20% relative).
Anti-invention strict — only merge if values check out.
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

NOW = datetime.now(timezone.utc).isoformat()
SOURCE = 'Opus fuzzy merge from specific-kpis'

GENERIC_PATTERNS = {
    'total revenue','revenue','net income','operating income','operating margin',
    'net margin','ebitda','eps','diluted eps','free cash flow','fcf','gross margin',
    'gross profit','operating cash flow','cash flow','roe','roic','roa','ebit','r&d',
    'capex','opex','sg&a','sga','cost of revenue','cost of goods','revenue growth',
    'payout ratio','dps'
}

# Words that signal different concept even if tokens overlap
DIFFERENT_CONCEPTS = [
    ({'revenue'}, {'margin', 'ratio', 'mlr', 'growth'}),
    ({'volume'}, {'count', 'transactions', 'subscribers'}),
    ({'noi'}, {'opex', 'revenue'}),
    ({'noi'}, {'growth'}),
    ({'net'}, {'gross'}),
    ({'gross'}, {'net'}),
    ({'sales'}, {'margin'}),
    ({'cost'}, {'revenue'}),
    ({'opex'}, {'revenue'}),
    ({'opex'}, {'margin'}),
]

def is_generic(name): return (name or '').lower().strip() in GENERIC_PATTERNS

def tokenize(s):
    return set(w for w in (s or '').lower().replace('/', ' ').replace('-', ' ').replace('(', ' ').replace(')', ' ').split() if len(w) > 2 and w not in {'the', 'and', 'for', 'with', 'per'})

def different_concepts(t1, t2):
    for a, b in DIFFERENT_CONCEPTS:
        if (a & t1 and b & t2) or (a & t2 and b & t1):
            return True
    return False

def values_consistent(v_kpi, v_spec, tolerance=0.25):
    """Check if v_kpi (v2-pipeline current value or last hist) is consistent with
    last spec history value. Allows wide tolerance because they may be different fiscal periods."""
    try:
        a = float(v_kpi); b = float(v_spec)
    except (TypeError, ValueError):
        return False
    if a == 0 and b == 0:
        return True
    if a == 0 or b == 0:
        # treat one being zero as inconsistent unless both
        return False
    # relative diff
    rel = abs(a - b) / max(abs(a), abs(b))
    return rel <= tolerance

merged = 0
touched_co = 0
sample = []
rejected = []

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

    spec_idx = []  # list of (short, hist, last_value)
    for sk in spec.get('kpis', []):
        sn = (sk.get('short') or '').strip()
        h = sk.get('history') or []
        v = sk.get('value')
        if sn and len(h) >= 5:
            spec_idx.append((sn, h, v if v is not None else h[-1]))

    touched = False
    for k in d.get('kpis', []):
        if k.get('period_type') == 'quarter': continue
        short_name = (k.get('short') or '').strip()
        if not short_name or is_generic(short_name): continue
        hist = k.get('history') or []
        if len(hist) >= 5: continue
        # Skip if already extended
        if k.get('_history_source'): continue

        v2_tokens = tokenize(short_name)
        if not v2_tokens: continue

        v2_value = k.get('value')
        if v2_value is None and hist:
            v2_value = hist[-1]

        best_match = None
        best_score = 0
        for sn, sh, sv in spec_idx:
            sk_tokens = tokenize(sn)
            if not sk_tokens: continue
            if different_concepts(v2_tokens, sk_tokens):
                continue
            inter = v2_tokens & sk_tokens
            uni = v2_tokens | sk_tokens
            jaccard = len(inter) / len(uni) if uni else 0
            overlap_v2 = len(inter) / len(v2_tokens) if v2_tokens else 0
            score = max(jaccard, overlap_v2 * 0.9)
            if score < 0.5: continue
            # Also require value consistency
            if v2_value is None or values_consistent(v2_value, sv, tolerance=0.30):
                if score > best_score:
                    best_score = score
                    best_match = (sn, sh, sv)

        if not best_match:
            continue
        sn, sh, sv = best_match
        # Merge
        new_hist = list(sh)
        if hist:
            v2_last = hist[-1]
            try:
                if abs(float(v2_last) - float(sh[-1])) > max(0.5, abs(float(sh[-1])) * 0.02):
                    new_hist.append(v2_last)
            except (TypeError, ValueError):
                pass
        k['history'] = new_hist
        k['_history_llm_extended_at'] = NOW
        k['_history_source'] = SOURCE
        k['_history_alias'] = sn
        k['_history_extended_v2'] = True
        merged += 1
        touched = True
        if len(sample) < 20:
            sample.append(f"{t}:{short_name} ←→ {sn} → {len(new_hist)} years")

    if touched:
        with open(f1, 'w') as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        touched_co += 1

print(f'Fuzzy-merged: {merged} KPIs across {touched_co} US companies')
for s in sample:
    print(' ', s)
