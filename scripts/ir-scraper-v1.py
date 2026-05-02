#!/usr/bin/env python3
"""
IR scraper V1 — récupère ES (earning slides), Transcripts et Investor Day decks
depuis les pages Investor Relations des 5 sociétés V1.

Sortie : /Users/yann/Desktop/Projets 2025 26/App KPI/DATA/<COMPANY>/{ES,transcripts,investor-day}/

Stratégie :
1. Pour chaque ticker, on parcourt 1-3 pages IR identifiées (earnings, events).
2. On extrait tous les liens PDF, on classe par mot-clé (link text + href).
3. On télécharge ce qu'on n'a pas déjà.
4. Logs propres dans ir-scraper-v1.log.

Usage : python3 scripts/ir-scraper-v1.py [--ticker META,GOOGL,...] [--years 5]
"""

import argparse
import os
import re
import ssl
import sys
import time
import urllib.parse
from pathlib import Path
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERREUR : pip3 install requests beautifulsoup4")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────
# CONFIG par société : URLs des pages IR à scraper
# ──────────────────────────────────────────────────────────────────────────
IR_CONFIG = {
    "META": {
        "company_dir": "META",
        "pages": [
            "https://investor.atmeta.com/financials/",
            "https://investor.atmeta.com/financials/?section=quarterlyearnings",
            "https://investor.atmeta.com/news-and-events/events-calendar/",
        ],
        "name": "Meta Platforms",
    },
    "GOOGL": {
        "company_dir": "GOOGLE",
        "pages": [
            "https://abc.xyz/investor/",
            "https://abc.xyz/investor/quarterly-earnings/",
            "https://abc.xyz/investor/events-and-presentations/",
        ],
        "name": "Alphabet",
    },
    "MSCI": {
        "company_dir": "MSCI",
        "pages": [
            "https://ir.msci.com/financials/quarterly-results",
            "https://ir.msci.com/news-events/events-presentations",
            "https://ir.msci.com/financials/financial-information",
        ],
        "name": "MSCI Inc.",
    },
    "SPGI": {
        "company_dir": "SPGI",
        "pages": [
            "https://investor.spglobal.com/quarterly-earnings/",
            "https://investor.spglobal.com/news-events/events-and-presentations",
            "https://investor.spglobal.com/financials/quarterly-earnings/default.aspx",
        ],
        "name": "S&P Global",
    },
    "CAT": {
        "company_dir": "CATERPILLAR",
        "pages": [
            "https://investors.caterpillar.com/financials/quarterly-results/default.aspx",
            "https://investors.caterpillar.com/events-and-presentations/default.aspx",
        ],
        "name": "Caterpillar",
    },
}

# Classification d'un PDF par mot-clé (link text + URL)
ES_KEYWORDS = re.compile(r"slides?|presentation|deck|earnings[-_\s]*call[-_\s]*pres", re.I)
TRANSCRIPT_KEYWORDS = re.compile(r"transcript|prepared[-_\s]*remarks|call[-_\s]*script", re.I)
INVESTOR_DAY_KEYWORDS = re.compile(r"investor[-_\s]*day|analyst[-_\s]*day|capital[-_\s]*markets[-_\s]*day", re.I)
EXCLUDE_KEYWORDS = re.compile(r"proxy|10-?k|10-?q|annual[-_\s]*report|sustainab|esg[-_\s]*report|climate", re.I)

