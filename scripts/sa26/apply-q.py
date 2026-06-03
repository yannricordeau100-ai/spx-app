#!/usr/bin/env python3
"""
SA26-00 applier — merge per-quarter Revenue/Net Income from /tmp/sa26-<t>-quarters.json
into v2-pipeline/<slug>.json and v2-pipeline-enrich/<slug>.json.

For each KPI matched by SHORT name keyword (Revenue/Net Income/Operating Income/R&D):
  - Take last 20 valid quarters
  - Convert thousands → M or Mds as needed (KPI's existing unit is preserved)
  - Update history[], history_periods[], period_type='quarter', last_data_date
  - Apply 1-999 rule
  - Add _fix_log entry
  - Preserve all other fields (deep merge — only touch listed keys)

Skip rules :
  - KPI marked legitimate annual (Headcount, Reserves, etc.) → no touch
  - No matching quarterly data → preserve existing year history, add note
  - Already quarterly with len ≥ 18 → no touch (already OK)
"""
import json
import sys
from pathlib import Path
from datetime import date

ROOT = Path('/Users/yann/spx-app')
PIPE = ROOT / 'src/data/v2-pipeline'
ENRICH = ROOT / 'src/data/v2-pipeline-enrich'

# Map ticker → slug
TICKER_SLUG = {
    '1COV.DE': '1cov.de', 'ALL': 'all', 'AXON': 'axon', 'BR': 'br',
    'CHKP': 'chkp', 'CRWV': 'crwv', 'DLTR': 'dltr', 'EQT': 'eqt',
    'FRES.L': 'fres.l', 'HD': 'hd', 'IR': 'ir', 'LAND.L': 'land.l',
    'MDT': 'mdt', 'NEE': 'nee', 'ON': 'on', 'POWL': 'powl',
    'SAP': 'sap', 'SW': 'sw', 'TTWO': 'ttwo', 'VTRS': 'vtrs',
}

# Per-ticker mapping of KPI matching: extract_key → list of (lowercase keyword to match KPI short/name_en)
KPI_MATCHES = {
    'revenue': ['revenue', 'total revenue', 'net sales', 'sales', 'total net sales'],
    'net_income': ['net income', 'net earnings', 'résultat net'],
    'operating_income': ['operating income', 'op income', 'income from operations', 'operating profit'],
    'rd_expense': ['r&d', 'research'],
}

LEGITIMATE_ANNUAL = ['headcount', 'tam', 'reserves', 'aum', 'solvency', 'customer count',
                     'operating locations', 'employees', 'stores', 'pipeline infrastructure',
                     'proved reserves', 'power capacity', 'gpu actifs', 'capacité contractée']


def convert_unit(value_thousands, target_unit):
    """Convert raw SEC value (in thousands) to target unit (M or Mds)."""
    if value_thousands is None:
        return None
    v_millions = value_thousands / 1000.0
    target = target_unit or ''
    target_low = target.lower()
    if 'mds' in target_low or 'b ' in target_low or 'bn' in target_low:
        return round(v_millions / 1000.0, 3)
    elif 'm' in target_low:
        return round(v_millions, 2)
    else:
        # Default = M
        return round(v_millions, 2)


def apply_1_999_rule(value, unit):
    """If value ≥ 1000 with M unit → switch to Mds. If < 1 with Mds → M."""
    if value is None or unit is None:
        return value, unit
    if '%' in unit or 'pts' in unit or '$/' in unit or 'x' == unit.lower():
        return value, unit
    if 'mds' in unit.lower() and abs(value) < 1.0 and abs(value) > 0:
        # to M
        new_unit = unit.replace('Mds', 'M').replace('mds', 'M')
        return round(value * 1000, 2), new_unit
    if unit.lower().startswith('m ') or unit.lower() == 'm' or unit.lower().endswith(' m') or unit.startswith('M '):
        if abs(value) >= 1000:
            new_unit = unit.replace('M ', 'Mds ').replace(' M', ' Mds')
            if new_unit == unit:
                new_unit = 'Mds ' + unit[2:] if unit.startswith('M ') else unit
            return round(value / 1000, 3), new_unit
    return value, unit


