#!/usr/bin/env python3
"""Composition des indices depuis Wikipedia (gratuit), 13 sept 2026.
Ecrit src/data/indices-composition.json : par indice, membres, en ligne / absents,
societes dans 2 indices, societes en ligne sans indice. Utilise par /sandbox/indices
et par la veille (/api/cron/veille-indices)."""
import json,re,html,os,subprocess,datetime
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
PAGES={
 "sp500":("S&P 500","US","https://en.wikipedia.org/wiki/List_of_S%26P_500_companies","constituents",0,1,".","-"),
 "nasdaq100":("Nasdaq 100","US","https://en.wikipedia.org/wiki/Nasdaq-100","constituents",None,None,".","-"),
 "sox":("SOXX (semi-conducteurs)","US","",None,None,None,".","-"),
 "cac40":("CAC 40","FR","https://en.wikipedia.org/wiki/CAC_40",None,None,None,"",".PA"),
 "dax40":("DAX 40","DE","https://en.wikipedia.org/wiki/DAX",None,None,None,"",".DE"),
 "aex25":("AEX 25","NL","https://en.wikipedia.org/wiki/AEX_index",None,None,None,"",".AS"),
 "smi20":("SMI 20","CH","https://en.wikipedia.org/wiki/Swiss_Market_Index",None,None,None,"",".SW"),
}
def page(url):
    r=subprocess.run(["curl","-sL","-A",UA,"--max-time","40",url],capture_output=True,text=True,errors="ignore"); return r.stdout
def tables(h):
    return re.findall(r"<table[^>]*wikitable[^>]*>(.*?)</table>",h,re.S)
def lignes(tb):
    out=[]
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>",tb,re.S):
        c=[html.unescape(re.sub(r"<[^>]+>","",x)).strip() for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>",tr,re.S)]
        if c: out.append(c)
    return out
def membres(cle):
    nom,pays,url,ident,_,_,_,suf=PAGES[cle]
    if cle=="nasdaq100":
        r=subprocess.run(["curl","-s","-A",UA,"-H","Accept: application/json","--max-time","40","https://api.nasdaq.com/api/quote/list-type/nasdaq100"],capture_output=True,text=True)
        try: rows=[(x["symbol"].replace(".","-"),re.sub(r" (Common Stock|Class [A-C].*|Ordinary Shares.*)$","",x["companyName"])) for x in json.loads(r.stdout)["data"]["data"]["rows"]]
        except Exception: rows=[]
        return nom,pays,rows
    if cle=="sox":
        us=json.load(open(os.path.join(ROOT,"docs/cahier/bourses/US.json")))
        rows=[(s["ticker"],s["nom"]) for i in us["indices"] if i["cle"]=="soxx" for s in i.get("stes",[]) if s.get("ticker")]
        return nom,pays,rows
    h=page(url); best=[]
    if ident and f'id="{ident}"' in h:
        i=h.index(f'id="{ident}"'); h=h[i:h.index("</table>",i)+8]
        h="<table class=wikitable>"+h
    for tb in tables(h):
        L=lignes(tb)
        if len(L)<15: continue
        head=[x.lower() for x in L[0]]
        it=next((i for i,x in enumerate(head) if x.startswith("ticker") or x.startswith("symbol")),None)
        if it is None: continue
        nomi=next((i for i,x in enumerate(head) if "company" in x or "security" in x or "name" in x),1 if it!=1 else 0)
        rows=[]
        for c in L[1:]:
            if len(c)<=max(it,nomi): continue
            t=c[it].split()[0].strip() if c[it] else ""
            t=re.sub(r"^(NYSE|NASDAQ|Euronext|SIX|XETRA|FWB|EPA|AMS)\s*:\s*","",t,flags=re.I)
            if not re.match(r"^[A-Z0-9][A-Z0-9.\-]{0,7}$",t): continue
            if cle in("sp500","nasdaq100","sox"): t=t.replace(".","-").replace("-B","-B")
            else: t=(t.split(".")[0]+suf)
            rows.append((t,c[nomi]))
        if len(rows)>len(best): best=rows
    return nom,pays,best
def main():
    uni=json.load(open(os.path.join(ROOT,"src/data/v1-9-5-clean-all-tickers.json")))["tickers"]
    norm=lambda s:s.upper().replace(".","-") if not re.search(r"\.(PA|DE|AS|SW|L|MI|MC|T|KS)$",s.upper()) else s.upper()
    uniN={norm(x):x for x in uni}
    out={"maj":datetime.date.today().isoformat(),"source":"Wikipedia","indices":{},"multi":{},"sans_indice":[]}
    app={}
    for cle in PAGES:
        nom,pays,rows=membres(cle)
        en=[uniN[norm(t)] for t,_ in rows if norm(t) in uniN]
        out["indices"][cle]={"nom":nom,"pays":pays,"total":len(rows),"membres":[{"ticker":t,"nom":n} for t,n in rows],"en_ligne":sorted(set(en)),"absents":[{"ticker":t,"nom":n} for t,n in rows if norm(t) not in uniN]}
        for t in set(en): app.setdefault(t,[]).append(nom)
        print(cle,nom,"membres",len(rows),"en ligne",len(set(en)),"absents",len(rows)-len(set(en)))
    out["multi"]={t:v for t,v in sorted(app.items()) if len(v)>1}
    out["sans_indice"]=sorted(set(uni)-set(app))
    json.dump(out,open(os.path.join(ROOT,"src/data/indices-composition.json"),"w"),ensure_ascii=False,indent=1)
    print("dans 2 indices :",len(out["multi"]),"| en ligne sans indice :",len(out["sans_indice"]),out["sans_indice"][:20])
if __name__=="__main__": main()
