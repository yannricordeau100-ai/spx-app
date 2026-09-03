#!/usr/bin/env python3
"""
Quatre indicateurs annuels sur 10 ans pour les societes US (Yann 3 sept 2026).

  - chiffre d affaires
  - flux de tresorerie libre (flux d exploitation moins investissements)
  - dette totale (court terme + part courante + long terme)
  - effectifs  (pose par scripts/kpi-effectifs.py, pas ici : absents du XBRL)

Tout vient des donnees XBRL deposees par la societe elle-meme a la SEC
(api companyfacts), et uniquement des valeurs portees par un 10-K : meme
instant que le rapport annuel, comme demande. Chaque valeur garde le numero
de depot (accn) qui la porte, pour pouvoir la retrouver.

Usage :
  python3 scripts/kpi-annuel-10ans.py                 # toutes les stes US
  python3 scripts/kpi-annuel-10ans.py --tickers AAPL,KO
  python3 scripts/kpi-annuel-10ans.py --force          # refait celles deja faites
"""
from __future__ import annotations
import argparse, json, os, ssl, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SORTIE = ROOT / "src/data/kpi-annuel-10ans"
CIK_MAP = ROOT / ".conv-state/quarterly-refresh-cik-map.json"
UA = "Mettrik AI ricordeauyann@gmail.com"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
ANNEES = 10

# Concepts par ordre de preference. Le premier qui donne une valeur gagne.
CONCEPTS = {
    # Chiffre d affaires NET. "IncludingAssessedTax" comprend les droits
    # d accise (Constellation Brands : 10,96 au lieu de 10,21) : il ne sert que
    # si aucun autre concept ne renseigne l exercice.
    "revenue": [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        # Banques et courtiers : produit net bancaire. On n ajoute PAS les
        # interets bruts, qui depassent le total.
        "RevenuesNetOfInterestExpense",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
    ],
    "revenue_repli": ["RevenueFromContractWithCustomerIncludingAssessedTax"],
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "capex": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
        "PaymentsForCapitalImprovements",
    ],
    # Dette : trois postes assembles, cf. dette_totale(). Les societes changent
    # de concept au fil des annees (Coca-Cola bascule en 2023 sur les intitules
    # "AndCapitalLeaseObligations") : chaque poste accepte donc plusieurs noms.
    "_dette_courante_totale": ["DebtCurrent"],
    "_dette_part_courante": ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    "_dette_court_terme": ["ShortTermBorrowings", "OtherShortTermBorrowings", "CommercialPaper"],
    "_dette_long": ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebt"],
}


def http_json(url: str, essais: int = 4):
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=90, context=CTX) as r:
                brut = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip, io
                    brut = gzip.GzipFile(fileobj=io.BytesIO(brut)).read()
                return json.loads(brut)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(3 * (i + 1))
        except Exception:
            time.sleep(3 * (i + 1))
    return None


def valeurs_annuelles(facts: dict, concepts: list[str], instant: bool) -> dict:
    """{annee: {"valeur":x, "fin":"AAAA-MM-JJ", "concept":c, "accn":a}}

    Uniquement les valeurs portees par un 10-K. Pour un flux (instant=False) on
    exige une duree proche de 12 mois : sinon on ramasserait un trimestre.

    Deux pieges de l API SEC, corriges ici :
      - le champ `fy` est l exercice du DEPOT, pas celui du chiffre : un 10-K
        porte aussi les deux exercices precedents, tous marques du meme `fy`.
        On classe donc par l annee de la date de FIN de periode.
      - une societe change de concept au fil du temps (SalesRevenueNet avant
        2018, RevenueFromContractWithCustomer ensuite). On ne s arrete donc pas
        au premier concept qui repond : on complete les annees manquantes avec
        les suivants, par ordre de preference.
    """
    out: dict[int, dict] = {}
    for rang, c in enumerate(concepts):
        bloc = facts.get(c)
        if not bloc:
            continue
        for unite, entrees in (bloc.get("units") or {}).items():
            if not unite.startswith("USD"):
                continue
            for e in entrees:
                if not str(e.get("form", "")).startswith("10-K"):
                    continue
                if e.get("fp") not in (None, "FY"):
                    continue
                val = e.get("val")
                fin = e.get("end")
                if not isinstance(val, (int, float)) or not fin:
                    continue
                try:
                    fy = int(str(fin)[:4])
                except ValueError:
                    continue
                if instant:
                    if e.get("start"):
                        continue
                else:
                    debut = e.get("start")
                    if not debut:
                        continue
                    from datetime import date
                    try:
                        d1 = date.fromisoformat(debut)
                        d2 = date.fromisoformat(fin)
                    except ValueError:
                        continue
                    jours = (d2 - d1).days
                    if not (330 <= jours <= 400):
                        continue
                depose = e.get("filed") or ""
                garde = out.get(fy)
                # Un concept mieux place l emporte ; a concept egal, le depot le
                # plus recent fait foi (corrections comprises).
                if (garde is None
                        or rang < garde["rang"]
                        or (rang == garde["rang"] and depose > garde.get("depose", ""))):
                    out[fy] = {"valeur": float(val), "fin": fin, "concept": c,
                               "accn": e.get("accn"), "depose": depose, "rang": rang}
    return out


