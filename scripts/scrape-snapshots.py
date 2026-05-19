#!/usr/bin/env python3
"""scrape-snapshots.py — snapshot IR page + home page pour SP500 + top 307 V1.8.

Pour chaque ticker :
  1. yfinance.info → website URL (si pas en cache)
  2. GET <website>/ → home-page-snapshot/<YYYY-MM-DD>.html
  3. Probe paths IR communs (/investors, /investor-relations, etc.) → ir-page-snapshot/<YYYY-MM-DD>.html
  4. Idempotent : skip si snapshot du jour déjà présent
  5. Throttle + RAM safety (workers cap 5, règle SHARED-STATUS §14)

Le ticker → catégorie pour determiner output path :
  - Suffix EU (.PA/.DE/.L/.SW/.AS/.MI/...) → cat3-european/<TICKER>/
  - Sinon (US) → cat1-us/<TICKER>/  (ADR FPI = cat2 si listé dans fpi-tickers.json)

Yann 19 mai 2026.
Objectif : compléter les pages stés avec IR + home snapshot pour 673 stés
(audit du 19 mai : 308/673 IR + 0/673 home → cible 100%/100%).

Usage :
    python3 scripts/scrape-snapshots.py --tickers-file /tmp/cat5-scrape/union-sp500-top307.txt --workers 5
    python3 scripts/scrape-snapshots.py --tickers AAPL,MSFT  # test
"""
from __future__ import annotations
import argparse
import json
import os
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

try:
    import yfinance as yf
except ImportError:
    yf = None

ROOT = Path(__file__).resolve().parent.parent
SEC_DATA = ROOT / "sec-data"
LOG_DIR = Path("/tmp/cat5-scrape")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "snapshots.log"
STATE_FILE = LOG_DIR / "snapshots-state.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

EU_SUFFIXES = (".PA", ".DE", ".L", ".SW", ".AS", ".MI", ".MC", ".ST", ".CO", ".HE", ".OL", ".BR", ".VI", ".LS", ".IR", ".HK", ".T")

IR_PATHS = [
    "/investors", "/investor-relations", "/investor", "/en/investors", "/en/investor-relations",
    "/investors/", "/about/investor-relations", "/about-us/investors", "/about-us/investor-relations",
    "/investors/financial-reports", "/investors/results-reports", "/en/investors/financial-information",
    "/en-us/investors", "/en/about-us/investor-relations", "/fr/investisseurs", "/de/investoren",
    "/corporate/investors", "/company/investors", "/about/investors",
    "/investor-relations.html", "/investors.html",
]

_LOG_LOCK = threading.Lock()
_STATE_LOCK = threading.Lock()
_STATE = {"updated_at": "", "results": {}}


def log(msg: str):
    line = f"[{datetime.utcnow().isoformat()[:19]}Z] {msg}"
    with _LOG_LOCK:
        print(line, flush=True)
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")


def load_state():
    global _STATE
    if STATE_FILE.exists():
        try:
            _STATE = json.loads(STATE_FILE.read_text())
        except Exception:
            pass


def save_state():
    with _STATE_LOCK:
        _STATE["updated_at"] = datetime.utcnow().isoformat()
        STATE_FILE.write_text(json.dumps(_STATE, indent=2))


def update_state(ticker, **kwargs):
    with _STATE_LOCK:
        cur = _STATE["results"].get(ticker, {"ticker": ticker})
        cur.update(kwargs)
        _STATE["results"][ticker] = cur


def is_eu(ticker: str) -> bool:
    return any(ticker.upper().endswith(s) for s in EU_SUFFIXES)


def out_dir(ticker: str) -> Path:
    cat = "cat3-european" if is_eu(ticker) else "cat1-us"
    return SEC_DATA / cat / ticker.upper()


def http_get(url: str, timeout: int = 15) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, b"", {}
    except Exception:
        return 0, b"", {}


def get_website(ticker: str) -> str | None:
    """Récupère le website officiel de la sté via yfinance.info."""
    if yf is None:
        return None
    try:
        info = yf.Ticker(ticker).info
        return (info or {}).get("website")
    except Exception:
        return None


