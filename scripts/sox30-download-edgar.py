#!/usr/bin/env python3
"""Téléchargement EDGAR 10 ans pour les stés SOX 30 manquantes (6 août 2026).

Récupère TOUS les filings utiles de chaque trimestre depuis 2016-08 :
10-K, 10-K/A, 10-Q, 8-K (avec exhibits earnings), DEF 14A, 20-F, 6-K, S-1 (ARM IPO).
Format de sortie identique aux stés US existantes :
  data-lake/<T>/<TYPE>/<T>_<filing_date>_<accession>.htm.gz
Reprise idempotente : un fichier déjà présent n'est pas retéléchargé.
État : .conv-state/sox30-docs-state.json  (par sté : n docs, done bool)

Usage : python3 scripts/sox30-download-edgar.py [--tickers=A,B] [--dry-run]
"""
import gzip, json, ssl, sys, time, urllib.request
from datetime import date
from pathlib import Path

import certifi
SSL_CTX = ssl.create_default_context(cafile=certifi.where())

ROOT = Path(__file__).resolve().parent.parent
LAKE = ROOT / "data-lake"
STATE = ROOT / ".conv-state/sox30-docs-state.json"
UA = {"User-Agent": "Mettrik research yannricordeau100@gmail.com"}
SINCE = "2016-08-01"
FORMS = {"10-K": "10K", "10-K/A": "10K", "10-Q": "10Q", "10-Q/A": "10Q",
         "8-K": "8K", "8-K/A": "8K", "DEF 14A": "DEF14A", "DEFA14A": "DEF14A",
         "20-F": "20F", "20-F/A": "20F", "6-K": "6K", "6-K/A": "6K"}

TICKERS = {
    # ticker: CIK (verifies via https://www.sec.gov/files/company_tickers.json)
    "ALGM": None, "AMKR": None, "ASML": None, "ACLS": None, "ENTG": None,
    "LSCC": None, "QRVO": None, "RMBS": None, "TSM": None, "GFS": None,
    "MRVL": None, "ARM": None,
}


def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                return r.read()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))


def resolve_ciks():
    data = json.loads(get("https://www.sec.gov/files/company_tickers.json"))
    by_ticker = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in data.values()}
    for t in TICKERS:
        TICKERS[t] = by_ticker.get(t)
    missing = [t for t, c in TICKERS.items() if not c]
    if missing:
        print(f"⚠ CIK introuvable pour {missing} : vérifier le ticker EDGAR à la main")
    return {t: c for t, c in TICKERS.items() if c}


def all_filings(cik):
    """submissions API + fichiers d'archive pour couvrir 10 ans."""
    root = json.loads(get(f"https://data.sec.gov/submissions/CIK{cik}.json"))
    frames = [root["filings"]["recent"]]
    for extra in root["filings"].get("files", []):
        frames.append(json.loads(get(f"https://data.sec.gov/submissions/{extra['name']}")))
    for fr in frames:
        for i in range(len(fr["form"])):
            yield {
                "form": fr["form"][i],
                "date": fr["filingDate"][i],
                "accession": fr["accessionNumber"][i],
                "primary": fr["primaryDocument"][i],
            }


def fetch_exhibits(t, cik, f, outdir, dry):
    """8-K/6-K : les chiffres sont dans les exhibits EX-99.* (earnings releases),
    pas dans le document principal. Récupère chaque exhibit 99."""
    acc = f["accession"].replace("-", "")
    n = 0
    try:
        idx = json.loads(get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/index.json"))
    except Exception:
        return 0
    for item in idx.get("directory", {}).get("item", []):
        name = item.get("name", "")
        low = name.lower()
        if not (("ex99" in low or "ex-99" in low or "exh99" in low or "99_1" in low or "99-1" in low)
                and (low.endswith(".htm") or low.endswith(".html") or low.endswith(".txt"))):
            continue
        out = outdir / f"{t}_{f['date']}_{f['accession']}_{name}.gz"
        if out.exists() and out.stat().st_size > 200:
            continue
        if dry:
            n += 1
            continue
        try:
            body = get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{name}")
        except Exception:
            continue
        outdir.mkdir(parents=True, exist_ok=True)
        with gzip.open(out, "wb") as g:
            g.write(body)
        n += 1
        time.sleep(0.15)
    return n


def run(tickers, dry):
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    for t, cik in tickers.items():
        n_new = n_have = 0
        for f in all_filings(cik):
            typ = FORMS.get(f["form"])
            if not typ or f["date"] < SINCE or not f["primary"]:
                continue
            acc = f["accession"].replace("-", "")
            outdir = LAKE / t / typ
            out = outdir / f"{t}_{f['date']}_{f['accession']}.htm.gz"
            if typ in ("8K", "6K"):
                n_new += fetch_exhibits(t, cik, f, outdir, dry)
            if out.exists() and out.stat().st_size > 200:
                n_have += 1
                continue
            if dry:
                n_new += 1
                continue
            url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{f['primary']}"
            try:
                body = get(url)
            except Exception as e:
                print(f"  ✗ {t} {f['form']} {f['date']}: {e}")
                continue
            outdir.mkdir(parents=True, exist_ok=True)
            with gzip.open(out, "wb") as g:
                g.write(body)
            n_new += 1
            time.sleep(0.15)  # limite SEC ~10 req/s, on reste large
        state[t] = {"cik": cik, "downloaded": n_new, "already": n_have,
                    "at": date.today().isoformat(), "done": not dry}
        STATE.write_text(json.dumps(state, indent=1))
        print(f"{t}: +{n_new} nouveaux, {n_have} déjà présents")


if __name__ == "__main__":
    only = None
    dry = "--dry-run" in sys.argv
    for a in sys.argv[1:]:
        if a.startswith("--tickers="):
            only = a.split("=", 1)[1].split(",")
    ciks = resolve_ciks()
    if only:
        ciks = {t: c for t, c in ciks.items() if t in only}
    run(ciks, dry)
