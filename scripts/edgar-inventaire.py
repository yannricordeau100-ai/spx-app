#!/usr/bin/env python3
"""edgar-inventaire.py : regenere .conv-state/edgar_inventaire.json, la liste des depots
EDGAR de chaque societe de l univers (formes utiles seulement).

8 oct 2026 : l inventaire vivait dans /tmp et a disparu (purge du systeme). Sans lui,
post-earnings-pipeline.py ne trouvait plus aucun CIK et envoyait les societes
americaines vers la veille IR europeenne : FDS, JBL, MU, ACN, STZ sont restes sans
10-Q. Il vit desormais dans .conv-state, et les CIK ne dependent plus de l ancien
inventaire : ils sont relus dans .conv-state/quarterly-refresh-cik-map.json et
sec-data/_meta/ticker-cik-map.json, de sorte qu une regeneration a partir de rien
fonctionne.

Usage : python3 scripts/edgar-inventaire.py [--sortie .conv-state/edgar_inventaire.json]
Sortie : {"stes": {TICKER: {"cik": 320193, "liste": [{"dossier","date","acc","prim"}]}}}
"""
import json,os,sys,time,ssl,urllib.request
from concurrent.futures import ThreadPoolExecutor
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INVENTAIRE=os.path.join(ROOT,'.conv-state','edgar_inventaire.json')
SORTIE=sys.argv[sys.argv.index('--sortie')+1] if '--sortie' in sys.argv else INVENTAIRE
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
UA={'User-Agent':'Mettrik research ricordeauyann@gmail.com'}
SUFFIXES_HORS_US=('.PA','.DE','.AS','.SW','.MI','.MC','.BR','.LS','.VI','.CO','.ST','.HE','.OL','.L')
DEPOSANTS_SEC_LEGITIMES={'AMRZ.SW'}
def depose_a_la_sec(t):
    return t in DEPOSANTS_SEC_LEGITIMES or not t.endswith(SUFFIXES_HORS_US)
def lire(p):
    try: return json.load(open(p))
    except Exception: return None
def carte_cik():
    """CIK par ticker, sans dependre d un ancien inventaire : cartes du depot d abord,
    puis l ancien inventaire (.conv-state, ou /tmp s il traine encore)."""
    out={}
    for p in (os.path.join(ROOT,'sec-data','_meta','ticker-cik-map.json'),
              os.path.join(ROOT,'.conv-state','quarterly-refresh-cik-map.json')):
        d=lire(p) or {}
        for k,v in d.items():
            if isinstance(v,dict): v=v.get('cik') or v.get('cik_str')
            if v: out[k.upper().replace('-','.')]=int(v)
    for p in ('/tmp/edgar_inventaire.json',INVENTAIRE,SORTIE):
        d=lire(p) or {}
        for k,v in (d.get('stes') or {}).items():
            if (v or {}).get('cik'): out[k.upper()]=int(v['cik'])
    return out
MAP={'10-K':'10K','10-Q':'10Q','8-K':'8K','DEF 14A':'DEF14A','20-F':'20F','6-K':'6K'}
uni=[t.upper() for t in json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']]
_c=carte_cik()
CIK={t:_c.get(t) or _c.get(t.replace('-','.')) for t in uni if depose_a_la_sec(t)}
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
if not res:
    print('ECHEC : aucun depot recupere, ancien inventaire conserve'); sys.exit(1)
os.makedirs(os.path.dirname(os.path.abspath(SORTIE)),exist_ok=True)
tmp=SORTIE+'.tmp'
json.dump({'maj':time.strftime('%Y-%m-%dT%H:%M:%S'),'stes':res},open(tmp,'w'))
os.replace(tmp,SORTIE)
print('societes avec CIK',len(res),'| depots',sum(len(v['liste']) for v in res.values()),'->',SORTIE)
