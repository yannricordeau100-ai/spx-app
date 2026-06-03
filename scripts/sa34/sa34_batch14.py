#!/usr/bin/env python3
"""SA34 batch 14 US — parse 10-Q HTM (inline XBRL) for quarterly data.

For each US ticker in batch14.txt:
- Open ~/spx-app/src/data/v2-pipeline/<lowercase>.json
- Find KPIs with period_type='year' that map to known XBRL concepts
- Parse all 10-Q .htm.gz files in ~/Mettrik/sec-data/cat1-us/10Q/{2023..2026}/<TICKER>_*.htm.gz
- Build quarterly history (>= 4 trims required to convert)
- Update kpi: period_type='quarter', history=quarterly_list, _fix_log adds entry
- NEVER invent. If insufficient data, leave KPI unchanged.

Run mode: dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
BATCH = '/tmp/sa34-batches/batch14.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA34-Claude'

# Map normalized KPI short -> {concepts:[list of XBRL us-gaap tags], type, [unit_hint], [ratio_denom]}
# type='instant' (balance sheet point-in-time) | 'duration' (single-Q flow) | 'ratio_pct' (compute %)
KPI_MAP = {
    # Balance sheet (instant)
    'Total Assets': {'concepts': ['Assets'], 'type': 'instant'},
    'Cash & Equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue'], 'type': 'instant'},
    'Cash and cash equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue'], 'type': 'instant'},
    'PFS Total Assets': {'concepts': ['Assets'], 'type': 'instant'},
    # Debt (instant)
    'Total Debt': {'concepts': ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtLongtermAndShorttermCombinedAmount'], 'type': 'instant'},
    # Income statement (duration, must be single-Q)
    'R&D': {'concepts': ['ResearchAndDevelopmentExpense'], 'type': 'duration'},
    'R&D Investments': {'concepts': ['ResearchAndDevelopmentExpense'], 'type': 'duration'},
    'Operating Expenses': {'concepts': ['OperatingExpenses'], 'type': 'duration'},
    'Restructuring Charges': {'concepts': ['RestructuringCharges'], 'type': 'duration'},
    'Goodwill impairment loss': {'concepts': ['GoodwillImpairmentLoss'], 'type': 'duration'},
    'Steel Mills Earnings': {'concepts': ['OperatingIncomeLoss'], 'type': 'duration'},  # segment-specific, skip if has_segment
    # Ratios computed (numerator / denominator * 100)
    'Gross Margin': {'concepts': ['GrossProfit'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'Marge brute': {'concepts': ['GrossProfit'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'Op Margin': {'concepts': ['OperatingIncomeLoss'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'Operating Margin': {'concepts': ['OperatingIncomeLoss'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'Operating_margin': {'concepts': ['OperatingIncomeLoss'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'R&D %': {'concepts': ['ResearchAndDevelopmentExpense'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    'R&D as % Revenue': {'concepts': ['ResearchAndDevelopmentExpense'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'ratio_pct'},
    # Dividend per share (instant declaration)
    'DPS': {'concepts': ['CommonStockDividendsPerShareDeclared'], 'type': 'instant'},
}

NUMRE = re.compile(r'<ix:nonFraction\b([^>]*)>([^<]*)</ix:nonFraction>', re.IGNORECASE | re.DOTALL)
ATTRRE = re.compile(r'(\w+(?:[-:]\w+)?)\s*=\s*"([^"]*)"')
CONTEXT_RE = re.compile(r'<(?:xbrli:)?context\s+id="([^"]+)"[^>]*>(.*?)</(?:xbrli:)?context>', re.DOTALL | re.IGNORECASE)
PERIOD_RE = re.compile(r'<(?:xbrli:)?period>(.*?)</(?:xbrli:)?period>', re.DOTALL | re.IGNORECASE)
INSTANT_RE = re.compile(r'<(?:xbrli:)?instant>([0-9\-]+)</(?:xbrli:)?instant>', re.IGNORECASE)
START_RE = re.compile(r'<(?:xbrli:)?startDate>([0-9\-]+)</(?:xbrli:)?startDate>', re.IGNORECASE)
END_RE = re.compile(r'<(?:xbrli:)?endDate>([0-9\-]+)</(?:xbrli:)?endDate>', re.IGNORECASE)
SEGMENT_RE = re.compile(r'<(?:xbrli:)?segment>', re.IGNORECASE)


def parse_contexts(html):
    """Return {ctx_id: {'instant': YYYY-MM-DD} or {'start':..., 'end':...}, 'has_segment': bool}"""
    contexts = {}
    for m in CONTEXT_RE.finditer(html):
        cid = m.group(1)
        body = m.group(2)
        has_seg = bool(SEGMENT_RE.search(body))
        pm = PERIOD_RE.search(body)
        if not pm:
            continue
        period_body = pm.group(1)
        inst = INSTANT_RE.search(period_body)
        if inst:
            contexts[cid] = {'instant': inst.group(1), 'has_segment': has_seg}
        else:
            sm = START_RE.search(period_body)
            em = END_RE.search(period_body)
            if sm and em:
                contexts[cid] = {'start': sm.group(1), 'end': em.group(1), 'has_segment': has_seg}
    return contexts


def parse_facts(html, contexts, concept_locals):
    """Yield (concept_local, value_float, ctx_dict, decimals, unitref, scale)."""
    wanted = set(concept_locals)
    for m in NUMRE.finditer(html):
        attrs_str = m.group(1)
        raw_val = m.group(2).strip().replace(',', '')
        attrs = dict(ATTRRE.findall(attrs_str))
        name = attrs.get('name', '')
        if ':' not in name:
            continue
        prefix, local = name.split(':', 1)
        if prefix not in ('us-gaap',):
            continue
        if local not in wanted:
            continue
        ctxref = attrs.get('contextRef')
        ctx = contexts.get(ctxref)
        if not ctx:
            continue
        if ctx.get('has_segment'):
            continue
        try:
            val = float(raw_val) if raw_val not in ('', '-', '—') else None
        except ValueError:
            continue
        if val is None:
            continue
        scale = int(attrs.get('scale', '0') or '0')
        sign = attrs.get('sign', '')
        if sign == '-':
            val = -val
        if scale:
            val = val * (10 ** scale)
        decimals = attrs.get('decimals', '')
        unitref = attrs.get('unitRef', '')
        yield (local, val, ctx, decimals, unitref, scale)


def is_quarter_duration(start, end):
    try:
        sd = datetime.strptime(start, '%Y-%m-%d')
        ed = datetime.strptime(end, '%Y-%m-%d')
    except ValueError:
        return False
    days = (ed - sd).days
    return 80 <= days <= 100


def collect_ticker_facts(ticker):
    files = []
    for year in ('2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    facts_instant = defaultdict(dict)
    facts_duration = defaultdict(dict)
    # Aggregate ALL concepts needed (numerator + denominator)
    concepts_needed = set()
    for kmap in KPI_MAP.values():
        for c in kmap['concepts']:
            concepts_needed.add(c)
        for c in kmap.get('denom', []):
            concepts_needed.add(c)
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        contexts = parse_contexts(html)
        for local, val, ctx, decimals, unitref, scale in parse_facts(html, contexts, concepts_needed):
            if 'instant' in ctx:
                d = ctx['instant']
                facts_instant[local][d] = val
            else:
                start = ctx.get('start')
                end = ctx.get('end')
                if start and end and is_quarter_duration(start, end):
                    facts_duration[local][end] = val
    return facts_instant, facts_duration


def build_quarterly_series(facts_by_date, max_count=20):
    items = sorted(facts_by_date.items(), key=lambda x: x[0], reverse=True)
    return items[:max_count]


def scale_value(short, val, unit):
    u = (unit or '').lower()
    if short == 'DPS':
        return val
    if 'mds' in u or 'bn' in u or 'b$' in u or 'b €' in u:
        return val / 1e9
    if u.startswith('m ') or u == 'm$' or u == 'm€' or 'million' in u:
        return val / 1e6
    return val / 1e6


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
        return ['MISSING pipeline json']
    year_kpis = [k for k in d.get('kpis', []) if k.get('period_type') == 'year']
    if not year_kpis:
        return ['no year-KPIs']
    facts_inst, facts_dur = collect_ticker_facts(ticker.upper())
    changed = False
    for kpi in year_kpis:
        short = kpi.get('short')
        if short not in KPI_MAP:
            log_lines.append(f'  - {short}: SKIP (no XBRL mapping)')
            continue
        kmap = KPI_MAP[short]
        ktype = kmap['type']
        picked = None
        if ktype in ('instant', 'duration'):
            for c in kmap['concepts']:
                store = facts_inst if ktype == 'instant' else facts_dur
                series = build_quarterly_series(store.get(c, {}))
                if len(series) >= 4:
                    picked = (c, series, None)
                    break
        elif ktype == 'ratio_pct':
            # numerator and denominator must share end_date (both duration)
            for num_c in kmap['concepts']:
                num_store = facts_dur.get(num_c, {})
                if not num_store:
                    continue
                for den_c in kmap['denom']:
                    den_store = facts_dur.get(den_c, {})
                    if not den_store:
                        continue
                    common = sorted(set(num_store.keys()) & set(den_store.keys()), reverse=True)
                    if len(common) < 4:
                        continue
                    series = []
                    for ed in common[:20]:
                        n = num_store[ed]
                        dv = den_store[ed]
                        if dv == 0:
                            continue
                        pct = (n / dv) * 100.0
                        series.append((ed, pct))
                    if len(series) >= 4:
                        picked = (f'{num_c}/{den_c}', series, 'ratio')
                        break
                if picked:
                    break
        if not picked:
            log_lines.append(f'  - {short}: SKIP (< 4 trims found)')
            continue
        concept, series, mode = picked
        unit = kpi.get('unit')
        # series is newest-first; reverse to oldest-first to match existing convention
        series_asc = list(reversed(series))
        if mode == 'ratio':
            vals = [round(v, 4) for _d, v in series_asc]
        else:
            vals = [round(scale_value(short, v, unit), 6) for _d, v in series_asc]
        kpi['period_type'] = 'quarter'
        kpi['history'] = vals
        kpi['last_data_date'] = series_asc[-1][0]
        kpi['value'] = vals[-1]
        # Same-Q YoY if >= 5 trims
        if len(vals) >= 5 and vals[-5] not in (0, None):
            pct = (vals[-1] - vals[-5]) / abs(vals[-5]) * 100
            kpi['yoy'] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
        entry = f'{FIX_LOG_TAG} {TODAY}: quarterly from 10-Q us-gaap/{concept} ({len(vals)} trims)'
        fl = kpi.get('_fix_log')
        if fl is None:
            kpi['_fix_log'] = [entry]
        elif isinstance(fl, list):
            fl.append(entry)
        else:
            kpi['_fix_log'] = [fl, entry]
        kpi['_sa34_source_tag'] = f'us-gaap/{concept}'
        log_lines.append(f'  + {short}: CONVERTED via {concept} ({len(vals)} trims), latest@{series_asc[-1][0]}={vals[-1]}')
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
    print(f'=== SA34 batch14 US ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped': 0, 'unmapped': 0, 'no_year': 0, 'missing': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'SKIP (< 4' in ln:
                summary['skipped'] += 1
            elif 'SKIP (no XBRL' in ln:
                summary['unmapped'] += 1
            elif ln == 'no year-KPIs':
                summary['no_year'] += 1
            elif ln == 'MISSING pipeline json':
                summary['missing'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
