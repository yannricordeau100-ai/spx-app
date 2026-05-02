#!/usr/bin/env python3
"""
SEC EDGAR downloader — récupère les filings obligatoires (10-K, 10-Q,
DEF 14A, 8-K) pour une liste de tickers, en respectant le rate limit
SEC (10 req/s max ; on prend 5 req/s par politesse).

Caractéristiques :
  - Single-thread (network-bound, ne consomme ni CPU ni RAM)
  - Resumable : lit ~/spx-app/sec-data/_progress.json au démarrage
  - Idempotent : skip si fichier déjà présent
  - gzip à la volée pour économiser ~85% de disque
  - Logs erreurs dans _log.txt (continue malgré les 429 / timeouts)
  - User-Agent obligatoire SEC : "Mettrik Research yannricordeau100@gmail.com"

Usage :
  python3 sec-download.py                    # top 500 S&P
  python3 sec-download.py --limit 50         # juste les 50 premiers
  python3 sec-download.py --start 100        # reprendre à partir de l'index 100

Storage layout :
  ~/spx-app/sec-data/
    _index.json              # mapping ticker -> CIK + liste filings téléchargés
    _progress.json           # tickers déjà traités
    _log.txt                 # log d'erreurs
    <TICKER>/
      10-K/<date>_<accession>.htm.gz
      10-Q/<date>_<accession>.htm.gz
      DEF14A/<date>_<accession>.htm.gz
      8-K/<date>_<accession>.htm.gz
"""

from __future__ import annotations
import argparse
import gzip
import json
import ssl
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# macOS bundled Python ne livre pas de cert bundle par défaut. Pour de la
# data SEC publique (lecture seule, contenu publiquement vérifiable), on
# accepte le certificat non vérifié. À ne PAS faire pour des écritures /
# auth.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# ---------- Config ----------
USER_AGENT = "Mettrik Research yannricordeau100@gmail.com"
RATE_DELAY_S = 0.14  # ~7 req/s, sous la limite SEC de 10 req/s
DATA_DIR = Path.home() / "spx-app" / "sec-data"
INDEX_PATH = DATA_DIR / "_index.json"
PROGRESS_PATH = DATA_DIR / "_progress.json"
LOG_PATH = DATA_DIR / "_log.txt"

# Forms ciblés et nombre max à télécharger par ticker
TARGET_FORMS = {
    # US issuers
    "10-K": 1,        # annuel US (le plus récent)
    "10-Q": 4,        # 4 derniers trimestriels
    "DEF 14A": 1,     # proxy le plus récent
    "8-K": 8,         # 8 derniers events matériels US (12 derniers mois)
    # Foreign Private Issuers (européens cross-listés via ADR : SAP, ASML, LVMH, etc.)
    "20-F": 1,        # annuel équivalent 10-K pour FPI
    "6-K": 6,         # rapports intermédiaires + events FPI (12 derniers mois)
    "40-F": 1,        # annuel pour Canadiens
}
# Fenêtre temporelle pour les forms d'events (8-K, 6-K) : 12 derniers mois
EIGHTK_MAX_AGE_DAYS = 365
SIXK_MAX_AGE_DAYS = 365

# ---------- HTTP throttled ----------
_last_call = 0.0


def http_get(url: str, accept: str = "*/*") -> bytes:
    global _last_call
    delta = time.time() - _last_call
    if delta < RATE_DELAY_S:
        time.sleep(RATE_DELAY_S - delta)
    _last_call = time.time()
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
        "Accept": accept,
        "Host": url.split("/")[2],
    })
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
    return data


def http_json(url: str) -> dict:
    return json.loads(http_get(url, accept="application/json").decode("utf-8"))


# ---------- Logging ----------
def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}\n"
    print(line, end="", flush=True)
    with LOG_PATH.open("a") as f:
        f.write(line)


# ---------- State ----------
def load_index() -> dict:
    if INDEX_PATH.exists():
        return json.loads(INDEX_PATH.read_text())
    return {}


