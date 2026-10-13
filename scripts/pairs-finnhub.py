#!/usr/bin/env python3
"""Pairs bruts Finnhub (N2 US puis N1). Reprise : saute les tickers deja presents. Cle lue dans .env.local, jamais affichee."""
import json,re,time,subprocess,os,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key=None
for l in open(R+'/.env.local'):
    if l.startswith('FINNHUB_API_KEY'): key=l.split('=',1)[1].strip().strip('"\'')
a=json.load(open(R+'/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
b=json.load(open(R+'/src/data/univers-sp5001000.json'))['tickers']
us=[t for t in a if not re.search(r'\.[A-Z]{1,3}$',t)]
out=R+'/data-lake/_pairs/brut/'
for t in us+b:
    f=out+t+'.json'
    if os.path.exists(f): continue
    sym=t.replace('-','.') if False else t
    for k in range(4):
        r=subprocess.run(['curl','-s','-m','20','-w','\n%{http_code}','-H','X-Finnhub-Token: '+key,'https://finnhub.io/api/v1/stock/peers?symbol='+sym],capture_output=True,text=True)
        body,_,code=r.stdout.rpartition('\n')
        if code=='200':
            try: json.loads(body); open(f,'w').write(body); break
            except Exception: pass
        time.sleep(15 if code=='429' else 3)
    time.sleep(1.1)
