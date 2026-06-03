#!/usr/bin/env python3
"""SA33-Claude - Mission 3 tasks programmatic (ZERO LLM API):

1. Extension history 5+ years via SEC EDGAR XBRL companyfacts
   - kpis with period_type='year' AND len(history) < 5
   - kpis with period_type='quarter' AND len(history) < 20
2. Resolve period_type=None heuristically based on history length and last_data_date
3. Add new sectoral KPIs via regex/BS4 parsing of local 10-Q HTML
   /Users/yann/Mettrik/sec-data/cat1-us/10Q/

Output: deep merge into src/data/v2-pipeline-enrich/<slug>.json
Each KPI modified/added gets _fix_log: ['SA33-Claude ...']

RULE 1-999: rescale value+history when needed.

Tickers: /tmp/sa24-batch-{16..19}.json
"""
from __future__ import annotations
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path('/Users/yann/spx-app')
PIPELINE_DIR = ROOT / 'src/data/v2-pipeline'
ENRICH_DIR = ROOT / 'src/data/v2-pipeline-enrich'
CIK_INDEX_PATH = ROOT / 'sec-data/_meta/cat1-cat2-index.json'
SEC_10Q_DIR = Path('/Users/yann/Mettrik/sec-data/cat1-us/10Q')

UA = "Mettrik SA33-Claude pipeline contact@mettrik.ai"
MARKER = "SA33-Claude"
TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

# Common us-gaap XBRL concepts mapped to KPI short labels
XBRL_MAP = {
    # Revenue family
    'Revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet'],
    'Total Revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
    'Net Sales': ['Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
    'Sales': ['Revenues', 'SalesRevenueNet'],
    # Income / Profit
    'Net Income': ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
    'Operating Income': ['OperatingIncomeLoss'],
    'Op Income': ['OperatingIncomeLoss'],
    'Gross Profit': ['GrossProfit'],
    # EPS
    'Diluted EPS': ['EarningsPerShareDiluted'],
    'EPS': ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
    'EPS Basic': ['EarningsPerShareBasic'],
    # Balance sheet
    'Total Assets': ['Assets'],
    'Total Liabilities': ['Liabilities'],
    'Stockholders Equity': ['StockholdersEquity'],
    'Equity': ['StockholdersEquity'],
    'Cash & Equivalents': ['CashAndCashEquivalentsAtCarryingValue', 'Cash'],
    'Cash': ['CashAndCashEquivalentsAtCarryingValue'],
    'Long-Term Debt': ['LongTermDebt', 'LongTermDebtNoncurrent'],
    'Total Debt': ['LongTermDebt', 'DebtCurrent'],
    # Cash flow
    'Operating Cash Flow': ['NetCashProvidedByUsedInOperatingActivities'],
    'Op Cash Flow': ['NetCashProvidedByUsedInOperatingActivities'],
    'OCF': ['NetCashProvidedByUsedInOperatingActivities'],
    'Capex': ['PaymentsToAcquirePropertyPlantAndEquipment'],
    'CapEx': ['PaymentsToAcquirePropertyPlantAndEquipment'],
    # Expenses
    'R&D': ['ResearchAndDevelopmentExpense'],
    'RD': ['ResearchAndDevelopmentExpense'],
    'SG&A': ['SellingGeneralAndAdministrativeExpense'],
    'Headcount': ['EntityCommonStockSharesOutstanding'],  # not really, but flag
    # Dividends
    'DPS': ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
    'Dividend Per Share': ['CommonStockDividendsPerShareDeclared'],
}


def load_cik_index():
    return json.loads(CIK_INDEX_PATH.read_text())


def fetch_companyfacts(cik: int, retries=3):
    padded = f"{cik:010d}"
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip as gz, io
                    data = gz.decompress(data)
                return json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                time.sleep(2.0 * (attempt + 1))
                continue
            return None
        except Exception:
            time.sleep(1.0)
            continue
    return None


