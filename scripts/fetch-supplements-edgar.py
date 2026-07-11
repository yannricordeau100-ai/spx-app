#!/usr/bin/env python3
"""Telecharge les supplements financiers (exhibits 99.2+) des 8-K resultats EDGAR.

Pour chaque ste SP500: 8-K item 2.02 depuis 2021, exhibits ex-99.2/99.3
(le 99.1 = communique, deja recupere). Sauvegarde:
~/Mettrik/docs/<T>/supplement/edgar_<accession>_<nom>.htm
Skip si deja present. Log: .conv-state/supplements.log
"""
import json, os, re, time, subprocess
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
DOCS = Path("/Users/yann/Mettrik/docs")
LOG = ROOT / ".conv-state/supplements.log"
UA = "Mettrik research yann@mettrik.ai"

def log(m):
    line = f"{time.strftime('%H:%M:%S')} {m}"
    open(LOG, "a").write(line + "\n")
    print(line, flush=True)

def get(url):
    r = subprocess.run(["curl", "-s", "-m", "40", "-A", UA, url], capture_output=True, text=True)
    time.sleep(0.15)
    return r.stdout if r.returncode == 0 else None

sp = [t.upper() for t in json.load(open(ROOT / "src/data/sp500-tickers.json"))]
tmap = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
cikmap = {v["ticker"].upper().replace("-", "."): v["cik_str"] for v in tmap.values()}

def cik_for(t):
    return cikmap.get(t) or cikmap.get(t.replace(".", "-")) or cikmap.get(t.replace(".", ""))

total = 0
for t in sp:
    cik = cik_for(t)
    if not cik:
        log(f"{t}: CIK introuvable"); continue
    outdir = DOCS / t / "supplement"
    outdir.mkdir(parents=True, exist_ok=True)
    have = set(os.listdir(outdir))
    raw = get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    if not raw:
        log(f"{t}: submissions KO"); continue
    try: subs = json.loads(raw)
    except Exception: continue
    recs = [subs.get("filings", {}).get("recent", {})]
    for extra in subs.get("filings", {}).get("files", []):
        r2 = get(f"https://data.sec.gov/submissions/{extra['name']}")
        if r2:
            try: recs.append(json.loads(r2))
            except Exception: pass
    new = 0
    for rec in recs:
        for i, form in enumerate(rec.get("form", [])):
            if form != "8-K": continue
            if rec["filingDate"][i] < "2021-01-01": continue
            if "2.02" not in (rec.get("items", [""])[i] or ""): continue
            acc = rec["accessionNumber"][i]; accn = acc.replace("-", "")
            idx = get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/index.json")
            if not idx: continue
            try: files = json.loads(idx)["directory"]["item"]
            except Exception: continue
            for f in files:
                nm = f["name"]
                if not re.search(r"(ex|exh)[-_.]?99[-_.]?[2-9]", nm, re.I): continue
                if not nm.lower().endswith((".htm", ".html")): continue
                dest = f"edgar_{acc}_{nm}"
                if dest in have: continue
                body = get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/{nm}")
                if body and len(body) > 5000:
                    (outdir / dest).write_text(body)
                    new += 1
    if new:
        total += new
        log(f"{t}: +{new}")
log(f"TERMINE: {total} supplements")
