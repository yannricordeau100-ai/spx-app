#!/usr/bin/env python3
"""Agrege les comptages de scripts/compte-kpi-industries.ts (un ou plusieurs JSON) en
src/data/kpi-comptes-industries.json : total par industrie GICS (6 chiffres) et global.
Usage : python3 scripts/agrege-comptes-kpi.py sortie1.json [sortie2.json ...]"""
import json,sys,collections,datetime
par=collections.defaultdict(lambda:{'avances':0,'standards':0,'stories':0,'total':0,'stes':0}); g={'avances':0,'standards':0,'stories':0,'ic':0,'total':0,'stes':0}
for f in sys.argv[1:]:
    for t,v in json.load(open(f)).items():
        if 'erreur' in v or not v.get('gics'): continue
        code=str(v['gics'])[:6]; a,s,st=int(v['avances']),int(v['standards']),int(v['stories'])
        p=par[code]; p['avances']+=a; p['standards']+=s; p['stories']+=st; p['total']+=a+s+st; p['stes']+=1
        g['avances']+=a; g['standards']+=s; g['stories']+=st; g['ic']+=a+s; g['total']+=a+s+st; g['stes']+=1
out={'maj':datetime.date.today().isoformat(),'regle':'KPI total = KPI IC (avances + standard, memes filtres que la fiche) + KPI stories','par_industrie':dict(sorted(par.items())),'global':g}
json.dump(out,open('src/data/kpi-comptes-industries.json','w'),ensure_ascii=False,indent=1); print('industries',len(par),'global',g)
