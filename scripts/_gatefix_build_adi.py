#!/usr/bin/env python3
"""Build & apply clean ADI KPIs. Hero = Industrial Revenue (core ADI end-market)."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_adi import extract
from _gatefix_apply import mk_kpi, apply

s = extract()


def ser(k):
    return [v for _, v in sorted(s[k].items())]


def ld(k):
    it = sorted(s[k].items())
    return it[-1][0] if it else None


kpis = [
    mk_kpi("Industrial Revenue", "Revenu Industriel", "Industrial Revenue", "Mds $",
           ser("Industrial"), "quarter",
           "Revenu trimestriel du marche Industriel, premier debouche d'Analog Devices (automatisation, instrumentation, energie).",
           typ="Marche"),
    mk_kpi("Automotive Revenue", "Revenu Automobile", "Automotive Revenue", "Mds $",
           ser("Automotive"), "quarter",
           "Revenu trimestriel du marche Automobile (electrification, connectivite, batterie).",
           typ="Marche"),
    mk_kpi("Communications Revenue", "Revenu Communications", "Communications Revenue", "Mds $",
           ser("Communications"), "quarter",
           "Revenu trimestriel du marche Communications (infrastructure reseau et data center).",
           typ="Marche"),
    mk_kpi("Consumer Revenue", "Revenu Grand public", "Consumer Revenue", "Mds $",
           ser("Consumer"), "quarter",
           "Revenu trimestriel du marche Grand public (audio, portables, wearables).",
           typ="Marche"),
]

apply(
    slug="adi", ticker="ADI", kpis=kpis,
    hero_short="Industrial Revenue",
    hero_rationale_fr="Le marche Industriel est le premier debouche d'Analog Devices et le plus rentable. Suivi trimestriel sur plus de 7 ans, valeur distincte du CA total.",
    hero_last_date=ld("Industrial"),
)
