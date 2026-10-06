#!/usr/bin/env python3
"""
Series trimestrielles de FedEx Freight (FDXF) lues dans le communique retraite
en annee civile du 6 aout 2026 (dossier data-lake/FDXF/ER/FDXF_2026-08-06_ER).

Huit trimestres civils, du T1 2024 au T4 2025. Chaque valeur est lue telle
quelle dans le tableau du communique ; les ratios sont calcules a partir de deux
lignes du meme tableau. Aucune valeur estimee.

Sortie : <sortie>/FDXF.recast.json (meme format que kpi-comptables-xbrl.py).
"""
from __future__ import annotations
import gzip, html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data-lake/FDXF/ER/FDXF_2026-08-06_ER.htm.gz"
FICHIER = "FDXF_ER_FDXF_2026-08-06_ER.txt"
CALENDRIER = {"March": 1, "June": 2, "September": 3, "December": 4}


def texte() -> str:
    raw = gzip.open(SRC, "rt", errors="ignore").read()
    raw = re.sub(r"(?is)<(script|style|ix:header).*?</\1>", " ", raw)
    raw = re.sub(r"(?i)</(tr|p|div|br|h\d|li)>", "\n", raw)
    raw = re.sub(r"(?i)</t[dh]>", " | ", raw)
    s = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    s = re.sub(r"[ \t\xa0​]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n", s)


NUM = re.compile(r"^\(?\$?\s?(\d[\d,]*\.?\d*)\)?$")


def lignes(s: str):
    """Chaque ligne logique : libelle puis valeurs (les cellules suivent le libelle sur des lignes a part)."""
    out, cur = [], None
    for ln in s.split("\n"):
        t = ln.strip()
        if not t:
            continue
        cells = [c.strip() for c in t.split("|") if c.strip()]
        for c in cells:
            c2 = c.replace("$", "").replace(" ", "").replace(",", "")
            neg = c2.startswith("(") and c2.endswith(")")
            c3 = c2.strip("()")
            if c in ("—", "-"):
                v = 0.0
            elif re.fullmatch(r"\d+(\.\d+)?", c3):
                v = float(c3) * (-1 if neg else 1)
            else:
                v = None
            if v is None:
                cur = [c, []]
                out.append(cur)
            elif cur is not None:
                cur[1].append(v)
    return out


def sections(s: str):
    """-> liste de (titre, annee, [labels trimestre], lignes)"""
    res = []
    reperes = [(m.start(), m.group(1)) for m in re.finditer(r"(Q\s?U\s?ARTERLY CONSOLIDATED STATEMENTS OF INCOME|QUARTERLY OPERATING STATISTICS)", s)]
    for i, (pos, titre) in enumerate(reperes):
        fin = reperes[i + 1][0] if i + 1 < len(reperes) else len(s)
        bloc = s[pos:fin]
        m = re.findall(r"(March|June|September|December) 31, ?\s*(\d{4})|(March|June|September|December) 30, ?\s*(\d{4})", bloc)
        cols = []
        for a in re.finditer(r"(March 31|June 30|September 30|December 31),\s*\n?\s*(\d{4})", bloc[:1500]):
            cols.append((a.group(1).split()[0], int(a.group(2))))
        if len(cols) < 4:
            continue
        cols = cols[:4]
        res.append(("revenu" if "INCOME" in titre else "stats", [f"Q{CALENDRIER[m]}-{y}" for m, y in cols], lignes(bloc)))
    return res


def nf(v, dec=1):
    t = f"{abs(v):,.{dec}f}".replace(",", "\u202f").replace(".", ",")
    return ("\u2212" if v < 0 else "") + t


ORDRE = ["Q1-2024", "Q2-2024", "Q3-2024", "Q4-2024", "Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"]
FIN = {"Q1-2024": "2024-03-31", "Q2-2024": "2024-06-30", "Q3-2024": "2024-09-30", "Q4-2024": "2024-12-31",
       "Q1-2025": "2025-03-31", "Q2-2025": "2025-06-30", "Q3-2025": "2025-09-30", "Q4-2025": "2025-12-31"}


