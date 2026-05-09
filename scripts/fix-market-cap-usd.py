#!/usr/bin/env python3
"""
fix-market-cap-usd.py — convertit `financial_snapshot.market_cap_usd` en
vrai USD pour les datasets d'enrichissement V1.7/V1.8.

Pourquoi : yfinance retourne `marketCap` en devise locale du listing.
Notre champ s'appelait `market_cap_usd` mais ne contenait PAS de
conversion. Conséquence : 9984.T (SoftBank, JPY) apparaissait avec
mc=36 trillions et donc en tête du tri par market_cap dans
build-v18-tickers.ts. Idem AZN.ST (SEK), ATCO-A.ST (SEK), etc.

Solution :
  1. Lire `currency` dans `financial_snapshot`.
  2. Si != USD, fetch FX rate (yfinance pair `<CUR>USD=X` ou inverse).
  3. Recalculer mc_usd = mc_local * fx_rate.
  4. Écrire en place dans le fichier enrich.

Idempotent : on ajoute aussi `_market_cap_local` (valeur d'origine en
devise) pour traçabilité, et `_fx_to_usd` (le taux utilisé). Si déjà
présents et fx_to_usd != 1.0, on skip (déjà converti).

Sortie console : tableau avant/après pour les 20 premières + total
fichiers patchés.

Usage :
  python3 scripts/fix-market-cap-usd.py
  python3 scripts/fix-market-cap-usd.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR = ROOT / "src/data/v2-pipeline-enrich"


def normalize_currency(c: str | None) -> str:
    if not c:
        return "USD"
    c = c.upper()
    # Normalisations standard
    if c in ("GBX", "GBp"):  # Pence -> GBP / 100
        return "GBp"
    return c


_FX_CACHE: dict[str, float] = {"USD": 1.0}


def get_fx_to_usd(curr: str) -> float:
    if curr in _FX_CACHE:
        return _FX_CACHE[curr]
    try:
        import yfinance as yf
    except ImportError:
        print("ERR: pip install yfinance requis", file=sys.stderr)
        sys.exit(1)
    if curr == "GBp":
        # 1 pence = 0.01 GBP
        gbp_rate = get_fx_to_usd("GBP")
        rate = gbp_rate / 100.0
        _FX_CACHE[curr] = rate
        return rate
    # Try direct CURUSD=X
    try:
        pair = yf.Ticker(f"{curr}USD=X").info or {}
        rate = pair.get("regularMarketPrice") or pair.get("previousClose")
        if rate and isinstance(rate, (int, float)) and rate > 0:
            _FX_CACHE[curr] = float(rate)
            return float(rate)
    except Exception:
        pass
    # Fallback inverse
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    files = [f for f in sorted(os.listdir(ENR)) if f.endswith(".json") and "." not in f.replace(".json", "").replace("-", "")]
    # Prendre uniquement <ticker>.json (pas .ranks.json, .events.json, etc.)
    main_files = []
    for f in os.listdir(ENR):
        if not f.endswith(".json"):
            continue
        base = f[:-5]  # strip .json
        if "." in base:
            # cas comme 9984.T.json (ticker contient un .) → garder
            # vs nvda.ranks.json → exclure (on regarde le 2e segment)
            parts = base.split(".")
            # whitelist : 1 segment, ou 2 segments où le 2e est une letter (ex T, ST, OL, MC, MI, AS, HE, CO, SW, DE, PA, L)
            tail = parts[-1]
            if tail in {"ranks", "events", "tam", "ai-pos", "gemini", "de", "logo"}:
                continue
        main_files.append(f)

    main_files.sort()
    print(f"Trouvé {len(main_files)} fichiers <ticker>.json à inspecter\n")

    patched = 0
    skipped_already = 0
    no_data = 0
    fx_rates_used: dict[str, float] = {}
    sample_rows: list[tuple] = []

    for i, fname in enumerate(main_files):
        path = ENR / fname
        try:
            d = json.load(open(path))
        except Exception as e:
            print(f"  ERR {fname}: {e}", file=sys.stderr)
            continue

        snap = d.get("financial_snapshot")
        if not snap or not isinstance(snap, dict):
            no_data += 1
            continue

        mc = snap.get("market_cap_usd")
        curr = normalize_currency(snap.get("currency"))

        if not isinstance(mc, (int, float)) or mc <= 0:
            no_data += 1
            continue

        # Idempotence : si _fx_to_usd déjà présent et != 1.0, c'est déjà
        # converti.
        prior_fx = snap.get("_fx_to_usd")
        if prior_fx is not None and abs(prior_fx - 1.0) > 1e-9:
            skipped_already += 1
            continue

        if curr == "USD":
            # Marquer pour idempotence sans toucher la valeur
            snap["_fx_to_usd"] = 1.0
            snap["_market_cap_local"] = mc
            patched += 1
            if not args.dry_run:
                json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
            continue

        # Conversion
        fx = get_fx_to_usd(curr)
        fx_rates_used[curr] = fx
        new_mc = float(mc) * fx
        old_mc = mc

        snap["_market_cap_local"] = old_mc
        snap["_fx_to_usd"] = fx
        snap["market_cap_usd"] = new_mc
        patched += 1

        ticker = fname[:-5].upper()
        if len(sample_rows) < 25:
            sample_rows.append((ticker, curr, old_mc, fx, new_mc))

        if not args.dry_run:
            json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)

    # Récap
    print("\nFX rates utilisés :")
    for c, r in sorted(fx_rates_used.items()):
        print(f"  {c} → USD : {r:.6f}")

    print(f"\nÉchantillon avant/après (top {len(sample_rows)}) :")
    print(f"  {'Ticker':12} {'Cur':5} {'mc_local':>20} {'fx':>10} {'mc_usd':>20}")
    for tk, c, old, fx, new in sample_rows:
        print(f"  {tk:12} {c:5} {old:>20.0f} {fx:>10.6f} {new:>20.0f}")

    print(f"\nRésumé : {patched} fichiers patchés, {skipped_already} déjà OK, {no_data} sans data.")
    if args.dry_run:
        print("[dry-run actif, aucune écriture]")


if __name__ == "__main__":
    main()
