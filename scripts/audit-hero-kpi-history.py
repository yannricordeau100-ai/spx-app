#!/usr/bin/env python3
"""
audit-hero-kpi-history.py — Audite TOUS les KPIs des 660 stés clean_all V1.9
pour identifier les violations de la règle "3 ans d'historique minimum".

Règle (Yann 26 mai 2026, ABSOLUE) :
- AUCUN KPI en hero ou dans le bloc "Indicateurs clés" avec moins de 3 ans
  d'historique. On ne fabrique JAMAIS d'history. Si un KPI n'a pas l'historique
  requis, il est filtré.

Seuils selon period_type :
- "year" (ou undefined = annuel par défaut) → history.length >= 3
- "quarter" → history.length >= 12 (12 trimestres = 3 ans)
- "semester" → history.length >= 6 (6 semestres = 3 ans)

Workflow :
1. Lit src/data/v1-9-pre-publication-audit.json, filtre is_clean_all=true (660 stés)
2. Pour chaque sté, lit src/data/v2-pipeline/<ticker>.json (+ enrich si dispo)
3. Pour chaque KPI : vérifie history.length vs seuil pour son period_type
4. Pour le hero_kpi actuel, si violation :
   - Cherche un remplaçant dans kpis[] qui :
     a) A history >= seuil pour son period_type
     b) N'est pas générique (isGenericKpi)
     c) Idéalement is_wow=true ou compare_key non-vide
     d) Fallback : KPI le moins générique qui passe
   - Si AUCUN candidat → flag `_hero_replacement_needed: true`
5. Output : src/data/_hero-kpi-audit.json
"""

import json
import os
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
AUDIT_FILE = ROOT / "src/data/v1-9-pre-publication-audit.json"
V2_PIPELINE = ROOT / "src/data/v2-pipeline"
V2_ENRICH = ROOT / "src/data/v2-pipeline-enrich"
OUTPUT = ROOT / "src/data/_hero-kpi-audit.json"

GENERIC_LIB_PATH = ROOT / "src/data/kpi-generic-library.json"


def load_generic_shorts() -> set[str]:
    """Charge la library générique. Reproduit la logique de src/lib/kpi-generic.ts."""
    with open(GENERIC_LIB_PATH, encoding="utf-8") as f:
        lib = json.load(f)
    shorts = set()
    for entry in lib:
        s = entry.get("short", "").lower().strip()
        if s:
            shorts.add(s)
    return shorts


GENERIC_ALIASES = {
    "total revenue": ["revenue"],
    "operating income": ["op income", "operating profit", "ebit"],
    "operating margin": ["op margin", "operating margin %"],
    "net income": ["net profit"],
    "net margin": ["net margin %"],
    "gross margin": ["gross margin %"],
    "free cash flow": ["fcf", "free cashflow"],
    "operating cash flow": ["ocf", "operating cashflow"],
    "eps": ["earnings per share", "eps diluted", "diluted eps"],
    "dps": ["dividend per share", "dividende par action"],
    "cap return": ["capital return", "capital returned"],
    "buybacks": ["share buybacks", "stock buybacks"],
    "r&d": ["research and development", "rd expense"],
    "capex": ["capital expenditure", "capital expenditures"],
    "headcount": ["employees", "employés", "effectif"],
    "total assets": ["assets"],
    "total debt": ["debt"],
    "net debt": ["netdebt"],
    "leverage ratio": ["debt to ebitda", "leverage"],
    "cash & equivalents": ["cash", "cash and equivalents"],
    "roe": ["return on equity"],
    "roic": ["return on invested capital"],
    "p/e ratio": ["pe ratio", "p/e"],
    "market cap": ["market capitalization", "market cap usd"],
    "shares outstanding": ["shares"],
    "tax rate": ["effective tax rate", "tax"],
    "payout ratio": ["payout"],
}


def is_generic(short: Optional[str], generic_shorts: set[str]) -> bool:
    if not short:
        return False
    n = " ".join(short.lower().split())
    if n in generic_shorts:
        return True
    for g, aliases in GENERIC_ALIASES.items():
        if g in generic_shorts and n in aliases:
            return True
    return False


def required_history(period_type: Optional[str]) -> int:
    """Seuil min de history.length pour 3 ans selon period_type."""
    if not period_type or period_type == "year":
        return 3
    if period_type == "quarter":
        return 12
    if period_type == "semester":
        return 6
    # period_type inconnu (rare) : on traite comme annuel
    return 3