def kpi(short, nom_fr, nom_en, unit, vals, dec, type_en, type_fr, formule="", pct=False, origine="nouveau"):
    hist = [{"q": q, "v": round(vals[q], dec)} for q in ORDRE]
    v = hist[-1]["v"]
    pv = hist[-5]["v"]
    if pct or unit in ("jours",):
        diff = v - pv
        yoy = f"{'+' if diff >= 0 else '-'}{abs(diff):.1f}".replace(".", ",") + (" pt" if pct else " j")
    elif pv > 0 and v >= 0:
        yoy = f"{'+' if v >= pv else ''}{(v - pv) / pv * 100:.1f} %".replace(".", ",")
    else:
        yoy = None
    u = nf(v, dec) + (" %" if pct else " " + unit)
    up = nf(pv, dec) + (" %" if pct else " " + unit)
    sig = f"{u} au quatrième trimestre 2025, contre {up} un an plus tôt" + (f" ({yoy})" if yoy else "") + "."
    return {"short": short, "name_fr": nom_fr, "name_en": nom_en, "value": v, "unit": "%" if pct else unit, "yoy": yoy,
            "history": hist, "pv_score": 6, "signal": sig, "frequency": "quarterly", "last_data_date": FIN["Q4-2025"],
            "_source": ("Communiqué de FedEx Freight du 6 août 2026 (comptes trimestriels retraités en année civile, 2024 et 2025), "
                        "tableaux du compte de résultat et des statistiques d'exploitation. " + formule).strip(),
            "type_comparable": {"fr": type_fr, "en": type_en, "origine": origine},
            "_type_pose_le": "2026-10-06", "_maj_le": "2026-10-06"}


