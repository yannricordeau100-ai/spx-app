#!/usr/bin/env python3
"""
FMP ETF holdings : pour chaque ticker, récupère la liste des ETF qui le détiennent.
Plan Starter $14 requis (FMP_PAID_API_KEY).

Endpoint : /stable/etf-holder?symbol=X
Output : src/data/etf-holdings/<ticker>.json
Format :
  {
    "ticker": "AAPL",
    "fetched_at": "...",
    "holders": [
      {"asset": "QQQ", "name": "...", "weight_pct": 12.5, "shares": ...},
      ...
    ]
  }
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
OUT_DIR = ROOT / "src/data/etf-holdings"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/fmp-etf-holdings.log"

KEY = None
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("FMP_PAID_API_KEY="):
            KEY = line.split("=", 1)[1].strip()
            break

if not KEY:
    print("[fatal] FMP_PAID_API_KEY not found", file=sys.stderr)
    sys.exit(1)

BASE = "https://financialmodelingprep.com/stable"
THREADS = 8
RATE_LIMIT_CALLS_PER_MIN = 280


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def fetch_one(ticker: str) -> dict:
    out = OUT_DIR / f"{ticker.lower()}.json"
    if out.exists():
        return {"ticker": ticker, "status": "skip", "n": 0}

    # Essayer plusieurs endpoints (FMP a plusieurs noms)
    for endpoint in ["etf-holder", "etf-holdings", "institutional-holder"]:
        url = f"{BASE}/{endpoint}?symbol={ticker}&apikey={KEY}"
        try:
            r = requests.get(url, timeout=30)
            if r.status_code != 200:
                continue
            data = r.json()
            if isinstance(data, list) and data:
                holders = []
                for item in data[:50]:  # top 50 holders
                    holders.append({
                        "asset": item.get("asset") or item.get("symbol") or item.get("holder"),
                        "name": item.get("name") or item.get("holderName"),
                        "weight_pct": item.get("weightPercentage") or item.get("weight"),
                        "shares": item.get("shares") or item.get("sharesNumber"),
                    })
                payload = {
                    "ticker": ticker.upper(),
                    "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "endpoint_used": endpoint,
                    "holders": holders,
                }
                out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
                return {"ticker": ticker, "status": "ok", "n": len(holders), "endpoint": endpoint}
        except Exception:
            continue

    return {"ticker": ticker, "status": "no_data", "n": 0}


def load_tickers() -> list[str]:
    src = ROOT / "src/data/v1-7-tickers-sorted.json"
    if src.exists():
        d = json.loads(src.read_text())
        if isinstance(d, list):
            return [t.upper() for t in d]
    return []


def main():
    tickers = load_tickers()
    log(f"START ETF holdings : {len(tickers)} tickers, {THREADS} threads")
    counts = {"ok": 0, "skip": 0, "no_data": 0}
    t0 = time.time()
    rate_token_interval = 60.0 / RATE_LIMIT_CALLS_PER_MIN

    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = {}
        for tk in tickers:
            futures[ex.submit(fetch_one, tk)] = tk
            time.sleep(rate_token_interval / THREADS)
        for i, fut in enumerate(as_completed(futures)):
            try:
                r = fut.result()
            except Exception as e:
                continue
            counts[r["status"]] = counts.get(r["status"], 0) + 1
            if r["status"] == "ok":
                log(f"   ✅ {r['ticker']} : {r['n']} holders ({r.get('endpoint')})")
            if (i + 1) % 50 == 0:
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(tickers) - i - 1) / rate if rate > 0 else 0
                log(f"   [{i+1}/{len(tickers)}] ok={counts['ok']} skip={counts['skip']} no_data={counts['no_data']} (ETA {eta/60:.1f}min)")
    log(f"END ETF holdings : {counts}")


if __name__ == "__main__":
    main()
