#!/usr/bin/env python3
"""reorg-docs.py - range tous les docs par societe + type (option 2).
Construit ~/Mettrik/docs/<TICKER>/<type>/ en LIENS SYMBOLIQUES (zero copie)
+ INDEX.json par ste + CATALOG.json global. Idempotent.
Les PDF d'ir-scrape (noms opaques) vont dans _ir-scrape-A-CLASSER (a classer
par contenu ensuite). Scope = SP500 union ir-scrape union Bureau DATA."""
import os, json, glob
from collections import defaultdict

HOME = os.path.expanduser('~')
SEC = f'{HOME}/Mettrik/sec-data'
DESK = '/Users/yann/Desktop/Projets 2025 26/App KPI/DATA'
OUT = f'{HOME}/Mettrik/docs'
DESK_MAP = {'CATERPILLAR': 'CAT', 'Google': 'GOOGL', 'GOOGLE': 'GOOGL', 'SEA': 'SE'}

sp = set(json.load(open('/Users/yann/spx-app/src/data/sp500-tickers.json')))
ir = set(os.listdir(f'{SEC}/ir-scrape')) if os.path.isdir(f'{SEC}/ir-scrape') else set()
desk = set(DESK_MAP.get(d, d) for d in os.listdir(DESK)) if os.path.isdir(DESK) else set()
UNI = {x.upper() for x in (sp | ir | desk)}

cat = defaultdict(lambda: defaultdict(list))
def add(tk, ty, p):
    tk = tk.upper()
    if tk in UNI:
        cat[tk][ty].append(p)

for typ, lab in [('10K', '10-K'), ('10Q', '10-Q'), ('8K', '8-K'), ('DEF14A', 'DEF14A')]:
    for f in glob.glob(f'{SEC}/cat1-us/{typ}/*/*'):
        add(os.path.basename(f).split('_')[0], lab, f)
for f in glob.glob(f'{SEC}/cat2-foreign-adr/20F/*/*'):
    add(os.path.basename(f).split('_')[0], '20-F', f)
for d in glob.glob(f'{SEC}/cat3-european/*/'):
    tk = os.path.basename(d.rstrip('/'))
    for sub in glob.glob(d + '*/'):
        ty = os.path.basename(sub.rstrip('/'))
        for f in glob.glob(sub + '*'):
            if os.path.isfile(f):
                add(tk, ty, f)
for d in glob.glob(f'{DESK}/*/'):
    nm = os.path.basename(d.rstrip('/')); tk = DESK_MAP.get(nm, nm)
    for sub in glob.glob(d + '*/'):
        ty = os.path.basename(sub.rstrip('/'))
        for f in glob.glob(sub + '*'):
            if os.path.isfile(f):
                add(tk, ty, f)
for d in glob.glob(f'{SEC}/quarterly-pdfs/*/'):
    tk = os.path.basename(d.rstrip('/'))
    for f in glob.glob(d + '**/*', recursive=True):
        if os.path.isfile(f):
            add(tk, 'quarterly-pdf', f)
for d in glob.glob(f'{SEC}/ir-scrape/*/'):
    tk = os.path.basename(d.rstrip('/'))
    for f in glob.glob(d + '**/*', recursive=True):
        if os.path.isfile(f) and f.lower().endswith(('.pdf', '.htm', '.html')):
            add(tk, '_ir-scrape-A-CLASSER', f)

os.makedirs(OUT, exist_ok=True)
summ = defaultdict(int); nlinks = 0
for tk, tys in cat.items():
    td = f'{OUT}/{tk}'; os.makedirs(td, exist_ok=True)
    idx = {'ticker': tk, 'counts': {}}
    for ty, ps in tys.items():
        idx['counts'][ty] = len(ps); summ[ty] += len(ps)
        sd = f'{td}/{ty}'; os.makedirs(sd, exist_ok=True)
        for p in ps:
            ln = f'{sd}/{os.path.basename(p)}'
            if not os.path.lexists(ln):
                try:
                    os.symlink(p, ln); nlinks += 1
                except Exception:
                    pass
    json.dump(idx, open(f'{td}/INDEX.json', 'w'), indent=1, ensure_ascii=False)
json.dump({tk: {ty: len(ps) for ty, ps in tys.items()} for tk, tys in cat.items()},
          open(f'{OUT}/CATALOG.json', 'w'), indent=1, ensure_ascii=False, sort_keys=True)
print(f'stes cataloguees : {len(cat)} (sur univers {len(UNI)})')
print(f'liens crees ce run : {nlinks}')
print('docs par type :')
for ty, n in sorted(summ.items(), key=lambda x: -x[1]):
    print(f'  {ty:28} {n}')
print('sortie :', OUT)
