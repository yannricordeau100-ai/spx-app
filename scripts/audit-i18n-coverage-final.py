#!/usr/bin/env python3
"""
audit-i18n-coverage-final.py

Audit complet i18n EN sur les 549 stés publishable V1.9.

Champs vérifiés par sté :
- tagline_en (Company.tagline_en)            -> v2-pipeline/<t>.json
- description_en (description.simple.en + advanced.en) -> v2-pipeline-enrich/<t>.description.json
- KPIs name_en        -> kpi.name_en
- KPIs signal_en      -> kpi.signal_en
- KPIs explanation_en -> kpi.explanation_en (FILL/refined)
- Segments label_en   -> revenue_by_segment.slices[].label_en
- Geography label_en  -> revenue_by_geography.slices[].label_en

Sortie : src/data/v1-9-i18n-coverage-final.json
- totaux globaux par champ
- couverture par sté (5 catégories: 0/25/50/75/100)
- top 10 stés >=90% / top 10 <40%
- heuristic_acronyms vs llm_bound pour explanation_en/signal_en
"""
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "src" / "data" / "v2-pipeline"
ENRICH = ROOT / "src" / "data" / "v2-pipeline-enrich"
PUB_PATH = ROOT / "src" / "data" / "v1-9-publishable.json"
OUT = ROOT / "src" / "data" / "v1-9-i18n-coverage-final.json"


