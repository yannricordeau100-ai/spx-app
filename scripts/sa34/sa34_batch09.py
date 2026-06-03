#!/usr/bin/env python3
"""SA34 batch 09 US - parse 10-Q HTM (inline XBRL) for quarterly data.

Mission:
- Read /tmp/sa34-batches/batch09.txt (31 US tickers)
- For each, open ~/spx-app/src/data/v2-pipeline/<lower>.json
- Find KPIs with period_type='year' mapped to known XBRL concepts
- Parse all 10-Q files in ~/Mettrik/sec-data/cat1-us/10Q/{2023..2026}/<TICKER>_*.htm.gz
- Build quarterly history (>=4 trims required to convert)
- Update KPI: period_type='quarter', history=quarterly_list, _fix_log entry
- NEVER invent. If insufficient data, leave KPI unchanged.

Run: dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
BATCH = '/tmp/sa34-batches/batch09.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA34-Claude'

# Map normalized KPI short -> list of XBRL concept candidates (us-gaap local names),
# and aggregation type: 'instant' (balance sheet point-in-time), 'duration' (single-Q flow),
# 'ratio_qq' (derived ratio per quarter), 'fy_only' (annual only, skip).
KPI_MAP = {
    # Balance sheet (instant)
    'Total Assets': {'concepts': ['Assets'], 'type': 'instant'},
    'Total Debt': {'concepts': ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtLongtermAndShorttermCombinedAmount'], 'type': 'instant'},
    'Cash & Equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue'], 'type': 'instant'},
    'Cash and cash equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue'], 'type': 'instant'},

    # Duration single-Q
    'R&D': {'concepts': ['ResearchAndDevelopmentExpense'], 'type': 'duration'},
    'Free Cash Flow': {'concepts': [], 'type': 'fcf_derived'},  # OCF - Capex
    'Cash provided from operations': {'concepts': ['NetCashProvidedByUsedInOperatingActivities'], 'type': 'duration'},
    'Op Cash Flow': {'concepts': ['NetCashProvidedByUsedInOperatingActivities'], 'type': 'duration'},
    'Bénéfice net': {'concepts': ['NetIncomeLoss'], 'type': 'duration'},
    'Bénéfice net actionnaires': {'concepts': ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'], 'type': 'duration'},
    'Net Earnings': {'concepts': ['NetIncomeLoss'], 'type': 'duration'},
    'Adjusted EBITDA': {'concepts': [], 'type': 'skip'},  # non-GAAP, not in XBRL standard
    'Restructuring Costs': {'concepts': ['RestructuringCharges'], 'type': 'duration'},
    'Restructuring & Other Charges': {'concepts': ['RestructuringCharges'], 'type': 'duration'},
    'Capital Expenditures': {'concepts': ['PaymentsToAcquirePropertyPlantAndEquipment'], 'type': 'duration'},

    # Ratios derived (Margin = num/denom per Q)
    'Gross Margin': {'concepts': [], 'type': 'ratio_qq', 'num': ['GrossProfit'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']},
    'Op Margin': {'concepts': [], 'type': 'ratio_qq', 'num': ['OperatingIncomeLoss'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']},
    'Operating Margin': {'concepts': [], 'type': 'ratio_qq', 'num': ['OperatingIncomeLoss'], 'denom': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']},

    # DPS (instant, declared)
    'DPS': {'concepts': ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'], 'type': 'instant'},
}

# KPIs requiring at least 4 trims to convert
MIN_TRIMS = 4

NUMRE = re.compile(r'<ix:nonFraction\b([^>]*)>([^<]*)</ix:nonFraction>', re.IGNORECASE | re.DOTALL)
ATTRRE = re.compile(r'(\w+(?:[-:]\w+)?)\s*=\s*"([^"]*)"')
CONTEXT_RE = re.compile(r'<(?:xbrli:)?context\s+id="([^"]+)"[^>]*>(.*?)</(?:xbrli:)?context>', re.DOTALL | re.IGNORECASE)
PERIOD_RE = re.compile(r'<(?:xbrli:)?period>(.*?)</(?:xbrli:)?period>', re.DOTALL | re.IGNORECASE)
INSTANT_RE = re.compile(r'<(?:xbrli:)?instant>([0-9\-]+)</(?:xbrli:)?instant>', re.IGNORECASE)
START_RE = re.compile(r'<(?:xbrli:)?startDate>([0-9\-]+)</(?:xbrli:)?startDate>', re.IGNORECASE)
END_RE = re.compile(r'<(?:xbrli:)?endDate>([0-9\-]+)</(?:xbrli:)?endDate>', re.IGNORECASE)
SEGMENT_RE = re.compile(r'<(?:xbrli:)?segment>', re.IGNORECASE)


def parse_contexts(html):
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


def is_ytd_duration(start, end):
    """YTD durations: ~6 mo (180d) or ~9 mo (270d)."""
    try:
        sd = datetime.strptime(start, '%Y-%m-%d')
        ed = datetime.strptime(end, '%Y-%m-%d')
    except ValueError:
        return False, 0
    days = (ed - sd).days
    if 170 <= days <= 195:
        return True, 2  # H1 = Q1+Q2
    if 260 <= days <= 285:
        return True, 3  # 9M = Q1+Q2+Q3
    return False, 0


def collect_ticker_facts(ticker):
    files = []
    for year in ('2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    facts_instant = defaultdict(dict)
    facts_duration = defaultdict(dict)  # concept -> {end_date: (val, span_days)}

    # Collect all concepts we may need
    all_concepts = set()
    for kmap in KPI_MAP.values():
        for c in kmap.get('concepts', []):
            all_concepts.add(c)
        for c in kmap.get('num', []):
            all_concepts.add(c)
        for c in kmap.get('denom', []):
            all_concepts.add(c)
    # Also need OCF + Capex for FCF derived
    all_concepts.add('NetCashProvidedByUsedInOperatingActivities')
    all_concepts.add('PaymentsToAcquirePropertyPlantAndEquipment')

    # For YTD reconstitution: keep all duration data + span
    duration_all = defaultdict(dict)  # concept -> {end: {'span':days, 'val':v}}

    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        contexts = parse_contexts(html)
        for local, val, ctx, decimals, unitref, scale in parse_facts(html, contexts, all_concepts):
            if 'instant' in ctx:
                d = ctx['instant']
                facts_instant[local][d] = val
            else:
                start = ctx.get('start')
                end = ctx.get('end')
                if start and end:
                    try:
                        sd = datetime.strptime(start, '%Y-%m-%d')
                        ed = datetime.strptime(end, '%Y-%m-%d')
                        days = (ed - sd).days
                    except ValueError:
                        continue
                    # Prefer single-quarter when available
                    if is_quarter_duration(start, end):
                        facts_duration[local][end] = val
                    # Also store all durations for YTD->Q derivation
                    if end not in duration_all[local] or days < duration_all[local][end]['span']:
                        duration_all[local][end] = {'span': days, 'val': val, 'start': start}

    # YTD reconstitution: for concepts where we have YTD H1 / 9M but missing Q2 / Q3
    for concept, by_end in duration_all.items():
        # Sort by end date
        items = sorted(by_end.items())  # [(end, {span,val,start})]
        # Build per fiscal year groupings using start-month
        # For each end with span 170-195 (H1), derive Q2 = H1 - Q1 where Q1 has same start
        for end, info in items:
            span = info['span']
            if span < 80:
                continue
            start = info['start']
            if 80 <= span <= 100:
                # Single Q already
                if end not in facts_duration[concept]:
                    facts_duration[concept][end] = info['val']
                continue
            # YTD: try to find Q1 with same start
            for other_end, other_info in items:
                if other_info['start'] != start:
                    continue
                if other_end >= end:
                    continue
                other_span = other_info['span']
                # If we found a shorter YTD before, subtract
                if 80 <= other_span <= 100 and 170 <= span <= 195:
                    # H1 - Q1 = Q2
                    derived = info['val'] - other_info['val']
                    if end not in facts_duration[concept]:
                        facts_duration[concept][end] = derived
                elif 170 <= other_span <= 195 and 260 <= span <= 285:
                    # 9M - H1 = Q3
                    derived = info['val'] - other_info['val']
                    if end not in facts_duration[concept]:
                        facts_duration[concept][end] = derived

    return facts_instant, facts_duration


def build_series(facts_by_date, max_count=20):
    items = sorted(facts_by_date.items(), key=lambda x: x[0], reverse=True)
    return items[:max_count]


def scale_value(short, val, unit):
    u = (unit or '').lower()
    if short == 'DPS':
        return val
    # Check for currency units
    if 'mds' in u or u in ('b $', 'b€', 'b $', 'b'):
        return val / 1e9
    if u.startswith('m ') or u in ('m$', 'm€', 'm $', 'm') or 'million' in u:
        return val / 1e6
    # default: assume Mds
    return val / 1e9


def is_ratio_kpi(short):
    return short in ('Gross Margin', 'Op Margin', 'Operating Margin')


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
        kt = kmap['type']
        unit = kpi.get('unit')

        if kt == 'skip':
            log_lines.append(f'  - {short}: SKIP (non-GAAP)')
            continue

        if kt == 'ratio_qq':
            # Derive ratio per Q: num[end] / denom[end]
            num_concepts = kmap['num']
            denom_concepts = kmap['denom']
            num_series = {}
            denom_series = {}
            for c in num_concepts:
                if facts_dur.get(c):
                    num_series = facts_dur[c]
                    break
            for c in denom_concepts:
                if facts_dur.get(c):
                    denom_series = facts_dur[c]
                    break
            if not num_series or not denom_series:
                log_lines.append(f'  - {short}: SKIP (missing num/denom)')
                continue
            common_ends = sorted(set(num_series.keys()) & set(denom_series.keys()), reverse=True)
            if len(common_ends) < MIN_TRIMS:
                log_lines.append(f'  - {short}: SKIP (< {MIN_TRIMS} trims for ratio, found {len(common_ends)})')
                continue
            vals = []
            for end in common_ends[:20]:
                num = num_series[end]
                denom = denom_series[end]
                if denom == 0:
                    continue
                pct = round((num / denom) * 100, 2)
                vals.append((end, pct))
            if len(vals) < MIN_TRIMS:
                log_lines.append(f'  - {short}: SKIP (< {MIN_TRIMS} valid ratios)')
                continue
            history_vals = [v for _e, v in vals]
            kpi['period_type'] = 'quarter'
            kpi['history'] = history_vals
            kpi['last_data_date'] = vals[0][0]
            entry = f'{FIX_LOG_TAG} {TODAY}: quarterly ratio (GrossProfit or OpIncome / Revenue) ({len(history_vals)} trims)'
            fl = kpi.get('_fix_log')
            if fl is None:
                kpi['_fix_log'] = [entry]
            elif isinstance(fl, list):
                fl.append(entry)
            else:
                kpi['_fix_log'] = [fl, entry]
            log_lines.append(f'  + {short}: CONVERTED ratio ({len(history_vals)} trims), latest@{vals[0][0]}={history_vals[0]}%')
            changed = True
            continue

        if kt == 'fcf_derived':
            ocf = facts_dur.get('NetCashProvidedByUsedInOperatingActivities', {})
            capex = facts_dur.get('PaymentsToAcquirePropertyPlantAndEquipment', {})
            common_ends = sorted(set(ocf.keys()) & set(capex.keys()), reverse=True)
            if len(common_ends) < MIN_TRIMS:
                log_lines.append(f'  - {short}: SKIP (< {MIN_TRIMS} trims OCF+Capex, found {len(common_ends)})')
                continue
            vals = [(end, ocf[end] - capex[end]) for end in common_ends[:20]]
            history_vals = [round(scale_value(short, v, unit), 4) for _e, v in vals]
            kpi['period_type'] = 'quarter'
            kpi['history'] = history_vals
            kpi['last_data_date'] = vals[0][0]
            entry = f'{FIX_LOG_TAG} {TODAY}: quarterly FCF derived (OCF - Capex) ({len(history_vals)} trims)'
            fl = kpi.get('_fix_log')
            if fl is None:
                kpi['_fix_log'] = [entry]
            elif isinstance(fl, list):
                fl.append(entry)
            else:
                kpi['_fix_log'] = [fl, entry]
            log_lines.append(f'  + {short}: CONVERTED FCF ({len(history_vals)} trims), latest@{vals[0][0]}={history_vals[0]}')
            changed = True
            continue

        # Standard instant or duration
        picked = None
        for c in kmap['concepts']:
            store = facts_inst if kt == 'instant' else facts_dur
            series = build_series(store.get(c, {}))
            if len(series) >= MIN_TRIMS:
                picked = (c, series)
                break
        if not picked:
            log_lines.append(f'  - {short}: SKIP (< {MIN_TRIMS} trims found)')
            continue
        concept, series = picked
        vals = [round(scale_value(short, v, unit), 4) for _d, v in series]
        kpi['period_type'] = 'quarter'
        kpi['history'] = vals
        kpi['last_data_date'] = series[0][0]
        entry = f'{FIX_LOG_TAG} {TODAY}: quarterly from 10-Q us-gaap/{concept} ({len(vals)} trims)'
        fl = kpi.get('_fix_log')
        if fl is None:
            kpi['_fix_log'] = [entry]
        elif isinstance(fl, list):
            fl.append(entry)
        else:
            kpi['_fix_log'] = [fl, entry]
        log_lines.append(f'  + {short}: CONVERTED via {concept} ({len(vals)} trims), latest@{series[0][0]}={vals[0]}')
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
    print(f'=== SA34 batch09 US ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped': 0, 'unmapped': 0, 'skip_nongaap': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'SKIP (< ' in ln:
                summary['skipped'] += 1
            elif 'SKIP (no XBRL' in ln:
                summary['unmapped'] += 1
            elif 'SKIP (non-GAAP' in ln:
                summary['skip_nongaap'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
