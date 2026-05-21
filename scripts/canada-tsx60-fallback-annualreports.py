#!/usr/bin/env python3
"""
Canada TSX 60 fallback — annualreports.com aggregator

Pour les stés où le scraper principal n'a trouvé aucun PDF (IR pages JS-heavy
type AEM, BCE, CLS, MFC). annualreports.com héberge gratuitement les rapports
annuels (4-15 ans selon sté).

Recherche par slug (deviné depuis le nom).

Usage :
    python3 scripts/canada-tsx60-fallback-annualreports.py
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
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "sec-data"
OUT_DIR = DATA_ROOT / "cat-canadian"
LOG_PATH = DATA_ROOT / "_meta" / "canada-tsx60-fallback.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mettrik-Research/1.0"
ANNUAL_BASE = "https://www.annualreports.com"

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

log_lock = Lock()


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    with log_lock:
        print(line, flush=True)
        if log_fh:
            log_fh.write(line + "\n")
            log_fh.flush()


def http_get(url: str, timeout: int = 30, accept: str = "*/*") -> tuple[int, bytes]:
    headers = {"User-Agent": UA, "Accept": accept}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def download_file(url: str, dest: Path, min_bytes: int = 50000) -> bool:
    if dest.exists() and dest.stat().st_size >= min_bytes:
        return True
    code, body = http_get(url, timeout=180)
    if code != 200 or len(body) < min_bytes:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    if txt_path.exists() and txt_path.stat().st_size > 5000:
        return True
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=180
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


# Curated slugs annualreports.com pour stés canadiennes vides
# (verified manually for the most common ones)
SLUGS = {
    "AEM.TO": "agnico-eagle-mines-limited",
    "ATD.TO": "alimentation-couche-tard",
    "ABX.TO": "barrick-gold-corporation",
    "BCE.TO": "bce",
    "BMO.TO": "bmo-financial-group",
    "CAE.TO": "cae-inc",
    "CNQ.TO": "canadian-natural-resources-limited",
    "CNR.TO": "canadian-national-railway-company",
    "CP.TO": "canadian-pacific-railway-limited",
    "CTC-A.TO": "canadian-tire-corporation-limited",
    "CLS.TO": "celestica-inc",
    "CVE.TO": "cenovus-energy-inc",
    "FFH.TO": "fairfax-financial-holdings-limited",
    "FNV.TO": "franco-nevada-corporation",
    "FSV.TO": "firstservice-corporation",
    "FTS.TO": "fortis-inc",
    "GIL.TO": "gildan-activewear-inc",
    "H.TO": "hydro-one-limited",
    "K.TO": "kinross-gold-corporation",
    "L.TO": "loblaw-companies-limited",
    "MFC.TO": "manulife-financial-corporation",
    "MRU.TO": "metro-inc",
    "NA.TO": "national-bank-of-canada",
    "NTR.TO": "nutrien-ltd",
    "OTEX.TO": "open-text-corporation",
    "POW.TO": "power-corporation-of-canada",
    "PPL.TO": "pembina-pipeline-corporation",
    "QSR.TO": "restaurant-brands-international-inc",
    "RCI-B.TO": "rogers-communications-inc",
    "SAP.TO": "saputo-inc",
    "SHOP.TO": "shopify-inc",
    "SU.TO": "suncor-energy-inc",
    "T.TO": "telus-corporation",
    "TRI.TO": "thomson-reuters-corporation",
    "WCN.TO": "waste-connections-inc",
    "WPM.TO": "wheaton-precious-metals-corp",
    "WSP.TO": "wsp-global-inc",
}


def get_pdf_links_annualreports(slug: str) -> list[tuple[int, str]]:
    """Pour un slug annualreports.com, parse la page et retourne [(year, pdf_url), ...]."""
    url = f"{ANNUAL_BASE}/Company/{slug}"
    code, body = http_get(url, accept="text/html")
    if code != 200:
        return []
    html = body.decode("utf-8", errors="ignore")
    pdfs = []
    for m in re.finditer(r'href="(/HostedData/AnnualReportArchive/[^"]+_(\d{4})\.pdf)"', html):
        path = m.group(1)
        year = int(m.group(2))
        full_url = ANNUAL_BASE + path
        if (year, full_url) not in pdfs:
            pdfs.append((year, full_url))
    return sorted(pdfs, key=lambda x: -x[0])


def fallback_ticker(ticker: str, slug: str, log_fh=None) -> dict:
    ticker_safe = ticker.replace("/", "_")
    out = OUT_DIR / ticker_safe
    out.mkdir(parents=True, exist_ok=True)
    (out / "annual-report").mkdir(parents=True, exist_ok=True)
    (out / "annual-text").mkdir(parents=True, exist_ok=True)

    log(f"[{ticker}] fallback annualreports slug={slug}", log_fh)
    pdfs = get_pdf_links_annualreports(slug)
    if not pdfs:
        log(f"  [FAIL] no PDFs found for slug {slug}", log_fh)
        return {"ticker": ticker, "ok": False, "count": 0}

    n_downloaded = 0
    for year, pdf_url in pdfs[:7]:  # max 7 ans
        pdf_dest = out / "annual-report" / f"{year}.pdf"
        if pdf_dest.exists() and pdf_dest.stat().st_size > 50000:
            continue
        if download_file(pdf_url, pdf_dest, min_bytes=50000):
            txt_dest = out / "annual-text" / f"{year}.txt"
            pdf_to_text(pdf_dest, txt_dest)
            n_downloaded += 1
            log(f"  [OK] {year} ({pdf_dest.stat().st_size//1024} KB)", log_fh)
        # throttle léger pour ne pas saturer annualreports.com
        time.sleep(1)

    log(f"[{ticker}] DONE — {n_downloaded} annual reports", log_fh)
    return {"ticker": ticker, "ok": n_downloaded > 0, "count": n_downloaded}


def main():
    parser = argparse.ArgumentParser(description="TSX 60 fallback annualreports.com")
    parser.add_argument("--ticker", type=str)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    workers = max(1, min(args.workers, 3))

    if args.ticker:
        targets = [(args.ticker, SLUGS.get(args.ticker))]
        if not targets[0][1]:
            print(f"No slug mapping for {args.ticker}", file=sys.stderr)
            sys.exit(1)
    else:
        targets = list(SLUGS.items())

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a", encoding="utf-8")
    log(f"=== TSX 60 fallback annualreports start — {len(targets)} tickers, workers={workers} ===", log_fh)

    results = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(fallback_ticker, t, s, log_fh) for t, s in targets]
        for fut in as_completed(futures):
            results.append(fut.result())

    total_ok = sum(1 for r in results if r["ok"])
    total_docs = sum(r["count"] for r in results)
    log(f"=== FALLBACK DONE — {total_ok}/{len(targets)} ok, {total_docs} PDFs total ===", log_fh)
    log_fh.close()

    print(f"\nFallback: {total_ok}/{len(targets)} ok, {total_docs} PDFs")


if __name__ == "__main__":
    main()
