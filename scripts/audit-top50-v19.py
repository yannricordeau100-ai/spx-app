#!/usr/bin/env python3
"""
Audit des top 50 stés V1.9 (read-only) pour bugs résiduels.
Sortie: src/data/v1-9-top50-audit.json
"""
import json, os, re
from pathlib import Path

ROOT = Path('/Users/yann/spx-app')
V19 = ROOT / 'src/data/v1-9-complete'
V2P = ROOT / 'src/data/v2-pipeline'

# Charger top307 et dédupliquer par name
top = json.load(open(ROOT / 'src/data/top307-breakdown.json'))
top_sorted = sorted(top, key=lambda x: -x.get('market_cap_usd', 0))
seen_names = set()
top50 = []
for s in top_sorted:
    n = s.get('name', '')
    if n in seen_names:
        continue
    seen_names.add(n)
    top50.append(s)
    if len(top50) >= 50:
        break

# Tickers V1 critiques manquants de top307 (récupération manuelle)
EXTRA_TICKERS = ['AMZN', 'META', 'MA', 'WMT', 'AMD', 'XOM', 'BRK-B']
existing_t = {x['ticker'] for x in top50}
for t in EXTRA_TICKERS:
    if t not in existing_t and (V19 / f'{t}.json').exists():
        top50.append({'ticker': t, 'name': t, 'country': 'United States'})

GENERIC_KPIS = {
    'revenue', 'net revenue', 'total revenue',
    'ebitda', 'adjusted ebitda',
    'eps', 'earnings per share', 'diluted eps',
    'net income', 'net earnings',
    'operating margin', 'op margin',
    'gross profit', 'gross margin',
}

EM_DASH = '—'  # '—'

def has_em_dash(text):
    if not isinstance(text, str):
        return False
    return EM_DASH in text

def is_generic_kpi(name):
    if not isinstance(name, str):
        return False
    return name.strip().lower() in GENERIC_KPIS

def is_raw_unscaled(val):
    """Détecte une valeur brute non rescalée style '65 872 000000,0 $'."""
    if not isinstance(val, str):
        return False
    # Beaucoup de zéros consécutifs ou chiffres > 10 d'affilée
    digits_only = re.sub(r'[^0-9]', '', val)
    return len(digits_only) >= 10  # > 10 milliards en brut

