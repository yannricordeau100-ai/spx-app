#!/usr/bin/env python3
"""scrape-ir-pages.py — Trouve et télécharge les documents IR (annual reports,
earnings releases, investor day decks, factbooks) pour les stés EU sans CIK SEC.

Sources URL IR (essayées dans l'ordre) :
1. yfinance.info["website"] + heuristiques /investors, /ir, /investor-relations
2. Patterns connus : investor.[ticker].com, ir.[ticker].com
3. DDG HTML search (fallback)

Documents recherchés (par année) :
- Annual Report / Rapport Annuel / Geschäftsbericht
- Earnings Release / Q[1-4] Results / Trading Update
- Investor Day / Capital Markets Day
- Factbook / Fact Sheet / Statistical Supplement
- Investor Presentation

Pour chaque doc trouvé :
- DL PDF dans .ir-scrape-cache/<ticker>/<year>_<type>.pdf
- pdftotext → texte → LLM extraction Revenue + KPIs principaux
- Update v2-pipeline/<ticker>.json hero_history + nouveaux KPIs

Multi-source, multi-doc. ETA ~30 min pour 300 stés (réseau lent + PDF DL).
"""
import argparse
import gzip
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
CACHE = PROJECT_ROOT / ".ir-scrape-cache"
CACHE.mkdir(parents=True, exist_ok=True)
PENDING_FILE = Path(os.environ.get("PENDING_FILE", ""))
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-ir-scrape.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

IR_PATH_PATTERNS = [
    "/investors",
    "/investor-relations",
    "/ir",
    "/investor",
    "/en/investors",
    "/en/investor-relations",
    "/about/investors",
    "/financial-information",
    "/finance/investors",
]

# Doc types to look for in IR page HTML (multilingual)
DOC_KEYWORDS = {
    "annual_report": [
        r"annual\s+report", r"rapport\s+annuel", r"geschäftsbericht",
        r"jahresabschluss", r"informe\s+anual", r"relazione\s+annuale",
        r"årsredovisning", r"årsrapport", r"jaarverslag",
    ],
    "earnings_release": [
        r"earnings\s+release", r"results\s+(?:announcement|press release)",
        r"(?:q[1-4]|first|second|third|fourth|full[\s-]?year|half[\s-]?year|annual)\s+(?:results|earnings|trading)",
        r"trading\s+update", r"interim\s+results", r"final\s+results",
    ],
    "investor_day": [
        r"investor\s+day", r"capital\s+markets\s+day", r"cmd",
        r"strategy\s+day", r"investor\s+presentation",
    ],
    "factbook": [
        r"factbook", r"fact\s+book", r"fact\s+sheet",
        r"statistical\s+supplement", r"data\s+book",
    ],
}

YEAR_RE = re.compile(r"\b(20[12]\d)\b")
PDF_RE = re.compile(r'href=["\']([^"\']*\.pdf[^"\']*)["\']', re.IGNORECASE)
LINK_RE = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def http_get(url, timeout=20, max_redirects=5):
    """Fetch URL with browser UA, handle redirects, gzip."""
    last_url = url
    for _ in range(max_redirects):
        try:
            req = urllib.request.Request(last_url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr,en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
            })
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as r:
                ct = r.headers.get("Content-Type", "")
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return data, ct, r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                last_url = urllib.parse.urljoin(last_url, e.headers["Location"])
                continue
            return None, "", last_url
        except Exception:
            return None, "", last_url
    return None, "", last_url


def find_ir_page(ticker, website=None):
    """Try multiple sources to find IR page URL."""
    candidates = []
    if website:
        if not website.startswith("http"):
            website = "https://" + website
        base = website.rstrip("/")
        candidates.append(base)
        for path in IR_PATH_PATTERNS:
            candidates.append(base + path)

    # Common patterns based on ticker
    tk_lower = ticker.lower().replace(".", "-").replace("_", "-")
    base_ticker = tk_lower.split("-")[0] if "-" in tk_lower else tk_lower
    candidates.extend([
        f"https://investor.{base_ticker}.com",
        f"https://ir.{base_ticker}.com",
        f"https://www.{base_ticker}.com/investors",
        f"https://{base_ticker}.com/investors",
    ])

    for url in candidates:
        try:
            data, ct, final_url = http_get(url, timeout=15)
        except Exception:
            continue
        if not data:
            continue
        if "text/html" not in ct.lower():
            continue
        try:
            html = data.decode("utf-8", errors="ignore")
        except Exception:
            continue
        # Look for "investor" keyword density
        kw_count = (
            html.lower().count("investor")
            + html.lower().count("annual report")
            + html.lower().count("earnings")
        )
        if kw_count >= 3:
            return final_url, html
    return None, None


