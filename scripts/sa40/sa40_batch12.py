#!/usr/bin/env python3
"""SA40 batch 12 — KPIs year → 10-Q MD&A narrative parser for sectoral KPIs.

Scope sectoriels (mission): Backlog, Headcount, AUM, Comp Sales, Insurance Premiums, Subscribers.
Règle : ≥4 trims extractibles → period_type='quarter'. JAMAIS INVENTER.

Batch12 tickers analysis (audit autonome) :
  - TSLA, UBER, UDR, WBD, WDAY, WWD, XOM, A, ACGL, ADM, ADP, AEE, AIG, AMT, APH,
    BMRN, CBOE, CFG, CGNX, CLX, CNP : aucun year_kpi sectoriel correspondant.
  - TXT, ABT, ADBE, AMAT, ATO : Headcount year. 10-Q NE narre PAS le headcount
    (présent uniquement 10-K). Conversion impossible.
  - CINF : Underwriting Profitability year hist=0. Pas de valeur de départ.
  - BURL : Store Openings/Net New Stores year. Format YTD cumulatif dans 10-Q,
    conversion en trimestres délicate (déduction = invention).
  - UBER MAPCs (year) : Subscribers sectoriel, parseable depuis MD&A 10-Q
    récurrente ("MAPCs ) (2) <prior> <current> <%change>"). 8 trims trouvés
    Q2-2023→Q3-2025, + Q4-2024 et Q4-2025 dans history year existante (10-K).
    Total = 10 trims. ≥4 ✓ → CONVERSION QUARTER OK.

Résultat batch12 : 1 KPI converti (UBER MAPCs year → quarter, 10 trims).

_fix_log = "SA40-Claude 2026-06-03"
NE PAS commit (validation Yann).
"""
import json
from pathlib import Path

ROOT = Path.home() / 'spx-app'
DATA = ROOT / 'src/data/v2-pipeline'
TODAY = '2026-06-03'
FIX_LOG_TAG = f'SA40-Claude {TODAY}'

# UBER MAPCs quarterly values extracted from 10-Q MD&A narratives.
# Source: /Users/yann/Mettrik/sec-data/cat1-us/10Q/<YYYY>/UBER_<filing-date>.htm.gz
# Pattern: "MAPCs ) (2) <prior_year_period_value> <current_period_value> <% YoY>"
# Each 10-Q reports the MAPC of its quarter-end. We took the *current period* value.
# Q4 values come from existing year history (10-K-sourced, untouched).
UBER_MAPCS_QUARTERLY = [
    # (fiscal_period_label, mapc_in_millions, source 10-Q file)
    ('2023-Q2', 137, '10Q/2023/UBER_2023-08-02.htm.gz'),
    ('2023-Q3', 142, '10Q/2023/UBER_2023-11-07.htm.gz'),
    # 2023-Q4 = 150 (from 10-K 2024-02-15: "MAPCs 131 150"), not used (mission says 10-Q narrative).
    # Yet history year existante = [171, 202] = Q4-2024 + Q4-2025 EOY → réutilisable car déjà présent.
    ('2024-Q1', 149, '10Q/2024/UBER_2024-05-08.htm.gz'),
    ('2024-Q2', 156, '10Q/2024/UBER_2024-08-06.htm.gz'),
    ('2024-Q3', 161, '10Q/2024/UBER_2024-10-31.htm.gz'),
    ('2024-Q4', 171, 'history year[0] preserved (Q4 EOY 2024)'),
    ('2025-Q1', 170, '10Q/2025/UBER_2025-05-07.htm.gz'),
    ('2025-Q2', 180, '10Q/2025/UBER_2025-08-06.htm.gz'),
    ('2025-Q3', 189, '10Q/2025/UBER_2025-11-04.htm.gz'),
    ('2025-Q4', 202, 'history year[1] preserved (Q4 EOY 2025)'),
]


def apply_uber_mapcs(apply=False):
    fp = DATA / 'uber.json'
    with open(fp) as f:
        d = json.load(f)

    target = None
    for k in d.get('kpis', []):
        if k.get('short') == 'MAPCs' and k.get('period_type') == 'year':
            target = k
            break

    if not target:
        print('UBER MAPCs year KPI not found, skipping')
        return False

    series = [v for _, v, _ in UBER_MAPCS_QUARTERLY]
    if len(series) < 4:
        print(f'UBER MAPCs : only {len(series)} trims (<4), skipping')
        return False

    new_value = series[-1]
    if len(series) >= 5 and series[-5] not in (0, None):
        yoy = (series[-1] / series[-5] - 1) * 100
        yoy_str = f'{yoy:+.1f}%'
    else:
        yoy_str = target.get('yoy')

    print(f'UBER MAPCs: {len(series)} trims, values={series}')
    print(f'  new value={new_value}, yoy={yoy_str}')
    print(f'  period_type: year → quarter')

    if not apply:
        print('(dry-run, --apply for write)')
        return False

    target['history'] = series
    target['value'] = new_value
    target['yoy'] = yoy_str
    target['period_type'] = 'quarter'
    target['last_data_date'] = '2025-12-31'  # Q4-2025 EOY preserved
    # is_short_history reste True (10 trims = 2.5 ans seulement)
    fix_log = target.get('_fix_log') or []
    if isinstance(fix_log, list):
        fix_log.append(f'{FIX_LOG_TAG}: year→quarter from 10-Q MD&A narrative (Q2-2023→Q3-2025, 8 trims) + Q4-2024/Q4-2025 preserved from year history (10-K). Total 10 trims.')
        target['_fix_log'] = fix_log

    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print(f'Written {fp}')
    return True


if __name__ == '__main__':
    import sys
    apply = '--apply' in sys.argv
    changed = apply_uber_mapcs(apply=apply)
    print(f'=== SA40 batch12 ===')
    print(f'  KPIs converted: {1 if changed else 0}')
    print(f'  Files modified: {1 if changed else 0}')
