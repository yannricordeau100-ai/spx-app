#!/usr/bin/env python3
"""
Sub-agent #141 — Fix 22 stés ABSENTES du publishable audit.

Diagnostic Phase A : 24 tickers (mission disait 22, en réalité 24 uniques).
Tous ont leur fichier `src/data/v1-9-complete/<TICKER>.json` présent.
Ils sont absents de `src/data/v1-9-publishable.json` car le filtre
`scripts/audit-v1-9-publishable.js` les rejette pour 2 raisons :
  - hero_spec=false (hero générique type "Total Revenue")
  - hero_hist=false (hero_kpi ne matche aucune KPI avec history>=3)

Stratégie : pour chaque ticker, calculer le meilleur KPI "spécifique"
disponible avec history >= 3 points et écrire un override dans
`src/data/v2-pipeline-enrich/<lower>.hero_name_fr.json` (mécanisme
hero_kpi_override déjà supporté par audit + load-company.ts).

Sorties :
  - Override files créés/mis à jour pour ~18 stés (Cluster B-FIX)
  - Flag `_d_stories_pending_cerebras:true` posé pour ~6 stés (Cluster B/C-SKIP)
  - audit-v1-9-publishable.js patché pour LIRE les overrides
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "src" / "data"
COMPLETE_DIR = DATA / "v1-9-complete"
ENRICH_DIR = DATA / "v2-pipeline-enrich"
SPEC_KPIS_DIR = DATA / "v2-pipeline-specific-kpis"

TARGETS = [
    "AMGN", "MO", "UPS", "KHC", "III.L", "ABF.L", "URW.PA", "UPM.HE",
    "VIAV", "ABVX", "AMZN", "DIS", "KIM", "KO", "ROL", "ROP", "RSG",
    "SATS", "SNDK", "TPR", "VEEV", "VRT", "VTRS", "WY",
]

# Genéric base (rejected outright by publishable filter)
GENERIC_BASE = {
    "revenue", "ebitda", "eps", "net income", "op margin", "operating margin",
    "free cash flow", "fcf", "headcount", "employees", "r&d",
    "research & development", "capex", "capital expenditure", "roe", "roic",
    "gross margin", "gross profit", "total revenue", "total revenues",
    "net revenue",
}

# Semi-generic (would technically pass filter but not very illustrative)
SEMI_GENERIC = {
    "dps", "total assets", "operating income", "cash position", "op cash flow",
    "net sales", "cap return", "payout ratio", "capex", "backlog",
    "cash & equivalents", "long-term debt", "operating cash flow",
    "depreciation", "inventory", "accounts receivable", "total debt",
    "net income", "diluted eps", "operating cash flow",
}


def is_generic(name: str) -> bool:
    if not name:
        return True
    n = str(name).strip().lower()
    for g in GENERIC_BASE:
        if n == g or n.startswith(g + " "):
            return True
    return False


def is_semi_generic(name: str) -> bool:
    if not name:
        return False
    return str(name).strip().lower() in SEMI_GENERIC


def find_best_hero(kpis: list) -> tuple[dict | None, list]:
    """Return (best_candidate, top3_list). Each candidate is a dict
    {short, name_fr, name_en, hist_len, score, is_semi_generic}."""
    candidates = []
    for k in kpis:
        if not k:
            continue
        short = k.get("short", "")
        if not short:
            continue
        hist = k.get("history") or []
        if not isinstance(hist, list) or len(hist) < 3:
            continue
        if is_generic(short):
            continue
        semi = is_semi_generic(short)
        score = 30 if semi else 100
        score += len(hist) * 2
        if k.get("name_fr") and len(k.get("name_fr", "")) > 10:
            score += 5
        candidates.append({
            "short": short,
            "name_fr": k.get("name_fr", "") or "",
            "name_en": k.get("name_en", "") or "",
            "hist_len": len(hist),
            "score": score,
            "is_semi_generic": semi,
        })
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return (candidates[0] if candidates else None, candidates[:3])


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z"
    fixed = []  # write override
    skipped = []  # mark pending
    cluster_a_missing = []
    cluster_c_malformed = []

    for ticker in TARGETS:
        complete_path = COMPLETE_DIR / f"{ticker}.json"
        if not complete_path.exists():
            cluster_a_missing.append(ticker)
            continue
        try:
            data = json.loads(complete_path.read_text())
        except Exception as e:
            cluster_c_malformed.append((ticker, str(e)))
            continue

        kpis = data.get("kpis") or []
        if not isinstance(kpis, list):
            cluster_c_malformed.append((ticker, "kpis not list"))
            continue

        best, top3 = find_best_hero(kpis)
        cur_hero = data.get("hero_kpi", "")

        lc = ticker.lower()
        override_path = ENRICH_DIR / f"{lc}.hero_name_fr.json"

        if best is None or best["is_semi_generic"]:
            # No good candidate - mark as pending cerebras stories
            reason = "no_specific_kpi_with_history" if best is None else "only_semi_generic_candidates"
            pending_path = ENRICH_DIR / f"{lc}.pending_cerebras.json"
            pending_payload = {
                "_d_stories_pending_cerebras": True,
                "_pending_reason": reason,
                "_source": "scripts/fix-22-absentes/fix_overrides.py (sub-agent #141)",
                "_generated_at": now,
                "_current_hero": cur_hero,
                "_candidates_examined": len(top3),
                "_best_candidate_short": best["short"] if best else None,
                "_best_candidate_hist_len": best["hist_len"] if best else 0,
            }
            pending_path.write_text(json.dumps(pending_payload, indent=2) + "\n")
            skipped.append({
                "ticker": ticker,
                "reason": reason,
                "current_hero": cur_hero,
                "best_candidate": best["short"] if best else None,
            })
            continue

        # Cluster B-FIX : write hero override
        override_payload = {
            "overrides_hero_name_fr": {
                "hero_short": best["short"],
                "name_fr": best["name_fr"] or best["short"],
            },
            "_source": "scripts/fix-22-absentes/fix_overrides.py (sub-agent #141)",
            "_generated_at": now,
            "hero_kpi_override": best["short"],
            "_hero_kpi_override_reason": (
                f"Hero original \"{cur_hero}\" introuvable dans kpis[] avec history>=3 "
                f"(ou générique). Reroute vers KPI spécifique \"{best['short']}\" "
                f"(history={best['hist_len']} points)."
            ),
        }

        # Preserve existing fields if override file already exists
        if override_path.exists():
            try:
                existing = json.loads(override_path.read_text())
                # Merge: only update hero override fields, preserve other overrides
                for k, v in existing.items():
                    if k not in override_payload and not k.startswith("_"):
                        override_payload[k] = v
            except Exception:
                pass

        override_path.write_text(json.dumps(override_payload, indent=2) + "\n")
        fixed.append({
            "ticker": ticker,
            "old_hero": cur_hero,
            "new_hero": best["short"],
            "hist_len": best["hist_len"],
            "name_fr": best["name_fr"],
        })

    # Summary
    print(f"\n=== Sub-agent #141 fix-22-absentes ===")
    print(f"Cluster B-FIX (override created): {len(fixed)} stés")
    for f in fixed:
        print(f"  {f['ticker']:8s}: {f['old_hero']!r} -> {f['new_hero']!r} (hist={f['hist_len']})")
    print(f"\nCluster B/C-SKIP (pending cerebras): {len(skipped)} stés")
    for s in skipped:
        print(f"  {s['ticker']:8s}: {s['reason']} (cur={s['current_hero']!r}, best={s['best_candidate']!r})")
    print(f"\nCluster A (file missing): {len(cluster_a_missing)} stés")
    print(f"Cluster C (malformed): {len(cluster_c_malformed)} stés")

    # Save report
    report = {
        "generated_at": now,
        "script": "scripts/fix-22-absentes/fix_overrides.py",
        "fixed_count": len(fixed),
        "skipped_count": len(skipped),
        "cluster_a_missing_count": len(cluster_a_missing),
        "cluster_c_malformed_count": len(cluster_c_malformed),
        "fixed": fixed,
        "skipped": skipped,
        "cluster_a_missing": cluster_a_missing,
        "cluster_c_malformed": cluster_c_malformed,
    }
    report_path = REPO / "scripts" / "fix-22-absentes" / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"\nReport written to {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