def extract_pdfs_with_year(html, base_url):
    """Find PDF links + classify by doc type + year from filename/anchor text."""
    found = {}  # (year, doc_type) → url
    for m in LINK_RE.finditer(html):
        href = m.group(1)
        anchor = re.sub(r"<[^>]+>", " ", m.group(2)).strip()
        if not href:
            continue
        full = urllib.parse.urljoin(base_url, href)
        # Filter PDFs only
        if not (".pdf" in full.lower() or "/pdf/" in full.lower()):
            continue
        # Find year (in URL OR anchor text)
        year_match = YEAR_RE.search(full) or YEAR_RE.search(anchor)
        if not year_match:
            continue
        year = int(year_match.group(1))
        if year < 2015 or year > 2026:
            continue
        # Classify doc type
        combined = (anchor + " " + full).lower()
        doc_type = None
        for kind, patterns in DOC_KEYWORDS.items():
            if any(re.search(p, combined, re.IGNORECASE) for p in patterns):
                doc_type = kind
                break
        if not doc_type:
            continue
        # Keep one per (year, doc_type)
        key = (year, doc_type)
        if key not in found:
            found[key] = full
    return found


def download_pdf(url, dest):
    """Download PDF to dest. Returns True on success."""
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    data, ct, _ = http_get(url, timeout=60)
    if not data or len(data) < 1000:
        return False
    if "application/pdf" not in ct.lower() and not data.startswith(b"%PDF"):
        return False
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def pdf_to_text(pdf_path):
    """Use pdftotext to extract text."""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), "-"],
            capture_output=True, timeout=30
        )
        return result.stdout.decode("utf-8", errors="ignore") if result.returncode == 0 else ""
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    try:
        import yfinance as yf
    except ImportError:
        log_line("❌ pip install yfinance")
        sys.exit(1)

    if not PENDING_FILE.exists():
        log_line(f"❌ PENDING_FILE not found: {PENDING_FILE}")
        sys.exit(1)

    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    if args.limit:
        pending = pending[:args.limit]
    log_line(f"START scrape-ir-pages: {len(pending)} stés EU sans CIK SEC")

    found_ir = 0
    found_docs_total = 0
    no_ir = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            log_line(f"  [{i}/{len(pending)}] found_ir={found_ir} docs={found_docs_total} no_ir={no_ir} fails={fails}")
        try:
            t = yf.Ticker(tk)
            info = t.info or {}
            website = info.get("website") or ""
        except Exception:
            website = ""
        ir_url, ir_html = find_ir_page(tk, website)
        if not ir_url:
            no_ir += 1
            continue
        docs = extract_pdfs_with_year(ir_html, ir_url)
        if not docs:
            no_ir += 1
            continue
        found_ir += 1
        found_docs_total += len(docs)
        log_line(f"  ✅ {tk}: {len(docs)} docs via {ir_url[:60]}")
        # Save manifest (don't DL yet - just record sources)
        manifest = CACHE / f"{tk.lower()}.json"
        manifest_data = {
            "ticker": tk,
            "ir_url": ir_url,
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "docs": [
                {"year": y, "doc_type": kind, "url": url}
                for (y, kind), url in sorted(docs.items())
            ],
        }
        manifest.write_text(json.dumps(manifest_data, indent=2, ensure_ascii=False))

        time.sleep(0.5)

    log_line(f"END: found_ir={found_ir} docs_total={found_docs_total} no_ir={no_ir} fails={fails}")


if __name__ == "__main__":
    main()
