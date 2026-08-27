import json,os,re
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
        y=k.get('yoy'); h=k.get('history'); per=k.get('period_type')
        if not isinstance(y,str) or not isinstance(h,list): continue
        m=re.match(r'^\s*([+-]?\d+[,\.]?\d*)\s*%\s*$',y.replace(' ',''))
        if not m: continue
        decl=float(m.group(1).replace(',','.'))
        hh=[num(x) for x in h]
        lag=4 if per=='quarter' else 1
        if len(hh)<lag+1: continue
        cur=hh[-1]; prev=hh[-1-lag]
        if not isinstance(cur,(int,float)) or not isinstance(prev,(int,float)) or prev==0: continue
        calc=(cur-prev)/abs(prev)*100
        if abs(calc-decl)<=max(1.5,abs(calc)*0.10): continue
        rows.append({'ticker':t,'short':k.get('short'),'yoy':y,'calc':round(calc,1),
                     'cur':cur,'prev':prev,'period':per,'n':len(hh),'unit':k.get('unit')})
print('YOY INCOHERENTS:',len(rows))
json.dump(rows,open('/tmp/yoy-bugs.json','w'),ensure_ascii=False,indent=1)
# signe oppose = plus grave
sign=[r for r in rows if (r['calc']>0)!=(float(r['yoy'].replace(',','.').replace('%','').replace(' ',''))>0)]
print('DONT SIGNE OPPOSE:',len(sign))
for r in sign[:40]:
    print(f"  {r['ticker']:8} {str(r['short'])[:30]:32} yoy={r['yoy']:>9} calc={r['calc']:>8}% ({r['prev']} -> {r['cur']}) [{r['period']}] n={r['n']}")
