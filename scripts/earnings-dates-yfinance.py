#!/usr/bin/env python3
"""
Récup next_earnings_date via yfinance.calendar pour toutes stés validées.
Async-like via ThreadPoolExecutor (yfinance is blocking).
Coût $0, ETA ~5 min pour 1000+ stés.
"""
import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date
from pathlib import Path

import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src/data/v2-pipeline"


def fetch_earnings_date(ticker: str) -> tuple[str, str | None, str | None]:
    """Retourne (ticker, next_earnings_date, last_earnings_date)."""
    try:
        cal = yf.Ticker(ticker).calendar
        if cal is None or not isinstance(cal, dict):
            return ticker, None, None
        ed = cal.get("Earnings Date")
        if isinstance(ed, list) and ed:
            ed = ed[0]
        if isinstance(ed, (datetime, date, pd.Timestamp)):
            return ticker, ed.strftime("%Y-%m-%d"), None
        return ticker, None, None
    except Exception:
        return ticker, None, None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=20)
    args = p.parse_args()

    # Toutes stés validées
    tickers = []
    for f in OUT_DIR.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n: continue
        try: d = json.loads(f.read_text())
        except: continue
        if "_validation" not in d: continue
        tickers.append(n[:-5].upper())
    if args.limit: tickers = tickers[:args.limit]

    print(f"Earnings dates : {len(tickers)} stés, {args.workers} threads")
    t0 = time.time()
    updated = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(fetch_earnings_date, tk): tk for tk in tickers}
        for i, fut in enumerate(as_completed(futs)):
            tk, next_ed, _ = fut.result()
            if next_ed:
                json_path = OUT_DIR / f"{tk.lower()}.json"
                if json_path.exists():
                    try:
                        d = json.loads(json_path.read_text())
                        d["next_earnings_date"] = next_ed
                        json_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
                        updated += 1
                    except: pass
            if (i+1) % 100 == 0:
                print(f"  {i+1}/{len(tickers)} ({time.time()-t0:.0f}s)")
    print(f"DONE : {updated} stés avec next_earnings_date")


if __name__ == "__main__":
    main()