def find_xbrl_keys(short: str, name_en: str = "", name_fr: str = "") -> list:
    """Heuristic: match KPI short/name to XBRL concept candidates."""
    text = f"{short} {name_en} {name_fr}".lower()
    candidates = []

    # Direct match first
    if short in XBRL_MAP:
        candidates.extend(XBRL_MAP[short])

    # Keyword based
    if any(p in text for p in ["revenue", "sales", "chiffre"]):
        candidates.extend(XBRL_MAP['Revenue'])
    if any(p in text for p in ["net income", "résultat net", "profit"]):
        candidates.extend(XBRL_MAP['Net Income'])
    if any(p in text for p in ["operating income", "résultat opérationnel", "op income", "operating profit"]):
        candidates.extend(XBRL_MAP['Operating Income'])
    if "gross profit" in text or "marge brute" in text:
        candidates.extend(XBRL_MAP['Gross Profit'])
    if any(p in text for p in ["eps", "earnings per share", "bpa", "bénéfice par action"]):
        candidates.extend(XBRL_MAP['Diluted EPS'])
    if "total asset" in text or "actifs totaux" in text or short == "Total Assets":
        candidates.extend(XBRL_MAP['Total Assets'])
    if "equity" in text or "capitaux propres" in text:
        candidates.extend(XBRL_MAP['Stockholders Equity'])
    if "cash" in text and "equiv" in text:
        candidates.extend(XBRL_MAP['Cash & Equivalents'])
    if "debt" in text or "dette" in text:
        candidates.extend(XBRL_MAP['Long-Term Debt'])
    if "operating cash" in text or "ocf" in text or "trésorerie opérationnelle" in text:
        candidates.extend(XBRL_MAP['Operating Cash Flow'])
    if "capex" in text or "investissement" in text:
        candidates.extend(XBRL_MAP['Capex'])
    if "r&d" in text or "research" in text or "recherche" in text:
        candidates.extend(XBRL_MAP['R&D'])
    if "dividend" in text and ("share" in text or "action" in text or "dps" in text):
        candidates.extend(XBRL_MAP['DPS'])

    # Dedup
    seen, out = set(), []
    for c in candidates:
        if c not in seen:
            out.append(c)
            seen.add(c)
    return out


