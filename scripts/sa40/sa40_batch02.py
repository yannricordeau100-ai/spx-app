#!/usr/bin/env python3
"""SA40 batch 02 — sectoral 10-Q MD&A / XBRL parse: convert year→quarter
for sectoral KPIs (Backlog, Headcount, AUM, Comp Sales, Insurance Premiums,
Subscribers) when ≥4 quarterly periods can be extracted.

Strategy:
- US tickers: parse 10-Q HTM XBRL with extended whitelist covering
  insurance premiums (PremiumsEarnedNet, PremiumsWrittenNet, etc.),
  RPO backlog (RevenueRemainingPerformanceObligation), Employees
  (dei:EntityNumberOfEmployees). MD&A free-text narrative is NOT mined to
  avoid invention risk (rule: JAMAIS INVENTER).
- EU tickers (.PA .L .MI .SW .OL .HE .ST .AS): SKIP unless half-year /
  quarterly source dir exists in cat3-european/<TICKER>/.
- Foreign ADRs (MUFG, ATEYY, BIP): SKIP (20-F annual only, no quarterly source).

≥4 quarters required to upgrade period_type. Otherwise SKIP.

_fix_log tag = "SA40-Claude 2026-06-03".
Dry-run by default. --apply to write.
"""
import os, sys, gzip, json, re, glob
from collections import defaultdict
from datetime import datetime

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
EU_BASE = os.path.join(ROOT, 'Mettrik/sec-data/cat3-european')
BATCH = '/tmp/sa40-batches/batch02.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'

# Per-ticker mapping: short → (concepts, type)
# Only includes KPIs where XBRL gives clean signal — sectoral kept strict.
TICKER_KPI_MAP = {
    'EG': {
        'Gross written premiums': {'concepts': ['us-gaap:PremiumsWrittenGross'], 'type': 'duration'},
        'Net written premiums':   {'concepts': ['us-gaap:PremiumsWrittenNet'],   'type': 'duration'},
        'Premiums earned':        {'concepts': ['us-gaap:PremiumsEarnedNet'],    'type': 'duration'},
    },
    'BKR': {
        'RPO Backlog (Remaining Performance Obligations)':
            {'concepts': ['us-gaap:RevenueRemainingPerformanceObligation'], 'type': 'instant'},
    },
    'CRWV': {
        # Need ≥4 trims; current 10-Qs only give 3 quarters → will SKIP.
        'Backlog Contractuel (RPO)':
            {'concepts': ['us-gaap:RevenueRemainingPerformanceObligation'], 'type': 'instant'},
    },
    'IBKR': {
        'Employees': {'concepts': ['dei:EntityNumberOfEmployees'], 'type': 'instant'},
    },
    # PGR: "Net Premiums Written" / "Policies in Force" not directly tagged
    #       in 10-Q XBRL → SKIP per JAMAIS INVENTER.
    # KKR: Fee-Paying AUM / Total AUM not tagged in 10-Q XBRL → SKIP.
    # OMC / PG / KEY / URI / CTRA / HOOD: no sectoral 'year' KPI has a clean
    #       XBRL signal (no backlog/AUM/headcount tag found) → SKIP.
}

# EU tickers in this batch — all need half-year or quarterly source. Per
# inspection, only annual-text exists, so they all SKIP. ITRK.L has a
# half-year folder but no extractor implemented for raw PDFs/text.
EU_TICKERS = {'DIM.PA','ITRK.L','MB.MI','NESTE.HE','NHY.OL','NOVN.SW','NWG.L',
              'STAN.L','TEL2-B.ST','UNI.MI','YAR.OL','AGN.AS','BNP.PA'}

# Foreign ADRs in this batch — 20-F annual, no quarterly XBRL.
ADR_SKIP = {'MUFG', 'ATEYY', 'BIP'}

NUMRE = re.compile(r'<ix:nonFraction\b([^>]*)>([^<]*)</ix:nonFraction>',
                   re.IGNORECASE | re.DOTALL)
