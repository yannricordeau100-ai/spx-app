#!/usr/bin/env python3
"""build_status.py — régénère src/data/extraction-status.json (matrice de
couverture stés × blocs) pour la page /sandbox/extraction-monitor. À relancer
après chaque avancée de la grande opération (couche XBRL / table / story)."""
import json, os, sqlite3
A=json.load(open('src/data/v1-9-pre-publication-audit.json')); a=A.get('audits') if isinstance(A,dict) else A
scope=sorted({e['ticker'].upper() for e in a if isinstance(e,dict) and e.get('is_clean_all') is True})
fin={}
if os.path.exists('data-lake/mettrik.db'):
    con=sqlite3.connect('data-lake/mettrik.db')
    for tk,n in con.execute("SELECT ticker, COUNT(DISTINCT metric_key) FROM facts GROUP BY ticker"): fin[tk]=n
    con.close()
FIN_REQ=10
def st(f,r): return 'green' if f>=r else ('orange' if f>0 else 'red')
def row(tk):
    d=json.load(open(f'src/data/v2-pipeline/{tk.lower()}.json')) if os.path.exists(f'src/data/v2-pipeline/{tk.lower()}.json') else {}
    en=json.load(open(f'src/data/v2-pipeline-enrich/{tk.lower()}.json')) if os.path.exists(f'src/data/v2-pipeline-enrich/{tk.lower()}.json') else {}
    spec=[k for k in d.get('kpis',[]) if not k.get('is_generic') and (k.get('is_wow') or k.get('is_short_history'))]
    seg=d.get('revenue_by_segment') or {}; geo=d.get('revenue_by_geography') or {}
    gov=d.get('governance') or en.get('governance') or {}
    govf=sum(1 for f in ['ceo_name','ceo_total_comp_m','voting_structure'] if gov.get(f))
    ca=(1 if seg else 0)+(1 if geo else 0); finn=fin.get(tk,0)
    return {'financier':{'f':finn,'r':FIN_REQ,'s':st(finn,FIN_REQ),'src':'xbrl' if finn else '-'},
      'ca_segments':{'f':ca,'r':2,'s':st(ca,2)},'story_kpis':{'f':len(spec),'r':3,'s':st(len(spec),3)},
      'gouvernance':{'f':govf,'r':3,'s':st(govf,3)},'risques':{'f':len(d.get('risks') or []),'r':3,'s':st(len(d.get('risks') or []),3)},
      'ai':{'f':1 if (d.get('ai_positioning') or {}).get('stance') else 0,'r':1,'s':st(1 if (d.get('ai_positioning') or {}).get('stance') else 0,1)},
      'events':{'f':len(d.get('events') or []),'r':3,'s':st(len(d.get('events') or []),3)}}
out={'generated_at':'2026-06-11','scope_n':len(scope),'tickers':{tk:row(tk) for tk in scope}}
json.dump(out,open('src/data/extraction-status.json','w'),indent=1)
print("status régénéré:",len(scope),"stés")
