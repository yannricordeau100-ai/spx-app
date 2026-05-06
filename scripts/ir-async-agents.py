#!/usr/bin/env python3
"""
Agents async IR scraper — 1 process Python, 50 connexions concurrentes via aiohttp.

Pour chaque sté :
  1. yfinance pour website URL + earnings calendar (gratuit, instant)
  2. Probe paths IR communs (asynchronously, semaphore=50)
  3. Parse HTML pour liens PDF reports (annual/half-year/quarterly)
  4. Skip si déjà téléchargé (cat3-european/<TICKER>/annual-report/<year>.pdf)
  5. Download missing PDFs en async
  6. pdftotext en background

RAM totale : ~50 MB pour 50 agents concurrents (vs 50 procs subprocess = 700 MB).
ETA estimée : 308 stés / 50 concurrent × 30s = ~3 min (si pages IR rapides).

Usage : python3 scripts/ir-async-agents.py --ticker-file <list> [--workers 50]
"""
import argparse
import asyncio
import json
import re
import ssl
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, urljoin

import aiohttp
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "sec-data/cat3-european"
LOG_PATH = ROOT / "sec-data/_meta/ir-async.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mettrik IR Agent"
IR_PATHS = [
    "/investors", "/investor-relations", "/en/investors", "/en/investor-relations",
    "/about/investor-relations", "/en/about-us/investors", "/about-us/investors",
    "/investors/financial-reports", "/investors/results-reports",
    "/investors/annual-reports", "/investors/financials",
    "/finance", "/group/investors", "/en/finance",
    "/investor", "/investor.html",
    "/investidores", "/inversores", "/anlegerbeziehungen",
]
PDF_KEYWORDS = [
    "annual_report", "annual-report", "annualreport",
    "half_year", "half-year", "halfyear", "interim", "h1_", "h2_",
    "rapport_annuel", "rapport-annuel", "rapportannuel",
    "jaarverslag", "geschaeftsbericht", "geschaftsbericht",
    "informe-anual", "informe_anual",
    "bilancio", "relazione",
    "ar20", "ar_20", "q1_", "q2_", "q3_", "q4_",
]


def log(msg, fh=None):
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n"); fh.flush()


async def get_website_blocking(ticker: str) -> str | None:
    """yfinance call (blocking, runs in executor)."""
    try:
        info = yf.Ticker(ticker).info
        site = info.get("website", "").rstrip("/")
        if site.startswith("http"):
            return site
    except Exception:
        pass
    return None


IR_LINK_KEYWORDS = ["investor", "shareholder", "actionnaire", "investidor", "inversor",
                    "investitori", "anleger", "financial-information", "financial-reports"]


async def probe_ir_paths(session: aiohttp.ClientSession, base: str) -> list[tuple[str, str]]:
    """Stratégie 2 niveaux :
    1. Lit la homepage, cherche les liens contenant 'investor' / 'shareholder' / etc.
    2. Suit ces liens (max 5).
    3. Si 0 trouvé, fallback sur les paths standards IR_PATHS.
    """
    async def fetch(url):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), allow_redirects=True) as r:
                if r.status == 200:
                    return str(r.url), await r.text()
        except Exception:
            pass
        return None

    results = []
    # Etape 1 : homepage
    home = await fetch(base)
    if home:
        home_url, html = home
        candidate_urls = set()
        for m in re.finditer(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE):
            link = m.group(1)
            link_low = link.lower()
            if any(kw in link_low for kw in IR_LINK_KEYWORDS):
                if link.startswith("//"): link = "https:" + link
                elif link.startswith("/"):
                    p = urlparse(home_url)
                    link = f"{p.scheme}://{p.netloc}{link}"
                elif not link.startswith("http"): continue
                candidate_urls.add(link)
                if len(candidate_urls) >= 5: break

        if candidate_urls:
            ir_results = await asyncio.gather(*[fetch(u) for u in candidate_urls])
            results = [r for r in ir_results if r]

    # Etape 2 : fallback paths standards si rien trouvé via homepage
    if not results:
        path_results = await asyncio.gather(*[fetch(base + p) for p in IR_PATHS])
        results = [r for r in path_results if r]
    return results


def find_pdf_links(html: str, base_url: str) -> list[str]:
    """Find PDF links. Smart heuristic :
    - Si <5 PDFs total : on prend tout (page IR épurée = tous reports)
    - Sinon : on filtre par keywords annual/half/quarter/etc.
    """
    all_pdfs = []
    for m in re.finditer(r'href=["\']([^"\']+\.pdf)["\']', html, re.IGNORECASE):
        url = m.group(1)
        if url.startswith("//"): url = "https:" + url
        elif url.startswith("/"):
            p = urlparse(base_url)
            url = f"{p.scheme}://{p.netloc}{url}"
        elif not url.startswith("http"): continue
        if url not in all_pdfs:
            all_pdfs.append(url)
    if len(all_pdfs) <= 5:
        return all_pdfs
    # Filtre par keywords
    return [u for u in all_pdfs if any(kw in u.lower() for kw in PDF_KEYWORDS)][:10]


