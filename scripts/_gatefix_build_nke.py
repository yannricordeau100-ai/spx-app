#!/usr/bin/env python3
"""Build & apply clean NKE KPIs."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_nke3 import extract
from _gatefix_apply import mk_kpi, apply

s = extract()


def series(key):
    items = sorted(s[key].items())
    return [v for _, v in items]


kpis = [
    mk_kpi("NIKE Direct Revenue", "Revenu NIKE Direct", "NIKE Direct Revenue", "Mds $",
           series("NIKE Direct"), "quarter",
           "Ventes directes au consommateur (magasins NIKE + digital NIKE), hors grossistes. Indicateur cle de la strategie DTC du groupe.",
           typ="Canal"),
    mk_kpi("North America Revenue", "Revenu Amerique du Nord", "North America Revenue", "Mds $",
           series("North America"), "quarter",
           "Revenu trimestriel de la marque NIKE en Amerique du Nord, premier marche du groupe.",
           typ="Segment geo"),
    mk_kpi("EMEA Revenue", "Revenu EMEA", "EMEA Revenue", "Mds $",
           series("EMEA"), "quarter",
           "Revenu trimestriel de la marque NIKE en Europe, Moyen-Orient et Afrique.",
           typ="Segment geo"),
    mk_kpi("Greater China Revenue", "Revenu Grande Chine", "Greater China Revenue", "Mds $",
           series("Greater China"), "quarter",
           "Revenu trimestriel de la marque NIKE en Grande Chine, marche le plus volatil du groupe.",
           typ="Segment geo"),
    mk_kpi("APLA Revenue", "Revenu Asie-Pacifique et Amerique latine", "APLA Revenue", "Mds $",
           series("APLA"), "quarter",
           "Revenu trimestriel de la marque NIKE en Asie-Pacifique et Amerique latine.",
           typ="Segment geo"),
]

# Hero = NIKE Direct (deepest, canonical DTC metric, distinct from CA total).
apply(
    slug="nke", ticker="NKE", kpis=kpis,
    hero_short="NIKE Direct Revenue",
    hero_rationale_fr="NIKE Direct (ventes directes magasins + digital) est l'axe strategique central du groupe: marge superieure et relation client directe. Suivi trimestriel sur plus de 6 ans.",
    hero_last_date="2026-02-28",
)
