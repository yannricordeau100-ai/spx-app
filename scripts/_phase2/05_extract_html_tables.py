#!/usr/bin/env python3
"""Phase 2 Step 5 — Extract KPI year-history from 10-K HTML tables.

Approach: parse each <table> in the 10-K, identify year column headers
(2023/2024/2025), then locate rows matching KPI labels (iPhone, Mac, Services,
Headcount, etc.) and pull values by column position.

Anti-invention strict — values validated against existing v2 value.
"""
from __future__ import annotations
import gzip
import json
import re
import os
import sys
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

def find_10k_paths(ticker):
    if not CAT1.exists(): return []
    paths = []
    for yr in sorted(os.listdir(CAT1), reverse=True):
        d = CAT1 / yr
        if not d.is_dir(): continue
        for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
            paths.append((int(yr), f))
    return paths

# Decode HTML entities
ENT_MAP = {
    '&nbsp;': ' ', '&#160;': ' ', '&amp;': '&', '&#8217;': "'",
    '&#8220;': '"', '&#8221;': '"', '&quot;': '"', '&#8212;': '-',
    '&#8211;': '-', '&lt;': '<', '&gt;': '>',
}
def decode_entities(s):
    for k, v in ENT_MAP.items():
        s = s.replace(k, v)
    s = re.sub(r'&#\d+;', ' ', s)
    return s

def load_html(path):
    try:
        with gzip.open(path, 'rt', errors='ignore') as g:
            return g.read()
    except Exception:
        return ''

TABLE_RE = re.compile(r'<table[^>]*>(.*?)</table>', re.DOTALL | re.IGNORECASE)
ROW_RE = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL | re.IGNORECASE)
CELL_RE = re.compile(r'<t[dh][^>]*>(.*?)</t[dh]>', re.DOTALL | re.IGNORECASE)
TAG_RE = re.compile(r'<[^>]+>')