def save_index(idx: dict) -> None:
    INDEX_PATH.write_text(json.dumps(idx, indent=2, sort_keys=True))


def load_progress() -> dict:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"completed": [], "started_at": datetime.utcnow().isoformat() + "Z"}


def save_progress(p: dict) -> None:
    PROGRESS_PATH.write_text(json.dumps(p, indent=2))


# ---------- SEC API ----------
def get_company_tickers() -> dict:
    """Liste de TOUS les emetteurs reportant à la SEC (~10k entries)."""
    return http_json("https://www.sec.gov/files/company_tickers.json")


def get_submissions(cik: int) -> dict:
    """Filings index pour une société (CIK 10 digits)."""
    return http_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")


def download_filing_doc(cik: int, accession_no_dashes: str, primary_doc: str) -> bytes:
    """Télécharge le primary doc d'une filing (HTML / HTM / TXT)."""
    accession_clean = accession_no_dashes.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_clean}/{primary_doc}"
    return http_get(url)


# ---------- S&P 500 priority list (hardcoded snapshot) ----------
SP500_PRIORITY = [
    # Tech mega-caps first
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
    "AVGO", "ORCL", "CRM", "ADBE", "AMD", "INTC", "CSCO", "QCOM",
    "TXN", "IBM", "INTU", "NOW", "AMAT", "ADI", "MU", "LRCX",
    # Finance
    "BRK.B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS",
    "AXP", "C", "BLK", "SCHW", "SPGI", "ICE", "CME", "MCO",
    "MSCI", "AON", "MMC", "PGR", "TRV", "ALL", "MET", "PRU",
    # Healthcare
    "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "PFE",
    "DHR", "BMY", "AMGN", "CVS", "MDT", "GILD", "ELV", "ISRG",
    "BSX", "SYK", "ZTS", "REGN", "VRTX", "BDX", "CI", "HUM",
    # Consumer Discretionary
    "HD", "TSLA", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG",
    "ABNB", "MAR", "HLT", "ORLY", "AZO", "ROST", "GM", "F",
    "EBAY", "EXPE", "ETSY", "RCL", "CCL", "NCLH",
    # Communication Services
    "DIS", "VZ", "T", "CMCSA", "NFLX", "TMUS", "CHTR", "EA",
    "TTWO", "WBD", "PARA", "FOX", "FOXA", "OMC", "IPG",
    # Consumer Staples
    "WMT", "PG", "COST", "KO", "PEP", "PM", "MO", "MDLZ",
    "CL", "EL", "GIS", "K", "HSY", "STZ", "KMB", "SYY",
    "KR", "WBA", "TGT", "CHD", "CLX",
    # Industrials
    "CAT", "RTX", "HON", "UPS", "LMT", "BA", "GE", "DE",
    "ADP", "ITW", "MMM", "EMR", "ETN", "NSC", "UNP", "FDX",
    "CSX", "GD", "NOC", "WM", "RSG", "PCAR", "ROK", "PH",
    # Energy
    "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "VLO", "MPC",
    "OKE", "WMB", "PXD", "OXY", "HES", "BKR", "HAL", "DVN",
    # Materials
    "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW", "DD",
    "NUE", "STLD", "CTVA", "PPG", "ALB", "VMC", "MLM",
    # Utilities
    "NEE", "SO", "DUK", "AEP", "SRE", "D", "EXC", "XEL",
    "PEG", "WEC", "ED", "AWK", "ETR", "ES", "DTE", "PPL",
    # Real Estate
    "PLD", "AMT", "EQIX", "WELL", "PSA", "CCI", "DLR", "O",
    "SPG", "VICI", "AVB", "EQR", "CSGP", "EXR", "VTR", "WY",
    # Tech mid (continue)
    "PANW", "SNPS", "CDNS", "CRWD", "ZS", "DDOG", "TEAM", "WDAY",
    "ANET", "FTNT", "MDB", "NET", "SHOP", "SQ", "PYPL", "FIS",
    "FISV", "TYL", "ANSS", "KLAC", "MCHP", "GLW", "HPQ", "DELL",
    "CDW", "STX", "WDC", "NTAP", "FFIV", "CTSH", "EPAM", "GEN",
    # Healthcare mid
    "MCK", "COR", "CAH", "ZBH", "WAT", "MTD", "IDXX", "ALGN",
    "DXCM", "ILMN", "RMD", "MRNA", "BIIB", "INCY", "CTLT", "WST",
    "BAX", "CRL", "TFX", "ICLR", "IQV", "LH", "DGX",
    # Financials mid
    "USB", "PNC", "TFC", "COF", "BK", "STT", "CFG", "FITB",
    "RF", "HBAN", "KEY", "MTB", "ZION", "NTRS", "BEN", "AMP",
    "WTW", "AJG", "BRO", "CB", "AIG", "HIG", "L", "AFL",
    # Industrials mid
    "GWW", "URI", "RHI", "HII", "TXT", "JBHT", "ODFL", "CHRW",
    "EXPD", "JBL", "FAST", "PWR", "DOV", "XYL", "FTV", "AME",
    "IR", "VRSK", "SNA", "CMI", "ROL", "SWK", "MAS", "TT",
    # Energy mid
    "HES", "FANG", "MRO", "APA", "CTRA", "EQT", "CNX", "OVV",
    "PR", "AR", "RRC", "KMI", "TRGP", "HEP", "DK", "WES",
    # Consumer Disc mid
    "LULU", "POOL", "ULTA", "BBY", "DG", "DLTR", "GPC", "TPR",
    "RL", "VFC", "PVH", "TJX", "BURL", "DKS", "FL", "GES",
    "WSM", "BBWI", "PHM", "DHI", "LEN", "NVR", "TOL", "KBH",
    # Consumer Staples mid
    "MNST", "KDP", "TAP", "BUD", "DEO", "TSN", "ADM", "BG",
    "INGR", "POST", "CPB", "CAG", "HRL", "MKC", "FLO", "LANC",
    # Other notable
    "UBER", "LYFT", "DASH", "RBLX", "PLTR", "SNOW", "U", "PINS",
    "SNAP", "SPOT", "ROKU", "ZM", "DOCN", "TWLO", "OKTA", "ESTC",
    # Defense / Aerospace
    "TXT", "HEI", "TDG", "AXON", "LDOS", "BAH", "SAIC", "KBR",
    # Insurance
    "BRK.A", "FFH", "AIZ", "ERIE", "ORI", "RLI", "RGA", "PFG",
    "VOYA", "EQH", "GL", "LNC", "UNM", "WRB",
]
# Dédupliquer en préservant l'ordre
seen = set()
SP500_PRIORITY = [t for t in SP500_PRIORITY if not (t in seen or seen.add(t))]


