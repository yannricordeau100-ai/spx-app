#!/usr/bin/env python3
"""
heuristic-fill-kpi-types.py — Auto-tag KPI `type` field via pattern matching
sur KPI.short + name_fr pour combler les types manquants/génériques côté
interpretStructured() (src/lib/data.ts).

INSIGHT #52 : b_interpretation KO résiduel = 20.6% (113/549 publishable),
dont 101 stés sans "Vigilance" et 12 sans interprétation du tout. Cause :
les types présents dans les datasets (Balance Sheet, Comptes, Profit, Risk,
Financial, Specific, Pipeline, etc.) ne matchent AUCUNE catégorie reconnue
par interpretStructured.

OUTPUT : src/data/v2-pipeline-enrich/<ticker>.json champ `kpis_type_overrides`
{ short → new_type } qui sera mergé field-by-field via load-company.ts.
N'écrase JAMAIS src/data/v2-pipeline/<t>.json (scope CONV-DATA strict).

Pure heuristique pattern matching. Pas de LLM. Pas de réseau.
"""

import json
import os
import re
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

# ── Pattern → type. Ordre IMPORTANT (premier match gagne) ──────────────
# Verbatim spec du brief CONV-CONCEPTS #52.
PATTERNS_DRIVER = [
    # Revenue (matche AVANT Margin pour "Gross Margin" qui contient "Margin")
    (r"\b(revenue|sales|growth|gmv|bookings|orders\s*revenue)\b", "Revenue"),
    (r"\b(ventes|chiffre d'affaires|CA\s)\b", "Revenue"),
    # User / Adoption
    (r"\b(subscribers|mau|dau|users|dap|active\s*users|monthly\s*active|daily\s*active)\b", "User"),
    (r"\b(abonnés|utilisateurs)\b", "User"),
    (r"\b(adoption|penetration|share|market\s*share|part\s*de\s*marché)\b", "Adoption"),
    # Demand
    (r"\b(backlog|orders|pipeline|deferred\s*revenue|carnet\s*de\s*commandes)\b", "Demand"),
]

# Vigilance categories (Cost / Margin / Profitability / Investment)
PATTERNS_VIGILANCE = [
    (r"\b(margin|marge|gross\s*margin|operating\s*margin|net\s*margin)\b", "Margin"),
    (r"\b(eps|net\s*income|profit|profitability|earnings|bénéfice|résultat\s*net|operating\s*income)\b", "Profitability"),
    (r"\b(cost|coût|opex|operating\s*expense|expense|charges\s*d'exploitation)\b", "Cost"),
    (r"\b(capex|r&d|research|recherche|investissement|investment)\b", "Investment"),
]

# Cash / Surveillance categories
PATTERNS_CASH = [
    (r"\b(fcf|cash\s*flow|free\s*cash|operating\s*cash|flux\s*de\s*trésorerie)\b", "Cash Flow"),
    (r"\b(dividend|dps|payout|cap\s*return)\b", "Dividende"),
    (r"\b(cash\s*position|cash\s*and\s*equivalents|trésorerie)\b", "Cash"),
    (r"\b(capital|equity|fonds\s*propres|shareholders?\s*equity)\b", "Capital"),
]

ALL_PATTERNS = PATTERNS_DRIVER + PATTERNS_VIGILANCE + PATTERNS_CASH

# Types déjà reconnus par interpretStructured (à ne PAS overrider)
RECOGNIZED_TYPES = {
    "Demand", "User", "Adoption", "Revenue", "Volume", "Pricing", "Growth",
    "Engagement", "Capacity", "Productivity", "Operations", "Production",
    "Quality", "Innovation", "Subscription",
    "Cost", "Margin", "Profitability", "Investment",
    "Cash", "Cash Flow", "Capital", "Dividende",
}

