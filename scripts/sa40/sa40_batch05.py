#!/usr/bin/env python3
"""SA40 batch 05 — convert sectorial year-KPIs to quarter from 10-Q MD&A narrative.

Mission: parse 10-Q MD&A narrative text for sectorial KPIs (Backlog, Headcount,
AUM, Comp Sales, Insurance Premiums, Subscribers). When >=4 quarterly values
extracted with stable wording, convert period_type='year' to 'quarter' and
replace history.

JAMAIS INVENTER. Sources only. Stable wording required across filings (no
methodology shifts). _fix_log tag = 'SA40-Claude 2026-06-03'.

Batch 05 audit results:
- EMR Backlog: 21 quarters from "As of <date>, the Company's backlog ... was
  approximately $X billion" — stable wording 2019-2026. APPLY.
- EQT, ESS, EXPE, FAST headcount, FORTUM.HE, GEV RPO, HLI, HSY, HUBB headcount,
  III.L, KHC, LAND.L, LOGN.SW headcount (EU), MO, MPC, MRSH, MSTR, NDA-FI.HE,
  NKE, NWS headcount, NWSA headcount, ORCL, OSK, PHIA.AS headcount (EU), PLD,
  PNR: no sectorial year-KPI in scope OR no stable quarterly narrative.
- GEV RPO: SKIP (methodology shift between 2024 sub-aggregation ~$70B and 2025
  total ~$120-160B — would invent discontinuity).
- US headcount KPIs (EXPD/FAST/HUBB/NWS/NWSA): 10-Qs do not report quarterly
  headcount reliably (typically only annual 10-K).
- EU tickers (LOGN.SW/PHIA.AS/FORTUM.HE/III.L/LAND.L/NDA-FI.HE): no 10-Q.

NE PAS COMMIT (per mission). Dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import OrderedDict

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'


def strip_html(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'&[a-z#0-9]+;', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def extract_emr_backlog():
    """EMR Backlog: 'As of <date>, the Company's backlog ... was approximately $X billion'."""
    files = sorted(glob.glob(os.path.join(SEC10Q, '*', 'EMR_*.htm.gz')))
    results = OrderedDict()  # end_date -> value (Mds $)
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] {fp}: {e}', file=sys.stderr)
            continue
        text = strip_html(html)
        m = re.search(
            r"As of ([A-Z][a-z]+\s+\d+,\s*\d{4}).{0,200}?backlog[^.]{0,200}?was\s+approximately\s+\$\s*([\d.]+)\s*billion",
            text, re.IGNORECASE,
        )
        if m:
            date_str, val_str = m.groups()
            results[date_str.strip()] = float(val_str)
    return results


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def process_emr(apply_mode=False):
    """Convert EMR 'Backlog (ex-AspenTech)' from year to quarter."""
    log = []
    try:
        fp, d = load_pipeline('EMR')
    except FileNotFoundError:
        return ['EMR: MISSING pipeline json']
    extractions = extract_emr_backlog()
    if len(extractions) < 4:
        return [f'EMR: SKIP ({len(extractions)} trims found, <4 required)']
    # newest first
    sorted_items = sorted(extractions.items(), key=lambda x: x[0], reverse=False)
    # Convert dates to ISO YYYY-MM-DD
    import datetime
    def to_iso(s):
        return datetime.datetime.strptime(s, '%B %d, %Y').strftime('%Y-%m-%d')
    iso_items = [(to_iso(d_str), v) for d_str, v in sorted_items]
    iso_items.sort(key=lambda x: x[0])  # oldest first
    history = [round(v, 3) for _d, v in iso_items]
    last_date = iso_items[-1][0]
    # Find the KPI
    changed = False
    for kpi in d.get('kpis', []):
        if kpi.get('short') == 'Backlog (ex-AspenTech)' and kpi.get('period_type') == 'year':
            kpi['period_type'] = 'quarter'
            kpi['history'] = history
            kpi['last_data_date'] = last_date
            entry = f'{FIX_LOG_TAG} {TODAY}: quarter from 10-Q MD&A narrative ({len(history)} trims, sectorial Backlog)'
            fl = kpi.get('_fix_log')
            if fl is None:
                kpi['_fix_log'] = [entry]
            elif isinstance(fl, list):
                fl.append(entry)
            else:
                kpi['_fix_log'] = [fl, entry]
            log.append(f'EMR: CONVERTED Backlog (ex-AspenTech) -> quarter ({len(history)} trims, latest@{last_date}={history[-1]} Mds $)')
            changed = True
            break
    if not changed:
        return ['EMR: KPI "Backlog (ex-AspenTech)" not found or already quarter']
    if apply_mode:
        save_pipeline(fp, d)
        log.append(f'  >> written {fp}')
    else:
        log.append('  >> (dry-run, not written)')
    return log