def get_last_n_valid(records, key, n=20):
    """Return last N records where records[i][key] is a number (not None)."""
    valid = [r for r in records if r.get(key) is not None]
    return valid[-n:]


def is_legitimate_annual(short, name_en):
    s = (short or '').lower()
    n = (name_en or '').lower()
    return any(kw in s or kw in n for kw in LEGITIMATE_ANNUAL)


def find_kpi_extract_key(short, name_en):
    """Map a KPI's short name to the extractor key, or None if no match."""
    s = (short or '').lower()
    n = (name_en or '').lower()
    # Priority: more specific first
    if 'r&d' in s or 'research' in s or 'r&d' in n or 'research and development' in n:
        return 'rd_expense'
    if 'operating income' in s or 'operating income' in n or 'income from operations' in n or 'op income' in s:
        return 'operating_income'
    if 'net income' in s or 'net income' in n or 'net earnings' in n or 'net income' in s:
        return 'net_income'
    if 'net income' in (short or '').lower():
        return 'net_income'
    # Revenue match: avoid segment-specific revenues
    if s in ('revenue', 'total revenue', 'net sales', 'sales') or n in ('total revenue', 'net sales', 'revenue', 'revenues'):
        return 'revenue'
    return None


def update_kpi(kpi, quarter_records, fix_log_entry):
    """Update a single KPI dict in place. Returns 'updated'/'skipped-legit-annual'/'skipped-no-data'/'skipped-already-q'."""
    short = kpi.get('short') or ''
    name_en = kpi.get('name_en') or ''

    if is_legitimate_annual(short, name_en):
        return 'skipped-legit-annual'

    key = find_kpi_extract_key(short, name_en)
    if not key:
        return 'skipped-no-match'

    valid = get_last_n_valid(quarter_records, key, n=20)
    if len(valid) < 4:
        return 'skipped-insufficient-data'

    # Don't override if already quarterly with ≥ 18 quarters of history
    if kpi.get('period_type') == 'quarter' and len(kpi.get('history') or []) >= 18:
        return 'skipped-already-q'

    unit = kpi.get('unit') or 'M $'
    new_history = []
    new_periods = []
    for r in valid:
        v_raw = r[key]
        v_conv = convert_unit(v_raw, unit)
        new_history.append(v_conv)
        new_periods.append(r['_quarter'])

    # Apply 1-999 rule based on max abs value
    max_abs = max(abs(v) for v in new_history if v is not None)
    if max_abs >= 1000 and ('M' in unit and 'Mds' not in unit and '%' not in unit and '$/' not in unit):
        new_history = [round(v / 1000, 3) if v is not None else None for v in new_history]
        unit = unit.replace('M ', 'Mds ', 1) if 'M ' in unit else 'Mds ' + unit
    elif max_abs < 1.0 and 'Mds' in unit and max_abs > 0:
        new_history = [round(v * 1000, 2) if v is not None else None for v in new_history]
        unit = unit.replace('Mds ', 'M ', 1)

    kpi['history'] = new_history
    kpi['history_periods'] = new_periods
    kpi['period_type'] = 'quarter'
    kpi['unit'] = unit
    # last_data_date from last record
    last_rec = valid[-1]
    pe = last_rec.get('_period_end') or ''
    if pe and ',' in pe:
        # "September 30, 2025" → 2025-09-30
        import re
        m = re.match(r'([A-Za-z]+) (\d+),\s*(\d{4})', pe)
        if m:
            month_map = {'JANUARY':1,'FEBRUARY':2,'MARCH':3,'APRIL':4,'MAY':5,'JUNE':6,
                         'JULY':7,'AUGUST':8,'SEPTEMBER':9,'OCTOBER':10,'NOVEMBER':11,'DECEMBER':12}
            mo = month_map.get(m.group(1).upper(), 12)
            kpi['last_data_date'] = f"{m.group(3)}-{mo:02d}-{int(m.group(2)):02d}"
    # Update value to most recent quarter
    kpi['value'] = new_history[-1]
    # Add fix log
    log = kpi.get('_fix_log') or []
    log.append(fix_log_entry)
    kpi['_fix_log'] = log
    return 'updated'


