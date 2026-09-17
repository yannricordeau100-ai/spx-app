#!/usr/bin/env python3
"""Remplit une entree du Cahier (docs/cahier/donnees/<T>.json) depuis l API XBRL companyfacts de la SEC.
Usage : python3 scripts/cahier-xbrl.py TICKER SHORT TAG [--diviseur 1e9] [--min-annees 5]
Valeurs de fin d exercice (form 10-K, fp FY), derniere valeur deposee par exercice, zeros ignores.
Source par exercice = URL du depot EDGAR (accession). Jamais de valeur inventee."""
import json,re,ssl,sys,time,urllib.request
t,short,tag=sys.argv[1],sys.argv[2],sys.argv[3]
div=float(sys.argv[sys.argv.index('--diviseur')+1]) if '--diviseur' in sys.argv else 1e9
mini=int(sys.argv[sys.argv.index('--min-annees')+1]) if '--min-annees' in sys.argv else 5
UA={'User-Agent':'Mettrik recherche KPI contact@mettrik.ai'}; CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
def get(u):
    for i in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60,context=CTX).read().decode()
        except Exception as e: time.sleep(5*(i+1)); err=e
    raise err
tk=json.loads(get('https://www.sec.gov/files/company_tickers.json')); cik={v['ticker']:v['cik_str'] for v in tk.values()}[t.replace('.','-')]
d=json.loads(get(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json'))
ns,tagn=tag.split(':') if ':' in tag else ('us-gaap',tag)
faits=d['facts'][ns][tagn]['units']; unite=list(faits)[0]
ser={}
for x in sorted(faits[unite],key=lambda x:x['filed']):
    if x['form']=='10-K' and x.get('fp')=='FY' and x['val']:
        ser[x['end']]=(x['val'],x['accn'])
annees={}; sources={}
for end,(v,accn) in sorted(ser.items()):
    an=end[:4] if int(end[5:7])>=6 else str(int(end[:4])-1)   # exercice clos avant juin = exercice precedent (ex. clos 31 janv.)
    annees[an]=round(v/div,2); sources[an]={'url':f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn.replace('-','')}/",'titre':f"{t} 10-K clos le {end}, donnee XBRL {tagn} = {v:,.0f} {unite}"}
if len(annees)<mini: print(t,short,'seulement',len(annees),'exercices, rien ecrit',annees); sys.exit(1)
p=f'docs/cahier/donnees/{t}.json'; c=json.load(open(p)); ok=False
for kp in c['kpis']:
    if kp['short']!=short: continue
    anciennes=kp.get('annees') or {}
    kp['annees']={**{a:v for a,v in annees.items()},**{a:v for a,v in anciennes.items() if a not in annees}}
    kp['annees']=dict(sorted(kp['annees'].items()))
    if kp['statut'] in ('non_trouve','autre','actuel_seulement'): kp['statut']='trouve'
    kp['complet']=True; kp['sources']=list(sources.values()); kp['commentaire']=(kp.get('commentaire','') or '').strip()
    kp['xbrl']={'tag':tag,'diviseur':div,'date':time.strftime('%Y-%m-%d')}; ok=True
    print(t,short,kp['statut'],len(kp['annees']),'exercices :',kp['annees'])
if not ok: print(t,short,'introuvable dans le Cahier'); sys.exit(1)
json.dump(c,open(p,'w'),ensure_ascii=False,indent=1)
