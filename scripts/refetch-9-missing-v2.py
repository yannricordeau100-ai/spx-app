#!/usr/bin/env python3
"""
refetch-9-missing-v2.py — Refetch 9 HD REAL LOGOS (not banners) via Wikipedia P154.

Strategy:
  1. Wikipedia summary endpoint returns 'originalimage' which IS the company logo
     for company pages (e.g. Apple_Inc., Petrobras, etc.). High-res, transparent.
  2. Wikidata SPARQL fallback: lookup company entity then P154 (logo image).
  3. Last resort: apple-touch-icon, og:image (may be a banner — still better than nothing).

Validates PNG >=128x128, brightness 8-248 (transparent logos can be darker).
Saves to public/logos/<TICKER>.png at 256x256 RGBA, transparent canvas.
"""

from __future__ import annotations

import io
import sys
import urllib.parse
from pathlib import Path

import requests
from PIL import Image
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "logos"

# Ticker -> (Wikipedia page title, domain fallback)
TICKER_META = {
    "AAPL":   ("Apple_Inc.",                  "apple.com"),
    "LAND-L": ("Land_Securities",             "landsec.com"),
    "PBR":    ("Petrobras",                   "petrobras.com.br"),
    "PM":     ("Philip_Morris_International", "pmi.com"),
    "PSKY":   ("Paramount_Skydance",          "paramount.com"),
    "PVH":    ("PVH_(company)",               "pvh.com"),
    "RIVN":   ("Rivian",                      "rivian.com"),
    "XYZ":    ("Block,_Inc.",                 "block.xyz"),
}

