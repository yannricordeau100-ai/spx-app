#!/usr/bin/env python3
"""
enrich-ranks-v2.py — V2 du calcul des ranks (mondial / US / sector /
subsector) pour les 617 stés V1.7 Pass 3 strict.

Fix vs v1 (CONV-MODULE-RANKS-V2, 8 mai 2026) :
  - Le script v1 SKIPPAIT les stés ayant des ranks "usables" dans
    v2-pipeline/<t>.json (ex : NVDA "≈ #10" issu d'extraction LLM 10-K
    est "usable" mais factuellement faux : NVDA = #1 mondial à $5.14T MC).
  - V2 force-écrit ranks.json pour TOUTES les 617 stés à partir des
    market caps live (yfinance, fresh) → ranking objectif.
  - Source primaire : yfinance .info["marketCap"] (gratuit, illimité,
    couvre US + foreign .PA/.L/.DE/.AS/.T/etc).
  - FMP /stable/quote utilisé en sanity-check optionnel (--cross-check).
  - Concurrent.futures parallel x8 → 617 stés en ~2-3 min.

Output : src/data/v2-pipeline-enrich/<ticker>.ranks.json
Format compatible avec load-company.ts existant.

Usage :
    python3 scripts/enrich-ranks-v2.py [--limit N] [--top-only N] [--dry-run]
"""

import argparse
import concurrent.futures as cf
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
V2 = PROJECT_ROOT / "src/data/v2-pipeline"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"


def load_pipeline(ticker: str):
    p = V2 / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


# FX rates fetched once at startup. yfinance marketCap is returned in the
# ticker's listing currency (e.g. JPY for 9984.T, SEK for AZN.ST, EUR for
# MC.PA). Without conversion, foreign stés explosent dans le ranking
# mondial (SoftBank apparaît à $34T au lieu de $230B). On normalise tout
# en USD via taux yfinance live (paire FX=X).
_FX_CACHE: dict = {}


def _normalize_currency(c: str) -> str:
    """yfinance returns 'GBp' (pence), 'ZAc' (cents) etc. but marketCap
    is expressed in the major unit (GBP, ZAR). Map to major unit."""
    if not c:
        return "USD"
    upper = c.upper()
    mapping = {"GBP": "GBP", "GBPENCE": "GBP", "ZAC": "ZAR", "ILA": "ILS"}
    if c == "GBp":
        return "GBP"
    if c == "ZAc":
        return "ZAR"
    return mapping.get(upper, upper)


def get_fx_to_usd(curr: str) -> float:
    """Return how many USD = 1 unit of <curr>. Cache."""
    import yfinance as yf

    if curr in ("USD", "", None):
        return 1.0
    if curr in _FX_CACHE:
        return _FX_CACHE[curr]
    try:
        # yfinance pair convention: XXXUSD=X means "1 XXX = N USD".
        pair = yf.Ticker(f"{curr}USD=X").info or {}
        rate = pair.get("regularMarketPrice") or pair.get("previousClose")
        if rate and isinstance(rate, (int, float)) and rate > 0:
            _FX_CACHE[curr] = float(rate)
            return float(rate)
    except Exception:
        pass
    # Fallback : try inverted pair USD<curr>=X then 1/rate
    try:
        pair = yf.Ticker(f"USD{curr}=X").info or {}
        rate = pair.get("regularMarketPrice") or pair.get("previousClose")
        if rate and isinstance(rate, (int, float)) and rate > 0:
            inv = 1.0 / float(rate)
            _FX_CACHE[curr] = inv
            return inv
    except Exception:
        pass
    print(f"  WARN: FX rate {curr}->USD introuvable, fallback 1.0", file=sys.stderr)
    _FX_CACHE[curr] = 1.0
    return 1.0


