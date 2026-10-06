#!/usr/bin/env python3
"""
KPI comptables trimestriels et annuels depuis le XBRL deposé à la SEC (6 oct 2026).

Mise à niveau des fiches américaines au niveau des comparables (RDDT, FERG,
FLEX, FDXF, BE). Tout vient de l API companyfacts (data.sec.gov), valeurs
portees par des 10-Q et 10-K, avec le numero de depot (accn) de chaque point.

Regles :
  - trimestre = valeur publiee sur 3 mois quand elle existe ; sinon difference
    entre deux cumuls successifs du MEME exercice (flux de tresorerie, T4) ;
  - rien n est estime : un point est ecrit seulement si toutes ses composantes
    existent ; les ratios sont calcules a partir de composantes de la meme date ;
  - un KPI n est retenu qu a partir de MIN_Q trimestres (ou MIN_A exercices).

Usage :
  python3 scripts/kpi-comptables-xbrl.py FERG [--sortie fichier.json]
"""
from __future__ import annotations
import json, sys
from datetime import date, timedelta
from pathlib import Path

W = Path("/private/tmp/claude-501/-Users-yann/f6e0203b-2aed-4432-a0b3-a87ba8db1323/scratchpad/w/cf")
MIN_Q, MIN_A = 8, 5

CF_FILES = {"FERG": ["FERG", "FERGOLD"], "RDDT": ["RDDT"], "FLEX": ["FLEX"], "FDXF": ["FDXF"], "BE": ["BE"]}


def charge(t):
    out = {}
    for f in CF_FILES[t]:
        d = json.load(open(W / f"{f}.json"))["facts"]["us-gaap"]
        for c, bloc in d.items():
            for u, ents in (bloc.get("units") or {}).items():
                out.setdefault(c, {}).setdefault(u, []).extend(ents)
    return out


def d(s):
    return date.fromisoformat(s)


def libelle_q(fin: str) -> str:
    x = d(fin) - timedelta(days=10)
    return f"Q{(x.month - 1) // 3 + 1}-{x.year}"


def flux(facts, concepts, unite="USD"):
    """-> (trimestres {fin: (val, mode, accn)}, annuels {fin: (val, accn)})

    Les concepts sont parcourus par ordre de preference ; un concept moins bien
    place ne sert qu a combler les periodes que les precedents ne couvrent pas
    (une societe change d etiquette XBRL au fil des annees). Les differences
    entre cumuls se font APRES cette fusion."""
    uniq = {}
    for rang, c in enumerate(concepts):
        for e in (facts.get(c) or {}).get(unite) or []:
            if not str(e.get("form", "")).startswith(("10-Q", "10-K")) or not e.get("start"):
                continue
            k = (e["start"], e["end"])
            g = uniq.get(k)
            if g is None or rang < g[0] or (rang == g[0] and e["filed"] > g[1]["filed"]):
                uniq[k] = (rang, e)
    q, a, cum = {}, {}, {}
    for (s_, f), (_, e) in uniq.items():
        jours = (d(f) - d(s_)).days
        if 80 <= jours <= 100:
            q[f] = (e["val"], "direct", e["accn"])
        if jours >= 80:
            cum.setdefault(s_, {})[f] = (e["val"], e["accn"])
        if 340 <= jours <= 380:
            a[f] = (e["val"], e["accn"])
    for s_, m in cum.items():
        prev = None
        for f in sorted(m):
            if prev is not None and 80 <= (d(f) - d(prev)).days <= 100 and f not in q:
                q[f] = (m[f][0] - m[prev][0], "diff", m[f][1] + "|" + m[prev][1])
            prev = f
    return q, a


def instants(facts, concepts, unite="USD"):
    o = {}
    for c in concepts:
        ents = (facts.get(c) or {}).get(unite)
        if not ents:
            continue
        loc = {}
        for e in ents:
            if not str(e.get("form", "")).startswith(("10-Q", "10-K")) or e.get("start"):
                continue
            f = e["end"]
            if f not in loc or e["filed"] > loc[f][2]:
                loc[f] = (e["val"], e["accn"], e["filed"])
        for f, v in loc.items():
            o.setdefault(f, v)
    return {k: (v[0], v[1]) for k, v in o.items()}


def somme_instants(facts, groupes):
    """Somme de postes (chaque poste = liste d alternatives) a la meme date."""
    series = [instants(facts, g) for g in groupes]
    communs = None
    for s in series:
        if not s:
            continue
    out = {}
    dates = set().union(*[set(s) for s in series if s])
    for f in dates:
        tot, accn, ok = 0.0, [], False
        for s in series:
            if f in s:
                tot += s[f][0]; accn.append(s[f][1]); ok = True
        if ok:
            out[f] = (tot, "|".join(accn))
    return out


