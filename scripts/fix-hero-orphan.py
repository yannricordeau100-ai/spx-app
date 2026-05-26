#!/usr/bin/env python3
"""
fix-hero-orphan.py — Résout les 144 stés orphelines du fix hero KPI (commit 902dd8257).

Pour chaque sté avec `_hero_replacement_needed: true` dans v2-pipeline-enrich :
  Stratégie A — Extension d'historique d'un KPI spécifique <3 ans
    Skip : aucune candidate dans le dataset (audit 26 mai). On le garde pour le futur
    si CONV-DATA enrichit les KPI spécifiques courts.

  Stratégie B — Fallback générique acceptable par secteur
    Lit src/data/_hero-fallback-by-sector.json. Pour le secteur de la sté, parcourt
    la liste ordonnée de shorts génériques. Premier match dans kpis[] avec
    history >= seuil → hero_kpi_override appliqué, retire _hero_replacement_needed,
    ajoute _hero_replaced_by_sector_fallback: true + raison.

  Stratégie C — Marquage "Fiche en préparation"
    Aucun candidat même générique → ajoute _hero_unavailable: true + raison.
    Le front décide quoi faire (typiquement masquage hero ou redirect overview).

Ne touche PAS aux fichiers src/data/v2-pipeline/<ticker>.json (scope CONV-DATA).
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
AUDIT_OUTPUT = ROOT / "src/data/_hero-kpi-audit.json"
FALLBACK_MAP = ROOT / "src/data/_hero-fallback-by-sector.json"
V2_PIPELINE = ROOT / "src/data/v2-pipeline"
V2_ENRICH = ROOT / "src/data/v2-pipeline-enrich"
SUMMARY_OUTPUT = ROOT / "src/data/_hero-orphan-fix-summary.json"


def required_history(period_type: Optional[str]) -> int:
    if not period_type or period_type == "year":
        return 3
    if period_type == "quarter":
        return 12
    if period_type == "semester":
        return 6
    return 3


def history_len(kpi: dict) -> int:
    h = kpi.get("history")
    if not isinstance(h, list):
        return 0
    cnt = 0
    for v in h:
        if isinstance(v, (int, float)):
            cnt += 1
        elif isinstance(v, dict) and "value" in v:
            val = v.get("value")
            if isinstance(val, (int, float)):
                cnt += 1
    return cnt


def has_enough_history(kpi: dict) -> bool:
    return history_len(kpi) >= required_history(kpi.get("period_type"))


def load_company_dataset(ticker: str) -> Optional[dict]:
    for p in [
        V2_PIPELINE / f"{ticker.lower()}.json",
        V2_PIPELINE / f"{ticker}.json",
        V2_PIPELINE / f"{ticker.upper()}.json",
    ]:
        if p.exists():
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def find_enrich_path(ticker: str) -> Path:
    for p in [
        V2_ENRICH / f"{ticker.lower()}.json",
        V2_ENRICH / f"{ticker}.json",
    ]:
        if p.exists():
            return p
    return V2_ENRICH / f"{ticker.lower()}.json"


def load_enrich(path: Path) -> dict:
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_enrich(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def find_kpi_by_short(kpis: list, target_short: str) -> Optional[dict]:
    """Match insensible à la casse + tolère espaces."""
    if not isinstance(kpis, list) or not target_short:
        return None
    n = " ".join(target_short.lower().split())
    for k in kpis:
        if not isinstance(k, dict):
            continue
        s = " ".join(str(k.get("short") or "").lower().split())
        if s == n:
            return k
    return None


def main():
    if not AUDIT_OUTPUT.exists():
        print(f"❌ Audit manquant: {AUDIT_OUTPUT.relative_to(ROOT)}")
        sys.exit(1)
    if not FALLBACK_MAP.exists():
        print(f"❌ Fallback map manquante: {FALLBACK_MAP.relative_to(ROOT)}")
        sys.exit(1)

    with open(AUDIT_OUTPUT, encoding="utf-8") as f:
        audit = json.load(f)
    with open(FALLBACK_MAP, encoding="utf-8") as f:
        fallback = json.load(f)

    per_company = audit.get("per_company", {})
    orphans = {
        t: v for t, v in per_company.items()
        if v.get("hero_replacement_needed") and not v.get("hero_replacement_short")
    }
    print(f"Orphelins à résoudre : {len(orphans)}")

    stats = {
        "strategy_a_extend_success": 0,
        "strategy_b_sector_fallback": 0,
        "strategy_c_unavailable": 0,
        "skipped_no_dataset": 0,
        "files_written": 0,
    }
    changes = []

    for ticker, info in orphans.items():
        data = load_company_dataset(ticker)
        if not data:
            stats["skipped_no_dataset"] += 1
            continue

        sector = data.get("sector") or "_default"
        kpis = data.get("kpis", [])
        if not isinstance(kpis, list):
            kpis = []
        old_hero = info.get("hero_kpi_current") or data.get("hero_kpi")

        # --- Stratégie B : fallback sectoriel ---
        fallback_list = fallback.get(sector) or fallback.get("_default") or []
        chosen_short = None
        chosen_kpi = None
        for candidate_short in fallback_list:
            k = find_kpi_by_short(kpis, candidate_short)
            if k and has_enough_history(k):
                chosen_short = k.get("short")  # garder la casse exacte du dataset
                chosen_kpi = k
                break

        enrich_path = find_enrich_path(ticker)
        enrich = load_enrich(enrich_path)

        if chosen_short:
            reason = (
                f"Orphelin résolu par fallback sectoriel '{sector}'. "
                f"Hero précédent '{old_hero}' avait history insuffisant. "
                f"Remplaçant '{chosen_short}' choisi parmi liste sectorielle "
                f"(history={history_len(chosen_kpi)}, "
                f"period={chosen_kpi.get('period_type') or 'year'}). "
                f"Stratégie B fix-hero-orphan."
            )
            enrich["hero_kpi_override"] = chosen_short
            enrich["hero_kpi_replaced_reason"] = reason
            enrich["_hero_replaced_by_sector_fallback"] = True
            # Retire le flag orphelin précédent + raison désuète
            enrich.pop("_hero_replacement_needed", None)
            enrich.pop("_hero_replacement_reason", None)
            # S'assure que les flags unavailable d'éventuelles passes précédentes sont nettoyés
            enrich.pop("_hero_unavailable", None)
            enrich.pop("_hero_unavailable_reason", None)
            stats["strategy_b_sector_fallback"] += 1
            changes.append({
                "ticker": ticker,
                "strategy": "B_sector_fallback",
                "sector": sector,
                "from": old_hero,
                "to": chosen_short,
                "to_history_len": history_len(chosen_kpi),
                "to_period_type": chosen_kpi.get("period_type") or "year",
            })
        else:
            # --- Stratégie C : marquer unavailable ---
            reason = (
                f"Aucun KPI avec ≥3 ans d'historique trouvé dans le dataset, "
                f"même en fallback sectoriel '{sector}'. "
                f"Hero précédent '{old_hero}' insuffisant. "
                f"Stratégie C fix-hero-orphan : fiche en préparation."
            )
            enrich["_hero_unavailable"] = True
            enrich["_hero_unavailable_reason"] = reason
            # Retire flag orphelin pour éviter affichage de doublon
            enrich.pop("_hero_replacement_needed", None)
            enrich.pop("_hero_replacement_reason", None)
            stats["strategy_c_unavailable"] += 1
            changes.append({
                "ticker": ticker,
                "strategy": "C_unavailable",
                "sector": sector,
                "from": old_hero,
                "to": None,
            })

        save_enrich(enrich_path, enrich)
        stats["files_written"] += 1

    changes.sort(key=lambda x: x["ticker"])

    summary = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "rule": "Résolution 144 orphelins post-902dd8257 (Stratégies A/B/C)",
        "stats": stats,
        "top_10_changes": changes[:10],
        "changes_count": len(changes),
    }

    SUMMARY_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(SUMMARY_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ Fix orphan terminé.")
    print(f"  Stratégie B (fallback sectoriel): {stats['strategy_b_sector_fallback']}")
    print(f"  Stratégie C (unavailable)       : {stats['strategy_c_unavailable']}")
    print(f"  Skipped no dataset              : {stats['skipped_no_dataset']}")
    print(f"  Fichiers enrich écrits          : {stats['files_written']}")
    print(f"  Summary: {SUMMARY_OUTPUT.relative_to(ROOT)}")
    print()
    print("Top 10 changements :")
    for c in changes[:10]:
        if c["strategy"] == "C_unavailable":
            print(f"  {c['ticker']:12s}  [{c['sector']}]  {c['from']!r} → UNAVAILABLE")
        else:
            print(
                f"  {c['ticker']:12s}  [{c['sector']}]  {c['from']!r} → "
                f"{c['to']!r} (hist={c['to_history_len']}/{c['to_period_type']})"
            )


if __name__ == "__main__":
    main()
