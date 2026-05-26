#!/usr/bin/env python3
"""
fix-hero-kpi-history.py — Applique l'audit de hero-kpi-history.py.

Pour CHAQUE sté avec violation hero (et remplaçant trouvé) :
  - Écrit `hero_kpi_override` dans `src/data/v2-pipeline-enrich/<ticker>.json`
    (champ canonique merge SSR — cf load-company.ts).
  - Ajoute `hero_kpi_replaced_reason` traçant la raison.

Pour CHAQUE KPI non-hero avec history insuffisante :
  - Ajoute le `short` dans `_kpis_hidden_by_history_rule[]` du fichier enrich
    (consommé par company-view.tsx pour filtrer en plus de isGenericKpi).

Pour CHAQUE sté SANS remplaçant (orphan) :
  - Ajoute `_hero_replacement_needed: true` + raison dans enrich.

Ne touche PAS aux fichiers `src/data/v2-pipeline/<ticker>.json` (scope CONV-DATA).
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
AUDIT_OUTPUT = ROOT / "src/data/_hero-kpi-audit.json"
V2_PIPELINE = ROOT / "src/data/v2-pipeline"
V2_ENRICH = ROOT / "src/data/v2-pipeline-enrich"


def find_enrich_path(ticker: str) -> Path:
    """Cherche le fichier enrich existant pour ce ticker (sans suffixe spécialisé).
    Convention : src/data/v2-pipeline-enrich/<ticker_lowercase>.json (sans .description / .events / etc.)"""
    candidates = [
        V2_ENRICH / f"{ticker.lower()}.json",
        V2_ENRICH / f"{ticker}.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    # Default : créer en lowercase
    return V2_ENRICH / f"{ticker.lower()}.json"


def load_enrich(path: Path) -> dict[str, Any]:
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_enrich(path: Path, data: dict[str, Any]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def required_label(period_type: str) -> str:
    if period_type == "quarter":
        return "12 trimestres (3 ans)"
    if period_type == "semester":
        return "6 semestres (3 ans)"
    return "3 ans"


def main():
    if not AUDIT_OUTPUT.exists():
        print(f"❌ Audit file missing: {AUDIT_OUTPUT.relative_to(ROOT)}")
        print("   Run scripts/audit-hero-kpi-history.py first.")
        sys.exit(1)

    with open(AUDIT_OUTPUT, encoding="utf-8") as f:
        audit = json.load(f)

    per_company = audit.get("per_company", {})
    print(f"Stés à patcher: {len(per_company)}")

    stats = {
        "hero_replaced": 0,
        "hero_orphans_flagged": 0,
        "table_kpis_hidden": 0,
        "files_written": 0,
    }
    replacements_list = []

    for ticker, info in per_company.items():
        enrich_path = find_enrich_path(ticker)
        enrich = load_enrich(enrich_path)
        modified = False

        hero_violation = info.get("hero_violation")
        replacement_short = info.get("hero_replacement_short")
        orphan = info.get("hero_replacement_needed")
        old_hero = info.get("hero_kpi_current")
        old_history_len = info.get("hero_kpi_history_len", 0)
        old_period = info.get("hero_kpi_period_type", "year")

        if hero_violation and replacement_short:
            reason = (
                f"{old_hero} avait seulement {old_history_len} point(s) d'historique "
                f"(period_type={old_period}, requis: {required_label(old_period)}). "
                f"Règle Yann 26 mai 2026: aucun KPI hero avec moins de 3 ans d'historique."
            )
            enrich["hero_kpi_override"] = replacement_short
            enrich["hero_kpi_replaced_reason"] = reason
            stats["hero_replaced"] += 1
            rep_detail = info.get("hero_replacement_detail") or {}
            replacements_list.append({
                "ticker": ticker,
                "from": old_hero,
                "from_history_len": old_history_len,
                "from_period_type": old_period,
                "to": replacement_short,
                "to_history_len": rep_detail.get("history_len"),
                "to_period_type": rep_detail.get("period_type"),
                "to_is_wow": rep_detail.get("is_wow"),
            })
            modified = True

        if orphan:
            enrich["_hero_replacement_needed"] = True
            enrich["_hero_replacement_reason"] = (
                f"Hero actuel '{old_hero}' a {old_history_len} pt(s) d'historique "
                f"(period_type={old_period}, requis {required_label(old_period)}). "
                f"AUCUN remplaçant trouvé dans kpis[] (tous insuffisants en history "
                f"ou tous génériques). Investigation manuelle requise."
            )
            stats["hero_orphans_flagged"] += 1
            modified = True

        # Table KPIs à cacher pour cause d'history insuffisante
        hidden_kpis = info.get("table_kpis_to_hide", [])
        if hidden_kpis:
            # Stocke la liste des shorts à filtrer (consommée par company-view orderedKpis)
            existing_set = set(enrich.get("_kpis_hidden_by_history_rule", []))
            for k in hidden_kpis:
                existing_set.add(k["short"])
            enrich["_kpis_hidden_by_history_rule"] = sorted(existing_set)
            # Trace détail pour audit
            enrich["_kpis_hidden_by_history_detail"] = hidden_kpis
            stats["table_kpis_hidden"] += len(hidden_kpis)
            modified = True

        if modified:
            save_enrich(enrich_path, enrich)
            stats["files_written"] += 1

    # Trier replacements_list (alphabetique ticker) pour le rapport
    replacements_list.sort(key=lambda x: x["ticker"])

    # Écrit aussi un summary JSON pour traçabilité
    summary_path = ROOT / "src/data/_hero-kpi-fix-summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": audit.get("generated_at"),
            "stats": stats,
            "replacements_first_10": replacements_list[:10],
            "replacements_count": len(replacements_list),
        }, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ Fix terminé.")
    print(f"  Hero remplacés        : {stats['hero_replaced']}")
    print(f"  Hero orphelins flaggés: {stats['hero_orphans_flagged']}")
    print(f"  KPIs cachés (table)   : {stats['table_kpis_hidden']}")
    print(f"  Fichiers enrich écrits: {stats['files_written']}")
    print(f"  Summary: {summary_path.relative_to(ROOT)}")
    print()
    print("Top 10 stés impactées (hero remplacé) :")
    for r in replacements_list[:10]:
        new_hl = r.get("to_history_len")
        new_pt = r.get("to_period_type") or "year"
        print(f"  {r['ticker']:12s}  {r['from']!r:40s}  →  {r['to']!r}  (new hist={new_hl}/{new_pt})")


if __name__ == "__main__":
    main()