# Both filename variants (dash + dot for foreign tickers)
FILENAME_VARIANTS = {
    "AAPL":   ["AAPL.png"],
    "LAND-L": ["LAND-L.png", "LAND.L.png"],
    "PBR":    ["PBR.png"],
    "PM":     ["PM.png"],
    "PSKY":   ["PSKY.png"],
    "PVH":    ["PVH.png"],
    "RIVN":   ["RIVN.png"],
    "XYZ":    ["XYZ.png"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Mettrik-Logo-Refetch/2.0 (yannricordeau100@gmail.com)",
    "Accept": "image/png,image/svg+xml,image/*,*/*;q=0.8",
}
TIMEOUT = 20
TARGET_SIZE = 256

session = requests.Session()
session.headers.update(HEADERS)


def validate_image(data: bytes) -> tuple[bool, str, Image.Image | None]:
    if not data or len(data) < 300:
        return False, f"too small ({len(data)}B)", None
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:
        return False, f"not an image: {e}", None
    w, h = img.size
    if w < 64 or h < 64:
        return False, f"too small {w}x{h}", None
    # Brightness check, ignoring fully transparent pixels (logos are often pure black on alpha 0)
    rgba = img.convert("RGBA")
    s = 0
    n = 0
    transparent = 0
    total = w * h
    for p in rgba.getdata():
        r, g, b, a = p
        if a < 16:
            transparent += 1
            continue
        s += r + g + b
        n += 1
    if n == 0:
        return False, "fully transparent", None
    avg = s / (3 * n) if n else 0
    visible_ratio = n / total
    # if mostly transparent (logo on transparent bg), accept any non-empty
    if visible_ratio < 0.05:
        return False, f"too sparse (visible={visible_ratio:.2%})", None
    if avg < 8 and visible_ratio > 0.7:
        return False, f"too dark (mean={avg:.1f}, visible={visible_ratio:.0%})", None
    if avg > 250 and visible_ratio > 0.7:
        return False, f"too white (mean={avg:.1f}, visible={visible_ratio:.0%})", None
    return True, f"ok ({w}x{h}, mean={avg:.1f}, visible={visible_ratio:.0%})", img


def normalize_save(img: Image.Image, paths: list[Path]) -> None:
    img = img.convert("RGBA")
    w, h = img.size
    if max(w, h) != TARGET_SIZE:
        scale = TARGET_SIZE / max(w, h)
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        img = img.resize((nw, nh), Image.LANCZOS)
        w, h = nw, nh
    canvas = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
    canvas.paste(img, ((TARGET_SIZE - w) // 2, (TARGET_SIZE - h) // 2), img)
    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(p, "PNG", optimize=True)


def fetch(url: str) -> bytes | None:
    try:
        r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 200 and r.content:
            return r.content
    except Exception as e:
        print(f"      fetch error: {e}", file=sys.stderr)
    return None


def wikipedia_logo(page_title: str) -> tuple[str, bytes] | None:
    """Return (source_url, image_bytes) for the Wikipedia infobox logo."""
    # Approach 1: REST summary endpoint -> originalimage
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(page_title)}"
    try:
        r = session.get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            orig = (d.get("originalimage") or {}).get("source")
            if orig and ("logo" in orig.lower() or "_(logo)" in orig.lower() or "/commons/" in orig):
                data = fetch(orig)
                if data:
                    return (orig, data)
            # Try thumbnail if originalimage missing
            if orig:
                data = fetch(orig)
                if data:
                    return (orig, data)
    except Exception as e:
        print(f"      wiki-summary error: {e}", file=sys.stderr)

    # Approach 2: Page Images API (pageimages prop)
    url = (
        "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages"
        f"&piprop=original&titles={urllib.parse.quote(page_title)}"
    )
    try:
        r = session.get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            pages = (d.get("query") or {}).get("pages") or {}
            for _, p in pages.items():
                orig = (p.get("original") or {}).get("source")
                if orig:
                    data = fetch(orig)
                    if data:
                        return (orig, data)
    except Exception as e:
        print(f"      wiki-api error: {e}", file=sys.stderr)
    return None


def wikidata_logo(page_title: str) -> tuple[str, bytes] | None:
    """Use Wikidata SPARQL: page -> Q -> P154 (logo image) -> Commons URL."""
    # Get Q id via Wikipedia API
    url = (
        "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops"
        f"&ppprop=wikibase_item&titles={urllib.parse.quote(page_title)}"
    )
    try:
        r = session.get(url, timeout=TIMEOUT)
        d = r.json()
        pages = (d.get("query") or {}).get("pages") or {}
        qid = None
        for _, p in pages.items():
            qid = (p.get("pageprops") or {}).get("wikibase_item")
            if qid:
                break
        if not qid:
            return None
    except Exception as e:
        print(f"      wikidata-q error: {e}", file=sys.stderr)
        return None

    # Wikidata entity -> claims -> P154 -> filename
    try:
        r = session.get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", timeout=TIMEOUT)
        d = r.json()
        ent = (d.get("entities") or {}).get(qid) or {}
        claims = (ent.get("claims") or {}).get("P154") or []
        if not claims:
            return None
        filename = claims[0]["mainsnak"]["datavalue"]["value"]
        # Commons Special:FilePath -> direct image
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}?width=512"
        data = fetch(url)
        if data:
            return (url, data)
    except Exception as e:
        print(f"      wikidata-p154 error: {e}", file=sys.stderr)
    return None


def apple_touch(domain: str) -> tuple[str, bytes] | None:
    for path in ("apple-touch-icon.png", "apple-touch-icon-precomposed.png"):
        for prefix in ("https://www.", "https://"):
            url = f"{prefix}{domain}/{path}"
            data = fetch(url)
            if data and len(data) > 500:
                return (url, data)
    return None


def google_favicon(domain: str, sz: int = 256) -> tuple[str, bytes] | None:
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz={sz}"
    data = fetch(url)
    if data and len(data) > 500:
        return (url, data)
    return None


def process_ticker(ticker: str) -> dict:
    page, domain = TICKER_META[ticker]
    print(f"\n=== {ticker} (wiki: {page}, domain: {domain}) ===")
    attempts = []

    # 1. Wikidata P154 (THE official logo property — try first)
    print(f"  [1/4] Wikidata P154 (official logo)")
    res = wikidata_logo(page)
    if res:
        url, data = res
        ok, info, img = validate_image(data)
        attempts.append(("wikidata-p154", url, info))
        print(f"        -> {url[:90]}")
        print(f"        -> validation: {info}")
        if ok:
            out = [LOGOS_DIR / fn for fn in FILENAME_VARIANTS[ticker]]
            normalize_save(img, out)
            print(f"        SAVED: {[str(p.name) for p in out]}")
            return {"ticker": ticker, "ok": True, "source": "wikidata-p154", "url": url, "info": info, "attempts": attempts}

    # 2. Wikipedia originalimage (may be infobox logo, sometimes a building photo)
    print(f"  [2/4] Wikipedia summary/pageimages")
    res = wikipedia_logo(page)
    if res:
        url, data = res
        # Heuristic: skip if URL clearly shows non-logo content
        bad_keywords = ["sede", "building", "headquarters", "campus", "lausanne", "lights", "store"]
        ulow = url.lower()
        if any(k in ulow for k in bad_keywords):
            print(f"        -> SKIP (URL looks like a photo, not a logo): {url[:90]}")
            attempts.append(("wikipedia-skip", url, "looks like a photo not a logo"))
        else:
            ok, info, img = validate_image(data)
            attempts.append(("wikipedia", url, info))
            print(f"        -> {url[:90]}")
            print(f"        -> validation: {info}")
            if ok:
                out = [LOGOS_DIR / fn for fn in FILENAME_VARIANTS[ticker]]
                normalize_save(img, out)
                print(f"        SAVED: {[str(p.name) for p in out]}")
                return {"ticker": ticker, "ok": True, "source": "wikipedia", "url": url, "info": info, "attempts": attempts}

    # 3. apple-touch
    print(f"  [3/4] apple-touch-icon")
    res = apple_touch(domain)
    if res:
        url, data = res
        ok, info, img = validate_image(data)
        attempts.append(("apple-touch", url, info))
        print(f"        -> {url[:90]}")
        print(f"        -> validation: {info}")
        if ok:
            out = [LOGOS_DIR / fn for fn in FILENAME_VARIANTS[ticker]]
            normalize_save(img, out)
            print(f"        SAVED: {[str(p.name) for p in out]}")
            return {"ticker": ticker, "ok": True, "source": "apple-touch", "url": url, "info": info, "attempts": attempts}

    # 4. Google s2 favicon
    print(f"  [4/4] Google s2 favicons (sz=256)")
    res = google_favicon(domain, 256)
    if res:
        url, data = res
        ok, info, img = validate_image(data)
        attempts.append(("google-s2-256", url, info))
        print(f"        -> {url[:90]}")
        print(f"        -> validation: {info}")
        if ok:
            out = [LOGOS_DIR / fn for fn in FILENAME_VARIANTS[ticker]]
            normalize_save(img, out)
            print(f"        SAVED: {[str(p.name) for p in out]}")
            return {"ticker": ticker, "ok": True, "source": "google-s2", "url": url, "info": info, "attempts": attempts}

    return {"ticker": ticker, "ok": False, "source": None, "url": None, "info": "all sources failed", "attempts": attempts}


def main():
    tickers = ["AAPL", "LAND-L", "PBR", "PM", "PSKY", "PVH", "RIVN", "XYZ"]
    results = []
    for t in tickers:
        results.append(process_ticker(t))

    print("\n\n=== SUMMARY ===")
    ok = [r for r in results if r["ok"]]
    fail = [r for r in results if not r["ok"]]
    print(f"OK: {len(ok)}/{len(results)}")
    for r in ok:
        print(f"  {r['ticker']:8s} -> {r['source']:15s} {r['info']}")
        print(f"           {r['url']}")
    if fail:
        print(f"\nFAIL: {len(fail)}")
        for r in fail:
            print(f"  {r['ticker']:8s} attempts:")
            for s, u, i in r["attempts"]:
                print(f"      {s:15s} {i} | {u}")

    return 0 if len(fail) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