def construit(recu):
    R, S = recu["revenu"], recu["stats"]
    rev = {q: v for q, v in R["Revenue"].items()}
    out, comps = [], {}

    def mds(cle):
        return {q: R[cle][q] / 1000.0 for q in ORDRE}

    def add(k, cps):
        out.append(k)
        comps[k["short"]] = cps

    # charges (Mds $)
    for short, cle, nfr, nen, tfr, ten in [
        ("salaries_q", "Salaries, wages, and benefits", "Salaires et charges sociales", "Salaries, wages and benefits", "Salaires et charges sociales", "Salaries, Wages and Benefits"),
        ("operating_supplies_q", "Operating supplies and expenses", "Fournitures et frais d'exploitation", "Operating supplies and expenses", "Fournitures et frais d'exploitation", "Operating Supplies and Expenses"),
        ("purchased_transport_q", "Purchased transportation", "Transport sous-traité", "Purchased transportation", "Transport sous-traité", "Purchased Transportation"),
        ("da_q", "Depreciation and amortization", "Dotations aux amortissements", "Depreciation and amortization", "Dotations aux amortissements", "Depreciation and Amortization"),
        ("insurance_claims_q", "Insurance and claims", "Assurance et sinistres", "Insurance and claims", "Assurance et sinistres", "Insurance and Claims"),
        ("operating_taxes_q", "Operating taxes and licenses", "Taxes et licences d'exploitation", "Operating taxes and licenses", "Taxes et licences d'exploitation", "Operating Taxes and Licenses"),
        ("separation_costs_q", "Separation and other", "Coûts de séparation et autres", "Separation and other costs", "Coûts de séparation", "Separation Costs"),
        ("total_opex_q", "Total operating expenses", "Charges d'exploitation totales", "Total operating expenses", "Charges d'exploitation", "Operating Expenses"),
    ]:
        add(kpi(short, nfr, nen, "Mds $", mds(cle), 3, ten, tfr, "Valeur lue telle quelle, en millions de dollars divisés par 1 000."),
            [(cle, R[cle][q], q) for q in ORDRE])
    # ratios de charges
    ratios = [
        ("operating_ratio_q", "Ratio d'exploitation trimestriel", "Quarterly operating ratio", "Total operating expenses", "Revenue", "Operating Ratio", "Ratio d'exploitation", "Charges d'exploitation totales divisées par le chiffre d'affaires du trimestre."),
        ("salaries_ratio_q", "Salaires rapportés au chiffre d'affaires", "Salaries as a share of revenue", "Salaries, wages, and benefits", "Revenue", "Labor Cost as % of Revenue", "Salaires rapportés au chiffre d'affaires", "Salaires et charges sociales divisés par le chiffre d'affaires."),
        ("purchased_transport_ratio_q", "Transport sous-traité rapporté au chiffre d'affaires", "Purchased transportation as a share of revenue", "Purchased transportation", "Revenue", "Purchased Transportation as % of Revenue", "Transport sous-traité rapporté au chiffre d'affaires", "Transport sous-traité divisé par le chiffre d'affaires."),
        ("insurance_ratio_q", "Assurance et sinistres rapportés au chiffre d'affaires", "Insurance and claims as a share of revenue", "Insurance and claims", "Revenue", "Insurance and Claims as % of Revenue", "Assurance et sinistres rapportés au chiffre d'affaires", "Assurance et sinistres divisés par le chiffre d'affaires."),
        ("op_margin_q", "Taux de marge opérationnelle", "Operating margin", "Operating income", "Revenue", "Operating Margin", "Taux de marge opérationnelle", "Résultat opérationnel divisé par le chiffre d'affaires."),
        ("net_margin_q", "Taux de marge nette", "Net margin", "Net income", "Revenue", "Net Margin", "Taux de marge nette", "Résultat net divisé par le chiffre d'affaires."),
        ("tax_rate_q", "Taux d'impôt effectif", "Effective tax rate", "Provision for income taxes", "Income before income taxes", "Effective Tax Rate", "Taux d'impôt effectif", "Impôt sur les résultats divisé par le résultat avant impôt."),
    ]
    for short, nfr, nen, num, den, ten, tfr, form in ratios:
        vals = {q: R[num][q] / R[den][q] * 100 for q in ORDRE}
        origine = "referentiel" if short == "operating_ratio_q" else "nouveau"
        add(kpi(short, nfr, nen, "%", vals, 1, ten, tfr, form, pct=True, origine=origine),
            [(num, R[num][q], q) for q in ORDRE] + [(den, R[den][q], q) for q in ORDRE])
    # statistiques d exploitation
    def st(cle):
        return {q: S[cle][q] for q in ORDRE}

    spec = [
        ("operating_days_q", "Jours d'exploitation du trimestre", "Operating days in the quarter", "jours", "Operating days", 1, 0, "Selling Days in Quarter", "Jours ouvrés du trimestre", "nouveau", "Valeur lue telle quelle."),
        ("total_shipments_q", "Envois totaux du trimestre", "Total shipments in the quarter", "millions", "Total shipments", 1e-6, 3, "Total Shipments", "Nombre total d'envois", "nouveau", "Valeur lue telle quelle, divisée par un million."),
        ("total_tonnage_q", "Tonnage total du trimestre", "Total tonnage in the quarter", "milliers de tonnes", "Total tonnage", 1e-3, 1, "Total Tonnage", "Tonnage total transporté", "nouveau", "Valeur lue telle quelle, divisée par 1 000."),
        ("priority_adv_q", "Envois par jour, offre Priority", "Average daily shipments, Priority", "milliers", "Average daily shipments | Priority", 1e-3, 1, "Shipments per Day by Service Level", "Envois par jour selon l'offre de service", "nouveau", "Valeur lue telle quelle, divisée par 1 000."),
        ("economy_adv_q", "Envois par jour, offre Economy", "Average daily shipments, Economy", "milliers", "Average daily shipments | Economy", 1e-3, 1, "Shipments per Day by Service Level", "Envois par jour selon l'offre de service", "nouveau", "Valeur lue telle quelle, divisée par 1 000."),
        ("priority_weight_q", "Poids moyen par envoi, offre Priority", "Weight per shipment, Priority", "livres", "Weight per shipment (pounds) | Priority", 1, 0, "Average Weight per Shipment", "Poids moyen par expédition", "nouveau", "Valeur lue telle quelle."),
        ("economy_weight_q", "Poids moyen par envoi, offre Economy", "Weight per shipment, Economy", "livres", "Weight per shipment (pounds) | Economy", 1, 0, "Average Weight per Shipment", "Poids moyen par expédition", "nouveau", "Valeur lue telle quelle."),
        ("haul_q", "Distance moyenne de transport", "Average length of haul", "milles", "Composite average length of haul", 1, 0, "Average Length of Haul", "Distance moyenne de transport", "nouveau", "Valeur composite lue telle quelle."),
        ("haul_priority_q", "Distance moyenne de transport, offre Priority", "Average length of haul, Priority", "milles", "Average length of haul (miles) | Priority", 1, 0, "Average Length of Haul by Service Level", "Distance moyenne de transport selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("haul_economy_q", "Distance moyenne de transport, offre Economy", "Average length of haul, Economy", "milles", "Average length of haul (miles) | Economy", 1, 0, "Average Length of Haul by Service Level", "Distance moyenne de transport selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_cwt_exfuel_q", "Revenu au quintal hors surcharge carburant", "Revenue per hundredweight excluding fuel surcharges", "$", "Composite revenue per hundredweight (excluding fuel surcharges)", 1, 2, "Revenue per Hundredweight ex-Fuel Surcharge", "Revenu par hundredweight hors surcharge carburant", "nouveau", "Valeur composite lue telle quelle (mesure hors surcharge carburant publiée par la société)."),
        ("rev_cwt_priority_q", "Revenu au quintal, offre Priority", "Revenue per hundredweight, Priority", "$", "Revenue per hundredweight | Priority", 1, 2, "Revenue per Hundredweight by Service Level", "Revenu par hundredweight selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_cwt_economy_q", "Revenu au quintal, offre Economy", "Revenue per hundredweight, Economy", "$", "Revenue per hundredweight | Economy", 1, 2, "Revenue per Hundredweight by Service Level", "Revenu par hundredweight selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_cwt_priority_exfuel_q", "Revenu au quintal hors carburant, offre Priority", "Revenue per hundredweight ex-fuel, Priority", "$", "Revenue per hundredweight (excluding fuel surcharges) | Priority", 1, 2, "Revenue per Hundredweight ex-Fuel Surcharge by Service Level", "Revenu par hundredweight hors carburant selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_cwt_economy_exfuel_q", "Revenu au quintal hors carburant, offre Economy", "Revenue per hundredweight ex-fuel, Economy", "$", "Revenue per hundredweight (excluding fuel surcharges) | Economy", 1, 2, "Revenue per Hundredweight ex-Fuel Surcharge by Service Level", "Revenu par hundredweight hors carburant selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_shipment_exfuel_q", "Revenu par envoi hors surcharge carburant", "Revenue per shipment excluding fuel surcharges", "$", "Composite revenue per shipment (excluding fuel surcharges)", 1, 2, "Revenue per Shipment ex-Fuel Surcharge", "Revenu par expédition hors surcharge carburant", "nouveau", "Valeur composite lue telle quelle."),
        ("rev_shipment_priority_q", "Revenu par envoi, offre Priority", "Revenue per shipment, Priority", "$", "Revenue per shipment | Priority", 1, 2, "Revenue per Shipment by Service Level", "Revenu par expédition selon l'offre", "nouveau", "Valeur lue telle quelle."),
        ("rev_shipment_economy_q", "Revenu par envoi, offre Economy", "Revenue per shipment, Economy", "$", "Revenue per shipment | Economy", 1, 2, "Revenue per Shipment by Service Level", "Revenu par expédition selon l'offre", "nouveau", "Valeur lue telle quelle."),
    ]
    for short, nfr, nen, unit, cle, sc, dec, ten, tfr, orig, form in spec:
        vals = {q: S[cle][q] * sc for q in ORDRE}
        add(kpi(short, nfr, nen, unit, vals, dec, ten, tfr, form, origine=orig), [(cle, S[cle][q], q) for q in ORDRE])
    # surcharge carburant par envoi = revenu par envoi - revenu par envoi hors carburant (deux lignes du meme tableau)
    c1, c2 = "Composite revenue per shipment", "Composite revenue per shipment (excluding fuel surcharges)"
    vals = {q: S[c1][q] - S[c2][q] for q in ORDRE}
    add(kpi("fuel_surcharge_shipment_q", "Surcharge carburant par envoi", "Fuel surcharge per shipment", "$", vals, 2,
            "Fuel Surcharge Revenue per Shipment", "Surcharge carburant par expédition",
            "Revenu composite par envoi moins revenu composite par envoi hors surcharge carburant (deux lignes du même tableau)."),
        [(c1, S[c1][q], q) for q in ORDRE] + [(c2, S[c2][q], q) for q in ORDRE])
    return out, comps


def main():
    s = texte()
    secs = sections(s)
    recu = {"revenu": {}, "stats": {}}

    def prendre(kind, quarters, lg):
        groupe = ""
        for lab, vals in lg:
            if lab.endswith(":") and not vals:
                groupe = lab.rstrip(":")
                continue
            if len(vals) == 4:
                cle = (groupe + " | " if lab in ("Priority", "Economy") else "") + lab
                for q, v in zip(quarters, vals):
                    recu[kind].setdefault(cle, {})[q] = v

    for kind, quarters, lg in secs:
        prendre(kind, quarters, lg)
    out, comps = construit(recu)
    dest = sys.argv[1] if len(sys.argv) > 1 else "/dev/stdout"
    json.dump({"ticker": "FDXF", "kpis": out, "comps": comps, "rejets": []}, open(dest, "w"), ensure_ascii=False, indent=1)
    print("FDXF recast", len(out), "KPI")


if __name__ == "__main__":
    main()
