#!/usr/bin/env python3
"""SA40 batch 11 — Parse 10-Q (and 10-K) MD&A narrative for SECTORAL quarterly KPIs.

Targets sectoral KPIs currently stored at period_type='year' for batch11 tickers.
Sectoral families: Backlog, Headcount, AUM, Comp Sales, Insurance Premiums, Subscribers.

NEVER invent. _fix_log tag = "SA40-Claude 2026-06-03".
Dry-run by default. --apply to write to v2-pipeline JSON.
NO COMMIT.

Approach: per-ticker deterministic regex/text extraction from MD&A. Only convert a
KPI's period_type to 'quarter' when >=4 distinct quarterly periods are extracted
(across 10-Q + 10-K). When the disclosure pattern cannot reliably yield >=4 trims,
leave the KPI untouched and append a _fix_log diagnostic.

Scope decisions (deterministic, no LLM):
  * NVR Backlog Units + Backlog Value: table 'Backlog (units) X Y' + 'Average backlog price $ A $ B'
    Q4 from 10-K (table format identical).
  * NYT Total Subscribers: '5 most recent fiscal quarters' table (Total subscribers row).
  * T Postpaid Subscribers: 'Subscribers ... Postpaid X Y' table per 10-Q + 10-K.
  * Other batch11 sectoral KPIs (Headcount, AUM, Comp Sales, Insurance Premiums) are NOT
    quarterly-disclosed in 10-Q MD&A narrative for these specific issuers, or rely on tables
    too noisy for safe deterministic extraction at this scope. They are left untouched with a
    diagnostic _fix_log entry.
"""
from __future__ import annotations
import argparse, gzip, json, os, re, sys, glob
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.path.expanduser('~/spx-app'))
PIPELINE = ROOT / 'src/data/v2-pipeline'
SEC_10Q = Path(os.path.expanduser('~/Mettrik/sec-data/cat1-us/10Q'))
SEC_10K = Path(os.path.expanduser('~/Mettrik/sec-data/cat1-us/10K'))
BATCH = '/tmp/sa40-batches/batch11.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'
MARKER = f'{FIX_LOG_TAG} {TODAY}'


def strip_html(html: str) -> str:
    txt = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r'<style[^>]*>.*?</style>', ' ', txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r'<[^>]+>', ' ', txt)
    txt = re.sub(r'&nbsp;|&#160;', ' ', txt)
    txt = re.sub(r'&#8212;', '-', txt)
    txt = re.sub(r'&#8220;|&#8221;', '"', txt)
    txt = re.sub(r'&[a-z]+;', ' ', txt)
    txt = re.sub(r'&#\d+;', ' ', txt)
    m = re.search(r'(UNITED STATES SECURITIES AND EXCHANGE|FORM 10-Q|FORM 10-K|Item\s+2)', txt)
    if m:
        txt = txt[m.start():]
    txt = re.sub(r'\s+', ' ', txt)
    return txt


def load_html(path: str) -> str:
    with gzip.open(path, 'rt', errors='ignore') as f:
        return f.read()


# ----------------------------- Quarter labelling ----------------------------- #
# Fiscal Q from filing date heuristic; for NVR (calendar FY), T (calendar FY),
# NYT (calendar FY), the 10-Q filing date in Apr/May = Q1, Jul/Aug = Q2, Oct/Nov = Q3.
# 10-K filing date (Feb/Mar) = Q4 of previous fiscal year (year-end Dec 31).
def filing_to_quarter(filename: str, is_10k: bool) -> tuple[int, int] | None:
    # filename like TICKER_YYYY-MM-DD.htm.gz
    m = re.match(r'^[A-Z\.]+_(\d{4})-(\d{2})-(\d{2})\.htm\.gz$', filename)
    if not m:
        return None
    yr, mo, _ = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if is_10k:
        # 10-K filed in Feb/Mar (sometimes Apr) of year N+1, covers FY = yr-1
        return (yr - 1, 4)
    # 10-Q heuristics by filing month
    if mo in (4, 5):
        return (yr, 1)
    if mo in (7, 8):
        return (yr, 2)
    if mo in (10, 11, 12):
        return (yr, 3)
    # T sometimes files later in Apr after FY end — handled by is_10k branch
    return None


def quarter_label(yr: int, q: int) -> str:
    return f"Q{q} {yr}"


def period_end_date(yr: int, q: int) -> str:
    mapping = {1: '-03-31', 2: '-06-30', 3: '-09-30', 4: '-12-31'}
    return f"{yr}{mapping[q]}"


# ----------------------------- NVR parsers ----------------------------- #
NVR_UNITS_RE = re.compile(r'[Bb]acklog\s*\(units\)\s*([\d,]+)\s+([\d,]+)\s+Average\s+backlog\s+price\s+\$\s*([\d,\.]+)\s+\$\s*([\d,\.]+)', re.I)