ATTRRE = re.compile(r'(\w+(?:[-:]\w+)?)\s*=\s*"([^"]*)"')
CONTEXT_RE = re.compile(
    r'<(?:xbrli:)?context\s+id="([^"]+)"[^>]*>(.*?)</(?:xbrli:)?context>',
    re.DOTALL | re.IGNORECASE)
PERIOD_RE = re.compile(r'<(?:xbrli:)?period>(.*?)</(?:xbrli:)?period>',
                       re.DOTALL | re.IGNORECASE)
INSTANT_RE = re.compile(r'<(?:xbrli:)?instant>([0-9\-]+)</(?:xbrli:)?instant>',
                        re.IGNORECASE)
START_RE = re.compile(r'<(?:xbrli:)?startDate>([0-9\-]+)</(?:xbrli:)?startDate>',
                      re.IGNORECASE)
END_RE = re.compile(r'<(?:xbrli:)?endDate>([0-9\-]+)</(?:xbrli:)?endDate>',
                    re.IGNORECASE)
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
                contexts[cid] = {'start': sm.group(1), 'end': em.group(1),
                                 'has_segment': has_seg}
    return contexts


def is_quarter_duration(start, end):
    try:
        sd = datetime.strptime(start, '%Y-%m-%d')
        ed = datetime.strptime(end, '%Y-%m-%d')
    except ValueError:
        return False
    days = (ed - sd).days
    return 80 <= days <= 100


def parse_facts(html, contexts, wanted_concepts):
    for m in NUMRE.finditer(html):
        attrs_str = m.group(1)
        raw_val = m.group(2).strip().replace(',', '')
        attrs = dict(ATTRRE.findall(attrs_str))
        name = attrs.get('name', '')
        if name not in wanted_concepts:
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
        yield (name, val, ctx)


def collect_ticker_facts(ticker, wanted_concepts):
    files = []
    for year in ('2023', '2024', '2025', '2026'):
        files.extend(sorted(glob.glob(
            os.path.join(SEC10Q, year, f'{ticker}_*.htm.gz'))))
    facts_instant = defaultdict(dict)   # concept -> {date: val}
    facts_duration = defaultdict(dict)  # concept -> {end_date: val}
    for fp in files:
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [warn] cannot read {fp}: {e}', file=sys.stderr)
            continue
        contexts = parse_contexts(html)
        for name, val, ctx in parse_facts(html, contexts, wanted_concepts):
            if 'instant' in ctx:
                d = ctx['instant']
                # last write wins; multiple filings overlap, use latest filing
                # (which has more recent restatement). We iterate files in
                # chronological order so latest filing wins.
                facts_instant[name][d] = val
            else:
                start = ctx.get('start')
                end = ctx.get('end')
                if start and end and is_quarter_duration(start, end):
                    facts_duration[name][end] = val
    return facts_instant, facts_duration


def build_series(facts_by_date, max_count=20):
    items = sorted(facts_by_date.items(), key=lambda x: x[0], reverse=True)
    return items[:max_count]


