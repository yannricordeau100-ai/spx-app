#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comptages du chantier Types de KPI (definitions du 12 sept 2026) :
  KPI total    = KPI IC (standard + avances) + KPI stories
  KPI IC total = KPI IC (standard + avances)
  Types de KPI = nombre de types comparables distincts (champ type_comparable.en)
sur l univers et par societe. Sortie : src/data/kpi-types-comptes.json
"""
import json, os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
u = json.load(open(os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")))["tickers"]


def lire(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None


par_ste, types_univers = {}, set()
tot_kpi = tot_ic = classes = uniques = 0
for t in u:
    haut = lire(os.path.join(ROOT, ".batches-drafts-safe/kpis-haut/%s.json" % t)) or {}
    base = lire(os.path.join(ROOT, "src/data/v2-pipeline/%s.json" % t.lower())) or {}
    sh = {k.get("short") for k in haut.get("kpis") or []}
    ic = list(haut.get("kpis") or []) + [k for k in base.get("kpis") or [] if k.get("short") not in sh]
    stories = base.get("stories_kpis") or []
    types = {k["type_comparable"]["en"].lower() for k in ic if isinstance(k.get("type_comparable"), dict) and k["type_comparable"].get("en")}
    n_uniques = sum(1 for k in ic if "type_comparable" in k and k["type_comparable"] is None)
    n_classes = sum(1 for k in ic if "type_comparable" in k)
    par_ste[t] = {"kpi_total": len(ic) + len(stories), "kpi_ic_total": len(ic), "stories": len(stories), "types": len(types), "uniques": n_uniques, "classes": n_classes}
    types_univers |= types
    tot_kpi += len(ic) + len(stories); tot_ic += len(ic); classes += n_classes; uniques += n_uniques
out = {"maj": date.today().isoformat(),
       "univers": {"societes": len(u), "kpi_total": tot_kpi, "kpi_ic_total": tot_ic, "types": len(types_univers), "kpi_ic_classes": classes, "kpi_uniques": uniques},
       "par_ste": par_ste}
json.dump(out, open(os.path.join(ROOT, "src/data/kpi-types-comptes.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(out["univers"], ensure_ascii=False))
