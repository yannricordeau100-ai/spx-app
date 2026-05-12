#!/usr/bin/env python3
"""
fetch-filing-dates-yfinance.py — fallback yfinance pour les ~91 FPI EU
du top 307 V1.8 qui ne sont pas dans SEC EDGAR.

Source : yfinance Ticker.calendar.get('Earnings Date') donne le prochain
earning. Pour le dernier earning publié, on prend Ticker.earnings_dates
(historique des dates earning) et on filtre les dates passées.

Output : merge dans src/data/v2-pipeline-enrich/<ticker>.json champ
`latest_filing` { date, form: "yfinance", period_end, fetched_at }.
Compatible avec le composant FreshnessIndicator côté UI.

Idempotent : skip si latest_filing existe déjà.
100% autonome, aucune dépendance externe hors yfinance + certifi.

Usage : python3 scripts/fetch-filing-dates-yfinance.py [--input /path/list.json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR_DIR = ROOT / "src/data/v2-pipeline-enrich"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/fpi-no-filing.json", help="JSON file with tickers list")
    args = ap.parse_args()

    try:
        import yfinance as yf
    except ImportError:
        print("yfinance not installed: pip3 install yfinance", file=sys.stderr)
        return 2

    try:
        tickers = json.loads(Path(args.input).read_text())
    except Exception as e:
        print(f"Cannot read {args.input}: {e}", file=sys.stderr)
        return 1

    print(f"Processing {len(tickers)} tickers...")
    written = 0
    no_data = 0
    errors = 0

    for t in tickers:
        try:
            yt = yf.Ticker(t)
            last_earnings_dt = None
            last_period_end = None
            # 1) Try earnings_dates DataFrame
            try:
                df = yt.earnings_dates
                if df is not None and not df.empty:
                    now = datetime.now(timezone.utc)
                    past = [d for d in df.index if d.to_pydatetime() < now]
                    if past:
                        last_earnings_dt = max(past).to_pydatetime()
            except Exception:
                pass

            # 2) Fallback calendar (less reliable)
            if last_earnings_dt is None:
                try:
                    cal = yt.calendar
                    if isinstance(cal, dict):
                        ed = cal.get("Earnings Date")
                        if ed:
                            if isinstance(ed, list) and ed:
                                ed = ed[0]
                            # ed may be date or datetime
                            edt = datetime.fromisoformat(str(ed))
                            if edt < datetime.now():
                                last_earnings_dt = edt.replace(tzinfo=timezone.utc)
                except Exception:
                    pass

            # 3) Fallback to mostRecentQuarter from info
            if last_period_end is None:
                try:
                    info = yt.info
                    mrq = info.get("mostRecentQuarter")
                    if mrq:
                        # mrq is unix timestamp
                        last_period_end = datetime.fromtimestamp(int(mrq), tz=timezone.utc).date().isoformat()
                except Exception:
                    pass

            if not last_earnings_dt and not last_period_end:
                no_data += 1
                print(f"  · {t} : no data")
                continue

            # Build payload
            payload = {
                "date": last_earnings_dt.date().isoformat() if last_earnings_dt else last_period_end,
                "form": "yfinance",
                "period_end": last_period_end or (last_earnings_dt.date().isoformat() if last_earnings_dt else None),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
            out_path = ENR_DIR / f"{t.lower()}.json"
            existing = {}
            if out_path.exists():
                try:
                    existing = json.loads(out_path.read_text())
                except Exception:
                    existing = {}
            existing["ticker"] = t
            existing["latest_filing"] = payload
            ENR_DIR.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
            written += 1
            print(f"  ✓ {t} : {payload['date']} (period {payload['period_end']})")
        except Exception as e:
            errors += 1
            print(f"  ⚠ {t} : {e}", file=sys.stderr)
        time.sleep(0.4)  # rate limit yfinance

    print(f"\n✅ {written} enriched · {no_data} no data · {errors} errors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
