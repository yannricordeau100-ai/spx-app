#!/usr/bin/env python3
"""
Cat 3 EU pures : trouve PDF rapport annuel via DuckDuckGo search,
download + pdftotext, sauve dans cat3-european/<TICKER>/annual-text/<year>.txt

Plan B (annualreports.com offline). Marche pour toutes stés EU/monde.

Usage :
  python3 scripts/cat3-ddg-pdf-scraper.py --tickers-file /path/to/list.txt --names-json /tmp/stoxx600-names.json
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

from ddgs import DDGS

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "sec-data/cat3-european"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/cat3-ddg-scraper.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mettrik Research"

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if log_fh:
        log_fh.write(line + "\n")
        log_fh.flush()


def search_pdf_links(name: str, max_results: int = 10) -> list[str]:
    """Cherche via DDG, retourne liste d'URLs PDF candidats."""
    queries = [
        f'"{name}" annual report 2024 filetype:pdf',
        f'"{name}" annual report 2023 filetype:pdf',
        f"{name} jaarverslag OR geschäftsbericht OR rapport_annuel 2024 filetype:pdf",
    ]
    pdfs = []
    seen = set()
    try:
        ddgs = DDGS()
        for q in queries:
            try:
                for r in ddgs.text(q, max_results=max_results):
                    url = r.get("href") or r.get("url") or ""
                    if not url or not url.lower().endswith(".pdf"):
                        continue
                    if url in seen:
                        continue
                    seen.add(url)
                    pdfs.append(url)
                if pdfs:
                    break  # 1ère query qui retourne suffit
            except Exception as e:
                log(f"   [DDG error] {e}")
                time.sleep(3)
    except Exception as e:
        log(f"   [DDG init error] {e}")
    return pdfs


def is_likely_official(url: str, name: str) -> bool:
    """Filtre : doit être domaine plausiblement officiel."""
    bad_hosts = ["scribd.com", "annualreports.com", "researchgate.net", "academia.edu",
                 "slideshare.net", "yumpu.com", "issuu.com"]
    host = urllib.parse.urlparse(url).netloc.lower()
    for b in bad_hosts:
        if b in host:
            return False
    return True


def download_pdf(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as r:
            body = r.read()
            if len(body) < 50000:  # PDF trop petit, sûrement erreur
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            return True
    except Exception as e:
        log(f"   [DL error] {url[:80]} : {e}")
        return False


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=180
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def extract_year(url: str) -> int:
    m = re.search(r"(20\d{2})", url)
    return int(m.group(1)) if m else 2024


def process_ticker(ticker: str, name: str, log_fh) -> dict:
    res = {"ticker": ticker, "name": name, "status": "fail", "files": []}
    out_dir = OUT_DIR / ticker / "annual-report"
    txt_dir = OUT_DIR / ticker / "annual-text"

    if txt_dir.exists() and any(txt_dir.glob("*.txt")):
        res["status"] = "skip-already"
        return res

    pdfs = search_pdf_links(name)
    if not pdfs:
        log(f"   [FAIL] {ticker} ({name}): DDG zero PDF", log_fh)
        return res

    for url in pdfs[:5]:
        if not is_likely_official(url, name):
            continue
        year = extract_year(url)
        pdf_dest = out_dir / f"{year}.pdf"
        log(f"   → DL {ticker} {year} : {url[-70:]}", log_fh)
        if download_pdf(url, pdf_dest):
            txt_dest = txt_dir / f"{year}.txt"
            if pdf_to_text(pdf_dest, txt_dest):
                res["files"].append(f"{year}.pdf+txt")
                res["status"] = "ok"
                log(f"      ✓ PDF + texte ({txt_dest.stat().st_size} chars)", log_fh)
                break
        time.sleep(2)
    return res


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers-file", required=True)
    p.add_argument("--names-json", required=True)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    names = json.loads(Path(args.names_json).read_text()).get("mapping", {})
    tickers = [l.strip().upper() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]

    log(f"DDG SCRAPER : {len(tickers)} stés", log_fh)
    n_ok = n_fail = n_skip = 0
    for ticker in tickers:
        name = names.get(ticker, ticker.split(".")[0])
        if not name:
            n_fail += 1
            continue
        log(f"=== {ticker} ({name}) ===", log_fh)
        res = process_ticker(ticker, name, log_fh)
        if res["status"] == "ok":
            n_ok += 1
        elif res["status"] == "skip-already":
            n_skip += 1
        else:
            n_fail += 1
        time.sleep(2)  # politeness

    log(f"=== TOTAL : {n_ok} OK, {n_fail} fail, {n_skip} skip ===", log_fh)
    log_fh.close()


if __name__ == "__main__":
    main()
