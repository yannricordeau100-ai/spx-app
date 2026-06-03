#!/usr/bin/env python3
"""
SA24-G — Fix systémique V1.9.5 batches 24-27 (~80 stés).

3 tâches programmatiques (zero LLM, zero API payante) :
  1) Extension history via SEC EDGAR companyfacts XBRL :
       - period_type=quarter avec n<20  -> tenter atteindre 20 trims (5 ans)
       - period_type=year    avec n<5   -> tenter atteindre 5 ans
  2) Normalisation period_type : 'annual'/None -> 'year' (heuristique
     date span ; sinon 'year' par défaut pour les <5 points).
  3) Rescale value+history en [1,999] (règle 1-999 systémique).

Approche additive : deep merge dans v2-pipeline-enrich/<slug>.json.
Pour les nouveaux KPIs sectoriels : non visés ici (Anthropic API payante
interdite + Cerebras épuisé + Mac fragile + race conditions SA22-D).
Le bloc reste éligible via 10-Q BS4 si patterns whitelistés évidents
(skip si bruyant).

Signature : _fix_log: ['SA24-G ...']
Output : 1 commit unique à la fin.
"""
import json
import gzip
import os
import sys
import time
import urllib.request
import urllib.error
import ssl
from pathlib import Path
from datetime import datetime

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path('/Users/yann/spx-app')
PIPELINE = ROOT / 'src/data/v2-pipeline'
ENRICH = ROOT / 'src/data/v2-pipeline-enrich'
CIK_INDEX_PATH = ROOT / 'sec-data/_meta/cat1-cat2-index.json'
UA = 'Mettrik SA24-G contact@mettrik.ai'
SEC_BASE = 'https://data.sec.gov/api/xbrl/companyfacts'
SLEEP = 0.2  # ~5 req/s, sous limite SEC 10 req/s — Mac fragile

TICKERS = [
    "AES","ARGX","BJ","CAVA","COHR","DE","ED","FAST","GLEN.L","HUM","JNJ",
    "LRCX","MRNA","NOVN.SW","PCAR","QCOM","SMCI","TEL","UNM","WMB","AFL",
    "ARM","BK","CBOE","COIN","DECK","EDP.LS","FCX","GLPI","HWM","JPM",
    "LULU","MRSH","NOW","PCG","RBA","SMTC","TEL2-B.ST","UNP","WMS",
    "AGN.AS","ASML","BKNG","CBRE","COO","DELL","EDPFY","FDS","GLW","IBKR",
    "KDP","LUV","MS","NRG","PEG","RCL","SNA","TER","UPS","WMT","AIG",
    "ASMLF","BKR","CCEP","COP","DG","EFX","FDX","GM","IBM","KER.PA","LVS",
    "MSCI","NSC","PEP","RDDT","SNAP","TFC","URI","WRB",
]

# Eviter races SA22-D actif (selon SHARED-STATUS PID 39604, batches 24-27 chevauchent ~59)
# On NE saute pas l'écriture mais on procède avec deep-merge prudent
# (champs distincts : on touche kpis[*].history, kpis[*].value, kpis[*].period_type, kpis[*]._fix_log).

# Mapping KPI -> us-gaap tags. Liste large, priorité haute -> basse.
KPI_TAGS = {
    'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet'],
    'net income': ['NetIncomeLoss', 'ProfitLoss'],
    'operating income': ['OperatingIncomeLoss'],
    'gross profit': ['GrossProfit'],
    'eps': ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
    'dividend': ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
    'capex': ['PaymentsToAcquirePropertyPlantAndEquipment'],
    'r&d': ['ResearchAndDevelopmentExpense'],
    'cash': ['CashAndCashEquivalentsAtCarryingValue', 'Cash'],
    'total assets': ['Assets'],
    'stockholders equity': ['StockholdersEquity'],
    'operating cash flow': ['NetCashProvidedByUsedInOperatingActivities'],
    'free cash flow': [],  # calculé OCF - Capex
    'op margin': [],  # calculé
    'gross margin': [],
}

KPI_SHORT_MAP = {
    'Revenue': 'revenue', 'Total Revenue': 'revenue', 'Net Sales': 'revenue',
    'Net Income': 'net income', 'NI': 'net income',
    'Operating Income': 'operating income', 'Op Income': 'operating income', 'EBIT': 'operating income',
    'Gross Profit': 'gross profit',
    'EPS': 'eps', 'Diluted EPS': 'eps', 'Basic EPS': 'eps',
    'DPS': 'dividend', 'Dividend': 'dividend',
    'Capex': 'capex', 'CAPEX': 'capex',
    'R&D': 'r&d', 'RD': 'r&d',
    'Cash': 'cash', 'Cash & Equivalents': 'cash',
    'Total Assets': 'total assets',
    'Equity': 'stockholders equity',
    'OCF': 'operating cash flow', 'Op Cash Flow': 'operating cash flow',
    'FCF': 'free cash flow', 'Free Cash Flow': 'free cash flow',
    'Op Margin': 'op margin', 'Operating Margin': 'op margin',
    'Gross Margin': 'gross margin',
}

