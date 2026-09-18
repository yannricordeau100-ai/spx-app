#!/usr/bin/env python3
"""edgar-inventaire.py : regenere /tmp/edgar_inventaire.json, la liste des depots
EDGAR de chaque societe de l univers (formes utiles seulement).

Usage : python3 scripts/edgar-inventaire.py [--sortie /tmp/edgar_inventaire.json]
Sortie : {"stes": {TICKER: {"cik": 320193, "liste": [{"dossier","date","acc","prim"}]}}}
"""
import json,os,sys,time,ssl,urllib.request
from concurrent.futures import ThreadPoolExecutor
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE=sys.argv[sys.argv.index('--sortie')+1] if '--sortie' in sys.argv else '/tmp/edgar_inventaire.json'
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
UA={'User-Agent':'Mettrik research contact@mettrik.ai'}
MAP={'10-K':'10K','10-Q':'10Q','8-K':'8K','DEF 14A':'DEF14A','20-F':'20F','6-K':'6K'}
uni=[t.upper() for t in json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']]
anc=json.load(open(SORTIE)) if os.path.exists(SORTIE) else {'stes':{}}
CIK={t:(v or {}).get('cik') for t,v in anc.get('stes',{}).items()}
def get(u,tries=4):
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(u,headers=UA),context=ctx,timeout=40).read()
        except Exception:
            if k==tries-1: raise
            time.sleep(1.5*(k+1))
def une(t):
    cik=CIK.get(t)
    if not cik: return t,None
    out=[]
    try:
        j=json.loads(get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"))
    except Exception:
        return t,None
    blocs=[j['filings']['recent']]
    for f in j['filings'].get('files',[]):
        try: blocs.append(json.loads(get(f"https://data.sec.gov/submissions/{f['name']}")))
        except Exception: pass
        time.sleep(0.12)
    for r in blocs:
        for form,date,acc,prim in zip(r['form'],r['filingDate'],r['accessionNumber'],r['primaryDocument']):
            d=MAP.get(form.strip())
            if d: out.append({'dossier':d,'date':date,'acc':acc,'prim':prim})
    return t,{'cik':cik,'liste':out}
res={}
with ThreadPoolExecutor(max_workers=5) as ex:
    for t,v in ex.map(une,uni):
        if v: res[t]=v
json.dump({'stes':res},open(SORTIE,'w'))
print('societes avec CIK',len(res),'| depots',sum(len(v['liste']) for v in res.values()),'->',SORTIE)
