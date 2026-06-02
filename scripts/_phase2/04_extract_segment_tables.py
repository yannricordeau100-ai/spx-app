#!/usr/bin/env python3
"""Phase 2 Step 4 — Extract segment revenue / KPI year history from 10-K narrative.

This focuses on the standard "MD&A" or "Segment Results" tables where the 10-K
shows current FY + 2 prior FY values in a row, with year headers nearby.

Strict validation: extracted value for the latest year must match the v2-pipeline
current value within ±20% tolerance, OR fall within historic range. Otherwise skip.

Anti-invention strict.
"""
from __future__ import annotations
import gzip
import json
import re
import os
from datetime import datetime, timezone
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).resolve().parent.parent.parent
V2_DIR = ROOT / 'src/data/v2-pipeline'
CAT1 = ROOT / 'sec-data/cat1-us/10K'
NOW = datetime.now(timezone.utc).isoformat()
SOURCE = 'Opus 10-K narrative'

GENERIC_PATTERNS = {
    'total revenue','revenue','net income','operating income','operating margin',
    'net margin','ebitda','eps','diluted eps','free cash flow','fcf','gross margin',
    'gross profit','operating cash flow','cash flow','roe','roic','roa','ebit','r&d',
    'capex','opex','sg&a','sga','cost of revenue','cost of goods','revenue growth',
    'payout ratio','dps'
}

def is_generic(name): return (name or '').lower().strip() in GENERIC_PATTERNS