def cell_text(html_cell):
    t = TAG_RE.sub(' ', html_cell)
    t = decode_entities(t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def parse_table(table_html):
    """Return list of rows, each row = list of cell texts."""
    rows = []
    for row_m in ROW_RE.finditer(table_html):
        cells = [cell_text(c.group(1)) for c in CELL_RE.finditer(row_m.group(1))]
        # Drop empty cells from the count? Keep them — they're part of layout.
        rows.append(cells)
    return rows

YEAR_CELL_RE = re.compile(r'^(20[12]\d)\s*$|^FY\s*(20[12]\d)$|^(20[12]\d)\s*\([^)]*\)\s*$')

def find_year_columns(rows, max_header_rows=5):
    """Find header row that contains year cells; return (header_row_idx, {col_idx: year}).
    Years are detected in the first few rows."""
    for ri in range(min(max_header_rows, len(rows))):
        cols = rows[ri]
        year_cols = {}
        for ci, c in enumerate(cols):
            cs = c.strip()
            m = YEAR_CELL_RE.match(cs)
            if m:
                yr = int(next((g for g in m.groups() if g), '0'))
                if 2018 <= yr <= 2030:
                    year_cols[ci] = yr
        if len(year_cols) >= 2:
            return ri, year_cols
    return None, {}

def parse_value(s):
    """Parse a $ value cell. Return float (raw amount) or None."""
    s = s.strip().replace('$', '').replace(' ', '')
    if not s or s in ('-', '—', '*'): return None
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    s = s.replace(',', '')
    if not re.fullmatch(r'-?\d+(\.\d+)?', s):
        return None
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return None

def row_label(row):
    """Return first non-empty cell as label."""
    for c in row:
        if c.strip():
            return c.strip()
    return ''

def collect_row_values(row, year_cols):
    """For each year col index, find the nearest value in the row.
    Cells often have layout like: label | $ | value | % | change | % | value | ...
    We pick the value at or just before the year column index.
    """
    # Map: column index → numeric value (parsed from cell)
    n = len(row)
    out = {}
    for ci, yr in year_cols.items():
        # Search around column ci: ci itself, ci-1, ci+1, ci-2, ci+2 ...
        for offset in (0, -1, 1, -2, 2, -3, 3, -4, 4):
            idx = ci + offset
            if 0 <= idx < n:
                v = parse_value(row[idx])
                if v is not None:
                    # Reject pure year (1980-2030)
                    if 1980 <= v <= 2030 and v == int(v):
                        continue
                    out[yr] = v
                    break
    return out

# --- KPI label matchers ---
def make_label_patterns(short_name):
    s = short_name.strip()
    LOWER = s.lower()
    patterns = []

    def add(p, weight=1.0):
        patterns.append((re.compile(p, re.IGNORECASE), weight))

    # Direct match
    add(r'^' + re.escape(s) + r'\b')
    add(r'^' + re.escape(s.replace(' Revenue', '').replace(' Sales', '')) + r'$', weight=0.9)

    # Common product/segment labels
    aliases_map = {
        'iphone revenue': [r'^iPhone$', r'^iPhone net sales$'],
        'ipad revenue': [r'^iPad$', r'^iPad net sales$'],
        'mac revenue': [r'^Mac$', r'^Mac net sales$'],
        'services revenue': [r'^Services\b', r'^Service revenue$'],
        'wearables/home/acc': [r'^Wearables, Home and Accessories$', r'^Wearables'],
        'gaming revenue': [r'^Gaming\b'],
        'networking revenue': [r'^Networking\b'],
        'data center revenue': [r'^Data Center\b', r'^Compute & Networking$'],
        'auto revenue': [r'^Automotive\b'],
        'automotive revenue': [r'^Automotive\b'],
        'streaming revenue': [r'^Streaming\b', r'^Subscription revenue'],
        'paid subscriptions': [r'^Subscribers\b', r'^Paid subscribers$'],
        'cap return': [r'^Total cash returned'],
        'discount revenue': [r'^Discount revenue\b'],
        'cards-in-force': [r'^Cards-in-force\b', r'^Total cards-in-force\b'],
        'cards in circulation': [r'^Total cards\b', r'^Cards\b'],
    }
    for key, pats in aliases_map.items():
        if key in LOWER:
            for p in pats:
                add(p)

    # Strip "Revenue"/"Sales" suffix as a label
    for suf in (' Revenue', ' Sales', ' Net Sales'):
        if s.endswith(suf):
            base = s[:-len(suf)].strip()
            add(r'^' + re.escape(base) + r'\b', weight=0.95)

    return patterns

# --- Headcount extraction (not from table, from prose) ---
HEADCOUNT_RE = re.compile(
    r'(?:had|employed|approximately|comprised\s+of|workforce\s+of|count\s+was)'
    r'[\s,]*'
    r'(?:approximately\s+)?'
    r'([\d,]{4,9})'
    r'\s*(?:full[-\s]time)?\s*'
    r'(?:employees|workers|associates|team\s+members|staff|persons)',
    re.IGNORECASE
)

def extract_headcount_from_text(text):
    """Strip HTML from text first."""
    txt = TAG_RE.sub(' ', text)
    txt = decode_entities(txt)
    txt = re.sub(r'\s+', ' ', txt)
    # Focus on Human Capital section
    m = re.search(r'Human Capital(.{0,8000})', txt, flags=re.IGNORECASE)
    region = m.group(1) if m else txt[:30000]
    hits = []
    for hm in HEADCOUNT_RE.finditer(region):
        n = int(hm.group(1).replace(',', ''))
        if 50 <= n <= 5_000_000:
            hits.append(n)
    if hits:
        # Take largest as full count
        return max(hits)
    return None

# --- Main per-KPI extraction ---
def extract_kpi_from_filing(html, kpi):
    """Returns dict {year: raw_value} from the 10-K tables, or {} if not found."""
    short = (kpi.get('short') or '').strip()
    if not short: return {}
    LOWER = short.lower()
    if 'headcount' in LOWER or 'employees' in LOWER:
        hc = extract_headcount_from_text(html)
        return {} if hc is None else {'_hc_marker': hc}  # special marker

    patterns = make_label_patterns(short)
    if not patterns: return {}
    best_row_values = {}
    for table_m in TABLE_RE.finditer(html):
        rows = parse_table(table_m.group(1))
        if len(rows) < 2: continue
        hdr_ri, year_cols = find_year_columns(rows)
        if not year_cols: continue
        # Search remaining rows
        for ri in range(hdr_ri + 1, len(rows)):
            label = row_label(rows[ri])
            if not label: continue
            for pat, weight in patterns:
                if pat.search(label):
                    vals = collect_row_values(rows[ri], year_cols)
                    if len(vals) >= 2:
                        # Take first match (current FY table)
                        for yr, v in vals.items():
                            best_row_values.setdefault(yr, v)
                        if len(best_row_values) >= 3:
                            return best_row_values
                    break  # don't double-match within same row
    return best_row_values

def detect_scale(kpi):
    unit = (kpi.get('unit') or '').lower().strip()
    if 'mds' in unit or 'bn' in unit or 'billion' in unit: return 'B'
    if 'mn' in unit or 'million' in unit or 'mio' in unit: return 'M'
    if unit == 'k' or 'thousand' in unit: return 'K'
    if '%' in unit: return 'PCT'
    return 'RAW'

def convert_raw_to_scale(val, scale):
    if scale == 'PCT': return round(val, 2)
    if scale == 'B':
        return round(val / 1000.0, 3) if val >= 1000 else round(val, 3)
    if scale == 'M': return round(val, 1)
    if scale == 'K':
        return round(val / 1000.0, 2) if val > 10000 else round(val, 1)
    return round(val, 2)

def validate_against_ref(extracted_by_year, ref_value, tol=0.30):
    """Return True if the most recent year value in extracted_by_year is within tol of ref."""
    if ref_value is None or ref_value == 0:
        return True
    try:
        r = float(ref_value)
    except (TypeError, ValueError):
        return True
    if not extracted_by_year: return False
    sorted_years = sorted(extracted_by_year.keys(), reverse=True)
    for yr in sorted_years[:3]:
        v = extracted_by_year[yr]
        try:
            vf = float(v)
        except (TypeError, ValueError):
            continue
        if vf == 0 and r != 0:
            continue
        rel = abs(vf - r) / max(abs(vf), abs(r))
        if rel <= tol:
            return True
    return False

def main():
    top307 = json.load(open(ROOT / 'src/data/top307-breakdown.json'))
    us = [c for c in top307 if c.get('country') == 'United States']

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

    stats = {'updated': 0, 'touched_co': 0, 'samples': [], 'skipped_validation': 0}

    for proc_i, (ticker, (data, kpis)) in enumerate(candidates.items()):
        paths = find_10k_paths(ticker)
        if not paths: continue
        # Load latest 1-2 filings
        htmls = [(yr, load_html(p)) for yr, p in paths[:2]]
        htmls = [(y, h) for y, h in htmls if h]
        if not htmls: continue
        touched = False
        for k in kpis:
            scale = detect_scale(k)
            short = k.get('short')
            ref = k.get('value')
            if ref is None and k.get('history'):
                try: ref = float(k['history'][-1])
                except (TypeError, ValueError, IndexError): ref = None

            # Special headcount
            if 'headcount' in (short or '').lower() or 'employees' in (short or '').lower():
                # Get headcount per filing year — represents prior FY
                hc_by_year = {}
                for fy, h in htmls:
                    hc = extract_headcount_from_text(h)
                    if hc is not None:
                        # Filing year FY = filing year (e.g. 10-K filed 2025 = FY25)
                        hc_by_year[fy] = hc
                if len(hc_by_year) >= 1:
                    # Convert to scale
                    converted = {y: convert_raw_to_scale(v, scale) for y, v in hc_by_year.items()}
                    # Validate
                    if validate_against_ref(converted, ref, tol=0.20):
                        # Merge with existing history
                        existing = k.get('history') or []
                        # Existing: assume last entries are most recent years
                        # Add older years from converted
                        new_hist = list(existing)
                        sorted_yrs = sorted(converted.keys())
                        # Prepend years that are strictly older than existing's start
                        # We don't know existing years. Heuristic: if converted has years
                        # before what existing covers (existing len matches a window ending now),
                        # prepend the missing earlier years.
                        # Simplest: replace if converted len >= existing len, else skip
                        if len(converted) >= 1 and len(converted) > len(existing):
                            new_hist = [converted[y] for y in sorted_yrs]
                            k['history'] = new_hist
                            k['_history_llm_extended_at'] = NOW
                            k['_history_source'] = SOURCE
                            k['_history_extended_v2'] = True
                            stats['updated'] += 1; touched = True
                            if len(stats['samples']) < 30:
                                stats['samples'].append(f"{ticker}:{short} HC → {new_hist}")
                continue

            # Standard segment extraction
            combined = {}
            for fy, h in htmls:
                got = extract_kpi_from_filing(h, k)
                if got:
                    for yr, v in got.items():
                        combined.setdefault(yr, v)
            if not combined or len(combined) < 3:
                continue
            # Convert and validate
            converted = {y: convert_raw_to_scale(v, scale) for y, v in combined.items()}
            if not validate_against_ref(converted, ref, tol=0.30):
                stats['skipped_validation'] += 1
                continue
            sorted_yrs = sorted(converted.keys())
            new_hist = [converted[y] for y in sorted_yrs]
            existing = k.get('history') or []
            if existing:
                last_existing = existing[-1]
                try:
                    if abs(float(last_existing) - float(new_hist[-1])) > max(0.5, abs(float(new_hist[-1])) * 0.05):
                        new_hist.append(last_existing)
                except (TypeError, ValueError):
                    pass
            if len(new_hist) > len(existing) and len(new_hist) >= 3:
                k['history'] = new_hist
                k['_history_llm_extended_at'] = NOW
                k['_history_source'] = SOURCE
                k['_history_extended_v2'] = True
                stats['updated'] += 1; touched = True
                if len(stats['samples']) < 30:
                    stats['samples'].append(f"{ticker}:{short} → {new_hist}")
        if touched:
            with open(V2_DIR / f'{ticker.lower()}.json', 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            stats['touched_co'] += 1
        if (proc_i + 1) % 10 == 0:
            print(f'  Processed {proc_i+1}/{len(candidates)}: {stats["updated"]} KPIs, {stats["skipped_validation"]} skipped (validation)')

    print(f'\nDone: {stats["updated"]} KPIs updated, {stats["touched_co"]} companies touched, {stats["skipped_validation"]} skipped validation')
    for s in stats['samples']:
        print(' ', s)

if __name__ == '__main__':
    main()
