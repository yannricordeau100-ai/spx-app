#!/usr/bin/env python3
"""
extract_fpi_eu.py — Sub-agent #109 / Mission V1.9 manquantes
=============================================================
Extraction yfinance + sec-data pour les 10 FPI EU prioritaires demandés Yann (13 mai).

Périmètre (10 FPI):
  ADR US (à AJOUTER univers) : TSM, NVO, TM, BABA
  Tickers locaux univers présents mais NON audités : RIO.L, BATS.L, ENI.MI
  Tickers locaux univers ET déjà fpi-batch : AZN.L, BHP.AX, HSBA.L, 9988.HK (déjà ok normalement)

Mode : DRY-RUN par défaut (1 ticker BHP.AX). Pour batch complet : --full.
Idempotent : skip si src/data/v1-9-complete/<TICKER>.json déjà existant.
Throttle : 0.5s entre tickers.
Cerebras : aucun appel — markers TODO_CEREBRAS pour story/risks LLM.

Ne PAS lancer en production sans validation CONV-DATA.
"""

import argparse
import json
import os
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "src" / "data" / "v1-9-complete"
SEC_DATA_DIR = REPO / "sec-data"
THROTTLE_SEC = 0.5

FPI_TARGETS = [
    # ADR — absents univers, à ajouter
    {"ticker": "TSM",     "name": "Taiwan Semiconductor Manufacturing (ADR)", "country": "TW", "fpi_id": "TSM"},
    {"ticker": "NVO",     "name": "Novo Nordisk (ADR)",                       "country": "DK", "fpi_id": "NVO"},
    {"ticker": "TM",      "name": "Toyota Motor (ADR)",                       "country": "JP", "fpi_id": "TM"},
    {"ticker": "BABA",    "name": "Alibaba Group Holding (ADR)",              "country": "CN", "fpi_id": "BABA"},
    # Locaux univers mais non audités
    {"ticker": "RIO.L",   "name": "Rio Tinto",                                "country": "GB", "fpi_id": "RIO"},
    {"ticker": "BATS.L",  "name": "British American Tobacco",                 "country": "GB", "fpi_id": "BTI"},
    {"ticker": "ENI.MI",  "name": "Eni",                                      "country": "IT", "fpi_id": "E"},
    # Confort — re-audit si fichier absent (probablement déjà ok)
    {"ticker": "AZN.L",   "name": "AstraZeneca",                              "country": "GB", "fpi_id": "AZN"},
    {"ticker": "BHP.AX",  "name": "BHP Group",                                "country": "AU", "fpi_id": "BHP"},
    {"ticker": "HSBA.L",  "name": "HSBC Holdings",                            "country": "GB", "fpi_id": "HSBC"},
]

# Exclusions explicites Yann (NE PAS extraire)
EXCLUDED = {"ITUB", "VALE", "HDB"}


def fetch_yf(ticker: str) -> dict:
    """yfinance fetch (info + financials + calendar)."""
    try:
        import yfinance as yf  # noqa
    except ImportError:
        print(f"[WARN] yfinance not installed — placeholder for {ticker}", file=sys.stderr)
        return {"_placeholder": True, "ticker": ticker}

    t = yf.Ticker(ticker)
    out = {"ticker": ticker}
    try:
        out["info"] = t.info
    except Exception as e:
        out["info_error"] = str(e)
    try:
        fin = t.financials
        out["financials"] = fin.to_dict() if fin is not None and not fin.empty else {}
    except Exception as e:
        out["financials_error"] = str(e)
    try:
        cal = t.calendar
        out["calendar"] = cal.to_dict() if hasattr(cal, "to_dict") else cal
    except Exception as e:
        out["calendar_error"] = str(e)
    return out


def fetch_sec_local(fpi_id: str) -> dict:
    """Lookup 20-F local si présent sous sec-data/."""
    candidates = [
        SEC_DATA_DIR / "fpi" / f"{fpi_id}.json",
        SEC_DATA_DIR / "20-F" / f"{fpi_id}.json",
        SEC_DATA_DIR / f"{fpi_id}_20F.json",
    ]
    for c in candidates:
        if c.exists():
            try:
                return json.loads(c.read_text())
            except Exception:
                pass
    return {}


def build_enrich_json(target: dict, yf_data: dict, sec_data: dict) -> dict:
    """Structure JSON v1-9-complete CONFORME au schéma réel (patch sub-agent #112).

    Le schéma original sub-agent #109 (hero/repartition/stories/gov/risks) était
    INCOMPATIBLE avec src/data/v1-9-complete/AAPL.json. Patch via _schema_v19.
    """
    from _schema_v19 import build_v19_skeleton
    # Forcer source v1.9 FPI EU 21 mai
    target_norm = dict(target)
    target_norm.setdefault("sources", ["fpi-v19-yann-21mai"])
    return build_v19_skeleton(target_norm, yf_data, sec_data)


def process_one(target: dict, force: bool = False) -> str:
    ticker = target["ticker"]
    if target["fpi_id"] in EXCLUDED:
        return f"SKIP_EXCLUDED {ticker}"
    out_path = OUT_DIR / f"{ticker}.json"
    if out_path.exists() and not force:
        return f"SKIP_EXISTS {ticker} -> {out_path.name}"
    yf_data = fetch_yf(ticker)
    sec_data = fetch_sec_local(target["fpi_id"])
    enriched = build_enrich_json(target, yf_data, sec_data)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(enriched, indent=2, ensure_ascii=False))
    return f"OK {ticker} -> {out_path.name} (yf={enriched['_extraction']['yf_ok']}, sec={enriched['_extraction']['sec_ok']})"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="1 seul ticker test (BHP.AX)")
    p.add_argument("--full", action="store_true", help="Batch complet 10 FPI")
    p.add_argument("--force", action="store_true", help="Overwrite existing files")
    p.add_argument("--write", action="store_true", help="Active l'écriture (sinon stdout uniquement)")
    args = p.parse_args()

    if not args.dry_run and not args.full:
        print("Specifier --dry-run OU --full", file=sys.stderr)
        sys.exit(2)

    targets = [t for t in FPI_TARGETS if t["ticker"] == "BHP.AX"] if args.dry_run else FPI_TARGETS
    print(f"[extract_fpi_eu] mode={'DRY' if args.dry_run else 'FULL'} write={args.write} targets={len(targets)}")
    for t in targets:
        if not args.write:
            # ne touche pas le fs, montre juste le plan
            out_path = OUT_DIR / f"{t['ticker']}.json"
            print(f"  PLAN {t['ticker']:10} -> {out_path.relative_to(REPO)} (exists={out_path.exists()})")
            continue
        msg = process_one(t, force=args.force)
        print(f"  {msg}")
        time.sleep(THROTTLE_SEC)


if __name__ == "__main__":
    main()
