import json,os
online=set(json.load(open(os.environ.get('ONLINE_JSON','/tmp/online.json')))['tickers'])
D='src/data/v2-pipeline-enrich'
def num(x):
    if isinstance(x,dict): x=x.get('v')
    return x if isinstance(x,(int,float)) else None
rows=[]
noh=0
for t in sorted(online):
    p=os.path.join(D,t.lower()+'.json')
    if not os.path.exists(p): continue
    try: d=json.load(open(p))
    except: continue
    for k in (d.get('kpis') or []):
        if not isinstance(k,dict): continue
        v=k.get('value'); h=k.get('history')
        if not isinstance(v,(int,float)) or not isinstance(h,list) or not h: continue
        hh=[num(x) for x in h]
        hh=[x for x in hh if x is not None]
        if not hh: continue
        last=hh[-1]
        if last==0 or v==0: continue
        r=abs(v)/abs(last)
        if 0.98<=r<=1.02: continue
        # classer
        cls=None
        for f,label in ((1000,'x1000'),(1/1000,'/1000'),(100,'x100'),(1/100,'/100'),(1e6,'x1e6'),(1e-6,'/1e6')):
            rr=abs(v*f)/abs(last) if f>=1 else abs(v)/abs(last*f)
            # simple: value*f == last ?
            if abs(v)*f!=0 and 0.98<=abs(v)*f/abs(last)<=1.02: cls=label;break
        rows.append({'ticker':t,'short':k.get('short'),'value':v,'unit':k.get('unit'),
                     'last_hist':last,'ratio':round(r,4),'class':cls,'n':len(hh),
                     'period':k.get('period_type')})
scale=[r for r in rows if r['class']]
other=[r for r in rows if not r['class']]
print('TOTAL ECARTS:',len(rows),'| ECHELLE NETTE:',len(scale),'| AUTRES:',len(other))
json.dump(scale,open('/tmp/scale-bugs.json','w'),ensure_ascii=False,indent=1)
json.dump(other,open('/tmp/other-gaps.json','w'),ensure_ascii=False,indent=1)
from collections import Counter
print('classes:',Counter(r['class'] for r in scale))
for r in scale[:80]:
    print(f"  {r['ticker']:8} {str(r['short'])[:30]:32} val={r['value']} {r['unit']} last_hist={r['last_hist']} {r['class']} n={r['n']}")