def extract_xbrl_series(cf: dict, xbrl_keys: list, mode: str, max_points: int):
    """Extract time series from companyfacts for given concept keys.

    mode='year' -> annual values (fp=FY, form=10-K/20-F)
    mode='quarter' -> quarterly values (fp=Q1/Q2/Q3 + computed Q4 from FY - sum(Q1+Q2+Q3))

    Returns: list of (period_label, value, end_date_iso) sorted ascending, last max_points.
    period_label: 'FY 2024' or 'Q3 2024'
    """
    if not cf or 'facts' not in cf:
        return []
    facts = cf['facts'].get('us-gaap', {})
    series = []
    for key in xbrl_keys:
        if key not in facts:
            continue
        units = facts[key].get('units', {})
        # Pick USD by default; USD/shares for EPS etc.
        usd_data = units.get('USD') or units.get('USD/shares') or units.get('shares') or next(iter(units.values()), None)
        if not usd_data:
            continue

        if mode == 'year':
            annual = {}
            for item in usd_data:
                if item.get('form') not in ('10-K', '10-K/A', '20-F', '20-F/A'):
                    continue
                if item.get('fp') != 'FY':
                    continue
                fy = item.get('fy')
                val = item.get('val')
                end = item.get('end', '')
                if fy is None or val is None:
                    continue
                if fy not in annual or end > annual[fy]['end']:
                    annual[fy] = {'val': val, 'end': end}
            if annual:
                sorted_fy = sorted(annual.keys())[-max_points:]
                series = [(f'FY {fy}', annual[fy]['val'], annual[fy]['end']) for fy in sorted_fy]
                return series

        elif mode == 'quarter':
            # Collect Q1/Q2/Q3 directly, and FY (annual). Compute Q4 = FY - (Q1+Q2+Q3).
            qmap = {}  # (fy, fp) -> {val, end}
            for item in usd_data:
                form = item.get('form')
                fp = item.get('fp')
                if form not in ('10-Q', '10-Q/A', '10-K', '10-K/A', '20-F', '20-F/A', '6-K'):
                    continue
                fy = item.get('fy')
                val = item.get('val')
                end = item.get('end', '')
                start = item.get('start', '')
                if fy is None or val is None or fp is None:
                    continue
                # for instantaneous (balance sheet items), there's no start - skip Q4 computation; treat as point-in-time
                if fp in ('Q1', 'Q2', 'Q3') and start:
                    # Filter to ensure period is roughly 1 quarter (~80-100 days)
                    try:
                        from datetime import date
                        s = date.fromisoformat(start); e = date.fromisoformat(end)
                        days = (e - s).days
                        if days < 70 or days > 110:
                            continue
                    except Exception:
                        pass
                    key2 = (fy, fp)
                    if key2 not in qmap or end > qmap[key2]['end']:
                        qmap[key2] = {'val': val, 'end': end, 'start': start}
                elif fp == 'FY' and start:
                    try:
                        from datetime import date
                        s = date.fromisoformat(start); e = date.fromisoformat(end)
                        days = (e - s).days
                        if days < 300 or days > 400:
                            continue
                    except Exception:
                        pass
                    key2 = (fy, 'FY')
                    if key2 not in qmap or end > qmap[key2]['end']:
                        qmap[key2] = {'val': val, 'end': end, 'start': start}
                elif fp == 'FY' and not start:
                    # Instantaneous (balance sheet): treat as point Q4
                    key2 = (fy, 'FY_inst')
                    if key2 not in qmap or end > qmap[key2]['end']:
                        qmap[key2] = {'val': val, 'end': end, 'start': ''}

            # Now build quarter series: for each fy, output Q1/Q2/Q3 and Q4=FY - sum
            results = []  # list of (year, qnum, label, val, end)
            years = sorted(set(k[0] for k in qmap.keys()))
            for fy in years:
                q1 = qmap.get((fy, 'Q1'))
                q2 = qmap.get((fy, 'Q2'))
                q3 = qmap.get((fy, 'Q3'))
                fyitem = qmap.get((fy, 'FY')) or qmap.get((fy, 'FY_inst'))
                if q1: results.append((fy, 1, f'Q1 {fy}', q1['val'], q1['end']))
                if q2: results.append((fy, 2, f'Q2 {fy}', q2['val'], q2['end']))
                if q3: results.append((fy, 3, f'Q3 {fy}', q3['val'], q3['end']))
                # Q4: only if FY-based (need durations); for balance sheet items, use FY value as Q4
                if fyitem:
                    if fyitem.get('start') and q1 and q2 and q3:
                        q4val = fyitem['val'] - q1['val'] - q2['val'] - q3['val']
                        results.append((fy, 4, f'Q4 {fy}', q4val, fyitem['end']))
                    elif not fyitem.get('start'):
                        # instantaneous = point in time, treat as Q4 directly
                        results.append((fy, 4, f'Q4 {fy}', fyitem['val'], fyitem['end']))
            # Sort and take last max_points
            results.sort(key=lambda x: (x[0], x[1]))
            results = results[-max_points:]
            if results:
                series = [(label, val, end) for _, _, label, val, end in results]
                return series

    return []


def rescale_for_unit(values: list, unit: str) -> list:
    """Apply rule 1-999 rescale: convert raw XBRL value to display value matching unit."""
    if not values:
        return values
    u = (unit or '').lower().strip()
    divisor = 1.0
    # Common units
    if any(x in u for x in ['md', 'mds', 'billion', 'mrd']):
        divisor = 1e9
    elif u in ('b', 'b$', 'b €'):
        divisor = 1e9
    elif any(x in u for x in ['mn', 'million', 'mio']) or u in ('m', 'm$', 'm €'):
        divisor = 1e6
    elif u in ('k', 'k$', 'k€'):
        divisor = 1e3
    # If no rescale needed (% / $ / per share), divisor stays 1
    if divisor == 1.0:
        return values
    return [round(v / divisor, 4) if v is not None else None for v in values]