# ---------- Pipeline ----------
def safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name)


def process_ticker(ticker: str, cik: int, name: str, idx: dict) -> bool:
    """Télécharge les filings ciblés pour un ticker. Retourne True si OK."""
    log(f"  → {ticker} (CIK {cik}) · {name}")
    try:
        sub = get_submissions(cik)
    except Exception as e:
        log(f"     ! get_submissions failed: {e}")
        return False

    recent = sub.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    filing_dates = recent.get("filingDate", [])

    # Compter par form
    counts = {f: 0 for f in TARGET_FORMS}
    company_idx = idx.setdefault(ticker, {
        "cik": cik,
        "name": name,
        "filings": [],
    })
    existing_keys = {f"{f['form']}/{f['accession']}" for f in company_idx["filings"]}

    cutoff_8k = (datetime.utcnow() - timedelta(days=EIGHTK_MAX_AGE_DAYS)).strftime("%Y-%m-%d")

    n_downloaded = 0
    for i in range(len(forms)):
        form = forms[i]
        if form not in TARGET_FORMS:
            continue
        if counts[form] >= TARGET_FORMS[form]:
            continue
        accession = accessions[i]
        primary = primary_docs[i]
        date = filing_dates[i]
        if not primary:
            continue
        # 8-K / 6-K : limite temporelle (12 derniers mois)
        if form in ("8-K", "6-K") and date < cutoff_8k:
            continue

        key = f"{form}/{accession}"
        if key in existing_keys:
            counts[form] += 1
            continue

        form_dir = DATA_DIR / ticker / safe_filename(form)
        form_dir.mkdir(parents=True, exist_ok=True)
        out_file = form_dir / f"{date}_{safe_filename(accession)}.htm.gz"

        if out_file.exists():
            counts[form] += 1
            company_idx["filings"].append({
                "form": form, "accession": accession, "date": date,
                "primary": primary, "path": str(out_file.relative_to(DATA_DIR)),
            })
            existing_keys.add(key)
            continue

        try:
            content = download_filing_doc(cik, accession, primary)
            with gzip.open(out_file, "wb", compresslevel=6) as f:
                f.write(content)
            company_idx["filings"].append({
                "form": form, "accession": accession, "date": date,
                "primary": primary, "path": str(out_file.relative_to(DATA_DIR)),
                "size_bytes": len(content),
            })
            existing_keys.add(key)
            counts[form] += 1
            n_downloaded += 1
            log(f"     ✓ {form} {date} ({len(content)//1024} KB)")
        except urllib.error.HTTPError as e:
            log(f"     ! HTTP {e.code} on {form} {date}: {e.reason}")
            if e.code == 429:
                log("     ⏸ rate-limited, sleeping 30s")
                time.sleep(30)
        except Exception as e:
            log(f"     ! download failed: {e}")

    log(f"     {n_downloaded} new file(s) for {ticker}")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Max tickers to process")
    parser.add_argument("--start", type=int, default=0, help="Skip first N tickers (resume)")
    parser.add_argument("--all", action="store_true", help="Process all SEC tickers (not just S&P 500)")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    log(f"==== sec-download.py started ====")
    log(f"data dir: {DATA_DIR}")

    # Charger company_tickers.json (~10k companies)
    log("Fetching SEC company_tickers.json...")
    try:
        all_tickers_raw = get_company_tickers()
    except Exception as e:
        log(f"! Failed to fetch company_tickers.json: {e}")
        sys.exit(1)
    # Format : { "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}, ... }
    by_ticker = {}
    for entry in all_tickers_raw.values():
        by_ticker[entry["ticker"]] = (entry["cik_str"], entry["title"])
    log(f"Loaded {len(by_ticker)} reporting companies from SEC.")

    # Construire la liste à traiter : S&P 500 priority + reste si --all
    process_list = []
    for t in SP500_PRIORITY:
        if t in by_ticker:
            process_list.append((t, by_ticker[t][0], by_ticker[t][1]))
    if args.all:
        already = set(SP500_PRIORITY)
        for t, (cik, name) in by_ticker.items():
            if t not in already:
                process_list.append((t, cik, name))

    # Resume
    progress = load_progress()
    completed = set(progress["completed"])
    log(f"Resume : {len(completed)} ticker(s) already completed.")

    # Skip start, apply limit
    queue = [(t, cik, name) for (t, cik, name) in process_list if t not in completed]
    queue = queue[args.start:]
    if args.limit:
        queue = queue[:args.limit]
    log(f"Queue : {len(queue)} ticker(s) to process.")

    idx = load_index()
    save_every = 10
    counter = 0

    for ticker, cik, name in queue:
        try:
            ok = process_ticker(ticker, cik, name, idx)
            if ok:
                completed.add(ticker)
                progress["completed"] = sorted(completed)
                progress["last_ticker"] = ticker
                progress["last_at"] = datetime.utcnow().isoformat() + "Z"
            counter += 1
            if counter % save_every == 0:
                save_index(idx)
                save_progress(progress)
                log(f"  · checkpoint saved ({counter} processed)")
        except KeyboardInterrupt:
            log("Interrupted by user.")
            break
        except Exception as e:
            log(f"  !! Unhandled: {e}")
            log(traceback.format_exc())

    save_index(idx)
    save_progress(progress)
    log(f"==== Done. {len(completed)} ticker(s) completed total. ====")


if __name__ == "__main__":
    main()
