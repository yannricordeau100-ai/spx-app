#!/usr/bin/env python3
"""run_xbrl_bulk.py — couche XBRL verbatim en MASSE (SP500 d'abord).
Parallel fetch companyfacts (SEC), parse via le REGISTRY, insert SQLite.
0 token, 0 hallucination, provenance accession. Puissance: 10 workers reseau."""
import json,os,subprocess,sqlite3,datetime,sys
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_datalake import REGISTRY, LAKE, DB, schema, period_type, CUTOFF

def ticker_cik_map():
    out=subprocess.run(["/usr/bin/curl","-s","-A","Mettrik research contact@mettrik.ai",
        "https://www.sec.gov/files/company_tickers.json"],capture_output=True,text=True,timeout=40)
    j=json.loads(out.stdout); m={}
    for v in j.values():
        m[v['ticker'].upper()]=str(v['cik_str']).zfill(10)
    return m

def fetch(cik):
    try:
        o=subprocess.run(["/usr/bin/curl","-s","-A","Mettrik research contact@mettrik.ai",
            f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"],capture_output=True,text=True,timeout=45)
        return json.loads(o.stdout)
    except: return None

def parse(ticker, cf):
    if not cf: return []
    usg=cf.get("facts",{}).get("us-gaap",{}); recs=[]
    for tag,(mkey,bloc) in REGISTRY.items():
        node=usg.get(tag)
        if not node: continue
        for unit,arr in node.get("units",{}).items():
            for e in arr:
                end=e.get("end")
                if not end or end<CUTOFF: continue
                if e.get("form") not in ("10-K","10-Q","20-F","40-F"): continue
                pt=period_type(e.get("start"),end)
                if pt not in ("quarter","year","instant"): continue
                recs.append((ticker,mkey,bloc,pt,end,float(e["val"]),unit,
                    "USD" if unit=="USD" else unit,e.get("form"),f"accn:{e.get('accn')}",
                    "xbrl",f"us-gaap:{tag} {e.get('fy')}{e.get('fp')}",f"{e.get('fy')}{e.get('fp')}"))
    seen=set(); clean=[]
    for r in recs:
        k=(r[0],r[1],r[3],r[4])
        if k in seen: continue
        seen.add(k); clean.append(r)
    return clean

def one(ticker, cik):
    return ticker, parse(ticker, fetch(cik))

A=json.load(open('src/data/v1-9-pre-publication-audit.json')); _a=A.get('audits') if isinstance(A,dict) else A
sp={e['ticker'].upper() for e in _a if isinstance(e,dict) and e.get('is_clean_all') is True}
cikmap=ticker_cik_map()
def resolve(t):
    for cand in (t, t.replace('.','-'), t.replace('-','.'), t.split('.')[0]):
        if cand in cikmap: return cikmap[cand]
    return None
targets=[(t,resolve(t)) for t in sorted(sp)]
ok=[(t,c) for t,c in targets if c]; noc=[t for t,c in targets if not c]
print(f"SP500: {len(sp)} | CIK resolus: {len(ok)} | sans CIK: {len(noc)} {noc[:15]}")
os.makedirs(LAKE,exist_ok=True)
con=sqlite3.connect(DB); schema(con)
_done={r[0] for r in con.execute('SELECT DISTINCT ticker FROM facts')}
ok=[(t,c) for t,c in ok if t not in _done]
print(f'reprise: {len(_done)} deja faites, {len(ok)} restantes')
done=0; total_facts=0
with ThreadPoolExecutor(max_workers=20) as ex:
    futs={ex.submit(one,t,c):t for t,c in ok}
    for f in as_completed(futs):
        t=futs[f]
        try: tk,recs=f.result()
        except: recs=[]; tk=t
        if recs:
            con.executemany("INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",recs); con.commit()
            os.makedirs(os.path.join(LAKE,tk,"xbrl"),exist_ok=True)
            json.dump([{"metric":r[1],"period_type":r[3],"period_end":r[4],"value":r[5],"unit":r[6],"ref":r[9]} for r in recs],
                      open(os.path.join(LAKE,tk,"xbrl","facts.json"),"w"))
            total_facts+=len(recs)
        done+=1
        if done%50==0: print(f"  {done}/{len(ok)} stés, {total_facts} facts")
n=con.execute("SELECT COUNT(DISTINCT ticker) FROM facts").fetchone()[0]
print(f"FINI: {done} stés traitées, {total_facts} facts, {n} stés dans la DB")
con.close()
