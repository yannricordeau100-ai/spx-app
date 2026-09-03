#!/usr/bin/env python3
"""
Assemble les quatre indicateurs annuels pour la fiche (Yann 3 sept 2026).

Entrees :
  src/data/kpi-annuel-10ans/<T>.json   chiffre d affaires, flux libre, dette
  src/data/kpi-effectifs/<T>.json      effectifs lus dans les 10-K

Sortie :
  src/data/kpi-annuel-fiche/<T>.json   4 KPI prets a afficher

Les effectifs sont ranges par EXERCICE et non par date de depot : un 10-K
depose en fevrier 2026 decrit l exercice 2025. On rattache donc chaque depot
a l exercice dont la cloture precede immediatement le depot, en se servant des
dates de cloture reelles portees par les series financieres.
"""
from __future__ import annotations
import argparse, json, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIN = ROOT / "src/data/kpi-annuel-10ans"
EFF = ROOT / "src/data/kpi-effectifs"
SORTIE = ROOT / "src/data/kpi-annuel-fiche"

LIBELLES = {
    # Textes affiches aux visiteurs : francais complet, accents et apostrophes.
    "revenue_annuel": ("Chiffre d\u2019affaires", "Revenue", "Mds $",
                       "Ventes totales de l\u2019exercice, telles que publi\u00e9es dans le rapport annuel d\u00e9pos\u00e9 \u00e0 la SEC."),
    "fcf_annuel": ("Flux de tr\u00e9sorerie libre", "Free cash flow", "Mds $",
                   "Tr\u00e9sorerie d\u00e9gag\u00e9e par l\u2019activit\u00e9 une fois les investissements pay\u00e9s. C\u2019est l\u2019argent r\u00e9ellement disponible pour rembourser la dette, verser un dividende ou racheter des actions."),
    "dette_annuelle": ("Dette totale", "Total debt", "Mds $",
                       "Dettes financi\u00e8res \u00e0 court et \u00e0 long terme \u00e0 la cl\u00f4ture de l\u2019exercice, hors dettes d\u2019exploitation."),
    "effectifs_annuels": ("Effectifs", "Employees", "salari\u00e9s",
                          "Nombre total de salari\u00e9s du groupe \u00e0 la cl\u00f4ture de l\u2019exercice, tel qu\u2019annonc\u00e9 dans le rapport annuel."),
}


def yoy(hist: list[float]) -> str | None:
    """Variation sur un an. Un pourcentage calcule sur une base negative
    (tresorerie libre deficitaire) n a aucun sens lisible : on ne le publie
    pas, la phrase de lecture donne alors l ecart en montant."""
    if len(hist) < 2 or not hist[-2]:
        return None
    if hist[-2] <= 0 or hist[-1] < 0:
        return None
    v = (hist[-1] - hist[-2]) / hist[-2] * 100
    return f"{'+' if v >= 0 else ''}{v:.1f}%"


def nombre_fr(v: float, unite: str) -> str:
    if unite == "salari\u00e9s":
        return f"{int(round(v)):,}".replace(",", "\u202f") + " salari\u00e9s"
    return f"{v:,.1f}".replace(",", "\u202f").replace(".", ",") + " " + unite


def phrase(short: str, hist: list[float], periodes: list[str], unite: str) -> str:
    """Une ligne de lecture, uniquement calculee a partir des chiffres publies :
    derniere valeur, variation sur un an, et rythme annuel moyen sur la periode
    quand il a un sens (valeurs positives aux deux bouts)."""
    dernier, annee = hist[-1], periodes[-1]
    bouts = []
    if len(hist) >= 2 and hist[-2]:
        if hist[-2] > 0 and hist[-1] >= 0:
            v = (hist[-1] - hist[-2]) / hist[-2] * 100
            bouts.append(f"{'+' if v >= 0 else '\u2212'}{abs(v):.1f} % sur un an".replace(".", ","))
        else:
            ecart = hist[-1] - hist[-2]
            sens = "en hausse de" if ecart >= 0 else "en baisse de"
            bouts.append(f"{sens} {nombre_fr(abs(ecart), unite)} sur un an")
    n = len(hist) - 1
    if n >= 3 and hist[0] > 0 and hist[-1] > 0:
        c = ((hist[-1] / hist[0]) ** (1 / n) - 1) * 100
        bouts.append(f"{'+' if c >= 0 else '\u2212'}{abs(c):.1f} % par an depuis {periodes[0]}".replace(".", ","))
    tete = {
        "revenue_annuel": "Ventes",
        "fcf_annuel": "Tr\u00e9sorerie libre",
        "dette_annuelle": "Dette",
        "effectifs_annuels": "Effectif",
    }[short]
    debut = f"{tete} de {nombre_fr(dernier, unite)} en {annee}"
    if short == "fcf_annuel" and dernier < 0:
        debut = f"{tete} n\u00e9gative de {nombre_fr(abs(dernier), unite)} en {annee}"
    return debut + (", " + ", ".join(bouts) if bouts else "") + "."


