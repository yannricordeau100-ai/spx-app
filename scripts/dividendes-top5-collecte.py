#!/usr/bin/env python3
"""Top 5 rendement du dividende + taux de distribution : CAC 40, S&P 500, PEA (mission admin, 1er oct 2026).

Source : Yahoo Finance via yfinance (l API FMP gratuite ne couvre ni les actions europeennes ni la plupart
des actions americaines : voir docs/cahier/fmp-couverture-gratuite.json).

Definitions (jamais de valeur inventee) :
- rendement = dividendes VERSES sur les 12 derniers mois (historique des detachements Yahoo) / dernier cours.
  Controle croise avec trailingAnnualDividendYield de Yahoo : ecart > 15 % = valeur ecartee (motif note).
- taux de distribution = payoutRatio de Yahoo (dividendes / benefice net sur 12 mois). Absent = null (affiche n.d.).
- PEA : societes de l univers cotees sur une place de l UE (suffixes .PA .DE .AS ...) et dont le pays (Yahoo)
  est dans l UE ou l EEE. Suisse et Royaume-Uni exclus.

Ecrit src/data/admin-dividendes-top5.json (lu cote serveur par le bloc admin).
Usage : python3 scripts/dividendes-top5-collecte.py
"""
import json, os, datetime, time
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "admin-dividendes-top5.json")
CACHE = os.path.join(ROOT, ".cache", "dividendes-yf.json")
UE_EEE = {"France", "Germany", "Netherlands", "Belgium", "Luxembourg", "Italy", "Spain", "Portugal", "Ireland",
          "Austria", "Finland", "Sweden", "Denmark", "Greece", "Poland", "Czech Republic", "Czechia", "Hungary",
          "Romania", "Bulgaria", "Croatia", "Slovenia", "Slovakia", "Estonia", "Latvia", "Lithuania", "Cyprus",
          "Malta", "Norway", "Iceland", "Liechtenstein"}
SUFFIXES_UE = (".PA", ".DE", ".AS", ".BR", ".MI", ".MC", ".LS", ".HE", ".ST", ".CO", ".VI", ".IR", ".OL")


def releve(t):
    for essai in range(3):
        try:
            tk = yf.Ticker(t)
            info = tk.info or {}
            divs = tk.dividends
            prix = info.get("currentPrice") or info.get("regularMarketPrice")
            tmk = info.get("regularMarketTime")
            date_cours = datetime.datetime.fromtimestamp(tmk, datetime.timezone.utc).date().isoformat() if tmk else None
            somme12, dernier_detach, exceptionnel, versements12 = None, None, False, []
            if divs is not None and len(divs) > 0:
                fin = divs.index.max()
                ref = datetime.datetime.now(fin.tz) if fin.tz else datetime.datetime.now()
                recents = divs[divs.index > ref - datetime.timedelta(days=365)]
                somme12 = float(recents.sum()) if len(recents) else 0.0
                dernier_detach = fin.date().isoformat()
                anciens = divs[(divs.index <= ref - datetime.timedelta(days=365)) & (divs.index > ref - datetime.timedelta(days=4 * 365))]
                med = float(anciens.median()) if len(anciens) else None
                exceptionnel = bool(med and len(recents) and float(recents.max()) > 2 * med)
                versements12 = [[x.date().isoformat(), round(float(v), 4)] for x, v in recents.items()]
            return {
                "ticker": t,
                "nom": info.get("shortName") or info.get("longName"),
                "nom_long": info.get("longName"),
                "pays": info.get("country"),
                "devise": info.get("currency"),
                "cours": prix,
                "date_cours": date_cours,
                "dividendes_12m": somme12,
                "versements_12m": versements12,
                "versement_exceptionnel": exceptionnel,
                "dernier_detachement": dernier_detach,
                "yahoo_trailing_yield": info.get("trailingAnnualDividendYield"),
                "yahoo_payout": info.get("payoutRatio"),
                "yahoo_dividend_rate": info.get("dividendRate"),
            }
        except Exception as e:  # coupure / limite : on reessaie
            err = str(e)
            time.sleep(5 + 10 * essai)
    return {"ticker": t, "erreur": err[:200]}