def scale_value(short, val, unit):
    u = (unit or '').strip().lower()
    # Headcount / employees / accounts / subscribers: respect unit
    if short.lower() in ('employees', 'headcount', 'number of employees',
                         'customer accounts', 'funded customers'):
        if u == 'k' or 'thousand' in u or 'mille' in u:
            return val / 1e3
        if u == 'm' or 'million' in u or 'mns' in u:
            return val / 1e6
        return val  # raw integer count
    if 'mds' in u or 'bn' in u or u == 'b $' or u == 'b€' or u == 'b $' or u.startswith('b '):
        return val / 1e9
    if u.startswith('m ') or u == 'm$' or u == 'm€' or 'million' in u or 'mns' in u:
        return val / 1e6
    # default: assume millions
    return val / 1e6


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def process_ticker(ticker, apply_mode=False):
    log = []
    if ticker in ADR_SKIP:
        return ['SKIP foreign ADR (20-F only, no quarterly XBRL)']
    if ticker in EU_TICKERS:
        eu_dir = os.path.join(EU_BASE, ticker)
        if not os.path.isdir(eu_dir):
            return ['SKIP EU (no source dir)']
        subs = []
        for sub in ('half-year', 'quarterly', 'interim', 'ad-hoc'):
            d = os.path.join(eu_dir, sub)
            if os.path.isdir(d):
                files = os.listdir(d)
                if files:
                    subs.append((sub, len(files)))
        if not subs:
            return ['SKIP EU (only annual-text available, no half-year/quarterly source)']
        return [f'SKIP EU (sources exist {subs} but free-text PDF extractor not implemented — would risk invention)']

    if ticker not in TICKER_KPI_MAP:
        return ['SKIP US (no sectoral year-KPI with clean XBRL signal)']

    try:
        fp, d = load_pipeline(ticker)
    except FileNotFoundError:
        return ['MISSING pipeline json']
    year_kpis = {k.get('short'): k for k in d.get('kpis', [])
                 if k.get('period_type') == 'year'}
    if not year_kpis:
        return ['no year-KPIs']

    mapping = TICKER_KPI_MAP[ticker]
    wanted_concepts = set()
    for v in mapping.values():
        wanted_concepts.update(v['concepts'])
    facts_inst, facts_dur = collect_ticker_facts(ticker, wanted_concepts)

    changed = False
    for short, kmap in mapping.items():
        if short not in year_kpis:
            log.append(f'  - {short}: not a year-KPI on this ticker')
            continue
        kpi = year_kpis[short]
        picked = None
        for c in kmap['concepts']:
            store = facts_inst if kmap['type'] == 'instant' else facts_dur
            series = build_series(store.get(c, {}))
            if len(series) >= 4:
                picked = (c, series)
                break
        if not picked:
            log.append(f'  - {short}: SKIP (<4 trims found in XBRL)')
            continue
        concept, series = picked
        unit = kpi.get('unit')
        vals = [round(scale_value(short, v, unit), 6) for _d, v in series]
        kpi['period_type'] = 'quarter'
        kpi['history'] = vals
        kpi['last_data_date'] = series[0][0]
        entry = (f'{FIX_LOG_TAG} {TODAY}: quarterly from 10-Q XBRL '
                 f'{concept} ({len(vals)} trims, latest {series[0][0]})')
        fl = kpi.get('_fix_log')
        if fl is None:
            kpi['_fix_log'] = [entry]
        elif isinstance(fl, list):
            fl.append(entry)
        else:
            kpi['_fix_log'] = [fl, entry]
        log.append(f'  + {short}: CONVERTED via {concept} '
                   f'({len(vals)} trims, latest@{series[0][0]}={vals[0]})')
        changed = True
    if changed and apply_mode:
        save_pipeline(fp, d)
        log.append(f'  >> WRITTEN {fp}')
    elif changed:
        log.append('  >> (dry-run, not written)')
    else:
        log.append('  (no change)')
    return log


def main():
    apply_mode = '--apply' in sys.argv
    with open(BATCH) as f:
        tickers = [line.split()[0].strip() for line in f if line.strip()]
    print(f'=== SA40 batch02 ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted_kpis': 0, 'tickers_changed': 0,
               'skipped_eu': 0, 'skipped_adr': 0, 'skipped_no_map': 0,
               'skipped_no_data': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        ticker_changed = False
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted_kpis'] += 1
                ticker_changed = True
            elif 'SKIP EU' in ln:
                summary['skipped_eu'] += 1
            elif 'SKIP foreign ADR' in ln:
                summary['skipped_adr'] += 1
            elif 'SKIP US (no sectoral' in ln:
                summary['skipped_no_map'] += 1
            elif 'SKIP (<4 trims' in ln:
                summary['skipped_no_data'] += 1
        if ticker_changed:
            summary['tickers_changed'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
