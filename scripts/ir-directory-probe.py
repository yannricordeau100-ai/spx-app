#!/usr/bin/env python3
# Sonde automatique des pages IR : pour chaque ticker sans ir_url, recupere le
# site web (yfinance puis logo-domain-overrides), teste les patterns standard
# (ir.X, investors.X, X/investors, ...) et valide par contenu. Persiste dans
# src/data/ir-directory.json. Reprise possible (skippe ce qui est deja valide).
import json, os, ssl, sys, concurrent.futures, urllib.request
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mettrik research yannricordeau100@gmail.com"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

DIR_P = f"{ROOT}/src/data/ir-directory.json"
data = json.load(open(DIR_P))
entries = data["entries"]
cat = json.load(open(f"{ROOT}/src/data/v1-9-5-clean-all-tickers.json"))["tickers"]

# sites connus : logo-domain-overrides + yfinance
overrides = {}
try:
    lo = json.load(open(f"{ROOT}/src/data/logo-domain-overrides.json"))
    overrides = lo.get("overrides", lo) if isinstance(lo, dict) else {}
except Exception:
    pass

todo = [t for t in cat if not entries.get(t, {}).get("ir_url")]
print(f"a sonder: {len(todo)}", flush=True)

def get_site(t):
    e = entries.get(t, {})
    if e.get("website"): return e["website"]
    d = overrides.get(t)
    if isinstance(d, str) and d:
        return d if d.startswith("http") else f"https://{d}"
    try:
        import yfinance
        w = yfinance.Ticker(t).info.get("website")
        if w: return w if w.startswith("http") else f"https://{w}"
    except Exception:
        return None
    return None

def fetch(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.geturl(), r.read(120000).decode("utf-8", "ignore").lower()

KEYS = ["investor", "investisseur", "earnings", "quarterly", "annual report",
        "financial results", "shareholder", "aktionar", "finanzbericht", "presse"]

def probe(t):
    site = get_site(t)
    if not site: return t, None, None, "pas de site"
    pr = urlparse(site)
    host = pr.netloc or pr.path
    base = host[4:] if host.startswith("www.") else host
    cands = [
        f"https://investor.{base}", f"https://investors.{base}", f"https://ir.{base}",
        f"https://{host}/investors", f"https://{host}/investor-relations",
        f"https://{host}/en/investors", f"https://{host}/investor",
        f"https://{host}/en/investor-relations", f"https://{host}/investors/",
    ]
    for u in cands:
        try:
            final, body = fetch(u)
            if any(k in body for k in KEYS):
                return t, f"https://{host}", final, "ok"
        except Exception:
            continue
    return t, f"https://{host}", None, "aucun pattern"

ok = 0; fail = []
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    for t, site, ir, status in ex.map(probe, todo):
        e = entries.setdefault(t, {"ticker": t})
        if site and not e.get("website"): e["website"] = site
        if ir:
            e["ir_url"] = ir; e["source"] = "probe-auto"; ok += 1
        else:
            fail.append(t)
        if (ok + len(fail)) % 50 == 0:
            print(f"...{ok+len(fail)}/{len(todo)} (ok={ok})", flush=True)
            json.dump(data, open(DIR_P, "w"), ensure_ascii=False, indent=1)

json.dump(data, open(DIR_P, "w"), ensure_ascii=False, indent=1)
json.dump(fail, open(f"{ROOT}/.conv-state/ir-directory-missing.json", "w"))
print(f"TERMINE: resolus={ok} restants={len(fail)}")
print("restants:", fail[:40], "..." if len(fail) > 40 else "")
