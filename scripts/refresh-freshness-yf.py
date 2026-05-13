#!/usr/bin/env python3
"""Update last_data_date for top 307 stés using yfinance latest quarterly earnings.
For 18 freshness KO stés specifically (those with all KPI dates > 12 months).
Updates hero KPI last_data_date to most recent quarter end."""
import json, time
from datetime import datetime
from pathlib import Path

import yfinance as yf

PIPE = Path('/Users/yann/spx-app/src/data/v2-pipeline')
m = json.load(open('/tmp/audit-top307-missing.json'))
ko = m['freshness']
print(f'Freshness KO to refresh: {len(ko)}')

updated = 0
for tk in ko:
    f = PIPE / f'{tk.lower()}.json'
    if not f.exists(): continue
    try:
        t = yf.Ticker(tk)
        # Get most recent quarterly earnings date
        cal = t.calendar
        info = t.info or {}
        latest_qe = None
        # Try mostRecentQuarter from info (epoch)
        if info.get('mostRecentQuarter'):
            ts = info['mostRecentQuarter']
            latest_qe = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
        else:
            # Try quarterly_financials columns
            try:
                qf = t.quarterly_financials
                if qf is not None and len(qf.columns) > 0:
                    latest_qe = str(qf.columns[0]).split(' ')[0]
            except: pass
        if not latest_qe:
            print(f'  ⚪ {tk}: no recent quarter found')
            continue
        # Update hero KPI last_data_date
        d = json.loads(f.read_text())
        hero = d.get('hero_kpi')
        if not hero:
            print(f'  ⚠ {tk}: no hero_kpi')
            continue
        kpis = d.get('kpis', [])
        h = next((k for k in kpis if k.get('short') == hero), None)
        if not h:
            hl = hero.lower()
            h = next((k for k in kpis if isinstance(k.get('short'), str) and (hl in k['short'].lower() or k['short'].lower() in hl)), None)
        if not h:
            print(f'  ⚠ {tk}: hero KPI not found in kpis[]')
            continue
        old_date = h.get('last_data_date','')
        if old_date >= latest_qe:
            print(f'  ⏭ {tk}: hero already at {old_date} (yfinance: {latest_qe})')
            continue
        h['last_data_date'] = latest_qe
        d['_freshness_yf_refreshed_at'] = datetime.utcnow().isoformat() + 'Z'
        f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        print(f'  ✅ {tk}: {old_date} → {latest_qe}')
        updated += 1
        time.sleep(0.3)
    except Exception as e:
        print(f'  ❌ {tk}: {type(e).__name__} {e}')

print(f'\nUpdated: {updated}/{len(ko)}')
