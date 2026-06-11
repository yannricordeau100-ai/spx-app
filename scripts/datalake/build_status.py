#!/usr/bin/env python3
"""build_status.py — matrice de couverture de la base VERBATIM (data-lake).
VERT = extrait verbatim par la NOUVELLE operation (lu dans data-lake/mettrik.db,
colonne bloc). Ce n'est PAS l'ancienne data du site. Tant qu'une couche n'a pas
tourne, son bloc est ROUGE = reste a faire. Regenerer apres chaque couche."""
import json, os, sqlite3
A=json.load(open('src/data/v1-9-pre-publication-audit.json')); a=A.get('audits') if isinstance(A,dict) else A
scope=sorted({e['ticker'].upper() for e in a if isinstance(e,dict) and e.get('is_clean_all') is True})
# bloc -> nb metriques requises pour 'vert'
BLOCKS={'financier':6,'ca_segments':2,'kpi_normaux':3,'story':2,'gouvernance':3}
cov={}
if os.path.exists('data-lake/mettrik.db'):
    con=sqlite3.connect('data-lake/mettrik.db')
    for tk,bloc,n in con.execute("SELECT ticker, bloc, COUNT(DISTINCT metric_key) FROM facts GROUP BY ticker, bloc"):
        cov.setdefault(tk,{})[bloc]=n
    con.close()
def st(f,r): return 'green' if f>=r else ('orange' if f>0 else 'red')
out={'generated_at':'2026-06-11','scope_n':len(scope),'tickers':{}}
for tk in scope:
    c=cov.get(tk,{})
    out['tickers'][tk]={b:{'f':c.get(b,0),'r':r,'s':st(c.get(b,0),r)} for b,r in BLOCKS.items()}
json.dump(out,open('src/data/extraction-status.json','w'),indent=1)
from collections import Counter
agg=Counter()
for t,b in out['tickers'].items():
    for blk,v in b.items(): agg[(blk,v['s'])]+=1
print("status verbatim:",len(scope),"stés")
for b in BLOCKS: print(f"  {b:13s} vert={agg[(b,'green')]:>3} orange={agg[(b,'orange')]:>3} rouge={agg[(b,'red')]:>3}")
