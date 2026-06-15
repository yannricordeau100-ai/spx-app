#!/usr/bin/env python3
"""Fetch ER (Ex99.1) + ES (Ex99.2) via EDGAR 8-K item 2.02 pour les SP500
sans ES/ER local. Matcher large (earningsrelease/presentation/ex99.x), jusqu'a
24 depots (~6 ans). Rate-limit global ~8 req/s (sous la limite SEC). Bas-RAM."""
import json, os, ssl, re, urllib.request, urllib.error, threading, time
from concurrent.futures import ThreadPoolExecutor

CTX = ssl._create_unverified_context()
UA = {"User-Agent": "Mettrik research contact@mettrik.ai"}
DOCS = os.path.expanduser("~/Mettrik/docs")
todo = json.load(open("data-lake/_sp500_eser_todo.json"))
def _er_count(t):
    d = f"{DOCS}/{t}/ER"
    return len([f for f in os.listdir(d) if not f.startswith(".")]) if os.path.isdir(d) else 0
todo = [t for t in todo if _er_count(t) < 20]  # approfondit les <20 ER (skip fichiers existants)
LOG = open("/tmp/edgar-sp500.log", "w")
rl = threading.Lock(); last = [0.0]

def get(url, raw=False, tries=7):
    for k in range(tries):
        with rl:
            dt = time.time() - last[0]
            if dt < 0.105: time.sleep(0.105 - dt)
            last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45, context=CTX) as r:
                b = r.read()
            return b if raw else b.decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and k < tries - 1: time.sleep(2 * (k + 1)); continue
            if e.code in (404, 403): return None
            if k < tries - 1: time.sleep(1); continue
            return None
        except Exception:
            if k < tries - 1: time.sleep(1.5); continue
            return None
    return None

ct = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
CIK = {v["ticker"].upper().replace(".", "-"): str(v["cik_str"]).zfill(10) for v in ct.values()}
def cik_of(t):
    for key in (t.upper(), t.upper().replace(".", "-"), t.upper().replace("-", ".")):
        if key in CIK: return CIK[key]
    return None

def is_cover(nl):
    return bool(re.match(r"^[a-z0-9]{1,7}-\d{6,8}\.htm", nl)) or bool(re.match(r"^r\d+\.htm", nl)) or "index" in nl or "xbrl" in nl
def classify(nl):
    if re.search(r"presentation|slides|deck|webcast|ex.?99.?2|992", nl): return "ES"
    return "ER"  # dans un 8-K item 2.02, tout exhibit non-cover = communique de resultats

cnt = {"done": 0, "er": 0, "es": 0, "nocik": 0, "got": 0}; clk = threading.Lock()

def fetch(t):
    cik = cik_of(t)
    if not cik:
        with clk: cnt["nocik"] += 1; cnt["done"] += 1
        return
    sub = get(f"https://data.sec.gov/submissions/CIK{cik}.json")
    if not sub:
        with clk: cnt["done"] += 1
        return
    try: rec = json.loads(sub)["filings"]["recent"]
    except Exception:
        with clk: cnt["done"] += 1
        return
    forms, accs, items = rec.get("form", []), rec.get("accessionNumber", []), rec.get("items", [])
    cikn = int(cik); n = er = es = 0
    for i in range(len(forms)):
        if forms[i] != "8-K" or "2.02" not in (items[i] or ""): continue
        if n >= 24: break
        n += 1; acc = accs[i].replace("-", "")
        idx = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}/index.json")
        if not idx: continue
        try: it = json.loads(idx).get("directory", {}).get("item", [])
        except Exception: continue
        for f in it:
            nl = f.get("name", "").lower()
            if not nl.endswith((".htm", ".html")) or is_cover(nl): continue
            kind = classify(nl)
            d = f"{DOCS}/{t}/{kind}"; os.makedirs(d, exist_ok=True)
            p = f"{d}/edgar_{accs[i]}_{'992' if kind == 'ES' else '991'}.htm"
            if os.path.exists(p): continue
            b = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}/{f['name']}", raw=True)
            if b:
                open(p, "wb").write(b); er += kind == "ER"; es += kind == "ES"
    with clk:
        cnt["er"] += er; cnt["es"] += es; cnt["done"] += 1
        if er or es: cnt["got"] += 1
        if cnt["done"] % 10 == 0:
            print(f"{cnt['done']}/{len(todo)} stes_ok={cnt['got']} ER+{cnt['er']} ES+{cnt['es']} nocik={cnt['nocik']}", file=LOG, flush=True)

with ThreadPoolExecutor(max_workers=6) as ex:
    list(ex.map(fetch, todo))
print(f"DONE {cnt['done']}/{len(todo)} stes_ok={cnt['got']} ER {cnt['er']} ES {cnt['es']} nocik {cnt['nocik']}", file=LOG, flush=True)
print(f"DONE {cnt['done']}/{len(todo)} stes_ok={cnt['got']} ER {cnt['er']} ES {cnt['es']} nocik {cnt['nocik']}")
