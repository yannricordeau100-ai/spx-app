#!/usr/bin/env python3
"""
refetch-logos-660.py · Refetch + normalize logos for clean_all V1.9.5 universe.

Strategy:
  1. Read clean_all tickers from src/data/v1-9-pre-publication-audit.json (is_clean_all=true)
  2. For each ticker:
     a. Resolve domain via yfinance.info.website (cached)
     b. Fetch best logo candidate via:
        - Wikidata P154 (primary, high-quality, transparent)
        - og:image / apple-touch-icon scraping (fallback)
     c. NORMALIZE to 256x256 EXACT square, padded with #050505 background (app dark bg)
     d. Save to public/logos/<TICKER_KEY>.png (filename uses dash convention: TTE.PA -> TTE-PA.png and TTE.PA.png)
  3. Output stats to src/data/_logos-refetch-status.json

Idempotent: skip if existing logo mtime < 30 days AND ticker not in --force list.

Parallelism: ThreadPoolExecutor with --workers (default 4).

NO Anthropic API used. Free sources only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from threading import Lock

import requests
import yfinance as yf
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "logos"
BACKUP_DIR = LOGOS_DIR / ".backup-refetch-660"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
STATUS_PATH = ROOT / "src" / "data" / "_logos-refetch-status.json"
AUDIT_PATH = ROOT / "src" / "data" / "v1-9-pre-publication-audit.json"
CACHE_DIR = ROOT / "src" / "data" / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
YF_CACHE = CACHE_DIR / "yf-domains.json"
WD_CACHE = CACHE_DIR / "wikidata-q.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Mettrik-Logo-Refetch/1.0"
}
TIMEOUT = 12
TARGET_SIZE = 256
PAD_COLOR = (5, 5, 5, 255)  # #050505 matching app background
SKIP_AGE_DAYS = 30

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

_yf_cache: dict[str, str | None] = {}
_wd_cache: dict[str, str | None] = {}
_cache_lock = Lock()
_stats_lock = Lock()


def load_caches():
    global _yf_cache, _wd_cache
    try:
        if YF_CACHE.exists():
            _yf_cache = json.loads(YF_CACHE.read_text())
    except Exception:
        _yf_cache = {}
    try:
        if WD_CACHE.exists():
            _wd_cache = json.loads(WD_CACHE.read_text())
    except Exception:
        _wd_cache = {}


def save_caches():
    with _cache_lock:
        YF_CACHE.write_text(json.dumps(_yf_cache, indent=2))
        WD_CACHE.write_text(json.dumps(_wd_cache, indent=2))


def ticker_filename_variants(ticker: str) -> list[str]:
    """Return possible filename variants (TTE.PA -> ['TTE.PA.png', 'TTE-PA.png'])."""
    return list({f"{ticker}.png", f"{ticker.replace('.', '-')}.png"})


def get_yf_website(ticker: str) -> tuple[str | None, str | None]:
    """Returns (website, name)."""
    with _cache_lock:
        if ticker in _yf_cache:
            cached = _yf_cache[ticker]
            # cache may be a dict {website, name} or legacy str/None
            if isinstance(cached, dict):
                return cached.get("website"), cached.get("name")
            if cached is None:
                return None, None
            return cached, None
    try:
        info = yf.Ticker(ticker).info
        if not info or not isinstance(info, dict):
            with _cache_lock:
                _yf_cache[ticker] = None
            return None, None
        website = info.get("website") or info.get("websiteUrl")
        name = info.get("longName") or info.get("shortName")
        website = website.rstrip("/") if (website and isinstance(website, str)) else None
        with _cache_lock:
            _yf_cache[ticker] = {"website": website, "name": name}
        return website, name
    except Exception:
        return None, None


def domain_from_url(url: str | None) -> str | None:
    if not url:
        return None
    m = re.match(r"https?://([^/]+)", url)
    if m:
        return m.group(1).replace("www.", "")
    return None


def fetch_image(url: str) -> bytes | None:
    try:
        r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 200 and len(r.content) > 200:
            ctype = r.headers.get("Content-Type", "").lower()
            if "image" in ctype or "svg" in ctype or url.lower().endswith(
                (".png", ".jpg", ".jpeg", ".svg", ".webp")
            ):
                return r.content
    except Exception:
        pass
    return None


def try_wikidata(ticker: str, name: str | None) -> bytes | None:
    """Search Wikidata, fetch P154 (logo) at width=512."""
    if not name:
        return None
    cache_key = f"{ticker}::{name}"
    with _cache_lock:
        cached_q = _wd_cache.get(cache_key)
    try:
        if cached_q is None:
            q = urllib.parse.quote(name)
            r = SESSION.get(
                f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={q}&language=en&format=json&type=item",
                timeout=TIMEOUT,
            )
            if r.status_code != 200:
                return None
            results = r.json().get("search", [])
            if not results:
                with _cache_lock:
                    _wd_cache[cache_key] = ""
                return None
            qid = results[0]["id"]
            with _cache_lock:
                _wd_cache[cache_key] = qid
        else:
            qid = cached_q
            if not qid:
                return None
        r2 = SESSION.get(
            f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qid}&props=claims&format=json",
            timeout=TIMEOUT,
        )
        if r2.status_code != 200:
            return None
        claims = r2.json().get("entities", {}).get(qid, {}).get("claims", {})
        if "P154" not in claims:
            return None
        logo_file = claims["P154"][0]["mainsnak"]["datavalue"]["value"]
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(logo_file)}?width=512"
        return fetch_image(url)
    except Exception:
        return None


def try_og_image(domain_url: str) -> bytes | None:
    """Scrape homepage for apple-touch-icon / og:image / icon link."""
    try:
        r = SESSION.get(domain_url, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        # 1. apple-touch-icon (often clean square brand mark)
        for link in soup.find_all("link", rel=re.compile(r"apple-touch-icon", re.I)):
            href = link.get("href")
            if href:
                full = urllib.parse.urljoin(domain_url, href)
                img = fetch_image(full)
                if img and len(img) > 3000:
                    return img
        # 2. og:image if path hints logo/brand
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            href = og["content"]
            full = urllib.parse.urljoin(domain_url, href)
            if re.search(r"logo|brand|wordmark|icon", full, re.I):
                img = fetch_image(full)
                if img and len(img) > 3000:
                    return img
        # 3. <link rel=icon> with large size
        for link in soup.find_all("link", rel=re.compile(r"^(icon|shortcut icon|mask-icon)$", re.I)):
            sizes = link.get("sizes", "")
            ok = False
            if sizes and "x" in sizes:
                try:
                    biggest = max(
                        int(s.split("x")[0])
                        for s in sizes.split()
                        if "x" in s and s.split("x")[0].isdigit()
                    )
                    ok = biggest >= 128
                except Exception:
                    pass
            href = link.get("href")
            if href and (ok or href.lower().endswith(".svg")):
                full = urllib.parse.urljoin(domain_url, href)
                img = fetch_image(full)
                if img and len(img) > 2000:
                    return img
    except Exception:
        pass
    return None


def normalize_to_256_padded(img_bytes: bytes) -> bytes | None:
    """Convert any image to a 256x256 PNG, centered, padded with #050505."""
    head = img_bytes[:300].lower()
    # SVG handling
    if b"<svg" in head or (b"<?xml" in head and b"svg" in img_bytes[:600].lower()):
        try:
            import cairosvg

            img_bytes = cairosvg.svg2png(bytestring=img_bytes, output_width=512)
        except Exception:
            return None
    try:
        im = Image.open(BytesIO(img_bytes))
        # Convert to RGBA to preserve transparency
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        # Fit inside (TARGET_SIZE - margin) box keeping aspect; margin 12px on each side
        inner = TARGET_SIZE - 24
        im.thumbnail((inner, inner), Image.LANCZOS)
        # Create dark canvas
        canvas = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), PAD_COLOR)
        # Paste centered (alpha-composite to merge transparency on dark bg)
        x = (TARGET_SIZE - im.width) // 2
        y = (TARGET_SIZE - im.height) // 2
        canvas.alpha_composite(im, (x, y))
        out = BytesIO()
        canvas.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        return None


