#!/usr/bin/env python3
"""Telecharge dans data-lake/<T>/<DOSSIER>/ tous les depots EDGAR manquants d une societe
(depuis la creation). Priorite : 10-K, 20-F, 40-F, 10-Q, DEF 14A, puis 8-K/6-K.
Arret si l espace libre passe sous le seuil. Usage :
  python3 scripts/edgar-telecharge-tout.py [--tickers A,B] [--formes 10K,10Q] [--min-go 15] [--max-par-ste 0]"""
import json,os,ssl,sys,time,gzip,shutil,urllib.request,urllib.error
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA={'User-Agent':'Mettrik research contact@mettrik.ai'}; CTX=ssl._create_unverified_context()
ARG=sys.argv
def opt(n,d=None):
    return ARG[ARG.index(n)+1] if n in ARG else d
MIN_GO=float(opt('--min-go','15')); MAXST=int(opt('--max-par-ste','0'))
ORDRE=['10K','20F','40F','10Q','DEF14A','S1','6K','8K']
FORMES=set((opt('--formes') or ','.join(ORDRE)).split(','))
def libre_go(): 
    s=os.statvfs(ROOT); return s.f_bavail*s.f_frsize/1e9
def get(u,tries=6):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=90,context=CTX) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429,503) and k<tries-1: time.sleep(4*(k+1)); continue
            raise
        except Exception:
            if k<tries-1: time.sleep(2*(k+1)); continue
            raise
inv=json.load(open('/tmp/edgar_inventaire.json'))
tickers=(opt('--tickers') or '').split(',') if opt('--tickers') else list(inv['stes'])
if opt('--tranche'):
    i,n=map(int,opt('--tranche').split('/')); tickers=[t for k,t in enumerate(tickers) if k%n==i]
tot=err=0
for t in tickers:
    v=inv['stes'].get(t) or {}
    liste=[x for x in (v.get('liste') or []) if x['dossier'] in FORMES]
    liste.sort(key=lambda x:(ORDRE.index(x['dossier']) if x['dossier'] in ORDRE else 9, x['date']),reverse=False)
    if MAXST: liste=liste[:MAXST]
    n=0
    for x in liste:
        if libre_go()<MIN_GO: print('ARRET espace libre',round(libre_go(),1),'Go',flush=True); json.dump({'tot':tot,'err':err},open('/tmp/edgar_dl_etat.json','w')); sys.exit(2)
        d=f"{ROOT}/data-lake/{t}/{x['dossier']}"; os.makedirs(d,exist_ok=True)
        p=f"{d}/{t}_{x['date']}_{x['acc']}.htm.gz"
        if os.path.exists(p): continue
        acc=x['acc'].replace('-','')
        url=f"https://www.sec.gov/Archives/edgar/data/{int(v['cik'])}/{acc}/{x['prim']}"
        try:
            try: b=get(url,tries=2)
            except Exception:
                # depots anciens : le document principal n existe pas sous ce nom, on prend le fichier complet
                b=get(f"https://www.sec.gov/Archives/edgar/data/{int(v['cik'])}/{x['acc']}.txt",tries=2)
            
            with gzip.open(p,'wb') as f: f.write(b)
            tot+=1; n+=1; time.sleep(float(os.environ.get('PAUSE','0.4')))
        except Exception as e:
            err+=1; print('ERR',t,x['date'],x['form'],str(e)[:60],flush=True)
    if n: print(t,n,'telecharges | libre',round(libre_go(),1),'Go | total',tot,flush=True)
json.dump({'tot':tot,'err':err},open('/tmp/edgar_dl_etat.json','w'))
print('FIN total',tot,'erreurs',err)
