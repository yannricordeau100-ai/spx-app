#!/usr/bin/env python3
"""
Tag is_wow / is_generic / is_short_history sur les 5 sociétés V1, et set
hero_kpi_rationale. Préserve l'ordre original des KPIs dans le JSON pour
ne pas casser quoi que ce soit (l'ordre d'AFFICHAGE est calculé runtime
par orderKpis()).
"""
import json
from pathlib import Path

DATA = Path("/Users/yann/spx-app/src/data")

# Tags par société : (KPI.short → ("wow" | "generic"))
# Convention : tout KPI absent ici = generic par défaut
TAGS = {
    "meta.json": {
        "hero_kpi_rationale": "DAP est LE KPI distinctif de Meta : nombre d'utilisateurs uniques quotidiens cross-apps. Plus parlant que Revenue car capture l'audience effective qui est la base de monétisation publicitaire.",
        "wow": {"DAP", "ARPP", "Ad Impr", "Ad Price", "RL Loss", "FoA Op", "Capex"},
        "generic": {"Revenue", "Op Margin", "Net Income", "EPS", "Headcount"},
    },
    "google.json": {
        "hero_kpi_rationale": "Google Cloud est le segment qui change la trajectoire d'Alphabet. Plus parlant que Search Revenue (mature) ou Total Revenue, car il signale la diversification au-delà de la pub.",
        "wow": {"Cloud", "YT Ads", "Search", "Subs", "TAC", "Capex", "Other Bets"},
        "generic": {"Revenue", "Op Margin", "Net Income", "EPS", "Headcount"},
    },
    "msci.json": {
        "hero_kpi_rationale": "Run Rate = revenu annualisé contractuel à date. KPI maître chez MSCI, suivi trimestriellement par tous les analystes du secteur indices/analytics.",
        "wow": {"Total RR", "Sub RR", "ABF", "Index", "Analytics", "Retention", "EBITDA Mgn", "Net New"},
        "generic": {"EBITDA", "Revenue"},
    },
    "spgi.json": {
        "hero_kpi_rationale": "Ratings (~32 % du CA SPGI) est le segment cyclique le plus suivi : il sert de signal des marchés crédit globaux. Plus parlant que Total Revenue.",
        "wow": {"Ratings", "MI", "Indices", "Energy", "Mobility", "Vitality"},
        "generic": {"Op Margin", "Revenue", "EPS", "Net Income"},
    },
    "cat.json": {
        "hero_kpi_rationale": "Backlog (carnet de commandes) donne 6-18 mois de visibilité sur le CA futur. Pour Caterpillar (cycles longs machines lourdes), c'est le KPI N°1 des analystes secteur.",
        "wow": {"Backlog", "FCF MP&E", "Construction", "Energy", "Resource", "Cap Return"},
        "generic": {"Op Margin", "Revenue", "EPS", "Net Income", "Capex"},
    },
}


def main():
    for fname, tags in TAGS.items():
        path = DATA / fname
        d = json.loads(path.read_text())
        d["hero_kpi_rationale"] = tags["hero_kpi_rationale"]
        wow = tags["wow"]
        generic = tags["generic"]
        n_wow = n_generic = n_unset = 0
        for k in d.get("kpis", []):
            short = k["short"]
            if short in wow:
                k["is_wow"] = True
                k["is_generic"] = False
                n_wow += 1
            elif short in generic:
                k["is_wow"] = False
                k["is_generic"] = True
                n_generic += 1
            else:
                # Default = generic si pas tagué
                k["is_wow"] = False
                k["is_generic"] = True
                n_unset += 1
            # Pour V1 : tous les KPIs ont 5 ans, donc is_short_history = false
            k["is_short_history"] = False
        # Ajouter une story_category par défaut sur market_positions ?
        # Géré côté UI par kpi-stories-ordering.ts, pas de tag dans les KPI ici.
        path.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
        print(f"  ✓ {fname}: {n_wow} wow, {n_generic} generic, {n_unset} default-generic, hero={d['hero_kpi']}")


if __name__ == "__main__":
    main()
