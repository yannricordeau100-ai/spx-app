#!/usr/bin/env python3
"""
refresh-last-data-date-all.py — Update last_data_date sur le hero KPI de
toutes les stés Pass 3 publishable via yfinance (mostRecentQuarter +
earnings calendar).

Pour chaque sté :
1. Call yfinance.Ticker(ticker).info
2. Récupérer 'mostRecentQuarter' (datetime de fin Q dernier earning)
3. Update v2-pipeline-enrich/<t>.json :
   - _hero_last_data_date_refreshed_at: ISO now
   - hero_last_data_date_override: <date>
4. Update v1-7-public.json en bulk après (rebuild).

NOTE : yfinance n'est pas une API officielle, mais c'est gratuit + fiable
pour les top 1000 tickers US. EU tickers (.PA, .DE, .L) ont une couverture
partielle.
"""
import json, os, sys, glob
from pathlib import Path
from datetime import datetime, timezone

try:
    import yfinance as yf
except ImportError:
    print("[fatal] pip install yfinance")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

def main():
    audit = json.load(open(ROOT / "src/data/v1-9-pre-publication-audit.json"))
    tickers = [x['ticker'] for x in audit.get('audits', [])]
    print(f"Total Pass 3 publishable : {len(tickers)}")

    updated = 0
    failed = 0
    skipped = 0
    today = datetime.now(timezone.utc)

    for t in tickers:
        try:
            info = yf.Ticker(t).info
            mrq = info.get('mostRecentQuarter')
            if not mrq:
                skipped += 1
                continue
            d = datetime.fromtimestamp(mrq, tz=timezone.utc)
            date_str = d.strftime('%Y-%m-%d')
            # Skip if older than 12 months (probably stale)
            if (today - d).days > 365:
                skipped += 1
                continue

            ep = ENRICH / f"{t.lower()}.json"
            if ep.exists():
                e = json.load(ep.open())
            else:
                e = {'ticker': t.upper()}
            e['hero_last_data_date_override'] = date_str
            e['_hero_last_data_date_refreshed_at'] = today.isoformat()
            ep.write_text(json.dumps(e, ensure_ascii=False, indent=2))
            updated += 1
            if updated % 50 == 0:
                print(f"  {updated} updated...")
        except Exception as e:
            failed += 1
            if failed <= 5:
                print(f"  fail {t}: {e}")

    print(f"\nDONE. updated={updated} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
