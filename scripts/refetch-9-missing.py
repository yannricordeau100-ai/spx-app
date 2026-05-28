#!/usr/bin/env python3
"""
refetch-9-missing.py — Refetch 9 HD logos previously corrupted (all-black PNGs).

Targets: AAPL, LAND-L, LAND.L, PBR, PM, PSKY, PVH, RIVN, XYZ
Sources tried in order: Brandfetch CDN, Clearbit, og:image, apple-touch-icon, Google s2.
Validation: PNG, >=64x64 (sips upscale to 256), brightness 15-245 mean.
Saves to public/logos/<TICKER>.png with both dash and dot filename conventions.
"""

from __future__ import annotations

import io
import os
import re
import sys
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "logos"

# Manual ticker -> domain map (explicit, per prompt)
TICKER_DOMAIN = {
    "AAPL": "apple.com",
    "LAND-L": "landsec.com",
    "LAND.L": "landsec.com",
    "PBR": "petrobras.com.br",
    "PM": "pmi.com",
    "PSKY": "paramount.com",
    "PVH": "pvh.com",
    "RIVN": "rivian.com",
    "XYZ": "block.xyz",
}

# Both filename variants needed (dash + dot)
FILENAME_VARIANTS = {
    "AAPL": ["AAPL.png"],
    "LAND-L": ["LAND-L.png", "LAND.L.png"],
    "LAND.L": ["LAND-L.png", "LAND.L.png"],
    "PBR": ["PBR.png"],
    "PM": ["PM.png"],
    "PSKY": ["PSKY.png"],
    "PVH": ["PVH.png"],
    "RIVN": ["RIVN.png"],
    "XYZ": ["XYZ.png"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Accept": "image/png,image/*,*/*;q=0.8",
}
TIMEOUT = 15
TARGET_SIZE = 256

session = requests.Session()
session.headers.update(HEADERS)


def validate_png(data: bytes) -> tuple[bool, str, Image.Image | None]:
    """Return (ok, reason, image)."""
    if not data or len(data) < 200:
        return False, f"too small ({len(data)}B)", None
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:
        return False, f"not an image: {e}", None
    w, h = img.size
    if w < 32 or h < 32:
        return False, f"too small {w}x{h}", None
    # brightness check (on RGB, ignoring transparency)
    rgb = img.convert("RGB")
    pixels = list(rgb.getdata())
    n = len(pixels)
    avg = sum(p[0] + p[1] + p[2] for p in pixels) / (3 * n)
    if avg < 15:
        return False, f"too dark (mean={avg:.1f})", None
    if avg > 245:
        return False, f"too white (mean={avg:.1f})", None
    return True, f"ok ({w}x{h}, mean={avg:.1f})", img


def normalize_save(img: Image.Image, paths: list[Path]) -> None:
    """Resize to TARGET_SIZE preserving aspect, transparent background."""
    img = img.convert("RGBA")
    w, h = img.size
    if max(w, h) != TARGET_SIZE:
        scale = TARGET_SIZE / max(w, h)
        nw, nh = int(w * scale), int(h * scale)
        img = img.resize((nw, nh), Image.LANCZOS)
        w, h = nw, nh
    # pad to square with transparent bg
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


def candidates_for(domain: str) -> list[tuple[str, str]]:
    """Return list of (source_label, url) to try in order."""
    return [
        ("brandfetch-400", f"https://cdn.brandfetch.io/{domain}/w/400/h/400"),
        ("brandfetch-logo", f"https://cdn.brandfetch.io/{domain}/logo"),
        ("clearbit-256", f"https://logo.clearbit.com/{domain}?size=256"),
        ("clearbit", f"https://logo.clearbit.com/{domain}"),
        ("apple-touch", f"https://{domain}/apple-touch-icon.png"),
        ("apple-touch-precomposed", f"https://{domain}/apple-touch-icon-precomposed.png"),
        ("google-s2-128", f"https://www.google.com/s2/favicons?domain={domain}&sz=128"),
        ("google-s2-256", f"https://www.google.com/s2/favicons?domain={domain}&sz=256"),
    ]


def scrape_og_image(domain: str) -> str | None:
    for scheme in ("https", "http"):
        try:
            r = session.get(f"{scheme}://{domain}/", timeout=TIMEOUT, allow_redirects=True)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            for prop in ("og:image", "og:image:url", "twitter:image"):
                tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
                if tag and tag.get("content"):
                    url = tag["content"]
                    if url.startswith("//"):
                        url = "https:" + url
                    elif url.startswith("/"):
                        url = f"{scheme}://{domain}" + url
                    return url
            # Also try apple-touch link in HTML
            for rel in ("apple-touch-icon", "apple-touch-icon-precomposed", "icon"):
                tag = soup.find("link", rel=lambda v: v and rel in (v if isinstance(v, list) else [v]))
                if tag and tag.get("href"):
                    href = tag["href"]
                    if href.startswith("//"):
                        href = "https:" + href
                    elif href.startswith("/"):
                        href = f"{scheme}://{domain}" + href
                    elif not href.startswith("http"):
                        href = f"{scheme}://{domain}/" + href
                    return href
            return None
        except Exception as e:
            print(f"      scrape error: {e}", file=sys.stderr)
            continue
    return None


def process_ticker(ticker: str) -> dict:
    domain = TICKER_DOMAIN[ticker]
    print(f"\n=== {ticker} ({domain}) ===")
    cands = candidates_for(domain)
    # also dynamically add og:image
    og_url = scrape_og_image(domain)
    if og_url:
        cands.insert(2, ("og:image", og_url))
        print(f"  og:image found -> {og_url[:80]}")
    for label, url in cands:
        print(f"  trying {label}: {url[:90]}")
        data = fetch(url)
        if not data:
            print(f"    -> no data")
            continue
        ok, reason, img = validate_png(data)
        if not ok:
            print(f"    -> invalid: {reason}")
            continue
        print(f"    -> VALID {reason}")
        out_paths = [LOGOS_DIR / fn for fn in FILENAME_VARIANTS[ticker]]
        normalize_save(img, out_paths)
        sizes = [p.stat().st_size for p in out_paths]
        print(f"    saved: {[str(p.relative_to(ROOT)) for p in out_paths]} ({sizes}B)")
        return {"ticker": ticker, "ok": True, "source": label, "url": url, "info": reason}
    return {"ticker": ticker, "ok": False, "source": None, "url": None, "info": "all sources failed"}


def main():
    tickers = ["AAPL", "LAND-L", "PBR", "PM", "PSKY", "PVH", "RIVN", "XYZ"]
    # LAND-L and LAND.L share file variants -> handled together via FILENAME_VARIANTS
    results = []
    for t in tickers:
        results.append(process_ticker(t))

    print("\n\n=== SUMMARY ===")
    ok = [r for r in results if r["ok"]]
    fail = [r for r in results if not r["ok"]]
    print(f"OK: {len(ok)}/{len(results)}")
    for r in ok:
        print(f"  {r['ticker']:8s} -> {r['source']:20s} {r['info']}")
    if fail:
        print(f"FAIL: {len(fail)}")
        for r in fail:
            print(f"  {r['ticker']:8s} -> {r['info']}")

    return 0 if len(fail) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