def dette_totale(facts: dict) -> dict:
    """Dette financiere totale = part longue + part courante + court terme.

    `DebtCurrent` regroupe deja toute la dette a moins d un an : quand elle
    existe, elle remplace les deux postes courants au lieu de s y ajouter.
    `LongTermDebt` inclut la part courante : on ne la recompte pas non plus.
    """
    tot_court = valeurs_annuelles(facts, CONCEPTS["_dette_courante_totale"], instant=True)
    part_cour = valeurs_annuelles(facts, CONCEPTS["_dette_part_courante"], instant=True)
    court_t = valeurs_annuelles(facts, CONCEPTS["_dette_court_terme"], instant=True)
    long_ = valeurs_annuelles(facts, CONCEPTS["_dette_long"], instant=True)
    out = {}
    for fy in set(tot_court) | set(part_cour) | set(court_t) | set(long_):
        l = long_.get(fy)
        morceaux, noms = [], []
        if l is not None:
            morceaux.append(l["valeur"])
            noms.append(l["concept"])
        inclut_courant = l is not None and l["concept"] == "LongTermDebt"
        if not inclut_courant:
            tc = tot_court.get(fy)
            if tc is not None:
                morceaux.append(tc["valeur"])
                noms.append(tc["concept"])
            else:
                for poste in (part_cour.get(fy), court_t.get(fy)):
                    if poste is not None:
                        morceaux.append(poste["valeur"])
                        noms.append(poste["concept"])
        else:
            ct = court_t.get(fy)
            if ct is not None:
                morceaux.append(ct["valeur"])
                noms.append(ct["concept"])
        if not morceaux:
            continue
        ref = l or tot_court.get(fy) or part_cour.get(fy) or court_t.get(fy)
        out[fy] = {"valeur": sum(morceaux), "fin": ref["fin"], "concept": "+".join(noms),
                   "accn": ref["accn"], "depose": ref["depose"]}
    return out


def serie(par_annee: dict, annees_gardees: list[int]) -> dict | None:
    pts = [(a, par_annee[a]) for a in annees_gardees if a in par_annee]
    if len(pts) < 3:
        return None
    return {
        "history": [round(p[1]["valeur"], 2) for p in pts],
        "history_periods": [str(p[0]) for p in pts],
        "fins": [p[1]["fin"] for p in pts],
        "sources": [p[1]["accn"] for p in pts],
        "concept": pts[-1][1]["concept"],
        "value": round(pts[-1][1]["valeur"], 2),
        "last_data_date": pts[-1][1]["fin"],
    }


def cik_du_datalake(ticker: str) -> str | None:
    """Le CIK porte par les depots deja telecharges. Filet de securite : la
    table officielle SEC pointe parfois vers une entite RECENTE qui ne porte
    aucun 10-K historique (cas ExxonMobil, reorganise : la table donne
    2115436, les 10-K sont sous 34088)."""
    f = ROOT / "data-lake" / ticker / "xbrl" / "facts.json"
    if not f.exists():
        return None
    try:
        d = json.loads(f.read_text())
    except Exception:
        return None
    from collections import Counter
    c = Counter()
    for e in d:
        ref = (e or {}).get("ref") if isinstance(e, dict) else None
        if isinstance(ref, str) and ref.startswith("accn:"):
            c[ref[5:].split("-")[0]] += 1
    return c.most_common(1)[0][0] if c else None


