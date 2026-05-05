#!/usr/bin/env python3
"""
Cat 3 EU pures — scraper annualreports.com.

Pour chaque sté EU pure (cat 3 = pas d'ADR US, pas de SEC filings) :
  1. Recherche sur annualreports.com (slug)
  2. Parse page sté pour extraire PDF annual reports (5 dernières années)
  3. Download PDF latest year
  4. Convert via pdftotext → cat3-european/<TICKER>/annual-text/<year>.txt
  5. Pipeline-llm.py --cat 3 prendra le relais

Usage :
    python3 scripts/cat3-annualreports-scraper.py --tickers LVMH,TOTAL,SANOFI
    python3 scripts/cat3-annualreports-scraper.py --top100-fr  # les 48 EU pures
    python3 scripts/cat3-annualreports-scraper.py --tickers-file /path/to/list
"""

from __future__ import annotations
import argparse
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EXTERNAL_ROOT = Path("/Users/yann/spx-app/sec-data")
LOCAL_ROOT = PROJECT_ROOT / "sec-data"
DATA_ROOT = EXTERNAL_ROOT if EXTERNAL_ROOT.exists() else LOCAL_ROOT
OUT_DIR = DATA_ROOT / "cat3-european"
LOG_PATH = LOCAL_ROOT / "_meta" / "cat3-scraper.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mettrik Research"
BASE = "https://www.annualreports.com"

# SSL : macOS framework Python a parfois pas de certs
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()


# Mapping ticker → nom (pour search). Les 48 EU pures du top 100 FR
TICKER_TO_NAME = {
    # FR (.PA)
    "MC.PA": "LVMH",
    "TTE.PA": "TotalEnergies",
    "BNP.PA": "BNP Paribas",
    "AIR.PA": "Airbus",
    "RNO.PA": "Renault",
    "OR.PA": "L'Oreal",
    "SAN.PA": "Sanofi",
    "ATO.PA": "Atos",
    "CS.PA": "AXA",
    "SGO.PA": "Saint-Gobain",
    "CAP.PA": "Capgemini",
    "DG.PA": "Vinci",
    "SU.PA": "Schneider Electric",
    "RI.PA": "Pernod Ricard",
    "HO.PA": "Thales",
    "PUB.PA": "Publicis",
    "DSY.PA": "Dassault Systemes",
    "ORA.PA": "Orange",
    "VIE.PA": "Veolia",
    "EN.PA": "Bouygues",
    "ALO.PA": "Alstom",
    "AI.PA": "Air Liquide",
    "ERF.PA": "Eurofins",
    "RMS.PA": "Hermes",
    "KER.PA": "Kering",
    "GLE.PA": "Societe Generale",
    "BEN.PA": "Credit Agricole",
    "ML.PA": "Michelin",
    "RCO.PA": "Legrand",
    "FP.PA": "TotalEnergies",
    "UG.PA": "Peugeot Stellantis",
    # DE
    "VOW.DE": "Volkswagen",
    "SAP.DE": "SAP",
    "BAYN.DE": "Bayer",
    "TKA.DE": "ThyssenKrupp",
    "SIE.DE": "Siemens",
    # NL
    "ASML.AS": "ASML",
    # IT
    "ENEL.MI": "Enel",
    # ES
    "REP.MC": "Repsol",
    # SE
    "ABB.ST": "ABB",
    # DK
    "NOVO-B.CO": "Novo Nordisk",
    # JP
    "SONY": "Sony",
    # OTC ADR (mais on les met ici)
    "SIEGY": "Siemens",
    "ENI": "Eni",
    "STLA": "Stellantis",
    # TW
    "TSMC/TSM": "TSMC",
}


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if log_fh:
        log_fh.write(line + "\n")
        log_fh.flush()


def http_get(url: str, timeout: int = 30) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def search_company(name: str) -> str | None:
    """Search annualreports.com, return company slug si trouvé."""
    url = f"{BASE}/Companies?search={urllib.parse.quote(name)}"
    code, body = http_get(url)
    if code != 200:
        return None
    html = body.decode("utf-8", errors="ignore")
    # Cherche href="/Company/<slug>"
    m = re.search(r'href="/Company/([^"]+)"', html)
    if m:
        return m.group(1)
    return None


