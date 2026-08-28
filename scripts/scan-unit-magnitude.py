"""KPI dont la valeur n a pas l ordre de grandeur de son unite.
Ex : 207 000 000 avec l unite "M $" s affiche comme 207 000 milliards."""
import json, os, re
from collections import Counter
online = set(json.load(open(os.environ.get('ONLINE_JSON', '/tmp/online.json')))['tickers'])
DEV = r'\$|€|£|¥|usd|eur|gbp|chf|sek|nok|dkk|jpy'
rows = []
for t in sorted(online):
    p = os.path.join('src/data/v2-pipeline-enrich', t.lower() + '.json')
    if not os.path.exists(p): continue
    try: d = json.load(open(p))
    except Exception: continue
    for k in d.get('kpis') or []:
        if not isinstance(k, dict): continue
        u = (k.get('unit') or '').lower(); v = k.get('value')
        if not isinstance(v, (int, float)) or not re.search(DEV, u): continue
        a = abs(float(v))
        # Le yen et la couronne valent cent a mille fois moins que le dollar :
        # sans ce facteur, l actif de MUFG en millions de yens passe pour une
        # aberration alors qu il est juste.
        facteur = 200 if re.search(r'¥|jpy|krw|idr', u) else (12 if re.search(r'sek|nok|dkk', u) else 1)
        seuil = None
        if re.search(r'\bmds?\b|\bmilliards?\b|\bbn\b', u): seuil = 100_000 * facteur
        elif re.search(r'\bm(?:io|ln)?\b|\bmillions?\b', u): seuil = 10_000_000 * facteur
        if seuil and a > seuil:
            rows.append({'ticker': t, 'short': k.get('short'), 'name': k.get('name_fr'),
                         'value': v, 'unit': k.get('unit')})
print('KPI d ordre de grandeur aberrant :', len(rows))
for r in rows: print(' ', r['ticker'], r['short'], r['value'], r['unit'])
json.dump(rows, open('/tmp/unit-magnitude.json','w'), ensure_ascii=False, indent=1)