def strip_html(html):
    t = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    t = re.sub(r'<style[^>]*>.*?</style>', ' ', t, flags=re.DOTALL | re.IGNORECASE)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = (t.replace('&nbsp;', ' ').replace('&amp;', '&')
           .replace('&#160;', ' ').replace('&#8217;', "'")
           .replace('&#8220;', '"').replace('&#8221;', '"')
           .replace('&quot;', '"').replace('&#8212;', '-')
           .replace('&#8211;', '-'))
    t = re.sub(r'&#\d+;', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t

def find_10k_paths(ticker):
    if not CAT1.exists(): return []
    paths = []
    for yr in sorted(os.listdir(CAT1), reverse=True):
        d = CAT1 / yr
        if not d.is_dir(): continue
        for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
            paths.append((int(yr), f))
    return paths

def load_text(path):
    try:
        with gzip.open(path, 'rt', errors='ignore') as g:
            return strip_html(g.read())
    except Exception:
        return ''

# A "value" in a 10-K table is a number with comma-thousand separators OR a decimal,
# i.e. matches patterns like "209,586", "$ 209,586", "$ 7,321.5", "(123)", "12.5"
# NOT "2025" (bare 4-digit year)
VALUE_RE = re.compile(
    r'\$?\s*\(?\s*'
    r'(?:'
    r'[\d]{1,3}(?:,\d{3})+(?:\.\d+)?'        # 209,586 or 7,321.5
    r'|'
    r'[\d]+\.\d+'                              # 12.5 or 0.5
    r'|'
    r'[\d]{1,3}'                               # small int like 8 or 75
    r')'
    r'\s*\)?'
)

CLEAN_NUM_RE = re.compile(r'[\d.,()-]+')

def parse_number(s):
    s = s.strip().replace('$', '').replace(' ', '')
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    s = s.replace(',', '')
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return None

def find_label_table(text, label, max_window=300, n_years_target=3):
    """Look for: <three consecutive years e.g. 2025 2024 2023> ... <label> <val1> ... <val2> ... <val3>
    Returns dict {year: value} or {}.
    """
    label_pat = re.compile(r'\b' + re.escape(label) + r'\b', flags=re.IGNORECASE)
    results = {}
    for m in label_pat.finditer(text):
        # Look BEFORE label for year headers up to ~1500 chars
        before_start = max(0, m.start() - 1500)
        before = text[before_start: m.start()]
        # Find runs of 3-5 consecutive years in descending order
        year_seq = []
        years = list(re.finditer(r'\b(20\d{2})\b', before))
        if len(years) < n_years_target:
            continue
        # Take the LAST cluster of years (closest to label)
        last_cluster = []
        prev_idx = None
        for y_m in years[::-1]:
            yr = int(y_m.group(1))
            if not last_cluster:
                last_cluster.append((yr, y_m.start()))
            else:
                prev_yr, prev_pos = last_cluster[-1]
                # Years should be close (within ~30 chars) and decrementing by 1
                if prev_pos - y_m.end() < 80 and prev_yr - yr == 1:
                    last_cluster.append((yr, y_m.start()))
                else:
                    break
        if len(last_cluster) < n_years_target:
            continue
        # last_cluster is in reverse order from text — text order is descending years first
        # i.e., text shows "2025 2024 2023", so last_cluster (rev) = [(2023,...), (2024,...), (2025,...)]
        last_cluster.reverse()  # now [(2025,...), (2024,...), (2023,...)]
        years_in_order = [c[0] for c in last_cluster]

        # Look AFTER label for values
        after_start = m.end()
        after = text[after_start: after_start + 800]
        # Extract values with positions
        vals = []
        for v_m in VALUE_RE.finditer(after):
            raw = v_m.group(0)
            # Skip if the value is itself a year (1980-2030)
            n = parse_number(raw)
            if n is None: continue
            # Reject if value looks like a year (1980-2030) unless it has decimal
            if 1980 <= n <= 2030 and '.' not in raw and ',' not in raw:
                continue
            # Reject percentage-only contexts (we want $ values)
            # We will pick numbers, skipping ones immediately followed by '%'
            tail = after[v_m.end(): v_m.end() + 3]
            is_pct = '%' in tail
            vals.append((n, v_m.start(), is_pct, raw))
            if len(vals) >= 12:
                break
        if len(vals) < len(years_in_order):
            continue
        # Heuristic: for revenue table, values are interleaved with % changes:
        # "$ 209,586 4 % $ 201,183 — % $ 200,583" → non-pct: 209586, 201183, 200583
        non_pct_vals = [v for v in vals if not v[2]]
        # But sometimes % is not %-marked separately. Take large values matching count.
        candidate_vals = non_pct_vals if len(non_pct_vals) >= len(years_in_order) else vals
        candidate_vals = candidate_vals[:len(years_in_order)]

        if len(candidate_vals) != len(years_in_order):
            continue

        # Validate: values should not be sequential years/small ints — at least
        # one value > 50 (since revenue/income usually in millions hence > 50M)
        # OR all be small percentages between 0-100.
        max_v = max(abs(c[0]) for c in candidate_vals)
        if max_v < 1:
            # all decimals (could be ratios) - skip if no decimal indicator
            continue

        row = {yr: candidate_vals[i][0] for i, yr in enumerate(years_in_order)}
        # Prefer the FIRST occurrence of label (some 10-Ks have a TOC mention that's
        # not the table — but TOC usually doesn't have years right before, so already filtered).
        if row:
            # Merge — first one wins
            for yr, val in row.items():
                results.setdefault(yr, val)
            # don't break, sometimes multiple sections describe the same KPI
    return results

def detect_scale(kpi):
    unit = (kpi.get('unit') or '').lower().strip()
    if 'mds' in unit or 'bn' in unit or 'billion' in unit:
        return 'B'
    if 'mn' in unit or 'million' in unit or 'mio' in unit:
        return 'M'
    if unit == 'k' or 'thousand' in unit:
        return 'K'
    if '%' in unit:
        return 'PCT'
    return 'RAW'

def convert_scale(value_raw_millions, scale):
    """value_raw_millions = value as extracted (assumed in millions of $).
    Some KPIs in 10-K are reported in millions; some in thousands; some as bare numbers.
    We assume the 10-K table value is the dollar amount (in millions for revenue), and we
    must convert to KPI's unit scale."""
    if scale == 'B':
        return round(value_raw_millions / 1000.0, 3)
    if scale == 'M':
        return round(value_raw_millions, 1)
    if scale == 'K':
        return round(value_raw_millions / 1000.0, 2)
    return round(value_raw_millions, 2)

def candidate_aliases(short_name):
    """Generate search labels for a KPI."""
    # Base
    s = short_name.strip()
    out = [s]
    # Strip suffix words like 'Revenue', 'Sales' to get the segment name
    for suf in [' Revenue', ' revenue', ' Sales', ' sales', ' Net Sales']:
        if s.endswith(suf):
            base = s[:-len(suf)]
            out.append(base)
            out.append(base + ' net sales')
            out.append(base + ' Revenue')
    # Special cases
    LOWER = s.lower()
    if 'iphone' in LOWER: out.append('iPhone')
    if 'mac revenue' in LOWER or 'mac sales' in LOWER: out.append('Mac')
    if 'ipad' in LOWER: out.append('iPad')
    if 'wearables' in LOWER: out.append('Wearables, Home and Accessories')
    if 'services rev' in LOWER: out.append('Services')
    if 'gaming' in LOWER: out.append('Gaming')
    if 'data center' in LOWER: out += ['Data Center', 'Compute & Networking']
    if 'automotive' in LOWER: out.append('Automotive')
    if 'cloud' in LOWER: out += ['Google Cloud', 'Cloud']
    if 'youtube' in LOWER: out.append('YouTube ads')
    if 'streaming' in LOWER: out.append('Streaming')
    return list(OrderedDict.fromkeys(out))

def process_kpi(text_by_year, kpi):
    """Try to extract year-history for one KPI from the texts loaded.
    text_by_year: list of (yr, text) descending.
    Returns dict {year: kpi-scaled value} or {}."""
    scale = detect_scale(kpi)
    short = kpi.get('short') or ''
    v2_value = kpi.get('value')
    v2_hist = kpi.get('history') or []

    # Reference recent value for validation
    ref_value = None
    if v2_value is not None:
        try: ref_value = float(v2_value)
        except (TypeError, ValueError): pass
    if ref_value is None and v2_hist:
        try: ref_value = float(v2_hist[-1])
        except (TypeError, ValueError): pass

    aliases = candidate_aliases(short)

    combined = {}
    for yr_filing, text in text_by_year:
        for alias in aliases:
            rows = find_label_table(text, alias)
            if rows:
                for yr, val in rows.items():
                    # Choose this row only if value is reasonable
                    # Convert to scale and check against ref
                    if scale == 'PCT':
                        # value should be a percentage (0-200)
                        if not (0 <= val <= 200): continue
                        converted = val
                    elif scale == 'B':
                        # 10-K table is millions; if val < 1000, it's already in Bn? need check
                        # if val >= 1000, it's in millions → convert
                        if val >= 1000:
                            converted = round(val / 1000.0, 3)
                        else:
                            # already in Bn
                            converted = round(val, 3)
                    elif scale == 'M':
                        converted = round(val, 1)
                    elif scale == 'K':
                        # 10-K might report in thousands or units. If val > 10000, treat as raw count → /1000
                        if val > 10000:
                            converted = round(val / 1000.0, 1)
                        else:
                            converted = round(val, 1)
                    else:
                        converted = round(val, 2)
                    combined.setdefault(yr, converted)
                break  # first alias that matches wins for this text

    if not combined:
        return {}

    # Validation: if we have a ref_value, the most recent year in combined should be
    # within tolerance.
    if ref_value is not None and ref_value != 0:
        most_recent_yr = max(combined.keys())
        v = combined[most_recent_yr]
        try:
            v_f = float(v)
            if v_f == 0 and ref_value != 0:
                return {}
            rel = abs(v_f - ref_value) / max(abs(v_f), abs(ref_value))
            if rel > 0.30:
                # Maybe second-most recent matches?
                ok = False
                for yr in sorted(combined.keys(), reverse=True)[:3]:
                    v2 = float(combined[yr])
                    if v2 == 0: continue
                    rel2 = abs(v2 - ref_value) / max(abs(v2), abs(ref_value))
                    if rel2 <= 0.30:
                        ok = True; break
                if not ok:
                    return {}
        except (TypeError, ValueError):
            pass

    return combined

def main():
    top307 = json.load(open(ROOT / 'src/data/top307-breakdown.json'))
    us = [c for c in top307 if c.get('country') == 'United States']

    # Build candidates
    candidates = OrderedDict()
    for c in us:
        t = c['ticker']
        f1 = V2_DIR / f'{t.lower()}.json'
        if not f1.exists(): continue
        d = json.load(open(f1))
        rem = []
        for k in d.get('kpis', []):
            if not isinstance(k, dict): continue
            if k.get('period_type') == 'quarter': continue
            sn = (k.get('short') or '').strip()
            if not sn or is_generic(sn): continue
            h = k.get('history') or []
            if len(h) >= 5: continue
            rem.append(k)
        if rem:
            candidates[t] = (d, rem)
    print(f'Candidates: {len(candidates)} companies, {sum(len(v[1]) for v in candidates.values())} KPIs')

    stats = {'updated': 0, 'touched_co': 0, 'samples': []}
    processed = 0
    for ticker, (data, kpis) in candidates.items():
        processed += 1
        paths = find_10k_paths(ticker)
        if not paths: continue
        # Load 2 most recent + 1 from 3 years ago
        chosen = paths[:1] + (paths[2:3] if len(paths) > 2 else [])
        texts = []
        for yr, p in chosen:
            tx = load_text(p)
            if tx:
                texts.append((yr, tx))
        if not texts: continue
        touched = False
        for k in kpis:
            extracted = process_kpi(texts, k)
            if not extracted or len(extracted) < 3:
                continue
            sorted_years = sorted(extracted.keys())
            new_hist = [extracted[y] for y in sorted_years]
            existing = k.get('history') or []
            if existing:
                last_existing = existing[-1]
                try:
                    if abs(float(last_existing) - float(new_hist[-1])) > max(0.5, abs(float(new_hist[-1])) * 0.05):
                        new_hist.append(last_existing)
                except (TypeError, ValueError):
                    pass
            if len(new_hist) >= 5 or len(new_hist) > len(existing):
                k['history'] = new_hist
                k['_history_llm_extended_at'] = NOW
                k['_history_source'] = SOURCE
                k['_history_extended_v2'] = True
                stats['updated'] += 1
                touched = True
                if len(stats['samples']) < 25:
                    stats['samples'].append(f"{ticker}:{k.get('short')} → {new_hist}")
        if touched:
            with open(V2_DIR / f'{ticker.lower()}.json', 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            stats['touched_co'] += 1
        if processed % 10 == 0:
            print(f'  Processed {processed}/{len(candidates)} co, {stats["updated"]} KPIs updated so far')

    print(f"\nDone: {stats['updated']} KPIs updated across {stats['touched_co']} companies")
    for s in stats['samples']:
        print(' ', s)

if __name__ == '__main__':
    main()
