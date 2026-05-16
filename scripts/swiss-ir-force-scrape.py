#!/usr/bin/env python3
"""
swiss-ir-force-scrape.py — Vague 2 scrape FORCÉ pour combler les manquants
SMI Suisses (no-source ZURN+STMN + low-coverage 13 SMI).

Stratégie multi-source :
1. yfinance.info['website'] → cherche /investor-relations/, /financial-reports/
2. Parse HTML, trouve liens *.pdf annual report + half-year + ESG
3. Download FORCÉ (override skip-existing) + pdftotext

Output : sec-data/cat3-european/<TICKER>.SW/{annual-report, half-year, esg}/<year>.pdf
+ annual-text/<year>.txt
+ manifest.json update

Usage :
  python3 scripts/swiss-ir-force-scrape.py --tickers ZURN.SW,STMN.SW
  python3 scripts/swiss-ir-force-scrape.py --no-source-only  # ZURN+STMN
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
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "sec-data" / "cat3-european"
LOG_PATH = PROJECT_ROOT / "sec-data" / "_meta" / "swiss-ir-force.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Patterns IR paths à essayer sur chaque domaine
IR_PATH_CANDIDATES = [
    "/investors", "/en/investors", "/investor-relations", "/en/investor-relations",
    "/investor", "/en/investor", "/group/en/investors",
    "/financial-reports", "/en/financial-reports", "/financial-information",
    "/annual-report", "/en/annual-report", "/reports", "/en/reports",
    "/about-us/investor-relations", "/about/investors", "/investors/financial-reports",
    "/investors/results-reports", "/en/investors/financial-reports",
    "/en/about/investors", "/corporate/web/en/home/about_us/investors",
]


def log(msg, fh=None):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n")
        fh.flush()


def http_get(url: str, timeout: int = 30, max_bytes: int = 5_000_000):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read(max_bytes), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, b"", ""
    except Exception:
        return 0, b"", ""


def find_pdf_links(html: str, base_url: str) -> list[tuple[str, int | None]]:
    """Extrait URLs PDF + tente d'identifier l'année."""
    pdfs = []
    seen = set()
    for m in re.finditer(r'href=["\']([^"\']+\.pdf)["\']', html, re.IGNORECASE):
        href = m.group(1)
        # Skip social media, generic
        if any(x in href.lower() for x in ["whitepaper", "fact-sheet/social", "logo"]):
            continue
        full = urllib.parse.urljoin(base_url, href)
        if full in seen:
            continue
        seen.add(full)
        # Tente d'identifier année dans path
        year_match = re.search(r'/(20\d{2})/', href) or re.search(r'(20\d{2})\.pdf', href, re.IGNORECASE)
        year = int(year_match.group(1)) if year_match else None
        # Filter : annual reports / interim / sustainability
        if not any(kw in href.lower() for kw in ["annual", "report", "ar20", "ar_", "interim", "halfyear",
                                                  "half-year", "sustainability", "esg", "rapport"]):
            continue
        pdfs.append((full, year))
    return pdfs


def download_pdf(url: str, dest: Path, min_bytes: int = 50_000) -> bool:
    code, body, ct = http_get(url, timeout=180)
    if code != 200 or len(body) < min_bytes:
        return False
    # Vérifier que c'est un PDF
    if not (body[:4] == b"%PDF" or "pdf" in ct.lower()):
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run([pdftotext, "-layout", str(pdf_path), str(txt_path)],
                       check=True, capture_output=True, timeout=180)
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def categorize_pdf(href: str) -> str:
    """Détermine sous-dossier : annual-report, half-year, esg."""
    h = href.lower()
    if any(kw in h for kw in ["half-year", "halfyear", "interim", "h1", "h2", "1h_", "2h_"]):
        return "half-year"
    if any(kw in h for kw in ["sustainability", "esg", "csr", "environment", "social-report"]):
        return "esg"
    return "annual-report"


def process_ticker(ticker: str, max_years: int, log_fh) -> dict:
    res = {"ticker": ticker, "started_at": datetime.now(timezone.utc).isoformat(), "downloads": []}
    log(f"━━ {ticker} ━━", log_fh)

    # 1. yfinance.info['website']
    try:
        info = yf.Ticker(ticker).info or {}
    except Exception as e:
        res["error"] = f"yfinance fail: {e}"
        log(f"  ❌ yfinance fail : {e}", log_fh)
        return res

    website = info.get("website", "").rstrip("/")
    if not website:
        res["error"] = "no website in yfinance.info"
        log(f"  ❌ no website", log_fh)
        return res
    log(f"  website : {website}", log_fh)

    # 2. Essayer IR paths
    all_pdfs = []
    for path in IR_PATH_CANDIDATES:
        url = website + path
        code, body, ct = http_get(url, timeout=20)
        if code != 200 or len(body) < 1000:
            continue
        html = body.decode("utf-8", errors="ignore")
        pdfs = find_pdf_links(html, url)
        if pdfs:
            log(f"     {path} → {len(pdfs)} PDFs", log_fh)
            all_pdfs.extend(pdfs)
        time.sleep(0.5)

    # Dédup + tri par année desc
    seen = set()
    unique = []
    for url, year in all_pdfs:
        if url in seen:
            continue
        seen.add(url)
        unique.append((url, year))
    unique.sort(key=lambda x: -(x[1] or 0))

    if not unique:
        res["error"] = "no PDF found across all IR paths"
        log(f"  ❌ no PDF found", log_fh)
        return res

    log(f"  → {len(unique)} PDFs uniques candidats", log_fh)

    # 3. Download top N (annual=max_years, half-year=4, esg=3)
    out = OUT_DIR / ticker
    counts = {"annual-report": 0, "half-year": 0, "esg": 0}
    limits = {"annual-report": max_years, "half-year": 4, "esg": 3}

    for url, year in unique:
        cat = categorize_pdf(url)
        if counts[cat] >= limits[cat]:
            continue
        year_str = str(year) if year else f"unknown-{counts[cat]+1}"
        # Nom fichier basé sur année + catégorie
        if cat == "half-year" and year:
            suffix = "-H1" if counts[cat] % 2 == 0 else "-H2"
            dest = out / cat / f"{year}{suffix}.pdf"
        else:
            dest = out / cat / f"{year_str}.pdf"
        if dest.exists() and dest.stat().st_size > 50000:
            log(f"     [SKIP] {dest.name} déjà ({dest.stat().st_size // 1024} KB)", log_fh)
            counts[cat] += 1
            continue

        log(f"  → DL {cat}/{dest.name} : ...{url[-50:]}", log_fh)
        ok = download_pdf(url, dest, min_bytes=50_000)
        if ok:
            counts[cat] += 1
            # PDF to text pour annual-report uniquement
            if cat == "annual-report":
                txt_dest = out / "annual-text" / f"{year_str}.txt"
                txt_ok = pdf_to_text(dest, txt_dest)
                log(f"     ✓ {dest.stat().st_size // 1024} KB + txt {'OK' if txt_ok else 'FAIL'}", log_fh)
            else:
                log(f"     ✓ {dest.stat().st_size // 1024} KB", log_fh)
            res["downloads"].append({"cat": cat, "year": year, "path": str(dest.relative_to(PROJECT_ROOT)), "size_kb": dest.stat().st_size // 1024})
        time.sleep(1)

    res["counts"] = counts
    res["status"] = "ok" if sum(counts.values()) > 0 else "no-download"
    log(f"  ✅ {ticker} : annual={counts['annual-report']} half-year={counts['half-year']} esg={counts['esg']}", log_fh)
    return res


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tickers", help="Comma-separated")
    parser.add_argument("--no-source-only", action="store_true", help="ZURN.SW + STMN.SW")
    parser.add_argument("--all-low-coverage", action="store_true", help="13 SMI low coverage")
    parser.add_argument("--max-years", type=int, default=5)
    args = parser.parse_args()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",")]
    elif args.no_source_only:
        tickers = ["ZURN.SW", "STMN.SW"]
    elif args.all_low_coverage:
        tickers = ["ZURN.SW", "STMN.SW", "UBSG.SW", "SCMN.SW", "CFR.SW", "LONN.SW",
                   "GEBN.SW", "HOLN.SW", "SREN.SW", "ALC.SW", "SLHN.SW", "SIKA.SW", "GIVN.SW"]
    else:
        print("ERR: --tickers OR --no-source-only OR --all-low-coverage", file=sys.stderr)
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"START swiss-ir-force : {len(tickers)} tickers · max_years={args.max_years}", log_fh)
    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)

    results = []
    for i, t in enumerate(tickers, 1):
        log(f"\n[{i}/{len(tickers)}]", log_fh)
        try:
            r = process_ticker(t, args.max_years, log_fh)
            results.append(r)
        except KeyboardInterrupt:
            log("INTERRUPTED", log_fh)
            break
        except Exception as e:
            results.append({"ticker": t, "status": "exception", "error": str(e)})
            log(f"  ❌ {t} exception : {e}", log_fh)
        time.sleep(2)

    log(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"DONE : {len(results)} tickers", log_fh)
    ok = sum(1 for r in results if r.get("status") == "ok")
    log(f"   OK : {ok}/{len(results)}", log_fh)
    log_fh.close()


if __name__ == "__main__":
    main()