async def download_pdf(session, url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 50000:
        return True
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=120)) as r:
            if r.status != 200:
                return False
            body = await r.read()
            if len(body) < 50000:
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            return True
    except Exception:
        return False


async def pdf_to_text_bg(pdf: Path, txt: Path):
    """Convert PDF to text in background subprocess."""
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt.parent.mkdir(parents=True, exist_ok=True)
    try:
        proc = await asyncio.create_subprocess_exec(
            pdftotext, "-layout", str(pdf), str(txt),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await asyncio.wait_for(proc.wait(), timeout=120)
        return txt.exists() and txt.stat().st_size > 5000
    except Exception:
        return False


async def process_ticker(ticker: str, semaphore, fh):
    """Process 1 ticker : website → IR paths → PDFs → download → convert."""
    async with semaphore:
        ticker_dir = OUT_DIR / ticker
        annual_text = ticker_dir / "annual-text"
        annual_pdf = ticker_dir / "annual-report"

        # Skip si déjà 3+ fichiers .txt
        if annual_text.exists() and len(list(annual_text.glob("*.txt"))) >= 3:
            return {"ticker": ticker, "status": "skip-have-3"}

        loop = asyncio.get_event_loop()
        website = await loop.run_in_executor(None, lambda: yf.Ticker(ticker).info.get("website", "").rstrip("/"))
        if not website or not website.startswith("http"):
            return {"ticker": ticker, "status": "no-website"}

        connector = aiohttp.TCPConnector(ssl=ssl._create_unverified_context())
        async with aiohttp.ClientSession(connector=connector, headers={"User-Agent": UA}) as session:
            # Probe IR paths
            ir_results = await probe_ir_paths(session, website)
            if not ir_results:
                return {"ticker": ticker, "status": "no-ir-page"}

            # Find PDF links from all IR pages + sub-pages "annual"/"report"
            all_pdfs = []
            sub_pages_to_follow = []
            for url, html in ir_results[:3]:
                all_pdfs.extend(find_pdf_links(html, url))
                # Cherche sous-liens "annual" / "report" / "results"
                for m in re.finditer(r'href=["\']([^"\']+)["\'][^>]*>([^<]{0,100})', html, re.IGNORECASE):
                    href, text = m.group(1), m.group(2)
                    combined = (href + " " + text).lower()
                    if any(kw in combined for kw in ["annual", "report", "result", "rapport", "bilancio"]):
                        if href.startswith("//"): href = "https:" + href
                        elif href.startswith("/"):
                            p = urlparse(url)
                            href = f"{p.scheme}://{p.netloc}{href}"
                        elif not href.startswith("http"): continue
                        if href.endswith(".pdf"): continue  # déjà cherché
                        sub_pages_to_follow.append(href)

            # Follow up to 3 sub-pages to find more PDFs
            sub_pages_to_follow = list(dict.fromkeys(sub_pages_to_follow))[:3]
            if sub_pages_to_follow and len(all_pdfs) < 3:
                async def fetch_sub(u):
                    try:
                        async with session.get(u, timeout=aiohttp.ClientTimeout(total=15)) as r:
                            if r.status == 200:
                                return str(r.url), await r.text()
                    except: pass
                    return None
                sub_results = await asyncio.gather(*[fetch_sub(u) for u in sub_pages_to_follow])
                for sr in sub_results:
                    if sr:
                        all_pdfs.extend(find_pdf_links(sr[1], sr[0]))

            all_pdfs = list(dict.fromkeys(all_pdfs))[:8]
            if not all_pdfs:
                return {"ticker": ticker, "status": "no-pdf-found"}

            # Download missing PDFs
            downloaded = 0
            for pdf_url in all_pdfs[:5]:
                year_m = re.search(r"(20\d{2})", pdf_url)
                year = int(year_m.group(1)) if year_m else 2024
                pdf_dest = annual_pdf / f"{year}.pdf"
                if pdf_dest.exists() and pdf_dest.stat().st_size > 50000:
                    continue
                ok = await download_pdf(session, pdf_url, pdf_dest)
                if ok:
                    downloaded += 1
                    txt_dest = annual_text / f"{year}.txt"
                    await pdf_to_text_bg(pdf_dest, txt_dest)

            return {"ticker": ticker, "status": f"ok-{downloaded}-pdfs", "pdfs_found": len(all_pdfs)}


async def main_async(tickers: list[str], workers: int):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")
    log(f"IR ASYNC AGENTS : {len(tickers)} stés, {workers} workers", fh)

    semaphore = asyncio.Semaphore(workers)
    tasks = [process_ticker(tk, semaphore, fh) for tk in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    counts = {}
    for r in results:
        if isinstance(r, Exception):
            counts["exception"] = counts.get("exception", 0) + 1
            continue
        s = r.get("status", "?")
        counts[s] = counts.get(s, 0) + 1
    log(f"=== TOTAL : {counts} ===", fh)
    fh.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker-file", required=True)
    p.add_argument("--workers", type=int, default=30)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    tickers = [l.strip().upper() for l in Path(args.ticker_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    asyncio.run(main_async(tickers, args.workers))


if __name__ == "__main__":
    main()
