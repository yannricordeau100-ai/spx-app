#!/usr/bin/env python3
"""IR scraper Pass 3 — Régulateurs nationaux (filet de sécurité cat 3 EU).

Cible : stés cat 3 EU avec <3 docs après Pass 1+2. Pour ces stés on attaque
agressivement la page régulateur (info-financiere.fr, Bundesanzeiger, FCA NSM,
SIX, CONSOB, etc.) avec Playwright :
  - scroll exhaustif
  - clic "load more" / pagination
  - patience JS étendue
  - extraction PDFs

Usage :
  python3 scripts/ir-scraper-pass3-regulators.py --top307 [--workers 2]
"""
import argparse
import asyncio
import json
import os
import re
import time
import urllib.parse
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_ROOT = Path.home() / "Mettrik/sec-data/ir-scrape"
TIMEOUT_PAGE = 30_000
TIMEOUT_DL = 60
MAX_PDF = 80 * 1024 * 1024


def parse_seed_sql(path):
    txt = path.read_text()
    pattern = re.compile(
        r"\(\s*'([^']*)'\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)::jsonb\s*,\s*"
        r"(?:('(?:[^']|'')*'|NULL)\s*,\s*)?"
        r"('(?:[^']|'')*'|NULL)\s*\)", re.M
    )
    rows = []
    for m in pattern.finditer(txt):
        def unq(s):
            if s is None or s == "NULL": return None
            return s[1:-1].replace("''", "'")
        rows.append({
            "ticker": m.group(1),
            "regulator_url": unq(m.group(6)) if m.group(6) else None,
        })
    return rows


def load_seeds():
    merged = {}
    for f in sorted((ROOT / "supabase/seeds").glob("seed-ir-sources-*.sql")):
        for r in parse_seed_sql(f):
            merged[r["ticker"]] = r
    return merged


def disk_free_gb():
    import shutil
    return shutil.disk_usage("/").free / (1024**3)


def safe_fn(url):
    p = urllib.parse.urlparse(url).path
    n = os.path.basename(p) or "file.pdf"
    if not n.lower().endswith(".pdf"): n += ".pdf"
    return re.sub(r"[^A-Za-z0-9._-]", "_", n)[:120]


def is_cat3(t):
    suf = t.split(".")[-1] if "." in t else ""
    return suf in ("PA","DE","SW","MI","MC","AS","BR","LS","HE","ST","CO","OL","L","VI","IR","LU")


