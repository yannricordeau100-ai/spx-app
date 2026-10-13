#!/usr/bin/env python3
"""Noms/industrie des pairs inconnus (profile2). Reprise par fichier."""
import json,time,subprocess,os,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key=[l.split('=',1)[1].strip().strip('"\'') for l in open(R+'/.env.local') if l.startswith('FINNHUB_API_KEY')][0]
need=json.load(open(sys.argv[1])); os.makedirs(R+'/data-lake/_pairs/profils',exist_ok=True)
for t in need:
    f=R+'/data-lake/_pairs/profils/'+t+'.json'
    if os.path.exists(f): continue
    for k in range(4):
        r=subprocess.run(['curl','-s','-m','20','-w','\n%{http_code}','-H','X-Finnhub-Token: '+key,'https://finnhub.io/api/v1/stock/profile2?symbol='+t],capture_output=True,text=True)
        body,_,code=r.stdout.rpartition('\n')
        if code=='200':
            try: json.loads(body); open(f,'w').write(body); break
            except Exception: pass
        time.sleep(15 if code=='429' else 3)
    time.sleep(1.1)
