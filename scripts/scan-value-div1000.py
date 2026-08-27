import json,os
online=set(json.load(open(os.environ.get('ONLINE_JSON','/tmp/online.json')))['tickers'])
D='src/data/v2-pipeline-enrich'
def num(x):
    if isinstance(x,dict): x=x.get('v')
    return x if isinstance(x,(int,float)) else None
rows=[]
for t in sorted(online):
    p=os.path.join(D,t.lower()+'.json')
    if not os.path.exists(p): continue
    try: d=json.load(open(p))
    except: continue
    for k in (d.get('kpis') or []):
        if not isinstance(k,dict): continue
        v=k.get('value'); h=k.get('history')
        if not isinstance(v,(int,float)) or not isinstance(h,list) or len(h)<3: continue
        hh=[num(x) for x in h]; hh=[x for x in hh if x is not None]
        if len(hh)<3: continue
        last=hh[-1]
        if last==0 or v==0: continue
        r=abs(v)/abs(last)
        if r>0.02: continue                 # value au moins 50x plus petite que la serie
        r1k=abs(v)*1000/abs(last)
        if not (0.5<=r1k<=2.0): continue    # value*1000 du meme ordre que la serie
        # la serie doit etre homogene (pas un point aberrant)
        import statistics
        med=statistics.median([abs(x) for x in hh])
        if med==0 or not (0.2<=abs(last)/med<=5): continue
        rows.append({'ticker':t,'short':k.get('short'),'value':v,'unit':k.get('unit'),
                     'last':last,'r1k':round(r1k,3),'n':len(hh),'period':k.get('period_type'),
                     'hist':hh[-4:]})
print('CANDIDATS value/1000:',len(rows))
json.dump(rows,open('/tmp/div1000.json','w'),ensure_ascii=False,indent=1)
for x in rows:
    print(f"  {x['ticker']:9} {str(x['short'])[:31]:33} val={x['value']} {x['unit']!r:14} last={x['last']} r1k={x['r1k']} n={x['n']} [{x['period']}]")
