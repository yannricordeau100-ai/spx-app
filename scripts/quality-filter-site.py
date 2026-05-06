#!/usr/bin/env python3
"""
Filtre d'admission au site : décide quelles fiches sont assez qualitatives
pour être publiées sur Mettrik V1.7+.

Critères MINIMUMS pour `_fit_for_site = True` :
  1. Hero KPI a au moins 3 points d'history (sinon graphique inutile)
  2. Hero KPI a une value non-null et non "N/A"
  3. Au moins 5 KPIs total dans la fiche
  4. Description hero ≥ 80 chars
  5. YoY hero présent (au moins 2 points pour le calcul)

Sortie : ajoute `_fit_for_site: bool` + `_fit_reasons: [str]` dans chaque dataset.
La page V1.7 + le merge index lisent ce champ pour exclure les unfit.

Usage : python3 scripts/quality-filter-site.py [--dry-run]
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src/data/v2-pipeline"


def evaluate(d: dict) -> tuple[bool, list[str]]:
    reasons = []
    kpis = d.get("kpis") or []
    hero_short = d.get("hero_kpi")
    hk = next((k for k in kpis if k.get("short") == hero_short), kpis[0] if kpis else None)
    if not hk:
        return False, ["no_hero_kpi"]
    h = hk.get("history") or []
    if len(h) < 3:
        reasons.append(f"hero_history_too_short_{len(h)}")
    if hk.get("value") in (None, "", "N/A"):
        reasons.append("hero_value_null")
    if len(kpis) < 5:
        reasons.append(f"too_few_kpis_{len(kpis)}")
    desc = hk.get("description") or hk.get("explanation") or ""
    if len(desc) < 80:
        reasons.append(f"description_too_short_{len(desc)}")
    yoy = hk.get("yoy")
    if not yoy or yoy in ("N/A", "-", "n/a"):
        reasons.append("no_yoy")
    return len(reasons) == 0, reasons


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    fit = unfit = total = 0
    for f in OUT_DIR.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n:
            continue
        try:
            d = json.loads(f.read_text())
        except Exception:
            continue
        if "_validation" not in d:
            continue
        total += 1
        is_fit, reasons = evaluate(d)
        if is_fit:
            fit += 1
        else:
            unfit += 1
        if not args.dry_run:
            d["_fit_for_site"] = is_fit
            d["_fit_reasons"] = reasons
            f.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    print(f"Total : {total}")
    print(f"  ✅ Fit for site : {fit} ({fit*100//total}%)")
    print(f"  ❌ Unfit : {unfit} ({unfit*100//total}%)")
    if args.dry_run:
        print("(dry-run, datasets non modifiés)")


if __name__ == "__main__":
    main()