def fetch_one(ticker: str):
    """Fetch market_cap + country via yfinance, normalisé en USD. Retry x2."""
    import yfinance as yf

    for attempt in range(2):
        try:
            info = yf.Ticker(ticker).info or {}
            mc = info.get("marketCap")
            country = info.get("country", "") or ""
            curr = _normalize_currency(info.get("currency", "USD"))
            if mc and isinstance(mc, (int, float)) and mc > 0:
                fx = get_fx_to_usd(curr)
                mc_usd = float(mc) * fx
                return ticker, mc_usd, country, curr, fx
            return ticker, None, country, curr, 1.0
        except Exception:
            if attempt < 1:
                time.sleep(0.5)
                continue
    return ticker, None, "", "USD", 1.0


def format_global(rank: int) -> str:
    return f"#{rank}"


def format_sector(rank: int, sector: str) -> str:
    """Stratification verbale par tier."""
    if not sector:
        return None
    if rank == 1:
        return f"#1 in {sector}"
    if rank == 2:
        return f"#2 in {sector}"
    if rank == 3:
        return f"#3 in {sector}"
    if rank <= 5:
        return f"Top 5 in {sector}"
    if rank <= 10:
        return f"Top 10 in {sector}"
    if rank <= 25:
        return f"Top 25 in {sector}"
    if rank <= 50:
        return f"Top 50 in {sector}"
    return f"#{rank} in {sector}"


def is_us_country(c: str) -> bool:
    if not c:
        return False
    cl = c.lower()
    return cl in ("united states", "usa", "us", "u.s.", "u.s.a.")


CURRENCIES_TO_PREFETCH = [
    "EUR", "GBP", "JPY", "CHF", "SEK", "NOK", "DKK", "CAD", "HKD",
    "SGD", "AUD", "CNY", "BRL", "INR", "MXN", "TWD", "ZAR", "ILS",
    "PLN", "TRY", "KRW",
]


