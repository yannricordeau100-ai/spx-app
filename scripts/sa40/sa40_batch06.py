#!/usr/bin/env python3
"""SA40 batch 06 — parse 10-Q MD&A narrative for sectoral KPIs.

Targets: Backlog, Headcount, AUM, Comp Sales, Insurance Premiums, Subscribers.

Strategy: convert period_type='year' KPIs to 'quarter' from 10-Q .htm.gz when
≥4 quarterly periods can be extracted from MD&A narrative prose (NOT XBRL,
NOT tables — narrative regex only, to stay strictly within the "MD&A
narrative" scope of SA40).

JAMAIS INVENTER. If the narrative does not yield ≥4 reliable matches via a
strict regex anchored on a stable phrase, SKIP the KPI.

_fix_log tag = "SA40-Claude 2026-06-03". Dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime
from html import unescape

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
BATCH = '/tmp/sa40-batches/batch06.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'

# Map filing-date -> end-of-quarter ISO date.
# We approximate quarter-end by taking the filing date and going to the last
# day of the most recent calendar quarter strictly before the filing.
def quarter_end_for_filing(fdate_iso):
    y, m, _ = fdate_iso.split('-')
    y, m = int(y), int(m)
    # Filing month -> quarter-end month (last quarter that closed before filing)
    if m <= 3:  # filing in Q1 -> reports Q4 of prior year
        return f'{y-1}-12-31'
    if m <= 6:
        return f'{y}-03-31'
    if m <= 9:
        return f'{y}-06-30'
    return f'{y}-09-30'


def strip_html(html):
    text = re.sub(r'<script.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text


def list_10q_files(ticker):
    files = []
    for year in ('2022', '2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    return files


def filing_date_from_path(fp):
    base = os.path.basename(fp)
    # TICKER_YYYY-MM-DD.htm.gz
    m = re.search(r'_(\d{4}-\d{2}-\d{2})\.htm\.gz$', base)
    return m.group(1) if m else None


# === Extractors ===
# Each extractor returns dict: {quarter_end_iso: value}
# Anchored on a UNIQUE narrative phrase. If the phrase isn't present, returns {}.

def extract_cat_backlog(text):
    """CAT 10-Q MD&A: 'Order Backlog ... approximately $XX.X billion'."""
    out = {}
    # Anchored phrase: "the dollar amount of backlog believed to be firm was approximately $XX.X billion"
    pat = re.compile(
        r'the dollar amount of backlog believed to be firm was approximately \$?\s*([\d.]+)\s*billion',
        re.IGNORECASE,
    )
    for m in pat.finditer(text):
        # We need the quarter context. Look back ~300 chars for "first/second/third/fourth quarter of YYYY".
        s = max(0, m.start() - 400)
        ctx = text[s:m.start()]
        qm = re.search(r'(first|second|third|fourth) quarter of (\d{4})', ctx, re.IGNORECASE)
        if not qm:
            continue
        q_word = qm.group(1).lower()
        yr = int(qm.group(2))
        q_map = {'first': '03-31', 'second': '06-30', 'third': '09-30', 'fourth': '12-31'}
        date = f'{yr}-{q_map[q_word]}'
        try:
            val = float(m.group(1))
        except ValueError:
            continue
        out[date] = val
    return out


def extract_tjx_comp_sales(text):
    """TJX 10-Q: 'Consolidated comp sales increased/decreased N% for the Nth quarter of fiscal YYYY'."""
    out = {}
    pat = re.compile(
        r'[Cc]onsolidated comp sales (increased|decreased) (\d+(?:\.\d+)?)\s*% for the (first|second|third|fourth) quarter of fiscal (\d{4})',
    )
    for m in pat.finditer(text):
        direction = m.group(1).lower()
        val = float(m.group(2))
        if direction == 'decreased':
            val = -val
        q_word = m.group(3).lower()
        fy = int(m.group(4))  # TJX fiscal year ends late January/early Feb
        # TJX fiscal Q1 ~ May filing, Q2 ~ Aug, Q3 ~ Nov, Q4 ~ Feb of fy
        # Map fiscal quarter -> calendar quarter-end
        # TJX fiscal year 2026 = Feb 2025 - Jan 2026, so Q1 ends ~May 2025
        # Use fiscal_year - 1 as anchor year for first three quarters
        cal_year = fy - 1
        q_map = {'first': f'{cal_year}-05-31', 'second': f'{cal_year}-08-31',
                 'third': f'{cal_year}-11-30', 'fourth': f'{fy}-01-31'}
        date = q_map[q_word]
        out[date] = val
    return out


# Registry of (ticker, kpi_short) -> extractor
EXTRACTORS = {
    ('CAT', 'Backlog'): {'fn': extract_cat_backlog, 'unit_hint': 'Mds $'},
    ('TJX', 'Comp Sales'): {'fn': extract_tjx_comp_sales, 'unit_hint': '%'},
}


def collect_narrative(ticker):
    """Concatenate stripped narrative from all 10-Q .htm.gz files for ticker."""
    files = list_10q_files(ticker.upper())
    chunks = []
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        text = strip_html(html)
        chunks.append(text)
    return '\n'.join(chunks)


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def process_ticker(ticker, apply_mode=False):
    log_lines = []
    try:
        fp, d = load_pipeline(ticker)
    except FileNotFoundError:
        return [f'  - MISSING pipeline json ({ticker.lower()}.json)']
    year_kpis = [k for k in d.get('kpis', []) if k.get('period_type') == 'year']
    if not year_kpis:
        return ['  - no year-KPIs']
    text = None  # lazy load
    changed = False
    for kpi in year_kpis:
        short = kpi.get('short', '')
        key = (ticker.upper(), short)
        if key not in EXTRACTORS:
            log_lines.append(f'  - {short}: SKIP (no narrative extractor)')
            continue
        ex = EXTRACTORS[key]
        if text is None:
            text = collect_narrative(ticker)
            if not text.strip():
                log_lines.append(f'  - no 10-Q narrative available')
                return log_lines
        series_map = ex['fn'](text)
        if len(series_map) < 4:
            log_lines.append(f'  - {short}: SKIP (only {len(series_map)} narrative quarter(s), <4)')
            continue
        items = sorted(series_map.items(), key=lambda x: x[0], reverse=True)
        vals = [round(v, 4) for _d, v in items][:20]
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
        log_lines.append(
            f'  + {short}: CONVERTED ({len(vals)} trims), latest@{items[0][0]}={vals[0]}'
        )
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
    print(f'=== SA40 batch06 ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped_no_pattern': 0, 'skipped_few_quarters': 0,
               'no_year_kpis': 0, 'missing_pipeline': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'no narrative extractor' in ln:
                summary['skipped_no_pattern'] += 1
            elif 'narrative quarter' in ln:
                summary['skipped_few_quarters'] += 1
            elif 'no year-KPIs' in ln:
                summary['no_year_kpis'] += 1
            elif 'MISSING pipeline' in ln:
                summary['missing_pipeline'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
