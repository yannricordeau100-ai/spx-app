#!/usr/bin/env python3
"""
Controle des quatre indicateurs annuels avant mise en ligne (Yann 3 sept 2026).

Regle permanente : on differe et on rejette AVANT de publier. Ce script ne
corrige rien, il signale. Quatre familles de controles :

  1. recoupement du chiffre d affaires avec le data-lake (source independante,
     alimentee par une autre chaine) ;
  2. recalcul du flux de tresorerie libre a partir du data-lake ;
  3. vraisemblance des effectifs (bornes, sauts d une annee sur l autre) ;
  4. coherence de la dette (positive, ordre de grandeur).

Sortie : liste des anomalies + bilan chiffre. Code de retour 1 si une anomalie
bloquante est trouvee.
"""
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FICHE = ROOT / "src/data/kpi-annuel-fiche"
TOLERANCE = 0.02      # 2 % d ecart admis avec le data-lake (arrondis, retraitements)
SAUT_MAX = 0.60       # variation d effectif d une annee sur l autre


def datalake_annuel(ticker: str) -> dict[str, dict[str, float]]:
    f = ROOT / "data-lake" / ticker / "xbrl" / "facts.json"
    if not f.exists():
        return {}
    try:
        d = json.loads(f.read_text())
    except Exception:
        return {}
    out: dict[str, dict[str, float]] = {}
    for e in d:
        if not isinstance(e, dict) or e.get("period_type") != "year":
            continue
        m, v, fin = e.get("metric"), e.get("value"), e.get("period_end")
        if not m or not isinstance(v, (int, float)) or not fin:
            continue
        out.setdefault(m, {})[str(fin)[:4]] = float(v)
    return out


def controle(ticker: str) -> list[str]:
    d = json.loads((FICHE / f"{ticker}.json").read_text())
    series = {k["short"]: k for k in d["kpis"]}
    dl = datalake_annuel(ticker)
    pbs: list[str] = []

    rev = series.get("revenue_annuel")
    if rev and dl.get("revenue"):
        compares = ecarts = 0
        for an, val in zip(rev["history_periods"], rev["history"]):
            ref = dl["revenue"].get(an)
            if ref is None:
                continue
            compares += 1
            if abs(val * 1e9 - ref) > TOLERANCE * max(abs(ref), 1):
                ecarts += 1
        if compares >= 3 and ecarts > compares / 2:
            pbs.append(f"{ticker} chiffre d affaires : {ecarts}/{compares} annees s ecartent du data-lake")

    fcf = series.get("fcf_annuel")
    if fcf and dl.get("operating_cash_flow"):
        compares = ecarts = 0
        for an, val in zip(fcf["history_periods"], fcf["history"]):
            ocf = dl["operating_cash_flow"].get(an)
            if ocf is None:
                continue
            cap = (dl.get("capex") or {}).get(an)
            if cap is None:
                # Sans les investissements de l autre source, la comparaison
                # opposerait un flux LIBRE a un flux d exploitation : elle
                # signalerait un ecart qui n existe pas.
                continue
            attendu = ocf - cap
            compares += 1
            if abs(val * 1e9 - attendu) > 0.05 * max(abs(attendu), 1e8):
                ecarts += 1
        if compares >= 3 and ecarts > compares / 2:
            pbs.append(f"{ticker} flux de tresorerie libre : {ecarts}/{compares} annees ne se recalculent pas")

    eff = series.get("effectifs_annuels")
    if eff:
        h = eff["history"]
        if any(v < 10 or v > 3_000_000 for v in h):
            pbs.append(f"{ticker} effectifs : valeur hors bornes {min(h):,.0f}..{max(h):,.0f}")
        for i in range(1, len(h)):
            if not h[i - 1] or abs(h[i] - h[i - 1]) / h[i - 1] <= SAUT_MAX:
                continue
            try:
                consecutives = int(eff["history_periods"][i]) - int(eff["history_periods"][i - 1]) == 1
            except ValueError:
                consecutives = True
            if not consecutives:
                continue   # annees non contigues : rien a conclure
            pbs.append(f"{ticker} effectifs : saut {eff['history_periods'][i-1]}->{eff['history_periods'][i]} "
                       f"{h[i-1]:,.0f} vers {h[i]:,.0f} (a verifier : fusion ou erreur de lecture)")

    det = series.get("dette_annuelle")
    if det:
        if any(v < 0 for v in det["history"]):
            pbs.append(f"{ticker} dette : valeur negative")
        # Les banques et assureurs portent structurellement beaucoup de dette
        # face a un produit net faible : le rapport n a de sens qu au-dela d un
        # facteur tres eleve.
        if rev and det["history"] and rev["history"]:
            r = max(rev["history"])
            if r > 0 and max(det["history"]) > 60 * r:
                pbs.append(f"{ticker} dette : {max(det['history']):.0f} Mds pour {r:.0f} Mds de ventes")

    for nom, k in series.items():
        if len(k["history"]) != len(k["history_periods"]):
            pbs.append(f"{ticker} {nom} : {len(k['history'])} valeurs pour {len(k['history_periods'])} periodes")
        if sorted(k["history_periods"]) != list(k["history_periods"]):
            pbs.append(f"{ticker} {nom} : annees non ordonnees")
    return pbs


def main() -> int:
    fichiers = sorted(FICHE.glob("*.json"))
    if not fichiers:
        print("aucun fichier a controler")
        return 1
    anomalies, avec_eff = [], 0
    for f in fichiers:
        try:
            anomalies += controle(f.stem)
        except Exception as e:  # noqa: BLE001
            anomalies.append(f"{f.stem} : lecture impossible ({e})")
        try:
            if any(k["short"] == "effectifs_annuels" for k in json.loads(f.read_text())["kpis"]):
                avec_eff += 1
        except Exception:
            pass
    for a in anomalies[:60]:
        print("  ", a)
    if len(anomalies) > 60:
        print(f"   ... et {len(anomalies) - 60} autres")
    print(f"\nBILAN : {len(fichiers)} societes controlees, {avec_eff} avec effectifs, "
          f"{len(anomalies)} anomalie(s)")
    return 1 if anomalies else 0


if __name__ == "__main__":
    sys.exit(main())