# ---------------------------------------------------------------------------
# Catalogue des indicateurs
# ---------------------------------------------------------------------------
CONC = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
    "cogs": ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
    "gross": ["GrossProfit"],
    "opinc": ["OperatingIncomeLoss"],
    "netinc": ["NetIncomeLoss", "ProfitLoss"],
    "sga": ["SellingGeneralAndAdministrativeExpense"],
    "rd": ["ResearchAndDevelopmentExpense"],
    "da": ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
           "DepreciationAmortizationAndAccretionNet", "DepreciationAmortizationAndOther"],
    "sbc": ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
    "interest": ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt", "InterestExpenseNet"],
    "tax": ["IncomeTaxExpenseBenefit"],
    "pretax": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
              "PaymentsForCapitalImprovements"],
    "buyback": ["PaymentsForRepurchaseOfCommonStock"],
    "divpaid": ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"],
}
INST = {
    "cash": [["CashAndCashEquivalentsAtCarryingValue"]],
    "inv": [["InventoryNet"]],
    "ar": [["AccountsReceivableNetCurrent"]],
    "ap": [["AccountsPayableCurrent"]],
    "assets": [["Assets"]],
    "equity": [["StockholdersEquity"]],
    # dette financiere : long terme (hors part courante) + part courante + court terme.
    "debt": [["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations", "ConvertibleNotesPayableNoncurrent",
              "SeniorNotesNoncurrent", "LongTermNotesPayable"],
             ["LongTermDebtCurrent", "DebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
             ["ShortTermBorrowings", "CommercialPaper", "LineOfCredit"]],
}
EPS_C = ["EarningsPerShareDiluted"]
DPS_C = ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"]
SHS_C = ["WeightedAverageNumberOfDilutedSharesOutstanding"]

# (id, nom_fr, nom_en, type_en, type_fr, type_origine)
T = {
    "gross_profit": ("Profit brut", "Gross profit", "Gross Profit", "Profit brut"),
    "sga": ("Frais commerciaux et administratifs", "Selling, general and administrative expenses", "SG&A Expense", "Frais commerciaux et administratifs"),
    "rd": ("Dépenses de recherche et développement", "Research and development expense", "Research & Development Expense", "Dépenses de recherche et développement"),
    "da": ("Dotations aux amortissements", "Depreciation and amortization", "Depreciation and Amortization", "Dotations aux amortissements"),
    "sbc": ("Rémunération en actions", "Share-based compensation", "Stock-Based Compensation", "Rémunération en actions"),
    "interest": ("Charges d'intérêts", "Interest expense", "Interest Expense", "Charges d'intérêts"),
    "tax": ("Impôt sur les résultats", "Income tax expense", "Income Tax Expense", "Impôt sur les résultats"),
    "ocf": ("Flux de trésorerie d'exploitation", "Operating cash flow", "Operating Cash Flow", "Flux de trésorerie d'exploitation"),
    "capex": ("Investissements (capex)", "Capital expenditures", "Capital Expenditures", "Investissements (capex)"),
    "fcf": ("Flux de trésorerie disponible", "Free cash flow", "Free Cash Flow", "Flux de trésorerie disponible"),
    "buyback": ("Rachats d'actions", "Share repurchases", "Share Repurchases", "Rachats d'actions"),
    "divpaid": ("Dividendes versés", "Dividends paid", "Dividends Paid", "Dividendes versés"),
    "cash": ("Trésorerie et équivalents", "Cash and cash equivalents", "Cash and Equivalents", "Trésorerie et équivalents"),
    "inv": ("Stocks", "Inventories", "Inventories", "Stocks"),
    "ar": ("Créances clients", "Accounts receivable", "Accounts Receivable", "Créances clients"),
    "ap": ("Dettes fournisseurs", "Accounts payable", "Accounts Payable", "Dettes fournisseurs"),
    "assets": ("Total du bilan", "Total assets", "Total Assets", "Total du bilan"),
    "equity": ("Capitaux propres", "Shareholders' equity", "Stockholders' Equity", "Capitaux propres"),
    "debt": ("Dette financière totale", "Total financial debt", "Total Debt", "Dette financière totale"),
    "netdebt": ("Dette financière nette de la trésorerie", "Financial debt net of cash", "Net Debt", "Dette nette"),
    "gm": ("Taux de marge brute", "Gross margin", "Gross Margin", "Taux de marge brute"),
    "om": ("Taux de marge opérationnelle", "Operating margin", "Operating Margin", "Taux de marge opérationnelle"),
    "nm": ("Taux de marge nette", "Net margin", "Net Margin", "Taux de marge nette"),
    "sga_r": ("Frais commerciaux et administratifs rapportés aux ventes", "SG&A as a share of revenue", "SG&A as % of Revenue", "Ratio frais généraux sur ventes"),
    "rd_r": ("Recherche et développement rapportée aux ventes", "R&D as a share of revenue", "R&D as % of Revenue", "Part de la R&D dans le chiffre d'affaires"),
    "fcf_m": ("Marge de flux de trésorerie disponible", "Free cash flow margin", "Free Cash Flow Margin", "Marge de flux de trésorerie disponible"),
    "capex_r": ("Investissements rapportés au chiffre d'affaires", "Capex to sales", "Capex to Sales", "Investissements industriels rapportés au chiffre d'affaires"),
    "taxr": ("Taux d'impôt effectif", "Effective tax rate", "Effective Tax Rate", "Taux d'impôt effectif"),
    "dio": ("Jours de stocks", "Days inventory outstanding", "Days Inventory Outstanding", "Jours de rotation des stocks"),
    "dso": ("Délai de paiement clients (jours)", "Days sales outstanding", "Days Sales Outstanding", "Jours de crédit clients"),
    "dpo": ("Délai de paiement fournisseurs (jours)", "Days payables outstanding", "Days Payables Outstanding", "Jours de crédit fournisseurs"),
    "ccc": ("Cycle de conversion de trésorerie (jours)", "Cash conversion cycle", "Cash Conversion Cycle", "Cycle de conversion de trésorerie"),
    "turns": ("Rotation des stocks", "Inventory turns", "Inventory Turns", "Rotation des stocks"),
    "eps": ("BPA dilué", "Diluted EPS", "Diluted EPS", "BPA dilué"),
    "dps": ("Dividende par action", "Dividend per share", "Dividend per Share", "Dividende par action"),
    "shares": ("Nombre moyen d'actions diluées", "Weighted average diluted shares", "Weighted Average Diluted Shares", "Nombre moyen d'actions diluées"),
    "debt_eq": ("Dette financière rapportée aux capitaux propres", "Debt to equity", "Debt to Equity", "Dette sur capitaux propres"),
}


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------
def cible_calendrier(fin: str) -> float:
    """Ecart (jours) entre une cloture et la fin de trimestre calendaire la plus proche."""
    x = d(fin)
    m = ((x.month - 1) // 3 + 1) * 3
    ref = date(x.year + (1 if m == 12 and x.month == 12 and False else 0), m, 1)
    ref = (date(x.year, m, 28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    return abs((x - ref).days)


# Ferguson a change d exercice (31 juillet -> 31 decembre) : les trimestres civils retraites du 31 mars
# et du 30 juin 2025 ne servent que de comparatifs aux trimestres de 2026 ; les series historiques
# restent sur les trimestres fiscaux (clotures fin janvier, avril, juillet, octobre) jusqu a octobre 2025.
EXCLURE_FISCAL = {"FERG": {"2025-03-31", "2025-06-30", "2025-12-31"}}


def dedupe_labels(par_fin: dict, exclure=frozenset()) -> dict:
    """{fin: v} -> {label: (fin, v)} ; en cas de collision, la cloture la plus proche du calendrier gagne."""
    out = {}
    for fin in sorted(par_fin):
        if fin in exclure:
            continue
        lab = libelle_q(fin)
        if lab not in out or cible_calendrier(fin) < cible_calendrier(out[lab][0]):
            out[lab] = (fin, par_fin[fin])
    return out


import gzip, re

# Depots presents dans le lac mais pas encore dans l API companyfacts : lecture du
# XBRL integre au document (balises ix:nonFraction, contextes sans dimension).
INLINE = {"BE": [("data-lake/BE/10Q/BE_2026-07-29_0001628280-26-050325.htm.gz", "0001628280-26-050325", "2026-07-29", "10-Q")]}


def injecte_inline(F: dict, chemin: str, accn: str, filed: str, form: str):
    racine = Path(__file__).resolve().parents[1]
    t = gzip.open(racine / chemin, "rt", errors="ignore").read()
    ctx = {}
    for m in re.finditer(r'<xbrli:context id="([^"]+)">(.*?)</xbrli:context>', t, re.S):
        corps = m.group(2)
        if "<xbrli:segment" in corps or "explicitMember" in corps or "typedMember" in corps:
            continue
        a = re.search(r"<xbrli:startDate>([^<]+)</xbrli:startDate>", corps)
        b = re.search(r"<xbrli:endDate>([^<]+)</xbrli:endDate>", corps)
        i = re.search(r"<xbrli:instant>([^<]+)</xbrli:instant>", corps)
        ctx[m.group(1)] = (a.group(1) if a else None, b.group(1) if b else (i.group(1) if i else None))
    n = 0
    for m in re.finditer(r"<ix:nonFraction([^>]*)>(.*?)</ix:nonFraction>", t, re.S):
        at, corps = m.group(1), m.group(2)
        nom = re.search(r'name="([^"]+)"', at)
        cr = re.search(r'contextRef="([^"]+)"', at)
        if not nom or not cr or cr.group(1) not in ctx or not nom.group(1).startswith("us-gaap:"):
            continue
        txt = re.sub(r"<[^>]+>", "", corps).replace(",", "").strip()
        if not re.fullmatch(r"\d+(\.\d+)?", txt):
            continue
        sc = re.search(r'scale="(-?\d+)"', at)
        val = float(txt) * (10 ** int(sc.group(1) if sc else 0))
        if 'sign="-"' in at:
            val = -val
        un = (re.search(r'unitRef="([^"]+)"', at) or [None, ""])[1].lower()
        unite = "USD/shares" if "share" in un and "usd" in un else ("shares" if "share" in un else "USD")
        deb, fin = ctx[cr.group(1)]
        if not fin:
            continue
        e = {"start": deb, "end": fin, "val": val, "form": form, "accn": accn, "filed": filed, "fp": "Q2"}
        if not deb:
            e.pop("start")
        F.setdefault(nom.group(1)[8:], {}).setdefault(unite, []).append(e)
        n += 1
    return n


def construit(t: str, unite_div: float):
    F = charge(t)
    for chemin, accn, filed, form in INLINE.get(t, []):
        injecte_inline(F, chemin, accn, filed, form)
    S = {}      # id -> {label: (fin, valeur, accn, mode)}
    A = {}      # id -> {fin: (valeur, accn)} annuel

    def flux_serie(nom):
        q, a = flux(F, CONC[nom])
        return q, a

    flows = {}
    for nom in CONC:
        flows[nom] = flux_serie(nom)
    # Chiffre d affaires : plusieurs concepts se recouvrent sans jamais depasser le total
    # (Bloom : produits des contrats clients 1 060,7 M$ contre total 1 065,4 M$) :
    # on retient, pour chaque periode, la valeur la plus haute.
    qs, as_ = {}, {}
    for c in CONC["revenue"]:
        q, a = flux(F, [c])
        for f, v in q.items():
            if f not in qs or v[0] > qs[f][0]:
                qs[f] = v
        for f, v in a.items():
            if f not in as_ or v[0] > as_[f][0]:
                as_[f] = v
    flows["revenue"] = (qs, as_)
    inst = {k: somme_instants(F, g) for k, g in INST.items()}
    eps_q, eps_a = flux(F, EPS_C, "USD/shares")
    dps_q, dps_a = flux(F, DPS_C, "USD/shares")
    shs_q, shs_a = flux(F, SHS_C, "shares")
    return F, flows, inst, (eps_q, eps_a), (dps_q, dps_a), (shs_q, shs_a)


def nf(v: float, dec: int = 0) -> str:
    s = f"{abs(v):,.{dec}f}".replace(",", " ").replace(".", ",")
    return ("−" if v < 0 else "") + s


def fr_date(fin: str) -> str:
    mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    x = d(fin)
    return f"{x.day if x.day > 1 else '1er'} {mois[x.month - 1]} {x.year}"


class Gen:
    def __init__(self, t, div, unit_m, nb_q=16, nb_a=10, fiscal=False):
        self.t, self.div, self.unit_m = t, div, unit_m
        self.exclure = EXCLURE_FISCAL.get(t, frozenset()) if fiscal else frozenset()
        self.alt = {}
        self.F, self.flows, self.inst, self.eps, self.dps, self.shs = construit(t, div)
        self.nb_q, self.nb_a = nb_q, nb_a
        self.out = []        # KPI
        self.comps = {}      # short -> {label: [(concept, valeur_brute, accn)]}

    # --- series de base : {label: (fin, val, accn, mode)} ---
    def sq(self, nom):
        q, _ = self.flows[nom]
        lab = dedupe_labels(q, self.exclure)
        return {l: (fin, v[0], v[2], v[1]) for l, (fin, v) in lab.items()}

    def sa(self, nom):
        _, a = self.flows[nom]
        return {("FY" + d(f).strftime("%Y")): (f, v[0], v[1], "annuel") for f, v in a.items()}

    def si(self, nom):
        lab = dedupe_labels(self.inst[nom], self.exclure)
        return {l: (fin, v[0], v[1], "instant") for l, (fin, v) in lab.items()}

    def sx(self, quad):
        q, a = quad
        lab = dedupe_labels(q, self.exclure)
        return ({l: (fin, v[0], v[2], v[1]) for l, (fin, v) in lab.items()},
                {("FY" + d(f).strftime("%Y")): (f, v[0], v[1], "annuel") for f, v in a.items()})

    @staticmethod
    def ordre(lab):   # "Q2-2026" -> (2026,2) ; "FY2025" -> (2025,0)
        if lab.startswith("FY"):
            return (int(lab[2:]), 0)
        q, y = lab[1:].split("-")
        return (int(y), int(q))

    def tronque(self, serie, nb):
        """Dernieres `nb` periodes, et seulement la suite SANS TROU qui se termine
        a la derniere : un trou dans une serie trimestrielle fausserait le graphique."""
        ks = sorted(serie, key=self.ordre)
        run = []
        for lab in reversed(ks):
            if run:
                a, b = self.ordre(lab), self.ordre(run[-1])
                if lab.startswith("FY"):
                    suivant = (b[0] - 1, 0)
                else:
                    suivant = (b[0], b[1] - 1) if b[1] > 1 else (b[0] - 1, 4)
                if a != suivant:
                    break
            run.append(lab)
            if len(run) >= nb:
                break
        run.reverse()
        return {k: serie[k] for k in run}

    def ajoute(self, short, tid, serie, unit, freq, facteur=1.0, dec=1, formule="", comps=None, kind="montant", source_extra=""):
        n_min = MIN_Q if freq == "quarterly" else MIN_A
        serie = self.tronque(serie, self.nb_q if freq == "quarterly" else self.nb_a)
        if len(serie) < n_min:
            return None
        ks = sorted(serie, key=self.ordre)
        # montants publies en millions entiers (Ferguson, Flex) : pas de decimale artificielle
        if unit == self.unit_m and all(abs(serie[k][1] * facteur - round(serie[k][1] * facteur)) < 1e-6 for k in ks):
            dec = 0
        hist = [{"q": k, "v": round(serie[k][1] * facteur, dec)} for k in ks]
        derniere = serie[ks[-1]]
        nom_fr, nom_en, type_en, type_fr = T[tid]
        v = hist[-1]["v"]
        # variation sur un an
        prev_lab = (f"Q{ks[-1][1]}-{int(ks[-1][3:]) - 1}" if freq == "quarterly" else f"FY{int(ks[-1][2:]) - 1}")
        pv = next((h["v"] for h in hist if h["q"] == prev_lab), None)
        alt = self.alt.get(short)
        if alt and ks[-1] in ("Q1-2026", "Q2-2026") and prev_lab in alt:
            pv = alt[prev_lab]      # comparatif civil retraite (meme periode un an plus tot)
        yoy = None
        if pv is not None:
            if kind == "pct" or unit in ("jours", "x"):
                diff = v - pv
                yoy = (f"{'+' if diff >= 0 else '-'}{abs(diff):.1f}".replace(".", ",") + (" pt" if kind == "pct" else (" j" if unit == "jours" else " x")))
            elif pv != 0 and pv > 0 and v >= 0:
                yoy = f"{'+' if v >= pv else ''}{(v - pv) / pv * 100:.1f} %".replace(".", ",")
        pér = ("au trimestre clos le " if freq == "quarterly" else "sur l'exercice clos le ") + fr_date(derniere[0])
        u = {"pct": "%"}.get(kind, unit)
        sep = "" if unit in ("%",) else " "
        txt_v = (nf(v, dec) + (" %" if kind == "pct" else (" " + unit if unit not in ("",) else "")))
        txt_p = None
        if pv is not None:
            txt_p = nf(pv, dec) + (" %" if kind == "pct" else (" " + unit if unit else ""))
        lib_prev = "un an plus tôt" if freq == "quarterly" else "l'exercice précédent"
        signal = f"{txt_v} {pér}" + (f", contre {txt_p} {lib_prev}" if txt_p else "") + (f" ({yoy})" if yoy else "") + "."
        accns = sorted({a for k in ks for a in str(serie[k][2]).split("|")})
        modes = {serie[k][3] for k in ks}
        note = formule
        if self.t == "FERG":
            note += (" Changement d'exercice : le trimestre clos le 31 octobre 2025 est suivi du trimestre clos le 31 mars 2026 ; "
                     "novembre et décembre 2025 figurent dans la période de transition de cinq mois. La variation sur un an des trimestres de 2026 "
                     "est calculée contre le trimestre civil retraité de 2025.")
        if "diff" in modes:
            note += " Les trimestres sans valeur publiée sur trois mois (flux de trésorerie, quatrième trimestre) sont obtenus par différence entre deux cumuls successifs du même exercice."
        kp = {
            "short": short, "name_fr": nom_fr, "name_en": nom_en, "value": v, "unit": u if kind != "pct" else "%",
            "yoy": yoy, "history": hist, "pv_score": 6, "signal": signal, "frequency": freq,
            "last_data_date": derniere[0],
            "_source": ("Données XBRL déposées par la société auprès de la SEC (rapports 10-Q et 10-K), "
                        f"concepts comptables standard ; dépôts {accns[0]} à {accns[-1]} ({len(accns)} dépôts). " + note + source_extra).strip(),
            "type_comparable": {"fr": type_fr, "en": type_en, "origine": "nouveau"},
            "_type_pose_le": "2026-10-06",
            "_maj_le": "2026-10-06",
        }
        self.out.append(kp)
        self.comps[short] = {k: (comps(k) if comps else [(tid, serie[k][1], serie[k][2])]) for k in ks}
        return kp


def batterie(g: Gen, suffixe="_q", freq="quarterly"):
    """Construit tous les indicateurs standards disponibles pour une societe."""
    unit_m = g.unit_m
    k = 1.0 / g.div
    get = (g.sq if freq == "quarterly" else g.sa)
    geti = g.si
    S = {n: get(n) for n in CONC}
    I = {n: geti(n) for n in INST}
    eps = g.sx(g.eps)[0 if freq == "quarterly" else 1]
    dps = g.sx(g.dps)[0 if freq == "quarterly" else 1]
    shs = g.sx(g.shs)[0 if freq == "quarterly" else 1]
    if freq != "quarterly":
        # instants annuels : seulement les clotures qui sont aussi une cloture d exercice
        fins = {v[0] for v in (g.sa("revenue") or g.sa("opinc")).values()}
        I = {}
        for n in INST:
            bru = {}
            for fin, v in g.inst[n].items():
                if fin in fins:
                    bru["FY" + d(fin).strftime("%Y")] = (fin, v[0], v[1], "instant")
            I[n] = bru
    sfx = suffixe

    def montant(short, tid, serie, dec=1):
        return g.ajoute(short + sfx, tid, serie, unit_m, freq, k, dec)

    def commun(*series):
        c = set(series[0])
        for s in series[1:]:
            c &= set(s)
        return c

    def ratio(short, tid, num, den, mult=100.0, kind="pct", unit="%", dec=1, formule="", nom=None, signe=1):
        cs = commun(num, den)
        cs = {l for l in cs if den[l][1] not in (0, None)}
        ser = {}
        for l in cs:
            ser[l] = (num[l][0], signe * num[l][1] / den[l][1] * mult, f"{num[l][2]}|{den[l][2]}", "calcul")
        return g.ajoute(short + sfx, tid, ser, unit, freq, 1.0, dec, formule=formule, kind=kind,
                        comps=lambda l: [(nom or "num", num[l][1], num[l][2]), ("den", den[l][1], den[l][2])])

    rev, cogs, gross, opi, net = S["revenue"], S["cogs"], S["gross"], S["opinc"], S["netinc"]
    # profit brut : publie, sinon ventes moins cout des ventes (meme date)
    if not gross and rev and cogs:
        gross = {l: (rev[l][0], rev[l][1] - cogs[l][1], rev[l][2] + "|" + cogs[l][2], "calcul") for l in commun(rev, cogs)}
    montant("gross_profit", "gross_profit", gross)
    if gross: ratio("gross_margin", "gm", gross, rev, formule="Profit brut divisé par le chiffre d'affaires de la même période.")
    if opi: ratio("op_margin", "om", opi, rev, formule="Résultat opérationnel divisé par le chiffre d'affaires de la même période.")
    if net: ratio("net_margin", "nm", net, rev, formule="Résultat net divisé par le chiffre d'affaires de la même période.")
    montant("sga", "sga", S["sga"])
    if S["sga"]: ratio("sga_ratio", "sga_r", S["sga"], rev, formule="Frais commerciaux et administratifs divisés par le chiffre d'affaires.")
    montant("rd", "rd", S["rd"])
    if S["rd"]: ratio("rd_ratio", "rd_r", S["rd"], rev, formule="Dépenses de recherche et développement divisées par le chiffre d'affaires.")
    montant("da", "da", S["da"])
    montant("sbc", "sbc", S["sbc"])
    montant("interest", "interest", S["interest"])
    montant("tax", "tax", S["tax"])
    if S["tax"] and S["pretax"]:
        ratio("tax_rate", "taxr", S["tax"], S["pretax"], formule="Impôt sur les résultats divisé par le résultat avant impôt de la même période.")
    montant("ocf", "ocf", S["ocf"])
    montant("capex", "capex", S["capex"])
    if S["capex"] and rev: ratio("capex_ratio", "capex_r", S["capex"], rev, formule="Investissements (capex) divisés par le chiffre d'affaires.")
    # flux de tresorerie disponible
    if S["ocf"] and S["capex"]:
        cs = commun(S["ocf"], S["capex"])
        fcf = {l: (S["ocf"][l][0], S["ocf"][l][1] - S["capex"][l][1], S["ocf"][l][2] + "|" + S["capex"][l][2], "calcul") for l in cs}
        g.ajoute("fcf" + sfx, "fcf", fcf, unit_m, freq, k, 1,
                 formule="Flux de trésorerie d'exploitation moins investissements (capex), pour la même période.",
                 comps=lambda l: [("ocf", S["ocf"][l][1], S["ocf"][l][2]), ("capex", S["capex"][l][1], S["capex"][l][2])])
        if rev:
            ratio("fcf_margin", "fcf_m", fcf, rev, formule="Flux de trésorerie disponible divisé par le chiffre d'affaires.")
    montant("buyback", "buyback", S["buyback"])
    montant("divpaid", "divpaid", S["divpaid"])
    g.ajoute("eps_diluted" + sfx, "eps", eps, "$", freq, 1.0, 2) if eps else None
    g.ajoute("dps" + sfx, "dps", dps, "$", freq, 1.0, 2) if dps else None
    if shs:
        g.ajoute("diluted_shares" + sfx, "shares", shs, "M", freq, 1e-6, 1)
    # ---- bilan ----
    for n in ("cash", "inv", "ar", "ap", "assets", "equity", "debt"):
        montant(n, n, I[n])
    if I["debt"] and I["cash"]:
        cs = commun(I["debt"], I["cash"])
        nd = {l: (I["debt"][l][0], I["debt"][l][1] - I["cash"][l][1], I["debt"][l][2] + "|" + I["cash"][l][2], "calcul") for l in cs}
        g.ajoute("net_debt" + sfx, "netdebt", nd, unit_m, freq, k, 1,
                 formule="Dette financière totale moins trésorerie et équivalents, à la même date (négatif = trésorerie nette positive).",
                 comps=lambda l: [("debt", I["debt"][l][1], I["debt"][l][2]), ("cash", I["cash"][l][1], I["cash"][l][2])])
    if I["debt"] and I["equity"]:
        cs = {l for l in commun(I["debt"], I["equity"]) if I["equity"][l][1] > 0}
        de = {l: (I["debt"][l][0], I["debt"][l][1] / I["equity"][l][1] * 100, I["debt"][l][2] + "|" + I["equity"][l][2], "calcul") for l in cs}
        g.ajoute("debt_equity" + sfx, "debt_eq", de, "%", freq, 1.0, 1, kind="pct",
                 formule="Dette financière totale divisée par les capitaux propres, à la même date.",
                 comps=lambda l: [("debt", I["debt"][l][1], I["debt"][l][2]), ("equity", I["equity"][l][1], I["equity"][l][2])])
    # jours de stocks, de creances, de dettes fournisseurs : base 91,25 jours par trimestre (365 / 4)
    if freq == "quarterly" and cogs and I["inv"]:
        cs = {l for l in commun(I["inv"], cogs) if cogs[l][1] > 0}
        dio = {l: (I["inv"][l][0], I["inv"][l][1] / cogs[l][1] * 91.25, I["inv"][l][2] + "|" + cogs[l][2], "calcul") for l in cs}
        tr = {l: (I["inv"][l][0], cogs[l][1] * 4 / I["inv"][l][1], I["inv"][l][2] + "|" + cogs[l][2], "calcul") for l in cs if I["inv"][l][1] > 0}
        g.ajoute("inventory_turns" + sfx, "turns", tr, "x", freq, 1.0, 2,
                 formule="Coût des ventes du trimestre multiplié par 4, divisé par les stocks de fin de trimestre.",
                 comps=lambda l: [("inv", I["inv"][l][1], I["inv"][l][2]), ("cogs", cogs[l][1], cogs[l][2])])
        g.ajoute("dio" + sfx, "dio", dio, "jours", freq, 1.0, 0,
                 formule="Stocks de fin de trimestre divisés par le coût des ventes du trimestre, multipliés par 91,25 jours.",
                 comps=lambda l: [("inv", I["inv"][l][1], I["inv"][l][2]), ("cogs", cogs[l][1], cogs[l][2])])
    if freq == "quarterly" and rev and I["ar"]:
        cs = {l for l in commun(I["ar"], rev) if rev[l][1] > 0}
        dso = {l: (I["ar"][l][0], I["ar"][l][1] / rev[l][1] * 91.25, I["ar"][l][2] + "|" + rev[l][2], "calcul") for l in cs}
        g.ajoute("dso" + sfx, "dso", dso, "jours", freq, 1.0, 0,
                 formule="Créances clients de fin de trimestre divisées par le chiffre d'affaires du trimestre, multipliées par 91,25 jours.",
                 comps=lambda l: [("ar", I["ar"][l][1], I["ar"][l][2]), ("rev", rev[l][1], rev[l][2])])
    base_cogs = cogs
    if freq == "quarterly" and base_cogs and I["ap"]:
        cs = {l for l in commun(I["ap"], base_cogs) if base_cogs[l][1] > 0}
        dpo = {l: (I["ap"][l][0], I["ap"][l][1] / base_cogs[l][1] * 91.25, I["ap"][l][2] + "|" + base_cogs[l][2], "calcul") for l in cs}
        g.ajoute("dpo" + sfx, "dpo", dpo, "jours", freq, 1.0, 0,
                 formule="Dettes fournisseurs de fin de trimestre divisées par le coût des ventes du trimestre, multipliées par 91,25 jours.",
                 comps=lambda l: [("ap", I["ap"][l][1], I["ap"][l][2]), ("cogs", base_cogs[l][1], base_cogs[l][2])])
        by = {x["short"]: x for x in g.out}
        if "dio_q" in by and "dso_q" in by and "dpo_q" in by:
            dd = {h["q"]: h["v"] for h in by["dio_q"]["history"]}
            ds = {h["q"]: h["v"] for h in by["dso_q"]["history"]}
            dp = {h["q"]: h["v"] for h in by["dpo_q"]["history"]}
            fins = {l: I["inv"][l][0] for l in I["inv"]}
            ccc = {l: (fins[l], dd[l] + ds[l] - dp[l], "|".join([I["inv"][l][2], I["ar"][l][2], I["ap"][l][2]]), "calcul") for l in set(dd) & set(ds) & set(dp)}
            g.ajoute("ccc" + sfx, "ccc", ccc, "jours", freq, 1.0, 0,
                     formule="Jours de stocks plus jours de créances clients moins jours de dettes fournisseurs.",
                     comps=lambda l: [("inv", I["inv"][l][1], I["inv"][l][2]), ("ar", I["ar"][l][1], I["ar"][l][2]), ("ap", I["ap"][l][1], I["ap"][l][2])])
    return S, I


# ---------------------------------------------------------------------------
# Selection, collisions de noms, ecriture
# ---------------------------------------------------------------------------
import unicodedata

# Indicateurs peu informatifs (soldes bruts, montant d impot, ratio d investissement) ecartes partout
PEU_UTILES = {"tax_q", "capex_ratio_q", "assets_q", "ap_q"}
SKIP = {
    "FERG": {"buyback_q", "dps_q", "net_debt_q"} | PEU_UTILES,   # dette nette publiee par la societe (ratio dette nette / EBITDA ajuste deja present)
    "RDDT": {"dpo_q"} | PEU_UTILES,
    "FLEX": {"gross_profit_q", "eps_diluted_q", "capex_q"} | PEU_UTILES,
    "BE": set() | PEU_UTILES,
    "FDXF": set(),
}
CONFIG = {"FERG": (1e6, "M$"), "RDDT": (1e6, "M$"), "FLEX": (1e6, "M USD"), "BE": (1e6, "M USD"), "FDXF": (1e9, "Mds $")}
STOP = {"de", "du", "des", "d", "le", "la", "les", "l", "en", "the", "of", "total"}


def base(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return " ".join(sorted(m for m in s.split() if m not in STOP))


def fam(u):
    u = str(u or "").lower()
    if "%" in u:
        return "pct"
    if any(c in u for c in ["$", "eur", "€", "usd", "chf", "£"]):
        return "money"
    return "autre:" + re.sub(r"[^a-z]", "", u)[:6]


def selection(t: str, g: Gen, existants: list):
    """Retire les doublons de mesure et de libelle (le detecteur nocturne scan-kpi-doublons les retirerait)."""
    pris = {(base(k.get("name_fr") or k.get("short")), fam(k.get("unit"))) for k in existants}
    pris_short = {k.get("short") for k in existants}
    dernier = max((k["last_data_date"] for k in g.out if k["short"] == "gross_profit_q" or True), default=None)
    ref_dernier = max(k["history"][-1]["q"] for k in g.out) if g.out else None
    garde, rejets = [], []
    labs = [k["history"][-1]["q"] for k in g.out]
    from collections import Counter
    majo = Counter(labs).most_common(1)[0][0] if labs else None
    for kp in g.out:
        if kp["short"] in SKIP.get(t, set()):
            rejets.append((kp["short"], "mesure deja presente ou sans sens pour la societe")); continue
        if kp["short"] in pris_short:
            rejets.append((kp["short"], "short existant")); continue
        if kp["history"][-1]["q"] != majo:
            rejets.append((kp["short"], f"serie arretee a {kp['history'][-1]['q']} (derniere periode commune {majo})")); continue
        cle = (base(kp["name_fr"]), fam(kp["unit"]))
        if cle in pris:
            kp["name_fr"] += " (trimestre)" if kp["frequency"] == "quarterly" else " (exercice)"
            cle = (base(kp["name_fr"]), fam(kp["unit"]))
            if cle in pris:
                rejets.append((kp["short"], "libelle en doublon")); continue
        pris.add(cle)
        garde.append(kp)
    return garde, rejets


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker")
    ap.add_argument("--sortie")
    a = ap.parse_args()
    t = a.ticker.upper()
    div, unit_m = CONFIG[t]
    racine = Path(__file__).resolve().parents[1]
    # point de depart : copie de sauvegarde si elle existe (le script doit rester rejouable apres ecriture)
    sauv = W.parent.parent / "orig" / f"kpis-haut_{t}.json"
    existants = json.load(open(sauv if sauv.exists() else racine / f".batches-drafts-safe/kpis-haut/{t}.json"))["kpis"]
    g = Gen(t, div, unit_m, fiscal=(t in EXCLURE_FISCAL))
    if t in EXCLURE_FISCAL:
        gc = Gen(t, div, unit_m)
        batterie(gc)
        g.alt = {}
        for k in gc.out:
            g.alt[k["short"]] = {h["q"]: h["v"] for h in k["history"]}
    batterie(g)
    garde, rejets = selection(t, g, existants)
    out = {"ticker": t, "kpis": garde, "rejets": rejets,
           "comps": {k["short"]: g.comps[k["short"]] for k in garde}}
    dest = a.sortie or str(W.parent / "cand" / f"{t}.xbrl.json")
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(dest, "w"), ensure_ascii=False, indent=1)
    print(t, "gardes", len(garde), "rejets", rejets)


if __name__ == "__main__":
    main()


def roic_annuel(t: str):
    """ROIC annuel selon la formule deja utilisee par src/data/roic-dernier-exercice.json :
    resultat operationnel x (1 - taux d impot effectif) / (capitaux propres totaux + dette financiere - tresorerie).
    Taux d impot : impot / resultat avant impot ; en dehors de [0 ; 50 %] on applique le taux normatif de 25 %,
    comme le fichier de reference. Retourne {label FYxxxx: (fin, valeur en %, accn)}."""
    div, unit_m = CONFIG[t]
    g = Gen(t, div, unit_m)
    op = g.sa("opinc"); tax = g.sa("tax"); pre = g.sa("pretax")
    eq_c = ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"]
    eq = somme_instants(g.F, [eq_c])
    cash = somme_instants(g.F, INST["cash"])
    debt = somme_instants(g.F, INST["debt"])
    out = {}
    for lab, (fin, v, accn, _m) in op.items():
        if fin not in eq or fin not in cash:
            continue
        d_ = debt.get(fin, (0.0, ""))[0]
        t_ = None
        if lab in tax and lab in pre and pre[lab][1]:
            r = tax[lab][1] / pre[lab][1]
            if 0 <= r <= 0.5:
                t_ = r
        t_ = 0.25 if t_ is None else t_
        cap = eq[fin][0] + d_ - cash[fin][0]
        if cap <= 0:
            continue
        out[lab] = (fin, v * (1 - t_) / cap * 100, accn)
    return out