def parse_nvr_file(path: str) -> dict | None:
    """Returns {'units': int, 'avg_price_k': float, 'backlog_value_b': float} or None."""
    text = strip_html(load_html(path))
    m = NVR_UNITS_RE.search(text)
    if not m:
        return None
    units = int(m.group(1).replace(',', ''))
    avg_k = float(m.group(3).replace(',', ''))
    value_b = round(units * avg_k / 1e6, 3)  # units * $K-per-home / 1e6 = $B
    return {'units': units, 'avg_price_k': avg_k, 'backlog_value_b': value_b}


# ----------------------------- NYT parsers ----------------------------- #
# The "5 most recent fiscal quarters" table is the cleanest source. Pattern:
# After "Total subscribers" row: "11,660 11,430 11,090 10,840 10,550" (in thousands).
# The columns from the preceding header give us the period-end dates.
NYT_TOT_RE = re.compile(
    r'Total\s+subscribers\s+'
    r'([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)',
    re.I,
)
NYT_HEADER_RE = re.compile(
    r'For\s+the\s+Quarters\s+Ended[^\d]+'
    r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\s+'
    r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\s+'
    r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\s+'
    r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\s+'
    r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})',
    re.I,
)


def _date_to_yq(date_str: str) -> tuple[int, int] | None:
    m = re.match(r'(\w+)\s+(\d{1,2}),\s+(\d{4})', date_str)
    if not m:
        return None
    months = {'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
              'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12}
    mo = months.get(m.group(1).lower())
    yr = int(m.group(3))
    if not mo:
        return None
    q = (mo - 1) // 3 + 1
    return (yr, q)


def parse_nyt_file(path: str) -> dict[str, int] | None:
    """Returns dict {(yr,q): total_subs_thousands} or None."""
    text = strip_html(load_html(path))
    header = NYT_HEADER_RE.search(text)
    if not header:
        return None
    # Find the Total subscribers row *after* the header
    sub = text[header.end():]
    tot = NYT_TOT_RE.search(sub[:20000])
    if not tot:
        return None
    dates = [header.group(i) for i in range(1, 6)]
    nums = [int(tot.group(i).replace(',', '')) for i in range(1, 6)]
    out: dict[tuple[int, int], int] = {}
    for d, n in zip(dates, nums):
        yq = _date_to_yq(d)
        if yq:
            out[yq] = n
    return out


# ----------------------------- T parsers ----------------------------- #
# Pattern in Mobility table:
# "Postpaid 89,463 87,450 2.3 %"   <- current Q-end, prior-year Q-end, % change
# The line "March 31, 2025 2024" or with both dates in heading.
# Filing date determines the current Q period-end (calendar FY).
T_POSTPAID_RE = re.compile(r'Postpaid\s+([\d,]+)\s+([\d,]+)\s+[\(\-\d\.,]+\s*%', re.I)


def parse_t_file(path: str, is_10k: bool) -> dict[tuple[int, int], int] | None:
    """Returns {(yr,q): postpaid_thousands} for current Q-end and prior-year same Q-end."""
    text = strip_html(load_html(path))
    # Match first occurrence which is the Mobility table.
    m = T_POSTPAID_RE.search(text)
    if not m:
        return None
    cur = int(m.group(1).replace(',', ''))
    prior = int(m.group(2).replace(',', ''))
    fname = os.path.basename(path)
    yq = filing_to_quarter(fname, is_10k)
    if not yq:
        return None
    yr, q = yq
    return {(yr, q): cur, (yr - 1, q): prior}


# ----------------------------- Apply helpers ----------------------------- #
def find_kpi(d: dict, short_substr: str) -> int | None:
    for i, k in enumerate(d.get('kpis', [])):
        if (k.get('short') or '').lower() == short_substr.lower():
            return i
    return None


def append_fixlog(kpi: dict, msg: str) -> None:
    fl = kpi.get('_fix_log')
    entry = f'{MARKER}: {msg}'
    if isinstance(fl, list):
        fl.append(entry)
    else:
        kpi['_fix_log'] = [entry]


def set_quarterly(kpi: dict, history: list, periods: list[str], source: str) -> None:
    kpi['history'] = history
    kpi['history_periods'] = periods
    kpi['period_type'] = 'quarter'
    kpi['_period_type_resolved_by'] = MARKER
    kpi['_history_source'] = source
    if history:
        kpi['value'] = history[-1]
    # Drop last_data_date — let SA-downstream recompute, but we set it for safety
    # using last period end
    if periods:
        last = periods[-1]
        # Q3 2025 -> 2025-09-30
        m = re.match(r'Q(\d)\s+(\d{4})', last)
        if m:
            q = int(m.group(1)); yr = int(m.group(2))
            kpi['last_data_date'] = period_end_date(yr, q)


# ----------------------------- Per-ticker drivers ----------------------------- #
def process_nvr(d: dict) -> tuple[list[str], list[str]]:
    """Returns (changes, diagnostics)."""
    changes, diags = [], []
    files: list[tuple[str, bool]] = []
    for y in ('2023', '2024', '2025'):
        files += [(p, False) for p in sorted(glob.glob(str(SEC_10Q / y / 'NVR_*.htm.gz')))]
    for y in ('2024', '2025', '2026'):
        files += [(p, True) for p in sorted(glob.glob(str(SEC_10K / y / 'NVR_*.htm.gz')))]
    files.sort(key=lambda x: os.path.basename(x[0]))

    series_units: dict[tuple[int, int], int] = {}
    series_value: dict[tuple[int, int], float] = {}
    for fp, is_10k in files:
        r = parse_nvr_file(fp)
        if not r:
            continue
        yq = filing_to_quarter(os.path.basename(fp), is_10k)
        if not yq:
            continue
        series_units[yq] = r['units']
        series_value[yq] = r['backlog_value_b']

    if len(series_units) < 4:
        diags.append(f"NVR: only {len(series_units)} trims extracted (need >=4) — skip")
        return changes, diags

    ordered = sorted(series_units.keys())
    periods = [quarter_label(*yq) for yq in ordered]
    units_hist = [series_units[yq] for yq in ordered]
    value_hist = [series_value[yq] for yq in ordered]

    idx_u = find_kpi(d, 'Backlog Units')
    idx_v = find_kpi(d, 'Backlog Value')
    if idx_u is not None:
        kpi = d['kpis'][idx_u]
        if kpi.get('period_type') != 'quarter':
            set_quarterly(kpi, units_hist, periods,
                          'SA40 10-Q/10-K MD&A "Backlog (units)" table')
            append_fixlog(kpi, f'quarter from 10-Q/10-K Backlog (units) table ({len(units_hist)} trims)')
            changes.append(f'NVR Backlog Units -> quarter ({len(units_hist)} trims)')
    if idx_v is not None:
        kpi = d['kpis'][idx_v]
        if kpi.get('period_type') != 'quarter':
            set_quarterly(kpi, value_hist, periods,
                          'SA40 derived = Backlog Units * Average backlog price (10-Q/10-K)')
            append_fixlog(kpi, f'quarter derived from units*avg_price ({len(value_hist)} trims, Mds$)')
            changes.append(f'NVR Backlog Value -> quarter ({len(value_hist)} trims)')
    return changes, diags


def process_nyt(d: dict) -> tuple[list[str], list[str]]:
    changes, diags = [], []
    files: list[str] = []
    for y in ('2023', '2024', '2025'):
        files += sorted(glob.glob(str(SEC_10Q / y / 'NYT_*.htm.gz')))
    # 10-K for FY-end Q4
    for y in ('2024', '2025', '2026'):
        files += sorted(glob.glob(str(SEC_10K / y / 'NYT_*.htm.gz')))

    series: dict[tuple[int, int], int] = {}
    for fp in files:
        r = parse_nyt_file(fp)
        if not r:
            continue
        for yq, v in r.items():
            # latest filing wins for each Q (later = more accurate restated)
            series[yq] = v
    if len(series) < 4:
        diags.append(f"NYT: only {len(series)} trims extracted — skip")
        return changes, diags

    ordered = sorted(series.keys())
    periods = [quarter_label(*yq) for yq in ordered]
    # Convert thousands to M with 2 decimals
    hist = [round(series[yq] / 1000.0, 2) for yq in ordered]

    idx = find_kpi(d, 'Total Subscribers')
    if idx is not None:
        kpi = d['kpis'][idx]
        if kpi.get('period_type') != 'quarter':
            set_quarterly(kpi, hist, periods,
                          'SA40 10-Q MD&A "5 most recent fiscal quarters" Total subscribers row')
            kpi['unit'] = 'M'
            append_fixlog(kpi, f'quarter from 10-Q 5-quarter table ({len(hist)} trims, M)')
            changes.append(f'NYT Total Subscribers -> quarter ({len(hist)} trims)')
    return changes, diags


def process_t(d: dict) -> tuple[list[str], list[str]]:
    changes, diags = [], []
    files: list[tuple[str, bool]] = []
    for y in ('2023', '2024', '2025'):
        files += [(p, False) for p in sorted(glob.glob(str(SEC_10Q / y / 'T_*.htm.gz')))]
    for y in ('2024', '2025', '2026'):
        files += [(p, True) for p in sorted(glob.glob(str(SEC_10K / y / 'T_*.htm.gz')))]
    files.sort(key=lambda x: os.path.basename(x[0]))

    series: dict[tuple[int, int], int] = {}
    for fp, is_10k in files:
        r = parse_t_file(fp, is_10k)
        if not r:
            continue
        for yq, v in r.items():
            series[yq] = v

    if len(series) < 4:
        diags.append(f"T: only {len(series)} trims extracted — skip")
        return changes, diags

    ordered = sorted(series.keys())
    periods = [quarter_label(*yq) for yq in ordered]
    hist = [round(series[yq] / 1000.0, 3) for yq in ordered]  # thousands -> M

    idx = find_kpi(d, 'Postpaid Subscribers')
    if idx is not None:
        kpi = d['kpis'][idx]
        if kpi.get('period_type') != 'quarter':
            set_quarterly(kpi, hist, periods,
                          'SA40 10-Q/10-K MD&A Mobility "Postpaid" row')
            kpi['unit'] = 'M'
            append_fixlog(kpi, f'quarter from 10-Q/10-K Mobility Postpaid row ({len(hist)} trims, M)')
            changes.append(f'T Postpaid Subscribers -> quarter ({len(hist)} trims)')
    return changes, diags


# Tickers where sectoral 'year' KPI is NOT robustly available in 10-Q narrative.
# We annotate a diagnostic _fix_log so they're documented for future passes.
SKIP_DIAG: dict[str, list[tuple[str, str]]] = {
    'LVS': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'MPWR': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'MTD': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'NTNX': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'NVDA': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'O': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'RVTY': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'SPGI': [('Headcount', 'Headcount not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'ROK': [('Total Employees', 'Total Employees not disclosed quarterly in 10-Q MD&A (annual-only in 10-K)')],
    'NDAQ': [('ETP AUM', 'ETP AUM disclosed as quarterly average in 10-Q narrative, but no >=4 trims stable across filings — pattern requires LLM-grade scrape, deferred')],
    'PFG': [('AUM', '10-Q discloses AUM rollforward but column semantics (current Q vs YTD vs prior) non-deterministic — deferred'),
             ('Premium & Fee Growth', 'Premium growth % only narrative comparative — no clean quarterly series')],
    'PSA': [('Same Store OpEx', 'PSA same-store OpEx % is narrative comparative — no clean quarterly series in 10-Q')],
    'TROW': [('Net market appreciation', '10-Q AUM rollforward gives current-Q value, but column layout varies (current-Q + prior-Q + YTD interleaved) — non-deterministic at this scope, deferred')],
}


def process_skip_diags(ticker: str, d: dict) -> list[str]:
    notes = []
    for short, reason in SKIP_DIAG.get(ticker, []):
        idx = find_kpi(d, short)
        if idx is None:
            continue
        kpi = d['kpis'][idx]
        # Don't pollute fix_log with duplicates
        fl = kpi.get('_fix_log') or []
        if any(MARKER in (e if isinstance(e, str) else e.get('fix', '')) for e in fl):
            continue
        append_fixlog(kpi, f'skipped — {reason}')
        notes.append(f'{ticker} {short}: skipped ({reason[:60]}...)')
    return notes


# ----------------------------- Main ----------------------------- #
DRIVERS = {
    'NVR': process_nvr,
    'NYT': process_nyt,
    'T': process_t,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='Write changes to v2-pipeline JSON')
    args = ap.parse_args()

    tickers = [l.split('\t')[0].strip().upper() for l in open(BATCH) if l.strip()]

    all_changes: list[str] = []
    all_diags: list[str] = []
    files_written = 0

    for t in tickers:
        slug = t.lower().replace('.', '_') if '.' in t else t.lower()
        # files are <slug>.json with raw lowercase, e.g. pah3.de.json
        path = PIPELINE / f'{t.lower()}.json'
        if not path.exists():
            all_diags.append(f'{t}: pipeline file missing ({path.name})')
            continue
        with open(path) as f:
            d = json.load(f)

        changes, diags = [], []
        drv = DRIVERS.get(t)
        if drv:
            changes, diags = drv(d)
        skip_notes = process_skip_diags(t, d)

        if changes or skip_notes:
            all_changes += changes
            all_diags += diags + skip_notes
            if args.apply:
                with open(path, 'w') as f:
                    json.dump(d, f, ensure_ascii=False, indent=2)
                files_written += 1
        else:
            if diags:
                all_diags += diags

    print('=== SA40 batch11 report ===')
    print(f'Mode: {"APPLY" if args.apply else "DRY-RUN"}')
    print(f'Tickers processed: {len(tickers)}')
    print(f'Changes: {len(all_changes)}')
    for c in all_changes:
        print(f'  + {c}')
    print(f'Diagnostics (skipped/deferred): {len(all_diags)}')
    for c in all_diags:
        print(f'  ~ {c}')
    if args.apply:
        print(f'Files written: {files_written}')


if __name__ == '__main__':
    main()
