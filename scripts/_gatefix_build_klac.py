#!/usr/bin/env python3
"""Build & apply clean KLAC KPIs. Hero = Wafer Inspection Revenue (core KLA product line)."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_klac import extract
from _gatefix_apply import mk_kpi, apply

s = extract()


def ser(name):
    return [v for _, v in sorted(s[name].items())]


def last_date(name):
    it = sorted(s[name].items())
    return it[-1][0] if it else None


kpis = [
    mk_kpi("Wafer Inspection Revenue", "Revenu inspection de wafers", "Wafer Inspection Revenue", "Mds $",
           ser("Wafer Inspection"), "quarter",
           "Revenu de l'inspection de wafers, coeur du metier KLA et premiere ligne de produits du controle de process semi-conducteur.",
           typ="Produit"),
    mk_kpi("Patterning Revenue", "Revenu Patterning", "Patterning Revenue", "Mds $",
           ser("Patterning"), "quarter",
           "Revenu des systemes de metrologie et controle de la lithographie (patterning).",
           typ="Produit"),
    mk_kpi("Services Revenue", "Revenu Services", "Services Revenue", "Mds $",
           ser("Services"), "quarter",
           "Revenu recurrent de services et maintenance de la base installee KLA.",
           typ="Produit"),
    mk_kpi("Specialty Semiconductor Process Rev", "Revenu Specialty Semiconductor Process",
           "Specialty Semiconductor Process Revenue", "Mds $",
           ser("Specialty Semiconductor Process"), "quarter",
           "Revenu du segment Specialty Semiconductor Process (depot, gravure, etc.).",
           typ="Segment"),
    mk_kpi("PCB & Component Inspection Rev", "Revenu PCB et inspection de composants",
           "PCB & Component Inspection Revenue", "Mds $",
           ser("PCB & Component Inspection"), "quarter",
           "Revenu du segment inspection de circuits imprimes (PCB) et de composants.",
           typ="Segment"),
]

apply(
    slug="klac", ticker="KLAC", kpis=kpis,
    hero_short="Wafer Inspection Revenue",
    hero_rationale_fr="L'inspection de wafers est le coeur du metier KLA et la premiere ligne de produits du controle de process. Suivi trimestriel sur plus de 7 ans, distinct du CA total.",
    hero_last_date=last_date("Wafer Inspection"),
)
