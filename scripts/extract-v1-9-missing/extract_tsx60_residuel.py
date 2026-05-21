#!/usr/bin/env python3
"""
extract_tsx60_residuel.py — Sub-agent #109 / V1.9 manquantes
=============================================================
Extraction TSX 60 résiduel (52 tickers manquants sur 60).

Tickers cibles : tous les TSX 60 non audités dans v1-9-pre-publication-audit.json.
Pipeline : yfinance + sec-data/cat2-canadian/ si dispo.
Cerebras : aucun appel direct, markers TODO_CEREBRAS.
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

# Source de vérité : computed gap from v1-9-universe.json vs v1-9-pre-publication-audit.json
TSX60_MISSING = [
    "ABX.TO", "ATD.TO", "BAM.TO", "BCE.TO", "BIP-UN.TO", "BMO.TO", "BN.TO", "BNS.TO",
    "CAE.TO", "CCL-B.TO", "CLS.TO", "CNQ.TO", "CNR.TO", "CP.TO", "CSU.TO", "CTC-A.TO",
    "DOL.TO", "EMA.TO", "ENB.TO", "FFH.TO", "FNV.TO", "FSV.TO", "GIB-A.TO", "GIL.TO",
    "H.TO", "IFC.TO", "IMO.TO", "K.TO", "L.TO", "MG.TO", "MRU.TO", "NA.TO",
    "NTR.TO", "OTEX.TO", "POW.TO", "PPL.TO", "QSR.TO", "RCI-B.TO", "RY.TO", "SAP.TO",
    "SHOP.TO", "SU.TO", "T.TO", "TD.TO", "TECK-B.TO", "TOU.TO", "TRI.TO", "TRP.TO",
    "WCN.TO", "WN.TO", "WPM.TO", "WSP.TO",
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
    """Canada cat2 SEC filings local lookup (cross-listed sur NYSE pour la plupart)."""
    candidates = [
        SEC_DATA_DIR / "cat2-canadian" / f"{ticker}.json",
        SEC_DATA_DIR / "cat2-canadian" / f"{ticker.split('.')[0]}.json",
        SEC_DATA_DIR / "canada" / f"{ticker}.json",
    ]
    for c in candidates:
        if c.exists():
            try:
                return json.loads(c.read_text())
            except Exception:
                pass
    return {}


def build_enrich_json(ticker: str, yf_data: dict, sec_data: dict) -> dict:
    """Schéma v1-9-complete CONFORME (patch sub-agent #112)."""
    from _schema_v19 import build_v19_skeleton
    info = yf_data.get("info", {}) or {}
    target = {
        "ticker": ticker,
        "name": info.get("longName") or info.get("shortName") or ticker,
        "country": "CA",
        "sources": ["tsx60"],
    }
    return build_v19_skeleton(target, yf_data, sec_data)


def process_one(ticker: str, force=False) -> str:
    out_path = OUT_DIR / f"{ticker}.json"
    if out_path.exists() and not force:
        return f"SKIP_EXISTS {ticker}"
    yf_data = fetch_yf(ticker)
    sec_data = fetch_sec_local(ticker)
    enriched = build_enrich_json(ticker, yf_data, sec_data)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(enriched, indent=2, ensure_ascii=False))
    return f"OK {ticker} (yf={enriched['_extraction']['yf_ok']})"


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

    targets = TSX60_MISSING[:1] if args.dry_run else TSX60_MISSING
    print(f"[extract_tsx60_residuel] mode={'DRY' if args.dry_run else 'FULL'} write={args.write} targets={len(targets)}")
    for ticker in targets:
        if not args.write:
            out_path = OUT_DIR / f"{ticker}.json"
            print(f"  PLAN {ticker:12} -> {out_path.relative_to(REPO)} (exists={out_path.exists()})")
            continue
        msg = process_one(ticker, force=args.force)
        print(f"  {msg}")
        time.sleep(THROTTLE_SEC)


if __name__ == "__main__":
    main()
