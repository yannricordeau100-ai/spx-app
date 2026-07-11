#!/usr/bin/env python3
"""Complete les ER (exhibits 99.x des 8-K item 2.02) manquants depuis EDGAR.

Pour chaque ste SP500 : lit submissions EDGAR, trouve les 8-K "Results of
Operations" (item 2.02) depuis 2016, telecharge l'exhibit 99.1 (ou 99.x)
s'il n'est pas deja dans ~/Mettrik/docs/<T>/ER/ (match par accession number).
Throttle 0.15s (SEC max 10 req/s). Log: .conv-state/er-complete.log
"""
import json, os, re, time, subprocess
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
DOCS = Path("/Users/yann/Mettrik/docs")
LOG = ROOT / ".conv-state/er-complete.log"
UA = "Mettrik research yann@mettrik.ai"

def log(m):
    line = f"{time.strftime('%H:%M:%S')} {m}"
    open(LOG, "a").write(line + "\n")
    print(line, flush=True)

def get(url):
    r = subprocess.run(["curl", "-s", "-m", "40", "-A", UA, url],
                       capture_output=True, text=True)
    time.sleep(0.15)
    return r.stdout if r.returncode == 0 else None

sp = [t.upper() for t in json.load(open(ROOT / "src/data/sp500-tickers.json"))]
tmap = get("https://www.sec.gov/files/company_tickers.json")
tickers_cik = {v["ticker"].upper().replace("-", "."): v["cik_str"]
               for v in json.loads(tmap).values()}

def cik_for(t):
    return tickers_cik.get(t) or tickers_cik.get(t.replace(".", "-")) or tickers_cik.get(t.replace(".", ""))

total_new = 0
for t in sp:
    cik = cik_for(t)
    if not cik:
        log(f"{t}: CIK introuvable")
        continue
    outdir = DOCS / t / "ER"
    outdir.mkdir(parents=True, exist_ok=True)
    have = {re.search(r"edgar_([0-9-]+)_", f).group(1)
            for f in os.listdir(outdir) if f.startswith("edgar_") and re.search(r"edgar_([0-9-]+)_", f)}
    subs_raw = get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    if not subs_raw:
        log(f"{t}: submissions KO")
        continue
    try:
        subs = json.loads(subs_raw)
    except Exception:
        log(f"{t}: submissions JSON invalide")
        continue
    recs = [subs.get("filings", {}).get("recent", {})]
    for extra in subs.get("filings", {}).get("files", []):
        raw = get(f"https://data.sec.gov/submissions/{extra['name']}")
        if raw:
            try: recs.append(json.loads(raw))
            except Exception: pass
    new = 0
    for rec in recs:
        forms = rec.get("form", [])
        for i, form in enumerate(forms):
            if form != "8-K":
                continue
            date = rec["filingDate"][i]
            if date < "2016-01-01":
                continue
            items = rec.get("items", [""])[i] or ""
            if "2.02" not in items:
                continue
            acc = rec["accessionNumber"][i]
            if acc in have:
                continue
            accn = acc.replace("-", "")
            idx_raw = get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/index.json")
            if not idx_raw:
                continue
            try:
                files = json.loads(idx_raw)["directory"]["item"]
            except Exception:
                continue
            ex = [f["name"] for f in files if re.search(r"(ex|exh)[-_.]?99", f["name"], re.I)
                  and f["name"].lower().endswith((".htm", ".html"))]
            if not ex:
                continue
            body = get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/{ex[0]}")
            if not body or len(body) < 2000:
                continue
            (outdir / f"edgar_{acc}_991.htm").write_text(body)
            new += 1
    if new:
        total_new += new
        log(f"{t}: +{new} ER")
log(f"TERMINE: {total_new} nouveaux ER")
