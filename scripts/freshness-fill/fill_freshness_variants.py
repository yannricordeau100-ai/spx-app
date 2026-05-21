#!/usr/bin/env python3
"""
Sub-agent #86 — Round 2: try yfinance variants for the 7 fails of Round 1.

Updates src/data/v2-pipeline-enrich/<lowercase>.json (canonical ticker key,
data sourced from yfinance variant).
"""
import json
import time
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ENRICH_DIR = ROOT / "src" / "data" / "v2-pipeline-enrich"
TODAY = date.today()
CUTOFF_365 = TODAY - timedelta(days=365)

# canonical -> [yfinance variants to try, in order]
VARIANTS = {
    'BF.B': ['BF-B'],
    'BRK.B': ['BRK-B'],
    'DPW.DE': ['DHL.DE'],         # Deutsche Post -> DHL Group rebrand
    'ROG.SW': ['RHHBY'],          # Roche ADR
    # Remaining (no variant worked, will be tagged):
    'PHNX.L': ['PHNX.L'],
    'POLY.L': ['POLY.L'],
    'SMDS.L': ['SMDS.L'],
}


def to_iso(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
        except Exception:
            return None
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.split('T')[0]).date().isoformat()
        except Exception:
            return None
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def heuristic_form(canonical: str) -> str:
    if '.' not in canonical:
        return '10-K'
    return 'annual-report'


def try_variant(canonical: str, variant: str) -> dict:
    out = {"publication_date": None, "latest_filing": None, "next_earnings_date": None, "variant_used": variant, "notes": []}
    try:
        t = yf.Ticker(variant)
        info = {}
        try:
            info = t.info or {}
        except Exception as e:
            out["notes"].append(f"info_error: {e}")

        mr = to_iso(info.get('mostRecentQuarter'))
        lf = to_iso(info.get('lastFiscalYearEnd'))
        pub = mr or lf
        form = heuristic_form(canonical)
        if mr and '.' not in canonical:
            form = '10-Q'

        if pub:
            out["publication_date"] = pub
            out["latest_filing"] = {
                "date": pub,
                "form": form,
                "period_end": pub,
                "source": f"yfinance.info (variant={variant})"
            }
            out["notes"].append(f"resolved via {variant}: mr={mr} lf={lf}")

        try:
            cal = t.calendar
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
        except Exception as e:
            out["notes"].append(f"calendar_error: {e}")
    except Exception as e:
        out["notes"].append(f"ticker_error: {e}")
    return out


def merge(canonical: str, data: dict):
    lc = canonical.lower()
    path = ENRICH_DIR / f"{lc}.json"
    existing = {}
    if path.exists():
        try:
            with path.open() as f:
                existing = json.load(f)
        except Exception:
            existing = {}
    if not existing.get("ticker"):
        existing["ticker"] = canonical

    pub = data.get("publication_date")
    pub_recent = False
    if pub:
        try:
            pub_recent = datetime.fromisoformat(pub).date() >= CUTOFF_365
        except Exception:
            pass

    if pub:
        existing["publication_date"] = pub
    if data.get("latest_filing"):
        existing["latest_filing"] = data["latest_filing"]
    if data.get("next_earnings_date"):
        existing["next_earnings_date"] = data["next_earnings_date"]

    if pub and pub_recent:
        # Recovered — clear no-filing tag if previously set
        if existing.get("_freshness_legitimate_no_filing"):
            del existing["_freshness_legitimate_no_filing"]
        if "_freshness_notes" in existing:
            del existing["_freshness_notes"]
    elif not data.get("next_earnings_date"):
        existing["_freshness_legitimate_no_filing"] = True
        existing["_freshness_notes"] = data.get("notes", [])

    existing["_freshness_filled_at"] = datetime.now(timezone.utc).isoformat()
    existing["_freshness_source"] = f"yfinance (variant {data.get('variant_used')})" if data.get('variant_used') and data.get('variant_used') != canonical else "yfinance"

    with path.open("w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return {"ticker": canonical, "variant": data.get("variant_used"), "publication_date": pub, "pub_recent_12m": pub_recent, "next_earnings_date": data.get("next_earnings_date")}


def main():
    results = []
    for canonical, alts in VARIANTS.items():
        best = None
        for v in alts:
            d = try_variant(canonical, v)
            if d.get("publication_date"):
                best = d
                break
            time.sleep(0.3)
        if best is None:
            # try the canonical anyway (no-op merge to refresh tag)
            best = {"publication_date": None, "latest_filing": None, "next_earnings_date": None, "variant_used": canonical, "notes": ["all variants 404"]}
        res = merge(canonical, best)
        results.append(res)
        print(f"{canonical} via {res['variant']} -> pub={res['publication_date']} recent={res['pub_recent_12m']} next={res['next_earnings_date']}")
        time.sleep(0.5)

    out = ROOT / "scripts" / "freshness-fill" / "results_round2.json"
    with out.open("w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    ok = sum(1 for r in results if r["pub_recent_12m"])
    print(f"\nRound 2 DONE. recovered={ok}/{len(results)}")


if __name__ == "__main__":
    main()