# Types à reclasser (génériques ou non-matchés par interpretStructured)
RECLASSIFY_TYPES = {
    "Balance Sheet", "Comptes", "Profit", "Risk", "Financial", "Specific",
    "Pipeline", "Operational", "operational", "Mix", "Earnings",
    "Financial Metric", "Operating Expense", "Credit Rating", "Governance",
    "Customer Metrics", "Liability", "Structural", "Headcount", "Debt",
    "Strategic", "Restructuring", "Recurring", "EPS", "Financing",
    "Bénéfice", "Ratio", "Business Mix", "Net Income", "Regulation",
    "Other Income", "Technology", "Deal Volume", "Tax Credit",
    "Generation Mix", "Regulatory", "Return", "Infrastructure", "Income",
    "KPI", "Indicateur", "Indicator", "",
}


def detect_type(short: str, name_fr: str = "") -> str | None:
    """Pattern matching ordonné. Retourne le nouveau type ou None si rien matché."""
    haystack = f"{short or ''} {name_fr or ''}".lower()
    for pattern, ty in ALL_PATTERNS:
        if re.search(pattern, haystack, re.IGNORECASE):
            return ty
    return None


# Patterns short où le `type` est très probablement faux côté LLM même s'il
# est "reconnu". Ex AXP : "Net Income" labellisé Revenue → on force Profitability.
# Yann 21 mai 2026 : on n'override que des short EXPLICITES non-ambigus.
HIGH_CONFIDENCE_PATTERNS = [
    (r"^net\s*income$", "Profitability"),
    (r"^operating\s*income$", "Profitability"),
    (r"^net\s*income\s*\(loss\)$", "Profitability"),
    (r"\beps\b", "Profitability"),
    (r"^diluted\s*eps$", "Profitability"),
    (r"^free\s*cash\s*flow$", "Cash Flow"),
    (r"^fcf$", "Cash Flow"),
    (r"^operating\s*cash\s*flow$", "Cash Flow"),
    (r"^gross\s*margin$", "Margin"),
    (r"^operating\s*margin$", "Margin"),
    (r"^net\s*margin$", "Margin"),
    (r"^ebitda\s*margin$", "Margin"),
    (r"^r&d$", "Investment"),
    (r"^capex$", "Investment"),
    (r"^dps$", "Dividende"),
    (r"^payout\s*ratio$", "Dividende"),
    (r"^cap\s*return$", "Dividende"),
]


def detect_type_force(short: str) -> str | None:
    """Détecte les short EXPLICITES où le type LLM est très probablement faux.
    Override même les types reconnus mais clairement mauvais (ex AXP Net Income=Revenue)."""
    if not short:
        return None
    s = short.lower().strip()
    for pattern, ty in HIGH_CONFIDENCE_PATTERNS:
        if re.search(pattern, s, re.IGNORECASE):
            return ty
    return None


