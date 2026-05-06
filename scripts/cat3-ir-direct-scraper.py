#!/usr/bin/env python3
"""
Cat 3 EU Plan C : scraping direct IR site quand DDG/annualreports.com a échoué.

Stratégie : pour chaque (ticker, name) :
  1. Devine domaine officiel via yfinance (.info['website'])
  2. Cherche /investor* / /investors / /investor-relations / /financial / /annual-report
  3. Parse HTML, trouve liens *.pdf qui contiennent annual/rapport/jaarverslag/etc
  4. Download + pdftotext

Usage :
  python3 scripts/cat3-ir-direct-scraper.py --tickers-file <file>
"""
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

import yfinance as yf

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "sec-data/cat3-european"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/cat3-ir-direct.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mettrik Research"
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

IR_PATHS = [
    "/investors/financial-reports", "/en/investors/results-reports",
    "/investors", "/investor-relations", "/en/investor-relations",
    "/en/investors", "/about/investor-relations", "/about-us/investors",
    "/finance", "/group/investors", "/en/finance",
    "/investors/annual-reports", "/investors/financials",
    "/investor", "/investor.html",
]

ANNUAL_KEYWORDS = ["annual_report", "annualreport", "annual-report", "rapport_annuel", "rapportannuel",
                  "jaarverslag", "geschaeftsbericht", "geschaftsbericht", "informe-anual",
                  "bilancio", "relazione", "ar2024", "ar2023", "ar20"]

def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n"); fh.flush()


def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except Exception:
        return 0, b""


def get_official_website(ticker):
    try:
        info = yf.Ticker(ticker).info
        site = info.get("website") or ""
        if site.startswith("http"):
            return site.rstrip("/")
    except Exception:
        pass
    return None


def find_pdfs_in_html(html, base_url):
    pdfs = []
    for m in re.finditer(r'href=["\']([^"\']+\.pdf)["\']', html, re.IGNORECASE):
        url = m.group(1)
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            parsed = urllib.parse.urlparse(base_url)
            url = f"{parsed.scheme}://{parsed.netloc}{url}"
        elif not url.startswith("http"):
            continue
        # Filter : doit ressembler à un annual report
        url_lower = url.lower()
        if any(kw in url_lower for kw in ANNUAL_KEYWORDS):
            pdfs.append(url)
    return pdfs


def download_pdf(url, dest):
    code, body = http_get(url, timeout=180)
    if code != 200 or len(body) < 50000:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf, txt):
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run([pdftotext, "-layout", str(pdf), str(txt)], check=True, capture_output=True, timeout=180)
        return txt.exists() and txt.stat().st_size > 5000
    except Exception:
        return False


def process_ticker(ticker, fh):
    out_dir = OUT_DIR / ticker / "annual-report"
    txt_dir = OUT_DIR / ticker / "annual-text"
    if txt_dir.exists() and any(txt_dir.glob("*.txt")):
        return "skip-already"

    base = get_official_website(ticker)
    if not base:
        log(f"   [FAIL] {ticker} : pas de website officiel via yfinance", fh)
        return "no-website"

    log(f"   {ticker} : site = {base}", fh)
    # Try IR paths
    for ir_path in IR_PATHS:
        url = base + ir_path
        code, body = http_get(url)
        if code != 200:
            continue
        html = body.decode("utf-8", errors="ignore")
        pdfs = find_pdfs_in_html(html, url)
        if not pdfs:
            continue
        log(f"   {ticker} : trouvé {len(pdfs)} PDFs sur {ir_path}", fh)
        # Try latest matching
        for pdf_url in pdfs[:5]:
            year_m = re.search(r"(20\d{2})", pdf_url)
            year = int(year_m.group(1)) if year_m else 2024
            pdf_dest = out_dir / f"{year}.pdf"
            if download_pdf(pdf_url, pdf_dest):
                txt_dest = txt_dir / f"{year}.txt"
                if pdf_to_text(pdf_dest, txt_dest):
                    log(f"      ✓ {ticker} {year} ({txt_dest.stat().st_size} chars)", fh)
                    return "ok"
        time.sleep(1)
    log(f"   [FAIL] {ticker} : aucun PDF trouvé sur les paths IR testés", fh)
    return "fail"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers-file", required=True)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")

    tickers = [l.strip().upper() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    log(f"IR direct scraper : {len(tickers)} stés", fh)
    counts = {"ok": 0, "skip-already": 0, "no-website": 0, "fail": 0}
    for tk in tickers:
        log(f"=== {tk} ===", fh)
        r = process_ticker(tk, fh)
        counts[r] = counts.get(r, 0) + 1
        time.sleep(1)
    log(f"=== TOTAL : {counts} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