def load_json(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def is_non_empty_str(v):
    return isinstance(v, str) and v.strip() != ""


def load_company_data(t):
    """Merge v2-pipeline + v2-pipeline-enrich pour une sté (light merge sur les champs i18n)."""
    tl = t.lower()
    pipeline_path = PIPELINE / f"{tl}.json"
    enrich_path = ENRICH / f"{tl}.json"
    desc_path = ENRICH / f"{tl}.description.json"

    pipeline = load_json(pipeline_path) or {}
    enrich = load_json(enrich_path) or {}
    desc = load_json(desc_path) or {}

    # Merge: enrich extends pipeline for fields like risks/segments/geo
    merged = dict(pipeline)
    for k, v in enrich.items():
        if k not in merged or merged.get(k) in (None, "", [], {}):
            merged[k] = v
        elif k in ("revenue_by_segment", "revenue_by_geography") and isinstance(v, dict):
            # prefer enrich version if it has slices with label_en
            if v.get("slices") and (not merged[k].get("slices")):
                merged[k] = v
    return merged, desc


# Acronymes typiques couverts par heuristique sub-agent #55
ACRONYM_SHORTS = {
    "EPS", "EBITDA", "EBIT", "FCF", "ROE", "ROA", "ROIC", "TAM", "SAM", "SOM",
    "ARR", "MRR", "CAC", "LTV", "ARPU", "ARPP", "DAU", "MAU", "DAP", "MoM",
    "YoY", "QoQ", "CAGR", "P/E", "P/B", "EV", "WACC", "NPV", "IRR", "ROCE",
    "COGS", "G&A", "SG&A", "R&D", "Capex", "Opex", "NIM", "NPL", "AUM",
    "AUC", "CET1", "RWA", "LCR", "NSFR", "G-SIB", "ROTCE", "ROTE", "DPS",
    "BPS", "ABF", "GMV", "TAC", "TVL", "AOV", "GAAP", "TTM", "DCF",
}


def classify_short(short):
    if not short:
        return "long"
    s = short.strip()
    if s in ACRONYM_SHORTS:
        return "acronym"
    # short capital-only <= 6 chars = likely acronym
    if len(s) <= 6 and s.isupper():
        return "acronym"
    # contains lowercase or more than 6 chars and not all-cap -> long label
    return "long"


def audit():
    pub = load_json(PUB_PATH)
    if not pub:
        print("ERR: publishable list not found", file=sys.stderr)
        sys.exit(1)
    tickers = pub["tickers"]

    totals = {
        "stes": len(tickers),
        "tagline_en_ok": 0,
        "description_en_simple_ok": 0,
        "description_en_advanced_ok": 0,
        "kpi_total": 0,
        "kpi_name_en": 0,
        "kpi_signal_en": 0,
        "kpi_explanation_en": 0,
        "seg_slices_total": 0,
        "seg_label_en": 0,
        "geo_slices_total": 0,
        "geo_label_en": 0,
    }

    # Pour la classification des shorts (acronyme vs long)
    short_class_missing_explanation_en = {"acronym": 0, "long": 0, "no_short": 0}
    short_class_missing_signal_en = {"acronym": 0, "long": 0, "no_short": 0}

    per_ste = []

    for t in tickers:
        d, desc = load_company_data(t)
        kpis = d.get("kpis") or []
        kpi_total = len(kpis)
        kpi_name_en = sum(1 for k in kpis if is_non_empty_str(k.get("name_en")))
        kpi_signal_en = sum(1 for k in kpis if is_non_empty_str(k.get("signal_en")))
        kpi_explanation_en = sum(1 for k in kpis if is_non_empty_str(k.get("explanation_en")))

        # Classifier les manquants
        for k in kpis:
            short = k.get("short")
            klass = classify_short(short) if is_non_empty_str(short) else "no_short"
            if not is_non_empty_str(k.get("explanation_en")):
                short_class_missing_explanation_en[klass] += 1
            if not is_non_empty_str(k.get("signal_en")):
                short_class_missing_signal_en[klass] += 1

        # Segments
        seg = d.get("revenue_by_segment") or {}
        seg_slices = seg.get("slices") or []
        seg_total = len(seg_slices)
        seg_label_en = sum(1 for s in seg_slices if is_non_empty_str(s.get("label_en")))

        # Geo
        geo = d.get("revenue_by_geography") or {}
        geo_slices = geo.get("slices") or []
        geo_total = len(geo_slices)
        geo_label_en = sum(1 for s in geo_slices if is_non_empty_str(s.get("label_en")))

        # Note: per CLAUDE.md §6, taglines stay in English (companies' original).
        # `tagline` field IS the EN tagline. `tagline_en` n'est pas un champ séparé.
        tagline_en = is_non_empty_str(d.get("tagline_en")) or is_non_empty_str(d.get("tagline"))
        # description (depuis desc fichier seulement)
        desc_simple_en = bool(desc and desc.get("simple", {}).get("en"))
        desc_adv_en = bool(desc and desc.get("advanced", {}).get("en"))

        # Score couverture EN (0-100) pour cette sté
        # Pondéré: tagline(5), desc_simple(10), desc_adv(10), kpi_name_en(20), kpi_signal_en(15),
        #          kpi_explanation_en(20), seg_label_en(10), geo_label_en(10)
        def pct(n, total):
            return (n / total * 100) if total > 0 else 100  # 100 si pas applicable

        score_parts = {
            "tagline_en": (5, 100 if tagline_en else 0),
            "desc_simple_en": (10, 100 if desc_simple_en else 0),
            "desc_adv_en": (10, 100 if desc_adv_en else 0),
            "kpi_name_en": (20, pct(kpi_name_en, kpi_total)),
            "kpi_signal_en": (15, pct(kpi_signal_en, kpi_total)),
            "kpi_explanation_en": (20, pct(kpi_explanation_en, kpi_total)),
            "seg_label_en": (10, pct(seg_label_en, seg_total)),
            "geo_label_en": (10, pct(geo_label_en, geo_total)),
        }
        total_w = sum(w for w, _ in score_parts.values())
        weighted = sum(w * v for w, v in score_parts.values()) / total_w

        totals["tagline_en_ok"] += int(tagline_en)
        totals["description_en_simple_ok"] += int(desc_simple_en)
        totals["description_en_advanced_ok"] += int(desc_adv_en)
        totals["kpi_total"] += kpi_total
        totals["kpi_name_en"] += kpi_name_en
        totals["kpi_signal_en"] += kpi_signal_en
        totals["kpi_explanation_en"] += kpi_explanation_en
        totals["seg_slices_total"] += seg_total
        totals["seg_label_en"] += seg_label_en
        totals["geo_slices_total"] += geo_total
        totals["geo_label_en"] += geo_label_en

        per_ste.append({
            "ticker": t,
            "score": round(weighted, 1),
            "tagline_en": tagline_en,
            "desc_simple_en": desc_simple_en,
            "desc_advanced_en": desc_adv_en,
            "kpi_total": kpi_total,
            "kpi_name_en": kpi_name_en,
            "kpi_signal_en": kpi_signal_en,
            "kpi_explanation_en": kpi_explanation_en,
            "seg_total": seg_total,
            "seg_label_en": seg_label_en,
            "geo_total": geo_total,
            "geo_label_en": geo_label_en,
        })

    # Coverage pct
    cov = {
        "tagline_en_pct": round(totals["tagline_en_ok"] / totals["stes"] * 100, 1),
        "description_en_simple_pct": round(totals["description_en_simple_ok"] / totals["stes"] * 100, 1),
        "description_en_advanced_pct": round(totals["description_en_advanced_ok"] / totals["stes"] * 100, 1),
        "kpi_name_en_pct": round(totals["kpi_name_en"] / totals["kpi_total"] * 100, 1) if totals["kpi_total"] else 0,
        "kpi_signal_en_pct": round(totals["kpi_signal_en"] / totals["kpi_total"] * 100, 1) if totals["kpi_total"] else 0,
        "kpi_explanation_en_pct": round(totals["kpi_explanation_en"] / totals["kpi_total"] * 100, 1) if totals["kpi_total"] else 0,
        "seg_label_en_pct": round(totals["seg_label_en"] / totals["seg_slices_total"] * 100, 1) if totals["seg_slices_total"] else 0,
        "geo_label_en_pct": round(totals["geo_label_en"] / totals["geo_slices_total"] * 100, 1) if totals["geo_slices_total"] else 0,
    }

    # Top 10 stés >= 90% / <40%
    sorted_ste = sorted(per_ste, key=lambda x: x["score"], reverse=True)
    top_high = [s for s in sorted_ste if s["score"] >= 90][:10]
    top_low = sorted(per_ste, key=lambda x: x["score"])[:10]

    # Distribution
    buckets = {"100": 0, "90-99": 0, "75-89": 0, "50-74": 0, "25-49": 0, "0-24": 0}
    for s in per_ste:
        sc = s["score"]
        if sc >= 100:
            buckets["100"] += 1
        elif sc >= 90:
            buckets["90-99"] += 1
        elif sc >= 75:
            buckets["75-89"] += 1
        elif sc >= 50:
            buckets["50-74"] += 1
        elif sc >= 25:
            buckets["25-49"] += 1
        else:
            buckets["0-24"] += 1

    result = {
        "generated_at": "2026-05-21T05:10:00Z",
        "scope": "V1.9 publishable (549 stés) - audit final post labels seg/geo 100%",
        "totals": totals,
        "coverage_pct": cov,
        "score_distribution": buckets,
        "missing_explanation_en_breakdown": short_class_missing_explanation_en,
        "missing_signal_en_breakdown": short_class_missing_signal_en,
        "top_10_high_coverage": top_high,
        "top_10_low_coverage": top_low,
        "stes": sorted_ste,
    }

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK -> {OUT}")
    print(f"  stes: {totals['stes']}")
    print(f"  coverage_pct: {cov}")
    print(f"  distribution: {buckets}")
    print(f"  missing explanation_en by short type: {short_class_missing_explanation_en}")
    print(f"  missing signal_en by short type: {short_class_missing_signal_en}")


if __name__ == "__main__":
    audit()
