#!/usr/bin/env python3
"""
SA22-A : Extraction de nouveaux KPIs sectoriels QUARTERLY via Cerebras free + 10-Q local.
- Pour chaque ticker : prendre 2-4 derniers 10-Q US (ou 6-K/half-year pour FPI/EU)
- Demander à Cerebras gpt-oss-120b de lister les KPIs sectoriels CHIFFRES QUARTERLY non déjà connus
- Append au fichier src/data/v2-pipeline-enrich/<slug>.json (additif)
"""
import os
import sys
import json
import gzip
import re
import glob
import time
import threading
import queue
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from cerebras.cloud.sdk import Cerebras

REPO = Path('/Users/yann/spx-app')
SEC = Path('/Users/yann/Mettrik/sec-data')
ENRICH_DIR = REPO / 'src/data/v2-pipeline-enrich'
PIPELINE_DIR = REPO / 'src/data/v2-pipeline'

# Load Cerebras keys
def load_keys():
    keys = []
    with open(REPO / '.env.local') as f:
        for line in f:
            if line.startswith('CEREBRAS') and 'API_KEY' in line:
                keys.append(line.strip().split('=', 1)[1])
    return keys

MAX_FILES_PER_TICKER = 2  # tweakable
KEYS = load_keys()
CLIENTS = [Cerebras(api_key=k) for k in KEYS]
KEY_DEAD = [False] * len(CLIENTS)  # keys exhausted for the day
# Key 2 is permanently dead (402 payment required as of 2026-06-03)
if len(KEY_DEAD) >= 3:
    KEY_DEAD[2] = True
KEY_LOCK = threading.Lock()
KEY_IDX = [0]
LAST_CALL = [0.0]
RATE_LOCK = threading.Lock()
MIN_INTERVAL = 0.9


def next_client():
    with KEY_LOCK:
        for _ in range(len(CLIENTS)):
            i = KEY_IDX[0] % len(CLIENTS)
            KEY_IDX[0] += 1
            if not KEY_DEAD[i]:
                return CLIENTS[i], i
        # all dead, raise
        raise RuntimeError('all cerebras keys exhausted')


def mark_dead(idx, reason):
    KEY_DEAD[idx] = True
    print(f'[key{idx}] marked dead: {reason}')


def rate_gate():
    with RATE_LOCK:
        now = time.time()
        wait = MIN_INTERVAL - (now - LAST_CALL[0])
        if wait > 0:
            time.sleep(wait)
        LAST_CALL[0] = time.time()


def cerebras_call(prompt, max_tokens=2500, timeout=90, retries=4):
    last_err = None
    for attempt in range(retries):
        rate_gate()
        try:
            client, idx = next_client()
        except RuntimeError as e:
            raise
        try:
            r = client.chat.completions.create(
                model='gpt-oss-120b',
                messages=[
                    {'role': 'system', 'content': 'Tu es un analyste finance senior. Tu réponds toujours en JSON strict valide.'},
                    {'role': 'user', 'content': prompt},
                ],
                max_tokens=max_tokens,
                temperature=0.1,
                timeout=timeout,
            )
            content = r.choices[0].message.content
            if not content:
                last_err = 'empty content'
                time.sleep(2)
                continue
            return content
        except Exception as e:
            last_err = str(e)
            if '402' in last_err or 'Payment required' in last_err or 'Tokens per day' in last_err or 'quota' in last_err.lower():
                mark_dead(idx, last_err[:80])
                continue
            if '429' in last_err or 'rate' in last_err.lower() or 'high traffic' in last_err.lower():
                time.sleep(6)
            else:
                time.sleep(2)
    raise RuntimeError(f'cerebras failed after {retries}: {last_err}')


# ----- file discovery -----

def slug_for(ticker):
    # Match files: lowercase, dots preserved
    return ticker.lower()


def find_us_10q(ticker, max_files=4):
    found = []
    for yr in ('2026', '2025', '2024'):
        d = SEC / f'cat1-us/10Q/{yr}'
        if d.exists():
            for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
                found.append(f)
    return found[:max_files]


