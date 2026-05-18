#!/usr/bin/env python3
"""
stmn-playwright-scrape.py — Scrape STMN.SW (Straumann) via Playwright
(URLs fournies par Yann, site bloque WebFetch/urllib direct).

URLs cibles :
  - https://www.straumann.com/group/en/home/investors/financial-reports.html
  - https://www.straumann.com/group/en/home/investors/corporate-governance/annual-general-meeting.html

Filtre EN uniquement (skip /de/, /fr/, /it/ paths).
Download tous PDFs + pdftotext.
Output : sec-data/cat3-european/STMN.SW/{annual-report,half-year,esg,governance}/<file>.pdf
"""
from __future__ import annotations
import asyncio
import re
import subprocess
import urllib.parse
import urllib.request
import ssl
from datetime import datetime
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

from playwright.async_api import async_playwright

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "sec-data" / "cat3-european" / "STMN.SW"

URLS = [
    "https://www.straumann.com/group/en/home/investors/financial-reports.html",
    "https://www.straumann.com/group/en/home/investors/corporate-governance/annual-general-meeting.html",
]

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def categorize(href: str) -> str:
    h = href.lower()
    if any(k in h for k in ["agm", "compensation", "governance", "voting", "minutes", "proxy"]):
        return "governance"
    if any(k in h for k in ["sustainability", "esg", "csr", "non-financial", "tcfd"]):
        return "esg"
    if any(k in h for k in ["half", "hy", "interim", "h1", "h2"]):
        return "half-year"
    if any(k in h for k in ["annual", "ar20", "ar_", "fy"]):
        return "annual-report"
    return "ir-other"


def is_english(href: str) -> bool:
    """Filtre EN uniquement. Skip /de/, /fr/, /it/ etc."""
    h = href.lower()
    if any(p in h for p in ["/de/", "/fr/", "/it/", "_de.", "_fr.", "_it.", "/dach/", "german", "french"]):
        return False
    return True


async def scrape():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_pdfs = set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(user_agent=UA)
        page = await ctx.new_page()
        for url in URLS:
            print(f"━━ GET {url}", flush=True)
            try:
                await page.goto(url, wait_until="networkidle", timeout=45000)
                await page.wait_for_timeout(2000)
            except Exception as e:
                print(f"  ❌ goto fail : {e}", flush=True)
                continue
            # Récupère TOUS les liens (pour debug + matcher patterns Adobe AEM
            # ex /content/dam/... ou data-href ou onclick download).
            all_links = await page.evaluate("""() => Array.from(document.querySelectorAll('a, button[onclick], [data-href]')).map(el => ({
              href: el.href || el.getAttribute('data-href') || '',
              onclick: el.getAttribute('onclick') || '',
              text: (el.textContent || '').trim().slice(0, 80),
            }))""")
            # Filtre links qui ressemblent à un PDF (pas juste .pdf direct)
            hrefs = []
            for link in all_links:
                target = link.get("href") or ""
                onclick = link.get("onclick") or ""
                text = link.get("text") or ""
                # Match : .pdf direct OR /content/dam/ (Adobe AEM) OR onclick download
                if (".pdf" in target.lower() or
                    "/content/dam/" in target.lower() or
                    "download" in onclick.lower() and ".pdf" in onclick.lower()):
                    if target:
                        hrefs.append(target)
                    # Extract URL from onclick if needed
                    pdf_match = re.search(r'["\']([^"\']+\.pdf[^"\']*)["\']', onclick)
                    if pdf_match:
                        hrefs.append(pdf_match.group(1))
            print(f"  → {len(all_links)} liens totaux · {len(hrefs)} PDF candidates", flush=True)
            # Debug : sample 3 premiers links pour comprendre la structure
            if len(hrefs) == 0 and len(all_links) > 0:
                print(f"  ⚠ DEBUG : sample 5 links :", flush=True)
                for link in all_links[:5]:
                    print(f"     href={(link.get('href') or '')[:80]} | text='{link.get('text','')[:40]}'", flush=True)
            for h in hrefs:
                if h not in all_pdfs and is_english(h):
                    all_pdfs.add(h)
        await browser.close()

    print(f"\n=== TOTAL PDFs uniques EN : {len(all_pdfs)} ===", flush=True)
    return sorted(all_pdfs)


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.straumann.com/"})
        with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as r:
            body = r.read()
        if len(body) < 50000 or body[:4] != b"%PDF":
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        return True
    except Exception as e:
        print(f"    DL err : {e}", flush=True)
        return False


def pdf_to_text(pdf: Path, txt: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists(): pdftotext = "pdftotext"
    txt.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run([pdftotext, "-layout", str(pdf), str(txt)],
                       check=True, capture_output=True, timeout=180)
        return txt.exists() and txt.stat().st_size > 5000
    except Exception:
        return False


def main():
    pdfs = asyncio.run(scrape())
    print(f"\nDOWNLOAD {len(pdfs)} PDFs...", flush=True)
    counts = {"annual-report": 0, "half-year": 0, "esg": 0, "governance": 0, "ir-other": 0}
    for url in pdfs:
        cat = categorize(url)
        # Extraire nom + année du URL
        name = url.rsplit("/", 1)[-1].split("?")[0]
        year_match = re.search(r"(20\d{2})", name)
        year = year_match.group(1) if year_match else "unknown"
        dest = OUT_DIR / cat / name
        if dest.exists() and dest.stat().st_size > 50000:
            print(f"  [SKIP] {cat}/{name} ({dest.stat().st_size//1024} KB)", flush=True)
            counts[cat] += 1
            continue
        print(f"  → DL {cat}/{name}", flush=True)
        if download(url, dest):
            kb = dest.stat().st_size // 1024
            # Pour annual-report : pdftotext aussi vers annual-text/
            if cat == "annual-report" and year != "unknown":
                txt_dest = OUT_DIR / "annual-text" / f"{year}.txt"
                txt_ok = pdf_to_text(dest, txt_dest)
                print(f"    ✓ {kb} KB + txt {'OK' if txt_ok else 'FAIL'}", flush=True)
            else:
                print(f"    ✓ {kb} KB", flush=True)
            counts[cat] += 1
    print(f"\n=== DONE STMN : {counts} ===", flush=True)


if __name__ == "__main__":
    main()