def _extrait(cik: str) -> dict | None:
    d = http_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json")
    if not d:
        return None
    return (d.get("facts") or {}).get("us-gaap") or None


def traite(ticker: str, cik: str) -> dict | None:
    us = _extrait(cik)
    annees_vues = len(valeurs_annuelles(us, CONCEPTS["revenue"], instant=False)) if us else 0
    if annees_vues < 5:
        autre = cik_du_datalake(ticker)
        if autre and int(autre) != int(cik):
            us2 = _extrait(autre)
            if us2 and len(valeurs_annuelles(us2, CONCEPTS["revenue"], instant=False)) > annees_vues:
                us, cik = us2, autre
    d = {"facts": {"us-gaap": us or {}}}
    if not us:
        return None
    # Le chiffre d affaires total n est pas porte par le meme concept selon le
    # secteur : une foncière ou une banque declare "Revenues" (loyers, interets)
    # alors que RevenueFromContractWithCustomer ne couvre qu une partie. Les
    # concepts se recouvrent sans jamais depasser le total : on retient donc,
    # pour chaque exercice, la valeur la plus haute.
    rev = {}
    for c in CONCEPTS["revenue"]:
        for an, e in valeurs_annuelles(us, [c], instant=False).items():
            if an not in rev or e["valeur"] > rev[an]["valeur"]:
                rev[an] = e
    for an, e in valeurs_annuelles(us, CONCEPTS["revenue_repli"], instant=False).items():
        rev.setdefault(an, e)
    ocf = valeurs_annuelles(us, CONCEPTS["operating_cash_flow"], instant=False)
    cap = valeurs_annuelles(us, CONCEPTS["capex"], instant=False)
    det = dette_totale(us)
    toutes = sorted(set(rev) | set(ocf) | set(det), reverse=True)[:ANNEES]
    gardees = sorted(toutes)
    if not gardees:
        return None
    # Flux de tresorerie libre : exploitation moins investissements, seulement
    # quand les DEUX viennent du meme exercice (sinon la soustraction est fausse).
    fcf = {}
    for fy in gardees:
        o, c = ocf.get(fy), cap.get(fy)
        if o is None:
            continue
        montant = o["valeur"] - (c["valeur"] if c else 0.0)
        fcf[fy] = {"valeur": montant, "fin": o["fin"], "depose": o["depose"],
                   "concept": "flux_exploitation - investissements" if c else "flux_exploitation (investissements absents)",
                   "accn": o["accn"]}
    res = {
        "ticker": ticker,
        "cik": int(cik),
        "method": "xbrl-companyfacts-10k",
        "fenetre": f"{gardees[0]}-{gardees[-1]}",
        "series": {},
    }
    for nom, source in (("revenue_annuel", rev), ("fcf_annuel", fcf), ("dette_annuelle", det)):
        s = serie(source, gardees)
        if s:
            res["series"][nom] = s
    return res if res["series"] else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    SORTIE.mkdir(parents=True, exist_ok=True)
    cik = json.load(open(CIK_MAP))
    if a.tickers:
        liste = [t.strip().upper() for t in a.tickers.split(",") if t.strip()]
    else:
        univers = json.load(open(ROOT / "src/data/v1-9-5-clean-all-tickers.json"))["tickers"]
        liste = [t for t in univers if "." not in t]
    faits = ratés = 0
    for i, t in enumerate(liste, 1):
        dest = SORTIE / f"{t}.json"
        if dest.exists() and not a.force:
            faits += 1
            continue
        c = cik.get(t) or cik.get(t.upper())
        if not c:
            print(f"[{i}/{len(liste)}] {t} : CIK inconnu", flush=True)
            ratés += 1
            continue
        r = traite(t, str(c))
        if r:
            dest.write_text(json.dumps(r, ensure_ascii=False, indent=1))
            faits += 1
            noms = ",".join(r["series"])
            print(f"[{i}/{len(liste)}] {t} : {r['fenetre']} {noms}", flush=True)
        else:
            ratés += 1
            print(f"[{i}/{len(liste)}] {t} : aucune donnee", flush=True)
        time.sleep(0.15)   # limite SEC : 10 requetes/s, on reste tres en dessous
    print(f"FINI faits={faits} rates={ratés}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