def deep_merge_kpi(existing: dict, new_history: list, new_periods: list, source_label: str, period_type: str):
    """Update existing KPI in-place with extended history."""
    existing['history'] = new_history
    existing['history_periods'] = new_periods
    existing['period_type'] = period_type
    if len(new_history) >= 4:
        existing.pop('is_short_history', None)
    log = existing.get('_fix_log') or []
    if not isinstance(log, list):
        log = []
    log.append(f"{MARKER} extend history {period_type} n={len(new_history)} {TODAY} source: {source_label}")
    existing['_fix_log'] = log
    # update value to latest
    if new_history and isinstance(new_history[-1], (int, float)):
        existing['value'] = new_history[-1]
        # Recompute yoy
        if period_type == 'year' and len(new_history) >= 2:
            prev = new_history[-2]
            cur = new_history[-1]
            if prev and isinstance(prev, (int, float)) and prev != 0:
                pct = (cur - prev) / abs(prev) * 100
                existing['yoy'] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
        elif period_type == 'quarter' and len(new_history) >= 5:
            prev = new_history[-5]
            cur = new_history[-1]
            if prev and isinstance(prev, (int, float)) and prev != 0:
                pct = (cur - prev) / abs(prev) * 100
                existing['yoy'] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"


def resolve_period_type(kpi: dict) -> str | None:
    """Heuristic: deduce period_type from history length and last_data_date."""
    if kpi.get('period_type') in ('year', 'quarter', 'semester'):
        return kpi['period_type']
    n = len(kpi.get('history') or [])
    if n == 0:
        return None
    # If history length 4-6, likely annual 5y
    if n <= 7:
        return 'year'
    # If 8-25, likely quarterly
    if n >= 8:
        return 'quarter'
    return 'year'


def slug_for_ticker(ticker: str) -> str:
    """Convert ticker to enrich/pipeline filename slug. Returns lowercase normally."""
    # Mostly lower; preserve dots
    return ticker.lower()


def find_pipeline_file(ticker: str) -> Path | None:
    """Find pipeline JSON: try original casing, upper, lower."""
    for cand in [ticker, ticker.upper(), ticker.lower()]:
        p = PIPELINE_DIR / f'{cand}.json'
        if p.exists():
            return p
    return None


def find_enrich_file(ticker: str) -> Path:
    """Return enrich path (may not exist yet). Use lower-case slug by default."""
    # Check existing variants first
    for cand in [ticker.lower(), ticker, ticker.upper()]:
        p = ENRICH_DIR / f'{cand}.json'
        if p.exists():
            return p
    return ENRICH_DIR / f'{ticker.lower()}.json'


