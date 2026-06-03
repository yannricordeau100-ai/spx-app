#!/usr/bin/env python3
"""SA36 batch 01 — parse 10-Q HTM (inline XBRL) for US tickers, EU annual/semi for EU.

US tickers (no suffix, in /Mettrik/sec-data/cat1-us/10Q/{2023..2026}/<TICKER>_*.htm.gz):
  convert period_type='year' KPIs to 'quarter' from 10-Q .htm.gz when
  ≥4 quarterly periods extractable via expanded XBRL whitelist + text mining
  "Three months ended".

EU tickers (cat3-european/<TICKER>/{half-year,annual-text,ad-hoc,interim,quarterly}/):
  Need ≥4 half-year or quarterly periods → set period_type='semester' or 'quarter'.
  If only annual-text → SKIP.

Whitelist XBRL élargie: Assets, Cash, Debt, Revenues, NetIncome, OpIncome, OCF, RD,
SGA, COGS, GrossProfit, EPS, DPS, Equity, Inventory, Goodwill, Capex, segments.

NEVER invent. _fix_log tag = "SA36-Claude 2026-06-03".
Dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
EU_BASE = os.path.join(ROOT, 'Mettrik/sec-data/cat3-european')
BATCH = '/tmp/sa36-batches/batch01.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA36-Claude'

# EU/.suffix tickers from batch01 (no 10-Q in cat1-us)
# Note: BP and ASML have both ADR/local listings; we treat as EU when they live in cat3-european/
EU_TICKERS = {
    'PRY.MI', 'ROG.SW', 'ADTTF', 'BA.L', 'BARC.L', 'NOKIA.HE', 'SHL.DE',
    'ISP.MI', 'ASML', 'ATCO-A.ST', 'BP', 'KOG.OL', 'SOON.SW', 'PBR',
}

# Whitelist XBRL élargie (us-gaap concept locals → KPI short candidates)
# Map normalized KPI 'short' → list of XBRL us-gaap concept candidates + agg type:
# 'instant' = balance sheet point-in-time
# 'duration' = single-Q flow
KPI_MAP = {
    # Balance sheet (instant)
    'Total Assets': {'concepts': ['Assets'], 'type': 'instant'},
    'Assets': {'concepts': ['Assets'], 'type': 'instant'},
    'Cash & Equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue', 'Cash'], 'type': 'instant'},
    'Cash and cash equivalents': {'concepts': ['CashAndCashEquivalentsAtCarryingValue', 'Cash'], 'type': 'instant'},
    'Cash': {'concepts': ['CashAndCashEquivalentsAtCarryingValue', 'Cash'], 'type': 'instant'},
    'Total Debt': {'concepts': ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtLongtermAndShorttermCombinedAmount'], 'type': 'instant'},
    'Long-Term Debt': {'concepts': ['LongTermDebtNoncurrent', 'LongTermDebt'], 'type': 'instant'},
    'Equity': {'concepts': ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], 'type': 'instant'},
    'Stockholders Equity': {'concepts': ['StockholdersEquity'], 'type': 'instant'},
    'Inventory': {'concepts': ['InventoryNet'], 'type': 'instant'},
    'Goodwill': {'concepts': ['Goodwill'], 'type': 'instant'},
    # Income statement (duration, single-Q flow)
    'Revenues': {'concepts': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'duration'},
    'Revenue': {'concepts': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'duration'},
    'Net Sales': {'concepts': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'duration'},
    'Net sales': {'concepts': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'duration'},
    'Sales': {'concepts': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], 'type': 'duration'},
    'Cost of Sales': {'concepts': ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold'], 'type': 'duration'},
    'COGS': {'concepts': ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold'], 'type': 'duration'},
    'Gross Profit': {'concepts': ['GrossProfit'], 'type': 'duration'},
    'Net Income': {'concepts': ['NetIncomeLoss', 'ProfitLoss'], 'type': 'duration'},
    'NetIncome': {'concepts': ['NetIncomeLoss', 'ProfitLoss'], 'type': 'duration'},
    'Operating Income': {'concepts': ['OperatingIncomeLoss'], 'type': 'duration'},
    'OpIncome': {'concepts': ['OperatingIncomeLoss'], 'type': 'duration'},
    'Operating Cash Flow': {'concepts': ['NetCashProvidedByUsedInOperatingActivities'], 'type': 'duration'},
    'OCF': {'concepts': ['NetCashProvidedByUsedInOperatingActivities'], 'type': 'duration'},
    'R&D': {'concepts': ['ResearchAndDevelopmentExpense'], 'type': 'duration'},
    'RD': {'concepts': ['ResearchAndDevelopmentExpense'], 'type': 'duration'},
    'SG&A': {'concepts': ['SellingGeneralAndAdministrativeExpense'], 'type': 'duration'},
    'SGA': {'concepts': ['SellingGeneralAndAdministrativeExpense'], 'type': 'duration'},
    'Capex': {'concepts': ['PaymentsToAcquirePropertyPlantAndEquipment'], 'type': 'duration'},
    'EPS': {'concepts': ['EarningsPerShareBasic', 'EarningsPerShareDiluted'], 'type': 'duration'},
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
        if prefix != 'us-gaap':
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


def collect_us_ticker_facts(ticker):
    files = []
    for year in ('2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    facts_instant = defaultdict(dict)
    facts_duration = defaultdict(dict)
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        contexts = parse_contexts(html)
        concepts_needed = set()
        for kmap in KPI_MAP.values():
            for c in kmap['concepts']:
                concepts_needed.add(c)
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


def build_series(facts_by_date, max_count=20):
    items = sorted(facts_by_date.items(), key=lambda x: x[0], reverse=True)
    return items[:max_count]


def scale_value(short, val, unit):
    u = (unit or '').lower()
    if short in ('DPS', 'EPS'):
        return val
    if 'mds' in u or 'bn' in u or 'b$' in u or 'b €' in u or 'b€' in u:
        return val / 1e9
    if u.startswith('m ') or u == 'm$' or u == 'm€' or 'million' in u:
        return val / 1e6
    # default millions
    return val / 1e6


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def process_eu_ticker(ticker):
    """EU: check for half-year/quarterly/ad-hoc/interim source dirs.
    If only annual-text → SKIP. If half-year ≥4 → in principle convert to 'semester'.
    Implementation note: EU XBRL/text parsing not implemented here; report status only.
    """
    log = []
    eu_dir = os.path.join(EU_BASE, ticker)
    if not os.path.isdir(eu_dir):
        return ['SKIP EU (no source dir)']
    found = []
    for sub in ('half-year', 'quarterly', 'interim', 'ad-hoc'):
        d = os.path.join(eu_dir, sub)
        if os.path.isdir(d):
            files = os.listdir(d)
            if files:
                found.append((sub, len(files)))
    if not found:
        return ['SKIP EU (only annual-text, no half-year/quarterly source for ≥4 periods)']
    return [f'EU sources present but extractor not implemented: {found}']


def process_us_ticker(ticker, apply_mode=False):
    log_lines = []
    try:
        fp, d = load_pipeline(ticker)
    except FileNotFoundError:
        return ['MISSING pipeline json']
    year_kpis = [k for k in d.get('kpis', []) if k.get('period_type') == 'year']
    if not year_kpis:
        return ['no year-KPIs']
    facts_inst, facts_dur = collect_us_ticker_facts(ticker.upper())
    if not facts_inst and not facts_dur:
        return ['no 10-Q facts (likely no .htm.gz files in cat1-us/10Q)']
    changed = False
    for kpi in year_kpis:
        short = kpi.get('short')
        if short not in KPI_MAP:
            log_lines.append(f'  - {short}: SKIP (no XBRL mapping)')
            continue
        kmap = KPI_MAP[short]
        picked = None
        for c in kmap['concepts']:
            store = facts_inst if kmap['type'] == 'instant' else facts_dur
            series = build_series(store.get(c, {}))
            if len(series) >= 4:
                picked = (c, series)
                break
        if not picked:
            log_lines.append(f'  - {short}: SKIP (< 4 trims found)')
            continue
        concept, series = picked
        unit = kpi.get('unit')
        vals = [round(scale_value(short, v, unit), 6) for _d, v in series]
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


def process_ticker(ticker, apply_mode=False):
    if ticker in EU_TICKERS:
        return process_eu_ticker(ticker)
    return process_us_ticker(ticker, apply_mode=apply_mode)


def main():
    apply_mode = '--apply' in sys.argv
    with open(BATCH) as f:
        tickers = [line.split()[0].strip() for line in f if line.strip()]
    print(f'=== SA36 batch01 ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped_no_data': 0, 'unmapped': 0, 'eu_skipped': 0, 'eu_partial': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'SKIP (< 4' in ln or 'no 10-Q facts' in ln:
                summary['skipped_no_data'] += 1
            elif 'SKIP (no XBRL' in ln:
                summary['unmapped'] += 1
            elif 'SKIP EU' in ln:
                summary['eu_skipped'] += 1
            elif 'EU sources present' in ln:
                summary['eu_partial'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