def load_company(ticker: str) -> tuple[dict | None, str | None]:
    """Charge la fiche société depuis v2-pipeline (priorité) ou v1-9-complete."""
    candidates = [
        DATA / "v2-pipeline" / f"{ticker.lower()}.json",
        DATA / "v2-pipeline" / f"{ticker}.json",
        DATA / "v1-9-complete" / f"{ticker}.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                return json.load(p.open()), str(p.relative_to(ROOT))
            except Exception:
                continue
    return None, None


def load_existing_overrides(ticker: str) -> dict:
    """Charge v2-pipeline-enrich/<ticker>.json existant (s'il existe) pour merge."""
    p = DATA / "v2-pipeline-enrich" / f"{ticker.lower()}.json"
    if p.exists():
        try:
            return json.load(p.open())
        except Exception:
            return {}
    return {}


def save_overrides(ticker: str, enrich: dict) -> None:
    """Sauvegarde le fichier enrich avec les overrides."""
    p = DATA / "v2-pipeline-enrich" / f"{ticker.lower()}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(enrich, f, ensure_ascii=False, indent=2)


def main():
    pub = json.load((DATA / "v1-9-publishable.json").open())
    tickers = pub["tickers"]
    print(f"Loaded {len(tickers)} publishable tickers", file=sys.stderr)

    # Stats
    stats = {
        "tickers_processed": 0,
        "tickers_with_overrides": 0,
        "total_kpis_audited": 0,
        "kpis_already_recognized": 0,
        "kpis_filled_by_type": Counter(),
        "kpis_not_matched": 0,
        "samples": {},
    }

    for ticker in tickers:
        co, src = load_company(ticker)
        if not co:
            continue
        stats["tickers_processed"] += 1

        kpis = co.get("kpis", [])
        overrides = {}
        sample_before = []
        sample_after = []

        for k in kpis:
            stats["total_kpis_audited"] += 1
            short = k.get("short", "")
            name_fr = k.get("name_fr", "")
            cur_type = k.get("type", "")

            if not short:
                continue

            # High-confidence patterns : forcent override même si type reconnu
            # (ex AXP : Net Income labellisé Revenue → Profitability)
            force_type = detect_type_force(short)
            if force_type and cur_type != force_type:
                overrides[short] = force_type
                stats["kpis_filled_by_type"][force_type] += 1
                sample_before.append(f"{short}={cur_type or '∅'}")
                sample_after.append(f"{short}={force_type} (FORCE)")
                continue

            if cur_type in RECOGNIZED_TYPES:
                stats["kpis_already_recognized"] += 1
                continue

            if cur_type not in RECLASSIFY_TYPES and cur_type != "":
                # Type spécifique qu'on ne reconnait pas mais pas dans la liste : skip prudent.
                continue

            new_type = detect_type(short, name_fr)
            if new_type:
                overrides[short] = new_type
                stats["kpis_filled_by_type"][new_type] += 1
                sample_before.append(f"{short}={cur_type or '∅'}")
                sample_after.append(f"{short}={new_type}")
            else:
                stats["kpis_not_matched"] += 1

        if overrides:
            stats["tickers_with_overrides"] += 1
            enrich = load_existing_overrides(ticker)
            enrich["kpis_type_overrides"] = overrides
            enrich["_kpis_type_overrides_source"] = "heuristic-fill-kpi-types.py (pattern match)"
            save_overrides(ticker, enrich)
            if len(stats["samples"]) < 8:
                stats["samples"][ticker] = {
                    "before": sample_before[:6],
                    "after": sample_after[:6],
                }

    # Print report
    print("\n========== HEURISTIC FILL KPI TYPES — REPORT ==========")
    print(f"Tickers processed: {stats['tickers_processed']}")
    print(f"Tickers with overrides written: {stats['tickers_with_overrides']}")
    print(f"Total KPIs audited: {stats['total_kpis_audited']}")
    print(f"KPIs already recognized type: {stats['kpis_already_recognized']}")
    print(f"KPIs filled by category:")
    for ty, n in stats["kpis_filled_by_type"].most_common():
        print(f"  {ty}: {n}")
    print(f"KPIs unmatched (kept as-is): {stats['kpis_not_matched']}")
    print("\nSamples (5-8 stés) :")
    for t, sa in list(stats["samples"].items())[:8]:
        print(f"  [{t}] before: {sa['before']}")
        print(f"        after:  {sa['after']}")

    # Save stats
    out_path = DATA / "v1-9-kpi-type-fill-stats.json"
    with out_path.open("w") as f:
        json.dump({
            "tickers_processed": stats["tickers_processed"],
            "tickers_with_overrides": stats["tickers_with_overrides"],
            "total_kpis_audited": stats["total_kpis_audited"],
            "kpis_already_recognized": stats["kpis_already_recognized"],
            "kpis_filled_by_type": dict(stats["kpis_filled_by_type"]),
            "kpis_not_matched": stats["kpis_not_matched"],
            "samples": stats["samples"],
        }, f, ensure_ascii=False, indent=2)
    print(f"\nStats saved to: {out_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
