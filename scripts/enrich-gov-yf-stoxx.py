#!/usr/bin/env python3
"""Governance via yfinance.companyOfficers pour Stoxx 600 (528 stés EU sans gov).
No LLM, no API payante. yfinance free."""
import json, time, sys
from datetime import datetime, timezone
from pathlib import Path

try: import yfinance as yf
except: print('NO yfinance'); sys.exit(1)

PIPE = Path('src/data/v2-pipeline')
top307 = set(json.load(open('src/data/v1-8-tickers-sorted.json'))[:307])
cat3 = set(d.name for d in Path('sec-data/cat3-european').iterdir() if d.is_dir() and not d.name.startswith('_'))

# Build pending
pending = []
for f in PIPE.glob('*.json'):
    if f.name.startswith('_'): continue
    tk = f.stem.upper()
    if tk in top307: continue
    if tk not in cat3: continue
    try: d = json.load(f.open())
    except: continue
    gov = d.get('governance')
    if not gov or not isinstance(gov, dict) or not gov.get('ceo_name'):
        pending.append(tk)

print(f'Stoxx 600 pending gov : {len(pending)}')
written = 0
no_data = 0
for i, tk in enumerate(pending, 1):
    try:
        t = yf.Ticker(tk)
        info = t.info or {}
        officers = info.get('companyOfficers') or []
        ceo = next((o for o in officers if 'CEO' in (o.get('title','') or '').upper() or 'chief executive' in (o.get('title','') or '').lower()), None)
        if not ceo and officers: ceo = officers[0]
        if not ceo or not ceo.get('name'):
            no_data += 1
            continue
        f = PIPE / f'{tk.lower()}.json'
        d = json.loads(f.read_text())
        gov = d.get('governance') or {}
        if not gov.get('ceo_name'): gov['ceo_name'] = ceo.get('name')
        if not gov.get('ceo_title'): gov['ceo_title'] = ceo.get('title')
        # Officers list
        officers_clean = [{'name':o.get('name'),'title':o.get('title'),'age':o.get('age')} for o in officers[:5] if o.get('name')]
        if officers_clean: gov['officers'] = officers_clean
        if not gov.get('fiscal_year'): gov['fiscal_year'] = datetime.now().year - 1
        d['governance'] = gov
        d['_governance_yf_fallback_at'] = datetime.now(timezone.utc).isoformat()
        f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        written += 1
        if i % 30 == 0:
            print(f'  [{i}/{len(pending)}] written={written} no_data={no_data}')
        time.sleep(0.3)
    except Exception as e:
        no_data += 1
print(f'\nEND: written={written}, no_data={no_data}')
