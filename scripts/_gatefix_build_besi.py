#!/usr/bin/env python3
"""Build & apply clean BESI.AS KPIs. Hero = Orders (semicap order intake, 5y annual).
Source = genuine BESI annual reports 2020-2024 (2025.txt excluded: cross-polluted)."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_besi import orders_5y, geo_revenue
from _gatefix_apply import mk_kpi, apply

orders = orders_5y()
geo = geo_revenue()


def ser(d):
    return [v for _, v in sorted(d.items())]


orders_items = sorted(orders.items())
kpis = [
    mk_kpi("Orders", "Prises de commandes (Orders)", "Orders", "M €",
           ser(orders), "year",
           "Prises de commandes annuelles (order intake), indicateur avance de l'activite des equipementiers semi-conducteurs, suivi distinct du chiffre d'affaires.",
           value=orders_items[-1][1], typ="Commandes", nature="flow"),
    mk_kpi("China Revenue", "Revenu Chine", "China Revenue", "M €",
           ser(geo["China"]), "year",
           "Chiffre d'affaires annuel realise en Chine, premier marche geographique de Besi.",
           typ="Segment geo"),
    mk_kpi("United States Revenue", "Revenu Etats-Unis", "United States Revenue", "M €",
           ser(geo["United States"]), "year",
           "Chiffre d'affaires annuel realise aux Etats-Unis.",
           typ="Segment geo"),
    mk_kpi("Taiwan Revenue", "Revenu Taiwan", "Taiwan Revenue", "M €",
           ser(geo["Taiwan"]), "year",
           "Chiffre d'affaires annuel realise a Taiwan.",
           typ="Segment geo"),
    mk_kpi("Malaysia Revenue", "Revenu Malaisie", "Malaysia Revenue", "M €",
           ser(geo["Malaysia"]), "year",
           "Chiffre d'affaires annuel realise en Malaisie.",
           typ="Segment geo"),
]

apply(
    slug="besi.as", ticker="BESI.AS", kpis=kpis,
    hero_short="Orders",
    hero_rationale_fr="Les prises de commandes (order intake) sont l'indicateur avance de reference des equipementiers semi-conducteurs comme Besi. Suivi annuel sur 5 ans, distinct du chiffre d'affaires.",
    hero_last_date="2024-12-31",
)
