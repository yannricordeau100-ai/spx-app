import json, re
from collections import defaultdict
from pathlib import Path

kpis_dir = Path('/Users/yann/spx-app/.batches-drafts-safe/kpis-haut')

def parse_q(q):
    m = re.match(r'Q(\d)-(?:FY)?(\d{4})', q)
    if m:
        return ('Q', int(m.group(2)), int(m.group(1)))
    m = re.match(r'FY(\d{4})', q)
    if m:
        return ('FY', int(m.group(1)), 0)
    return None

flags = []
for f in sorted(kpis_dir.glob('*.json')):
    ticker = f.stem
    if ticker.endswith('_updated'):
        continue
    try:
        data = json.load(open(f))
    except Exception:
        continue
    for kpi in data.get('kpis', []):
        hist = kpi.get('history', [])
        short = kpi.get('short')
        if not isinstance(hist, list) or len(hist) < 4:
            continue
        vals = [h.get('v') for h in hist if isinstance(h, dict) and isinstance(h.get('v'), (int, float))]
        if len(vals) < 4:
            continue
        unit = str(kpi.get('unit', '')).lower()
        name = (str(kpi.get('name_en', '')) + str(kpi.get('name_fr', '')) + str(short)).lower()
        is_ratio = '%' in unit or any(w in name for w in ['margin', 'marge', 'rate', 'taux', 'ratio', 'pct', 'ratio', 'yield', 'growth', 'croissance'])
        # Flag 1: >=3 consecutive identical values (placeholder pattern)
        run = 1
        for i in range(1, len(vals)):
            if vals[i] == vals[i-1]:
                run += 1
                if run >= 3:
                    flags.append((ticker, short, f'valeurs identiques repetees ({vals[i]}) x{run}'))
                    break
            else:
                run = 1
        # Flag 2: FY != sum(Q1..Q4) same year when all present
        by_year = defaultdict(dict)
        for h in hist:
            p = parse_q(h.get('q', ''))
            if not p:
                continue
            kind, y, q = p
            if kind == 'Q':
                by_year[y][q] = h.get('v')
            else:
                by_year[y]['FY'] = h.get('v')
        for y, qs in by_year.items():
            if not is_ratio and all(k in qs for k in (1, 2, 3, 4, 'FY')):
                s = qs[1] + qs[2] + qs[3] + qs[4]
                fy = qs['FY']
                if fy != 0 and abs(s - fy) / abs(fy) > 0.05:
                    flags.append((ticker, short, f'FY{y}={fy} != somme Q1-Q4={round(s,2)} (ecart {round(100*(s-fy)/fy,1)}%)'))
        # Flag 3: huge jump then reverts (spike anomaly) - value >5x neighbors then back down
        for i in range(1, len(vals) - 1):
            a, b, c = vals[i-1], vals[i], vals[i+1]
            if a and c and abs(a) > 0.01 and abs(c) > 0.01:
                if abs(b) > 5 * max(abs(a), abs(c)) and abs(b) > 5:
                    flags.append((ticker, short, f'pic isole {b} (voisins {a}/{c})'))

print(f"Total flags: {len(flags)}")
tickers = sorted(set(f[0] for f in flags))
print(f"Tickers touches: {len(tickers)}")
for t in tickers:
    print(f"\n{t}:")
    for tt, kpi, msg in flags:
        if tt == t:
            print(f"  {kpi}: {msg}")
