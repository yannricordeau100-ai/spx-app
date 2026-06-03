#!/usr/bin/env python3
"""SA40 batch 18 — parse 10-Q MD&A narrative for sectoral KPIs.

Mission scope: convert period_type='year' -> 'quarter' for SECTORAL KPIs
extracted from 10-Q MD&A narrative (not XBRL): Backlog, Headcount, AUM,
Comp Sales, Insurance Premiums, Subscribers.

Strict rules:
- >= 4 quarterly trims required to convert
- NEVER invent. If insufficient data, leave KPI unchanged.
- _fix_log tag = "SA40-Claude 2026-06-03"
- Dry-run by default. --apply to write.

Approach:
- For each ticker in batch18.txt, scan KPIs flagged period_type='year'
  whose `short` matches one of the sectoral patterns below.
- Parse 10-Q .htm.gz files in ~/Mettrik/sec-data/cat1-us/10Q/{2023..2026}/
- For each KPI pattern, run a curated regex on the (tag-stripped) narrative,
  collect (date, value) tuples, dedupe by date.
- If >= 4 trims found, convert KPI to period_type='quarter', set
  history=[newest..oldest], last_data_date=latest_end_date, append _fix_log.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
BATCH = '/tmp/sa40-batches/batch18.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'

MONTH_MAP = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
}


def parse_long_date(s):
    """Parse 'September 30, 2025' -> '2025-09-30'. Return None on failure."""
    m = re.match(r'(\w+)\s+(\d{1,2}),\s+(\d{4})', s)
    if not m:
        return None
    mon = MONTH_MAP.get(m.group(1).lower())
    if not mon:
        return None
    return f"{m.group(3)}-{mon}-{int(m.group(2)):02d}"


# Sectoral KPI matchers: short label substring -> list of (regex pattern, scale_to_unit_fn)
# Each regex must capture: group(1) = numeric, group(2) = end-date as long form
# Multiplier function returns the value in the KPI's "raw" unit (e.g. K for headcount).
def _to_thousands(v):
    return v / 1000.0


def _identity(v):
    return v


KPI_MATCHERS = {
    'Headcount': [
        # "employee base of 4,414 full-time employees as of September 30, 2025"
        (re.compile(r'employee base of ([\d,]+) full-time employees as of (\w+ \d{1,2}, \d{4})', re.IGNORECASE), _to_thousands),
        # "4,001 full-time employees as of March 31, 2025"
        (re.compile(r'([\d,]+) full-time employees as of (\w+ \d{1,2}, \d{4})', re.IGNORECASE), _to_thousands),
        # "approximately 14,000 employees as of October 31, 2025"
        (re.compile(r'approximately ([\d,]+) employees as of (\w+ \d{1,2}, \d{4})', re.IGNORECASE), _to_thousands),
        # "had approximately 14,000 full-time employees as of"
        (re.compile(r'had approximately ([\d,]+) (?:full-time )?employees as of (\w+ \d{1,2}, \d{4})', re.IGNORECASE), _to_thousands),
    ],
    'Backlog': [
        # "Backlog at September 30, 2025 was $51.2 billion"
        (re.compile(r'[Bb]acklog (?:at|as of) (\w+ \d{1,2}, \d{4}) (?:was|of) \$?([\d,.]+)\s*billion', re.IGNORECASE), None),
    ],
    'AUM': [
        # "assets under management of $1.5 trillion as of September 30, 2025"
        (re.compile(r'assets under management of \$?([\d,.]+)\s*(?:billion|trillion) as of (\w+ \d{1,2}, \d{4})', re.IGNORECASE), None),
    ],
    'Subscribers': [
        # "X paid memberships at end of period" for NFLX (stopped Q1 2025)
        (re.compile(r'([\d,]+\.?\d*) million paid (?:memberships|subscribers) (?:at|as of)', re.IGNORECASE), None),
    ],
}

# Map KPI.short (lowercased substring) -> matcher key
SHORT_TO_MATCHER = {
    'headcount': 'Headcount',
    'backlog': 'Backlog',
    'aum': 'AUM',
    'subscribers': 'Subscribers',
    'subscriber': 'Subscribers',
    'members': 'Subscribers',
    'net adds': 'Subscribers',
}


def strip_html(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'&#160;|&nbsp;', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def collect_narrative_facts(ticker, matcher_key):
    """Scan all 10-Qs for ticker, run matcher regexes, return {end_date: value}."""
    matchers = KPI_MATCHERS.get(matcher_key, [])
    if not matchers:
        return {}
    files = []
    for year in ('2020', '2021', '2022', '2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    facts = {}
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        text = strip_html(html)
        file_matched = False
        for pat, scale_fn in matchers:
            file_had_match = False
            for m in pat.finditer(text):
                # date may be group(1) or group(2) depending on pattern
                groups = m.groups()
                date_str = None
                num_str = None
                for g in groups:
                    if g and re.match(r'\w+ \d{1,2}, \d{4}$', g):
                        date_str = g
                    elif g and re.match(r'[\d,.]+$', g):
                        num_str = g
                if not (date_str and num_str):
                    continue
                iso = parse_long_date(date_str)
                if not iso:
                    continue
                # Filter out IPO prospectus historical references (e.g. December 31, 2010
                # appearing in 2022-2024 PLTR filings as a backward-looking comparison).
                # Heuristic: skip dates more than 3 years before the filing date.
                try:
                    filing_date_str = os.path.basename(fp).split('_')[1].split('.')[0]
                    filing_year = int(filing_date_str[:4])
                    fact_year = int(iso[:4])
                    if filing_year - fact_year > 3:
                        continue
                except Exception:
                    pass
                try:
                    val = float(num_str.replace(',', ''))
                except ValueError:
                    continue
                if scale_fn:
                    val = scale_fn(val)
                # keep first occurrence per date
                if iso not in facts:
                    facts[iso] = val
                file_had_match = True
                file_matched = True
            if file_had_match:
                break  # one successful regex per file is enough
    return facts


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def find_matcher_key(short):
    if not short:
        return None
    s = short.lower()
    for sub, key in SHORT_TO_MATCHER.items():
        if sub in s:
            return key
    return None


def process_ticker(ticker, apply_mode=False):
    log_lines = []
    try:
        fp, d = load_pipeline(ticker)
    except FileNotFoundError:
        return ['MISSING pipeline json']
    year_kpis = [k for k in d.get('kpis', []) if k.get('period_type') == 'year']
    if not year_kpis:
        return ['no year-KPIs']
    # filter sectoral candidates
    candidates = []
    for kpi in year_kpis:
        key = find_matcher_key(kpi.get('short'))
        if key:
            candidates.append((kpi, key))
    if not candidates:
        return ['no sectoral year-KPI candidates']
    changed = False
    for kpi, key in candidates:
        short = kpi.get('short')
        facts = collect_narrative_facts(ticker.upper(), key)
        if len(facts) < 4:
            log_lines.append(f'  - {short} [{key}]: SKIP ({len(facts)} trims found, < 4)')
            continue
        # Sort newest -> oldest
        items = sorted(facts.items(), key=lambda x: x[0], reverse=True)[:20]
        vals = [round(v, 6) for _d, v in items]
        kpi['period_type'] = 'quarter'
        kpi['history'] = vals
        kpi['last_data_date'] = items[0][0]
        entry = f'{FIX_LOG_TAG} {TODAY}: quarterly from 10-Q MD&A narrative ({len(vals)} trims)'
        fl = kpi.get('_fix_log')
        if fl is None:
            kpi['_fix_log'] = [entry]
        elif isinstance(fl, list):
            fl.append(entry)
        else:
            kpi['_fix_log'] = [fl, entry]
        log_lines.append(f'  + {short} [{key}]: CONVERTED ({len(vals)} trims), latest@{items[0][0]}={vals[0]}')
        changed = True
    if changed and apply_mode:
        save_pipeline(fp, d)
        log_lines.append(f'  >> written {fp}')
    elif changed:
        log_lines.append('  >> (dry-run, not written)')
    return log_lines


def main():
    apply_mode = '--apply' in sys.argv
    with open(BATCH) as f:
        tickers = [line.split()[0].strip() for line in f if line.strip()]
    print(f'=== SA40 batch18 ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped_no_data': 0, 'no_candidates': 0, 'no_year': 0, 'missing': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'SKIP (' in ln:
                summary['skipped_no_data'] += 1
            elif 'no sectoral' in ln:
                summary['no_candidates'] += 1
            elif 'no year-KPIs' in ln:
                summary['no_year'] += 1
            elif 'MISSING pipeline' in ln:
                summary['missing'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