def main():
    comp = json.load(open(os.path.join(ROOT, "src", "data", "indices-composition.json")))
    cac = [m["ticker"] for m in comp["indices"]["cac40"]["membres"]]
    sp = [m["ticker"] for m in comp["indices"]["sp500"]["membres"]]
    noms_idx = {m["ticker"]: m["nom"] for k in ("cac40", "sp500", "dax40", "aex25") for m in comp["indices"][k]["membres"]}
    univers = json.load(open(os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")))["tickers"]
    pea_cand = [t for t in univers if t.upper().endswith(SUFFIXES_UE)]
    tous = sorted(set(cac) | set(sp) | set(pea_cand))
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    a_faire = [t for t in tous if t not in cache or "erreur" in cache[t]]
    print("a relever :", len(a_faire), "/", len(tous))
    with ThreadPoolExecutor(max_workers=4) as ex:
        for i, r in enumerate(ex.map(releve, [t.replace(".", "-") if t in ("BRK.B", "BF.B") else t for t in a_faire])):
            cache[a_faire[i]] = r
            if i % 50 == 0:
                json.dump(cache, open(CACHE, "w"))
                print(i, "/", len(a_faire))
    json.dump(cache, open(CACHE, "w"))

    def ligne(t):
        r = cache.get(t) or {}
        if "erreur" in r or not r.get("cours"):
            return None, "releve impossible : " + r.get("erreur", "cours absent")
        d12 = r.get("dividendes_12m")
        if not d12:
            return None, "aucun dividende verse sur 12 mois"
        rdt = d12 / r["cours"]
        # Controle croise avec les deux mesures publiees par Yahoo (rendement 12 mois ; dividende annuel
        # courant / cours). Seul un rendement calcule ANORMALEMENT HAUT (plus de 1,5 fois les deux mesures)
        # sans versement exceptionnel identifie est ecarte : c est le seul cas qui fausserait le classement.
        ytr = r.get("yahoo_trailing_yield")
        drate = r.get("yahoo_dividend_rate")
        yfw = drate / r["cours"] if drate else None
        refs = [v for v in (ytr, yfw) if v]
        exc = bool(r.get("versement_exceptionnel"))
        if refs and rdt > 1.5 * max(refs) and not exc:
            return None, f"controle croise en echec (calcule {rdt:.4f}, Yahoo 12 mois {ytr}, Yahoo annuel courant {round(yfw, 4) if yfw else None})"
        pay = r.get("yahoo_payout")
        return {
            "ticker": t,
            "nom": noms_idx.get(t) or " ".join((r.get("nom_long") or r.get("nom") or t).split()),
            "pays": r.get("pays"),
            "rendement": round(rdt, 5),
            "taux_distribution": round(pay, 4) if pay else None,
            "dividendes_12m": round(d12, 4),
            "versements_12m": r.get("versements_12m"),
            "dont_exceptionnel": bool(r.get("versement_exceptionnel")),
            "ecart_sources": (not refs) or all(abs(rdt - v) / max(rdt, v) > 0.15 for v in refs),
            "yahoo_rendement_12m": ytr, "yahoo_rendement_annuel_courant": round(yfw, 5) if yfw else None,
            "devise": r.get("devise"),
            "cours": r["cours"],
            "date_cours": r.get("date_cours"),
            "dernier_detachement": r.get("dernier_detachement"),
        }, None

    def top(liste, filtre=lambda r: True):
        ok, ecartes = [], []
        for t in liste:
            l, motif = ligne(t)
            if l and filtre(l):
                ok.append(l)
            elif motif and motif.startswith("controle"):
                r = cache.get(t) or {}
                calc = (r.get("dividendes_12m") or 0) / r["cours"] if r.get("cours") else None
                ecartes.append({"ticker": t, "nom": noms_idx.get(t) or r.get("nom_long") or t, "rendement_calcule": round(calc, 5) if calc else None, "motif": motif})
        ok.sort(key=lambda x: -x["rendement"])
        dates = sorted({x["date_cours"] for x in ok if x["date_cours"]})
        seuil = ok[4]["rendement"] if len(ok) >= 5 else 0
        for e in ecartes:
            e["aurait_pu_entrer_dans_le_top5"] = bool(e["rendement_calcule"] and e["rendement_calcule"] > seuil)
        return {"top5": ok[:5], "societes_avec_dividende": len(ok), "membres": len(liste),
                "ecartes_controle": ecartes, "date_cours_min": dates[0] if dates else None,
                "date_cours_max": dates[-1] if dates else None}

    res = {
        "genere_le": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance (bibliotheque yfinance)",
        "definitions": {
            "rendement": "Dividendes versés sur les 12 derniers mois (versements exceptionnels compris, signalés) divisés par le dernier cours",
            "taux_distribution": "Part du bénéfice net des 12 derniers mois versée en dividendes (payoutRatio Yahoo)",
            "pea": "Sociétés de l’univers Mettrik cotées sur une place de l’Union européenne et domiciliées dans l’UE ou l’EEE (Suisse et Royaume-Uni exclus)",
        },
        "listes": {
            "cac40": {"titre": "CAC 40", **top(cac)},
            "sp500": {"titre": "S&P 500", **top(sp)},
            "pea": {"titre": "PEA", **top(pea_cand, lambda l: (l.get("pays") or "") in UE_EEE)},
        },
    }
    json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
    for k, v in res["listes"].items():
        print(k, v["societes_avec_dividende"], "/", v["membres"], [(x["ticker"], round(x["rendement"] * 100, 2), x["taux_distribution"]) for x in v["top5"]], "ecartes", len(v["ecartes_controle"]))


if __name__ == "__main__":
    main()
