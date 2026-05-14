#!/usr/bin/env python3
"""Refresh last_data_date pour Stoxx 600 EU stés via yfinance.mostRecentQuarter."""
import json, time, sys
from datetime import datetime
from pathlib import Path

try: import yfinance as yf
except: sys.exit(1)

PIPE = Path('src/data/v2-pipeline')
top307 = set(json.load(open('src/data/v1-8-tickers-sorted.json'))[:307])
cat3 = set(d.name for d in Path('sec-data/cat3-european').iterdir() if d.is_dir() and not d.name.startswith('_'))

# Stoxx 600 with stale hero date
pending = []
for f in PIPE.glob('*.json'):
    if f.name.startswith('_'): continue
    tk = f.stem.upper()
    if tk in top307: continue
    if tk not in cat3: continue
    try: d = json.load(f.open())
    except: continue
    hero = d.get('hero_kpi')
    if not hero: continue
    kpis = d.get('kpis', [])
    h = next((k for k in kpis if k.get('short') == hero), None)
    if not h:
        hl = hero.lower()
        h = next((k for k in kpis if isinstance(k.get('short'), str) and (hl in k['short'].lower() or k['short'].lower() in hl)), None)
    if not h: continue
    cur_date = h.get('last_data_date','')
    # Refresh if older than 2026-01-01
    if cur_date and cur_date >= '2026-01-01': continue
    pending.append((tk, cur_date))

print(f'Stoxx 600 stale freshness: {len(pending)}')

updated = 0
for i, (tk, cur_date) in enumerate(pending, 1):
    try:
        info = yf.Ticker(tk).info or {}
        ts = info.get('mostRecentQuarter')
        if not ts: continue
        latest_qe = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
        if latest_qe <= cur_date: continue
        f = PIPE / f'{tk.lower()}.json'
        d = json.load(f.open())
        hero = d.get('hero_kpi')
        kpis = d.get('kpis', [])
        h = next((k for k in kpis if k.get('short') == hero), None)
        if not h:
            hl = hero.lower()
            h = next((k for k in kpis if isinstance(k.get('short'), str) and (hl in k['short'].lower() or k['short'].lower() in hl)), None)
        if not h: continue
        h['last_data_date'] = latest_qe
        d['_freshness_yf_refreshed_at'] = datetime.now().isoformat()
        f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        updated += 1
        if i % 30 == 0:
            print(f'  [{i}/{len(pending)}] updated={updated}')
        time.sleep(0.3)
    except: pass
print(f'\nUpdated: {updated}/{len(pending)}')
