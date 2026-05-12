#!/usr/bin/env python3
"""IR scraper Pass 1 — extrait + télécharge les PDFs depuis les pages IR.

Sources d'URLs : fichiers SQL seed dans supabase/seeds/seed-ir-sources-*.sql
(parsés directement, pas besoin de passer par la BDD).

Output : ~/Mettrik/sec-data/ir-scrape/<TICKER>/<doctype>/<filename>.pdf
+ manifest JSON par ticker à ~/Mettrik/sec-data/ir-scrape/<TICKER>/_manifest.json

Stratégie Pass 1 :
  - Pour chaque sté, fetch les 5 URLs (home + ir_home + ir_docs_main + additional + regulator).
  - Parser HTML brut, extraire tous les liens .pdf.
  - Classifier par mot-clé dans le nom : results / press / presentation / esg / annual / 10K / 20F.
  - Télécharger chaque PDF unique. Skip si fichier identique existe déjà localement (mtime check).
  - Sites JS-heavy = 0 PDF trouvé → marquer pour Pass 2 Playwright.

Usage :
  python3 scripts/ir-scraper-pass1.py --tickers AAPL,MSFT          # liste précise
  python3 scripts/ir-scraper-pass1.py --top307                     # V1.8 top 305 hors chinois
  python3 scripts/ir-scraper-pass1.py --all                        # tous les seeds
  python3 scripts/ir-scraper-pass1.py --all --workers 16           # 16 parallèles
  python3 scripts/ir-scraper-pass1.py --all --limit 50             # premiers 50 only
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip install requests (ou poetry add requests)")

ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = ROOT / "supabase" / "seeds"
OUT_ROOT = Path.home() / "Mettrik" / "sec-data" / "ir-scrape"
OUT_ROOT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Mettrik-IR-Scraper/1.0"
TIMEOUT_HTML = 12
TIMEOUT_PDF = 60
MAX_PDF_BYTES = 80 * 1024 * 1024  # 80 MB cap par PDF

# Skip patterns — BABA réintégré exceptionnellement par décision Yann (12 mai).
# Les autres chinois restent exclus tant que pas demandés.
CHINESE_SKIP = {"BIDU", "JD", "PDD", "NIO", "LI", "XPEV", "TME", "BILI", "TCOM"}

# Classification doctype par mot-clé
DOCTYPE_PATTERNS = [
    ("results", r"results|earnings|q\d|quarter|halfyear|interim|fy\d+|annual.report|rapport.annuel|comptes"),
    ("presentation", r"present|slide|deck|investor.day|capital.markets"),
    ("press", r"press|release|news|communique"),
    ("esg", r"esg|sustain|csr|climate|environment|rse"),
    ("transcript", r"transcript|call|webcast"),
    ("proxy", r"proxy|def14a|notice.meeting|convocation"),
    ("misc", r".*"),
]


def parse_seed_sql(path: Path):
    """Parse un fichier seed SQL → list of dicts {ticker, home, ir_home, ir_main, additional, regulator}."""
    txt = path.read_text()
    rows = []
    # Pattern: ('TICKER', 'home', 'ir_home', 'ir_main', '[...]', 'regulator', 'status') ou sans regulator
    pattern = re.compile(
        r"\(\s*'([^']*)'\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)::jsonb\s*,\s*"
        r"(?:('(?:[^']|'')*'|NULL)\s*,\s*)?"  # regulator (optional column)
        r"('(?:[^']|'')*'|NULL)\s*\)",
        re.M,
    )
    for m in pattern.finditer(txt):
        ticker = m.group(1)
        def unq(s):
            if s is None or s == "NULL":
                return None
            return s[1:-1].replace("''", "'")
        rows.append({
            "ticker": ticker,
            "home_url": unq(m.group(2)),
            "ir_home_url": unq(m.group(3)),
            "ir_docs_main_url": unq(m.group(4)),
            "additional_json": unq(m.group(5)) or "[]",
            "regulator_url": unq(m.group(6)) if m.group(6) else None,
            "status": unq(m.group(7)),
        })
    return rows


def load_all_seeds():
    """Lit tous les seeds desk_ir_sources et dédoublonne par ticker (last wins)."""
    files = sorted(SEED_DIR.glob("seed-ir-sources-*.sql"))
    merged = {}
    for f in files:
        for r in parse_seed_sql(f):
            merged[r["ticker"]] = r
    return list(merged.values())


def classify_pdf(url, link_text=""):
    """Retourne le doctype d'un PDF basé sur l'URL et le texte du lien."""
    text = (url + " " + link_text).lower()
    for label, pat in DOCTYPE_PATTERNS:
        if re.search(pat, text):
            return label
    return "misc"


def extract_pdf_links(html, base_url):
    """Extract tous les liens .pdf d'un HTML. Retourne list of (abs_url, link_text)."""
    if not html:
        return []
    # Find <a href="..."> link_text </a>
    pattern = re.compile(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
    out = []
    seen = set()
    for m in pattern.finditer(html):
        href = m.group(1).strip()
        text = re.sub(r"<[^>]+>", " ", m.group(2))
        text = re.sub(r"\s+", " ", text).strip()
        # Make absolute
        abs_url = urllib.parse.urljoin(base_url, href)
        # Strip fragment
        abs_url = abs_url.split("#")[0]
        # Filter only pdf
        path_lc = urllib.parse.urlparse(abs_url).path.lower()
        if not (path_lc.endswith(".pdf") or ".pdf?" in abs_url.lower() or "/pdf/" in path_lc):
            continue
        if abs_url in seen:
            continue
        seen.add(abs_url)
        out.append((abs_url, text))
    return out


def fetch_html(url, session):
    try:
        r = session.get(url, timeout=TIMEOUT_HTML, headers={"User-Agent": UA}, allow_redirects=True)
        if r.status_code == 200 and len(r.content) > 100:
            return r.text
    except Exception:
        return None
    return None


def safe_filename(url):
    """Génère un nom de fichier sûr depuis une URL."""
    path = urllib.parse.urlparse(url).path
    name = os.path.basename(path) or "file.pdf"
    if not name.lower().endswith(".pdf"):
        name = name + ".pdf"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name[:120]  # cap length


def disk_free_gb(path=Path("/")):
    """Retourne l'espace libre en GB."""
    import shutil
    return shutil.disk_usage(path).free / (1024**3)


def download_pdf(url, dest_path, session):
    """Télécharge un PDF si pas déjà présent. Retourne (ok, bytes, msg)."""
    if dest_path.exists() and dest_path.stat().st_size > 1024:
        return (True, dest_path.stat().st_size, "skip-exists")
    # Safety : stop downloads si moins de 3 GB libres
    if disk_free_gb() < 3.0:
        return (False, 0, "disk-full-safety")
    try:
        r = session.get(url, timeout=TIMEOUT_PDF, headers={"User-Agent": UA}, stream=True, allow_redirects=True)
        if r.status_code != 200:
            return (False, 0, f"http-{r.status_code}")
        ct = r.headers.get("Content-Type", "").lower()
        if "pdf" not in ct and "octet-stream" not in ct:
            return (False, 0, f"not-pdf:{ct[:30]}")
        total = 0
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                total += len(chunk)
                if total > MAX_PDF_BYTES:
                    f.close()
                    dest_path.unlink(missing_ok=True)
                    return (False, total, "too-large")
                f.write(chunk)
        return (True, total, "downloaded")
    except Exception as e:
        return (False, 0, f"err:{type(e).__name__}")


def process_ticker(row, session_factory):
    """Pour 1 sté : fetch les URLs, extrait PDFs, download, retourne stats."""
    ticker = row["ticker"]
    if ticker in CHINESE_SKIP:
        return {"ticker": ticker, "skipped": "chinese"}
    out_dir = OUT_ROOT / ticker
    manifest_path = out_dir / "_manifest.json"
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text())
            if existing.get("pass1_done") and not existing.get("force"):
                return {"ticker": ticker, "skipped": "manifest-done", "pdfs": len(existing.get("pdfs", []))}
        except Exception:
            pass

    urls = []
    for k in ("home_url", "ir_home_url", "ir_docs_main_url"):
        u = row.get(k)
        if u:
            urls.append((k, u))
    try:
        add = json.loads(row.get("additional_json") or "[]")
        for i, u in enumerate(add or []):
            if u:
                urls.append((f"additional_{i+1}", u))
    except Exception:
        pass
    if row.get("regulator_url"):
        urls.append(("regulator_url", row["regulator_url"]))

    session = session_factory()
    pdfs = []
    seen_pdf = set()
    errs = []
    for label, u in urls:
        html = fetch_html(u, session)
        if not html:
            errs.append((label, u, "no-html"))
            continue
        for pdf_url, text in extract_pdf_links(html, u):
            if pdf_url in seen_pdf:
                continue
            seen_pdf.add(pdf_url)
            doctype = classify_pdf(pdf_url, text)
            pdfs.append({"url": pdf_url, "text": text[:200], "doctype": doctype, "found_at": label})

    # Download each unique PDF
    dl_results = []
    for p in pdfs:
        fname = safe_filename(p["url"])
        dest = out_dir / p["doctype"] / fname
        ok, size, msg = download_pdf(p["url"], dest, session)
        dl_results.append({"url": p["url"], "doctype": p["doctype"], "ok": ok, "size": size, "msg": msg, "path": str(dest.relative_to(OUT_ROOT)) if ok else None})

    # Manifest
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "ticker": ticker,
        "scraped_at": datetime.utcnow().isoformat() + "Z",
        "pass1_done": True,
        "urls_visited": urls,
        "pdfs_found": len(pdfs),
        "pdfs_downloaded": sum(1 for r in dl_results if r["ok"]),
        "pdfs_downloaded_bytes": sum(r["size"] for r in dl_results if r["ok"]),
        "fetch_errors": errs,
        "pdfs": dl_results,
        "needs_pass2": len(pdfs) == 0,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return {
        "ticker": ticker,
        "pdfs_found": len(pdfs),
        "pdfs_dl": manifest["pdfs_downloaded"],
        "bytes": manifest["pdfs_downloaded_bytes"],
        "errs": len(errs),
        "needs_pass2": manifest["needs_pass2"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", help="comma-separated list (overrides --top307/--all)")
    ap.add_argument("--top307", action="store_true", help="V1.8 top 305 hors chinois")
    ap.add_argument("--all", action="store_true", help="tous les seeds")
    ap.add_argument("--workers", type=int, default=12, help="parallel workers (default 12)")
    ap.add_argument("--limit", type=int, default=0, help="limit N stés (debug)")
    ap.add_argument("--force", action="store_true", help="re-scrape même si manifest existant")
    args = ap.parse_args()

    seeds = {r["ticker"]: r for r in load_all_seeds()}
    print(f"Loaded {len(seeds)} ticker rows from seeds")

    selected = []
    if args.tickers:
        for t in args.tickers.split(","):
            t = t.strip().upper()
            if t in seeds:
                selected.append(seeds[t])
            else:
                print(f"  ⚠ {t} pas dans les seeds, skip")
    elif args.top307:
        v18 = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))
        for t in v18:
            if t in seeds:
                selected.append(seeds[t])
    elif args.all:
        selected = list(seeds.values())
    else:
        ap.error("--tickers, --top307 ou --all requis")

    if args.limit > 0:
        selected = selected[: args.limit]
    if args.force:
        # delete manifest for forced re-scrape
        for r in selected:
            mp = OUT_ROOT / r["ticker"] / "_manifest.json"
            mp.unlink(missing_ok=True)

    print(f"Sociétés à scraper : {len(selected)} (workers={args.workers})")
    t0 = time.time()

    # Session factory (thread-local)
    import threading
    local = threading.local()
    def session_factory():
        if not hasattr(local, "s"):
            local.s = requests.Session()
        return local.s

    done = 0
    total_pdfs = 0
    total_bytes = 0
    pass2_needed = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_ticker, r, session_factory): r["ticker"] for r in selected}
        for fut in as_completed(futs):
            ticker = futs[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"ticker": ticker, "error": str(e)}
            done += 1
            if "skipped" not in res and "error" not in res:
                total_pdfs += res.get("pdfs_dl", 0)
                total_bytes += res.get("bytes", 0)
                if res.get("needs_pass2"):
                    pass2_needed.append(ticker)
            if done % 20 == 0 or done == len(selected):
                dt = time.time() - t0
                eta = (dt / done) * (len(selected) - done) if done else 0
                print(f"  [{done}/{len(selected)}] {ticker}: {res} | total PDFs DL: {total_pdfs} ({total_bytes/1e6:.0f}MB) | ETA {eta:.0f}s")

    dt = time.time() - t0
    print(f"\n✅ Pass 1 done in {dt:.0f}s")
    print(f"  PDFs téléchargés : {total_pdfs} ({total_bytes/1e9:.2f} GB)")
    print(f"  Stés sans PDF (besoin Pass 2 Playwright) : {len(pass2_needed)}")
    pass2_file = OUT_ROOT / "_pass2-needed.json"
    pass2_file.write_text(json.dumps(pass2_needed, indent=2))
    print(f"  Liste pass 2 écrite : {pass2_file}")


if __name__ == "__main__":
    main()
