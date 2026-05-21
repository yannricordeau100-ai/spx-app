#!/usr/bin/env python3
"""
Canada TSX 60 deep scraper — Phase 1b (2-level scrape)

Pass complémentaire pour les stés où le 1er scraper canada-tsx60-scraper.py n'a
trouvé aucun PDF direct sur la page IR principale. Suit les liens 2nd niveau
vers les pages spécifiques "Annual Reports", "Quarterly Results", "Financial
Reports", "Presentations", etc.

Lit le manifest.json existant pour chaque ticker, et complète sans dupliquer.

Usage :
    python3 scripts/canada-tsx60-deep-scraper.py
    python3 scripts/canada-tsx60-deep-scraper.py --ticker AEM.TO
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "sec-data"
OUT_DIR = DATA_ROOT / "cat-canadian"
LOG_PATH = DATA_ROOT / "_meta" / "canada-tsx60-deep-scraper.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mettrik-Research/1.0"

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")
log_lock = Lock()


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    with log_lock:
        print(line, flush=True)
        if log_fh:
            log_fh.write(line + "\n")
            log_fh.flush()


def safe_filename(s: str, max_len: int = 100) -> str:
    s = SAFE_FILENAME_RE.sub("-", s).strip("-")
    return s[:max_len] if len(s) > max_len else s


def http_get(url: str, timeout: int = 30, accept: str = "*/*") -> tuple[int, bytes]:
    headers = {"User-Agent": UA, "Accept": accept}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def download_file(url: str, dest: Path, min_bytes: int = 10000) -> bool:
    if dest.exists() and dest.stat().st_size >= min_bytes:
        return True
    code, body = http_get(url, timeout=180)
    if code != 200 or len(body) < min_bytes:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    if txt_path.exists() and txt_path.stat().st_size > 5000:
        return True
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=180
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def resolve_url(href: str, base_url: str) -> str:
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        from urllib.parse import urlparse
        b = urlparse(base_url)
        return f"{b.scheme}://{b.netloc}{href}"
    if href.startswith("http"):
        return href
    # relatif
    if base_url.endswith("/"):
        return base_url + href
    return base_url.rsplit("/", 1)[0] + "/" + href


def find_sub_page_links(html: str, base_url: str, keywords: list[str]) -> list[tuple[str, str]]:
    """Trouve les liens internes (non-PDF) vers des sous-pages avec des
    keywords donnés (annual report, quarterly, presentations, etc.)."""
    from urllib.parse import urlparse
    base_host = urlparse(base_url).netloc.lower()

    results = []
    pattern = re.compile(
        r'<a[^>]*href="([^"#]+?)"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL
    )
    seen = set()
    for m in pattern.finditer(html):
        href = m.group(1)
        anchor = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        anchor_lower = anchor.lower()
        # Skip PDFs (déjà traités par scraper niveau 1)
        if href.lower().endswith(".pdf") or ".pdf?" in href.lower():
            continue
        # Filtre keywords
        if not any(kw.lower() in anchor_lower for kw in keywords):
            continue
        # Resolve
        full_url = resolve_url(href, base_url)
        # Reste sur le même host
        target_host = urlparse(full_url).netloc.lower()
        if target_host and base_host and base_host not in target_host and target_host not in base_host:
            # Tolérer subdomain (ex investors.X.com vs X.com)
            base_root = ".".join(base_host.split(".")[-2:])
            target_root = ".".join(target_host.split(".")[-2:])
            if base_root != target_root:
                continue
        if full_url in seen:
            continue
        seen.add(full_url)
        results.append((full_url, anchor))
    return results[:5]  # max 5 sub-pages par keyword set


def find_pdf_links_in_html(html: str, base_url: str, keywords: list[str]) -> list[tuple[str, str]]:
    results = []
    pattern = re.compile(
        r'<a[^>]*href="([^"#]+\.pdf[^"]*)"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL
    )
    seen = set()
    for m in pattern.finditer(html):
        url = resolve_url(m.group(1), base_url)
        anchor = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        if url in seen:
            continue
        seen.add(url)
        anchor_lower = anchor.lower()
        url_lower = url.lower()
        # Match keyword either in anchor or in URL itself
        if any(kw.lower() in anchor_lower or kw.lower() in url_lower for kw in keywords):
            results.append((url, anchor or url.rsplit("/", 1)[-1]))
    return results


def deep_scrape_ticker(ticker_dir: Path, log_fh=None) -> dict:
    """Lit manifest.json + IR snapshot, fait passe 2nd niveau."""
    manifest_path = ticker_dir / "manifest.json"
    if not manifest_path.exists():
        return {"ticker": ticker_dir.name, "skipped": "no_manifest"}

    manifest = json.loads(manifest_path.read_text())
    ticker = manifest["ticker"]
    ir_url = manifest.get("ir_url", "")

    # Skip si déjà bcp de docs
    counts = manifest.get("counts", {})
    total = (counts.get("annual_reports", 0) +
             counts.get("mda_reports", 0) +
             counts.get("ir_presentations", 0))
    if total >= 5:
        log(f"[{ticker}] skip deep (already {total} docs)", log_fh)
        return {"ticker": ticker, "skipped": "already_complete", "total": total}

    # Trouver le snapshot IR le plus récent
    snapshots = list((ticker_dir / "ir-page-snapshot").glob("ir-page-*.html"))
    if not snapshots:
        log(f"[{ticker}] no IR snapshot, can't deep scrape", log_fh)
        return {"ticker": ticker, "skipped": "no_ir_snapshot"}

    ir_html = snapshots[-1].read_text(encoding="utf-8", errors="ignore")

    log(f"[{ticker}] deep scrape — current docs={total}", log_fh)

    today = datetime.now().strftime("%Y%m%d")
    new_docs = {"annual": 0, "mda": 0, "proxy": 0, "ir-pres": 0, "esg": 0, "quarterly": 0}

    # Catégories : keywords sub-page + keywords PDF
    categories = [
        ("annual", "annual-report",
         ["annual report", "rapport annuel", "annual & sustainability",
          "AIF", "annual information form", "notice annuelle", "integrated report"],
         ["annual", "AIF", "rapport-annuel", "informations-annuelles"]),
        ("mda", "mda",
         ["MD&A", "management discussion", "rapport de gestion",
          "quarterly report", "rapport trimestriel"],
         ["MDA", "MD&A", "rapport-de-gestion", "quarterly", "trimestriel"]),
        ("proxy", "proxy",
         ["proxy circular", "management proxy", "circulaire",
          "information circular", "circulaire de sollicitation"],
         ["proxy", "circular", "circulaire"]),
        ("ir-pres", "ir-presentations",
         ["investor day", "investor presentation", "présentation",
          "earnings presentation", "investor briefing", "quarterly presentation"],
         ["presentation", "investor", "earnings", "Q1", "Q2", "Q3", "Q4"]),
        ("esg", "esg",
         ["sustainability", "ESG report", "rapport ESG", "responsibility",
          "climate report", "TCFD", "durabilité"],
         ["sustainability", "ESG", "climate", "durabilité"]),
        ("quarterly", "ir-presentations",
         ["quarterly results", "résultats trimestriels", "q1 result",
          "q2 result", "q3 result", "q4 result", "interim", "second quarter",
          "first quarter", "third quarter", "fourth quarter"],
         ["Q1", "Q2", "Q3", "Q4", "quarterly", "interim", "trimestriel"]),
    ]

    for cat_key, subdir, page_keywords, pdf_keywords in categories:
        # 1) Trouve sub-pages
        sub_pages = find_sub_page_links(ir_html, ir_url, page_keywords)
        for page_url, page_anchor in sub_pages:
            time.sleep(1.5)  # throttle
            code, body = http_get(page_url, timeout=30, accept="text/html")
            if code != 200 or len(body) < 1000:
                continue
            sub_html = body.decode("utf-8", errors="ignore")

            # 2) Trouve PDFs dans cette sub-page
            pdfs = find_pdf_links_in_html(sub_html, page_url, pdf_keywords)
            for pdf_url, anchor in pdfs[:6]:
                year_match = re.search(r'(20\d{2})', anchor + " " + pdf_url)
                year = year_match.group(1) if year_match else today[:4]

                if cat_key in ("annual",):
                    pdf_dest = ticker_dir / subdir / f"{year}.pdf"
                    min_bytes = 50000
                elif cat_key == "mda":
                    pdf_dest = ticker_dir / subdir / f"{year}.pdf"
                    min_bytes = 30000
                elif cat_key == "proxy":
                    pdf_dest = ticker_dir / subdir / f"{year}.pdf"
                    min_bytes = 30000
                elif cat_key == "esg":
                    pdf_dest = ticker_dir / subdir / f"{year}-sustainability.pdf"
                    min_bytes = 30000
                else:
                    filename = safe_filename(f"{year}-{anchor[:50]}") + ".pdf"
                    pdf_dest = ticker_dir / subdir / filename
                    min_bytes = 20000

                if pdf_dest.exists() and pdf_dest.stat().st_size > min_bytes:
                    continue

                if download_file(pdf_url, pdf_dest, min_bytes=min_bytes):
                    new_docs[cat_key] += 1
                    log(f"  [OK] {cat_key} {year} → {pdf_dest.name}", log_fh)

                    # Convert annual to text
                    if cat_key == "annual":
                        txt_dest = ticker_dir / "annual-text" / f"{year}.txt"
                        pdf_to_text(pdf_dest, txt_dest)

                    # Update manifest
                    entry = {"year": year, "url": pdf_url, "anchor": anchor[:80],
                             "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                             "via": "deep-scrape"}
                    if cat_key == "annual":
                        manifest["annual_reports"].append(entry)
                    elif cat_key == "mda":
                        manifest["mda_reports"].append(entry)
                    elif cat_key == "proxy":
                        manifest["proxy_circulars"].append(entry)
                    elif cat_key == "esg":
                        manifest["esg_reports"].append(entry)
                    else:
                        manifest["ir_presentations"].append(entry)

    # Re-compute counts
    manifest["counts"] = {
        "annual_reports": len(manifest["annual_reports"]),
        "mda_reports": len(manifest["mda_reports"]),
        "proxy_circulars": len(manifest["proxy_circulars"]),
        "ir_presentations": len(manifest["ir_presentations"]),
        "esg_reports": len(manifest["esg_reports"]),
        "snapshots": len(manifest.get("snapshots", [])),
        "fails": len(manifest.get("fails", [])),
    }
    manifest["deep_scraped_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    total_new = sum(new_docs.values())
    log(f"[{ticker}] deep DONE — +{total_new} new docs ({new_docs})", log_fh)
    return {"ticker": ticker, "new_docs": new_docs, "total_new": total_new}


def main():
    parser = argparse.ArgumentParser(description="TSX 60 deep scraper (2nd-level sub-pages)")
    parser.add_argument("--ticker", type=str, help="Single ticker (e.g. AEM.TO)")
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    workers = max(1, min(args.workers, 4))

    if args.ticker:
        targets = [OUT_DIR / args.ticker.replace("/", "_")]
    else:
        targets = sorted([d for d in OUT_DIR.iterdir() if d.is_dir() and (d / "manifest.json").exists()])

    if not targets:
        print(f"No targets found in {OUT_DIR}", file=sys.stderr)
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a", encoding="utf-8")
    log(f"=== TSX 60 DEEP scraper start — {len(targets)} tickers, workers={workers} ===", log_fh)

    results = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(deep_scrape_ticker, t, log_fh) for t in targets]
        for fut in as_completed(futures):
            results.append(fut.result())

    total_new = sum(r.get("total_new", 0) for r in results if isinstance(r, dict))
    log(f"=== DEEP DONE — {total_new} new docs across {len(targets)} tickers ===", log_fh)
    log_fh.close()

    print(f"\nDeep scrape: +{total_new} docs total")


if __name__ == "__main__":
    main()
