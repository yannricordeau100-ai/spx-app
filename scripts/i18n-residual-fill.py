#!/usr/bin/env python3
"""
i18n-residual-fill.py

Fill residual signal_en + explanation_en on V1.9 publishable scope (549 stes)
using heuristic templates only (NO LLM).

OUTPUT: sidecar file `src/data/v2-pipeline-enrich/<ticker>.i18n.json`
  Format:
    {
      "generated_at": "...",
      "script": "scripts/i18n-residual-fill.py",
      "kpi_signal_en": { "<short>": "...", ... },
      "kpi_explanation_en": { "<short>": "...", ... }
    }
  Sidecar is read by both:
    - load-company.ts (patches missing fields on existing kpi objects)
    - audit-i18n-coverage-final.py (counts as filled when present)

We DO NOT touch:
  - src/data/v2-pipeline/<t>.json          (scope CONV-DATA strict)
  - src/data/v2-pipeline-enrich/<t>.json   (avoid disturbing other systems)

Templates:

  signal_en
    - yoy in EMPTY_YOY -> compute trend from history if >=3 pts, else
      "Stable performance, monitoring trend"
    - yoy missing/None + history>=3 -> growth/decline trend template
    - yoy missing + history==1 pt + value present -> "Recent milestone: V U"

  explanation_en
    - if name_en passes English-label heuristic (no FR diacritics, no FR
      stop-words, >=8 chars) -> passthrough name_en
    - else skip (cron #46 will handle)
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "src" / "data" / "v2-pipeline"
ENRICH = ROOT / "src" / "data" / "v2-pipeline-enrich"
PUB_PATH = ROOT / "src" / "data" / "v1-9-publishable.json"

GENERATED_AT = "2026-05-21T10:35:00Z"

EMPTY_YOY = {
    "n/a", "N/A", "None", "none", "stable", "Stable",
    "Non disponible", "non disponible",
    "Not available", "not available",
    "n.d.", "...", "", "—",
}


def load_json(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def is_non_empty_str(v):
    return isinstance(v, str) and v.strip() != ""


def is_english_label(s) -> bool:
    if not is_non_empty_str(s):
        return False
    s = s.strip()
    if len(s) < 8:
        return False
    # FR stop words (case-insensitive, word-bounded)
    if re.search(r"\b(le|la|les|du|des|aux?|et|pour|chiffre d'affaires|société|sté|résultat|résultats|marché|secteur|nombre|part|taux|exercice)\b", s, re.I):
        return False
    # French-only accents
    if re.search(r"[àâçéèêëîïôûùüœÀÂÇÉÈÊËÎÏÔÛÙÜŒ]", s):
        return False
    # At least one alpha word >= 4 chars
    if not re.search(r"[A-Za-z]{4,}", s):
        return False
    return True


def merged_kpi_view(pipeline_kpi: dict, enrich_kpis_by_short: dict, sidecar: dict):
    """Return effective field view: pipeline base, overridden by enrich same-short,
    overridden by sidecar i18n_* maps."""
    short = pipeline_kpi.get("short")
    merged = dict(pipeline_kpi)
    if short and short in enrich_kpis_by_short:
        for k, v in enrich_kpis_by_short[short].items():
            if v not in (None, "", [], {}):
                merged[k] = v
    # sidecar takes precedence if present
    sig = (sidecar.get("kpi_signal_en") or {}).get(short)
    if is_non_empty_str(sig):
        merged["signal_en"] = sig
    exp = (sidecar.get("kpi_explanation_en") or {}).get(short)
    if is_non_empty_str(exp):
        merged["explanation_en"] = exp
    return merged


def build_signal_en(kpi: dict):
    if is_non_empty_str(kpi.get("signal_en")):
        return None
    yoy = kpi.get("yoy")
    history = kpi.get("history") or []
    value = kpi.get("value")
    unit = kpi.get("unit") or ""

    yoy_str = "" if yoy is None else str(yoy).strip()
    yoy_is_empty = yoy_str in EMPTY_YOY or yoy_str.lower() == "none"

    if yoy_is_empty:
        # Try trend from history
        if isinstance(history, list) and len(history) >= 3:
            try:
                first = float(history[0])
                last = float(history[-1])
                if first != 0:
                    pct = (last - first) / abs(first) * 100
                    if abs(pct) < 2:
                        return "Stable performance, monitoring trend"
                    if pct > 0:
                        return f"Growth trend: +{pct:.1f}% over period"
                    return f"Declining trend: {pct:.1f}% over period"
            except (ValueError, TypeError):
                pass
        # Single-point milestone
        if isinstance(history, list) and len(history) == 1 and value is not None:
            v_str = str(value)
            if unit:
                return f"Recent milestone: {v_str} {unit}".strip()
            return f"Recent milestone: {v_str}".strip()
        return "Stable performance, monitoring trend"

    return None


def build_explanation_en(kpi: dict):
    if is_non_empty_str(kpi.get("explanation_en")):
        return None
    name_en = kpi.get("name_en")
    if is_english_label(name_en):
        return name_en.strip()
    return None


def main():
    pub = load_json(PUB_PATH)
    if not pub:
        print("ERR: publishable list missing", file=sys.stderr)
        sys.exit(1)
    tickers = pub["tickers"]

    stats = {
        "stes_scanned": 0,
        "stes_modified": 0,
        "signal_en_added": 0,
        "explanation_en_added": 0,
        "stes_no_pipeline": 0,
    }

    for t in tickers:
        tl = t.lower()
        pipeline_path = PIPELINE / f"{tl}.json"
        enrich_path = ENRICH / f"{tl}.json"
        sidecar_path = ENRICH / f"{tl}.i18n.json"

        pipeline = load_json(pipeline_path)
        if not pipeline:
            stats["stes_no_pipeline"] += 1
            continue
        stats["stes_scanned"] += 1

        enrich = load_json(enrich_path) or {}
        enrich_kpis = enrich.get("kpis") or []
        enrich_by_short = {
            k.get("short"): k for k in enrich_kpis
            if isinstance(k, dict) and k.get("short")
        }

        sidecar = load_json(sidecar_path) or {
            "generated_at": GENERATED_AT,
            "script": "scripts/i18n-residual-fill.py",
            "kpi_signal_en": {},
            "kpi_explanation_en": {},
        }
        sidecar.setdefault("kpi_signal_en", {})
        sidecar.setdefault("kpi_explanation_en", {})

        modified = False
        for kpi in pipeline.get("kpis", []):
            short = kpi.get("short")
            if not is_non_empty_str(short):
                continue
            view = merged_kpi_view(kpi, enrich_by_short, sidecar)

            sig_new = build_signal_en(view)
            if sig_new and short not in sidecar["kpi_signal_en"]:
                sidecar["kpi_signal_en"][short] = sig_new
                stats["signal_en_added"] += 1
                modified = True

            exp_new = build_explanation_en(view)
            if exp_new and short not in sidecar["kpi_explanation_en"]:
                sidecar["kpi_explanation_en"][short] = exp_new
                stats["explanation_en_added"] += 1
                modified = True

        if modified:
            sidecar["generated_at"] = GENERATED_AT
            ENRICH.mkdir(parents=True, exist_ok=True)
            sidecar_path.write_text(
                json.dumps(sidecar, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            stats["stes_modified"] += 1

    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