def find_us_10k(ticker, max_files=2):
    found = []
    for yr in ('2026', '2025', '2024'):
        d = SEC / f'cat1-us/10K/{yr}'
        if d.exists():
            for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
                found.append(f)
    return found[:max_files]


def find_fpi_6k(ticker, max_files=4):
    found = []
    for yr in ('2026', '2025', '2024'):
        d = SEC / f'cat2-foreign-adr/6K/{yr}'
        if d.exists():
            for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
                found.append(f)
    return found[:max_files]


def find_fpi_20f(ticker, max_files=2):
    found = []
    for yr in ('2026', '2025', '2024'):
        d = SEC / f'cat2-foreign-adr/20F/{yr}'
        if d.exists():
            for f in sorted(d.glob(f'{ticker}_*.htm.gz'), reverse=True):
                found.append(f)
    return found[:max_files]


def find_eu_files(ticker, max_files=4):
    # EU pures
    base = SEC / 'cat3-european' / ticker
    if not base.exists():
        return []
    found = []
    for sub in ('half-year', 'annual-text'):
        d = base / sub
        if d.exists():
            for f in sorted(d.glob('*.txt'), reverse=True):
                found.append(f)
    return found[:max_files]


# ----- text extraction -----

def read_html_gz(path):
    with gzip.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    text = re.sub(r'<[^>]+>', ' ', html)
    text = (text
            .replace('&nbsp;', ' ')
            .replace('&#160;', ' ')
            .replace('&amp;', '&')
            .replace('&#8217;', "'")
            .replace('&#8211;', '-')
            .replace('&#8212;', '-')
            .replace('&#8220;', '"')
            .replace('&#8221;', '"'))
    text = re.sub(r'\s+', ' ', text)
    return text


