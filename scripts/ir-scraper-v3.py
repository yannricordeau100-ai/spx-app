#!/usr/bin/env python3
"""
IR scraper V3 — Stratégie 2 niveaux (index → pages trimestre).

Apprentissage du run V2 : les pages IR principales (ASML, BABA, SAP, SHEL, BP)
ne contiennent PAS les PDFs eux-mêmes mais des liens vers des pages détail
trimestre (/q4-2025, /quarterly-results/q3-2024, etc.). Les PDFs sont sur ces
pages détail.

Workflow par société :
  1. Charger la page index (financial-results, quarterly-earnings, etc.)
  2. Extraire les liens internes qui matchent un pattern "trimestre/année"
     (ex: q1-2026, q4-2024, fy-2024, 2024-q3, results-h1-2024, etc.)
  3. Filtrer par fenêtre 5 ans (2021-2026)
  4. Pour chaque page trimestre : extraire + classifier + télécharger PDFs

Plus rapide ET plus complet que V2.

Usage : python3 scripts/ir-scraper-v3.py [--ticker TSM,ASML] [--years 5]
"""

import argparse
import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("ERREUR : pip3 install playwright && playwright install chromium")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────
# Config par société
# ─────────────────────────────────────────────────────────────────────────
# index_pages = pages où chercher les liens trimestre
# quarter_pattern = regex pour identifier les pages trimestre internes
IR_CONFIG = {
    "TSM": {
        "company_dir": "TSM",
        "name": "Taiwan Semiconductor",
        "index_pages": [
            "https://investor.tsmc.com/english/quarterly-results",
            "https://investor.tsmc.com/english/quarterly-results/2025",
            "https://investor.tsmc.com/english/quarterly-results/2024",
            "https://investor.tsmc.com/english/quarterly-results/2023",
            "https://investor.tsmc.com/english/quarterly-results/2022",
            "https://investor.tsmc.com/english/quarterly-results/2021",
        ],
        "quarter_pattern": None,  # TSMC livre les PDFs directement sur l'index
        "direct_pdf": True,
    },
    "ASML": {
        "company_dir": "ASML",
        "name": "ASML Holding",
        "index_pages": ["https://www.asml.com/en/investors/financial-results"],
        "quarter_pattern": re.compile(r"financial-results/(q[1-4]-\d{4})", re.I),
        "direct_pdf": False,
    },
    "NVO": {
        "company_dir": "NVO",
        "name": "Novo Nordisk",
        "index_pages": [
            "https://www.novonordisk.com/investors/financial-results.html",
        ],
        "quarter_pattern": re.compile(r"(financial-result-\d{4}|q\d-\d{4}|fy-?\d{4})", re.I),
        "direct_pdf": True,  # NVO publie souvent les PDFs directement sur l'index
    },
    "BABA": {
        "company_dir": "BABA",
        "name": "Alibaba",
        "index_pages": [
            "https://www.alibabagroup.com/en-US/ir-financial-information",
            "https://www.alibabagroup.com/en-US/ir-financial-reports",
            "https://www.alibabagroup.com/en-US/ir-financial-events-and-presentations",
        ],
        "quarter_pattern": re.compile(r"(quarterly-results|financial-reports|press-release)/.*?\d{4}", re.I),
        "direct_pdf": False,
    },
    "SAP": {
        "company_dir": "SAP",
        "name": "SAP",
        "index_pages": [
            "https://www.sap.com/investors/en/financial-information.html",
            "https://www.sap.com/investors/en/financial-information/quarterly-statements.html",
        ],
        "quarter_pattern": re.compile(r"q[1-4]-?\d{4}|quarterly.*\d{4}|fy-?\d{4}", re.I),
        "direct_pdf": False,
    },
    "SHEL": {
        "company_dir": "SHEL",
        "name": "Shell plc",
        "index_pages": [
            "https://www.shell.com/investors/results-and-reporting/quarterly-results.html",
        ],
        "quarter_pattern": re.compile(r"q[1-4]-?\d{4}|quarterly.*\d{4}", re.I),
        "direct_pdf": False,
    },
    "TM": {
        "company_dir": "TOYOTA",
        "name": "Toyota Motor",
        "index_pages": [
            "https://global.toyota/en/ir/financial-results/",
            "https://global.toyota/en/ir/library/",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "SE": {
        "company_dir": "SEA",
        "name": "Sea Limited",
        "index_pages": [
            "https://www.seagroup.com/home/investor-relations/financial-information",
        ],
        "quarter_pattern": re.compile(r"q[1-4][-_]?\d{4}|quarterly|fy-?\d{4}", re.I),
        "direct_pdf": False,
    },
    "HSBC": {
        "company_dir": "HSBC",
        "name": "HSBC Holdings",
        "index_pages": [
            "https://www.hsbc.com/investors/results-and-announcements",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "BP": {
        "company_dir": "BP",
        "name": "BP plc",
        "index_pages": [
            "https://www.bp.com/en/global/corporate/investors/results-and-presentations.html",
        ],
        "quarter_pattern": re.compile(r"q[1-4][-_]?\d{4}|quarterly", re.I),
        "direct_pdf": False,
    },
    # ──────────────── 10 nouvelles sociétés (top 11-20) ────────────────
    "NVS": {
        "company_dir": "NVS",
        "name": "Novartis",
        "index_pages": [
            "https://www.novartis.com/investors/financial-data/quarterly-results",
            "https://www.novartis.com/investors/event-calendar",
        ],
        "quarter_pattern": re.compile(r"q[1-4][-_]?\d{4}|quarterly|results-\d{4}", re.I),
        "direct_pdf": False,
    },
    "AZN": {
        "company_dir": "AZN",
        "name": "AstraZeneca",
        "index_pages": [
            "https://www.astrazeneca.com/investor-relations/results-and-presentations.html",
            "https://www.astrazeneca.com/investor-relations/annual-reports.html",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "RY": {
        "company_dir": "RY",
        "name": "Royal Bank of Canada",
        "index_pages": [
            "https://www.rbc.com/investor-relations/quarterly-information.html",
            "https://www.rbc.com/investor-relations/annual-reports.html",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "SHOP": {
        "company_dir": "SHOP",
        "name": "Shopify",
        "index_pages": [
            "https://investors.shopify.com/news/quarterly-results/default.aspx",
            "https://investors.shopify.com/financials/default.aspx",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "HDB": {
        "company_dir": "HDB",
        "name": "HDFC Bank",
        "index_pages": [
            "https://www.hdfcbank.com/personal/about-us/investor-relations/financial-results",
            "https://www.hdfcbank.com/personal/about-us/investor-relations/annual-reports",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "UL": {
        "company_dir": "UL",
        "name": "Unilever",
        "index_pages": [
            "https://www.unilever.com/investors/results-and-presentations/",
            "https://www.unilever.com/investors/annual-report-and-accounts/",
        ],
        "quarter_pattern": re.compile(r"(q[1-4]|h[12]|fy)[-_]?\d{4}|quarterly|half-year", re.I),
        "direct_pdf": False,
    },
    "TD": {
        "company_dir": "TD",
        "name": "Toronto-Dominion Bank",
        "index_pages": [
            "https://www.td.com/ca/en/about-td/for-investors/investor-relations/quarterly-results",
            "https://www.td.com/ca/en/about-td/for-investors/investor-relations/annual-reports",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "RIO": {
        "company_dir": "RIO",
        "name": "Rio Tinto",
        "index_pages": [
            "https://www.riotinto.com/en/invest/financial-news-performance",
            "https://www.riotinto.com/en/invest/reports",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "BHP": {
        "company_dir": "BHP",
        "name": "BHP Group",
        "index_pages": [
            "https://www.bhp.com/investors/results-and-reporting",
            "https://www.bhp.com/investors/annual-reporting",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
    "SNY": {
        "company_dir": "SNY",
        "name": "Sanofi",
        "index_pages": [
            "https://www.sanofi.com/en/investors/financial-results-and-events/financial-results",
            "https://www.sanofi.com/en/investors/financial-results-and-events/all-meetings",
        ],
        "quarter_pattern": None,
        "direct_pdf": True,
    },
}

# ─────────────────────────────────────────────────────────────────────────
# Classification keywords
# ─────────────────────────────────────────────────────────────────────────
ES_KEYWORDS = re.compile(
    r"slides?|presentation|deck|earnings[-_\s]*call[-_\s]*pres|management[-_\s]*report|"
    r"investor[-_\s]*relations[-_\s]*pres|press[-_\s]*conference[-_\s]*pres|"
    r"earnings[-_\s]*pres|quarter[-_\s]*pres",
    re.I,
)
TRANSCRIPT_KEYWORDS = re.compile(
    r"transcript|prepared[-_\s]*remarks|call[-_\s]*script|investor[-_\s]*call[-_\s]*prepared",
    re.I,
)
ER_KEYWORDS = re.compile(
    r"earnings[-_\s]*release|press[-_\s]*release|news[-_\s]*release|results[-_\s]*announcement|"
    r"trading[-_\s]*statement|interim[-_\s]*report|annual[-_\s]*report|annual-results|"
    r"financial[-_\s]*statements?|stock[-_\s]*release|earnings[-_\s]*announce",
    re.I,
)
INVESTOR_DAY_KEYWORDS = re.compile(
    r"investor[-_\s]*day|analyst[-_\s]*day|capital[-_\s]*markets[-_\s]*day", re.I
)
EXCLUDE_KEYWORDS = re.compile(
    r"sustainab|esg[-_\s]*report|climate|tax[-_\s]*strategy|modern[-_\s]*slavery|proxy|"
    r"compensation[-_\s]*statement|voting[-_\s]*results|policy|ourbrand[-_\s]*excel|"
    r"\.xlsx|\.zip",
    re.I,
)


def classify_link(text: str, href: str) -> str | None:
    blob = f"{text} {href}"
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


def slugify(text: str, year: int | None) -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    s = re.sub(r"[\s-]+", "-", s)
    s = s[:80] or "doc"
    if year and str(year) not in s:
        s = f"{year}-{s}"
    return s + ".pdf"


async def download_pdf(context, url: str, target: Path, log) -> str:
    if target.exists():
        return "skip"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        response = await context.request.get(url, timeout=60000)
        if not response.ok:
            log(f"      [ERR-HTTP{response.status}] {url}")
            return "err"
        body = await response.body()
        with open(target, "wb") as f:
            f.write(body)
        size_kb = target.stat().st_size // 1024
        if size_kb < 30:
            target.unlink()
            log(f"      [SKIP-tiny {size_kb}KB] {target.name}")
            return "err"
        log(f"      [OK {size_kb}KB] {target.name}")
        return "ok"
    except Exception as e:
        log(f"      [ERR] {url}: {str(e)[:120]}")
        return "err"


async def extract_pdfs_from_page(page, url: str, log) -> list[tuple[str, str]]:
    """Charge page + scroll + retourne tous les liens PDF."""
    try:
        await page.goto(url, wait_until="networkidle", timeout=45000)
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            log(f"   [WARN goto] {url}: {str(e)[:80]}")
            return []
    await asyncio.sleep(2)
    for _ in range(3):
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(0.8)
    links = await page.evaluate("""
        () => Array.from(document.querySelectorAll('a[href]'))
            .filter(a => a.href && a.href.toLowerCase().includes('.pdf'))
            .map(a => ({ text: (a.innerText || a.textContent || a.title || '').trim(), href: a.href }))
    """)
    return [(l["text"], l["href"]) for l in links]


async def extract_quarter_links(page, url: str, pattern: re.Pattern, log) -> list[str]:
    """Charge page + scroll + retourne URLs des pages trimestre matchant le pattern."""
    try:
        await page.goto(url, wait_until="networkidle", timeout=45000)
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            log(f"   [WARN goto] {url}: {str(e)[:80]}")
            return []
    await asyncio.sleep(2)
    for _ in range(3):
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(0.8)
    all_hrefs = await page.evaluate("""
        () => Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(h => h && !h.startsWith('javascript:'))
    """)
    matched = []
    seen = set()
    for h in all_hrefs:
        if pattern.search(h) and h not in seen:
            matched.append(h)
            seen.add(h)
    return matched


async def process_ticker(ticker: str, cfg: dict, base_dir: Path, years: int, log) -> dict:
    log(f"\n=== {ticker} ({cfg['name']}) ===")
    company_dir = base_dir / cfg["company_dir"]
    current_year = datetime.now().year
    min_year = current_year - years
    stats = {"ES": 0, "ER": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0, "ignored": 0, "total_links": 0, "quarter_pages": 0}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
            viewport={"width": 1280, "height": 800},
            ignore_https_errors=True,
        )
        # Bloquer images/CSS pour accélérer
        await context.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,css}", lambda r: r.abort())
        page = await context.new_page()

        # Étape 1 : récupérer toutes les pages trimestre depuis l'index
        all_pages_to_scrape = list(cfg["index_pages"])
        if cfg.get("quarter_pattern"):
            for idx_url in cfg["index_pages"]:
                log(f"-> INDEX : {idx_url}")
                quarters = await extract_quarter_links(page, idx_url, cfg["quarter_pattern"], log)
                # Filtrer par année (si dans l'URL)
                filtered = []
                for q in quarters:
                    y = extract_year(q)
                    if y is None or y >= min_year:
                        filtered.append(q)
                log(f"   {len(filtered)} pages trimestre identifiées (filtre {min_year}+)")
                all_pages_to_scrape.extend(filtered)
                stats["quarter_pages"] += len(filtered)

        # Dedup
        seen_pages = set()
        unique_pages = []
        for p_url in all_pages_to_scrape:
            if p_url not in seen_pages:
                seen_pages.add(p_url)
                unique_pages.append(p_url)

        # Étape 2 : scraper chaque page pour PDFs
        seen_pdf = set()
        for p_url in unique_pages:
            log(f"-> {p_url}")
            try:
                pdfs = await extract_pdfs_from_page(page, p_url, log)
            except Exception as e:
                log(f"   [WARN page] {str(e)[:80]}")
                continue
            log(f"   {len(pdfs)} PDFs détectés")
            stats["total_links"] += len(pdfs)

            for text, href in pdfs:
                if href in seen_pdf:
                    continue
                seen_pdf.add(href)
                kind = classify_link(text, href)
                if not kind:
                    stats["ignored"] += 1
                    continue
                year = extract_year(text) or extract_year(href) or current_year
                if year < min_year:
                    stats["ignored"] += 1
                    continue
                target = company_dir / kind / str(year) / slugify(text or href.split("/")[-1], year)
                result = await download_pdf(context, href, target, log)
                if result == "ok":
                    stats[kind] += 1
                elif result == "skip":
                    stats["skip"] += 1
                else:
                    stats["err"] += 1
                await asyncio.sleep(0.3)
            await asyncio.sleep(0.5)

        await context.close()
        await browser.close()

    log(
        f"   STATS {ticker}: ES={stats['ES']} ER={stats['ER']} TR={stats['transcripts']} "
        f"IDay={stats['investor-day']} skip={stats['skip']} err={stats['err']} "
        f"ignored={stats['ignored']} (quarter_pages={stats['quarter_pages']}, total_pdfs={stats['total_links']})"
    )
    return stats


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Limiter à des tickers (ex: ASML)")
    parser.add_argument("--years", type=int, default=5)
    parser.add_argument("--out", default="/Users/yann/Desktop/Projets 2025 26/App KPI/DATA")
    args = parser.parse_args()

    base_dir = Path(args.out)
    log_path = Path("/Users/yann/spx-app/sec-data/_meta/ir-scraper-v3.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(log_path, "a", encoding="utf-8")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log("=" * 60)
    log("IR scraper V3 (2-level Playwright) démarré")

    tickers = (
        [t.strip().upper() for t in args.ticker.split(",")]
        if args.ticker
        else list(IR_CONFIG.keys())
    )
    overall = {"ES": 0, "ER": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0, "total_links": 0, "quarter_pages": 0}

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
        f"(quarter_pages={overall['quarter_pages']}, total_pdfs={overall['total_links']})"
    )
    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