def audit_ticker(entry):
    ticker = entry['ticker']
    name = entry.get('name', ticker)
    country = entry.get('country', '?')
    issues = []

    v19_path = V19 / f'{ticker}.json'
    if not v19_path.exists():
        issues.append({'code': 'MISSING_V19_FILE', 'detail': str(v19_path)})
        return {'ticker': ticker, 'name': name, 'country': country, 'issues': issues}

    try:
        d = json.load(open(v19_path))
    except Exception as e:
        issues.append({'code': 'INVALID_JSON', 'detail': str(e)})
        return {'ticker': ticker, 'name': name, 'country': country, 'issues': issues}

    # a) Ranks tous "≈ #1" — ranks values sont des strings type "#1" ou "#3 dans X"
    ranks = d.get('ranks') or {}
    rank_fields = ['global_world', 'global_us', 'sector', 'subsector']
    rank_vals = []

    def extract_rank_num(v):
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, dict):
            return v.get('rank') or v.get('value')
        if isinstance(v, str):
            m = re.search(r'#\s*(\d+)', v)
            if m:
                return int(m.group(1))
        return None

    for rf in rank_fields:
        r = ranks.get(rf)
        rank_vals.append((r, extract_rank_num(r)))
    near_one = sum(1 for _, n in rank_vals if isinstance(n, (int, float)) and n <= 2)
    # NVDA est légitimement #1 partout — on flag uniquement si pays != US et tous #1 (suspect)
    # ou si secteur != attendu. Pour l'instant, on flag les cas suspicieux : rank=1 sur global_world ET global_us pour stés non-US
    country_raw = (d.get('country') or '').upper()
    if near_one == 4 and country_raw not in ('US', 'UNITED STATES', 'USA'):
        issues.append({
            'code': 'RANKS_ALL_1_NON_US_SUSPECT',
            'detail': {rf: r for rf, (r, _) in zip(rank_fields, rank_vals)}
        })

    # Ranks tous null ou manquants
    nulls = sum(1 for r, _ in rank_vals if r is None or r == '')
    if nulls >= 3:
        issues.append({'code': 'RANKS_MOSTLY_NULL', 'detail': {rf: r for rf, (r, _) in zip(rank_fields, rank_vals)}})

    # Ranks malformés (": ", chaine vide-ish, "Non US" inconsistent avec global_us numérique attendu)
    malformed = []
    for rf, (r, n) in zip(rank_fields, rank_vals):
        if isinstance(r, str):
            stripped = r.strip()
            if stripped in (':', ': ', '—', '-', 'N/A', 'n/a', 'NA'):
                malformed.append({rf: r})
    if malformed:
        issues.append({'code': 'RANKS_MALFORMED', 'detail': malformed})

    # Country incohérent: country='US' mais ticker non-US (suffixe .XX) ou ranks indiquent 'Non US'
    has_non_us_suffix = '.' in ticker and not ticker.endswith('.US')
    global_us_val = ranks.get('global_us')
    suggests_non_us = isinstance(global_us_val, str) and 'non us' in global_us_val.lower()
    if country_raw in ('US', 'UNITED STATES', 'USA'):
        if has_non_us_suffix or suggests_non_us:
            issues.append({
                'code': 'COUNTRY_MISLABELED_US',
                'detail': {'country': d.get('country'), 'ticker': ticker, 'global_us': global_us_val}
            })

    # b) Hero history length — hero_kpi est un string (nom), data dans kpis[0]
    hero_name = d.get('hero_kpi') if isinstance(d.get('hero_kpi'), str) else None
    kpis = d.get('kpis') or []
    hero_kpi_obj = None
    if isinstance(kpis, list):
        # Match by hero_name d'abord, sinon prendre kpis[0]
        if hero_name:
            for k in kpis:
                if isinstance(k, dict) and (
                    k.get('short') == hero_name or k.get('name_en') == hero_name or k.get('name_fr') == hero_name
                ):
                    hero_kpi_obj = k
                    break
        if hero_kpi_obj is None and kpis:
            hero_kpi_obj = kpis[0] if isinstance(kpis[0], dict) else None

    hist = []
    period_type = 'quarter'
    if isinstance(hero_kpi_obj, dict):
        hist = hero_kpi_obj.get('history') or hero_kpi_obj.get('series') or []
        period_type = hero_kpi_obj.get('period_type') or hero_kpi_obj.get('periodicity') or 'quarter'
    if isinstance(hist, list):
        n = len(hist)
        if n == 0:
            issues.append({'code': 'HERO_HIST_EMPTY', 'detail': 0})
        elif period_type == 'quarter' and n < 18:
            issues.append({'code': 'HERO_HIST_SHORT_Q', 'detail': f'{n} quarters (<18)'})
        elif period_type == 'year' and n < 5:
            issues.append({'code': 'HERO_HIST_SHORT_Y', 'detail': f'{n} years (<5)'})

    # c) Em-dash
    em_locations = []
    for field in ['hero_kpi_rationale', 'company_description', 'tagline']:
        v = d.get(field)
        if has_em_dash(v):
            em_locations.append(field)
    # Risks
    risks = d.get('risks') or []
    for i, r in enumerate(risks if isinstance(risks, list) else []):
        if isinstance(r, dict):
            for k in ['description', 'signal', 'name', 'title', 'description_fr', 'description_en']:
                if has_em_dash(r.get(k)):
                    em_locations.append(f'risks[{i}].{k}')
        elif has_em_dash(r):
            em_locations.append(f'risks[{i}]')
    # KPIs descriptions
    if isinstance(kpis, list):
        for i, k in enumerate(kpis):
            if isinstance(k, dict):
                for kk in ['description_fr', 'description_en', '_specific_to']:
                    if has_em_dash(k.get(kk)):
                        em_locations.append(f'kpis[{i}].{kk}')
    if em_locations:
        issues.append({'code': 'EM_DASH_PRESENT', 'detail': em_locations[:5]})

    # d) Hero KPI générique
    if is_generic_kpi(hero_name):
        issues.append({'code': 'HERO_KPI_GENERIC', 'detail': hero_name})

    # e) Segments + Geography
    def count_slices(x):
        if x is None: return 0
        if isinstance(x, dict):
            return len(x.get('slices', x.get('breakdown', [])))
        if isinstance(x, list):
            if not x: return 0
            last = x[-1]
            if isinstance(last, dict) and 'breakdown' in last:
                return len(last['breakdown'])
            if isinstance(last, dict) and 'slices' in last:
                return len(last['slices'])
            return len(x)
        return 0
    seg_slices = count_slices(d.get('revenue_by_segment'))
    geo_slices = count_slices(d.get('revenue_by_geography'))

    single_region_legit = d.get('single_region_legitimate', False)
    if seg_slices < 2:
        issues.append({'code': 'SEG_LT_2', 'detail': seg_slices})
    if geo_slices < 2 and not single_region_legit:
        issues.append({'code': 'GEO_LT_2', 'detail': geo_slices})

    # f) Description >= 100 chars
    desc = d.get('company_description') or ''
    if not isinstance(desc, str) or len(desc.strip()) < 100:
        issues.append({'code': 'DESC_LT_100', 'detail': len(desc) if isinstance(desc, str) else 0})

    # g) Risks >= 3
    n_risks = len(risks) if isinstance(risks, list) else 0
    if n_risks < 3:
        # US-only requirement; for non-US we still flag but separately
        if country_raw in ('US', 'UNITED STATES', 'USA'):
            issues.append({'code': 'RISKS_LT_3_US', 'detail': n_risks})
        else:
            issues.append({'code': 'RISKS_LT_3', 'detail': n_risks})

    # h) Unit cohérence: scan KPIs et hero values
    raw_locations = []
    # Hero history values
    if isinstance(hist, list):
        for pt in hist[:5]:
            if isinstance(pt, dict):
                for k in ['value', 'value_display', 'display', 'label']:
                    v = pt.get(k)
                    if is_raw_unscaled(v):
                        raw_locations.append(f'hero.history.{k}={v}')
                        break
    # KPIs
    kpis = d.get('kpis') or []
    if isinstance(kpis, list):
        for i, k in enumerate(kpis):
            if not isinstance(k, dict):
                continue
            for vfield in ['value_display', 'display', 'latest_display']:
                v = k.get(vfield)
                if is_raw_unscaled(v):
                    raw_locations.append(f'kpis[{i}].{vfield}={v}')
                    break
    if raw_locations:
        issues.append({'code': 'UNIT_RAW_UNSCALED', 'detail': raw_locations[:3]})

    return {
        'ticker': ticker,
        'name': name,
        'country': country,
        'sector': entry.get('sector'),
        'market_cap_usd': entry.get('market_cap_usd'),
        'issues': issues,
    }