def get_pdf_links(slug: str) -> list[tuple[int, str]]:
    """Pour un slug, parse la page et retourne [(year, pdf_url), ...] triée year desc."""
    url = f"{BASE}/Company/{slug}"
    code, body = http_get(url)
    if code != 200:
        return []
    html = body.decode("utf-8", errors="ignore")
    # Cherche href="/HostedData/AnnualReportArchive/x/XXX_YEAR.pdf"
    pdfs = []
    for m in re.finditer(r'href="(/HostedData/AnnualReportArchive/[^"]+_(\d{4})\.pdf)"', html):
        path = m.group(1)
        year = int(m.group(2))
        full_url = BASE + path
        if (year, full_url) not in pdfs:
            pdfs.append((year, full_url))
    return sorted(pdfs, key=lambda x: -x[0])


def download_pdf(url: str, dest: Path) -> bool:
    code, body = http_get(url, timeout=180)
    if code != 200 or len(body) < 10000:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    """Use pdftotext to convert."""
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=120
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def process_ticker(ticker: str, name: str, log_fh) -> dict:
    """Scrape 1 ticker, return result dict."""
    res = {"ticker": ticker, "name": name, "status": "fail", "files": []}
    out_company_dir = OUT_DIR / ticker.replace("/", "_") / "annual-report"

    # Skip si déjà fait
    existing = list(out_company_dir.glob("*.pdf")) if out_company_dir.exists() else []
    if existing:
        res["status"] = "skip-already"
        res["files"] = [f.name for f in existing]
        log(f"   [SKIP] {ticker} ({name}): déjà {len(existing)} PDFs", log_fh)
        return res

    # 1. Search slug
    slug = search_company(name)
    time.sleep(1)  # rate-limit polite
    if not slug:
        log(f"   [FAIL] {ticker} ({name}): pas trouvé sur annualreports.com", log_fh)
        return res

    # 2. Get PDF list
    pdfs = get_pdf_links(slug)
    time.sleep(1)
    if not pdfs:
        log(f"   [FAIL] {ticker} ({name}/{slug}): page sans PDF annual report", log_fh)
        return res

    # 3. Download les 3 dernières années
    for year, url in pdfs[:3]:
        pdf_dest = out_company_dir / f"{year}.pdf"
        log(f"   → DL {ticker} {year} : {url[-60:]}", log_fh)
        ok = download_pdf(url, pdf_dest)
        if ok:
            # Convert to text
            txt_dest = out_company_dir.parent / "annual-text" / f"{year}.txt"
            if pdf_to_text(pdf_dest, txt_dest):
                res["files"].append(f"{year}.pdf+txt")
                log(f"      ✓ PDF + texte ({txt_dest.stat().st_size} chars)", log_fh)
            else:
                res["files"].append(f"{year}.pdf")
                log(f"      ⚠ PDF OK mais convert texte fail", log_fh)
        time.sleep(2)

    if res["files"]:
        res["status"] = "ok"
    return res


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tickers", help="Comma-separated tickers")
    parser.add_argument("--top100-fr", action="store_true", help="Tous les 48 EU pures top 100 FR")
    parser.add_argument("--tickers-file", help="Fichier 1 ticker par ligne")
    args = parser.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    tickers = []
    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",")]
    elif args.top100_fr:
        tickers = list(TICKER_TO_NAME.keys())
    elif args.tickers_file:
        with open(args.tickers_file) as f:
            tickers = [line.strip().upper() for line in f if line.strip()]
    else:
        print("Spécifier --tickers, --top100-fr, ou --tickers-file")
        sys.exit(1)

    log(f"CAT3 SCRAPER démarré, {len(tickers)} stés à scraper, sortie: {OUT_DIR}", log_fh)
    n_ok = n_fail = n_skip = 0
    for ticker in tickers:
        name = TICKER_TO_NAME.get(ticker, ticker.split(".")[0])
        log(f"\n=== {ticker} ({name}) ===", log_fh)
        res = process_ticker(ticker, name, log_fh)
        if res["status"] == "ok":
            n_ok += 1
        elif res["status"] == "skip-already":
            n_skip += 1
        else:
            n_fail += 1

    log(f"\n=== TOTAL : {n_ok} OK, {n_fail} fail, {n_skip} skip ===", log_fh)
    log_fh.close()


if __name__ == "__main__":
    main()
