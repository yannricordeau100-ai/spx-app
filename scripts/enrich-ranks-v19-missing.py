#!/usr/bin/env python3
"""
enrich-ranks-v19-missing.py — Sub-agent #83 (CONV-CONCEPTS, 21 mai 2026).

But : combler les 59 stés V1.9 publishable où k_ranks fail (ranks
remplis <2/4 dans v1-9-complete + pas de fichier `.ranks.json` séparé).

Workflow :
  1. Charge le set des 990 stés V1.9 publishable + leur sector/subsector
     depuis v1-9-complete (+ fallback v2-pipeline).
  2. Charge les ranks.json existants pour récupérer les market caps
     déjà connues (évite redoubler yfinance).
  3. Pour les stés sans ranks.json : fetch yfinance market_cap (USD).
  4. Recalcule les ranks global/US/sector/subsector sur l'univers global
     (V1.7 existant + nouveaux V1.9 fetchés).
  5. Écrit `<ticker>.ranks.json` seulement pour les stés cibles.

Output : src/data/v2-pipeline-enrich/<ticker>.ranks.json
Compatible avec le merge ajouté à l'audit (sub-agent #83).

Usage :
    python3 scripts/enrich-ranks-v19-missing.py [--dry-run] [--workers 4]
"""

import argparse
import concurrent.futures as cf
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V19_UNIVERSE = PROJECT_ROOT / "src/data/v1-9-universe.json"
V19_PUBLISHABLE = PROJECT_ROOT / "src/data/v1-9-publishable.json"
V19_COMPLETE = PROJECT_ROOT / "src/data/v1-9-complete"
V2_DIR = PROJECT_ROOT / "src/data/v2-pipeline"
ENR_DIR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"

# Aliases (sync avec load-company.ts + enrich-ranks-v2.py).
ALIASES = {
    "GOOG": "GOOGL",
    "BRK.A": "BRK-B",
    "BRK-A": "BRK-B",
    "FOX": "FOXA",
    "NWSA": "NWS",
    "UAA": "UA",
}

_FX_CACHE: dict = {}


def _normalize_currency(c: str) -> str:
    if not c:
        return "USD"
    if c == "GBp":
        return "GBP"
    if c == "ZAc":
        return "ZAR"
    return c.upper()


def get_fx_to_usd(curr: str) -> float:
    import yfinance as yf

    if curr in ("USD", "", None):
        return 1.0
    if curr in _FX_CACHE:
        return _FX_CACHE[curr]
    try:
        pair = yf.Ticker(f"{curr}USD=X").info or {}
        rate = pair.get("regularMarketPrice") or pair.get("previousClose")
        if rate and isinstance(rate, (int, float)) and rate > 0:
            _FX_CACHE[curr] = float(rate)
            return float(rate)
    except Exception:
        pass
    try:
        pair = yf.Ticker(f"USD{curr}=X").info or {}
        rate = pair.get("regularMarketPrice") or pair.get("previousClose")
        if rate and isinstance(rate, (int, float)) and rate > 0:
            inv = 1.0 / float(rate)
            _FX_CACHE[curr] = inv
            return inv
    except Exception:
        pass
    _FX_CACHE[curr] = 1.0
    return 1.0


def fetch_one(ticker: str):
    import yfinance as yf

    for attempt in range(2):
        try:
            info = yf.Ticker(ticker).info or {}
            mc = info.get("marketCap")
            country = info.get("country", "") or ""
            curr = _normalize_currency(info.get("currency", "USD"))
            if not (mc and isinstance(mc, (int, float)) and mc > 0):
                shares = info.get("sharesOutstanding")
                price = info.get("currentPrice") or info.get("regularMarketPrice")
                if shares and price and isinstance(shares, (int, float)) and isinstance(price, (int, float)):
                    mc = float(shares) * float(price)
            if mc and isinstance(mc, (int, float)) and mc > 0:
                fx = get_fx_to_usd(curr)
                mc_usd = float(mc) * fx
                return ticker, mc_usd, country, curr, fx
            return ticker, None, country, curr, 1.0
        except Exception:
            if attempt < 1:
                time.sleep(0.6)
                continue
    return ticker, None, "", "USD", 1.0


def format_global(rank: int) -> str:
    return f"#{rank}"


def format_sector(rank: int, sector: str) -> str:
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


def read_json(p: Path):
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def load_company_meta(ticker: str):
    """Trouve sector / subsector depuis v1-9-complete (priorité), sinon v2-pipeline."""
    candidates = [
        V19_COMPLETE / f"{ticker}.json",
        V19_COMPLETE / f"{ticker.lower()}.json",
        V2_DIR / f"{ticker.lower()}.json",
        V2_DIR / f"{ticker}.json",
    ]
    for c in candidates:
        if c.exists():
            d = read_json(c)
            if d:
                return d.get("sector"), d.get("subsector")
    return None, None


CURRENCIES_TO_PREFETCH = [
    "EUR", "GBP", "JPY", "CHF", "SEK", "NOK", "DKK", "CAD", "HKD",
    "SGD", "AUD", "CNY", "BRL", "INR", "MXN", "TWD", "ZAR", "ILS",
    "PLN", "TRY", "KRW",
]


