#!/usr/bin/env python3
"""
Cat 3 EU Plan D : scrape sites IR JS-heavy via Playwright headless Chrome.

Pour les fails IR async (sites React/Vue/Angular qui chargent les liens
PDF dynamiquement), Playwright lance vraiment Chrome, exécute JS, attend
le DOM final, puis cherche les liens *.pdf annual report.

Coût : $0 (Playwright gratuit). RAM : ~200 MB par instance Chrome.
Limite à 1 instance pour ne pas chauffer le Mac.

Usage : python3 scripts/cat3-playwright-scraper.py --tickers-file <list>
"""
import argparse
import asyncio
import json
import re
import subprocess
import urllib.parse
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "sec-data/cat3-european"
LOG_PATH = ROOT / "sec-data/_meta/cat3-playwright.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Mettrik"

ANNUAL_KEYWORDS = [
    "annual_report", "annualreport", "annual-report", "rapport_annuel",
    "rapport-annuel", "rapportannuel", "jaarverslag", "geschaeftsbericht",
    "geschäftsbericht", "informe-anual", "bilancio", "relazione",
    "ar2024", "ar2025", "ar20", "/annualreport", "/annual_report",
]

IR_PATHS = [
    "/investors/financial-reports", "/investors", "/investor-relations",
    "/en/investors", "/en/investor-relations", "/about/investor-relations",
    "/group/investors", "/finance", "/investor", "/shareholders",
    "/investors/annual-reports", "/about-us/investors",
]


def log(msg, fh=None):
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    if fh: fh.write(line + "\n"); fh.flush()


def get_official_website(ticker):
    try:
        info = yf.Ticker(ticker).info
        site = info.get("website") or ""
        if site.startswith("http"):
            return site.rstrip("/")
    except Exception:
        pass
    return None


async def find_pdfs_via_playwright(page, base_url: str, max_paths=6):
    """Visite quelques paths IR via headless Chrome, retourne liens *.pdf trouvés."""
    pdfs = []
    seen = set()
    for ir_path in IR_PATHS[:max_paths]:
        url = base_url + ir_path
        try:
            await page.goto(url, timeout=20000, wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)  # laisse JS charger
        except Exception:
            continue
        # Récup tous les <a href> finissant en .pdf
        try:
            links = await page.eval_on_selector_all(
                "a[href]",
                "elements => elements.map(e => e.href).filter(h => h.toLowerCase().includes('.pdf'))"
            )
        except Exception:
            continue
        for link in links:
            if link in seen: continue
            seen.add(link)
            link_lower = link.lower()
            if any(kw in link_lower for kw in ANNUAL_KEYWORDS):
                pdfs.append(link)
        if pdfs:
            break  # 1 path qui retourne suffit
    return pdfs


def download_pdf_curl(url: str, dest: Path) -> bool:
    """Download via curl (plus stable que requests pour les CDN)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["curl", "-sLo", str(dest), "-A", UA, "--max-time", "120", url],
            timeout=180, capture_output=True
        )
        if dest.exists() and dest.stat().st_size > 50000:
            return True
        if dest.exists(): dest.unlink()
    except Exception:
        pass
    return False


def pdf_to_text(pdf, txt):
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run([pdftotext, "-layout", str(pdf), str(txt)],
                       check=True, capture_output=True, timeout=180)
        return txt.exists() and txt.stat().st_size > 5000
    except Exception:
        return False


async def process_ticker(page, ticker: str, fh=None) -> str:
    out_dir = OUT_DIR / ticker / "annual-report"
    txt_dir = OUT_DIR / ticker / "annual-text"
    if txt_dir.exists() and any(txt_dir.glob("*.txt")):
        return "skip-already"

    base = get_official_website(ticker)
    if not base:
        return "no-website"

    pdfs = await find_pdfs_via_playwright(page, base)
    if not pdfs:
        return "no-pdfs-found"

    for pdf_url in pdfs[:3]:
        year_m = re.search(r"(20\d{2})", pdf_url)
        year = int(year_m.group(1)) if year_m else 2024
        pdf_dest = out_dir / f"{year}.pdf"
        log(f"   {ticker} → DL {pdf_url[-80:]}", fh)
        if download_pdf_curl(pdf_url, pdf_dest):
            txt_dest = txt_dir / f"{year}.txt"
            if pdf_to_text(pdf_dest, txt_dest):
                log(f"      ✓ {ticker} {year} ({txt_dest.stat().st_size} chars)", fh)
                return f"ok-{year}"
    return "fail"


async def main_async(tickers, limit=0):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")
    log(f"PLAYWRIGHT SCRAPER : {len(tickers)} stés", fh)

    counts = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=UA)
        page = await context.new_page()
        for i, tk in enumerate(tickers):
            try:
                r = await process_ticker(page, tk, fh)
            except Exception as e:
                r = f"error-{type(e).__name__}"
            counts[r] = counts.get(r, 0) + 1
            log(f"  [{i+1}/{len(tickers)}] {tk} → {r}", fh)
        await browser.close()
    log(f"=== TOTAL : {counts} ===", fh)
    fh.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers-file", required=True)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()
    tickers = [l.strip().upper() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    asyncio.run(main_async(tickers, args.limit))


if __name__ == "__main__":
    main()
