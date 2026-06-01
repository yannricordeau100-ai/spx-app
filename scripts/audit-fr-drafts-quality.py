#!/usr/bin/env python3
"""
Audit qualité des drafts FR mass extract agrégés (pré-validation Yann).

Pour chaque ticker `<TICKER>.unified.json`, vérifie une série de critères
de qualité minimale et catégorise la société en :
  - ready_to_merge   : tous les critères critiques passent
  - needs_review     : 1-2 flags non critiques
  - skip             : flags critiques (hero_kpi_value_missing, insufficient_kpis)

Critères :
  - hero_kpi.value non null              [critical -> kpi_value_missing]
  - >=4 KPIs avec value non null         [critical -> insufficient_kpis]
  - hero_history >= 3 ans                [warning  -> short_history]
  - segments + geography présents        [warning  -> missing_segments_or_geo]
  - risks >= 3                           [warning  -> few_risks]
  - governance.ceo_name non null         [warning  -> no_ceo_name]
  - description long FR >= 100 chars     [warning  -> short_description]

Output :
  /tmp/eu5n-fr-mass-extract-unified/_AUDIT.json
  /tmp/eu5n-fr-mass-extract-unified/_AUDIT.md
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

UNIFIED_DIR = Path("/tmp/eu5n-fr-mass-extract-unified")

CRITICAL_FLAGS = {"kpi_value_missing", "insufficient_kpis"}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def audit_one(d: dict) -> list[str]:
    flags: list[str] = []
    hero = d.get("hero_kpi") or {}
    if hero.get("value") is None:
        flags.append("kpi_value_missing")

    kpis = d.get("kpis") or []
    kpis_with_value = [k for k in kpis if k.get("value") is not None]
    if len(kpis_with_value) < 4:
        flags.append("insufficient_kpis")

    hero_hist = hero.get("history") or []
    if isinstance(hero_hist, list):
        hist_non_null = [v for v in hero_hist if v is not None]
        if len(hist_non_null) < 3:
            flags.append("short_history")
    else:
        flags.append("short_history")

    segments = d.get("segments")
    geo = d.get("geography")
    seg_ok = isinstance(segments, dict) and not segments.get("_no_segments_found")
    geo_ok = isinstance(geo, dict) and bool(geo.get("slices"))
    if not (seg_ok and geo_ok):
        flags.append("missing_segments_or_geo")

    risks = d.get("risks") or []
    if len(risks) < 3:
        flags.append("few_risks")

    gov = d.get("governance") or {}
    if not gov.get("ceo_name"):
        flags.append("no_ceo_name")

    # description : on cherche dans plusieurs emplacements probables
    i18n = d.get("i18n") or {}
    desc_long_fr = (
        i18n.get("description_long_fr")
        or i18n.get("description_fr")
        or (d.get("metadata") or {}).get("description_long_fr")
        or (d.get("metadata") or {}).get("description_fr")
        or ""
    )
    if not isinstance(desc_long_fr, str) or len(desc_long_fr) < 100:
        flags.append("short_description")

    return flags


def categorize(flags: list[str]) -> str:
    if any(f in CRITICAL_FLAGS for f in flags):
        return "skip"
    if len(flags) <= 2:
        return "ready_to_merge"
    return "needs_review"


def main() -> int:
    if not UNIFIED_DIR.exists():
        print(f"ERR  {UNIFIED_DIR} absent", file=sys.stderr)
        return 1
    files = sorted(UNIFIED_DIR.glob("*.unified.json"))
    by_cat = {"ready_to_merge": [], "needs_review": [], "skip": []}
    detail: list[dict] = []
    flag_counter: dict[str, int] = {}

    for fp in files:
        with fp.open("r", encoding="utf-8") as f:
            d = json.load(f)
        ticker = d.get("ticker") or fp.stem.replace(".unified", "")
        flags = audit_one(d)
        cat = categorize(flags)
        by_cat[cat].append(ticker)
        for fl in flags:
            flag_counter[fl] = flag_counter.get(fl, 0) + 1
        detail.append({
            "ticker": ticker,
            "name": d.get("name"),
            "category": cat,
            "flags": flags,
            "sources_present": d.get("_sources_present") or [],
            "n_kpis_with_value": sum(
                1 for k in (d.get("kpis") or []) if k.get("value") is not None
            ),
            "n_risks": len(d.get("risks") or []),
        })

    audit = {
        "generated_at": now_iso(),
        "total": len(files),
        "by_category_counts": {k: len(v) for k, v in by_cat.items()},
        "by_category_tickers": by_cat,
        "flag_counts": dict(sorted(flag_counter.items(), key=lambda x: -x[1])),
        "detail": detail,
    }
    out_json = UNIFIED_DIR / "_AUDIT.json"
    with out_json.open("w", encoding="utf-8") as f:
        json.dump(audit, f, ensure_ascii=False, indent=2)

    # MD léger
    md_lines: list[str] = []
    md_lines.append(f"# Audit FR mass extract drafts ({now_iso()})")
    md_lines.append("")
    md_lines.append(f"- total drafts : **{len(files)}**")
    md_lines.append(f"- ready_to_merge : **{len(by_cat['ready_to_merge'])}**")
    md_lines.append(f"- needs_review : **{len(by_cat['needs_review'])}**")
    md_lines.append(f"- skip : **{len(by_cat['skip'])}**")
    md_lines.append("")
    md_lines.append("## Flags les plus fréquents")
    for fl, n in audit["flag_counts"].items():
        md_lines.append(f"- `{fl}` : {n}")
    md_lines.append("")
    md_lines.append("## Ready to merge")
    md_lines.append(", ".join(by_cat["ready_to_merge"]) or "_aucun_")
    md_lines.append("")
    md_lines.append("## Needs review")
    md_lines.append(", ".join(by_cat["needs_review"]) or "_aucun_")
    md_lines.append("")
    md_lines.append("## Skip (flags critiques)")
    md_lines.append(", ".join(by_cat["skip"]) or "_aucun_")
    (UNIFIED_DIR / "_AUDIT.md").write_text("\n".join(md_lines), encoding="utf-8")

    print(
        f"audit OK | ready={len(by_cat['ready_to_merge'])} "
        f"needs_review={len(by_cat['needs_review'])} "
        f"skip={len(by_cat['skip'])}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