def process_ticker(ticker):
    slug = TICKER_SLUG.get(ticker)
    if not slug:
        return {'ticker': ticker, 'status': 'no-slug'}

    quarters_path = Path(f'/tmp/sa26-{ticker.lower()}-quarters.json')
    if not quarters_path.exists():
        return {'ticker': ticker, 'status': 'no-quarters-data', 'reason': 'no SEC HTML available'}
    quarter_records = json.loads(quarters_path.read_text())

    results = {'ticker': ticker, 'kpi_results': {}, 'files_touched': []}
    fix_entry = 'SA26-00 quarterly conversion 10-Q Claude direct'

    for label, filedir in [('pipeline', PIPE), ('enrich', ENRICH)]:
        f = filedir / f'{slug}.json'
        if not f.exists():
            continue
        try:
            data = json.loads(f.read_text())
        except Exception as e:
            results.setdefault('errors', []).append(f"{label}: {e}")
            continue
        kpis = data.get('kpis') or []
        any_updated = False
        for kpi in kpis:
            status = update_kpi(kpi, quarter_records, fix_entry)
            key = kpi.get('short', '?')
            results['kpi_results'].setdefault(label, {})[key] = status
            if status == 'updated':
                any_updated = True
        if any_updated:
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
            results['files_touched'].append(str(f))
    return results


def main():
    tickers = ['1COV.DE', 'ALL', 'AXON', 'BR', 'CHKP', 'CRWV', 'DLTR', 'EQT', 'FRES.L',
               'HD', 'IR', 'LAND.L', 'MDT', 'NEE', 'ON', 'POWL', 'SAP', 'SW', 'TTWO', 'VTRS']
    if len(sys.argv) > 1:
        tickers = sys.argv[1:]

    all_results = []
    for t in tickers:
        r = process_ticker(t)
        all_results.append(r)
        print(f"\n=== {t} ===")
        if r.get('status'):
            print(f"  STATUS: {r['status']} ({r.get('reason', '')})")
        else:
            for label, kr in r.get('kpi_results', {}).items():
                print(f"  [{label}]")
                for k, s in kr.items():
                    print(f"    {k}: {s}")
            print(f"  files touched: {len(r.get('files_touched', []))}")

    # Tally
    total_updated = sum(1 for r in all_results for label, kr in r.get('kpi_results', {}).items() for s in kr.values() if s == 'updated')
    total_skip_annual = sum(1 for r in all_results for label, kr in r.get('kpi_results', {}).items() for s in kr.values() if s == 'skipped-legit-annual')
    total_skip_nodata = sum(1 for r in all_results for label, kr in r.get('kpi_results', {}).items() for s in kr.values() if s == 'skipped-insufficient-data')
    total_skip_nomatch = sum(1 for r in all_results for label, kr in r.get('kpi_results', {}).items() for s in kr.values() if s == 'skipped-no-match')
    total_already_q = sum(1 for r in all_results for label, kr in r.get('kpi_results', {}).items() for s in kr.values() if s == 'skipped-already-q')
    total_no_data = sum(1 for r in all_results if r.get('status') == 'no-quarters-data')
    print(f"\n=== TALLY ===")
    print(f"KPIs updated to quarterly: {total_updated}")
    print(f"KPIs skipped (legit annual): {total_skip_annual}")
    print(f"KPIs skipped (insufficient SEC data): {total_skip_nodata}")
    print(f"KPIs skipped (no extractor match): {total_skip_nomatch}")
    print(f"KPIs skipped (already quarterly ≥18): {total_already_q}")
    print(f"Tickers without SEC data: {total_no_data}")

    # Save summary
    Path('/tmp/sa26-00-summary.json').write_text(json.dumps(all_results, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