def existing_age_days(path: Path) -> float | None:
    if not path.exists():
        return None
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        return (datetime.now(timezone.utc) - mtime).total_seconds() / 86400
    except Exception:
        return None


def process_ticker(ticker: str, force: bool = False) -> dict:
    log: dict = {"ticker": ticker, "action": "skip", "reason": "", "source": None, "size": None}
    variants = ticker_filename_variants(ticker)
    primary_path = LOGOS_DIR / variants[0]
    existing_paths = [LOGOS_DIR / v for v in variants if (LOGOS_DIR / v).exists()]

    # Idempotency: skip if recent
    if not force and existing_paths:
        oldest_age = min(
            (existing_age_days(p) for p in existing_paths if existing_age_days(p) is not None),
            default=None,
        )
        if oldest_age is not None and oldest_age < SKIP_AGE_DAYS:
            # Also verify it's already 256x256 to count as "good"
            try:
                im = Image.open(existing_paths[0])
                if im.size == (TARGET_SIZE, TARGET_SIZE):
                    log["action"] = "skip"
                    log["reason"] = f"recent_and_256x256 ({oldest_age:.1f}d)"
                    return log
            except Exception:
                pass

    website, name = get_yf_website(ticker)
    log["website"] = website

    # Source priority: Wikidata first (transparent + branded), then og:image scrape
    candidate = None
    source = None
    if name:
        candidate = try_wikidata(ticker, name)
        if candidate:
            source = "wikidata"
    if not candidate and website:
        c2 = try_og_image(website)
        if c2:
            candidate = c2
            source = "og_image"

    if not candidate:
        log["reason"] = "no_candidate"
        return log

    png = normalize_to_256_padded(candidate)
    if not png:
        log["reason"] = "normalize_fail"
        log["source"] = source
        return log

    # Backup old + write new for ALL variants (so both TTE.PA.png and TTE-PA.png exist)
    for p in existing_paths:
        try:
            backup = BACKUP_DIR / p.name
            if not backup.exists():
                backup.write_bytes(p.read_bytes())
        except Exception:
            pass

    for v in variants:
        target = LOGOS_DIR / v
        target.write_bytes(png)

    log["action"] = "replaced"
    log["source"] = source
    log["size"] = len(png)
    return log