def kpi(short: str, hist: list[float], periodes: list[str], fin_date: str,
        diviseur: float, sources: list | None = None) -> dict:
    nom_fr, nom_en, unite, desc = LIBELLES[short]
    valeurs = [round(v / diviseur, 3 if diviseur > 1 else 0) for v in hist]
    return {
        "short": short,
        "name_fr": nom_fr,
        "name_en": nom_en,
        "value": valeurs[-1],
        "unit": unite,
        "yoy": yoy(valeurs),
        "period_type": "year",
        "frequency": "annual",
        "type": "Financials" if short != "effectifs_annuels" else "Human capital",
        "history": valeurs,
        "history_periods": periodes,
        "last_data_date": fin_date,
        "signal": phrase(short, valeurs, periodes, unite),
        "description_fr": desc,
        "description_en": desc,
        "is_generic": True,
        "method": "sec-10k",
        "sources": sources or [],
    }


def exercice_du_depot(depot: str, fins: list[str]) -> str | None:
    """Exercice decrit par un depot : la cloture qui le precede de plus pres.
    Un 10-K est depose 1 a 3 mois apres la cloture ; au-dela de 8 mois, le
    rattachement est douteux et on prefere ne rien afficher."""
    try:
        d = date.fromisoformat(depot)
    except ValueError:
        return None
    meilleur, ecart_min = None, None
    for f in fins:
        try:
            c = date.fromisoformat(f)
        except ValueError:
            continue
        ecart = (d - c).days
        if 0 < ecart <= 245 and (ecart_min is None or ecart < ecart_min):
            meilleur, ecart_min = c, ecart
    return str(meilleur.year) if meilleur else None


def revenue_douteux(ticker: str, periodes: list[str], valeurs: list[float]) -> bool:
    """Compare au chiffre d affaires annuel du data-lake (chaine independante).
    En cas de desaccord majoritaire, on prefere NE RIEN afficher plutot que
    publier un chiffre partiel : certains secteurs (banques, foncieres) portent
    leur total sur un concept comptable que nous ne captons pas encore."""
    f = ROOT / "data-lake" / ticker / "xbrl" / "facts.json"
    if not f.exists():
        return False
    try:
        d = json.loads(f.read_text())
    except Exception:
        return False
    ref = {}
    for e in d:
        if isinstance(e, dict) and e.get("period_type") == "year" and e.get("metric") == "revenue":
            v, fin = e.get("value"), e.get("period_end")
            if isinstance(v, (int, float)) and fin:
                ref[str(fin)[:4]] = float(v)
    compares = ecarts = 0
    for an, val in zip(periodes, valeurs):
        r = ref.get(an)
        if r is None or r == 0:
            continue
        compares += 1
        if abs(val * 1e9 - r) / abs(r) > 0.10:
            ecarts += 1
    return compares >= 3 and ecarts > compares / 2


def traite(ticker: str) -> dict | None:
    ffin = FIN / f"{ticker}.json"
    if not ffin.exists():
        return None
    fin = json.loads(ffin.read_text())
    kpis = []
    reference_fins: list[str] = []
    for short in ("revenue_annuel", "fcf_annuel", "dette_annuelle"):
        s = fin["series"].get(short)
        if not s:
            continue
        reference_fins = reference_fins or s.get("fins") or []
        valeurs = [v / 1e9 for v in s["history"]]
        if short == "revenue_annuel":
            if revenue_douteux(ticker, s["history_periods"], valeurs):
                continue
            # Filet supplementaire quand aucune source independante n existe :
            # un chiffre d affaires minuscule face a la dette signale un poste
            # partiel, pas une activite reelle (cas Regions Financial, banque
            # dont le produit net n est porte par aucun concept que nous lisons).
            dette = fin["series"].get("dette_annuelle")
            if dette and max(valeurs) < 0.05 * (max(dette["history"]) / 1e9):
                continue
        kpis.append(kpi(short, s["history"], s["history_periods"],
                        s["last_data_date"], 1e9, s.get("sources")))
    feff = EFF / f"{ticker}.json"
    if feff.exists() and reference_fins:
        eff = json.loads(feff.read_text())
        par_annee: dict[str, tuple[int, str]] = {}
        for p in eff.get("points", []):
            an = exercice_du_depot(p["depot"], reference_fins)
            if an and an not in par_annee:
                par_annee[an] = (p["valeur"], p["depot"])
        annees = sorted(par_annee)
        if len(annees) >= 3:
            kpis.append(kpi("effectifs_annuels",
                            [par_annee[a][0] for a in annees], annees,
                            par_annee[annees[-1]][1], 1.0,
                            [par_annee[a][1] for a in annees]))
    if not kpis:
        return None
    return {"ticker": ticker, "genere_le": "2026-09-03", "kpis": kpis}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    a = ap.parse_args()
    SORTIE.mkdir(parents=True, exist_ok=True)
    liste = ([t.strip().upper() for t in a.tickers.split(",")] if a.tickers
             else sorted(p.stem for p in FIN.glob("*.json")))
    faits = avec_eff = 0
    for t in liste:
        r = traite(t)
        if not r:
            continue
        (SORTIE / f"{t}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
        faits += 1
        if any(k["short"] == "effectifs_annuels" for k in r["kpis"]):
            avec_eff += 1
    print(f"FINI {faits} societes, dont {avec_eff} avec les effectifs", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
