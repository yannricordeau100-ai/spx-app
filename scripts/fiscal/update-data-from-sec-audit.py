#!/usr/bin/env python3
"""
Met à jour `last_data_date` + `publication_date` sur le hero_kpi de chaque
sté du fiscal-audit, basé sur les dates SEC EDGAR.

Cible : `src/data/v2-pipeline/<ticker>.json`. Seules les valeurs `last_data_date`
et `publication_date` du KPI dont le `short` == `hero_kpi` sont touchées.
AUCUNE autre valeur (history, value, yoy) n'est modifiée — la donnée chiffrée
reste celle extraite par CONV-DATA, on aligne juste les dates de fraîcheur.

Yann 13 mai 2026 : objectif = la pill "À jour / Récent / Earning attendu"
affiche la BONNE date SEC, pas un fallback inventé.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT_FILE = ROOT / "src/data/fiscal-audit.json"
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"


def main() -> None:
    audit = json.loads(AUDIT_FILE.read_text())

    touched = 0
    not_found = []
    no_hero = []
    no_match = []

    for ticker, info in audit.items():
        period_end = info.get("latestPeriodEnd")
        filing_date = info.get("latestFilingDate")
        if not period_end or not filing_date:
            continue

        # Le pipeline stocke en lowercase
        path = PIPELINE_DIR / f"{ticker.lower()}.json"
        if not path.exists():
            not_found.append(ticker)
            continue

        try:
            d = json.loads(path.read_text())
        except Exception:
            not_found.append(ticker)
            continue

        hero = d.get("hero_kpi")
        if not hero:
            no_hero.append(ticker)
            continue

        matched = False
        for k in d.get("kpis", []):
            if k.get("short") == hero:
                k["last_data_date"] = period_end
                k["publication_date"] = filing_date
                matched = True
                break
        if not matched:
            no_match.append(ticker)
            continue

        # Sauve only if changed
        path.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        touched += 1

    print(f"=== UPDATE TERMINÉ ===")
    print(f"Stés mises à jour : {touched}")
    print(f"Sans fichier pipeline : {len(not_found)}")
    print(f"Sans hero_kpi : {len(no_hero)}")
    print(f"Hero KPI introuvable dans kpis[] : {len(no_match)}")
    if not_found[:5]:
        print(f"  pipeline manquant exemples : {not_found[:10]}")
    if no_match[:5]:
        print(f"  hero introuvable : {no_match[:10]}")


if __name__ == "__main__":
    main()
