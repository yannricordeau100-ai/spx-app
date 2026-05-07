#!/usr/bin/env python3
"""
enrich-company-profile-yfinance.py — récupère en un seul appel yfinance
les blocs MANQUANTS de la page société qui ne sont couverts par aucune
autre conv :

  - financial_snapshot : market_cap, P/E, EPS, beta, dividend_yield,
                         52w high/low, day_change_pct
  - key_facts          : HQ pays/ville, employés, bourse, ISIN, industrie,
                         site web, currency
  - company_description: présentation longue (longBusinessSummary yfinance)

Sortie : merge dans `src/data/v2-pipeline-enrich/<ticker>.json` (sans
écraser) + champ horodaté `_profile_fetched_at`.

Idempotent : skip si fichier récent <14 jours (les données financières
bougent, refresh régulier mais pas chaque jour). Avec --force, refresh
total.

Usage :
    python3 scripts/enrich-company-profile-yfinance.py [--limit N] [--force]
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"


def fetch_profile(ticker: str):
    """Renvoie un dict (financial_snapshot, key_facts, company_description)
    ou None si yfinance n'a rien trouvé."""
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        if not info.get("symbol") and not info.get("shortName"):
            return None

        # Conversions sécurisées
        def num(k, default=None):
            v = info.get(k)
            if v is None or not isinstance(v, (int, float)):
                return default
            return float(v)

        # yfinance renvoie `dividendYield` directement en % (ex AAPL : 0.38)
        # depuis ~2024 (avant c'était une fraction 0.0038). Pas de
        # multiplication. `regularMarketChangePercent` aussi déjà en %.
        snapshot = {
            "market_cap_usd": num("marketCap"),
            "pe_ratio": num("trailingPE"),
            "forward_pe": num("forwardPE"),
            "eps_ttm": num("trailingEps"),
            "beta": num("beta"),
            "dividend_yield_pct": num("dividendYield"),  # déjà en %
            "high_52w": num("fiftyTwoWeekHigh"),
            "low_52w": num("fiftyTwoWeekLow"),
            "day_change_pct": num("regularMarketChangePercent"),  # déjà en %
            "currency": info.get("currency"),
        }

        key_facts = {
            "hq_city": info.get("city"),
            "hq_country": info.get("country"),
            "employees_count": num("fullTimeEmployees"),
            "exchange": info.get("exchange"),
            "isin": info.get("isin"),
            "industry": info.get("industry"),
            "industry_disp": info.get("industryDisp"),
            "website": info.get("website"),
            "fiscal_year_end": info.get("lastFiscalYearEnd"),  # epoch sec
        }

        company_description = info.get("longBusinessSummary") or None

        return {
            "snapshot": snapshot,
            "key_facts": key_facts,
            "description": company_description,
        }
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not V17.exists():
        print(f"❌ {V17} introuvable", file=sys.stderr)
        sys.exit(1)
    ENR.mkdir(parents=True, exist_ok=True)

    v17 = json.loads(V17.read_text())
    tickers = list(v17.keys())

    pending = []
    for t in tickers:
        out = ENR / f"{t.lower()}.json"
        if out.exists() and not args.force:
            try:
                existing = json.loads(out.read_text())
                ts = existing.get("_profile_fetched_at")
                if ts:
                    age = (datetime.now(timezone.utc) - datetime.fromisoformat(ts.replace("Z", "+00:00"))).days
                    if age < 14:
                        continue
            except Exception:
                pass
        pending.append(t)
    if args.limit:
        pending = pending[: args.limit]

    print(f"📊 Profile yfinance : {len(pending)} sés à fetcher")

    ok = 0
    fail = 0
    for i, t in enumerate(pending):
        prof = fetch_profile(t)
        if not prof:
            fail += 1
            time.sleep(0.4)
            continue

        out_path = ENR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        # Avec --force, on écrase tout (refresh des prix). Sans --force on
        # ne pose que les champs vides (preserve CONV-DATA si applicable).
        if args.force or not existing.get("financial_snapshot"):
            if prof["snapshot"]:
                existing["financial_snapshot"] = prof["snapshot"]
        if args.force or not existing.get("key_facts"):
            if prof["key_facts"]:
                existing["key_facts"] = prof["key_facts"]
        if args.force or not existing.get("company_description"):
            if prof["description"]:
                existing["company_description"] = prof["description"]
        existing["_profile_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        ok += 1

        if (i + 1) % 50 == 0:
            print(f"  …{i+1}/{len(pending)} (ok={ok}, fail={fail})", flush=True)
        time.sleep(0.3)

    print(f"\n✅ {ok} sés enrichies (snapshot + key_facts + description), {fail} échecs")


if __name__ == "__main__":
    main()
