#!/usr/bin/env python3
"""Build & apply clean CF KPIs. Hero = Ammonia Production (gross nitrogen flagship)."""
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_cf import extract
from _gatefix_apply import mk_kpi, apply

rev, vol = extract()


def ser(d, k):
    return [v for _, v in sorted(d[k].items())]


def ld(d, k):
    it = sorted(d[k].items())
    return it[-1][0] if it else None


kpis = [
    # Production volumes (the literal "production azote" per product) — hero = Ammonia.
    mk_kpi("Ammonia Production", "Production d'ammoniac", "Ammonia Production", "M tonnes",
           ser(vol, "Ammonia prod"), "quarter",
           "Production brute d'ammoniac (incluant les volumes ensuite transformes en uree, UAN ou AN). Produit azote fondamental de CF Industries.",
           typ="Production", nature="flow"),
    mk_kpi("UAN Production", "Production UAN", "UAN Production", "M tonnes",
           ser(vol, "UAN prod"), "quarter",
           "Production trimestrielle de solution azotee UAN (base 32% azote).",
           typ="Production", nature="flow"),
    mk_kpi("Granular Urea Production", "Production d'uree granulee", "Granular Urea Production", "M tonnes",
           ser(vol, "Granular Urea prod"), "quarter",
           "Production trimestrielle d'uree granulee.",
           typ="Production", nature="flow"),
    mk_kpi("AN Production", "Production de nitrate d'ammonium", "AN Production", "M tonnes",
           ser(vol, "AN prod"), "quarter",
           "Production trimestrielle de nitrate d'ammonium (AN).",
           typ="Production", nature="flow"),
    # Net sales by product (volumes de vente valorises par produit).
    mk_kpi("Ammonia Net Sales", "Ventes d'ammoniac", "Ammonia Net Sales", "Mds $",
           ser(rev, "Ammonia"), "quarter",
           "Chiffre d'affaires trimestriel du segment Ammoniac.",
           typ="Segment produit"),
    mk_kpi("UAN Net Sales", "Ventes UAN", "UAN Net Sales", "Mds $",
           ser(rev, "UAN"), "quarter",
           "Chiffre d'affaires trimestriel du segment UAN.",
           typ="Segment produit"),
    mk_kpi("Granular Urea Net Sales", "Ventes d'uree granulee", "Granular Urea Net Sales", "Mds $",
           ser(rev, "Granular Urea"), "quarter",
           "Chiffre d'affaires trimestriel du segment Uree granulee.",
           typ="Segment produit"),
    mk_kpi("AN Net Sales", "Ventes de nitrate d'ammonium", "AN Net Sales", "Mds $",
           ser(rev, "AN"), "quarter",
           "Chiffre d'affaires trimestriel du segment Nitrate d'ammonium.",
           typ="Segment produit"),
]

apply(
    slug="cf", ticker="CF", kpis=kpis,
    hero_short="Ammonia Production",
    hero_rationale_fr="La production brute d'ammoniac est le produit azote fondamental de CF Industries (base de l'uree, de l'UAN et de l'AN). Suivi trimestriel sur plus de 7 ans, metrique operationnelle distincte du CA total.",
    hero_last_date=ld(vol, "Ammonia prod"),
)
