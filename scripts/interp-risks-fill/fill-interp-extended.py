#!/usr/bin/env python3
"""
fill-interp-extended.py — Sub-agent #88 Part 1 extension

Pour les 17 stés b_interpretation résiduelles après fill-interp-types.py,
extend patterns avec EBIT, ROCE, ROTE, ROE, ROIC, etc. + force Vigilance
override sur le KPI qui matche le plus.

Approche conservative : on ne touche que si la sté est encore KO et que
l'extension trouve un match Profitability/Margin/Cost/Investment.
"""
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "src" / "data"
NOW_ISO = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

# Extended patterns aimed at Vigilance unlock (Profitability / Margin / Cost / Investment)
EXTENDED_VIGILANCE = [
    (r"\bebit\b|\bebitda\b", "Profitability"),
    (r"\broe\b|\broic\b|\brote\b|\broce\b|\brotce\b", "Profitability"),
    (r"\bpre[\s-]?tax\s+profit\b|\bafter[\s-]?tax\s+profit\b", "Profitability"),
    (r"\badjusted\s+(operating|net)\b", "Profitability"),
    (r"\boperating\s+earnings\b|\bnet\s+earnings\b", "Profitability"),
    (r"\bunderlying\s+(profit|income|earnings)\b", "Profitability"),
    (r"\bcore\s+(profit|income|earnings)\b", "Profitability"),
    (r"\b(adj|adjusted)\s+ebit\b", "Profitability"),
    # Margin extras
    (r"\bcontribution\s+margin\b|\bsegment\s+margin\b", "Margin"),
    (r"\badjusted\s+margin\b", "Margin"),
    # Cost extras
    (r"\bsg&a\b|\bsga\b|\bselling\s+general\b", "Cost"),
    (r"\binterest\s+expense\b", "Cost"),
    (r"\btax\s+expense\b|\btax\s+rate\b", "Cost"),
    # Investment extras
    (r"\binnovation\s+spend\b|\bcapital\s+expenditure\b", "Investment"),
    (r"\bgrowth\s+capex\b|\bmaintenance\s+capex\b", "Investment"),
]


def detect_vigilance(short, name_fr=""):
    haystack = f"{short or ''} {name_fr or ''}".lower()
    for pattern, ty in EXTENDED_VIGILANCE:
        if re.search(pattern, haystack, re.IGNORECASE):
            return ty
    return None


def load_company(ticker):
    for p in [
        DATA / "v1-9-complete" / f"{ticker}.json",
        DATA / "v2-pipeline" / f"{ticker.lower()}.json",
        DATA / "v2-pipeline" / f"{ticker}.json",
    ]:
        if p.exists():
            try:
                return json.load(p.open())
            except Exception:
                continue
    return None


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


def main():
    # Re-read latest audit to get current b_interp KO tickers
    audit = json.load((DATA / "v1-9-pre-publication-audit.json").open())
    audits = audit["audits"]
    b_ko = [
        r["ticker"]
        for r in audits
        if "b_interpretation" in r.get("failed_criteria", [])
    ]
    print(f"Current b_interpretation KO: {len(b_ko)}", file=sys.stderr)

    written = 0
    skipped = 0
    for t in b_ko:
        co = load_company(t)
        if not co:
            skipped += 1
            continue
        hero_short = co.get("hero_kpi")
        kpis = co.get("kpis", [])
        if not isinstance(kpis, list):
            skipped += 1
            continue

        en = load_enrich(t)
        cur_overrides = dict(en.get("kpis_type_overrides", {}))
        added = 0
        for k in kpis:
            if not isinstance(k, dict):
                continue
            short = k.get("short", "") or ""
            if not short or short == hero_short:
                continue
            # Skip if override already set to something
            if short in cur_overrides:
                continue
            new_t = detect_vigilance(short, k.get("name_fr", ""))
            if new_t:
                cur_overrides[short] = new_t
                added += 1
                # Just one Vigilance match is enough to unlock the cascade
                if added >= 2:
                    break

        if added > 0:
            en["kpis_type_overrides"] = cur_overrides
            existing_src = en.get("_kpis_type_overrides_source", "")
            if "fill-interp-extended" not in existing_src:
                en["_kpis_type_overrides_source"] = (
                    f"{existing_src} + scripts/interp-risks-fill/fill-interp-extended.py "
                    "(sub-agent #88, vigilance unlock)"
                )
            en["_kpis_type_overrides_extended_at"] = NOW_ISO
            save_enrich(t, en)
            written += 1

    print(f"Extended overrides written for: {written}/{len(b_ko)} (skipped: {skipped})")


if __name__ == "__main__":
    main()
