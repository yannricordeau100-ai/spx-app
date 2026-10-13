#!/usr/bin/env python3
"""dividend_meta des fiches du niveau 1 (vague sp5001000), 12 oct 2026.

Le script qui a produit dividend_meta pour l univers principal (SEC EDGAR
companyconcept, mai 2026) n est plus dans le depot. Meme sortie, recalculee
SANS RESEAU depuis data-lake/<T>/xbrl/companyfacts.json deja telecharge :
  - dps_xbrl_history : dividende par action publie par exercice (us-gaap
    CommonStockDividendsPerShareDeclared, a defaut ...CashPaid), periodes de
    330 a 380 jours, valeur du depot le plus RECENT pour chaque periode (les
    chiffres retraites apres division d action priment) ;
  - first_year_xbrl, years_streak_increases (annees consecutives de hausse
    stricte jusqu a la derniere), xbrl_source, xbrl_fetched_at.
first_year (annee du premier dividende, lue dans le 10-K) n est PAS pose :
aucune source sure ici, jamais de valeur inventee.

Ecrit dans src/data/v2-pipeline-enrich/<t>.json (cle dividend_meta), jamais
dans le PL (reconstruit par sp5001000-onboard.py). Ne touche pas une
dividend_meta deja presente sauf --force.

Usage : python3 scripts/sp5001000-dividend-meta-xbrl.py --tickers-file src/data/univers-sp5001000.json [--force]
"""
import argparse
import datetime as dt
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONCEPTS = ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"]


def jours(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days


def historique(facts):
    g = (facts.get("facts") or {}).get("us-gaap") or {}
    par_an = {}
    for c in CONCEPTS:
        vals = ((g.get(c) or {}).get("units") or {}).get("USD/shares") or []
        retenu = {}
        for x in vals:
            if not x.get("start") or not x.get("end") or not isinstance(x.get("val"), (int, float)):
                continue
            if not 330 <= jours(x["start"], x["end"]) <= 380:
                continue
            cle = (x["start"], x["end"])
            if cle not in retenu or x.get("filed", "") > retenu[cle].get("filed", ""):
                retenu[cle] = x
        for (s, e), x in retenu.items():
            an = e[:4]
            if an not in par_an and x["val"] > 0:
                par_an[an] = round(float(x["val"]), 4)
    return dict(sorted(par_an.items()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", required=True)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    d = json.load(open(a.tickers_file))
    tickers = d["tickers"] if isinstance(d, dict) else d
    bilan = {"ecrit": 0, "deja": 0, "sans_xbrl": 0, "sans_dividende": 0}
    for t in tickers:
        pe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        if en.get("dividend_meta") and not a.force:
            bilan["deja"] += 1
            continue
        pf = f"{ROOT}/data-lake/{t}/xbrl/companyfacts.json"
        if not os.path.exists(pf):
            bilan["sans_xbrl"] += 1
            continue
        facts = json.load(open(pf))
        h = historique(facts)
        if len(h) < 2:
            bilan["sans_dividende"] += 1
            continue
        ans = sorted(h)
        serie = 0
        for i in range(len(ans) - 1, 0, -1):
            if int(ans[i]) - int(ans[i - 1]) == 1 and h[ans[i]] > h[ans[i - 1]]:
                serie += 1
            else:
                break
        cik = str(facts.get("cik", "")).zfill(10)
        en["dividend_meta"] = {
            "first_year_xbrl": int(ans[0]),
            "years_streak_increases": serie,
            "dps_xbrl_history": h,
            "xbrl_source": f"SEC EDGAR companyfacts CIK{cik}",
            "xbrl_fetched_at": dt.datetime.fromtimestamp(os.path.getmtime(pf), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        with open(pe, "w", encoding="utf-8") as f:
            json.dump(en, f, ensure_ascii=False, indent=2)
        bilan["ecrit"] += 1
    print(json.dumps(bilan, ensure_ascii=False))


if __name__ == "__main__":
    main()
