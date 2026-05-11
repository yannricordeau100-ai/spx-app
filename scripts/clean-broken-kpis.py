#!/usr/bin/env python3
"""
clean-broken-kpis.py — supprime les KPIs invalides produits par les pipelines
LLM avant qu'ils soient finalisés. Bug systémique repéré par Yann le 11 mai
2026 sur NVDA : KPIs avec value = 'Not explicitly stated...', '>12 months',
'N/A', etc. injectés par iterative refinement et jamais finalisés.

Critères de suppression (au moins UN suffit, et tous les autres KPIs valides
sont préservés tels quels) :

A) value est une string descriptive :
   - contient mots-clés "not", "n/a", "tbd", "unknown", "not disclosed",
     "non quantifié", "not separately", "not explicitly", "stated",
     "mentioned" (case-insensitive)
   - commence par '>' ou '<' (sans nombre derrière strict)
   - longueur > 30 chars (= phrase, pas un nombre)

B) unit pas standard :
   - 'thousands USD', 'thousands', '$000', 'million USD (...)', 'N/A',
     'USD' (vs 'Mds $' / 'M $' attendus), 'days', 'months', 'restaurants',
     'million USD (...)'

C) KPI ajouté par iterative_refinement ET sans history :
   - flag '_added_by_iterative_refinement' présent ET history vide

D) name_fr vide ET history vide

Idempotent. Écrit en place dans v2-pipeline/<ticker>.json.
"""
import json, os, sys, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"

BROKEN_VALUE_KEYWORDS = [
    "not explicitly", "not disclosed", "not separately", "not stated",
    "not mentioned", "not quantif", "unknown", "tbd",
    "non quantif", "n/a", "stated in absolute", "stated in absolute terms",
]
BAD_UNITS = {
    "thousands usd", "thousands", "$000", "n/a",
    "usd", "restaurants", "days", "months",
}

def is_broken(k: dict) -> tuple[bool, str]:
    v = k.get("value")
    h = k.get("history") or []
    unit = (k.get("unit") or "").strip().lower()

    # A) value string descriptive
    if isinstance(v, str):
        s = v.strip().lower()
        if not s:
            if not h: return True, "value+history vides"
        else:
            if any(kw in s for kw in BROKEN_VALUE_KEYWORDS):
                return True, f"value descriptive ('{v[:30]}')"
            if len(s) > 30 and not re.search(r"\d+[,\.]?\d*$", s):
                return True, f"value trop longue ('{v[:30]}...')"
            # ">12 months", "<5%" etc avec unité non-standard = pas exploitable
            if (s.startswith(">") or s.startswith("<")) and not h:
                return True, f"value comparative ('{v[:20]}') sans history"

    # B) unit aberrante
    if unit in BAD_UNITS:
        return True, f"unit '{k.get('unit')}'"
    if re.match(r"million\s+usd", unit):
        return True, f"unit verbeuse '{k.get('unit')}'"

    # C) iterative_refinement non finalisé
    if k.get("_added_by_iterative_refinement") and not h:
        return True, "iterative_refinement non finalisé"

    # D) name_fr vide + history vide
    if not (k.get("name_fr") or "").strip() and not h:
        return True, "name_fr+history vides"

    return False, ""

def main():
    dry = "--dry-run" in sys.argv
    total_kpis_in = 0
    total_kpis_out = 0
    total_removed = 0
    stes_touched = 0
    by_reason: dict[str, int] = {}

    files = sorted(os.listdir(PIPELINE))
    for fname in files:
        if not fname.endswith(".json"): continue
        if ".gemini" in fname or fname.startswith("_"): continue
        path = PIPELINE / fname
        try:
            d = json.load(open(path))
        except Exception as e:
            print(f"  skip {fname}: {e}", file=sys.stderr)
            continue
        kpis = d.get("kpis") or []
        if not kpis: continue
        total_kpis_in += len(kpis)
        kept = []
        removed_here = 0
        for k in kpis:
            broken, reason = is_broken(k)
            if broken:
                removed_here += 1
                total_removed += 1
                by_reason[reason.split("'")[0].strip()] = by_reason.get(reason.split("'")[0].strip(), 0) + 1
            else:
                kept.append(k)
        total_kpis_out += len(kept)
        if removed_here > 0:
            stes_touched += 1
            d["kpis"] = kept
            d.setdefault("_kpis_cleaned", []).append({
                "removed": removed_here,
                "at": "2026-05-11",
                "by": "clean-broken-kpis.py",
            })
            if not dry:
                json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)

    print(f"KPIs avant : {total_kpis_in}")
    print(f"KPIs après : {total_kpis_out}")
    print(f"Supprimés : {total_removed}")
    print(f"Stés modifiées : {stes_touched}")
    print()
    print("Raisons :")
    for r, n in sorted(by_reason.items(), key=lambda x: -x[1]):
        print(f"  {n:>5}  {r}")
    if dry:
        print("\n[dry-run actif, aucune écriture]")

if __name__ == "__main__":
    main()
