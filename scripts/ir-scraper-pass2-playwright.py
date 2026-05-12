#!/usr/bin/env python3
"""IR scraper Pass 2 — Playwright headless pour les sites JS-heavy.

Cible : stés où Pass 1 a trouvé 0-2 PDFs (=`needs_pass2` ou peu de docs).
Charge la page en navigateur headless, attend que le JS se charge, puis
extrait tous les liens PDF visibles dans le DOM rendu.

Usage :
  python3 scripts/ir-scraper-pass2-playwright.py --top307 [--workers 2]
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    sys.exit("pip3 install playwright && python3 -m playwright install chromium")

ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = ROOT / "supabase" / "seeds"
OUT_ROOT = Path.home() / "Mettrik" / "sec-data" / "ir-scrape"
TIMEOUT_PAGE = 25_000  # ms
TIMEOUT_DOWNLOAD = 60
MAX_PDF_BYTES = 80 * 1024 * 1024


def parse_seed_sql(path):
    txt = path.read_text()
    pattern = re.compile(
        r"\(\s*'([^']*)'\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)::jsonb\s*,\s*"
        r"(?:('(?:[^']|'')*'|NULL)\s*,\s*)?"
        r"('(?:[^']|'')*'|NULL)\s*\)",
        re.M,
    )
    rows = []
    for m in pattern.finditer(txt):
        def unq(s):
            if s is None or s == "NULL": return None
            return s[1:-1].replace("''", "'")
        rows.append({
            "ticker": m.group(1),
            "home_url": unq(m.group(2)),
            "ir_home_url": unq(m.group(3)),
            "ir_docs_main_url": unq(m.group(4)),
            "additional_json": unq(m.group(5)) or "[]",
            "regulator_url": unq(m.group(6)) if m.group(6) else None,
        })
    return rows


def load_all_seeds():
    merged = {}
    for f in sorted(SEED_DIR.glob("seed-ir-sources-*.sql")):
        for r in parse_seed_sql(f):
            merged[r["ticker"]] = r
    return merged


def disk_free_gb():
    import shutil
    return shutil.disk_usage("/").free / (1024**3)


def safe_filename(url):
    path = urllib.parse.urlparse(url).path
    name = os.path.basename(path) or "file.pdf"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name[:120]


def classify_pdf(url, text=""):
    text_lc = (url + " " + text).lower()
    for label, pat in [
        ("results", r"results|earnings|q\d|quarter|halfyear|interim|fy\d+|annual.report|rapport.annuel"),
        ("presentation", r"present|slide|deck|investor.day|capital.markets"),
        ("press", r"press|release|news|communique"),
        ("esg", r"esg|sustain|csr|climate"),
        ("transcript", r"transcript|call|webcast"),
        ("proxy", r"proxy|def14a|notice.meeting"),
    ]:
        if re.search(pat, text_lc):
            return label
    return "misc"


async def scrape_one(row, browser):
    t = row["ticker"]
    out_dir = OUT_ROOT / t
    out_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    for k in ("ir_docs_main_url", "ir_home_url"):
        if row.get(k): urls.append((k, row[k]))
    try:
        for i, u in enumerate(json.loads(row.get("additional_json") or "[]")):
            if u: urls.append((f"additional_{i+1}", u))
    except Exception:
        pass
    if not urls:
        return {"ticker": t, "skip": "no-url"}

    context = await browser.new_context(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Mettrik-IR-Pass2/1.0")
    page = await context.new_page()
    pdfs = []
    seen = set()
    errs = []
    for label, u in urls:
        try:
            await page.goto(u, wait_until="domcontentloaded", timeout=TIMEOUT_PAGE)
            await page.wait_for_timeout(3000)  # let JS run
            # Try to scroll to trigger lazy load
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1500)
            except Exception:
                pass
            anchors = await page.eval_on_selector_all(
                "a",
                """els => els.map(a => ({href: a.href, text: (a.textContent || '').trim().slice(0,200)}))"""
            )
            for a in anchors:
                href = a.get("href") or ""
                if not href: continue
                low = href.lower()
                if ".pdf" not in low: continue
                href = href.split("#")[0]
                if href in seen: continue
                seen.add(href)
                doctype = classify_pdf(href, a.get("text", ""))
                pdfs.append({"url": href, "text": a.get("text", "")[:200], "doctype": doctype, "found_at": label})
        except Exception as e:
            errs.append({"label": label, "url": u, "err": str(e)[:100]})

    await page.close()
    await context.close()

    # Download PDFs (sync via requests for simplicity)
    import requests
    s = requests.Session()
    dl = []
    for p in pdfs:
        if disk_free_gb() < 3.0:
            dl.append({"url": p["url"], "ok": False, "msg": "disk-full"})
            continue
        fname = safe_filename(p["url"])
        dest = out_dir / p["doctype"] / fname
        if dest.exists() and dest.stat().st_size > 1024:
            dl.append({"url": p["url"], "doctype": p["doctype"], "ok": True, "msg": "skip-exists", "path": str(dest.relative_to(OUT_ROOT))})
            continue
        try:
            r = s.get(p["url"], timeout=TIMEOUT_DOWNLOAD, headers={"User-Agent": "Mettrik-IR-Pass2/1.0"}, stream=True, allow_redirects=True)
            if r.status_code != 200:
                dl.append({"url": p["url"], "ok": False, "msg": f"http-{r.status_code}"})
                continue
            ct = r.headers.get("Content-Type", "").lower()
            if "pdf" not in ct and "octet-stream" not in ct:
                dl.append({"url": p["url"], "ok": False, "msg": f"not-pdf:{ct[:30]}"})
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            total = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(64 * 1024):
                    total += len(chunk)
                    if total > MAX_PDF_BYTES:
                        f.close(); dest.unlink(missing_ok=True); break
                    f.write(chunk)
            if dest.exists():
                dl.append({"url": p["url"], "doctype": p["doctype"], "ok": True, "size": total, "msg": "downloaded", "path": str(dest.relative_to(OUT_ROOT))})
        except Exception as e:
            dl.append({"url": p["url"], "ok": False, "msg": f"err:{type(e).__name__}"})

    # Update manifest
    mp = out_dir / "_manifest.json"
    manifest = {}
    if mp.exists():
        try: manifest = json.loads(mp.read_text())
        except: pass
    manifest["pass2_done"] = True
    manifest["pass2_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    manifest["pass2_pdfs_found"] = len(pdfs)
    manifest["pass2_pdfs_downloaded"] = sum(1 for r in dl if r["ok"])
    manifest["pass2_errors"] = errs
    manifest["pass2_results"] = dl
    mp.write_text(json.dumps(manifest, indent=2))
    return {"ticker": t, "found": len(pdfs), "dl": manifest["pass2_pdfs_downloaded"], "errs": len(errs)}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top307", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--tickers")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--only-needs-pass2", action="store_true", help="Only run on stés with needs_pass2=true in manifest")
    args = ap.parse_args()

    seeds = load_all_seeds()
    selected = []
    if args.tickers:
        for t in args.tickers.split(","):
            if t in seeds: selected.append(seeds[t])
    elif args.top307:
        v18 = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))
        for t in v18:
            if t in seeds: selected.append(seeds[t])
    elif args.all:
        selected = list(seeds.values())

    if args.only_needs_pass2:
        keep = []
        for r in selected:
            mp = OUT_ROOT / r["ticker"] / "_manifest.json"
            if not mp.exists(): continue
            try:
                m = json.loads(mp.read_text())
                if m.get("needs_pass2") or m.get("pdfs_downloaded", 0) < 3:
                    keep.append(r)
            except Exception:
                continue
        selected = keep

    print(f"Pass 2 Playwright sur {len(selected)} stés (workers={args.workers})")
    t0 = time.time()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        sem = asyncio.Semaphore(args.workers)
        done = [0]

        async def run_one(row):
            async with sem:
                try:
                    res = await scrape_one(row, browser)
                except Exception as e:
                    res = {"ticker": row["ticker"], "err": str(e)[:200]}
                done[0] += 1
                if done[0] % 10 == 0 or done[0] == len(selected):
                    dt = time.time() - t0
                    eta = (dt / done[0]) * (len(selected) - done[0]) if done[0] else 0
                    print(f"  [{done[0]}/{len(selected)}] {res} | ETA {eta:.0f}s")

        await asyncio.gather(*[run_one(r) for r in selected])
        await browser.close()

    print(f"\n✅ Pass 2 done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    asyncio.run(main())