def prefetch_fx_rates():
    print("Pre-fetch FX rates -> USD...")
    for c in CURRENCIES_TO_PREFETCH:
        rate = get_fx_to_usd(c)
        print(f"  {c} = {rate:.5f} USD")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--targets-only", action="store_true",
                    help="Fetch yfinance uniquement pour les stés target (sans ranks.json) ; "
                         "ranks calculés sur l'union (target + ranks.json existants).")
    args = ap.parse_args()

    if not V19_PUBLISHABLE.exists():
        print(f"ERR: {V19_PUBLISHABLE} introuvable", file=sys.stderr)
        sys.exit(1)

    publishable = json.loads(V19_PUBLISHABLE.read_text())
    if isinstance(publishable, dict):
        if "tickers" in publishable and isinstance(publishable["tickers"], list):
            publishable_tickers = [t["ticker"] if isinstance(t, dict) else t for t in publishable["tickers"]]
        else:
            publishable_tickers = list(publishable.keys())
    elif isinstance(publishable, list):
        publishable_tickers = [t["ticker"] if isinstance(t, dict) else t for t in publishable]
    else:
        print(f"ERR: format publishable inattendu", file=sys.stderr)
        sys.exit(1)
    print(f"V1.9 publishable : {len(publishable_tickers)} stés")

    # 1. Charger ranks.json existants pour récupérer market_cap_usd déjà connu
    existing_mc: dict = {}
    for p in ENR_DIR.glob("*.ranks.json"):
        d = read_json(p)
        if not d:
            continue
        t = d.get("ticker") or p.stem.replace(".ranks", "").upper()
        mc = d.get("market_cap_usd")
        country = d.get("country", "") or ""
        if mc and isinstance(mc, (int, float)) and mc > 0:
            sector, subsector = load_company_meta(t)
            existing_mc[t] = {
                "mc": float(mc),
                "country": country,
                "sector": sector,
                "subsector": subsector,
            }
    print(f"Market caps existants depuis ranks.json : {len(existing_mc)} stés")

    # 2. Identifier les stés target (publishable sans ranks.json)
    targets = []
    for t in publishable_tickers:
        canonical = ALIASES.get(t, t)
        p = ENR_DIR / f"{canonical.lower()}.ranks.json"
        if not p.exists():
            targets.append(canonical)
    targets = sorted(set(targets))
    print(f"Targets (publishable sans ranks.json) : {len(targets)}")
    print(f"  Sample : {','.join(targets[:20])}")

    if not targets:
        print("Rien à faire.")
        return

    # 3. Fetch FX + market_cap pour les targets
    prefetch_fx_rates()

    print(f"\nFetch yfinance pour {len(targets)} targets (parallel x{args.workers})...")
    market_caps = dict(existing_mc)
    fail = 0
    failed_tickers = []
    t0 = time.time()
    done = 0

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for ticker, mc, country, curr, fx in ex.map(fetch_one, targets):
            done += 1
            sector, subsector = load_company_meta(ticker)
            if mc is None:
                fail += 1
                failed_tickers.append(ticker)
                continue
            market_caps[ticker] = {
                "mc": mc,
                "country": country,
                "sector": sector,
                "subsector": subsector,
                "currency": curr,
                "fx_to_usd": fx,
            }
            if done % 20 == 0:
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                eta = (len(targets) - done) / rate if rate > 0 else 0
                print(f"  {done}/{len(targets)} ({rate:.1f}/s, ETA {eta:.0f}s, fail={fail})", flush=True)

    print(f"Fetch terminé en {time.time() - t0:.0f}s. Fail: {fail}/{len(targets)}")

    if failed_tickers:
        print(f"Retry séquentiel pour {len(failed_tickers)} fails...")
        retry_ok = 0
        for t in failed_tickers:
            time.sleep(1.0)
            ticker, mc, country, curr, fx = fetch_one(t)
            if mc is not None:
                sector, subsector = load_company_meta(t)
                market_caps[t] = {
                    "mc": mc,
                    "country": country,
                    "sector": sector,
                    "subsector": subsector,
                    "currency": curr,
                    "fx_to_usd": fx,
                }
                retry_ok += 1
        print(f"  Retry OK : {retry_ok}/{len(failed_tickers)}")

    # 4. Compute ranks (sur union targets + existing)
    print(f"\nCompute ranks (univers : {len(market_caps)} stés)...")
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

    # 5. Écrire UNIQUEMENT pour les targets (ne pas écraser les ranks.json existants)
    if args.dry_run:
        print("\n[dry-run] aucun fichier écrit.")
        print("Sample targets ranks calculés :")
        for t in targets[:10]:
            if t not in valid:
                continue
            print(f"  {t}: global=#{rank_global.get(t)} us=#{rank_us.get(t, 'NA')} "
                  f"sector={rank_sector.get(t, 'NA')} (sec={valid[t]['sector']})")
        return

    written = 0
    skipped_no_mc = 0
    for t in targets:
        if t not in valid:
            skipped_no_mc += 1
            continue
        m = valid[t]
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

        # Si moins de 2 ranks remplis (sector/subsector inconnus), tagger comme legitimate single_player
        filled = sum(1 for v in ranks.values() if v and v != "Non US")
        if filled < 2 and not m.get("sector"):
            ranks["_single_player_legitimate"] = True
            ranks["_rationale"] = "sector/subsector inconnu côté pipeline V1.9, rang non calculable"

        out = {
            "ticker": t,
            "ranks": ranks,
            "market_cap_usd": m["mc"],
            "country": m.get("country", ""),
            "_data_freshness_date": datetime.now(timezone.utc).isoformat(),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "yfinance-marketcap-v19-missing",
        }
        out_path = ENR_DIR / f"{t.lower()}.ranks.json"
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
        written += 1

    print(f"\nOK : {written}/{len(targets)} fichiers ranks.json écrits")
    if skipped_no_mc:
        print(f"  Skipped (no market_cap) : {skipped_no_mc} → tickers : {','.join([t for t in targets if t not in valid])}")


if __name__ == "__main__":
    main()
