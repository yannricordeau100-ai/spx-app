#!/usr/bin/env python3
"""
Audit complet du tableau "Indicateurs clés" sur les 660 stés clean_all.

Pour chaque sté + chaque KPI visible (post-filtre orderKpis + isGenericKpi
+ hidden_by_history_rule + history minimum 3/12/6 selon period_type), check
les 4 colonnes :
1. INDICATEUR : short + name_fr + name_en + chips (compare_key, type)
2. VALEUR (vs N-1) : value + unit + yoy
3. TENDANCE : sparkline (history >= seuil)
4. QUALITÉ · SIGNAL : signal text

Output : src/data/_kpi-rows-incomplete.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
DATA_DIR = REPO / "src" / "data"
ENRICH_DIR = DATA_DIR / "v2-pipeline-enrich"
PIPELINE_DIR = DATA_DIR / "v2-pipeline"

# Load generic library (copy of src/data/kpi-generic-library.json)
GENERIC_PATH = DATA_DIR / "kpi-generic-library.json"
GENERIC_SHORTS = set()
if GENERIC_PATH.exists():
    try:
        entries = json.loads(GENERIC_PATH.read_text())
        if isinstance(entries, list):
            for e in entries:
                if isinstance(e, dict) and isinstance(e.get("short"), str):
                    GENERIC_SHORTS.add(e["short"])
                elif isinstance(e, str):
                    GENERIC_SHORTS.add(e)
        elif isinstance(entries, dict):
            shorts = entries.get("shorts") or entries.get("generic") or []
            for s in shorts:
                GENERIC_SHORTS.add(s)
    except Exception:
        pass

# Load clean_all tickers from v1-9-pre-publication-audit.json
AUDIT_PATH = DATA_DIR / "v1-9-pre-publication-audit.json"
audit = json.loads(AUDIT_PATH.read_text())
CLEAN_ALL = sorted(
    [a["ticker"] for a in audit["audits"] if a.get("is_clean_all") is True]
)
print(f"[audit] {len(CLEAN_ALL)} stés clean_all", file=sys.stderr)


def required_for_period(pt: str | None) -> int:
    if pt == "quarter":
        return 12
    if pt == "semester":
        return 6
    return 3


def load_dataset(ticker: str) -> dict[str, Any] | None:
    """Load v2-pipeline data + merge enrich overrides (subset relevant to UI filtering)."""
    fname = ticker.lower()
    p = PIPELINE_DIR / f"{fname}.json"
    if not p.exists():
        # Try v1-9-complete fallback
        p = DATA_DIR / "v1-9-complete" / f"{ticker.upper()}.json"
        if not p.exists():
            return None
    try:
        data = json.loads(p.read_text())
    except Exception:
        return None

    # Merge enrich overrides relevant to filtering
    e_path = ENRICH_DIR / f"{fname}.json"
    if e_path.exists():
        try:
            enrich = json.loads(e_path.read_text())
            if isinstance(enrich.get("hero_kpi_override"), str) and enrich["hero_kpi_override"].strip():
                data["hero_kpi"] = enrich["hero_kpi_override"]
            if isinstance(enrich.get("_kpis_hidden_by_history_rule"), list):
                data["_kpis_hidden_by_history_rule"] = enrich["_kpis_hidden_by_history_rule"]
            # Apply yoy/signal/name_en overrides if present (so we audit AFTER any past overrides)
            for key in ("yoy_overrides", "signal_overrides", "name_en_overrides"):
                ov = enrich.get(key)
                if isinstance(ov, dict):
                    field = {"yoy_overrides": "yoy", "signal_overrides": "signal", "name_en_overrides": "name_en"}[key]
                    for k in data.get("kpis", []) or []:
                        if isinstance(k, dict) and k.get("short") in ov:
                            v = ov[k["short"]]
                            if v not in (None, "") and field not in k or not k.get(field):
                                k[field] = v
        except Exception:
            pass
    return data


def order_kpis(kpis: list[dict[str, Any]], hero_short: str | None) -> list[dict[str, Any]]:
    """Replicate src/lib/kpi-ordering.ts orderKpis logic."""
    filtered = [
        k for k in kpis
        if not k.get("is_short_history") and k.get("short") != hero_short
    ]
    wow: list[dict[str, Any]] = []
    generic: list[dict[str, Any]] = []
    for k in filtered:
        if k.get("is_wow"):
            wow.append(k)
        else:
            generic.append(k)
    ordered: list[dict[str, Any]] = []
    if wow:
        ordered.append(wow.pop(0))
    if wow:
        ordered.append(wow.pop(0))
    while wow or generic:
        if generic:
            ordered.append(generic.pop(0))
        if wow:
            ordered.append(wow.pop(0))
    return ordered


def visible_kpis(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Reproduce company-view orderedKpis filter."""
    kpis = data.get("kpis") or []
    if not isinstance(kpis, list):
        return []
    hero_short = data.get("hero_kpi")
    ordered = order_kpis(kpis, hero_short)
    hidden = set(data.get("_kpis_hidden_by_history_rule") or [])
    out = []
    for k in ordered:
        s = k.get("short")
        if s == hero_short:
            out.append(k)
            continue
        if s in GENERIC_SHORTS:
            continue
        if s in hidden:
            continue
        hist = k.get("history") if isinstance(k.get("history"), list) else []
        pt = k.get("period_type")
        if len(hist) < required_for_period(pt):
            continue
        out.append(k)
    return out


