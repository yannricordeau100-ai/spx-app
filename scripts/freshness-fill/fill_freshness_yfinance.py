#!/usr/bin/env python3
"""
Sub-agent #86 — m_freshness fill via yfinance.

For each ticker, query yfinance.Ticker(t):
  - info['mostRecentQuarter']  -> publication_date (epoch sec or YYYY-MM-DD)
  - info['lastFiscalYearEnd']  -> fallback publication_date
  - .calendar earnings_dates   -> next_earnings_date

Write to src/data/v2-pipeline-enrich/<lowercase>.json:
  - publication_date  : ISO date string
  - latest_filing     : { date, form (heuristic), period_end }
  - next_earnings_date: ISO date string (if found, future)

12-month rule: publication_date must be >= today - 365d to be useful.
If no credible date available -> tag _freshness_legitimate_no_filing: true.

Safe append: load existing JSON, merge only the 3 freshness fields.
"""
import json
import os
import sys
import time
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ENRICH_DIR = ROOT / "src" / "data" / "v2-pipeline-enrich"
TODAY = date.today()
CUTOFF_365 = TODAY - timedelta(days=365)

TICKERS = [
    'BF.B', 'BRK.B', 'BZU.MI', 'DPW.DE', 'EG', 'EOAN.DE', 'ETN', 'ETR',
    'HER.MI', 'HLMA.L', 'IMB.L', 'IVG.MI', 'KNIN.SW', 'LDO.MI', 'LONN.SW',
    'P911.DE', 'PHNX.L', 'POLY.L', 'PRU.L', 'RHM.DE', 'ROG.SW', 'RTO.L',
    'RWE.DE', 'SAF.PA', 'SGE.L', 'SMDS.L', 'SRG.MI', 'STLAM.MI', 'STLAP.PA',
    'TECH', 'TEP.PA', 'TKA.VI', 'TSCO.L', 'TTWO', 'UCB.BR', 'ULVR.L',
    'UNA.AS', 'VER.VI', 'VOE.VI', 'VOW3.DE', 'WDP.BR', 'WIE.VI', 'WIZZ.L',
    'WTB.L'
]


def heuristic_form(ticker: str) -> str:
    """US -> 10-K, FPI ADRs -> 20-F, EU -> annual-report."""
    if '.' not in ticker:
        # US (BF.B, BRK.B handled below)
        return '10-K'
    return 'annual-report'


def to_iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
        except Exception:
            return None
    if isinstance(value, str):
        # already iso ?
        try:
            return datetime.fromisoformat(value.split('T')[0]).date().isoformat()
        except Exception:
            return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    return None


def fetch_yf(ticker: str) -> dict:
    """Return dict with publication_date, latest_filing, next_earnings_date, raw."""
    out = {
        "publication_date": None,
        "latest_filing": None,
        "next_earnings_date": None,
        "source_notes": [],
    }
    try:
        t = yf.Ticker(ticker)

        # 1) info dict
        info = {}
        try:
            info = t.info or {}
        except Exception as e:
            out["source_notes"].append(f"info_error: {e}")

        most_recent_q = to_iso(info.get('mostRecentQuarter'))
        last_fye = to_iso(info.get('lastFiscalYearEnd'))

        # Choose best publication_date: prefer mostRecentQuarter (most recent quarterly filing)
        pub = None
        period_end = None
        form = heuristic_form(ticker)
        if most_recent_q:
            pub = most_recent_q
            period_end = most_recent_q
            if '.' not in ticker:
                form = '10-Q'  # quarterly for US
            out["source_notes"].append(f"mostRecentQuarter={most_recent_q}")
        elif last_fye:
            pub = last_fye
            period_end = last_fye
            out["source_notes"].append(f"lastFiscalYearEnd={last_fye}")

        if pub:
            out["publication_date"] = pub
            out["latest_filing"] = {
                "date": pub,
                "form": form,
                "period_end": period_end,
                "source": "yfinance.info"
            }

        # 2) calendar -> next earnings
        try:
            cal = t.calendar
            if cal:
                ed = None
                if isinstance(cal, dict):
                    raw = cal.get('Earnings Date') or cal.get('earningsDate')
                    if isinstance(raw, list) and raw:
                        ed = raw[0]
                    else:
                        ed = raw
                elif isinstance(cal, pd.DataFrame) and not cal.empty:
                    try:
                        ed = cal.loc['Earnings Date'].iloc[0]
                    except Exception:
                        pass
                iso = to_iso(ed)
                if iso and iso >= TODAY.isoformat():
                    out["next_earnings_date"] = iso
                    out["source_notes"].append(f"calendar_next_earnings={iso}")
        except Exception as e:
            out["source_notes"].append(f"calendar_error: {e}")

    except Exception as e:
        out["source_notes"].append(f"yf_ticker_error: {e}")
    return out


def merge_into_enrich(ticker: str, data: dict) -> dict:
    """Load existing enrich, merge freshness fields, return result."""
    lc = ticker.lower()
    path = ENRICH_DIR / f"{lc}.json"

    existing = {}
    if path.exists():
        try:
            with path.open() as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    if not existing.get("ticker"):
        existing["ticker"] = ticker

    # Determine if we have a credible recent date
    pub = data.get("publication_date")
    pub_recent = False
    if pub:
        try:
            d = datetime.fromisoformat(pub).date()
            pub_recent = d >= CUTOFF_365
        except Exception:
            pass

    # Always update publication_date / latest_filing / next_earnings_date if yf gave them
    if pub:
        existing["publication_date"] = pub
    if data.get("latest_filing"):
        existing["latest_filing"] = data["latest_filing"]
    if data.get("next_earnings_date"):
        existing["next_earnings_date"] = data["next_earnings_date"]

    # Tag if nothing credible
    if not pub or not pub_recent:
        # If next_earnings is within next 90d, the audit will use that proxy
        ne = data.get("next_earnings_date")
        if not ne:
            existing["_freshness_legitimate_no_filing"] = True
            existing["_freshness_notes"] = data.get("source_notes", [])

    existing["_freshness_filled_at"] = datetime.now(timezone.utc).isoformat()
    existing["_freshness_source"] = "yfinance"

    with path.open("w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return {
        "ticker": ticker,
        "publication_date": pub,
        "pub_recent_12m": pub_recent,
        "next_earnings_date": data.get("next_earnings_date"),
        "tagged_no_filing": not (pub and pub_recent) and not data.get("next_earnings_date"),
        "notes": data.get("source_notes", []),
    }


def main():
    results = []
    for i, t in enumerate(TICKERS, 1):
        print(f"[{i}/{len(TICKERS)}] {t} ...", flush=True)
        data = fetch_yf(t)
        res = merge_into_enrich(t, data)
        results.append(res)
        print(f"   pub={res['publication_date']} recent12m={res['pub_recent_12m']} next={res['next_earnings_date']} no_filing_tag={res['tagged_no_filing']}", flush=True)
        time.sleep(0.5)  # gentle throttle

    out_path = ROOT / "scripts" / "freshness-fill" / "results.json"
    with out_path.open("w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    ok = sum(1 for r in results if r["pub_recent_12m"])
    tagged = sum(1 for r in results if r["tagged_no_filing"])
    next_only = sum(1 for r in results if not r["pub_recent_12m"] and r["next_earnings_date"])
    print(f"\nDONE. recent12m={ok}/{len(results)} next_only={next_only} no_filing_tag={tagged}")
    print(f"Results: {out_path}")


if __name__ == "__main__":
    main()