# Run audit
results = []
for s in top50:
    results.append(audit_ticker(s))

# Stats globales
issue_counts = {}
for r in results:
    for i in r['issues']:
        issue_counts[i['code']] = issue_counts.get(i['code'], 0) + 1

# Top stés problématiques
worst = sorted(results, key=lambda r: -len(r['issues']))[:10]

output = {
    'generated_at': '2026-05-21',
    'n_tickers': len(results),
    'issue_counts': dict(sorted(issue_counts.items(), key=lambda x: -x[1])),
    'top10_worst': [{'ticker': w['ticker'], 'name': w['name'], 'n_issues': len(w['issues']),
                     'codes': [i['code'] for i in w['issues']]} for w in worst],
    'per_ticker': results,
}

out_path = ROOT / 'src/data/v1-9-top50-audit.json'
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f'Wrote {out_path}')
print(f'\nTotal stés: {len(results)}')
total_issues = sum(len(r["issues"]) for r in results)
print(f'Total issues: {total_issues}')
print(f'\nIssue counts:')
for k, v in output['issue_counts'].items():
    print(f'  {k:30s} {v}')
print(f'\nTop 10 worst:')
for w in worst:
    codes = ', '.join(i['code'] for i in w['issues'])
    print(f'  {w["ticker"]:8s} {w["name"][:30]:30s} {len(w["issues"])} issues: {codes}')
