import json,os,re
online=set(json.load(open(os.environ.get('ONLINE_JSON','/tmp/online.json')))['tickers'])
D='src/data/v2-pipeline-enrich'

def clean(s): return s.replace(' ',' ').replace('\xa0',' ')

def build_pat(unit):
    u=unit.strip()
    if not u: return None
    # variantes textuelles de l unite
    esc=re.escape(u)
    return re.compile(r'(\d[\d  \xa0]*(?:[,\.]\d+)?)\s*'+esc.replace(r'\ ',r'\s*'), re.I)

def tofloat(s):
    s=s.replace(' ','').replace(' ','').replace('\xa0','').replace(',','.')
    try: return float(s)
    except: return None

rows=[]
for t in sorted(online):
    p=os.path.join(D,t.lower()+'.json')
    if not os.path.exists(p): continue
    try: d=json.load(open(p))
    except: continue
    for k in (d.get('kpis') or []):
        if not isinstance(k,dict): continue
        desc=k.get('description'); val=k.get('value'); unit=(k.get('unit') or '').strip()
        if not (isinstance(desc,str) and isinstance(val,(int,float)) and unit and unit!='%'): continue
        pat=build_pat(unit)
        if not pat: continue
        found=[]
        for m in pat.finditer(clean(desc)):
            n=tofloat(m.group(1))
            if n is not None: found.append((n,m.group(0).strip()))
        if not found: continue
        av=abs(val)
        if av==0: continue
        # si AUCUN nombre cite avec l unite du KPI n approche value -> suspect
        ok=any(0.85<=abs(n)/av<=1.15 for n,_ in found)
        if not ok:
            ratios=[round(abs(n)/av,4) for n,_ in found]
            rows.append({'ticker':t,'short':k.get('short'),'value':val,'unit':unit,
                         'period':k.get('period_type'),'cited':[r for _,r in found],
                         'ratios':ratios,'desc':desc[:260]})
print('SUSPECTS UNITE-EXACTE:',len(rows))
json.dump(rows,open('/tmp/desc-suspects2.json','w'),ensure_ascii=False,indent=1)
from collections import Counter
print(Counter(r['ticker'] for r in rows).most_common(20))
