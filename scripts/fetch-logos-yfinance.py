#!/usr/bin/env python3
"""
fetch-logos-yfinance.py — 2e passe logos pour les stés que la 1ère passe
TS (fetch-missing-logos.ts via Clearbit + favicons + heuristique domaine)
n'a pas pu résoudre.

Utilise yfinance pour récupérer `info["website"]` (domaine investor
relations officiel) puis tente Clearbit + Google favicons sur ce domaine.

Usage :
    python3 scripts/fetch-logos-yfinance.py [--limit N]

Idempotent : skip les tickers qui ont déjà un PNG dans public/logos/.
"""
import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
LOGOS = PROJECT_ROOT / "public/logos"
HARDCODED = {"GOOGL", "META", "MSCI", "SPGI", "CAT"}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def safe_filename(t):
    return t.upper().replace(".", "-")


def fetch(url, timeout=8):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def get_website(ticker):
    import yfinance as yf
    try:
        info = yf.Ticker(ticker).info or {}
        site = info.get("website") or info.get("website_url")
        if not site:
            return None
        # Strip protocol + path
        s = site.lower().replace("https://", "").replace("http://", "")
        s = s.split("/")[0].split("?")[0]
        if s.startswith("www."):
            s = s[4:]
        return s if "." in s else None
    except Exception:
        return None


def try_logo(domain):
    cb = fetch(f"https://logo.clearbit.com/{domain}")
    if cb and len(cb) > 1000:
        return cb
    fav = fetch(f"https://www.google.com/s2/favicons?domain={domain}&sz=128")
    if fav and len(fav) > 500:
        return fav
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    LOGOS.mkdir(parents=True, exist_ok=True)
    v17 = json.loads(V17.read_text())
    entries = list(v17.values())
    existing = {f.upper().replace(".PNG", "") for f in os.listdir(LOGOS) if f.lower().endswith(".png")}

    missing = []
    for e in entries:
        t = e.get("ticker") or ""
        if not t or t.upper() in HARDCODED:
            continue
        if safe_filename(t) in existing:
            continue
        missing.append(t)
    if args.limit:
        missing = missing[: args.limit]
    print(f"📊 Logos manquants : {len(missing)}")

    ok = 0
    fail = 0
    for i, t in enumerate(missing):
        domain = get_website(t)
        if not domain:
            fail += 1
            continue
        buf = try_logo(domain)
        if not buf:
            fail += 1
            continue
        out = LOGOS / f"{safe_filename(t)}.png"
        out.write_bytes(buf)
        ok += 1
        if (i + 1) % 25 == 0:
            print(f"  …{i+1}/{len(missing)} (ok={ok}, fail={fail})", flush=True)
        time.sleep(0.4)

    print(f"\n✅ {ok} logos téléchargés via yfinance website, ❌ {fail} échecs")


if __name__ == "__main__":
    main()
