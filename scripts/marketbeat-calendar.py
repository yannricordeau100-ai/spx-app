#!/usr/bin/env python3
"""Dates de publication des resultats depuis MarketBeat (gratuit, HTML statique),
societes AMERICAINES uniquement (les pages europeennes n ont ni historique ni
prochaine date). Yann 13 sept 2026 : remplace FMP pour le calendrier.
  python3 scripts/marketbeat-calendar.py [--tickers A,B] [--limit N]
Ecrit src/data/earnings-calendar-marketbeat.json : {ticker: {historique:[dates], prochaine, estimee}}.
Politesse : 1,5 s entre requetes, curl avec User-Agent, 2 tentatives par bourse.
"""
import json,os,re,subprocess,sys,time,datetime
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,"src/data/earnings-calendar-marketbeat.json")
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
def page(url):
    for _ in range(2):
        r=subprocess.run(["curl","-sL","-A",UA,"--max-time","40",url],capture_output=True,text=True,errors="ignore")
        if r.returncode==0 and len(r.stdout)>50000: return r.stdout
        time.sleep(2)
    return ""
def us_date(s):
    m=re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})",s); return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None
MOIS={m:i+1 for i,m in enumerate(["January","February","March","April","May","June","July","August","September","October","November","December"])}
def long_date(s):
    m=re.match(r"([A-Z][a-z]+) (\d{1,2}), (\d{4})",s); return f"{m.group(3)}-{MOIS.get(m.group(1),0):02d}-{int(m.group(2)):02d}" if m and m.group(1) in MOIS else None
def extrait(html):
    t=re.sub(r"<[^>]+>"," ",html); t=re.sub(r"\s+"," ",t)
    hist=sorted({us_date(d) for d,_ in re.findall(r"(\d{1,2}/\d{1,2}/\d{4}) (Q[1-4] \d{4})",t) if us_date(d)})
    m=re.search(r"(\d{1,2}/\d{1,2}/\d{4}) \(Estimated\)",t); proch=us_date(m.group(1)) if m else None; est=True
    if not proch:
        m=re.search(r"(?:is|are) (?:estimated|scheduled|expected)[^.]{0,80}?([A-Z][a-z]+ \d{1,2}, \d{4})",t)
        if m: proch=long_date(m.group(1)); est="estimated" in m.group(0)
    return hist,proch,est
def main():
    uni=json.load(open(os.path.join(ROOT,"src/data/v1-9-5-clean-all-tickers.json")))["tickers"]
    cibles=[t for t in uni if "." not in t or t.endswith((".A",".B"))]
    if "--tickers" in sys.argv: cibles=sys.argv[sys.argv.index("--tickers")+1].split(",")
    if "--limit" in sys.argv: cibles=cibles[:int(sys.argv[sys.argv.index("--limit")+1])]
    ancien={}
    try: ancien=json.load(open(OUT)).get("par_ticker",{})
    except Exception: pass
    out=dict(ancien); ok=0; sans=[]
    for i,t in enumerate(cibles,1):
        sym=t.replace(".","-")
        hist=[];proch=None;est=True
        for bourse in ("NASDAQ","NYSE"):
            h=page(f"https://www.marketbeat.com/stocks/{bourse}/{sym}/earnings/")
            if not h: continue
            hist,proch,est=extrait(h)
            if hist or proch: break
            time.sleep(1.5)
        if hist or proch:
            anc=set(ancien.get(t,{}).get("historique",[]))
            out[t]={"historique":sorted(anc|set(hist)),"prochaine":proch,"estimee":est,"maj":datetime.date.today().isoformat()}; ok+=1
        else: sans.append(t)
        if i%25==0: print(f"  {i}/{len(cibles)} ok={ok}",flush=True)
        time.sleep(1.5)
    json.dump({"MAJ":datetime.date.today().isoformat(),"source":"marketbeat","par_ticker":out,"sans_page":sans},open(OUT,"w"),ensure_ascii=False,indent=1)
    print(f"Ecrit {OUT} : {ok} societes, {len(sans)} sans donnees {sans[:10]}")
if __name__=="__main__": main()
