#!/usr/bin/env python3
"""
IR scraper V2 — Playwright headless. Récupère ES + ER + transcripts depuis
les pages IR des sociétés FPI (V2 cat 2).

Pourquoi Playwright : les pages IR modernes sont des SPA JavaScript que
requests + BeautifulSoup ne peut pas voir (rendu côté client). Playwright
ouvre un Chromium headless qui exécute le JS et expose le DOM final.

Sortie :
    /Users/yann/Desktop/Projets 2025 26/App KPI/DATA/<COMPANY>/{ES,ER,transcripts,investor-day}/<year>/<filename>.pdf

Usage :
    python3 scripts/ir-scraper-v2.py [--ticker TSM,ASML,NVO,...] [--years 5]

Sources : config statique IR_CONFIG (top 50 cat 2, à étendre).
"""

import argparse
import asyncio
import os
import re
import ssl
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("ERREUR : pip3 install playwright && playwright install chromium")
    sys.exit(1)

import urllib.request

# ─────────────────────────────────────────────────────────────────────────
# Config IR par société (à enrichir progressivement)
# ─────────────────────────────────────────────────────────────────────────
IR_CONFIG = {
    "TSM": {
        "company_dir": "TSM",
        "name": "Taiwan Semiconductor",
        "pages": [
            "https://investor.tsmc.com/english/quarterly-results",
            "https://investor.tsmc.com/english/quarterly-results/2025",
            "https://investor.tsmc.com/english/quarterly-results/2024",
            "https://investor.tsmc.com/english/quarterly-results/2023",
            "https://investor.tsmc.com/english/quarterly-results/2022",
            "https://investor.tsmc.com/english/quarterly-results/2021",
            "https://investor.tsmc.com/english/annual-reports",
        ],
    },
    "ASML": {
        "company_dir": "ASML",
        "name": "ASML Holding",
        "pages": [
            "https://www.asml.com/en/investors/financial-results",
            "https://www.asml.com/en/investors/financial-results/quarterly-results",
            "https://www.asml.com/en/investors/financial-results/annual-report",
        ],
    },
    "NVO": {
        "company_dir": "NVO",
        "name": "Novo Nordisk",
        "pages": [
            "https://www.novonordisk.com/investors/financial-results.html",
            "https://www.novonordisk.com/investors/calendar/agm.html",
        ],
    },
    "BABA": {
        "company_dir": "BABA",
        "name": "Alibaba",
        "pages": [
            "https://www.alibabagroup.com/en-US/ir-financial-information",
            "https://www.alibabagroup.com/en-US/ir-financial-reports",
        ],
    },
    "SAP": {
        "company_dir": "SAP",
        "name": "SAP",
        "pages": [
            "https://www.sap.com/investors/en/financial-information.html",
            "https://www.sap.com/investors/en/financial-information/quarterly-statements.html",
        ],
    },
    "SHEL": {
        "company_dir": "SHEL",
        "name": "Shell plc",
        "pages": [
            "https://www.shell.com/investors/results-and-reporting/quarterly-results.html",
            "https://www.shell.com/investors/results-and-reporting/annual-reports-and-publications.html",
        ],
    },
    "TM": {
        "company_dir": "TOYOTA",
        "name": "Toyota Motor",
        "pages": [
            "https://global.toyota/en/ir/financial-results/",
            "https://global.toyota/en/ir/library/",
        ],
    },
    "SE": {
        "company_dir": "SEA",
        "name": "Sea Limited",
        "pages": [
            "https://www.seagroup.com/home/investor-relations",
            "https://www.seagroup.com/home/investor-relations/financial-information",
        ],
    },
    "HSBC": {
        "company_dir": "HSBC",
        "name": "HSBC Holdings",
        "pages": [
            "https://www.hsbc.com/investors/results-and-announcements",
            "https://www.hsbc.com/investors/results-and-announcements/all-reporting",
        ],
    },
    "BP": {
        "company_dir": "BP",
        "name": "BP plc",
        "pages": [
            "https://www.bp.com/en/global/corporate/investors/results-and-presentations.html",
            "https://www.bp.com/en/global/corporate/investors/financial-and-operating-information.html",
        ],
    },
}

# Classification d'un PDF par mot-clé (link text + URL combinés)
ES_KEYWORDS = re.compile(
    r"slides?|presentation|deck|earnings[-_\s]*call[-_\s]*pres|management[-_\s]*report|conference[-_\s]*call",
    re.I,
)
TRANSCRIPT_KEYWORDS = re.compile(
    r"transcript|prepared[-_\s]*remarks|call[-_\s]*script|earnings[-_\s]*call[-_\s]*transcript",
    re.I,
)
ER_KEYWORDS = re.compile(
    r"earnings[-_\s]*release|press[-_\s]*release|news[-_\s]*release|results[-_\s]*announcement|"
    r"trading[-_\s]*statement|interim[-_\s]*report|annual[-_\s]*report|annual-results",
    re.I,
)
INVESTOR_DAY_KEYWORDS = re.compile(
    r"investor[-_\s]*day|analyst[-_\s]*day|capital[-_\s]*markets[-_\s]*day", re.I
)
EXCLUDE_KEYWORDS = re.compile(
    r"sustainab|esg[-_\s]*report|climate|tax[-_\s]*strategy|modern[-_\s]*slavery|proxy|"
    r"compensation[-_\s]*statement|voting[-_\s]*results|policy",
    re.I,
)


