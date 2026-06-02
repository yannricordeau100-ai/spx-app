#!/usr/bin/env python3
"""Phase 2 Step 2 — Extract KPI year-history from 10-K text via pattern matching.

For each US top307 ticker with short-history non-generic KPIs, locate the 10-K
section that mentions the KPI and extract the year-by-year values from the
disclosure table. Uses regex + heuristics, NO LLM API call (we run as the
Opus agent itself, using the structure of 10-K filings).

Anti-invention strict : if no table found → skip.
Output : updates src/data/v2-pipeline/<ticker>.json with extended history,
tagged _history_llm_extended_at and _history_source.
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

def is_generic(name: str) -> bool:
    return (name or '').lower().strip() in GENERIC_PATTERNS

# --- HTML strip ---
def strip_html(html: str) -> str:
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

# --- KPI alias map (canonical short_name → list of regex patterns to find in 10-K) ---
# Tuples (canonical_name, [search_patterns], unit_hint)
ALIASES = {
    'headcount': [r'\bemployees\b', r'approximately[\s]+([\d,]+)[\s]+(?:full-time)?\s*employees'],
    'total employees': [r'\bemployees\b'],
    'iphone revenue': [r'\biPhone\b'],
    'ipad revenue': [r'\biPad\b'],
    'mac revenue': [r'\bMac\b'],
    'services revenue': [r'\bServices\b'],
    'wearables/home/acc': [r'Wearables,?\s*Home'],
    'gaming revenue': [r'\bGaming\b'],
    'networking revenue': [r'\bNetworking\b'],
    'data center revenue': [r'Data\s*Center'],
    'auto revenue': [r'Automotive'],
}

# --- Parse 10-K tables ---
# A "table" in stripped text looks like: "Header1 Year1 Year2 Year3 Label $ N1 % $ N2 % $ N3 ..."
# Detection: line that contains "20XX 20YY 20ZZ" then values.
# We need to find numerical tables with the KPI name near them.

NUM_RE = re.compile(r'\$?\s*\(?\s*([\d]{1,3}(?:[,]\d{3})*(?:\.\d+)?)\s*\)?')
YEAR_RE = re.compile(r'\b(20\d{2})\b')
PCT_RE = re.compile(r'\(?\s*[\d\.]+\s*%\s*\)?')

def find_10k_paths(ticker: str) -> list:
    """Return all 10-K gz paths sorted desc by year."""
    if not CAT1.exists():
        return []
    paths = []
    for yr in sorted(os.listdir(CAT1), reverse=True):
        d = CAT1 / yr
        if not d.is_dir(): continue
        for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
            paths.append((int(yr), f))
    return paths

def load_text(path: Path) -> str:
    try:
        with gzip.open(path, 'rt', errors='ignore') as g:
            return strip_html(g.read())
    except Exception:
        return ''

def normalize_num(s: str) -> float | None:
    if s is None: return None
    s = s.replace(',', '').replace('$', '').strip()
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return None

# --- Pattern A: "Products and Services Performance" table (Apple-style) ---
# The table starts with year headers and has KPI label followed by values.
def extract_segment_table(text: str, label_pattern: str, max_years: int = 4) -> dict:
    """Look for "20XX 20YY 20ZZ ... <label> $ N1 ... $ N2 ... $ N3"
    Return dict {year: value}.
    """
    out = {}
    # Find label
    for label_m in re.finditer(label_pattern, text, flags=re.IGNORECASE):
        # Look backward up to 800 chars for year headers
        start = max(0, label_m.start() - 1500)
        before = text[start:label_m.start()]
        years_m = list(YEAR_RE.finditer(before))
        if len(years_m) < 2:
            continue
        # Take the last block of consecutive years
        last_years = [int(m.group(1)) for m in years_m[-max_years:]]
        # Look forward up to 200 chars for values
        after = text[label_m.end(): label_m.end() + 600]
        # Extract first N numbers that look like values (>= 50 typically for revenue)
        nums_raw = NUM_RE.findall(after)
        nums = [normalize_num(n) for n in nums_raw]
        nums = [n for n in nums if n is not None]
        if len(nums) < len(last_years):
            continue
        # Map: first num = most recent year, but percent change interspersed
        # Apple format: "$ 209,586 4 % $ 201,183 — % $ 200,583" → take every other num
        # Skip small numbers that look like percentages (<100 and surrounded by % later)
        # Simpler: pick numbers ≥ 100 (assuming Mds $ for revenue)
        # Heuristic: take last value (oldest year), second-last (middle), etc.
        # Actually pattern: VAL CHG VAL CHG VAL → take indexes 0, 2, 4
        # But CHG can be missing on last → just try both strategies and check monotonic-ish.
        # Strategy 1: take indices 0, 2, 4 (assumes alternating value/percent)
        # Strategy 2: take large numbers in order
        big_nums = [n for n in nums if abs(n) >= 100]
        if len(big_nums) >= len(last_years):
            # last_years are MOST RECENT → first values in big_nums
            for i, yr in enumerate(last_years[::-1]):  # oldest first in table appearance? actually values are most-recent first
                pass
            # actually in Apple table, columns are: 2025 2024 2023 → values 209586 201183 200583
            # last_years from before-text are e.g. [2025, 2024, 2023]
            # so big_nums[0]=2025, big_nums[1]=2024, etc.
            for i, yr in enumerate(last_years):
                if i < len(big_nums):
                    out[yr] = big_nums[i]
            return out
    return out

def millions_to_billions(v: float) -> float:
    # In 10-Ks values are often in millions. If > 1000 we assume millions → Bn.
    return round(v / 1000.0, 3)

# --- Headcount extraction ---
HEADCOUNT_PATTERNS = [
    r'(?:had|employed|approximately)\s+([\d,]+)\s+(?:full[-\s]time\s+)?employees',
    r'([\d,]+)\s+(?:full[-\s]time\s+)?employees(?:\s+worldwide)?',
    r'(?:total\s+(?:of\s+)?)?(?:our\s+)?(?:workforce|headcount)\s+(?:was|of|comprised)\s+(?:approximately\s+)?([\d,]+)',
]

def extract_headcount(text: str) -> float | None:
    """Find employee count in 10-K Item 1 / Human Capital section."""
    # Focus on Item 1 / Human Capital
    sec = text
    m = re.search(r'(?:Human Capital|Employees|Our People)(.{0,5000})', text, flags=re.IGNORECASE)
    if m:
        sec = m.group(1)
    for pat in HEADCOUNT_PATTERNS:
        for m in re.finditer(pat, sec, flags=re.IGNORECASE):
            n = m.group(1).replace(',', '')
            try:
                val = int(n)
                if 100 <= val <= 5000000:
                    return val
            except ValueError:
                continue
    return None

# --- Determine target unit/scale of existing history ---
def detect_scale(kpi: dict) -> str:
    unit = (kpi.get('unit') or '').lower()
    if 'mds' in unit or 'bn' in unit or 'billion' in unit:
        return 'B'
    if 'mn' in unit or 'million' in unit or 'mio' in unit:
        return 'M'
    if 'k' == unit.strip() or 'thousand' in unit:
        return 'K'
    if '%' in unit:
        return 'PCT'
    return 'RAW'

def convert_to_kpi_scale(value: float, scale: str) -> float:
    # value from 10-K is in millions of $
    if scale == 'B':
        return round(value / 1000.0, 3)
    if scale == 'M':
        return round(value, 1)
    if scale == 'K':
        return round(value / 1000.0, 1)
    return value

# --- Main processing ---
def process_ticker(ticker: str, kpi_list: list, dry_run: bool = False) -> dict:
    """Return dict {short_name: {year: value, ...}, ...}."""
    paths = find_10k_paths(ticker)
    if not paths:
        return {}
    # Load most recent and one from ~3 years ago
    texts = []
    for yr, p in paths[:3]:
        t = load_text(p)
        if t:
            texts.append((yr, t))
    if not texts:
        return {}

    result = {}
    for kpi in kpi_list:
        short = (kpi.get('short') or '').strip()
        if not short:
            continue
        scale = detect_scale(kpi)
        canon = short.lower()

        # Special: headcount
        if 'headcount' in canon or 'employees' in canon:
            yearly = {}
            for yr, txt in texts:
                hc = extract_headcount(txt)
                if hc is not None:
                    # 10-K filed in year Y typically reports FY (Y-1 or Y)
                    # Use the filing year as FY
                    target_yr = yr if 'fy' not in (kpi.get('unit') or '').lower() else yr
                    yearly[target_yr] = convert_to_kpi_scale(hc / 1000.0 * 1000.0, scale) if scale != 'K' else round(hc / 1000.0, 1)
                    if scale == 'K':
                        yearly[target_yr] = round(hc / 1000.0, 1)
                    elif scale == 'RAW':
                        yearly[target_yr] = hc
                    else:
                        yearly[target_yr] = round(hc, 0)
            if yearly:
                result[short] = yearly
            continue

        # Segment revenue extraction
        # Get search pattern from ALIASES or default to first word
        patterns = ALIASES.get(canon, [re.escape(short.split()[0])])
        for ptn in patterns:
            yearly = {}
            for yr, txt in texts:
                seg = extract_segment_table(txt, ptn)
                for sy, sv in seg.items():
                    # sv is raw (millions usually). Convert to KPI scale.
                    if scale == 'B':
                        sv_conv = millions_to_billions(sv)
                    elif scale == 'M':
                        sv_conv = sv
                    else:
                        sv_conv = sv
                    yearly.setdefault(sy, sv_conv)
            if yearly and len(yearly) >= 2:
                result[short] = yearly
                break
    return result

def main():
    import sys
    top307 = json.load(open(ROOT / 'src/data/top307-breakdown.json'))
    us = [c for c in top307 if c.get('country') == 'United States']

    # Build candidate list
    candidates = OrderedDict()
    for c in us:
        t = c['ticker']
        f1 = V2_DIR / f'{t.lower()}.json'
        if not f1.exists():
            continue
        d = json.load(open(f1))
        rem = []
        for k in d.get('kpis', []):
            if k.get('period_type') == 'quarter':
                continue
            short_name = (k.get('short') or '').strip()
            if not short_name or is_generic(short_name):
                continue
            hist = k.get('history') or []
            if len(hist) >= 5:
                continue
            rem.append(k)
        if rem:
            candidates[t] = (d, rem)

    print(f'Candidates: {len(candidates)} companies, {sum(len(v[1]) for v in candidates.values())} KPIs')

    stats = {'updated': 0, 'touched_companies': 0, 'samples': []}

    for ticker, (data, kpis) in candidates.items():
        extracted = process_ticker(ticker, kpis)
        if not extracted:
            continue
        touched_here = False
        for k in kpis:
            short = k.get('short')
            if short not in extracted:
                continue
            yearly = extracted[short]
            if len(yearly) < 2:
                continue
            # Build new history: sort years ascending, extract values
            sorted_years = sorted(yearly.keys())
            new_hist_back = [yearly[y] for y in sorted_years]
            # Merge with existing: existing is probably the recent years.
            # We replace if our new hist is longer, else skip.
            existing = k.get('history') or []
            # If new_hist_back covers years that lead INTO the existing recent values,
            # prepend new_hist_back EXCLUDING any overlap with existing's last items.
            # Heuristic: if existing has N values and new has M, and M > N, replace.
            if len(new_hist_back) > len(existing):
                # Preserve the last existing value if newer (e.g. FY26 quarterly-derived)
                if existing:
                    last_existing = existing[-1]
                    new_last = new_hist_back[-1]
                    try:
                        if abs(float(last_existing) - float(new_last)) > max(1.0, abs(float(new_last)) * 0.05):
                            new_hist_back.append(last_existing)
                    except (TypeError, ValueError):
                        pass
                k['history'] = new_hist_back
                k['_history_llm_extended_at'] = NOW
                k['_history_source'] = SOURCE
                k['_history_extended_v2'] = True
                stats['updated'] += 1
                touched_here = True
                if len(stats['samples']) < 20:
                    stats['samples'].append(f"{ticker}:{short} → {len(new_hist_back)} years {new_hist_back}")
        if touched_here:
            f1 = V2_DIR / f'{ticker.lower()}.json'
            with open(f1, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            stats['touched_companies'] += 1

    print(f"Updated: {stats['updated']} KPIs across {stats['touched_companies']} companies")
    for s in stats['samples']:
        print(' ', s)

if __name__ == '__main__':
    main()