async def scrape_regulator(ticker, url, browser):
    out_dir = OUT_ROOT / ticker
    out_dir.mkdir(parents=True, exist_ok=True)
    ctx = await browser.new_context(user_agent="Mozilla/5.0 Mettrik-IR-Pass3/1.0")
    page = await ctx.new_page()
    pdfs = []
    errs = []
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT_PAGE)
        await page.wait_for_timeout(4000)
        # Scroll 3x for lazy load
        for _ in range(3):
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(2000)
            except Exception:
                break
        # Try click "load more" / "show more" / "voir plus"
        for selector in ['button:has-text("Load more")', 'button:has-text("Show more")',
                         'button:has-text("Voir plus")', 'button:has-text("Plus")',
                         'a:has-text("Suivant")', 'a:has-text("Next")']:
            try:
                btn = await page.query_selector(selector)
                if btn:
                    for _ in range(5):
                        try:
                            await btn.click(timeout=2000)
                            await page.wait_for_timeout(1500)
                        except Exception:
                            break
            except Exception:
                pass
        anchors = await page.eval_on_selector_all(
            "a",
            "els => els.map(a => ({href: a.href, text: (a.textContent||'').trim().slice(0,200)}))"
        )
        seen = set()
        for a in anchors:
            href = (a.get("href") or "").split("#")[0]
            if not href or ".pdf" not in href.lower(): continue
            if href in seen: continue
            seen.add(href)
            pdfs.append({"url": href, "text": a.get("text","")[:200], "doctype": "regulator", "found_at": "regulator"})
    except Exception as e:
        errs.append(str(e)[:200])
    await page.close()
    await ctx.close()

    # Download
    import requests
    s = requests.Session()
    dl = []
    for p in pdfs:
        if disk_free_gb() < 0.5:
            dl.append({"url": p["url"], "ok": False, "msg": "disk-full"})
            continue
        fname = safe_fn(p["url"])
        dest = out_dir / "regulator" / fname
        if dest.exists() and dest.stat().st_size > 1024:
            dl.append({"url": p["url"], "ok": True, "msg": "skip-exists"})
            continue
        try:
            r = s.get(p["url"], timeout=TIMEOUT_DL, headers={"User-Agent": "Mettrik-IR-Pass3/1.0"}, stream=True, allow_redirects=True)
            if r.status_code != 200:
                dl.append({"url": p["url"], "ok": False, "msg": f"http-{r.status_code}"}); continue
            ct = r.headers.get("Content-Type","").lower()
            if "pdf" not in ct and "octet-stream" not in ct:
                dl.append({"url": p["url"], "ok": False, "msg": f"not-pdf"}); continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            tot = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(64*1024):
                    tot += len(chunk)
                    if tot > MAX_PDF: f.close(); dest.unlink(missing_ok=True); break
                    f.write(chunk)
            if dest.exists():
                dl.append({"url": p["url"], "ok": True, "size": tot, "doctype": "regulator"})
        except Exception as e:
            dl.append({"url": p["url"], "ok": False, "msg": f"err:{type(e).__name__}"})

    # Update manifest
    mp = out_dir / "_manifest.json"
    m = {}
    if mp.exists():
        try: m = json.loads(mp.read_text())
        except: pass
    m["pass3_regulator_done"] = True
    m["pass3_regulator_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m["pass3_pdfs_found"] = len(pdfs)
    m["pass3_pdfs_downloaded"] = sum(1 for r in dl if r["ok"])
    m["pass3_errors"] = errs
    m["pass3_results"] = dl
    mp.write_text(json.dumps(m, indent=2))
    return {"ticker": ticker, "found": len(pdfs), "dl": m["pass3_pdfs_downloaded"], "errs": len(errs)}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top307", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--min-docs", type=int, default=3, help="seuil docs en dessous duquel on tente Pass 3")
    args = ap.parse_args()

    seeds = load_seeds()
    v18 = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))

    # Select cat3 stés avec <min_docs
    selected = []
    for t in v18:
        if not is_cat3(t): continue
        if t not in seeds or not seeds[t].get("regulator_url"): continue
        mp = OUT_ROOT / t / "_manifest.json"
        total_dl = 0
        if mp.exists():
            try:
                m = json.loads(mp.read_text())
                total_dl = m.get("pdfs_downloaded", 0) + m.get("pass2_pdfs_downloaded", 0)
            except: pass
        if total_dl < args.min_docs:
            selected.append((t, seeds[t]["regulator_url"]))

    print(f"Pass 3 régulateurs sur {len(selected)} stés cat 3 (workers={args.workers})")
    t0 = time.time()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        sem = asyncio.Semaphore(args.workers)
        done = [0]
        async def run_one(t, url):
            async with sem:
                try:
                    res = await scrape_regulator(t, url, browser)
                except Exception as e:
                    res = {"ticker": t, "err": str(e)[:200]}
                done[0] += 1
                if done[0] % 5 == 0 or done[0] == len(selected):
                    dt = time.time()-t0
                    eta = (dt/done[0])*(len(selected)-done[0]) if done[0] else 0
                    print(f"  [{done[0]}/{len(selected)}] {res} | ETA {eta:.0f}s")
        await asyncio.gather(*[run_one(t,u) for t,u in selected])
        await browser.close()
    print(f"\n✅ Pass 3 done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    asyncio.run(main())