def read_txt(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return re.sub(r'\s+', ' ', f.read())
    except:
        return ''


def extract_mdna(text, max_chars=22000):
    """Try to extract MD&A section - skip TOC, find actual content."""
    # Find all MD&A occurrences
    positions = [m.start() for m in re.finditer(r"Management.?s Discussion and Analysis", text, re.I)]
    if not positions:
        # try "Results of Operations" or "Segment" / "Segments" headings
        m = re.search(r"Results of Operations", text, re.I)
        if m:
            return text[m.start():m.start() + max_chars]
        m = re.search(r"Segment Information|Operating Segments|Reportable Segments", text, re.I)
        if m:
            return text[m.start():m.start() + max_chars]
        return text[-max_chars:]
    # The first hit is usually TOC. Pick the LAST occurrence (real section header)
    # which is preceded by enough content
    start = positions[-1] if len(positions) >= 2 else positions[0]
    return text[start:start + max_chars]


def extract_filing_date_q(path):
    """From filename like NVDA_2025-11-19.htm.gz -> '2025-11-19' """
    name = path.name
    m = re.search(r'_(\d{4}-\d{2}-\d{2})', name)
    return m.group(1) if m else ''


# ----- prompt -----

PROMPT_TEMPLATE = """Tu es un analyste finance spécialisé en KPIs SECTORIELS.

Filing : {form_type} de {ticker} déposé le {filing_date}. Période rapportée : {period_label} (= trimestre courant, "Three Months Ended").

KPIs déjà connus (à NE PAS REPETER, ni leurs variantes/synonymes) :
{existing}

EXTRAIT du document :
---
{chunk}
---

OBJECTIF : extraire UNIQUEMENT des KPIs SECTORIELS / OPERATIONNELS NOUVEAUX pour le TRIMESTRE COURANT ({period_label}).

CIBLES VALIDES (sectoriel / business-specific) :
- Revenu par segment opérationnel (named segment, ex "Cloud Services Revenue")
- Revenu par sous-catégorie produit (ex "Networking Revenue", "iPhone Services Revenue")
- Métriques opérationnelles spécifiques au métier : abonnés, MAU, DAU, ARPU, ARPPU, volumes (units shipped, MWh, tonnes, barils), backlog/RPO contractuel, capacity, utilization rate, take rate, GMV, churn
- Revenu géographique seulement si très différenciant (ex "China Revenue" pour Apple)

EXCLUSIONS STRICTES :
- KPIs financiers génériques : Net Income, Total Revenue, Gross Margin, Operating Margin, EBIT, EBITDA, Cash & Equivalents, Total Assets, Total Debt, Interest Expense, Tax Rate, Dividends Paid, Capex (total), Restructuring, Goodwill Impairment, FX gains, Working Capital, Cash Flow lines (operating/investing/financing CF)
- KPIs déjà dans liste connue OU variantes (ex Op CF, OCF, FCF, CFO si "Operating Cash Flow" existe)
- Items YTD / 9-months / Six Months Ended (on veut SEULEMENT trimestre courant 3-months)
- Données XBRL brutes sans contexte business
- Estimations, narrative sans chiffre
- Lignes de bilan / passif / actif

Pour CHAQUE KPI : il faut un chiffre EXPLICITE pour le trimestre courant (Three Months Ended), pas YTD.

JSON strict (pas de markdown, max 6 KPIs) :
{{
  "new_kpis": [
    {{
      "short": "nom court 2-4 mots (unique)",
      "name_fr": "nom français",
      "name_en": "nom anglais",
      "value": 12.5,
      "unit": "M $" pour USD montants | "M €" pour EUR | "%" | "M users" | "K units" | "TWh" etc. TOUJOURS reporter les revenus en M (millions), JAMAIS en Mds/Bn,
      "source": "{form_type} {filing_date}"
    }}
  ]
}}

Si rien de SECTORIEL nouveau : {{"new_kpis": []}}. En cas de doute → SKIP.
"""


def call_extract(ticker, form_type, filing_date, existing_shorts, chunk, period_label='current period'):
    prompt = PROMPT_TEMPLATE.format(
        ticker=ticker,
        form_type=form_type,
        filing_date=filing_date,
        period_label=period_label,
        existing=', '.join(sorted(existing_shorts)) if existing_shorts else '(aucun)',
        chunk=chunk[:20000],
    )
    raw = cerebras_call(prompt, max_tokens=2500)
    # try parse json
    raw = raw.strip()
    # strip code fences
    if raw.startswith('```'):
        raw = re.sub(r'^```(json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # try to find json substring
        m = re.search(r'\{.*\}', raw, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except:
                pass
    return {'new_kpis': []}


# ----- merging series across quarters -----

# Blacklist of generic financial line items - never accept as new "sectoral" KPI
GENERIC_KPI_BLACKLIST = {
    'net income', 'total revenue', 'revenue', 'gross profit', 'gross margin', 'op margin',
    'operating margin', 'ebit', 'ebitda', 'ebit margin', 'ebitda margin',
    'cash', 'cash equivalents', 'total assets', 'total debt', 'net debt', 'goodwill',
    'goodwill impairment', 'impairment', 'restructuring', 'restructuring charges',
    'interest expense', 'interest income', 'tax rate', 'effective tax rate', 'income tax',
    'dividends paid', 'dividends common', 'dividends preferred', 'dividends paid common',
    'dividends paid preferred', 'capex', 'capital expenditures', 'capex outflow',
    'fx', 'fx forward proceeds', 'fx gains', 'working capital', 'working capital change',
    'trade wc', 'trade working capital', 'operating cash flow', 'op cash flow', 'op cf',
    'ocf', 'cfo', 'free cash flow', 'fcf', 'free operating cash flow', 'free ocf',
    'financing cash flow', 'investing cash flow', 'cash flow from operations',
    'roce', 'roe', 'roa', 'equity', 'stockholders equity', 'share buyback', 'buyback',
    'eps', 'diluted eps', 'basic eps', 'dps', 'share count', 'shares outstanding',
    'r&d', 'rd expense', 'sga', 'opex', 'operating expenses', 'cost of revenue', 'cogs',
    'headcount', 'employees',
    'equity income unconsolidated', 'equity in unconsolidated investments',
    'equity unconsolidated investments', 'operating profit',
    'inventory', 'receivables', 'payables', 'deferred revenue',
    'foreign currency', 'currency translation',
}


def is_generic(short):
    s = short.lower().strip()
    if s in GENERIC_KPI_BLACKLIST:
        return True
    # also reject if it ends with very generic suffix without sector qualifier
    return False


def normalize_unit(unit):
    """Normalize unit string into canonical form."""
    if not unit:
        return ''
    u = unit.strip().lower()
    u = u.replace('mds', 'bn').replace('mds$', 'bn $').replace('milliards', 'bn')
    u = u.replace('billions', 'bn').replace('billion', 'bn')
    u = u.replace('millions', 'm').replace('million', 'm')
    return unit.strip()


def unit_scale(unit):
    """Return scale factor to millions of currency."""
    u = (unit or '').lower()
    if 'bn' in u or 'mds' in u or 'milliard' in u or 'billion' in u:
        return 1000.0
    if 'k ' in u or u.startswith('k') or 'thousand' in u:
        return 0.001
    return 1.0


def normalize_short(s):
    s = s.lower().strip()
    s = re.sub(r'\b(rev|revenue|sales)\b', 'revenue', s)
    s = re.sub(r'\b(op|operating)\b', 'operating', s)
    s = re.sub(r'\b(ocf|cf)\b', 'cash flow', s)
    s = re.sub(r'\b(infra)\b', 'infrastructure', s)
    s = re.sub(r'\b(sw)\b', 'software', s)
    s = re.sub(r'\b(hw)\b', 'hardware', s)
    s = re.sub(r'\b(subs|subscribers|subscription|subscriptions)\b', 'subscriptions', s)
    s = re.sub(r'\b(cust|customer|customers)\b', 'customer', s)
    s = re.sub(r'\b(apac|asia\s*pacific|asia\s*pac)\b', 'apac', s)
    s = re.sub(r'\b(mpc|more\s*personal\s*computing|more\s*pc)\b', 'mpc', s)
    s = re.sub(r'\b(pbp|prod\s*&?\s*bus\s*proc|productivity\s*business\s*processes|prod\s*biz|productivity)\b', 'pbp', s)
    s = re.sub(r'\b(cpc|cost\s*per\s*click)\b', 'cpc', s)
    s = re.sub(r'\bpct\b|%', 'percent', s)
    s = re.sub(r'\b(total|overall|change|delta|growth|gr|increase|decrease|chg)\b', '', s)
    s = re.sub(r'[\s\-_/&Δ]+', ' ', s)
    # sort words for word-order invariance
    words = sorted(w for w in s.split() if w and len(w) > 1)
    return ' '.join(words)


def fuzzy_match_key(buckets, key):
    """Find existing bucket key that is fuzzy-similar to this key.
    Returns existing key if Jaccard similarity >= 0.6, else None.
    """
    target_words = set(key.split())
    if not target_words:
        return None
    for ekey in buckets:
        ewords = set(ekey.split())
        if not ewords:
            continue
        inter = target_words & ewords
        union = target_words | ewords
        if not union:
            continue
        jac = len(inter) / len(union)
        # also accept if one is subset of the other and ratio high
        smaller = min(len(target_words), len(ewords))
        if jac >= 0.6 or (smaller >= 2 and len(inter) >= smaller - 0):
            return ekey
    return None


def merge_kpi_series(kpis_per_q, period_type='quarter'):
    """
    kpis_per_q: list of (period_label, filing_date, [{short, value, ...}])
    Returns: list of consolidated KPI dicts with history.
    """
    buckets = {}
    for p_label, fdate, kpis in kpis_per_q:
        for k in kpis:
            short = (k.get('short') or '').strip()
            if not short:
                continue
            key = normalize_short(short)
            if not key:
                continue
            # fuzzy match against existing buckets
            existing_key = fuzzy_match_key(buckets, key)
            if existing_key:
                key = existing_key
            if key not in buckets:
                buckets[key] = {
                    'short': short,
                    'name_fr': k.get('name_fr', short),
                    'name_en': k.get('name_en', short),
                    'unit': k.get('unit', ''),
                    'samples': [],
                    'sources': [],
                }
            val = k.get('value')
            if val is None:
                continue
            try:
                v = float(val)
            except (TypeError, ValueError):
                continue
            # Convert to canonical unit of the FIRST observation
            canon_unit = buckets[key]['unit'] or k.get('unit', '')
            this_unit = k.get('unit', canon_unit)
            try:
                if canon_unit and this_unit and unit_scale(this_unit) != unit_scale(canon_unit):
                    # convert v to canon scale
                    v = v * unit_scale(this_unit) / unit_scale(canon_unit)
            except:
                pass
            buckets[key]['samples'].append((p_label, fdate, v))
            if k.get('source'):
                buckets[key]['sources'].append(k['source'])

    out = []
    for key, b in buckets.items():
        by_label = {}
        for ql, fd, v in b['samples']:
            if ql not in by_label or fd > by_label[ql][0]:
                by_label[ql] = (fd, v)
        if period_type == 'quarter':
            ordered_labels = sort_quarter_labels(by_label.keys())
        else:
            ordered_labels = sorted(by_label.keys())
        history = [by_label[l][1] for l in ordered_labels]
        history_periods = ordered_labels
        if not history:
            continue
        # Sanity rescale : if some values are 1000x off others, normalize
        abs_vals = [abs(v) for v in history if v != 0]
        if len(abs_vals) >= 2:
            mx = max(abs_vals)
            mn = min(abs_vals)
            if mx / mn > 500:
                # rescale outliers towards median
                med = sorted(abs_vals)[len(abs_vals) // 2]
                fixed = []
                for v in history:
                    av = abs(v)
                    if av == 0:
                        fixed.append(v)
                        continue
                    ratio = av / med if med > 0 else 1
                    if ratio > 500:
                        v = v / 1000
                    elif ratio < 1/500:
                        v = v * 1000
                    fixed.append(v)
                history = fixed
        out.append({
            'short': b['short'],
            'name_fr': b['name_fr'],
            'name_en': b['name_en'],
            'value': history[-1],
            'unit': b['unit'],
            'period_type': period_type,
            'history': history,
            'history_periods': history_periods,
            'is_wow': True,
            'source': '; '.join(sorted(set(b['sources']))[:3]),
            '_sa22a_added': True,
        })
    return out


def shift_yoy_label(q_label):
    # 'Q3 FY26' -> 'Q3 FY25'
    m = re.match(r'(Q\d)\s*FY(\d{2,4})', q_label)
    if m:
        yr = int(m.group(2)) - 1
        return f"{m.group(1)} FY{yr:02d}"
    m2 = re.match(r'(Q\d)\s*(\d{4})', q_label)
    if m2:
        return f"{m2.group(1)} {int(m2.group(2)) - 1}"
    return q_label + ' (YoY)'


def quarter_sort_key(label):
    m = re.match(r'Q(\d)\s*FY(\d{2,4})', label)
    if m:
        yr = int(m.group(2))
        if yr < 100:
            yr += 2000
        return (yr, int(m.group(1)))
    m2 = re.match(r'Q(\d)\s*(\d{4})', label)
    if m2:
        return (int(m2.group(2)), int(m2.group(1)))
    return (0, 0)


def sort_quarter_labels(labels):
    return sorted(set(labels), key=quarter_sort_key)


# ----- per-ticker process -----

def get_existing_shorts(slug):
    shorts = set()
    for p in (PIPELINE_DIR / f'{slug}.json', ENRICH_DIR / f'{slug}.json'):
        if p.exists():
            try:
                d = json.load(open(p))
                for k in d.get('kpis', []):
                    s = k.get('short')
                    if s:
                        shorts.add(s.strip())
            except:
                pass
    return shorts


def category_for_ticker(ticker):
    """Determine which SEC category."""
    # Check US first
    if any((SEC / f'cat1-us/10Q/{yr}').exists() for yr in ('2026','2025','2024')):
        for yr in ('2026', '2025', '2024'):
            d = SEC / f'cat1-us/10Q/{yr}'
            if d.exists() and list(d.glob(f'{ticker}_*.htm.gz')):
                return 'us'
    # FPI 6K
    for yr in ('2026', '2025', '2024'):
        d = SEC / f'cat2-foreign-adr/6K/{yr}'
        if d.exists() and list(d.glob(f'{ticker}_*.htm.gz')):
            return 'fpi'
    # EU
    if (SEC / 'cat3-european' / ticker).exists():
        return 'eu'
    return None


def process_ticker(ticker):
    slug = slug_for(ticker)
    existing = get_existing_shorts(slug)
    cat = category_for_ticker(ticker)
    result = {'ticker': ticker, 'slug': slug, 'category': cat, 'existing_count': len(existing), 'new_kpis': [], 'fail': None}
    if not cat:
        result['fail'] = 'no_source'
        return result
    max_files = MAX_FILES_PER_TICKER
    if cat == 'us':
        files = find_us_10q(ticker, max_files=max_files)
        form = '10-Q'
        period_type = 'quarter'
    elif cat == 'fpi':
        files = find_fpi_6k(ticker, max_files=max_files)
        form = '6-K'
        period_type = 'quarter'
        if not files:
            files = find_fpi_20f(ticker, max_files=1)
            form = '20-F'
            period_type = 'year'
    else:
        files = find_eu_files(ticker, max_files=max_files)
        form = 'EU semester/annual'
        period_type = 'semester'
    if not files:
        result['fail'] = 'no_files'
        return result
    kpis_per_q = []
    for f in files:
        fdate = extract_filing_date_q(f) if hasattr(f, 'name') else ''
        if not fdate:
            # use file mtime year/month as fallback
            try:
                import datetime as _dt
                ts = _dt.datetime.fromtimestamp(f.stat().st_mtime)
                fdate = ts.strftime('%Y-%m-%d')
            except:
                fdate = ''
        if str(f).endswith('.gz'):
            text = read_html_gz(f)
        else:
            text = read_txt(f)
        if not text:
            continue
        chunk = extract_mdna(text, max_chars=14000)
        if period_type == 'quarter':
            p_label = derive_quarter_label(fdate, cat)
        elif period_type == 'semester':
            p_label = derive_semester_label(fdate, f)
        else:
            p_label = f'FY{fdate[2:4]}' if fdate else 'FY?'
        try:
            resp = call_extract(ticker, form, fdate, list(existing), chunk, period_label=p_label)
        except Exception as e:
            result.setdefault('errors', []).append(f'{fdate}: {e}')
            continue
        new_kpis = resp.get('new_kpis', [])
        kpis_per_q.append((p_label, fdate, new_kpis))
    consolidated = merge_kpi_series(kpis_per_q, period_type=period_type)
    # Final filter : drop KPIs that overlap existing (fuzzy normalized) AND drop generic blacklist
    existing_norm_map = {normalize_short(s): s for s in existing}
    def overlaps_existing(short):
        key = normalize_short(short)
        if key in existing_norm_map:
            return True
        # fuzzy
        target = set(key.split())
        if not target:
            return False
        for ekey in existing_norm_map:
            ewords = set(ekey.split())
            if not ewords:
                continue
            inter = target & ewords
            union = target | ewords
            if not union:
                continue
            if len(inter) / len(union) >= 0.6:
                return True
        return False
    consolidated = [k for k in consolidated if not overlaps_existing(k['short'])]
    consolidated = [k for k in consolidated if not is_generic(k['short'])]
    consolidated = [k for k in consolidated if k.get('history') and len(k['history']) >= 1]
    # Sanity: reject if absolute value insanely large or zero
    consolidated = [k for k in consolidated if any(v != 0 for v in k['history'])]
    result['new_kpis'] = consolidated
    return result


def derive_semester_label(fdate, path):
    """For EU semester files: H1 or H2."""
    name = str(path).lower()
    if 'half-year' in name or 'h1' in name or 's1' in name:
        sem = 'H1'
    elif 'annual' in name:
        sem = 'FY'
    else:
        sem = 'H?'
    yr = fdate[:4] if fdate else '?'
    return f'{sem} {yr}'


def derive_quarter_label(fdate, cat):
    """Map filing date to quarter label using period-ending heuristic.
    10-Q is filed ~30-60 days after quarter end. So filing month - 1.5 = quarter end month.
    """
    if not fdate:
        return 'Q?'
    yr, mo, _ = fdate.split('-')
    mo_i = int(mo)
    yr_i = int(yr)
    # Approx quarter-end month = filing month - 2 (clamped)
    q_end_month = mo_i - 1
    q_end_year = yr_i
    if q_end_month <= 0:
        q_end_month += 12
        q_end_year -= 1
    # Map quarter end month -> calendar quarter
    if q_end_month in (1, 2, 3):
        q = 'Q1'; cy = q_end_year
    elif q_end_month in (4, 5, 6):
        q = 'Q2'; cy = q_end_year
    elif q_end_month in (7, 8, 9):
        q = 'Q3'; cy = q_end_year
    else:
        q = 'Q4'; cy = q_end_year
    return f'{q} {cy}'


# ----- write enrich file -----

def write_enrich(ticker, slug, new_kpis):
    fp = ENRICH_DIR / f'{slug}.json'
    if fp.exists():
        d = json.load(open(fp))
    else:
        d = {'ticker': ticker}
    kpis = d.get('kpis', [])
    # dedupe vs existing in enrich
    existing_lower = {k.get('short', '').lower() for k in kpis}
    added = 0
    for nk in new_kpis:
        if nk['short'].lower() in existing_lower:
            continue
        kpis.append(nk)
        existing_lower.add(nk['short'].lower())
        added += 1
    d['kpis'] = kpis
    log = d.get('_fix_log', [])
    for nk in new_kpis:
        if any(nk['short'].lower() in entry.lower() for entry in log):
            continue
        log.append(f"SA22-A new quarterly KPI {nk['short']}")
    d['_fix_log'] = log
    d['_sa22a_extracted_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    return added


# ----- main -----

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batches', nargs='+', default=[], help='batch ids like 00 01 02')
    ap.add_argument('--tickers-file', default=None, help='alternative path to JSON list of tickers')
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--max-files', type=int, default=2)
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    global MAX_FILES_PER_TICKER
    MAX_FILES_PER_TICKER = args.max_files

    tickers = []
    if args.tickers_file:
        with open(args.tickers_file) as f:
            tickers.extend(json.load(f))
    for b in args.batches:
        with open(f'/tmp/quart-batch-{b}.json') as f:
            tickers.extend(json.load(f))
    # dedupe preserve order
    seen = set()
    tickers = [t for t in tickers if not (t in seen or seen.add(t))]
    if args.limit:
        tickers = tickers[:args.limit]
    print(f'[sa22a] {len(tickers)} tickers')

    summary = []
    total_added = 0
    fails = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_ticker, t): t for t in tickers}
        for fut in as_completed(futures):
            t = futures[fut]
            # if all keys dead, cancel remaining
            if all(KEY_DEAD):
                for f in futures:
                    if not f.done():
                        f.cancel()
                fails.append((t, 'all_keys_dead'))
                continue
            try:
                r = fut.result()
            except Exception as e:
                fails.append((t, str(e)))
                print(f'[FAIL] {t}: {str(e)[:80]}')
                continue
            n = len(r['new_kpis'])
            if r['fail']:
                fails.append((t, r['fail']))
                print(f'[skip] {t}: {r["fail"]}')
                continue
            if n == 0:
                print(f'[zero] {t}: no new KPIs')
            else:
                if not args.dry_run:
                    added = write_enrich(t, r['slug'], r['new_kpis'])
                else:
                    added = n
                total_added += added
                print(f'[ok] {t}: +{added} new ({", ".join(k["short"] for k in r["new_kpis"][:4])})', flush=True)
            summary.append({'ticker': t, 'new': n, 'shorts': [k['short'] for k in r['new_kpis']]})
            # Persist summary incrementally
            with open('/tmp/sa22a-summary.json', 'w') as f:
                json.dump({'total_added': total_added, 'summary': summary, 'fails': fails}, f, indent=2)
    # print final summary
    summary.sort(key=lambda x: -x['new'])
    print('\n=== TOP 10 ===')
    for s in summary[:10]:
        print(f"  {s['ticker']}: +{s['new']} ({', '.join(s['shorts'][:6])})")
    print(f'\nTotal new KPIs added: {total_added}')
    print(f'Fails: {len(fails)}')
    for t, why in fails[:20]:
        print(f'  {t}: {why}')
    # write summary
    with open('/tmp/sa22a-summary.json', 'w') as f:
        json.dump({'total_added': total_added, 'summary': summary, 'fails': fails}, f, indent=2)


if __name__ == '__main__':
    main()