def load_clean_all_tickers() -> list[str]:
    data = json.loads(AUDIT_PATH.read_text())
    audits = data.get("audits", [])
    tickers = [a["ticker"] for a in audits if a.get("is_clean_all") is True]
    return sorted(set(tickers))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=0, help="0 = all clean_all")
    ap.add_argument("--force", action="store_true", help="ignore 30-day skip rule")
    ap.add_argument("--only", type=str, default=None, help="comma-sep tickers to process only")
    args = ap.parse_args()

    load_caches()

    if args.only:
        tickers = [t.strip().upper() for t in args.only.split(",") if t.strip()]
    else:
        tickers = load_clean_all_tickers()
        if args.limit:
            tickers = tickers[: args.limit]

    print(f"[refetch-logos-660] universe size: {len(tickers)} | workers: {args.workers}")

    started_at = datetime.now(timezone.utc).isoformat()
    results: list[dict] = []
    counters = {"replaced": 0, "skip": 0, "no_candidate": 0, "normalize_fail": 0, "other": 0}
    sources: dict[str, int] = {}
    failed: list[str] = []

    def _record(r: dict):
        with _stats_lock:
            results.append(r)
            action = r.get("action") or "other"
            reason = r.get("reason") or ""
            if action == "replaced":
                counters["replaced"] += 1
                s = r.get("source") or "unknown"
                sources[s] = sources.get(s, 0) + 1
            elif action == "skip" and "recent" in reason:
                counters["skip"] += 1
            elif reason == "no_candidate":
                counters["no_candidate"] += 1
                failed.append(r["ticker"])
            elif reason == "normalize_fail":
                counters["normalize_fail"] += 1
                failed.append(r["ticker"])
            else:
                counters["other"] += 1
                if action != "replaced":
                    failed.append(r["ticker"])

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_ticker, t, args.force): t for t in tickers}
        done = 0
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                r = fut.result()
            except Exception as e:
                r = {"ticker": t, "action": "error", "reason": f"exc: {e!r}"}
            _record(r)
            done += 1
            if done % 25 == 0 or done == len(tickers):
                print(
                    f"  progress: {done}/{len(tickers)} "
                    f"replaced={counters['replaced']} skip={counters['skip']} "
                    f"no_cand={counters['no_candidate']} norm_fail={counters['normalize_fail']}",
                    flush=True,
                )

    save_caches()

    status = {
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "universe": "clean_all V1.9.5",
        "universe_size": len(tickers),
        "logos_fetched": counters["replaced"],
        "skipped_recent": counters["skip"],
        "failed_no_candidate": counters["no_candidate"],
        "failed_normalize": counters["normalize_fail"],
        "other": counters["other"],
        "sources": sources,
        "target_dimensions": f"{TARGET_SIZE}x{TARGET_SIZE}",
        "background_color": "#050505",
        "failed": failed,
        "date": datetime.now(timezone.utc).isoformat(),
    }
    STATUS_PATH.write_text(json.dumps(status, indent=2))
    print(f"\n[refetch-logos-660] DONE → {STATUS_PATH.relative_to(ROOT)}")
    print(
        f"  replaced={counters['replaced']} skip={counters['skip']} "
        f"no_candidate={counters['no_candidate']} normalize_fail={counters['normalize_fail']} other={counters['other']}"
    )
    print(f"  sources: {sources}")


if __name__ == "__main__":
    main()
