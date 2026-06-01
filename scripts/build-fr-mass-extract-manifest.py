#!/usr/bin/env python3
"""
Construit le manifest récapitulatif de l'agrégation FR mass extract.

Input : /tmp/eu5n-fr-mass-extract-unified/<TICKER>.unified.json
Output : /tmp/eu5n-fr-mass-extract-unified/_MANIFEST.json

Classifie chaque société en :
  - fully_aggregated : >=8 sources sur 11 max possibles (base+v2+8 enrich)
  - partial : 3-7 sources
  - skeleton_only : 1-2 sources, KPIs majoritairement null
  - missing : 0 source (ne devrait pas arriver à ce stade)

Indices :
  - CAC40_top et SBF120 sont déduits via une liste statique. C'est
    indicatif uniquement (la liste source de vérité reste côté Mettrik).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

UNIFIED_DIR = Path("/tmp/eu5n-fr-mass-extract-unified")
TOTAL_TARGET = 86

# Indicatif uniquement - liste à valider côté Mettrik.
CAC40_TICKERS = {
    "AC.PA", "ACA.PA", "AI.PA", "AIR.PA", "BN.PA", "BNP.PA", "CA.PA",
    "CAP.PA", "CS.PA", "DG.PA", "DSY.PA", "EL.PA", "EN.PA", "ENGI.PA",
    "ERF.PA", "GLE.PA", "HO.PA", "KER.PA", "LR.PA", "MC.PA", "ML.PA",
    "OR.PA", "ORA.PA", "PUB.PA", "RI.PA", "RMS.PA", "RNO.PA", "SAF.PA",
    "SAN.PA", "SGO.PA", "STLA.PA", "SU.PA", "SW.PA", "TEP.PA", "TTE.PA",
    "URW.PA", "VIE.PA", "VIV.PA", "WLN.PA",
}

# Sources possibles
ALL_SOURCES = [
    "base",
    "v2",
    "segments-geo",
    "risks",
    "gov-ai",
    "events-history",
    "market-positions",
    "transcript-summary",
    "i18n",
    "metadata-bundle",
]
MAX_SOURCES = len(ALL_SOURCES)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def kpi_value_ratio(unified: dict) -> float:
    kpis = unified.get("kpis") or []
    if not kpis:
        return 0.0
    filled = sum(1 for k in kpis if k.get("value") is not None)
    return filled / max(len(kpis), 1)


def classify(unified: dict) -> tuple[str, list[str]]:
    sources = unified.get("_sources_present") or []
    n = len(sources)
    flags: list[str] = []
    hero = unified.get("hero_kpi") or {}
    if hero.get("value") is None:
        flags.append("hero_value_missing")
    ratio = kpi_value_ratio(unified)
    if ratio < 0.4:
        flags.append("kpis_mostly_null")
    if "segments-geo" not in sources:
        flags.append("no_segments_geo")
    if "risks" not in sources:
        flags.append("no_risks")
    if "gov-ai" not in sources:
        flags.append("no_gov_ai")
    if "events-history" not in sources:
        flags.append("no_events_history")
    if "transcript-summary" not in sources:
        flags.append("no_transcript_summary")
    if "i18n" not in sources:
        flags.append("no_i18n")

    if n >= 8:
        status = "fully_aggregated"
    elif n >= 3:
        status = "partial"
    elif n >= 1:
        status = "skeleton_only"
    else:
        status = "missing"
    return status, flags


def main() -> int:
    if not UNIFIED_DIR.exists():
        print(f"ERR  {UNIFIED_DIR} absent ; run aggregate first", file=sys.stderr)
        return 1
    files = sorted(UNIFIED_DIR.glob("*.unified.json"))
    by_status = {
        "fully_aggregated": 0,
        "partial": 0,
        "skeleton_only": 0,
        "missing": 0,
    }
    completeness: list[dict] = []
    ready: list[str] = []
    needs_more: list[str] = []
    cac40_present: list[str] = []
    sbf120_only: list[str] = []

    for fp in files:
        with fp.open("r", encoding="utf-8") as f:
            d = json.load(f)
        ticker = d.get("ticker") or fp.stem.replace(".unified", "")
        status, flags = classify(d)
        by_status[status] += 1
        completeness.append({
            "ticker": ticker,
            "name": d.get("name"),
            "sources_count": f"{len(d.get('_sources_present') or [])}/{MAX_SOURCES}",
            "sources_present": d.get("_sources_present") or [],
            "status": status,
            "flags": flags,
            "hero_value_present": (d.get("hero_kpi") or {}).get("value") is not None,
            "kpi_value_ratio": round(kpi_value_ratio(d), 2),
        })
        # Critères ready_for_yann_validation : >=6 sources, hero présent
        if (
            status == "fully_aggregated"
            and "hero_value_missing" not in flags
            and "kpis_mostly_null" not in flags
        ):
            ready.append(ticker)
        else:
            needs_more.append(ticker)
        if ticker in CAC40_TICKERS:
            cac40_present.append(ticker)
        else:
            sbf120_only.append(ticker)

    manifest = {
        "generated_at": now_iso(),
        "total_stes_target": TOTAL_TARGET,
        "total_stes_processed": len(files),
        "by_status": by_status,
        "by_country_indices": {
            "CAC40_top": sorted(cac40_present),
            "SBF120": sorted(sbf120_only),
        },
        "max_sources_possible": MAX_SOURCES,
        "all_sources": ALL_SOURCES,
        "completeness_per_ste": completeness,
        "ready_for_yann_validation": sorted(ready),
        "needs_more_extraction": sorted(needs_more),
        "_aggregator_version": "1.0",
        "_note": (
            "CAC40_top/SBF120 listes indicatives - source de vérité côté Mettrik. "
            "ready_for_yann_validation = >=8 sources + hero value + KPIs >=40% remplis."
        ),
    }
    out = UNIFIED_DIR / "_MANIFEST.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"manifest written: {out}", file=sys.stderr)
    print(f"status: {by_status}", file=sys.stderr)
    print(f"ready: {len(ready)} | needs_more: {len(needs_more)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
