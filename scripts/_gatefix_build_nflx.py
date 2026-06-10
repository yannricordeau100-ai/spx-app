#!/usr/bin/env python3
"""Build & apply clean NFLX KPIs. Hero = Total Paid Memberships (canonical)."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_nflx2 import extract
from _gatefix_apply import mk_kpi, apply

rev, memb, total = extract()


def ser(d):
    return [v for _, v in sorted(d.items())]


total_items = sorted(total.items())
kpis = [
    mk_kpi("Total Paid Memberships", "Abonnes payants totaux", "Total Paid Memberships", "M",
           ser(total), "quarter",
           "Nombre total d'abonnes payants Netflix (somme des 4 regions). Base monetisable directe du groupe. Netflix a cesse la publication trimestrielle apres T1 2025.",
           value=total_items[-1][1], typ="Abonnes", nature="stock"),
    mk_kpi("UCAN Revenue", "Revenu Etats-Unis et Canada", "UCAN Revenue", "Mds $",
           ser(rev["UCAN"]), "quarter",
           "Revenu de streaming de la region Etats-Unis et Canada, premiere region de Netflix.",
           typ="Segment geo"),
    mk_kpi("EMEA Revenue", "Revenu EMEA", "EMEA Revenue", "Mds $",
           ser(rev["EMEA"]), "quarter",
           "Revenu de streaming de la region Europe, Moyen-Orient et Afrique.",
           typ="Segment geo"),
    mk_kpi("LATAM Revenue", "Revenu Amerique latine", "LATAM Revenue", "Mds $",
           ser(rev["LATAM"]), "quarter",
           "Revenu de streaming de la region Amerique latine.",
           typ="Segment geo"),
    mk_kpi("APAC Revenue", "Revenu Asie-Pacifique", "APAC Revenue", "Mds $",
           ser(rev["APAC"]), "quarter",
           "Revenu de streaming de la region Asie-Pacifique, region la plus dynamique de Netflix.",
           typ="Segment geo"),
]

apply(
    slug="nflx", ticker="NFLX", kpis=kpis,
    hero_short="Total Paid Memberships",
    hero_rationale_fr="Les abonnes payants sont la base monetisable directe de Netflix. Suivi sur plus de 4 ans (somme verifiee des 4 regions). Publication trimestrielle arretee apres T1 2025, dernier point T4 2024.",
    hero_last_date=total_items[-1][0],
)
