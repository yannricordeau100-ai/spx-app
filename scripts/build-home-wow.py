#!/usr/bin/env python3
"""Regenere src/data/home-wow-kpis.json : les 3 KPI wow de chaque societe
populaire aupres des investisseurs francais (src/data/home-popular-fr.json).
A relancer apres toute mise a jour des fiches KPI. Regles : unites physiques
privilegiees, variations suspectes (>95 %) ecartees, valeurs formatees a la
francaise."""
import json,os,re
POP=json.load(open('src/data/home-popular-fr.json',encoding='utf-8'))['tickers']
uni={str(x).upper() for x in json.load(open('src/data/v1-9-5-clean-all-tickers.json',encoding='utf-8'))['tickers']}
FIN=re.compile(r'[$€¥£]|chf|sek|dkk|nok|mds|\bm\b|\bmd\b|%',re.I)
def financier(u): return bool(FIN.search(str(u or ''))) or not u
def ampl(y):
    m=re.search(r'-?\d+(?:[.,]\d+)?',str(y or ''))
    return abs(float(m.group(0).replace(',','.'))) if m else 0
def fr_yoy(y):
    if not y: return None
    return re.sub(r'\s*%',' %',str(y).replace('.',','))
def fmt(v):
    if isinstance(v,(int,float)):
        if isinstance(v,float) and v==int(v): v=int(v)
        if isinstance(v,int) and abs(v)>=1000: return f'{v:,}'.replace(',',' ')
        if isinstance(v,float): return str(v).replace('.',',')
        return str(v)
    return re.sub(r'(\d)\.(\d)',r'\1,\2',str(v))
def note(k):
    n=0
    if not financier(k.get('unit')): n+=5
    if k.get('is_wow'): n+=4
    a=ampl(k.get('yoy'))
    if a>95: n-=6
    elif a>=30: n+=3
    elif a>=15: n+=2
    elif a>=8: n+=1
    if isinstance(k.get('history'),list) and len(k['history'])>=5: n+=1
    if k.get('is_generic'): n-=3
    return n
out=[]
for t in POP:
    T=t.upper()
    if T not in uni: continue
    kpis=[];nom=None
    p1=f'.batches-drafts-safe/kpis-haut/{T}.json'
    if os.path.exists(p1):
        try: kpis=json.load(open(p1,encoding='utf-8')).get('kpis') or []
        except Exception: pass
    p2=f'src/data/v2-pipeline/{T.lower()}.json'
    if os.path.exists(p2):
        try:
            f2=json.load(open(p2,encoding='utf-8')); nom=f2.get('name')
            vus={k.get('short') for k in kpis}
            kpis+=[k for k in (f2.get('kpis') or []) if k.get('short') not in vus]
        except Exception: pass
    kpis=[k for k in kpis if isinstance(k,dict) and k.get('value') is not None and (k.get('name_fr') or k.get('name_en'))]
    tri=sorted(kpis,key=note,reverse=True)[:3]
    if not tri: continue
    out.append({'ticker':T,'nom':nom or T,'kpis':[
        {'nom':k.get('name_fr') or k.get('name_en'),'valeur':fmt(k.get('value')),
         'unite':fmt(k['unit']) if k.get('unit') else None,'yoy':fr_yoy(k.get('yoy'))} for k in tri]})
    if len(out)>=40: break
json.dump({'generation':'scripts/build-home-wow.py','societes':out},
 open('src/data/home-wow-kpis.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out),'societes')
