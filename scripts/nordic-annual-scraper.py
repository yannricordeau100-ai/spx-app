#!/usr/bin/env python3
"""
Scraper annual reports Nordiques (SE/DK/FI/NO) 2020-2024 via IR sites directs.

Workflow par ticker :
  1. Lit IR URL depuis /tmp/nordic-scrape/ir-urls.json
  2. WebFetch (via requests + UA Chrome) la page IR
  3. Extrait liens PDF matching annual/report/jaarverslag/arsrapport/etc + (2020|2021|2022|2023|2024)
  4. Pour chaque year manquant dans sec-data/cat3-european/<TICKER>/annual-text/ :
     - curl le PDF (timeout 600s, UA Chrome, max 80 Mo)
     - pdftotext -layout
     - Anti-cross-pollution : grep nom officiel ≥5 mentions
     - Si OK : écrit <year>.txt ; sinon supprime + log REJECTED
  5. Log dans sec-data/_meta/nordic-annual.log

Usage :
  python3 scripts/nordic-annual-scraper.py [--ticker TICKER] [--years 2020,2021,2022,2023,2024]
"""
import argparse
import json
import os
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
OUT_BASE = PROJECT_ROOT / "sec-data/cat3-european"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/nordic-annual.log"
IR_URLS_PATH = Path("/tmp/nordic-scrape/ir-urls.json")
PDF_TMP_BASE = Path("/tmp/nordic-scrape/pdfs")

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
TARGET_YEARS = [2020, 2021, 2022, 2023, 2024]

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

# Keywords pour identifier un PDF annual report (multilingue nord)
ANNUAL_KEYWORDS = [
    "annual-report", "annualreport", "annual_report",
    "arsredovisning", "årsredovisning", "ar20", "ar-20",
    "arsrapport", "årsrapport",
    "vuosikertomus", "vuosikatsaus",
    "rapport-annuel",
    "geschaeftsbericht", "geschäftsbericht",
    "/ar/", "_ar_", "-ar-",
    "annual",
]


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n")
        fh.flush()


def http_get(url, timeout=60, max_bytes=None):
    """GET via curl avec UA Chrome (plus tolérant aux anti-bot), retourne (status, body, content_type)."""
    try:
        result = subprocess.run([
            "curl", "-sSL",
            "--max-time", str(timeout),
            "-A", UA,
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "-H", "Accept-Language: en-US,en;q=0.9",
            "-H", "Accept-Encoding: gzip",
            "--compressed",
            "-w", "%{http_code}",
            "-o", "-",
            url,
        ], capture_output=True, timeout=timeout + 5)
        body = result.stdout
        # Last 3 chars = http code
        if len(body) >= 3:
            try:
                status = int(body[-3:].decode())
                body = body[:-3]
            except (ValueError, UnicodeDecodeError):
                status = 200 if body else 0
        else:
            status = 0
        return status, body, ""
    except Exception as e:
        return 0, str(e).encode(), ""


def find_pdf_urls(html, base_url):
    """Trouve les URLs PDF dans le HTML, retourne dict {year: [urls]}."""
    pdfs_by_year = {}
    # Match href="...pdf" ou href='...pdf'
    pattern = re.compile(r'''href=["']([^"']+\.pdf[^"']*)["']''', re.IGNORECASE)
    for m in pattern.finditer(html):
        url = m.group(1)
        # Resolve relative URLs
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            parsed = urllib.parse.urlparse(base_url)
            url = f"{parsed.scheme}://{parsed.netloc}{url}"
        elif not url.startswith("http"):
            url = urllib.parse.urljoin(base_url, url)
        url_lower = url.lower()
        # Check if looks like annual report (path or filename)
        has_annual_kw = any(kw in url_lower for kw in ANNUAL_KEYWORDS)
        # Extract year from URL
        year_m = re.search(r"(20[12]\d)", url)
        if not year_m:
            continue
        year = int(year_m.group(1))
        if year not in TARGET_YEARS:
            continue
        if not has_annual_kw:
            # Sauf si "report" + year dans URL clean
            if "report" not in url_lower and "publication" not in url_lower:
                continue
        pdfs_by_year.setdefault(year, []).append(url)
    return pdfs_by_year