def snapshot_home(ticker: str, website: str) -> str | None:
    """Fetch home page HTML + save."""
    out = out_dir(ticker) / "home-page-snapshot"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    dest = out / f"{today}.html"
    if dest.exists():
        return str(dest)
    code, body, _ = http_get(website)
    if code != 200 or len(body) < 1000:
        return None
    out.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return str(dest)


def snapshot_ir(ticker: str, website: str) -> str | None:
    """Probe IR paths, save first one that returns 200 + non-trivial HTML."""
    out = out_dir(ticker) / "ir-page-snapshot"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    dest = out / f"{today}.html"
    if dest.exists():
        return str(dest)
    base = website.rstrip("/")
    for path in IR_PATHS:
        url = base + path
        code, body, _ = http_get(url)
        if code == 200 and len(body) >= 2000:
            txt = body.decode("utf-8", errors="ignore").lower()
            if any(kw in txt for kw in ("investor", "investisseur", "anleger", "shareholder", "results", "annual report")):
                out.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(body)
                return str(dest)
    return None


def process_ticker(ticker: str) -> dict:
    tk = ticker.strip().upper()
    if not tk:
        return {"ticker": tk, "status": "empty"}

    od = out_dir(tk)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    home_exists = (od / "home-page-snapshot" / f"{today}.html").exists()
    ir_exists = (od / "ir-page-snapshot" / f"{today}.html").exists()
    if home_exists and ir_exists:
        update_state(tk, status="skip-already-today")
        return {"ticker": tk, "status": "skip"}

    website = get_website(tk)
    if not website or not website.startswith("http"):
        log(f"{tk}: no website")
        update_state(tk, status="no-website")
        return {"ticker": tk, "status": "no-website"}

    home_path = snapshot_home(tk, website) if not home_exists else "exists"
    time.sleep(0.5)
    ir_path = snapshot_ir(tk, website) if not ir_exists else "exists"

    status_parts = []
    if home_path: status_parts.append("home-ok")
    else: status_parts.append("home-fail")
    if ir_path: status_parts.append("ir-ok")
    else: status_parts.append("ir-fail")

    status = "+".join(status_parts)
    update_state(tk, status=status, website=website)
    log(f"{tk}: {status}")
    return {"ticker": tk, "status": status}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", type=str)
    ap.add_argument("--tickers", type=str, help="Comma-separated")
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if args.tickers:
        targets = [t.strip().upper() for t in args.tickers.split(",")]
    elif args.tickers_file:
        targets = [l.strip().upper() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    else:
        print("--tickers-file or --tickers required"); sys.exit(1)

    if args.limit > 0:
        targets = targets[:args.limit]

    load_state()
    workers = max(1, min(5, args.workers))  # cap 5 RAM safety
    log(f"=== SNAPSHOT SCRAPER : {len(targets)} stés × (home + IR) avec {workers} workers ===")

    stats = {"ok": 0, "partial": 0, "no-website": 0, "skip": 0, "fail": 0}
    counter = [0]
    counter_lock = threading.Lock()

    def _run(tk):
        r = process_ticker(tk)
        with counter_lock:
            counter[0] += 1
            if counter[0] % 25 == 0:
                save_state()
                log(f"--- progress: {counter[0]}/{len(targets)} ---")
        return r

    with ThreadPoolExecutor(max_workers=workers) as exe:
        futures = {exe.submit(_run, tk): tk for tk in targets}
        for fut in as_completed(futures):
            try:
                r = fut.result()
                s = r.get("status", "")
                if "ok+ir-ok" in s or "home-ok+ir-ok" in s:
                    stats["ok"] += 1
                elif "skip" in s:
                    stats["skip"] += 1
                elif "no-website" in s:
                    stats["no-website"] += 1
                elif "ok" in s:
                    stats["partial"] += 1
                else:
                    stats["fail"] += 1
            except Exception as e:
                log(f"exception: {e}")
                stats["fail"] += 1

    save_state()
    log(f"=== DONE : {json.dumps(stats)} ===")


if __name__ == "__main__":
    main()