def history_len(kpi: dict) -> int:
    h = kpi.get("history")
    if not isinstance(h, list):
        return 0
    # Filtre valeurs valides (numbers)
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
    """Lit v2-pipeline/<t>.json (variantes de casse possibles)."""
    candidates = [
        V2_PIPELINE / f"{ticker.lower()}.json",
        V2_PIPELINE / f"{ticker}.json",
        V2_PIPELINE / f"{ticker.upper()}.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def find_hero_kpi(data: dict, hero_short: str) -> Optional[dict]:
    """Retrouve le KPI hero. Fuzzy match si exact pas trouvé (cf load-company.ts)."""
    kpis = data.get("kpis", [])
    if not isinstance(kpis, list) or not hero_short:
        return None
    # Match strict
    for k in kpis:
        if k.get("short") == hero_short:
            return k
    # Fuzzy
    hero_low = hero_short.lower()
    for k in kpis:
        s = str(k.get("short") or "").lower()
        if s and (hero_low in s or s in hero_low):
            return k
    return None


def find_replacement(kpis: list, hero_short: str, generic_shorts: set[str]) -> Optional[dict]:
    """Cherche un remplaçant pour le hero KPI selon priorité :
    a) has_enough_history
    b) not generic
    c) preferred: is_wow=true OR compare_key non-vide
    d) Fallback : le moins générique qui passe."""
    candidates = []
    for k in kpis:
        if not isinstance(k, dict):
            continue
        short = k.get("short")
        if not short or short == hero_short:
            continue
        if not has_enough_history(k):
            continue
        if is_generic(short, generic_shorts):
            continue
        candidates.append(k)
    if not candidates:
        return None
    # Préférer is_wow ou compare_key non-vide
    preferred = [
        k for k in candidates
        if k.get("is_wow") is True or (isinstance(k.get("compare_key"), str) and k["compare_key"].strip())
    ]
    if preferred:
        return preferred[0]
    return candidates[0]


def main():
    print("Loading audit file…")
    with open(AUDIT_FILE, encoding="utf-8") as f:
        audit_data = json.load(f)

    clean_all = [a for a in audit_data["audits"] if a.get("is_clean_all")]
    print(f"  clean_all stés: {len(clean_all)}")

    generic_shorts = load_generic_shorts()
    print(f"  generic library: {len(generic_shorts)} shorts")

    results = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "rule": "Yann 26 mai 2026: AUCUN KPI hero ou Indicateurs clés < 3 ans d'historique",
        "thresholds": {
            "year_or_undefined": 3,
            "quarter": 12,
            "semester": 6,
        },
        "total_stes": len(clean_all),
        "stats": {
            "hero_violations": 0,
            "hero_replaced": 0,
            "hero_orphans": 0,
            "table_kpis_hidden_total": 0,
        },
        "per_company": {},
    }

    missing_datasets = 0
    for entry in clean_all:
        ticker = entry["ticker"]
        data = load_company_dataset(ticker)
        if not data:
            missing_datasets += 1
            continue
        kpis = data.get("kpis", [])
        if not isinstance(kpis, list):
            kpis = []

        hero_short = data.get("hero_kpi")
        hero_kpi = find_hero_kpi(data, hero_short) if hero_short else None

        # Audit hero
        hero_violation = False
        hero_replacement_short = None
        hero_orphan = False
        old_history_len = 0
        if hero_kpi:
            old_history_len = history_len(hero_kpi)
            if not has_enough_history(hero_kpi):
                hero_violation = True
                replacement = find_replacement(kpis, hero_short, generic_shorts)
                if replacement:
                    hero_replacement_short = replacement.get("short")
                else:
                    hero_orphan = True

        # Audit table KPIs (non-hero)
        # Pour chaque KPI non-hero, vérifier history et flagger ceux à cacher
        # On exclut aussi les KPIs génériques (déjà filtrés par UI via isGenericKpi)
        table_hidden = []
        for k in kpis:
            short = k.get("short")
            if not short or short == hero_short:
                continue
            # Le filtre UI cache déjà les génériques ; on ne flag QUE les non-génériques
            # avec history insuffisante (sinon ils apparaîtraient à tort dans la table).
            if is_generic(short, generic_shorts):
                continue
            if not has_enough_history(k):
                table_hidden.append({
                    "short": short,
                    "history_len": history_len(k),
                    "period_type": k.get("period_type") or "year",
                    "required": required_history(k.get("period_type")),
                })

        # Stats
        if hero_violation:
            results["stats"]["hero_violations"] += 1
            if hero_replacement_short:
                results["stats"]["hero_replaced"] += 1
            if hero_orphan:
                results["stats"]["hero_orphans"] += 1
        results["stats"]["table_kpis_hidden_total"] += len(table_hidden)

        if hero_violation or table_hidden:
            # Find replacement kpi details (for accurate trace)
            replacement_detail = None
            if hero_replacement_short:
                for k in kpis:
                    if k.get("short") == hero_replacement_short:
                        replacement_detail = {
                            "short": hero_replacement_short,
                            "history_len": history_len(k),
                            "period_type": k.get("period_type") or "year",
                            "is_wow": k.get("is_wow") is True,
                            "compare_key": k.get("compare_key") or None,
                        }
                        break
            results["per_company"][ticker] = {
                "hero_kpi_current": hero_short,
                "hero_kpi_history_len": old_history_len,
                "hero_kpi_period_type": (hero_kpi.get("period_type") if hero_kpi else None) or "year",
                "hero_violation": hero_violation,
                "hero_replacement_short": hero_replacement_short,
                "hero_replacement_detail": replacement_detail,
                "hero_replacement_needed": hero_orphan,
                "table_kpis_to_hide": table_hidden,
            }

    results["stats"]["missing_datasets"] = missing_datasets

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ Audit terminé. Output: {OUTPUT.relative_to(ROOT)}")
    print(f"  Hero violations: {results['stats']['hero_violations']}")
    print(f"  Hero replaced  : {results['stats']['hero_replaced']}")
    print(f"  Hero orphans   : {results['stats']['hero_orphans']}")
    print(f"  Table KPIs hidden total: {results['stats']['table_kpis_hidden_total']}")
    print(f"  Stés sans dataset: {missing_datasets}")


if __name__ == "__main__":
    main()