# Cache companyfacts
_cf_cache = {}

def slugify(t):
    return t.lower().replace('-', '-').replace('.', '.')

def load_cik_index():
    return json.loads(CIK_INDEX_PATH.read_text())

def fetch_companyfacts(cik):
    if cik in _cf_cache:
        return _cf_cache[cik]
    url = f"{SEC_BASE}/CIK{cik:010d}.json"
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    try:
        time.sleep(SLEEP)
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=20) as r:
            data = json.loads(r.read())
        _cf_cache[cik] = data
        return data
    except Exception as e:
        print(f"  cfacts fail CIK {cik}: {e}", file=sys.stderr)
        _cf_cache[cik] = None
        return None

def normalize_period_type(kpi):
    """Tâche 2 : 'annual'/None -> 'year'/'quarter' heuristique."""
    pt = kpi.get('period_type')
    if pt in ('year', 'quarter', 'month', 'semester'):
        return pt, False
    # 'annual' -> 'year'
    if pt == 'annual':
        return 'year', True
    # None / unknown : on regarde span via last_data_date + history len
    h = kpi.get('history') or []
    if not h:
        return 'year', True  # défaut sûr
    # peu de points et span large -> year ; beaucoup -> quarter
    n = len([x for x in h if x is not None])
    if n >= 8:
        return 'quarter', True
    return 'year', True

def get_xbrl_history(facts, tag, want_quarterly):
    """Retourne liste [(end_date, val)] triés chronologiquement."""
    if not facts or tag not in facts.get('facts', {}).get('us-gaap', {}):
        return []
    units = facts['facts']['us-gaap'][tag].get('units', {})
    # On accepte USD ou USD/shares
    pts = []
    for unit_name, vals in units.items():
        for v in vals:
            form = v.get('form', '')
            fp = v.get('fp', '')
            end = v.get('end')
            val = v.get('val')
            if val is None or end is None:
                continue
            if want_quarterly:
                # Q1/Q2/Q3 du 10-Q sont déjà trimestriels.
                if form == '10-Q' and fp in ('Q1', 'Q2', 'Q3'):
                    pts.append((end, val, fp, form, unit_name))
                # Q4 = FY 10-K, à calculer ensuite via FY - (Q1+Q2+Q3)
                elif form == '10-K' and fp == 'FY':
                    pts.append((end, val, 'FY', form, unit_name))
            else:
                if form == '10-K' and fp == 'FY':
                    pts.append((end, val, fp, form, unit_name))
    # Dédup par end date
    seen = {}
    for end, val, fp, form, unit in pts:
        key = (end, fp)
        if key not in seen:
            seen[key] = (val, unit)
    return sorted(seen.items())

def extend_year_history(facts, kpi):
    """Tente d'étendre history annuelle à 5 ans via XBRL FY 10-K."""
    short = kpi.get('short') or kpi.get('name_en') or kpi.get('name_fr') or ''
    short_norm = short.strip()
    family = KPI_SHORT_MAP.get(short_norm)
    if not family:
        # tolérance fuzzy
        for k in KPI_SHORT_MAP:
            if k.lower() == short_norm.lower():
                family = KPI_SHORT_MAP[k]
                break
    if not family:
        return None
    tags = KPI_TAGS.get(family, [])
    if not tags:
        return None
    if not facts:
        return None
    for tag in tags:
        pts = get_xbrl_history(facts, tag, want_quarterly=False)
        if len(pts) >= 5:
            # Prendre les 5 derniers FY
            fy_pts = [(end, v[0]) for (end, _fp), v in pts if _fp == 'FY']
            fy_pts = sorted(fy_pts)[-5:]
            if len(fy_pts) >= 5:
                return [p[1] for p in fy_pts]
    return None

