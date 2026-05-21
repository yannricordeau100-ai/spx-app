#!/usr/bin/env python3
"""
fill-interp-types.py — Sub-agent #88 Part 1
Applique heuristic-fill-kpi-types.py ciblé sur les 76 stés b_interpretation KO
résiduelles (post-#83/#86). Pure heuristique pattern matching, pas de LLM.

Output: v2-pipeline-enrich/<lc>.json champ kpis_type_overrides (field-by-field
merge via load-company.ts ligne 488+ et audit ligne 236+).
"""
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime
import importlib.util

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "src" / "data"

# Import heuristic-fill-kpi-types.py for pattern definitions
spec = importlib.util.spec_from_file_location(
    "hfk",
    str(ROOT / "scripts" / "heuristic-fill-kpi-types.py"),
)
hfk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hfk)


def load_company(ticker):
    for p in [
        DATA / "v1-9-complete" / f"{ticker}.json",
        DATA / "v2-pipeline" / f"{ticker.lower()}.json",
        DATA / "v2-pipeline" / f"{ticker}.json",
    ]:
        if p.exists():
            try:
                return json.load(p.open()), str(p.relative_to(ROOT))
            except Exception:
                continue
    return None, None


def load_enrich(ticker):
    p = DATA / "v2-pipeline-enrich" / f"{ticker.lower()}.json"
    if p.exists():
        try:
            return json.load(p.open())
        except Exception:
            return {}
    return {}


def save_enrich(ticker, enrich):
    p = DATA / "v2-pipeline-enrich" / f"{ticker.lower()}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(enrich, f, ensure_ascii=False, indent=2)


def compute_overrides(kpis):
    overrides = {}
    for k in kpis:
        if not isinstance(k, dict):
            continue
        short = k.get("short", "") or ""
        if not short:
            continue
        cur_type = k.get("type", "") or ""

        force = hfk.detect_type_force(short)
        if force and cur_type != force:
            overrides[short] = force
            continue
        if cur_type in hfk.RECOGNIZED_TYPES:
            continue
        if cur_type and cur_type not in hfk.RECLASSIFY_TYPES:
            # Type spécifique inconnu : skip prudent
            continue
        new_type = hfk.detect_type(short, k.get("name_fr", ""))
        if new_type:
            overrides[short] = new_type
    return overrides


def main():
    # Load target tickers
    ko_file = Path("/tmp/b_interp_ko_tickers.json")
    if not ko_file.exists():
        print("ERROR: /tmp/b_interp_ko_tickers.json missing", file=sys.stderr)
        sys.exit(1)
    tickers = json.load(ko_file.open())
    print(f"Targeting {len(tickers)} b_interpretation KO tickers", file=sys.stderr)

    written = 0
    no_overrides = 0
    no_data = 0
    for t in tickers:
        co, src = load_company(t)
        if not co:
            no_data += 1
            continue
        kpis = co.get("kpis", [])
        if not isinstance(kpis, list):
            no_overrides += 1
            continue
        overrides = compute_overrides(kpis)
        if not overrides:
            no_overrides += 1
            continue
        en = load_enrich(t)
        en["kpis_type_overrides"] = overrides
        en["_kpis_type_overrides_source"] = (
            "scripts/interp-risks-fill/fill-interp-types.py "
            "(sub-agent #88, heuristic pattern match)"
        )
        en["_kpis_type_overrides_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        save_enrich(t, en)
        written += 1

    print(f"\n=== fill-interp-types.py REPORT ===")
    print(f"Tickers processed: {len(tickers)}")
    print(f"Tickers written  : {written}")
    print(f"No overrides     : {no_overrides}")
    print(f"No data          : {no_data}")


if __name__ == "__main__":
    main()
