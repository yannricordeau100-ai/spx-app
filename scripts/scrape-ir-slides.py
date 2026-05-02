#!/usr/bin/env python3
"""
Scrape IR pages des 4 sociétés V1 dont les slides ne sont PAS dans les
8-K (GOOGL, META, MSCI, SPGI) pour récupérer les Earning Slides PDF.

Approche : pour chaque société, fetch la page IR earnings, parser les
liens vers PDF qui contiennent "earnings" / "slides" / "presentation".
"""
import re
import ssl
import time
import urllib.request
import urllib.parse
from pathlib import Path

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")
RATE_S = 1.5
DATA = Path("/Users/yann/Desktop/Projets 2025 26/App KPI/DATA")

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

_last = 0.0


def fetch(url: str, binary: bool = False) -> bytes | str:
    global _last
    delta = time.time() - _last
    if delta < RATE_S:
        time.sleep(RATE_S - delta)
    _last = time.time()
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/pdf,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=30) as r:
            data = r.read()
            if not binary:
                return data.decode("utf-8", errors="replace")
            return data
    except Exception as e:
        print(f"    ! fetch failed {url}: {e}")
        return b"" if binary else ""


def find_pdfs(html: str, base_url: str) -> list[str]:
    """Extract PDF URLs from HTML. Filter those that look like earnings slides."""
    if not html:
        return []
    pdfs = re.findall(r'(?:href|src)=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.IGNORECASE)
    out = set()
    for p in pdfs:
        # Resolve relative URLs
        if p.startswith("//"):
            p = "https:" + p
        elif p.startswith("/"):
            p = urllib.parse.urljoin(base_url, p)
        elif not p.startswith("http"):
            p = urllib.parse.urljoin(base_url, p)
        out.add(p)
    return list(out)


def is_slides_url(url: str) -> bool:
    u = url.lower()
    keywords = ["slides", "presentation", "deck", "earnings-call", "q1", "q2", "q3", "q4",
                "first-quarter", "second-quarter", "third-quarter", "fourth-quarter",
                "1q", "2q", "3q", "4q"]
    # Skip obvious 10-K / proxy
    if "10-k" in u or "proxy" in u or "10-q" in u or "annual-report" in u or "/ar-" in u:
        return False
    return any(k in u for k in keywords)


def download(url: str, dest: Path) -> int:
    if dest.exists():
        return 0
    content = fetch(url, binary=True)
    if not content or len(content) < 10000:  # Min 10 KB
        return 0
    if content[:4] != b"%PDF":
        return 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return len(content)


SOURCES = {
    "GOOGL": {
        "folder": "Google",
        "ir_pages": [
            "https://abc.xyz/investor/",
            "https://abc.xyz/investor/quarterly-results/",
        ],
    },
    "META": {
        "folder": "META",
        "ir_pages": [
            "https://investor.atmeta.com/financials/",
            "https://investor.atmeta.com/financials/quarterly-earnings/",
            "https://investor.atmeta.com/investor-news/press-release-details/",
        ],
    },
    "MSCI": {
        "folder": "MSCI",
        "ir_pages": [
            "https://ir.msci.com/financials/quarterly-results",
            "https://ir.msci.com/news-events/events",
        ],
    },
    "SPGI": {
        "folder": "SPGI",
        "ir_pages": [
            "https://investor.spglobal.com/financials/quarterly-results/",
            "https://investor.spglobal.com/news-events/events",
        ],
    },
}


def main():
    for ticker, cfg in SOURCES.items():
        print(f"\n=== {ticker} ===")
        candidates = set()
        for url in cfg["ir_pages"]:
            print(f"  Fetching {url}")
            html = fetch(url)
            pdfs = find_pdfs(html, url)
            print(f"    {len(pdfs)} PDF candidates total, filtering...")
            for p in pdfs:
                if is_slides_url(p):
                    candidates.add(p)
        print(f"  → {len(candidates)} candidats slides")
        n_dl = 0
        for url in candidates:
            # Extract a year from url
            yr_match = re.search(r"20\d{2}", url)
            year = yr_match.group(0) if yr_match else "unknown"
            name_match = re.search(r"/([^/]+\.pdf)", url, re.IGNORECASE)
            name = name_match.group(1) if name_match else f"{ticker}_{year}.pdf"
            dest = DATA / cfg["folder"] / "ES" / year / name
            try:
                size = download(url, dest)
                if size > 0:
                    print(f"    ✓ {name} ({size//1024} KB)")
                    n_dl += 1
            except Exception as e:
                print(f"    ! {name} failed: {e}")
        print(f"  Total : {n_dl} ES téléchargés")


if __name__ == "__main__":
    main()