def extend_quarter_history(facts, kpi, target=20):
    """Tente d'étendre history trimestrielle à 20 trims via XBRL."""
    short = kpi.get('short') or kpi.get('name_en') or kpi.get('name_fr') or ''
    short_norm = short.strip()
    family = KPI_SHORT_MAP.get(short_norm)
    if not family:
        for k in KPI_SHORT_MAP:
            if k.lower() == short_norm.lower():
                family = KPI_SHORT_MAP[k]
                break
    if not family:
        return None
    tags = KPI_TAGS.get(family, [])
    if not tags:
        return None
    if not facts:
        return None
    for tag in tags:
        # Récupère Q1/Q2/Q3 du 10-Q + FY 10-K
        pts = get_xbrl_history(facts, tag, want_quarterly=True)
        if not pts:
            continue
        # Indexer FY et Qs par year
        by_year = {}
        for (end, fp), (val, _unit) in pts:
            y = end[:4]
            by_year.setdefault(y, {})[fp] = (end, val)
        # Construire série trimestrielle : Q1, Q2, Q3, Q4 par année
        series = []
        for y in sorted(by_year.keys()):
            q = by_year[y]
            q1 = q.get('Q1', (None, None))[1]
            q2 = q.get('Q2', (None, None))[1]
            q3 = q.get('Q3', (None, None))[1]
            fy = q.get('FY', (None, None))[1]
            # Q4 = FY - (Q1+Q2+Q3) si tous présents
            q4 = None
            if all(v is not None for v in [q1, q2, q3, fy]):
                q4 = fy - q1 - q2 - q3
            for label, v in [('Q1', q1), ('Q2', q2), ('Q3', q3), ('Q4', q4)]:
                if v is not None:
                    series.append((y, label, v))
        if len(series) >= 4:
            # Prendre les target derniers
            series = series[-target:]
            return [s[2] for s in series]
    return None

def _to_num(x):
    """Coerce to float if possible, else None."""
    if x is None:
        return None
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        return float(x)
    if isinstance(x, str):
        s = x.strip().replace(',', '').replace(' ', '').replace('%', '').replace('$', '')
        try:
            return float(s)
        except (ValueError, TypeError):
            return None
    return None

def rescale_1_999(value, history):
    """Tâche 4 : rescale [1, 999]. Conserve les ratios.
       On ne touche que si max(abs) > 999 OU 0 < max(abs) < 1.
       Préserve signe."""
    v_num = _to_num(value)
    h_nums = []
    if history:
        for x in history:
            n = _to_num(x)
            if n is not None:
                h_nums.append(n)
    flat = [v_num] + h_nums
    flat = [x for x in flat if x is not None]
    if not flat:
        return value, history, None
    nums = [abs(x) for x in flat]
    if not nums:
        return value, history, None
    mx = max(nums)
    if mx == 0:
        return value, history, None
    if 1 <= mx <= 999:
        return value, history, None  # déjà dans range
    factor = None
    if mx > 999:
        # diviser par puissance de 1000
        f = 1
        while mx / f > 999:
            f *= 1000
        factor = 1 / f
    elif mx < 1:
        f = 1
        while mx * f < 1:
            f *= 1000
        factor = f
    if factor is None:
        return value, history, None
    def rs(x):
        n = _to_num(x)
        if n is None:
            return x  # garde tel quel si non-numérique
        return round(n * factor, 4)
    new_value = rs(value)
    new_history = [rs(x) for x in (history or [])]
    return new_value, new_history, factor

def deep_merge_kpis(existing_kpis, updates):
    """Merge updates (par short) dans existing list non-destructif."""
    if not existing_kpis:
        return list(updates.values())
    idx = {}
    for i, k in enumerate(existing_kpis):
        short = k.get('short')
        if short and short not in idx:
            idx[short] = i
    out = [dict(k) for k in existing_kpis]
    for short, upd in updates.items():
        if short in idx:
            out[idx[short]].update(upd)
        else:
            out.append(upd)
    return out