def download_pdf(url, dest, fh, max_size_mb=80):
    """Curl le PDF avec UA Chrome, timeout 600s."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run([
            "curl", "-sSL",
            "--max-time", "600",
            "--max-filesize", str(max_size_mb * 1024 * 1024),
            "-A", UA,
            "-H", "Accept: application/pdf,*/*",
            "-o", str(dest),
            url,
        ], capture_output=True, timeout=620)
        if result.returncode != 0:
            log(f"      curl fail rc={result.returncode}: {result.stderr.decode()[:200]}", fh)
            return False
        if not dest.exists() or dest.stat().st_size < 50000:
            log(f"      pdf trop petit ({dest.stat().st_size if dest.exists() else 0} bytes)", fh)
            return False
        # Verify is PDF
        with open(dest, "rb") as f:
            header = f.read(8)
        if not header.startswith(b"%PDF"):
            log(f"      pas un PDF (header={header[:8]!r})", fh)
            dest.unlink()
            return False
        return True
    except subprocess.TimeoutExpired:
        log(f"      timeout curl", fh)
        return False
    except Exception as e:
        log(f"      exception curl: {e}", fh)
        return False


def pdf_to_text(pdf, txt, fh):
    """pdftotext -layout."""
    txt.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            ["/opt/homebrew/bin/pdftotext", "-layout", str(pdf), str(txt)],
            check=True, capture_output=True, timeout=300,
        )
        if not txt.exists() or txt.stat().st_size < 10000:
            log(f"      pdftotext output trop petit", fh)
            return False
        return True
    except Exception as e:
        log(f"      pdftotext fail: {e}", fh)
        return False


def validate_content(txt_path, company_name, fh, min_mentions=5):
    """Anti-cross-pollution : grep nom officiel ≥ min_mentions."""
    try:
        with open(txt_path, "r", errors="ignore") as f:
            content = f.read()
        # Test variations du nom
        # Ex "Novo Nordisk" -> compter "Novo Nordisk", "Novo", "Nordisk"
        primary = company_name.split()[0]  # premier mot significatif
        # Skip mots génériques
        if primary.lower() in ("the", "ab", "asa", "oyj", "as"):
            words = company_name.split()
            primary = words[1] if len(words) > 1 else primary
        full_count = content.count(company_name)
        primary_count = content.count(primary)
        # Verdict
        if full_count >= min_mentions or primary_count >= min_mentions * 3:
            log(f"      ✓ validation OK ({company_name}={full_count}, {primary}={primary_count})", fh)
            return True
        else:
            log(f"      ✗ validation FAIL ({company_name}={full_count}, {primary}={primary_count})", fh)
            return False
    except Exception as e:
        log(f"      validation error: {e}", fh)
        return False


def process_ticker(ticker, name, ir_url, fh, force_years=None):
    """Traite un ticker : fetch IR, dl PDFs manquants, extract+validate."""
    out_dir = OUT_BASE / ticker / "annual-text"
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir = OUT_BASE / ticker / "annual-report"
    pdf_dir.mkdir(parents=True, exist_ok=True)

    existing_years = set()
    for f in out_dir.glob("*.txt"):
        try:
            y = int(f.stem)
            if y in TARGET_YEARS and f.stat().st_size > 30000:
                existing_years.add(y)
        except ValueError:
            pass
    missing = set(TARGET_YEARS) - existing_years
    if force_years:
        missing = set(force_years)
    if not missing:
        log(f"   {ticker} : déjà 5/5 ans, skip", fh)
        return "skip-complete"

    log(f"   {ticker} ({name}) : besoin {sorted(missing)} (existant: {sorted(existing_years)})", fh)
    log(f"   IR: {ir_url}", fh)

    # Fetch IR page
    status, body, ctype = http_get(ir_url, timeout=30)
    if status != 200 or len(body) < 500:
        log(f"   [FAIL] IR page status={status} len={len(body)}", fh)
        return "ir-fail"

    html = body.decode("utf-8", errors="ignore")
    pdfs_by_year = find_pdf_urls(html, ir_url)
    if not pdfs_by_year:
        log(f"   [FAIL] aucun PDF year-tagged trouvé sur IR page", fh)
        return "no-pdfs"

    log(f"   PDFs trouvés par année: { {y: len(pdfs_by_year[y]) for y in pdfs_by_year} }", fh)

    results = {"ok": [], "fail": [], "rejected": []}
    for year in sorted(missing):
        if year not in pdfs_by_year:
            results["fail"].append(year)
            continue
        # Essai max 3 candidats par année
        candidates = pdfs_by_year[year][:3]
        success = False
        for i, pdf_url in enumerate(candidates):
            log(f"      tentative {year} #{i+1}: {pdf_url[:120]}", fh)
            pdf_dest = pdf_dir / f"{year}.pdf"
            txt_dest = out_dir / f"{year}.txt"
            if not download_pdf(pdf_url, pdf_dest, fh):
                continue
            if not pdf_to_text(pdf_dest, txt_dest, fh):
                continue
            if not validate_content(txt_dest, name, fh):
                txt_dest.unlink(missing_ok=True)
                # Garde le PDF pour audit mais flag
                pdf_dest.rename(pdf_dir / f"{year}.REJECTED.pdf")
                results["rejected"].append(year)
                continue
            log(f"      ✓ {ticker} {year} OK ({txt_dest.stat().st_size} chars)", fh)
            results["ok"].append(year)
            success = True
            break
        if not success and year not in results["rejected"]:
            results["fail"].append(year)
        time.sleep(1)

    log(f"   {ticker} bilan: ok={results['ok']} fail={results['fail']} rejected={results['rejected']}", fh)
    return "ok" if results["ok"] else ("rejected" if results["rejected"] else "fail")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", help="Process only this ticker")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--years", help="Force these years (CSV, ex 2020,2021)")
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")
    log("=" * 70, fh)
    log(f"START nordic-annual-scraper (ticker={args.ticker}, limit={args.limit})", fh)

    if not IR_URLS_PATH.exists():
        log(f"FATAL: {IR_URLS_PATH} introuvable", fh)
        sys.exit(1)

    with open(IR_URLS_PATH) as f:
        ir_data = json.load(f)

    if args.ticker:
        tickers = [args.ticker]
    else:
        tickers = list(ir_data.keys())
    if args.limit:
        tickers = tickers[:args.limit]

    force_years = None
    if args.years:
        force_years = [int(y) for y in args.years.split(",")]

    counts = {"ok": 0, "skip-complete": 0, "ir-fail": 0, "no-pdfs": 0, "rejected": 0, "fail": 0}
    for tk in tickers:
        if tk not in ir_data:
            log(f"[SKIP] {tk} : pas dans ir-urls.json", fh)
            continue
        log(f"=== {tk} ===", fh)
        try:
            r = process_ticker(tk, ir_data[tk]["name"], ir_data[tk]["ir"], fh, force_years)
            counts[r] = counts.get(r, 0) + 1
        except Exception as e:
            log(f"   EXCEPTION: {e}", fh)
            counts["fail"] = counts.get("fail", 0) + 1
        time.sleep(2)

    log(f"=== TOTAL: {counts} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