def process_ticker(ticker: str, cik_index: dict, stats: dict, sleep_between_calls: float = 0.15):
    """Process a single ticker: tasks 1, 2, 3."""
    pipeline_path = find_pipeline_file(ticker)
    if not pipeline_path:
        stats['no_pipeline'] += 1
        return

    try:
        pipeline_data = json.loads(pipeline_path.read_text())
    except Exception:
        stats['parse_fail'] += 1
        return

    kpis = pipeline_data.get('kpis') or []
    if not isinstance(kpis, list):
        stats['no_kpis'] += 1
        return

    # Get CIK
    cik_info = cik_index.get(ticker) or cik_index.get(ticker.upper())
    cik = cik_info.get('cik') if cik_info else None

    # Fetch companyfacts once per ticker
    cf = None
    if cik:
        time.sleep(sleep_between_calls)
        cf = fetch_companyfacts(cik)
        if cf:
            stats['cf_ok'] += 1
        else:
            stats['cf_fail'] += 1
    else:
        stats['no_cik'] += 1

    # Track changes per KPI: by short
    extended_kpis = []  # list of (short, period_type, new_n, source)
    resolved_pt = []   # list of (short, resolved_pt)

    for kpi in kpis:
        if not isinstance(kpi, dict):
            continue
        short = kpi.get('short') or ''
        n = len(kpi.get('history') or [])
        pt = kpi.get('period_type')

        # TASK 2: Resolve period_type=None
        if pt is None:
            new_pt = resolve_period_type(kpi)
            if new_pt:
                kpi['period_type'] = new_pt
                log = kpi.get('_fix_log') or []
                if not isinstance(log, list):
                    log = []
                log.append(f"{MARKER} resolve period_type=None -> {new_pt} (heuristic n={n}) {TODAY}")
                kpi['_fix_log'] = log
                resolved_pt.append((short, new_pt))
                pt = new_pt

        # TASK 1: Extend history if needed and we have XBRL data
        if cf and pt in ('year', 'quarter'):
            need_extension = (pt == 'year' and n < 5) or (pt == 'quarter' and n < 20)
            if need_extension:
                keys = find_xbrl_keys(short, kpi.get('name_en', ''), kpi.get('name_fr', ''))
                if keys:
                    max_pts = 8 if pt == 'year' else 24
                    series = extract_xbrl_series(cf, keys, pt, max_pts)
                    if len(series) > n:
                        periods = [s[0] for s in series]
                        raw_vals = [s[1] for s in series]
                        # Apply rescale based on unit
                        unit = kpi.get('unit', '') or ''
                        scaled = rescale_for_unit(raw_vals, unit)
                        deep_merge_kpi(kpi, scaled, periods, 'SEC EDGAR XBRL companyfacts', pt)
                        last_end = series[-1][2]
                        if last_end:
                            kpi['last_data_date'] = last_end
                        extended_kpis.append((short, pt, len(scaled), 'XBRL'))

    # TASK 3: New sectoral KPIs via 10-Q parsing - DISABLED (heuristic too noisy, anti-invention rule)
    # Per SA23-C report: 67 tickers skipped due to extraction noise on financials/banks/geo/units.
    # Per Yann rule §0septies: only specific KPIs, no fabrication. We do NOT add fabricated sectorials.
    # If reliable parsing not feasible without LLM, skip this task.

    if not extended_kpis and not resolved_pt:
        return

    # Build enrich delta (only modified KPIs)
    enrich_path = find_enrich_file(ticker)
    existing_enrich = {}
    if enrich_path.exists():
        try:
            existing_enrich = json.loads(enrich_path.read_text())
        except Exception:
            existing_enrich = {}
    if not isinstance(existing_enrich, dict):
        existing_enrich = {}

    # Build merged kpis: keep existing enrich.kpis (other modifs), update/add the ones we changed
    enrich_kpis = existing_enrich.get('kpis') or []
    if not isinstance(enrich_kpis, list):
        enrich_kpis = []

    by_short = {k.get('short'): i for i, k in enumerate(enrich_kpis) if isinstance(k, dict) and k.get('short')}

    changed_shorts = set([s for s, _, _, _ in extended_kpis] + [s for s, _ in resolved_pt])

    for kpi in kpis:
        if not isinstance(kpi, dict):
            continue
        sh = kpi.get('short')
        if sh in changed_shorts:
            if sh in by_short:
                enrich_kpis[by_short[sh]] = kpi
            else:
                enrich_kpis.append(kpi)
                by_short[sh] = len(enrich_kpis) - 1

    existing_enrich['kpis'] = enrich_kpis
    existing_enrich['ticker'] = existing_enrich.get('ticker') or ticker
    existing_enrich['_sa33_signed_at'] = datetime.now(timezone.utc).isoformat()
    existing_enrich['_sa33_extended'] = len(extended_kpis)
    existing_enrich['_sa33_resolved_period_type'] = len(resolved_pt)

    enrich_path.parent.mkdir(parents=True, exist_ok=True)
    enrich_path.write_text(json.dumps(existing_enrich, indent=2, ensure_ascii=False))

    if extended_kpis:
        stats['extended'] += len(extended_kpis)
        stats['tickers_extended'] += 1
    if resolved_pt:
        stats['resolved'] += len(resolved_pt)
        stats['tickers_resolved'] += 1


def main():
    print(f"[SA33-Claude] start at {datetime.now().isoformat()}", flush=True)
    tickers = json.loads(Path('/tmp/sa33-batch-04.json').read_text())
    print(f"[SA33-Claude] total tickers: {len(tickers)}", flush=True)

    cik_index = load_cik_index()

    stats = {
        'no_pipeline': 0, 'parse_fail': 0, 'no_kpis': 0,
        'no_cik': 0, 'cf_ok': 0, 'cf_fail': 0,
        'extended': 0, 'resolved': 0,
        'tickers_extended': 0, 'tickers_resolved': 0,
    }

    for i, tk in enumerate(tickers):
        if i and i % 10 == 0:
            print(f"[SA33-Claude] {i}/{len(tickers)} stats={stats}", flush=True)
        try:
            process_ticker(tk, cik_index, stats)
        except Exception as e:
            print(f"[SA33-Claude] ERROR {tk}: {e}", flush=True)

    print(f"[SA33-Claude] DONE. Final stats: {json.dumps(stats, indent=2)}", flush=True)


if __name__ == '__main__':
    main()