def process_ticker(ticker, cik_index):
    slug = ticker.lower()
    pipe_file = PIPELINE / f"{slug}.json"
    enrich_file = ENRICH / f"{slug}.json"
    if not pipe_file.exists():
        return None
    try:
        pipe_data = json.loads(pipe_file.read_text())
    except Exception as e:
        print(f"  read fail {ticker}: {e}", file=sys.stderr)
        return None
    kpis = pipe_data.get('kpis') or []
    if not kpis:
        return None

    cik_entry = cik_index.get(ticker)
    cik = cik_entry.get('cik') if cik_entry else None
    facts = None
    if cik:
        facts = fetch_companyfacts(cik)

    fix_count = {'period_type': 0, 'history_year': 0, 'history_quarter': 0, 'rescale': 0}
    enrich_kpis_updates = {}

    for k in kpis:
        short = k.get('short')
        if not short:
            continue
        update = {}
        log_entries = []

        # Tâche 2 : normaliser period_type
        new_pt, changed = normalize_period_type(k)
        cur_pt = k.get('period_type')
        if changed:
            update['period_type'] = new_pt
            log_entries.append(f"SA24-G period_type {cur_pt}->{new_pt}")
            fix_count['period_type'] += 1

        effective_pt = new_pt

        # Tâche 1 : extension history (XBRL).
        # ATTENTION : SEC XBRL Q-series mélange YTD/quarter. Désactivé sauf
        # année (FY 10-K), qui est non-ambigu et utile pour combler n<5.
        h = k.get('history') or []
        h_valid = [x for x in h if x is not None]
        new_history = None
        if effective_pt == 'year' and len(h_valid) < 5 and facts:
            ext = extend_year_history(facts, k)
            if ext and len(ext) > len(h_valid):
                # vérifier cohérence de magnitude avec value existante
                cur_v = _to_num(k.get('value'))
                ext_last = ext[-1] if ext else None
                if cur_v is not None and ext_last is not None and cur_v != 0:
                    ratio = abs(ext_last) / max(abs(cur_v), 1e-9)
                    # On accepte si ratio dans [0.5, 2] (même magnitude) OU si
                    # ratio est puissance de 1000 (scale différent, on garde et rescale ensuite)
                    if 0.5 <= ratio <= 2:
                        new_history = ext
                        log_entries.append(f"SA24-G year_history {len(h_valid)}->{len(ext)} via XBRL")
                        fix_count['history_year'] += 1
                else:
                    new_history = ext
                    log_entries.append(f"SA24-G year_history {len(h_valid)}->{len(ext)} via XBRL")
                    fix_count['history_year'] += 1

        # Quarterly extension DÉSACTIVÉE pour anti-bruit (YTD vs quarter ambigu).
        # (sera réactivé dans une mission ultérieure avec validation per-fp + span)

        history_for_rescale = new_history if new_history else h
        value_for_rescale = k.get('value')

        # Tâche 4 : rescale [1, 999], conservatif.
        # Skip si value déjà dans range raisonnable.
        v_num_check = _to_num(value_for_rescale)
        already_in_range = (v_num_check is not None
                            and abs(v_num_check) >= 0.01
                            and abs(v_num_check) <= 999)
        if not already_in_range:
            rv, rh, factor = rescale_1_999(value_for_rescale, history_for_rescale)
            if factor is not None and factor != 1:
                update['value'] = rv
                if new_history:
                    update['history'] = rh
                elif rh != h:
                    update['history'] = rh
                log_entries.append(f"SA24-G rescale factor={factor}")
                fix_count['rescale'] += 1
            elif new_history:
                update['history'] = new_history
        elif new_history:
            update['history'] = new_history

        if log_entries:
            existing_log = k.get('_fix_log') or []
            update['_fix_log'] = list(existing_log) + log_entries

        if update:
            # Pour que load-company.ts merge fasse gagner notre version
            # (winner choisi sur enrichLen >= existingLen), on duplique
            # le history du pipeline dans notre kpi enrich. Ainsi
            # period_type/value corrigés s'appliquent vraiment côté UI.
            base_fields = {
                'short': short,
                'period_type': effective_pt,
                'value': k.get('value') if 'value' not in update else update.get('value'),
                'history': k.get('history') if 'history' not in update else update.get('history'),
            }
            enrich_kpis_updates[short] = {**base_fields, **update}

    if not enrich_kpis_updates:
        return {'ticker': ticker, 'fixes': fix_count, 'changed': False}

    # Deep merge dans enrich
    enrich_data = {}
    if enrich_file.exists():
        try:
            enrich_data = json.loads(enrich_file.read_text())
        except Exception:
            enrich_data = {}

    existing_enrich_kpis = enrich_data.get('kpis') or []
    merged = deep_merge_kpis(existing_enrich_kpis, enrich_kpis_updates)
    enrich_data['kpis'] = merged
    enrich_data['_sa24g_processed_at'] = datetime.utcnow().isoformat() + 'Z'

    # Écriture atomique
    tmp = enrich_file.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(enrich_data, ensure_ascii=False, indent=2))
    tmp.replace(enrich_file)

    return {'ticker': ticker, 'fixes': fix_count, 'changed': True}

def main():
    print(f"SA24-G start: {len(TICKERS)} tickers", file=sys.stderr)
    cik_index = load_cik_index()
    stats = {'total': 0, 'changed': 0, 'no_cik': 0,
             'period_type': 0, 'history_year': 0, 'history_quarter': 0, 'rescale': 0}
    for i, t in enumerate(TICKERS, 1):
        stats['total'] += 1
        if t not in cik_index:
            stats['no_cik'] += 1
        try:
            r = process_ticker(t, cik_index)
        except Exception as e:
            print(f"  [{i}/{len(TICKERS)}] {t} ERROR: {e}", file=sys.stderr)
            continue
        if r and r.get('changed'):
            stats['changed'] += 1
            for k, v in r['fixes'].items():
                stats[k] += v
            print(f"  [{i}/{len(TICKERS)}] {t}: {r['fixes']}", file=sys.stderr)
        else:
            print(f"  [{i}/{len(TICKERS)}] {t}: no change", file=sys.stderr)
    print(f"\nSA24-G done: {json.dumps(stats, indent=2)}")

if __name__ == '__main__':
    main()