SKIP_REASONS = {
    'EQT': 'no sectorial year-KPI in scope',
    'ESS': 'no sectorial year-KPI in scope',
    'EXPD': 'Effectif (Headcount) — 10-Q does not report quarterly headcount reliably',
    'EXPE': 'no sectorial year-KPI in scope',
    'FAST': 'Headcount — 10-Q does not report quarterly headcount reliably',
    'FORTUM.HE': 'EU ticker, no 10-Q',
    'GEV': 'RPO methodology shift 2024 (~$70B sub-aggregation) vs 2025 (~$120-160B total) — would invent discontinuity',
    'HLI': 'Employee Compensation Ratio is a %, not sectorial KPI',
    'HSY': 'no sectorial year-KPI in scope',
    'HUBB': 'Effectif total — 10-Q does not report quarterly headcount, hist=0',
    'III.L': 'EU ticker (UK), no 10-Q',
    'KHC': 'no sectorial year-KPI in scope',
    'LAND.L': 'EU ticker (UK REIT), no 10-Q',
    'LOGN.SW': 'EU ticker (CH), no 10-Q',
    'MO': 'no sectorial year-KPI in scope',
    'MPC': 'no sectorial year-KPI in scope',
    'MRSH': 'no sectorial year-KPI in scope',
    'MSTR': 'no sectorial year-KPI in scope',
    'NDA-FI.HE': 'EU ticker (FI), no 10-Q',
    'NKE': 'no sectorial year-KPI in scope',
    'NWS': 'Headcount — 10-Q does not report quarterly headcount',
    'NWSA': 'Headcount — 10-Q does not report quarterly headcount',
    'ORCL': 'no sectorial year-KPI in scope',
    'OSK': 'no sectorial year-KPI in scope',
    'PHIA.AS': 'EU ticker (NL), no 10-Q',
    'PLD': 'Effective interest rate on debt is %, not sectorial KPI (false positive on "effectif" pattern)',
    'PNR': 'no sectorial year-KPI in scope',
}


def main():
    apply_mode = '--apply' in sys.argv
    print(f'=== SA40 batch05 (28 tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped': 0}

    # EMR — only conversion in batch05
    print('\n[EMR]')
    for ln in process_emr(apply_mode=apply_mode):
        print(' ', ln)
        if 'CONVERTED' in ln:
            summary['converted'] += 1

    # Others — explicit skip with reason
    for ticker in [
        'EQT', 'ESS', 'EXPD', 'EXPE', 'FAST', 'FORTUM.HE', 'GEV', 'HLI', 'HSY',
        'HUBB', 'III.L', 'KHC', 'LAND.L', 'LOGN.SW', 'MO', 'MPC', 'MRSH', 'MSTR',
        'NDA-FI.HE', 'NKE', 'NWS', 'NWSA', 'ORCL', 'OSK', 'PHIA.AS', 'PLD', 'PNR',
    ]:
        print(f'\n[{ticker}]')
        print(f'  SKIP: {SKIP_REASONS[ticker]}')
        summary['skipped'] += 1

    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
