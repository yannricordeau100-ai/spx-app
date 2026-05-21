#!/usr/bin/env python3
"""
extract_stoxx_top30.py — Sub-agent #109 / V1.9 manquantes
==========================================================
Extraction top 30 Stoxx 600 manquants par market cap (estimation Yann).

Sélection P0 — 30 tickers EU manquants à très forte priorité (top MC blue-chips) :
  - DAX40 : 15 (ALV, BAS, SAP-déjà-publié-skip, BMW, MBG, ADS, IFX, BEI, ENR, ZAL, DBK, AIR.DE, BAS, HEN3, MTX)
  - CAC40 : 6 (AIR.PA, EL.PA, STMPA.PA, PUB.PA, AC.PA, VIV.PA)
  - AEX : 5 (ASML.AS, SHELL.AS, HEIA.AS, MT.AS, ABN.AS)
  - FTSEMIB : 4 (ENI.MI déjà FPI script — skip ici ; ENEL.MI, G.MI, RACE.MI, UCG.MI)
  - SMI : 4 (UBSG.SW, SIKA.SW, GIVN.SW, CFR.SW)
  - FTSE 100 : 6 (RIO.L déjà FPI — skip ; AAL.L, LLOY.L, VOD.L, RKT.L, SSE.L, LGEN.L)

Pipeline yfinance + sec-data + markers TODO_CEREBRAS.
Mode dry-run par défaut.
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

# Top 30 P0 EU manquants par MC (estimation Stoxx 600 blue-chips, source : v1-9-universe.json gap)
# Note : on évite les FPI déjà couverts par extract_fpi_eu.py (RIO.L, BATS.L, ENI.MI)
STOXX_TOP30 = [
    # DAX40
    {"ticker": "ASML.AS",  "name": "ASML Holding",                "country": "NL", "index": "aex"},
    {"ticker": "ALV.DE",   "name": "Allianz SE",                  "country": "DE", "index": "dax40"},
    {"ticker": "AIR.PA",   "name": "Airbus",                      "country": "FR", "index": "cac40"},
    {"ticker": "EL.PA",    "name": "EssilorLuxottica",            "country": "FR", "index": "cac40"},
    {"ticker": "SHELL.AS", "name": "Shell plc",                   "country": "NL", "index": "aex"},
    {"ticker": "BAS.DE",   "name": "BASF SE",                     "country": "DE", "index": "dax40"},
    {"ticker": "BMW.DE",   "name": "BMW",                         "country": "DE", "index": "dax40"},
    {"ticker": "MBG.DE",   "name": "Mercedes-Benz Group",         "country": "DE", "index": "dax40"},
    {"ticker": "ADS.DE",   "name": "adidas AG",                   "country": "DE", "index": "dax40"},
    {"ticker": "IFX.DE",   "name": "Infineon Technologies",       "country": "DE", "index": "dax40"},
    {"ticker": "DBK.DE",   "name": "Deutsche Bank",               "country": "DE", "index": "dax40"},
    {"ticker": "BEI.DE",   "name": "Beiersdorf AG",               "country": "DE", "index": "dax40"},
    {"ticker": "UBSG.SW",  "name": "UBS Group AG",                "country": "CH", "index": "smi"},
    {"ticker": "SIKA.SW",  "name": "Sika AG",                     "country": "CH", "index": "smi"},
    {"ticker": "GIVN.SW",  "name": "Givaudan SA",                 "country": "CH", "index": "smi"},
    {"ticker": "CFR.SW",   "name": "Compagnie Financière Richemont", "country": "CH", "index": "smi"},
    {"ticker": "STMPA.PA", "name": "STMicroelectronics",          "country": "FR", "index": "cac40"},
    {"ticker": "PUB.PA",   "name": "Publicis Groupe",             "country": "FR", "index": "cac40"},
    {"ticker": "AC.PA",    "name": "Accor",                       "country": "FR", "index": "cac40"},
    {"ticker": "ENEL.MI",  "name": "Enel",                        "country": "IT", "index": "ftsemib"},
    {"ticker": "G.MI",     "name": "Assicurazioni Generali",      "country": "IT", "index": "ftsemib"},
    {"ticker": "RACE.MI",  "name": "Ferrari N.V.",                "country": "IT", "index": "ftsemib"},
    {"ticker": "UCG.MI",   "name": "UniCredit",                   "country": "IT", "index": "ftsemib"},
    {"ticker": "HEIA.AS",  "name": "Heineken Holding",            "country": "NL", "index": "aex"},
    {"ticker": "MT.AS",    "name": "ArcelorMittal",               "country": "NL", "index": "aex"},
    {"ticker": "ABN.AS",   "name": "ABN AMRO",                    "country": "NL", "index": "aex"},
    {"ticker": "AAL.L",    "name": "Anglo American plc",          "country": "GB", "index": "ftse100"},
    {"ticker": "LLOY.L",   "name": "Lloyds Banking Group",        "country": "GB", "index": "ftse100"},
    {"ticker": "VOD.L",    "name": "Vodafone Group",              "country": "GB", "index": "ftse100"},
    {"ticker": "RKT.L",    "name": "Reckitt Benckiser",           "country": "GB", "index": "ftse100"},
]


def fetch_yf(ticker: str) -> dict:
    try:
        import yfinance as yf  # noqa
    except ImportError:
        return {"_placeholder": True, "ticker": ticker, "_warn": "yfinance not installed"}
    t = yf.Ticker(ticker)
    out = {"ticker": ticker}
    for field, fn in (
        ("info",       lambda: t.info),
        ("financials", lambda: t.financials.to_dict() if t.financials is not None and not t.financials.empty else {}),
        ("calendar",   lambda: (t.calendar.to_dict() if hasattr(t.calendar, "to_dict") else t.calendar)),
    ):
        try:
            out[field] = fn()
        except Exception as e:
            out[f"{field}_error"] = str(e)
    return out


def fetch_sec_local(ticker: str) -> dict:
    candidates = [
        SEC_DATA_DIR / "eu" / f"{ticker}.json",
        SEC_DATA_DIR / ticker.split(".")[0] / "20F.json",
    ]
    for c in candidates:
        if c.exists():
            try:
                return json.loads(c.read_text())
            except Exception:
                pass
    return {}


def build_enrich_json(t: dict, yf_data: dict, sec_data: dict) -> dict:
    """Schéma v1-9-complete CONFORME (patch sub-agent #112)."""
    from _schema_v19 import build_v19_skeleton
    target_norm = dict(t)
    target_norm.setdefault("sources", [t.get("index", "stoxx-residual")])
    return build_v19_skeleton(target_norm, yf_data, sec_data)


def process_one(t: dict, force=False) -> str:
    out_path = OUT_DIR / f"{t['ticker']}.json"
    if out_path.exists() and not force:
        return f"SKIP_EXISTS {t['ticker']}"
    yf_data = fetch_yf(t["ticker"])
    sec_data = fetch_sec_local(t["ticker"])
    enriched = build_enrich_json(t, yf_data, sec_data)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(enriched, indent=2, ensure_ascii=False))
    return f"OK {t['ticker']} (yf={enriched['_extraction']['yf_ok']})"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--full", action="store_true")
    p.add_argument("--force", action="store_true")
    p.add_argument("--write", action="store_true")
    args = p.parse_args()

    if not args.dry_run and not args.full:
        print("Specifier --dry-run OU --full", file=sys.stderr)
        sys.exit(2)

    targets = STOXX_TOP30[:1] if args.dry_run else STOXX_TOP30
    print(f"[extract_stoxx_top30] mode={'DRY' if args.dry_run else 'FULL'} write={args.write} targets={len(targets)}")
    for t in targets:
        if not args.write:
            out_path = OUT_DIR / f"{t['ticker']}.json"
            print(f"  PLAN {t['ticker']:12} -> {out_path.relative_to(REPO)} (exists={out_path.exists()})")
            continue
        msg = process_one(t, force=args.force)
        print(f"  {msg}")
        time.sleep(THROTTLE_SEC)


if __name__ == "__main__":
    main()
