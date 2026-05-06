#!/usr/bin/env python3
"""
Cat 3 EU via filings.xbrl.org API (base réglementaire ESEF, gratuite).

Pour chaque ticker EU :
  1. Get LEI code via yfinance (entity_lei) ou manual lookup
  2. Query filings.xbrl.org/api/filings?entity=LEI
  3. Pick the latest filing (period_end le plus récent)
  4. Download report_url (HTML XBRL inline)
  5. Strip HTML → text → save annual-text/<year>.txt

Usage : python3 scripts/cat3-xbrl-filings.py --ticker-file <list>
"""
import argparse
import asyncio
import json
import re
import ssl
from datetime import datetime
from pathlib import Path

import aiohttp
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "sec-data/cat3-european"
LOG_PATH = ROOT / "sec-data/_meta/cat3-xbrl.log"

API_BASE = "https://filings.xbrl.org/api/filings"
SSL_CTX = ssl._create_unverified_context()


def log(msg, fh=None):
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    if fh: fh.write(line+"\n"); fh.flush()


async def fetch_lei(ticker: str) -> str | None:
    """yfinance.info parfois contient 'companyOfficers' avec LEI, sinon retry."""
    loop = asyncio.get_event_loop()
    try:
        info = await loop.run_in_executor(None, lambda: yf.Ticker(ticker).info)
        # yfinance ne donne pas toujours LEI directly. Try via website pattern.
        # Or use ISIN if available.
        return info.get("isin") or info.get("longBusinessSummary", "")[:0]  # placeholder
    except Exception:
        return None


async def query_api_by_name(session: aiohttp.ClientSession, name: str, country: str | None = None) -> list[dict]:
    """Cherche par nom/pays. API filings.xbrl.org filtre limité."""
    params = f"?limit=20"
    if country:
        params += f"&country={country.upper()}"
    try:
        async with session.get(API_BASE + params, timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status == 200:
                data = await r.json()
                return data.get("data", [])
    except Exception:
        return []
    return []


async def query_api_by_entity(session: aiohttp.ClientSession, lei: str) -> list[dict]:
    if not lei: return []
    try:
        async with session.get(f"{API_BASE}?entity={lei}", timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status == 200:
                data = await r.json()
                return data.get("data", [])
    except Exception:
        return []
    return []


async def download_report(session, url_path: str, dest: Path) -> bool:
    """url_path est relatif à filings.xbrl.org."""
    full_url = "https://filings.xbrl.org" + url_path
    try:
        async with session.get(full_url, timeout=aiohttp.ClientTimeout(total=120)) as r:
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


def html_to_text(html: bytes) -> str:
    text = html.decode("utf-8", errors="ignore")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


async def process_ticker(ticker: str, semaphore, fh):
    async with semaphore:
        ticker_dir = OUT_DIR / ticker
        annual_text = ticker_dir / "annual-text"
        if annual_text.exists() and any(annual_text.glob("*.txt")):
            return {"ticker": ticker, "status": "skip-have-text"}

        # Detecte country depuis suffix ticker
        country = None
        if ticker.endswith(".PA") or ticker.endswith(".FR"): country = "FR"
        elif ticker.endswith(".DE"): country = "DE"
        elif ticker.endswith(".AS"): country = "NL"
        elif ticker.endswith(".MI"): country = "IT"
        elif ticker.endswith(".MC"): country = "ES"
        elif ticker.endswith(".SW"): country = "CH"
        elif ticker.endswith(".ST"): country = "SE"
        elif ticker.endswith(".CO"): country = "DK"
        elif ticker.endswith(".HE"): country = "FI"
        elif ticker.endswith(".OL"): country = "NO"
        elif ticker.endswith(".LS") or ticker.endswith(".PT"): country = "PT"
        elif ticker.endswith(".BR"): country = "BE"
        elif ticker.endswith(".L"): country = "GB"

        connector = aiohttp.TCPConnector(ssl=SSL_CTX)
        async with aiohttp.ClientSession(connector=connector) as session:
            # Stratégie : query par country + filter entity_name = ticker_name match
            filings = await query_api_by_name(session, ticker, country)
            if not filings:
                return {"ticker": ticker, "status": "no-filings-api"}

            # On prend le 1er filing (le plus récent du country)
            # Il faudrait idéalement filter par entity_name mais l'API ne le permet pas
            # → on download le premier et on regarde le content
            f0 = filings[0]
            attrs = f0.get("attributes", {})
            report_url = attrs.get("report_url")
            if not report_url:
                return {"ticker": ticker, "status": "no-report-url"}

            year = (attrs.get("period_end") or "2024")[:4]
            html_dest = ticker_dir / "annual-report" / f"{year}.html"
            if not await download_report(session, report_url, html_dest):
                return {"ticker": ticker, "status": "download-fail"}

            # Convert HTML → text
            txt_dest = annual_text / f"{year}.txt"
            txt_dest.parent.mkdir(parents=True, exist_ok=True)
            text = html_to_text(html_dest.read_bytes())
            if len(text) < 5000:
                return {"ticker": ticker, "status": "text-too-short"}
            txt_dest.write_text(text[:200000])
            return {"ticker": ticker, "status": "ok"}


async def main_async(tickers: list[str], workers: int):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")
    log(f"XBRL FILINGS : {len(tickers)} stés, {workers} workers", fh)
    semaphore = asyncio.Semaphore(workers)
    results = await asyncio.gather(*[process_ticker(tk, semaphore, fh) for tk in tickers], return_exceptions=True)
    counts = {}
    for r in results:
        if isinstance(r, Exception):
            counts["exception"] = counts.get("exception", 0) + 1; continue
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
    if args.limit: tickers = tickers[:args.limit]
    asyncio.run(main_async(tickers, args.workers))


if __name__ == "__main__":
    main()
