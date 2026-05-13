#!/usr/bin/env python3
"""
fetch-logos-top307.py — fetch PNG logos for the 94 missing top 307 V1.8.

Stratégie :
1. Charge `logo-domain-overrides.json` pour mapping ticker → domain
2. Pour chaque ticker manquant : essaye dans l'ordre :
   - override domain → Clearbit logo API
   - override domain → Google favicons s2 sz=128
   - yfinance.info[website] → Clearbit
   - yfinance.info[website] → Google favicons
3. Écrit `public/logos/<TICKER>.png` (replace . par -)
4. 1 proc, sleep 1s entre tickers (réseau seulement), no LLM, RAM ~50MB max

Usage :
    /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 scripts/fetch-logos-top307.py
"""
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOGOS = PROJECT_ROOT / "public/logos"
OVERRIDES = PROJECT_ROOT / "src/data/logo-domain-overrides.json"
PENDING = Path("/tmp/logos-pending-top307.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-logos.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
SLEEP = 1.0


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def safe_filename(t):
    return t.upper().replace(".", "-")


def fetch_bytes(url, timeout=8):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as r:
            data = r.read()
            ct = r.headers.get("content-type", "")
            if data and len(data) > 200 and "image" in ct.lower():
                return data
    except Exception:
        return None
    return None


def fetch_yf_website(ticker):
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info or {}
        site = info.get("website") or info.get("website_url")
        if not site:
            return None
        s = site.lower().replace("https://", "").replace("http://", "").replace("www.", "")
        s = s.split("/")[0].split("?")[0].strip()
        return s if "." in s else None
    except Exception:
        return None


def try_domain(domain):
    """Try Clearbit then Google favicons. Returns bytes or None."""
    if not domain:
        return None
    # Clearbit
    data = fetch_bytes(f"https://logo.clearbit.com/{domain}?size=256")
    if data:
        return data
    # Google s2 favicons
    data = fetch_bytes(f"https://www.google.com/s2/favicons?domain={domain}&sz=128")
    if data and len(data) > 500:  # google returns small default for unknown
        return data
    return None


def main():
    overrides = {}
    if OVERRIDES.exists():
        try:
            overrides = json.loads(OVERRIDES.read_text())
        except Exception:
            pass

    if not PENDING.exists():
        log_line(f"❌ {PENDING} introuvable")
        sys.exit(1)
    tickers = [l.strip() for l in PENDING.read_text().splitlines() if l.strip()]

    LOGOS.mkdir(parents=True, exist_ok=True)
    log_line(f"START : {len(tickers)} logos top 307 (sleep {SLEEP}s)")

    written = 0
    fails = []
    skipped = 0
    last = 0.0
    for i, tk in enumerate(tickers):
        elapsed = time.time() - last
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)
        last = time.time()

        fname = LOGOS / f"{safe_filename(tk)}.png"
        if fname.exists() and fname.stat().st_size > 200:
            skipped += 1
            continue

        # 1) override domain
        domain = overrides.get(tk.upper())
        data = try_domain(domain) if domain else None
        src = "override" if data else None

        # 2) yfinance website
        if not data:
            d2 = fetch_yf_website(tk)
            if d2:
                data = try_domain(d2)
                src = f"yf:{d2}" if data else None

        if data:
            fname.write_bytes(data)
            written += 1
            log_line(f"  ✅ {tk} ({len(data)//1024}KB, {src})")
        else:
            fails.append(tk)
            log_line(f"  ❌ {tk}")

        if (i + 1) % 20 == 0:
            log_line(f"  📊 [{i+1}/{len(tickers)}] written={written} skipped={skipped} fails={len(fails)}")

    log_line(f"END : written={written} skipped={skipped} fails={len(fails)}")
    if fails:
        log_line(f"Fails : {', '.join(fails[:30])}")


if __name__ == "__main__":
    main()