def prefetch_fx_rates():
    """Fetch all FX rates upfront (sequential, ~10s) so the parallel pool
    doesn't have FX races / yfinance double-load."""
    print("Pre-fetch FX rates -> USD...")
    for c in CURRENCIES_TO_PREFETCH:
        rate = get_fx_to_usd(c)
        print(f"  {c} = {rate:.5f} USD")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="Max stés à fetcher")
    ap.add_argument("--top-only", type=int, default=None, help="Test mode : ne traite que les N premiers tickers (alphabétique)")
    ap.add_argument("--workers", type=int, default=4, help="Threads parallèles yfinance (4 par défaut, plus = rate-limit)")
    ap.add_argument("--dry-run", action="store_true", help="N'écrit rien")
    ap.add_argument("--top30", action="store_true", help="Run sur le top 30 mondial connu (test rapide)")
    args = ap.parse_args()

    if not V17.exists():
        print(f"ERR: {V17} introuvable", file=sys.stderr)
        sys.exit(1)

    v17 = json.loads(V17.read_text())
    all_tickers = list(v17.keys())
    print(f"V1.7 Pass 3 strict : {len(all_tickers)} stés")

    if args.top30:
        # Force inclure top 30 known + take all 617 to compute correct global ranking
        target = all_tickers
    elif args.top_only:
        target = sorted(all_tickers)[: args.top_only]
    elif args.limit:
        target = all_tickers[: args.limit]
    else:
        target = all_tickers

    prefetch_fx_rates()

    print(f"\nFetch yfinance market_cap pour {len(target)} stés (parallel x{args.workers})...")

    market_caps = {}
    fail = 0
    failed_tickers = []
    t0 = time.time()
    done = 0

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for ticker, mc, country, curr, fx in ex.map(fetch_one, target):
            done += 1
            full = load_pipeline(ticker)
            sector = full.get("sector") if full else None
            subsector = full.get("subsector") if full else None
            if mc is None:
                fail += 1
                failed_tickers.append(ticker)
            market_caps[ticker] = {
                "mc": mc or 0,
                "country": country,
                "sector": sector,
                "subsector": subsector,
                "currency": curr,
                "fx_to_usd": fx,
            }
            if done % 50 == 0:
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                eta = (len(target) - done) / rate if rate > 0 else 0
                print(f"  {done}/{len(target)} ({rate:.1f}/s, ETA {eta:.0f}s, fail={fail})", flush=True)

    elapsed = time.time() - t0
    print(f"Fetch terminé en {elapsed:.0f}s. Fail: {fail}/{len(target)}")

    # Retry pass for failed tickers, séquentiel et avec backoff (yfinance
    # rate-limits après ~500 calls parallèles).
    if failed_tickers:
        print(f"Retry séquentiel pour {len(failed_tickers)} fails (backoff 1s)...")
        retry_ok = 0
        for t in failed_tickers:
            time.sleep(1.0)
            ticker, mc, country, curr, fx = fetch_one(t)
            if mc is not None:
                full = load_pipeline(t)
                market_caps[t] = {
                    "mc": mc,
                    "country": country,
                    "sector": full.get("sector") if full else None,
                    "subsector": full.get("subsector") if full else None,
                    "currency": curr,
                    "fx_to_usd": fx,
                }
                retry_ok += 1
        print(f"  Retry OK: {retry_ok}/{len(failed_tickers)}")

    # Compute ranks based on market_cap
    print("Compute ranks...")
    valid = {t: m for t, m in market_caps.items() if m["mc"] > 0}

    sorted_global = sorted(valid.items(), key=lambda x: -x[1]["mc"])
    rank_global = {t: i + 1 for i, (t, _) in enumerate(sorted_global)}

    us_tickers = [t for t, m in valid.items() if is_us_country(m["country"])]
    us_sorted = sorted(us_tickers, key=lambda t: -valid[t]["mc"])
    rank_us = {t: i + 1 for i, t in enumerate(us_sorted)}

    by_sector = {}
    for t, m in valid.items():
        s = m["sector"]
        if s:
            by_sector.setdefault(s, []).append(t)
    rank_sector = {}
    for s, ts in by_sector.items():
        for i, t in enumerate(sorted(ts, key=lambda t: -valid[t]["mc"])):
            rank_sector[t] = i + 1

    by_subsec = {}
    for t, m in valid.items():
        s = m["subsector"]
        if s:
            by_subsec.setdefault(s, []).append(t)
    rank_subsec = {}
    for s, ts in by_subsec.items():
        for i, t in enumerate(sorted(ts, key=lambda t: -valid[t]["mc"])):
            rank_subsec[t] = i + 1

    # Verification top 30 mondial
    print("\nTop 30 mondial calculé (USD) :")
    for i, (t, m) in enumerate(sorted_global[:30]):
        print(f"  #{i+1:2d} {t:10s} {m['mc']/1e9:8.0f}B USD  {m['currency']:4s}  {m['country'][:20]}")

    # Write ranks.json files (force pour TOUTES les stés)
    if args.dry_run:
        print("\n[dry-run] aucun fichier écrit.")
        return

    print(f"\nÉcriture ranks.json pour {len(valid)} stés...")
    written = 0
    for t, m in valid.items():
        ranks = {
            "global_world": format_global(rank_global[t]),
        }
        if t in rank_us:
            ranks["global_us"] = format_global(rank_us[t])
        else:
            ranks["global_us"] = "Non US"
        if m["sector"] and t in rank_sector:
            r = format_sector(rank_sector[t], m["sector"])
            if r:
                ranks["sector"] = r
        if m["subsector"] and t in rank_subsec:
            r = format_sector(rank_subsec[t], m["subsector"])
            if r:
                ranks["subsector"] = r

        out = {
            "ticker": t,
            "ranks": ranks,
            "market_cap_usd": m["mc"],
            "country": m["country"],
            "_data_freshness_date": datetime.now(timezone.utc).isoformat(),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "yfinance-marketcap-v2",
        }
        out_path = ENR / f"{t.lower()}.ranks.json"
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
        written += 1

    print(f"OK : {written} fichiers ranks.json écrits dans {ENR}/")


if __name__ == "__main__":
    main()
