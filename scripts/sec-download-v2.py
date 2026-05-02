#!/usr/bin/env python3
"""
sec-download v2 — extension historique avec :
  - 5 ans pour 10-K, 10-Q (au lieu du plus récent)
  - 3 ans pour 8-K (au lieu de 12 derniers mois)
  - 5 ans pour DEF 14A (au lieu de 1 seul)
  - 3 mois pour Forms 3, 4, 5 (NOUVEAU)
  - Pagination des submissions SEC (suivre `files[]` pour les sociétés
    historiquement riches type AAPL/MSFT)
  - Tracking dans `_meta/cat1-us-coverage.json` :
      par ticker : oldest_date, newest_date, par form les counts
    → permet d'étendre dans le futur sans re-télécharger
       (mode --extend-back N pour aller plus loin dans le passé)

Architecture résolue :
  ROOT = /Users/yann/spx-app/sec-data/    (tant que disque externe non autorisé)
  cat1-us/<form>/<year>/<TICKER>_<date>.htm.gz
  cat1-us/<form>/<year>/<TICKER>_<date>_<accession>.htm.gz pour 8-K, 6-K, 3, 4, 5

Limites cette nuit :
  - Top 250 sociétés (S&P 500 priority)
  - 21 GB disque libre, 6 GB déjà occupés → ~15 GB budget
  - Quand le disque externe sera autorisé : étendre à top 2500 × 10y

Usage :
  python3 sec-download-v2.py                    # top 250 par défaut
  python3 sec-download-v2.py --limit 500        # plus large
  python3 sec-download-v2.py --extend-back 5    # ajoute 5 ans en arrière (pas tout re-DL)
  python3 sec-download-v2.py --no-forms-3-4-5   # skip insider transactions
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

# ---------- Config ----------
USER_AGENT = "Mettrik Research yannricordeau100@gmail.com"
# RATE_DELAY_S configurable via --rate-delay
RATE_DELAY_S = 0.14  # default ~7 req/s (override avec --rate-delay)
DATA_DIR = Path.home() / "spx-app" / "sec-data"
META = DATA_DIR / "_meta"
CAT1 = DATA_DIR / "cat1-us"
CAT2 = DATA_DIR / "cat2-foreign-adr"
COVERAGE_PATH = META / "cat1-us-coverage.json"
PROGRESS_PATH = META / "cat1-us-v2-progress.json"
LOG_PATH = META / "cat1-us-v2-log.txt"
ANOMALIES_PATH = META / "cat1-us-anomalies.txt"
INDEX_PATH = META / "cat1-cat2-index.json"

# Forms ciblés et fenêtre temporelle (en années pour les annuels/trimestriels,
# mois pour Forms 3/4/5)
FORM_WINDOW = {
    # 10 ans pour annuels et trimestriels
    "10-K":   {"years": 10, "max_per_year": 1},
    "10-Q":   {"years": 10, "max_per_year": 4},
    # 5 ans pour le reste (volume + obsolescence)
    "DEF 14A": {"years": 5, "max_per_year": 1},
    "8-K":    {"years": 5, "max_per_year": 50},
    "20-F":   {"years": 10, "max_per_year": 1},
    "6-K":    {"years": 5, "max_per_year": 30},
    "40-F":   {"years": 10, "max_per_year": 1},
    # 5 mois pour Forms 3/4/5 (énorme volume, obsolescence rapide)
    "3":      {"months": 5, "max_per_year": 999},
    "4":      {"months": 5, "max_per_year": 999},
    "5":      {"months": 5, "max_per_year": 999},
}

# Mapping form -> dossier dans la nouvelle structure
FORM_DEST = {
    "10-K": "10K", "10-Q": "10Q", "8-K": "8K", "DEF 14A": "DEF14A",
    "3": "forms3-4-5", "4": "forms3-4-5", "5": "forms3-4-5",
    "20-F": "20F", "6-K": "6K", "40-F": "40F-canadian",
}
US_FORMS = {"10-K", "10-Q", "8-K", "DEF 14A", "3", "4", "5"}
FPI_FORMS = {"20-F", "6-K", "40-F"}

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

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
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
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
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a") as f:
        f.write(line)


def log_anomaly(ticker: str, form: str, year: str, reason: str) -> None:
    ANOMALIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ANOMALIES_PATH.open("a") as f:
        f.write(f"{ticker} | {form} | {year} | {reason}\n")


# ---------- State ----------
def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True))


# ---------- SEC API ----------
def get_company_tickers() -> dict:
    return http_json("https://www.sec.gov/files/company_tickers.json")


def get_submissions_full(cik: int) -> list:
    """Récupère TOUS les filings (en suivant la pagination)."""
    main = http_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    recent = main.get("filings", {}).get("recent", {})
    files = main.get("filings", {}).get("files", [])
    # Convertir recent en liste
    all_filings = []
    forms = recent.get("form", [])
    accs = recent.get("accessionNumber", [])
    docs = recent.get("primaryDocument", [])
    dates = recent.get("filingDate", [])
    for i in range(len(forms)):
        all_filings.append({
            "form": forms[i],
            "accession": accs[i] if i < len(accs) else "",
            "primary": docs[i] if i < len(docs) else "",
            "date": dates[i] if i < len(dates) else "",
        })
    # Pagination : suivre files[]
    for f in files:
        try:
            page_url = f"https://data.sec.gov/submissions/{f['name']}"
            page = http_json(page_url)
            forms = page.get("form", [])
            accs = page.get("accessionNumber", [])
            docs = page.get("primaryDocument", [])
            dates = page.get("filingDate", [])
            for i in range(len(forms)):
                all_filings.append({
                    "form": forms[i],
                    "accession": accs[i] if i < len(accs) else "",
                    "primary": docs[i] if i < len(docs) else "",
                    "date": dates[i] if i < len(dates) else "",
                })
        except Exception as e:
            log(f"     ! page {f.get('name','?')} failed: {e}")
    return all_filings


def download_filing_doc(cik: int, accession: str, primary: str) -> bytes:
    accession_clean = accession.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_clean}/{primary}"
    return http_get(url)


# ---------- S&P 500 priority list (extended) ----------
# 250 grandes US, ordre approximatif de capi-boursière. À étendre si disque le permet.
SP500_PRIORITY = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
    "BRK.B", "AVGO", "ORCL", "JPM", "LLY", "WMT", "V", "MA", "XOM",
    "JNJ", "PG", "HD", "UNH", "BAC", "CVX", "ABBV", "KO", "PEP",
    "MRK", "TMO", "COST", "ADBE", "CRM", "MCD", "ABT", "ACN", "CSCO",
    "DHR", "WFC", "INTU", "VZ", "AMD", "DIS", "NFLX", "QCOM", "TXN",
    "CMCSA", "AMGN", "RTX", "PM", "T", "IBM", "INTC", "GS", "MS",
    "NEE", "LOW", "BMY", "BLK", "AXP", "HON", "CAT", "DE", "UNP",
    "BKNG", "TJX", "GILD", "SBUX", "LMT", "BA", "MDT", "NOW", "PYPL",
    "GE", "ELV", "C", "COP", "ADP", "ISRG", "SCHW", "VRTX", "CB",
    "ZTS", "REGN", "BSX", "MMC", "EOG", "CI", "DUK", "SO", "PLD",
    "PGR", "MO", "NOC", "GD", "BDX", "ITW", "FISV", "FIS", "AON",
    "CL", "EQIX", "SHW", "USB", "CME", "TGT", "PNC", "FCX", "TFC",
    "SLB", "WM", "ICE", "MU", "APD", "NSC", "MMM", "ADI", "MCK",
    "GM", "F", "ETN", "EMR", "ROP", "PSA", "BSX", "CCI", "DLR",
    "AEP", "EXC", "NXPI", "ABNB", "MAR", "HUM", "MCO", "AMAT", "LRCX",
    "KLAC", "OXY", "PSX", "VLO", "MPC", "AIG", "TRV", "PRU", "MET",
    "ALL", "AFL", "GPN", "STT", "BK", "AXP", "DFS", "TRV", "WELL",
    "VICI", "AVB", "EQR", "MCHP", "TER", "STX", "SNPS", "CDNS", "MSI",
    "LIN", "ECL", "SHW", "PPG", "DOW", "DD", "VMC", "MLM", "NUE",
    "STLD", "FCX", "NEM", "ALB", "CTVA", "FMC", "LYB", "EMN", "BLL",
    "PKG", "IP", "WRK", "AMCR", "SEE", "CHTR", "TMUS", "CMCSA", "DIS",
    "EA", "TTWO", "ROST", "TJX", "BKE", "BURL", "DG", "DLTR", "KR",
    "WBA", "SYY", "ADM", "TSN", "STZ", "MNST", "KDP", "EL", "CHD",
    "CLX", "KMB", "GIS", "K", "HSY", "MKC", "MDLZ", "PEP", "KO",
    "PM", "MO", "BTI", "PG", "UL", "NWL", "CPB", "CAG", "HRL",
    "POST", "FLO", "LANC", "JNJ", "LLY", "MRK", "PFE", "ABBV", "BMY",
    "AMGN", "GILD", "REGN", "VRTX", "BIIB", "MRNA", "ZTS", "TMO", "DHR",
    "ABT", "BDX", "BSX", "MDT", "EW", "SYK", "ZBH", "WAT", "MTD",
    "IDXX", "ALGN", "DXCM", "ILMN", "RMD", "BAX", "CRL", "TFX", "ICLR",
]
# Dédupliquer en préservant l'ordre
seen = set()
SP500_PRIORITY = [t for t in SP500_PRIORITY if not (t in seen or seen.add(t))]


# ---------- Pipeline ----------
def safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name)


def is_within_window(filing_date: str, form: str) -> bool:
    """Le filing est-il dans la fenêtre cible pour son form ?"""
    if form not in FORM_WINDOW:
        return False
    cfg = FORM_WINDOW[form]
    if "years" in cfg:
        cutoff = (datetime.utcnow() - timedelta(days=365 * cfg["years"])).strftime("%Y-%m-%d")
    else:  # months
        cutoff = (datetime.utcnow() - timedelta(days=30 * cfg["months"])).strftime("%Y-%m-%d")
    return filing_date >= cutoff


def process_ticker(ticker: str, cik: int, name: str,
                    coverage: dict, args) -> dict:
    """Retourne un dict de stats (n_downloaded, n_skipped, errors)."""
    log(f"  → {ticker} (CIK {cik}) · {name}")
    try:
        all_filings = get_submissions_full(cik)
    except Exception as e:
        log(f"     ! get_submissions failed: {e}")
        return {"new": 0, "skipped": 0, "errors": 1}

    log(f"     {len(all_filings)} filings totaux découverts")

    # Filtrer par form + fenêtre
    target_filings = []
    for f in all_filings:
        form = f["form"]
        if form not in FORM_WINDOW:
            continue
        if args.no_forms_3_4_5 and form in ("3", "4", "5"):
            continue
        if not is_within_window(f["date"], form):
            continue
        target_filings.append(f)
    log(f"     {len(target_filings)} dans fenêtre cible")

    # Cap par form/year
    by_form_year = {}
    for f in target_filings:
        form = f["form"]
        year = f["date"][:4]
        key = (form, year)
        by_form_year.setdefault(key, []).append(f)
    # Trier chaque (form,year) par date desc et capper
    capped = []
    for key, lst in by_form_year.items():
        lst.sort(key=lambda x: x["date"], reverse=True)
        cap = FORM_WINDOW[key[0]]["max_per_year"]
        capped.extend(lst[:cap])

    # Index existant pour skip
    existing = coverage.get(ticker, {}).get("filings_keys", [])
    existing_set = set(existing)

    n_new = 0
    n_skipped = 0
    errors = 0
    oldest = coverage.get(ticker, {}).get("oldest", "9999-99-99")
    newest = coverage.get(ticker, {}).get("newest", "0000-00-00")
    forms_count = dict(coverage.get(ticker, {}).get("forms_count", {}))

    for f in capped:
        form = f["form"]
        accession = f["accession"]
        primary = f["primary"]
        date = f["date"]
        if not primary or not accession:
            continue

        key = f"{form}/{accession}"
        if key in existing_set:
            n_skipped += 1
            continue

        # Determine destination folder
        is_us = form in US_FORMS
        cat_root = CAT1 if is_us else CAT2
        sub = FORM_DEST.get(form)
        if not sub:
            continue
        year = date[:4] if len(date) >= 4 else "unknown"
        dest_dir = cat_root / sub / year
        dest_dir.mkdir(parents=True, exist_ok=True)

        # Naming
        if form in ("8-K", "6-K", "3", "4", "5"):
            new_name = f"{safe_filename(ticker)}_{date}_{safe_filename(accession)}.htm.gz"
        else:
            new_name = f"{safe_filename(ticker)}_{date}.htm.gz"
        dest = dest_dir / new_name
        if dest.exists():
            existing_set.add(key)
            forms_count[form] = forms_count.get(form, 0) + 1
            n_skipped += 1
            continue

        try:
            content = download_filing_doc(cik, accession, primary)
            with gzip.open(dest, "wb", compresslevel=6) as fp:
                fp.write(content)
            n_new += 1
            existing_set.add(key)
            forms_count[form] = forms_count.get(form, 0) + 1
            if date < oldest: oldest = date
            if date > newest: newest = date
        except urllib.error.HTTPError as e:
            errors += 1
            log(f"     ! HTTP {e.code} on {form} {date}: {e.reason}")
            if e.code == 429:
                log("     ⏸ rate-limited, sleeping 30s")
                time.sleep(30)
        except Exception as e:
            errors += 1
            log(f"     ! download failed for {form} {date}: {e}")

    log(f"     ✓ {n_new} nouveaux, {n_skipped} skipped, {errors} erreurs")

    # Update coverage
    coverage[ticker] = {
        "cik": cik,
        "name": name,
        "oldest": oldest if oldest != "9999-99-99" else None,
        "newest": newest if newest != "0000-00-00" else None,
        "forms_count": forms_count,
        "filings_keys": sorted(existing_set),
        "last_run": datetime.utcnow().isoformat() + "Z",
    }
    return {"new": n_new, "skipped": n_skipped, "errors": errors}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=250,
                        help="Top N sociétés à traiter (default: 250 pour tenir sur disque interne)")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--no-forms-3-4-5", action="store_true",
                        help="Skip Forms 3/4/5 (insider) — gain disque marginal")
    parser.add_argument("--all", action="store_true",
                        help="Process all SEC tickers (au-delà de la priority list)")
    parser.add_argument("--rate-delay", type=float, default=None,
                        help="Override le delay entre requêtes (sec). Default 0.14 (≈7 req/s)")
    parser.add_argument("--priority-list", type=str, default=None,
                        help="Path JSON contenant {tickers: [{ticker: ...}]} pour priority custom")
    parser.add_argument("--fpi-only", action="store_true",
                        help="Skip US 10-K filers, ne traite que ceux avec 20-F ou 40-F")
    parser.add_argument("--progress-file", type=str, default=None,
                        help="Path custom pour _progress.json (séparation US/FPI)")
    parser.add_argument("--log-suffix", type=str, default="",
                        help="Suffixe pour le log (ex: '-fpi')")
    args = parser.parse_args()

    # Override rate
    global RATE_DELAY_S, PROGRESS_PATH, LOG_PATH
    if args.rate_delay is not None:
        RATE_DELAY_S = args.rate_delay
    if args.progress_file:
        PROGRESS_PATH = Path(args.progress_file)
    if args.log_suffix:
        LOG_PATH = META / f"cat1-us-v2-log{args.log_suffix}.txt"

    META.mkdir(parents=True, exist_ok=True)
    log(f"==== sec-download-v2.py started ====")
    log(f"data dir : {DATA_DIR}")
    log(f"forms cibles : {list(FORM_WINDOW.keys())}")
    log(f"limit : {args.limit}")

    # Charger company_tickers.json
    log("Fetching SEC company_tickers.json...")
    try:
        all_tickers_raw = get_company_tickers()
    except Exception as e:
        log(f"! Failed to fetch company_tickers.json: {e}")
        sys.exit(1)
    by_ticker = {}
    for entry in all_tickers_raw.values():
        by_ticker[entry["ticker"]] = (entry["cik_str"], entry["title"])
    log(f"Loaded {len(by_ticker)} reporting companies from SEC.")

    # Liste à traiter : custom priority list ou S&P 1500 par défaut
    process_list = []
    if args.priority_list:
        custom = json.loads(Path(args.priority_list).read_text())
        for entry in custom.get("tickers", []):
            t = entry["ticker"]
            if t in by_ticker:
                process_list.append((t, by_ticker[t][0], by_ticker[t][1]))
        log(f"Priority list custom : {len(process_list)} tickers matchés depuis {args.priority_list}")
    sp1500_path = META / "sp1500.json"
    if not process_list and sp1500_path.exists():
        sp1500 = json.loads(sp1500_path.read_text())
        for entry in sp1500.get("tickers", []):
            t = entry["ticker"].replace(".", "-")  # SEC normalisation
            if t in by_ticker:
                process_list.append((t, by_ticker[t][0], by_ticker[t][1]))
            elif entry["ticker"] in by_ticker:
                process_list.append((entry["ticker"], by_ticker[entry["ticker"]][0], by_ticker[entry["ticker"]][1]))
        log(f"S&P 1500 priority loaded : {len(process_list)} tickers matchés")
    # Fallback hardcoded si sp1500.json absent
    if not process_list:
        for t in SP500_PRIORITY:
            if t in by_ticker:
                process_list.append((t, by_ticker[t][0], by_ticker[t][1]))
    if args.all:
        already = {x[0] for x in process_list}
        for t, (cik, name) in by_ticker.items():
            if t not in already:
                process_list.append((t, cik, name))

    # Cap par --limit
    process_list = process_list[args.start:args.start + args.limit]
    log(f"Queue : {len(process_list)} société(s).")

    # Coverage tracking
    coverage = load_json(COVERAGE_PATH, {})
    progress = load_json(PROGRESS_PATH, {"completed": []})
    completed = set(progress["completed"])

    save_every = 5
    counter = 0
    total_new = 0
    total_skipped = 0
    total_errors = 0

    for ticker, cik, name in process_list:
        if ticker in completed:
            log(f"  · {ticker} déjà complété, skip")
            continue
        try:
            stats = process_ticker(ticker, cik, name, coverage, args)
            total_new += stats["new"]
            total_skipped += stats["skipped"]
            total_errors += stats["errors"]
            completed.add(ticker)
            progress["completed"] = sorted(completed)
            progress["last_ticker"] = ticker
            progress["last_at"] = datetime.utcnow().isoformat() + "Z"
            counter += 1
            if counter % save_every == 0:
                save_json(COVERAGE_PATH, coverage)
                save_json(PROGRESS_PATH, progress)
                log(f"  · checkpoint ({counter} sociétés, {total_new} new files)")
        except KeyboardInterrupt:
            log("Interrupted by user.")
            break
        except Exception as e:
            log(f"  !! {ticker} unhandled: {e}")
            log(traceback.format_exc())
            total_errors += 1

    save_json(COVERAGE_PATH, coverage)
    save_json(PROGRESS_PATH, progress)
    log(f"==== Done. {len(completed)} société(s) | {total_new} new | {total_skipped} skipped | {total_errors} errors ====")


if __name__ == "__main__":
    main()