def classify_link(link_text: str, href: str) -> str | None:
    """Retourne 'ES', 'ER', 'transcripts', 'investor-day' ou None."""
    blob = f"{link_text} {href}"
    if EXCLUDE_KEYWORDS.search(blob):
        return None
    if INVESTOR_DAY_KEYWORDS.search(blob):
        return "investor-day"
    if TRANSCRIPT_KEYWORDS.search(blob):
        return "transcripts"
    if ES_KEYWORDS.search(blob):
        return "ES"
    if ER_KEYWORDS.search(blob):
        return "ER"
    return None


def extract_year(text: str) -> int | None:
    m = re.search(r"\b(20\d{2})\b", text)
    return int(m.group(1)) if m else None


def slugify(text: str, year: int | None, ext: str = ".pdf") -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    s = re.sub(r"[\s-]+", "-", s)
    s = s[:80] or "doc"
    if year and str(year) not in s:
        s = f"{year}-{s}"
    return s + ext


async def download_pdf_via_browser(context, url: str, target: Path, log) -> str:
    """Télécharge un PDF via le contexte Playwright (cookies + headers OK).

    Stratégie : utilise APIRequestContext qui hérite des cookies du browser
    context, ce qui contourne les blocages anti-scraping côté serveur (403).
    """
    if target.exists():
        return "skip"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        # context.request hérite cookies + UA du browser
        response = await context.request.get(url, timeout=60000)
        if not response.ok:
            log(f"      [ERR] HTTP {response.status} {url}")
            return "err"
        body = await response.body()
        with open(target, "wb") as f:
            f.write(body)
        size_kb = target.stat().st_size // 1024
        if size_kb < 30:
            target.unlink()
            log(f"      [SKIP-tiny] {target.name} ({size_kb} KB) — likely error page")
            return "err"
        log(f"      [OK] {target.name} ({size_kb} KB)")
        return "ok"
    except Exception as e:
        log(f"      [ERR] {url}: {e}")
        return "err"


async def scrape_page(page, url: str, log) -> list[tuple[str, str]]:
    """Retourne liste de (text, absolute_href) PDFs sur la page."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        log(f"   [WARN] goto failed {url}: {e}")
        return []
    # Scroll to bottom + wait pour charger le contenu lazy
    try:
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(2)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1)
    except Exception:
        pass

    # Extract links via DOM
    links = await page.evaluate(
        """
        () => Array.from(document.querySelectorAll('a[href]'))
            .filter(a => a.href && a.href.toLowerCase().includes('.pdf'))
            .map(a => ({ text: (a.innerText || a.textContent || a.title || '').trim(), href: a.href }))
        """
    )
    return [(l["text"], l["href"]) for l in links]


async def process_ticker(ticker: str, cfg: dict, base_dir: Path, years: int, log) -> dict:
    log(f"\n=== {ticker} ({cfg['name']}) ===")
    company_dir = base_dir / cfg["company_dir"]
    current_year = datetime.now().year
    min_year = current_year - years
    stats = {"ES": 0, "ER": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0, "ignored": 0, "total_links": 0}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
            viewport={"width": 1280, "height": 800},
            ignore_https_errors=True,
        )
        page = await context.new_page()

        seen = set()
        for url in cfg["pages"]:
            log(f"-> page : {url}")
            try:
                links = await scrape_page(page, url, log)
            except Exception as e:
                log(f"   [WARN] page failed: {e}")
                continue
            log(f"   {len(links)} liens PDF détectés")
            stats["total_links"] += len(links)

            for text, href in links:
                if href in seen:
                    continue
                seen.add(href)

                kind = classify_link(text, href)
                if not kind:
                    stats["ignored"] += 1
                    continue

                year = extract_year(text) or extract_year(href) or current_year
                if year < min_year:
                    stats["ignored"] += 1
                    continue

                target = company_dir / kind / str(year) / slugify(text or href.split("/")[-1], year)
                result = await download_pdf_via_browser(context, href, target, log)
                if result == "ok":
                    stats[kind] += 1
                elif result == "skip":
                    stats["skip"] += 1
                else:
                    stats["err"] += 1

                await asyncio.sleep(0.4)

            await asyncio.sleep(1.0)

        await context.close()
        await browser.close()

    log(f"   STATS {ticker}: ES={stats['ES']} ER={stats['ER']} TR={stats['transcripts']} IDay={stats['investor-day']} skip={stats['skip']} err={stats['err']} ignored={stats['ignored']} (total_links={stats['total_links']})")
    return stats


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Limiter à des tickers (ex: TSM,ASML)")
    parser.add_argument("--years", type=int, default=5)
    parser.add_argument(
        "--out",
        default="/Users/yann/Desktop/Projets 2025 26/App KPI/DATA",
        help="Dossier racine de sortie",
    )
    args = parser.parse_args()

    base_dir = Path(args.out)
    log_path = Path("/Users/yann/spx-app/sec-data/_meta/ir-scraper-v2.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(log_path, "a", encoding="utf-8")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log("=" * 60)
    log("IR scraper V2 (Playwright) démarré")

    tickers = (
        [t.strip().upper() for t in args.ticker.split(",")]
        if args.ticker
        else list(IR_CONFIG.keys())
    )
    overall = {"ES": 0, "ER": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0, "total_links": 0}

    for t in tickers:
        if t not in IR_CONFIG:
            log(f"[SKIP] ticker inconnu : {t}")
            continue
        try:
            s = await process_ticker(t, IR_CONFIG[t], base_dir, args.years, log)
            for k in overall:
                overall[k] += s.get(k, 0)
        except Exception as e:
            log(f"[ERR] {t}: {e}")

    log("\n=== TOTAL ===")
    log(
        f"ES={overall['ES']} ER={overall['ER']} TR={overall['transcripts']} "
        f"IDay={overall['investor-day']} skip={overall['skip']} err={overall['err']} "
        f"(total_links_seen={overall['total_links']})"
    )
    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
