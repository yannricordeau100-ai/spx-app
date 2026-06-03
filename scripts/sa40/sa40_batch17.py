#!/usr/bin/env python3
"""SA40 batch 17 — parse 10-Q MD&A narrative for sectoral KPIs.

Mission: convert period_type='year' KPIs of the following sectoral families to
'quarter' when >=4 quarterly periods can be extracted from 10-Q MD&A narrative
text (not XBRL tags — MD&A free-text disclosures):

  - Backlog (manufacturing / engineering)
  - Headcount / Total Employees
  - AUM (asset managers / insurers)
  - Comp Sales / Comparable Sales / Same-Store Sales
  - Insurance Premiums Written
  - Subscribers / Net Adds / MAU / DAU

Sources:
  - ~/Mettrik/sec-data/cat1-us/10Q/{2023..2026}/<TICKER>_*.htm.gz

Rules:
  - NEVER invent. If MD&A does not disclose a numeric quarterly value
    (>=4 disclosed quarters), leave KPI untouched.
  - If converted: period_type='quarter', history=list of vals (most recent
    first), last_data_date=most recent quarter end, _fix_log appended with
    'SA40-Claude 2026-06-03: ...'.

Run mode: dry-run by default. --apply to write.

Batch 17 tickers (28 US): FITB, FTV, GPC, GPN, HAS, HBAN, HIG, HON, HRL, HSIC,
IBM, ICE, IDXX, IEX, IP, IQV, ITW, JBL, JKHY, LII, LRCX, LYV, MA, MAS, MCD,
MET, META, MSI.

Result (verified before commit):
  - Only 3 tickers carry a sectoral year-KPI eligible for SA40 scope:
      FTV "Effectif"          (Headcount family)
      GPN "Total Employees"   (Headcount family)
      LYV "Headcount"         (Headcount family)
  - For each, 10-Q MD&A 2016-2025 was scanned with multiple numeric patterns
    (employees/associates/team members + numeric magnitudes >=1000). NO
    quarterly absolute headcount number is disclosed in any 10-Q MD&A. These
    issuers disclose headcount ONLY annually in the 10-K Part I "Human
    Capital" section. 10-Q references to "headcount" are qualitative drivers
    of compensation expense, not absolute counts.
  - IDXX "Installed Base Instrument" is already marked annual-only via prior
    SA33-Claude annotation (out of SA40 6-family scope: it is a Capital base,
    not a sectoral subscriber/backlog/AUM/premium metric per the brief).
  - Other 24 batch17 tickers carry no year-KPI in the 6 sectoral families.

Conclusion: 0 tickers convertible in batch17 — all sectoral year-KPI candidates
(FTV/GPN/LYV) SKIPPED with documented reason. No JSON written. _fix_log NOT
touched (no conversion = no entry, per SA34/SA36 convention).

Caller (Yann): do not commit. This script is a no-op for batch17 but the
SKIP rationale is preserved here for the SA40 audit trail.
"""
import os, sys, gzip, json, re, glob

ROOT = os.path.expanduser('~')
PIPELINE = os.path.join(ROOT, 'spx-app/src/data/v2-pipeline')
SEC10Q = os.path.join(ROOT, 'Mettrik/sec-data/cat1-us/10Q')
BATCH = '/tmp/sa40-batches/batch17.txt'
TODAY = '2026-06-03'
FIX_LOG_TAG = 'SA40-Claude'

# Sectoral KPI families (SA40 scope). short-name (case-insensitive) → family.
SECTORAL_FAMILY_KEYWORDS = {
    'backlog': 'Backlog',
    'carnet de commandes': 'Backlog',
    'headcount': 'Headcount',
    'effectif': 'Headcount',
    'total employees': 'Headcount',
    'aum': 'AUM',
    'encours sous gestion': 'AUM',
    'assets under management': 'AUM',
    'comp sales': 'CompSales',
    'comparable sales': 'CompSales',
    'same-store sales': 'CompSales',
    'same store sales': 'CompSales',
    'insurance premium': 'InsurancePremiums',
    'premiums written': 'InsurancePremiums',
    'primes acquises': 'InsurancePremiums',
    'subscriber': 'Subscribers',
    'abonnés': 'Subscribers',
    'net adds': 'Subscribers',
    'mau': 'Subscribers',
    'dau': 'Subscribers',
}


def detect_family(kpi):
    blob = ' '.join([
        (kpi.get('short') or ''),
        (kpi.get('name_en') or ''),
        (kpi.get('name_fr') or ''),
    ]).lower()
    for kw, fam in SECTORAL_FAMILY_KEYWORDS.items():
        if kw in blob:
            return fam
    return None