def check_kpi(k: dict[str, Any]) -> list[str]:
    """Return list of missing fields per column."""
    missing = []
    # Col 1: INDICATEUR
    if not (isinstance(k.get("short"), str) and k["short"].strip()):
        missing.append("short")
    if not (isinstance(k.get("name_fr"), str) and k["name_fr"].strip()):
        missing.append("name_fr")
    if not (isinstance(k.get("name_en"), str) and k["name_en"].strip()):
        missing.append("name_en")
    # Col 2: VALEUR + yoy
    val = k.get("value")
    if val is None or val == "":
        missing.append("value")
    yoy = k.get("yoy")
    has_yoy = (
        (isinstance(yoy, str) and yoy.strip() and yoy.strip().lower() != "n/a")
        or (isinstance(yoy, (int, float)) and yoy == yoy)  # not NaN
    )
    if not has_yoy:
        # Can we compute from history?
        hist = k.get("history") if isinstance(k.get("history"), list) else []
        nums = [x for x in hist if isinstance(x, (int, float))]
        if len(nums) >= 2 and nums[-2] != 0:
            missing.append("yoy_computable")
        else:
            missing.append("yoy")
    # Col 3: TENDANCE
    hist = k.get("history") if isinstance(k.get("history"), list) else []
    if len(hist) < 3:
        missing.append("history_short")
    # Col 4: SIGNAL
    sig = k.get("signal")
    has_sig = isinstance(sig, str) and sig.strip()
    if not has_sig:
        # We have live fallback that generates from history if >= 2 points
        if len(hist) >= 2:
            missing.append("signal_fallback_only")
        else:
            missing.append("signal")
    return missing


def main():
    out_rows = []
    stats = {
        "total_stes": 0,
        "stes_with_data": 0,
        "total_kpis_visible": 0,
        "missing_yoy": 0,
        "missing_yoy_but_computable": 0,
        "missing_signal": 0,
        "missing_signal_but_history_ok": 0,
        "missing_name_en": 0,
        "missing_name_fr": 0,
        "missing_value": 0,
        "history_short": 0,
    }
    stes_with_any_issue: set[str] = set()
    for ticker in CLEAN_ALL:
        stats["total_stes"] += 1
        data = load_dataset(ticker)
        if not data:
            continue
        stats["stes_with_data"] += 1
        vis = visible_kpis(data)
        stats["total_kpis_visible"] += len(vis)
        for k in vis:
            issues = check_kpi(k)
            if not issues:
                continue
            stes_with_any_issue.add(ticker)
            for it in issues:
                if it == "yoy":
                    stats["missing_yoy"] += 1
                elif it == "yoy_computable":
                    stats["missing_yoy_but_computable"] += 1
                elif it == "signal":
                    stats["missing_signal"] += 1
                elif it == "signal_fallback_only":
                    stats["missing_signal_but_history_ok"] += 1
                elif it == "name_en":
                    stats["missing_name_en"] += 1
                elif it == "name_fr":
                    stats["missing_name_fr"] += 1
                elif it == "value":
                    stats["missing_value"] += 1
                elif it == "history_short":
                    stats["history_short"] += 1
            out_rows.append({
                "ticker": ticker,
                "kpi_short": k.get("short"),
                "name_fr": k.get("name_fr"),
                "name_en": k.get("name_en"),
                "period_type": k.get("period_type"),
                "history_len": len(k.get("history") or []),
                "missing": issues,
            })

    out = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "stats": {**stats, "stes_with_issues": len(stes_with_any_issue)},
        "rows": out_rows,
    }
    out_path = DATA_DIR / "_kpi-rows-incomplete.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"[audit] wrote {out_path}", file=sys.stderr)
    print(json.dumps(stats, indent=2), file=sys.stderr)
    print(f"[audit] stes_with_issues = {len(stes_with_any_issue)}", file=sys.stderr)


if __name__ == "__main__":
    main()