# Fenêtre d'années : on filtre par regex sur la date (year) trouvée dans le href
# Ne match qu'au-delà de cette année.
def years_window_regex(years):
    current_year = datetime.now().year
    min_year = current_year - years
    return re.compile(r"\b(20\d{2})\b")  # capture, on vérifiera la valeur

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf,*/*"}
SSL_CTX = ssl._create_unverified_context()

# Désactivation des warnings SSL
try:
    requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass


def classify_link(link_text, href):
    """Retourne 'ES', 'transcripts', 'investor-day' ou None."""
    blob = f"{link_text} {href}"
    if EXCLUDE_KEYWORDS.search(blob):
        return None
    if INVESTOR_DAY_KEYWORDS.search(blob):
        return "investor-day"
    if TRANSCRIPT_KEYWORDS.search(blob):
        return "transcripts"
    if ES_KEYWORDS.search(blob):
        return "ES"
    return None


def extract_year(text):
    """Extrait la première année 20XX trouvée dans un texte."""
    m = re.search(r"\b(20\d{2})\b", text)
    return int(m.group(1)) if m else None


def fetch_page(url, log):
    try:
        r = requests.get(url, headers=HEADERS, timeout=20, verify=False)
        r.raise_for_status()
        return r.text
    except Exception as e:
        log(f"  [WARN] fetch failed {url}: {e}")
        return None


def list_pdfs_on_page(html, base_url):
    """Retourne liste de (text, absolute_href) pour tous les liens .pdf."""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.lower().endswith(".pdf"):
            continue
        abs_href = urllib.parse.urljoin(base_url, href)
        text = a.get_text(strip=True) or a.get("title", "") or ""
        out.append((text, abs_href))
    return out


def download_pdf(url, target_path, log):
    if target_path.exists():
        return "skip"
    try:
        r = requests.get(url, headers=HEADERS, timeout=60, verify=False, stream=True)
        r.raise_for_status()
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        size_kb = target_path.stat().st_size // 1024
        log(f"  [OK] {target_path.name} ({size_kb} KB)")
        return "ok"
    except Exception as e:
        log(f"  [ERR] {url}: {e}")
        return "err"


def slugify_filename(text, year, ext=".pdf"):
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    s = re.sub(r"[\s-]+", "-", s)
    s = s[:80]
    if year and str(year) not in s:
        s = f"{year}-{s}"
    return s + ext


def process_ticker(ticker, cfg, base_dir, years, log):
    log(f"\n=== {ticker} ({cfg['name']}) ===")
    company_dir = base_dir / cfg["company_dir"]
    current_year = datetime.now().year
    min_year = current_year - years

    stats = {"ES": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0, "ignored": 0}

    seen = set()
    for page_url in cfg["pages"]:
        log(f"-> page : {page_url}")
        html = fetch_page(page_url, log)
        if not html:
            continue
        pdfs = list_pdfs_on_page(html, page_url)
        log(f"   {len(pdfs)} liens PDF trouvés")

        for text, href in pdfs:
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

            sub = "ES" if kind == "ES" else ("transcripts" if kind == "transcripts" else "investor-day")
            target = company_dir / sub / str(year) / slugify_filename(text or href.split("/")[-1], year)

            result = download_pdf(href, target, log)
            if result == "ok":
                stats[kind] += 1
            elif result == "skip":
                stats["skip"] += 1
            else:
                stats["err"] += 1

            time.sleep(0.5)  # gentil avec les serveurs IR

        time.sleep(1.0)

    log(f"   STATS {ticker}: ES={stats['ES']} TR={stats['transcripts']} IDay={stats['investor-day']} skip={stats['skip']} err={stats['err']}")
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Limiter à un sous-ensemble (ex: META,GOOGL)")
    parser.add_argument("--years", type=int, default=5, help="Fenêtre années (default 5)")
    parser.add_argument("--out", default="/Users/yann/Desktop/Projets 2025 26/App KPI/DATA",
                        help="Dossier racine de sortie")
    args = parser.parse_args()

    base_dir = Path(args.out)
    log_path = Path("/Users/yann/spx-app/sec-data/_meta/ir-scraper-v1.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(log_path, "a", encoding="utf-8")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log("=" * 60)
    log("IR scraper V1 démarré")

    tickers = args.ticker.split(",") if args.ticker else list(IR_CONFIG.keys())
    overall = {"ES": 0, "transcripts": 0, "investor-day": 0, "skip": 0, "err": 0}

    for t in tickers:
        t = t.strip().upper()
        if t not in IR_CONFIG:
            log(f"[SKIP] ticker inconnu : {t}")
            continue
        s = process_ticker(t, IR_CONFIG[t], base_dir, args.years, log)
        for k in overall:
            overall[k] += s.get(k, 0)

    log("\n=== TOTAL ===")
    log(f"ES={overall['ES']} TR={overall['transcripts']} IDay={overall['investor-day']} skip={overall['skip']} err={overall['err']}")
    log_fh.close()


if __name__ == "__main__":
    main()
