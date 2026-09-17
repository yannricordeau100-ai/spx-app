#!/usr/bin/env python3
"""Releve, dans les rapports annuels 10-K d une societe, les phrases qui donnent
une valeur en dollars pour une notion (ex. "rate base"). Un point par exercice,
avec la phrase exacte : aucune interpretation, la verification humaine se fait
sur la citation. Usage :
  python3 scripts/kpi-star-10k-phrase.py --ticker DUK --cik 1326160 --phrase "rate base" --depuis 2021-01-01
"""
import argparse, json, re, ssl, sys, time, urllib.parse, urllib.request, html as H
UA={"User-Agent":"Mettrik research (contact@mettrik.ai)"}
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=120,context=CTX).read().decode("utf-8","ignore")
p=argparse.ArgumentParser(); p.add_argument("--ticker",required=True); p.add_argument("--cik",required=True); p.add_argument("--phrase",required=True); p.add_argument("--depuis",default="2021-01-01"); p.add_argument("--max",type=int,default=6)
a=p.parse_args()
q=urllib.parse.quote(f'"{a.phrase}"')
hits=json.loads(get(f"https://efts.sec.gov/LATEST/search-index?q={q}&ciks={int(a.cik):010d}&forms=10-K&startdt={a.depuis}&enddt=2030-12-31")).get("hits",{}).get("hits",[])
docs={}
for h in hits:
    adsh,fn=h["_id"].split(":",1); d=h["_source"]["file_date"]
    if not fn.endswith(".htm") or re.search(r"ex[-_]?\d",fn,re.I): continue
    docs.setdefault(d[:4],(d,f"https://www.sec.gov/Archives/edgar/data/{int(a.cik)}/{adsh.replace('-','')}/{fn}"))
rx=re.compile(r"[^.]{0,160}\b"+re.escape(a.phrase)+r"\b[^.]{0,220}\$\s?[0-9][0-9.,]*\s*(billion|million)[^.]{0,120}\.",re.I)
out={}
for an,(d,u) in sorted(docs.items()):
    try: txt=re.sub(r"\s+"," ",H.unescape(re.sub(r"<[^>]+>"," ",get(u))))
    except Exception as e: print(an,"echec",str(e)[:60],file=sys.stderr); continue
    ph=[m.group(0).strip() for m in rx.finditer(txt)]
    out[an]={"depot":d,"url":u,"phrases":ph[:a.max]}
    print(f"== {a.ticker} 10-K depose {d} : {len(ph)} phrase(s)",file=sys.stderr)
    for s in ph[:a.max]: print("   -",s[:300],file=sys.stderr)
    time.sleep(0.7)
json.dump(out,open(f"/tmp/{a.ticker}_10k_{re.sub(r'[^a-z]','_',a.phrase.lower())}.json","w"),ensure_ascii=False,indent=1)
