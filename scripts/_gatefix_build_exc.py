#!/usr/bin/env python3
"""Build & apply clean EXC KPIs. Hero = ComEd Revenue (largest regulated utility).
Post-Constellation-spinoff (2022+) data only, consistent pure-utility series."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_exc import extract
from _gatefix_apply import mk_kpi, apply

s = extract()


def ser(k):
    return [v for _, v in sorted(s[k].items())]


def ld(k):
    it = sorted(s[k].items())
    return it[-1][0] if it else None


kpis = [
    mk_kpi("ComEd Revenue", "Revenu ComEd", "ComEd Revenue", "Mds $",
           ser("ComEd"), "quarter",
           "Chiffre d'affaires trimestriel de ComEd (distribution electrique de la region de Chicago), premiere des six utilities regulees d'Exelon.",
           typ="Utility regulee"),
    mk_kpi("PECO Revenue", "Revenu PECO", "PECO Revenue", "Mds $",
           ser("PECO"), "quarter",
           "Chiffre d'affaires trimestriel de PECO (electricite et gaz de la region de Philadelphie).",
           typ="Utility regulee"),
    mk_kpi("BGE Revenue", "Revenu BGE", "BGE Revenue", "Mds $",
           ser("BGE"), "quarter",
           "Chiffre d'affaires trimestriel de BGE (Baltimore Gas and Electric, electricite et gaz du Maryland).",
           typ="Utility regulee"),
    mk_kpi("PHI Revenue", "Revenu PHI (Pepco Holdings)", "PHI Revenue", "Mds $",
           ser("PHI"), "quarter",
           "Chiffre d'affaires trimestriel de PHI (Pepco Holdings: Pepco, Delmarva Power DPL et Atlantic City Electric ACE).",
           typ="Utility regulee"),
]

apply(
    slug="exc", ticker="EXC", kpis=kpis,
    hero_short="ComEd Revenue",
    hero_rationale_fr="ComEd (Chicago) est la premiere des utilities regulees d'Exelon. Suivi trimestriel sur 4 ans depuis la scission de Constellation (2022), valeur distincte du CA total.",
    hero_last_date=ld("ComEd"),
)
