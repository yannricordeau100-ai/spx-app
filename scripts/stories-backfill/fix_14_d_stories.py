#!/usr/bin/env python3
"""
fix_14_d_stories.py — Fix residual d_stories failures for 14 tickers.
Calls Cerebras Qwen-3 to generate enough stories to reach the threshold.
"""
import json
import sys
import time
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
sys.path.insert(0, str(ROOT / "scripts/stories-backfill"))

# Import functions from scaleup_532_stories.py
import importlib.util
spec = importlib.util.spec_from_file_location(
    "scaleup", ROOT / "scripts/stories-backfill/scaleup_532_stories.py"
)
scaleup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scaleup)

# The 14 failing d_stories tickers (from current audit)
TARGETS = [
    "a2a.mi", "aal.l", "ackb.br", "aed.br", "air.pa",
    "bats.l", "bei.de", "bnzl.l", "bpe.mi", "dbk.de",
    "dsy.pa", "hwdn.l", "kbc.br", "pub.pa",
]

def main():
    throttle_state = {"last_call": {0: 0, 1: 0, 2: 0}, "429_at": {0: 0, 1: 0, 2: 0}}

    results = []
    for i, ticker in enumerate(TARGETS):
        print(f"\n[{i+1}/{len(TARGETS)}] {ticker} ...", flush=True)
        try:
            r = scaleup.process_ticker(ticker, 0, throttle_state)
            results.append(r)
            if r.get("skipped"):
                print(f"  SKIP: {r.get('reason', 'already ok')}")
            elif r.get("error"):
                print(f"  ERROR: {r['error']}")
                # Try key 1 as fallback
                time.sleep(5)
                r2 = scaleup.process_ticker(ticker, 1, throttle_state)
                if not r2.get("error"):
                    results[-1] = r2
                    print(f"  RETRY key1 OK: added={r2.get('added')}")
            else:
                print(f"  OK: {r.get('before')} → {r.get('after')} (added {r.get('added')})")
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            results.append({"ticker": ticker, "error": str(e)})
        time.sleep(4)  # Throttle

    print("\n=== SUMMARY ===")
    for r in results:
        t = r.get("ticker", "?")
        if r.get("skipped"):
            print(f"  {t}: SKIP ({r.get('reason', 'ok')})")
        elif r.get("error"):
            print(f"  {t}: ERROR ({r['error'][:60]})")
        else:
            print(f"  {t}: {r.get('before')} → {r.get('after')} (+{r.get('added')})")

if __name__ == "__main__":
    main()
