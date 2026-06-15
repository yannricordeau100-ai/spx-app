#!/usr/bin/env python3
"""ER (Ex99.1) + ES (Ex99.2) via EDGAR 8-K item 2.02 pour SP500 sans ES/ER local.
Mode DOUX : 1 worker, retry/backoff sur 429, attente initiale (laisse le throttle
SEC retomber). Log structure des 3 premieres stes pour verifier le matching."""
import json, os, re, time, ssl, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mettrik research contact@mettrik.ai"}
CTX = ssl._create_unverified_context()
DOCS = os.path.expanduser("~/Mettrik/docs")
LOG = open("/tmp/edgar-fetch.log", "w")
todo = json.load(open("data-lake/_edgar-todo.json"))

def get(url, raw=False, tries=8):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
                b = r.read()
            time.sleep(0.35)
            return b if raw else b.decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and k < tries - 1:
                time.sleep(5 * (k + 1)); continue
            raise
        except Exception:
            if k < tries - 1:
                time.sleep(2); continue
            raise

print("attente initiale 180s (throttle SEC)...", file=LOG, flush=True)
time.sleep(15)
ct = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
CIK = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in ct.values()}

def classify(typ, name):
    t = (typ or "").upper(); nl = name.lower()
    if "99.2" in t or re.search(r"99[\W]?0?2\b", nl) or re.search(r"ex.?99.?2", nl):
        return "ES"
    if "99.1" in t or "EX-99" == t or re.search(r"99[\W]?0?1\b", nl) or re.search(r"ex.?99.?1", nl) or re.search(r"ex.?99\.htm", nl):
        return "ER"
    return None

def fetch(t, sample=False):
    T = t.upper(); cik = CIK.get(T)
    if not cik: return (T, 0, 0)
    try:
        rec = json.loads(get(f"https://data.sec.gov/submissions/CIK{cik}.json"))["filings"]["recent"]
    except Exception:
        return (T, 0, 0)
    forms, accs, items = rec.get("form", []), rec.get("accessionNumber", []), rec.get("items", [])
    cikn = int(cik); er = es = n = 0
    for i in range(len(forms)):
        if forms[i] != "8-K" or "2.02" not in (items[i] or ""): continue
        if n >= 12: break
        n += 1; acc = accs[i].replace("-", "")
        try:
            idx = json.loads(get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}/index.json"))
        except Exception:
            continue
        for f in idx.get("directory", {}).get("item", []):
            name = f.get("name", ""); typ = f.get("type") or ""
            if sample and n == 1:
                print(f"   [{T}] type={typ!r} name={name}", file=LOG, flush=True)
            if not name.lower().endswith((".htm", ".html")): continue
            kind = classify(typ, name)
            if not kind: continue
            d = f"{DOCS}/{T}/{kind}"; os.makedirs(d, exist_ok=True)
            p = f"{d}/edgar_{accs[i]}_{'992' if kind=='ES' else '991'}.htm"
            if not os.path.exists(p):
                try:
                    open(p, "wb").write(get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}/{name}", raw=True))
                    er += kind == "ER"; es += kind == "ES"
                except Exception:
                    pass
    return (T, er, es)

done = ter = tes = 0
with ThreadPoolExecutor(max_workers=3) as ex:
    for T, er, es in ex.map(lambda t: fetch(t, False), todo):
        done += 1; ter += er; tes += es
        if done % 10 == 0:
            print(f"{done}/{len(todo)} | ER+{ter} ES+{tes}", file=LOG, flush=True)
print(f"DONE {done}/{len(todo)} | ER {ter} | ES {tes}", file=LOG, flush=True)
print(f"DONE {done}/{len(todo)} | ER {ter} | ES {tes}")
