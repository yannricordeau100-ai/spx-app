#!/usr/bin/env python3
"""
enrich-ranks-yfinance.py — calcule les ranks (global / US / sector /
subsector) pour toutes les stés V1.7 Pass 3 strict, en utilisant yfinance
(gratuit, illimité) pour récupérer market_cap + country.

Usage :
    python3 scripts/enrich-ranks-yfinance.py [--limit N] [--force]

Pourquoi pas FMP : free tier limité à 250 calls/jour ; on a 975 stés à
ranker. yfinance free + batch via Ticker(). info{} couvre tout.

Stratégie :
    1. Charger v1-7-public.json + v2-pipeline/<ticker>.json pour chaque sté
       afin de connaître sector + subsector (déjà extrait par CONV-DATA).
    2. Fetch market_cap + country via yfinance (avec retry × 3, sleep 0.5s
       entre stés pour pas saturer).
    3. Sort par market_cap décroissant → rank global (1..N pour V1.7).
    4. Pour stés country=US (ou US-listed) → rank US.
    5. Sort par market_cap dans chaque sector → rank sector.
    6. Sort par market_cap dans chaque subsector → rank subsector.
    7. Écrire `src/data/v2-pipeline-enrich/<ticker>.ranks.json` :
       {
         "ticker": "AAPL",
         "ranks": {
           "global_world": "#3",
           "global_us": "#3",
           "sector": "Top 1 in Technology",
           "subsector": "Top 1 in Consumer Electronics"
         },
         "market_cap_usd": 3500000000000,
         "fetched_at": "2026-05-06T..."
       }

Idempotent : skip si fichier ranks.json existe déjà ET <30 jours, sauf
--force. Récupère seulement les stés où le dataset CONV-DATA n'a PAS de
ranks complets (évite d'écraser).

Auto-run à chaque nouvelle sté Pass 3 prête : appeler ce script en
post-cron `mettrik-rebuild-merged`.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
V2 = PROJECT_ROOT / "src/data/v2-pipeline"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"


def is_usable_rank(s):
    if not isinstance(s, str):
        return False
    t = s.strip()
    if not t or t in ("-", "—", "..."):
        return False
    low = t.lower()
    if "not ranked" in low or "non class" in low:
        return False
    return True


def has_full_ranks(co):
    r = co.get("ranks") or {}
    return all(
        is_usable_rank(r.get(k))
        for k in ("global_world", "global_us", "sector", "subsector")
    )


def load_pipeline(ticker):
    p = V2 / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def fetch_market_cap(ticker, retries=2):
    """Fetch market cap from yfinance. Returns (market_cap_usd, country).
    Catch all exceptions (404, JSONDecode, etc) silencieusement → None pour
    que le script ne crashe pas sur 1 ticker invalide.
    """
    import yfinance as yf

    for attempt in range(retries):
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            mc = info.get("marketCap")
            country = info.get("country", "")
            if mc and isinstance(mc, (int, float)) and mc > 0:
                return float(mc), country
            return None, country
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.8)
                continue
    return None, ""


def format_global_rank(rank, total):
    return f"#{rank}"


def format_sector_rank(rank, sector):
    if not sector:
        return None
    if rank == 1:
        return f"#1 in {sector}"
    if rank <= 3:
        return f"Top 3 in {sector}"
    if rank <= 5:
        return f"Top 5 in {sector}"
    if rank <= 10:
        return f"Top 10 in {sector}"
    if rank <= 25:
        return f"Top 25 in {sector}"
    if rank <= 50:
        return f"Top 50 in {sector}"
    return f"#{rank} in {sector}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="Max stés à fetcher (test rapide)")
    ap.add_argument("--force", action="store_true", help="Re-fetch même si ranks.json récent")
    args = ap.parse_args()

    if not V17.exists():
        print(f"❌ {V17} introuvable", file=sys.stderr)
        sys.exit(1)

    v17 = json.loads(V17.read_text())
    tickers = list(v17.keys())
    print(f"📊 V1.7 Pass 3 strict : {len(tickers)} stés")

    # Étape 1 : déterminer qui a besoin d'enrichissement
    pending = []
    for t in tickers:
        full = load_pipeline(t)
        if full and has_full_ranks(full):
            continue
        # Skip si fichier ranks récent existe (sauf --force)
        ranks_file = ENR / f"{t.lower()}.ranks.json"
        if ranks_file.exists() and not args.force:
            try:
                existing = json.loads(ranks_file.read_text())
                fetched = existing.get("fetched_at", "")
                if fetched:
                    fetched_dt = datetime.fromisoformat(fetched.replace("Z", "+00:00"))
                    age_days = (datetime.now(timezone.utc) - fetched_dt).days
                    if age_days < 30:
                        continue
            except Exception:
                pass
        pending.append(t)

    if args.limit:
        pending = pending[: args.limit]

    print(f"  → à fetcher : {len(pending)}\n")

    # Étape 2 : fetch market_cap + sector pour TOUTES les stés (ranking nécessaire)
    print(f"🌍 Fetch market_cap pour les {len(tickers)} stés (yfinance, ~30 min)…")
    market_caps = {}  # ticker -> {mc, country, sector, subsector}
    fail = 0
    for i, t in enumerate(tickers):
        full = load_pipeline(t)
        sector = full.get("sector") if full else None
        subsector = full.get("subsector") if full else None
        # Si la sté a déjà des ranks complets, on prend son market_cap connu
        # via yfinance quand même (sert au global ranking).
        mc, country = fetch_market_cap(t)
        if mc is None:
            fail += 1
        market_caps[t] = {
            "mc": mc or 0,
            "country": country,
            "sector": sector,
            "subsector": subsector,
        }
        if (i + 1) % 50 == 0:
            print(f"  …{i+1}/{len(tickers)} (fail={fail})", flush=True)
        time.sleep(0.3)  # rate-limit doux pour ne pas se faire ban

    # Étape 3 : compute ranks
    print("\n🏁 Compute ranks…")
    sorted_global = sorted(market_caps.items(), key=lambda x: -x[1]["mc"])
    rank_global = {t: i + 1 for i, (t, _) in enumerate(sorted_global)}

    us_tickers = [t for t, m in market_caps.items() if m.get("country", "").lower() in ("united states", "usa", "us")]
    us_sorted = sorted(us_tickers, key=lambda t: -market_caps[t]["mc"])
    rank_us = {t: i + 1 for i, t in enumerate(us_sorted)}

    by_sector = {}
    for t, m in market_caps.items():
        s = m.get("sector")
        if s:
            by_sector.setdefault(s, []).append(t)
    rank_sector = {}
    for s, ts in by_sector.items():
        ts_sorted = sorted(ts, key=lambda t: -market_caps[t]["mc"])
        for i, t in enumerate(ts_sorted):
            rank_sector[t] = i + 1

    by_subsec = {}
    for t, m in market_caps.items():
        s = m.get("subsector")
        if s:
            by_subsec.setdefault(s, []).append(t)
    rank_subsec = {}
    for s, ts in by_subsec.items():
        ts_sorted = sorted(ts, key=lambda t: -market_caps[t]["mc"])
        for i, t in enumerate(ts_sorted):
            rank_subsec[t] = i + 1

    # Étape 4 : write enrich files
    print(f"\n💾 Écriture des fichiers ranks pour les {len(pending)} pending stés…")
    written = 0
    for t in pending:
        m = market_caps.get(t, {})
        if m.get("mc", 0) <= 0:
            continue
        ranks = {
            "global_world": format_global_rank(rank_global.get(t, 0), len(tickers)),
        }
        if t in rank_us:
            ranks["global_us"] = format_global_rank(rank_us[t], len(us_tickers))
        else:
            ranks["global_us"] = "Non US"
        if m.get("sector") and t in rank_sector:
            r = format_sector_rank(rank_sector[t], m["sector"])
            if r:
                ranks["sector"] = r
        if m.get("subsector") and t in rank_subsec:
            r = format_sector_rank(rank_subsec[t], m["subsector"])
            if r:
                ranks["subsector"] = r

        out = {
            "ticker": t,
            "ranks": ranks,
            "market_cap_usd": m["mc"],
            "country": m.get("country", ""),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path = ENR / f"{t.lower()}.ranks.json"
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
        written += 1

    print(f"\n✅ {written} fichiers ranks écrits dans {ENR}/")
    print(f"❌ {fail} stés sans market_cap (yfinance n'a pas trouvé)")


if __name__ == "__main__":
    main()