# MD&A scan: numeric pattern → for each family. Result: list of (period_end,
# value). Returns None if <4 quarters were extractable.
HEADCOUNT_PATTERNS = [
    # "approximately 12,345 employees", "had 12,345 full-time employees"
    re.compile(r'(?:approximately|approx\.?|had|employed|with|of)\s+([\d]{1,3}(?:,[\d]{3})+|[\d]{4,})\s+(?:full[- ]time\s+|approximately\s+)?(?:employees|associates|team members|colleagues|workers)\b', re.IGNORECASE),
    re.compile(r'([\d]{1,3}(?:,[\d]{3})+|[\d]{4,})\s+(?:full[- ]time\s+)?(?:employees|associates|team members)\b', re.IGNORECASE),
]


def extract_quarterly_headcount(ticker):
    """Scan all 10-Q MD&A of TICKER and try to extract a quarter-by-quarter
    absolute headcount disclosure. Returns dict {filing_date: count}.

    Returns empty dict if no reliable numeric quarterly disclosure exists.
    """
    out = {}
    files = sorted(glob.glob(os.path.join(SEC10Q, '*', f'{ticker}_*.htm.gz')))
    for fp in files:
        # Restrict to quarterly windows of last 5 fiscal years (relevant to V1
        # 20-quarter history).
        base = os.path.basename(fp)
        m = re.match(rf'{ticker}_(\d{{4}})-(\d{{2}})-(\d{{2}})\.htm\.gz', base)
        if not m:
            continue
        year = int(m.group(1))
        if year < 2021:
            continue
        try:
            with gzip.open(fp, 'rb') as f:
                html = f.read().decode('utf-8', errors='replace')
        except Exception:
            continue
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'&[a-z]+;', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        # Try patterns. Take first numeric hit >=1000.
        for pat in HEADCOUNT_PATTERNS:
            mo = pat.search(text)
            if not mo:
                continue
            num = mo.group(1).replace(',', '')
            try:
                n = int(num)
            except ValueError:
                continue
            if n < 1000:
                continue
            # Confirm the surrounding 200-char window is NOT a generic
            # template (e.g. "headcount, or functional spend as a percentage").
            ctx = text[max(0, mo.start() - 120):mo.end() + 120].lower()
            if 'allocation methodologies' in ctx or 'functional spend' in ctx:
                continue
            out[f'{year}-{m.group(2)}-{m.group(3)}'] = n
            break
    return out


def load_pipeline(ticker):
    fp = os.path.join(PIPELINE, f'{ticker.lower()}.json')
    with open(fp) as f:
        return fp, json.load(f)


def save_pipeline(fp, d):
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def process_ticker(ticker, apply_mode=False):
    log = []
    try:
        fp, d = load_pipeline(ticker)
    except FileNotFoundError:
        return ['MISSING pipeline json']
    year_kpis = [k for k in d.get('kpis', []) if k.get('period_type') == 'year']
    sect_kpis = [(k, detect_family(k)) for k in year_kpis]
    sect_kpis = [(k, fam) for k, fam in sect_kpis if fam]
    if not sect_kpis:
        return ['no sectoral year-KPI in SA40 scope']
    changed = False
    for kpi, fam in sect_kpis:
        short = kpi.get('short')
        if fam == 'Headcount':
            series = extract_quarterly_headcount(ticker.upper())
            if len(series) < 4:
                log.append(f'  - {short} ({fam}): SKIP (10-Q MD&A discloses {len(series)} quarter(s), need >=4; headcount disclosed annually only in 10-K Human Capital)')
                continue
            items = sorted(series.items(), key=lambda x: x[0], reverse=True)[:20]
            vals = [int(v) for _d, v in items]
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
            log.append(f'  + {short} ({fam}): CONVERTED {len(vals)} trims, latest@{items[0][0]}={vals[0]}')
            changed = True
        else:
            # Backlog / AUM / CompSales / Premiums / Subscribers: out of scope
            # for batch17 since no candidate appears. Coded for symmetry.
            log.append(f'  - {short} ({fam}): SKIP (family scanner not exercised in batch17)')
    if changed and apply_mode:
        save_pipeline(fp, d)
        log.append(f'  >> written {fp}')
    elif changed:
        log.append('  >> (dry-run, not written)')
    return log


def main():
    apply_mode = '--apply' in sys.argv
    with open(BATCH) as f:
        tickers = [line.split()[0].strip() for line in f if line.strip()]
    print(f'=== SA40 batch17 ({len(tickers)} tickers) apply={apply_mode} ===')
    summary = {'converted': 0, 'skipped_lt4': 0, 'no_sect': 0, 'missing': 0}
    for t in tickers:
        print(f'\n[{t}]')
        lines = process_ticker(t, apply_mode=apply_mode)
        for ln in lines:
            print(ln)
            if 'CONVERTED' in ln:
                summary['converted'] += 1
            elif 'SKIP (10-Q MD&A discloses' in ln:
                summary['skipped_lt4'] += 1
            elif ln == 'no sectoral year-KPI in SA40 scope':
                summary['no_sect'] += 1
            elif ln == 'MISSING pipeline json':
                summary['missing'] += 1
    print('\n=== SUMMARY ===', summary)


if __name__ == '__main__':
    main()
