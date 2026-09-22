#!/usr/bin/env python3
"""roic-dernier-exercice.py

Calcule le ROIC (retour sur capital investi) du DERNIER EXERCICE FISCAL COMPLET
pour chaque societe de src/data/v1-9-5-clean-all-tickers.json.

Methode
-------
1. Si la societe publie elle meme un retour sur capital investi dans ses comptes,
   on reprend sa valeur (origine = "publiee"). Detection stricte sur le texte des
   rapports annuels deja telecharges dans data-lake (phase "publie").
2. Sinon la valeur est CALCULEE et entierement reconstituable :
       NOPAT = resultat operationnel x (1 - taux d impot effectif)
       Capital investi = capitaux propres totaux + dette financiere - tresorerie
       ROIC = NOPAT / capital investi
   Les valeurs d entree, les balises source et la piece justificative (accession
   SEC ou source Yahoo Finance) sont enregistrees pour chaque societe.

Secteurs ecartes : banques, assureurs et reassureurs, courtiers et banques
d investissement, financement a la consommation, foncieres et REIT. Le capital
investi n y a pas le meme sens (la dette est une matiere premiere, pas un
financement) : aucune valeur n est inventee pour ces societes.

Sources (aucune source payante) :
- faits XBRL de la SEC deja presents dans le depot (data-lake/<T>/xbrl/companyfacts.json)
- sinon API publique gratuite data.sec.gov/api/xbrl/companyfacts (societes americaines)
- societes europeennes : comptes annuels consolides via yfinance (Yahoo Finance, gratuit),
  les faits XBRL SEC n existant pas pour elles.

Usage
-----
  python3 scripts/roic-dernier-exercice.py publie      # detection ROIC publie (10-K)
  python3 scripts/roic-dernier-exercice.py us          # societes americaines (XBRL SEC)
  python3 scripts/roic-dernier-exercice.py eu          # societes europeennes (yfinance)
  python3 scripts/roic-dernier-exercice.py build       # ecrit src/data/roic-dernier-exercice.json
  python3 scripts/roic-dernier-exercice.py rapport     # decompte

Reprise : chaque societe traitee est ecrite immediatement dans
<scratch>/roic-state.jsonl ; relancer la phase reprend ou elle s etait arretee.
"""
from __future__ import annotations

import gzip
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TICKERS_FILE = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
PIPELINE = ROOT / "src/data/v2-pipeline"
DATA_LAKE = ROOT / "data-lake"
CIK_MAP = ROOT / ".conv-state/quarterly-refresh-cik-map.json"
OUT_FILE = ROOT / "src/data/roic-dernier-exercice.json"

STATE_DIR = Path(
    os.environ.get("ROIC_STATE_DIR", "/private/tmp/claude-501/-Users-yann/"
                   "f6e0203b-2aed-4432-a0b3-a87ba8db1323/scratchpad/roic")
)
STATE_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE = STATE_DIR / "roic-state.jsonl"
PUBLISHED_FILE = STATE_DIR / "roic-publie.json"

UA = "Mettrik ROIC research yannricordeau100@gmail.com"

# ---------------------------------------------------------------- univers ---

EXCLU_MOTS = [
    "bank", "banq", "insur", "assur", "reassur", "réassur", "reinsur",
    "reit", "immobil", "real estate", "foncier", "foncière",
    "brokerage", "investment banking", "consumer finance", "mortgage",
    "self-storage", "wealth management", "credit",
]
EXCLU_SECTEURS = ["immobilier", "real estate", "assurance"]
# Sous-secteurs financiers CONSERVES (activite de services, pas de bilan bancaire)
GARDE_MOTS = ["payment", "paiement", "asset management",
              "market", "marche", "marché", "infrastructure de marche",
              "infrastructures de marche", "broker", "consult", "risk management",
              "exchange", "rating", "data"]

# Societes financieres au bilan de type bancaire ou assurantiel : ecartees meme
# si leur sous-secteur ressemble a une activite de services (banques de detail
# deguisees, conservateurs de titres, gerants alternatifs adosses a un assureur,
# credit a la consommation).
EXCLU_TICKERS = {
    "SCHW": "courtier a bilan bancaire",
    "RJF": "banque et courtier a bilan bancaire",
    "BNY": "banque conservatrice de titres",
    "STT": "banque conservatrice de titres",
    "NTRS": "banque conservatrice de titres",
    "AMP": "assurance vie et rentes",
    "AXP": "credit a la consommation",
    "APO": "gestion alternative adossee a un assureur",
    "KKR": "gestion alternative adossee a un assureur",
    "BX": "gestion alternative, bilan de participations",
    "ARES": "gestion alternative, bilan de participations",
    "PGHN.SW": "gestion alternative, bilan de participations",
}


def charger_univers() -> list[dict]:
    tickers = json.loads(TICKERS_FILE.read_text())["tickers"]
    out = []
    for t in tickers:
        p = PIPELINE / f"{t.lower()}.json"
        sector = subsector = name = None
        if p.exists():
            d = json.loads(p.read_text())
            sector = d.get("sector")
            subsector = d.get("subsector")
            name = d.get("name")
        out.append({"ticker": t, "name": name, "sector": sector, "subsector": subsector})
    return out


def est_exclu(c: dict) -> tuple[bool, str]:
    s = (c.get("sector") or "").lower()
    ss = (c.get("subsector") or "").lower()
    both = f"{s} | {ss}"
    if c["ticker"] in EXCLU_TICKERS:
        return True, EXCLU_TICKERS[c["ticker"]]
    if any(m in s for m in EXCLU_SECTEURS):
        return True, c.get("sector") or "?"
    if "financ" in s or "assur" in s:
        bilan_bancaire = any(m in ss for m in ["bank", "banq", "reinsur", "réassur"])
        courtier = any(m in ss for m in ["broker", "broking", "courtier"])
        if any(g in ss for g in GARDE_MOTS) and (courtier or not (
                bilan_bancaire or any(m in ss for m in ["insur", "assur"]))):
            return False, ""
        if any(m in both for m in EXCLU_MOTS):
            return True, f"{c.get('sector')} / {c.get('subsector')}"
        # Finance non qualifiee : holdings, services financiers divers
        return True, f"{c.get('sector')} / {c.get('subsector')}"
    if any(m in ss for m in ["reit", "immobil", "real estate", "foncier"]) and not any(
            g in ss for g in ["platefor", "plateform", "marketplace", "logiciel", "software",
                              "services", "annonces"]):
        return True, f"{c.get('sector')} / {c.get('subsector')}"
    return False, ""


def est_us(ticker: str) -> bool:
    return "." not in ticker or ticker.endswith(".B")


# ------------------------------------------------------------------ etat ---

def lire_etat() -> dict:
    etat = {}
    if STATE_FILE.exists():
        for line in STATE_FILE.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            etat[r["ticker"]] = r
    return etat


def ecrire_etat(rec: dict) -> None:
    with STATE_FILE.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ------------------------------------------------------------- XBRL SEC ---

def http_json(url: str, retries: int = 4):
    """Telechargement via curl (le magasin de certificats de Python est incomplet
    sur ce poste)."""
    import subprocess
    last = None
    for i in range(retries):
        try:
            p = subprocess.run(
                ["curl", "-sS", "--compressed", "--max-time", "90",
                 "-w", "\n%{http_code}", "-A", UA, url],
                capture_output=True, text=True)
            if p.returncode != 0:
                raise RuntimeError(p.stderr.strip()[:200])
            body, _, code = p.stdout.rpartition("\n")
            code = code.strip()
            if code == "404":
                return None
            if code != "200":
                raise RuntimeError(f"HTTP {code}")
            return json.loads(body)
        except Exception as e:
            last = e
            time.sleep(2 + 3 * i)
    raise last


FORMS_ANNUELS = {"10-K", "10-K/A", "20-F", "20-F/A", "40-F"}


def index_facts(facts: dict, tag: str, instant: bool):
    """Retourne {date_fin: (valeur, accn, form)} pour les exercices annuels."""
    node = facts.get(tag)
    if not node:
        return {}
    for unit in ("USD", "EUR", "CHF"):
        entries = node.get("units", {}).get(unit)
        if entries:
            break
    else:
        return {}
    out = {}
    for e in entries:
        if instant:
            # un solde de bilan a la date de cloture annuelle est le meme qu il
            # soit repris dans le 10-K ou dans un 10-Q ulterieur
            if e.get("start"):
                continue
        else:
            if e.get("form") not in FORMS_ANNUELS:
                continue
            if not e.get("start"):
                continue
            d0 = datetime.fromisoformat(e["start"])
            d1 = datetime.fromisoformat(e["end"])
            if not (330 <= (d1 - d0).days <= 400):
                continue
            if e.get("fp") not in (None, "FY"):
                continue
        key = e["end"]
        prev = out.get(key)
        rang = (1 if e.get("form") in FORMS_ANNUELS else 0, e.get("filed", ""))
        if prev is None or rang >= prev[3]:
            out[key] = (float(e["val"]), e.get("accn"), e.get("form"), rang)
    return {k: v[:3] for k, v in out.items()}


TAGS_EBIT = ["OperatingIncomeLoss"]
TAGS_PRETAX = [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic",
]
TAGS_TAX = ["IncomeTaxExpenseBenefit", "IncomeTaxExpenseBenefitContinuingOperations"]
TAGS_NET = ["IncomeLossAttributableToParent", "NetIncomeLoss", "ProfitLoss"]
TAGS_INTERET = ["InterestExpense", "InterestAndDebtExpense", "InterestExpenseDebt",
                "InterestExpenseNonoperating", "InterestIncomeExpenseNet"]
TAGS_EQUITY = [
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "StockholdersEquity",
    "MembersEquity",
    "PartnersCapital",
]
TAGS_DEBT_NC = [
    "LongTermDebtNoncurrent",
    "LongTermDebtAndCapitalLeaseObligations",
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "LongTermNotesPayable",
    "LongTermLineOfCredit",
    "SeniorLongTermNotes",
    "LongTermLoansPayable",
    "OtherLongTermDebtNoncurrent",
    "ConvertibleDebtNoncurrent",
    "NotesPayableRelatedPartiesNoncurrent",
]
TAGS_DEBT_CUR = [
    "DebtCurrent",
    "LongTermDebtCurrent",
    "LongTermDebtAndCapitalLeaseObligationsCurrent",
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
    "NotesPayableCurrent",
    "ShortTermBorrowings",
    "OtherShortTermBorrowings",
    "CommercialPaper",
]
TAGS_DEBT_TOTAL = [
    "DebtLongtermAndShorttermCombinedAmount",
    "LongTermDebt",
    "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
    "DebtAndCapitalLeaseObligations",
]
TAGS_BILAN_REF = ["Assets", "Liabilities"]
TAGS_CASH = [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashAndDueFromBanks",
]
TAGS_STI = ["ShortTermInvestments", "OtherShortTermInvestments",
            "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
            "MarketableSecuritiesCurrent"]


def pick(idxs: dict, tags: list[str], date: str):
    for t in tags:
        v = idxs.get(t, {}).get(date)
        if v is not None:
            return t, v[0], v[1], v[2]
    return None


def choix_capitaux_propres(idx: dict, date: str):
    """Choisit la balise de capitaux propres coherente avec le bilan.

    Certaines societes balisent par erreur des sous-totaux (Agilent tague ses
    ecarts de conversion avec la balise "capitaux propres part du groupe et des
    minoritaires"). On retient donc le candidat le plus proche de
    actif total moins passif total quand cette reference existe.
    """
    cands = []
    for t in TAGS_EQUITY:
        v = idx.get(t, {}).get(date)
        if v is not None:
            cands.append((t, v[0], v[1], v[2]))
    if not cands:
        return None
    a = idx.get("Assets", {}).get(date)
    li = idx.get("Liabilities", {}).get(date)
    if a and li:
        ref = a[0] - li[0]
        cands.sort(key=lambda c: abs(c[1] - ref))
    return cands[0]


def calc_depuis_facts(cf: dict) -> dict:
    gaap = cf.get("facts", {}).get("us-gaap") or {}
    if not gaap:
        return {"statut": "echec", "cause": "aucun fait us-gaap"}
    tous = TAGS_EBIT + TAGS_PRETAX + TAGS_TAX + TAGS_NET
    inst = (TAGS_EQUITY + TAGS_DEBT_NC + TAGS_DEBT_CUR + TAGS_DEBT_TOTAL + TAGS_CASH
            + TAGS_STI + TAGS_BILAN_REF)
    idx = {t: index_facts(gaap, t, instant=False) for t in tous}
    idx.update({t: index_facts(gaap, t, instant=True) for t in inst})
    for t in TAGS_INTERET:
        idx[t] = index_facts(gaap, t, instant=False)

    dates_ebit = set()
    for t in TAGS_EBIT:
        dates_ebit |= set(idx.get(t, {}))
    # resultat avant impot reconstitue quand il n est pas balise :
    # resultat net + charge d impot
    pretax_synth = {}
    for t in TAGS_NET:
        for d, v in idx.get(t, {}).items():
            if d in pretax_synth or any(d in idx.get(x, {}) for x in TAGS_PRETAX):
                continue
            tx = pick(idx, TAGS_TAX, d)
            if tx:
                pretax_synth[d] = (v[0] + tx[1], v[1], v[2])
    idx["_PRETAX_RECONSTITUE"] = pretax_synth
    TAGS_PRETAX_LOC = TAGS_PRETAX + ["_PRETAX_RECONSTITUE"]

    synth = {}
    for t in TAGS_PRETAX_LOC:
        for d, v in idx.get(t, {}).items():
            if d in synth:
                continue
            inte = pick(idx, TAGS_INTERET, d)
            synth[d] = (v[0] + (inte[1] if inte else 0.0), v[1], v[2])
    idx["_EBIT_RECONSTITUE"] = synth
    TAGS_EBIT_LOC = TAGS_EBIT + ["_EBIT_RECONSTITUE"]
    dates_ebit |= set(synth)

    dates_eq = set()
    for t in TAGS_EQUITY:
        dates_eq |= set(idx.get(t, {}))
    communes = sorted(dates_ebit & dates_eq, reverse=True)
    if not communes:
        return {"statut": "echec",
                "cause": "pas de resultat operationnel et capitaux propres sur une meme cloture"}

    for date in communes[:3]:
        ebit = pick(idx, TAGS_EBIT_LOC, date)
        eq = choix_capitaux_propres(idx, date)
        if not ebit or not eq:
            continue
        tax = pick(idx, TAGS_TAX, date)
        pre = pick(idx, TAGS_PRETAX_LOC, date)
        notes = []
        ebit_reconstitue = ebit[0] == "_EBIT_RECONSTITUE"
        if ebit_reconstitue:
            notes.append("resultat operationnel non balise : reconstitue en "
                         "resultat avant impot + charge d interets")
        if tax and pre and pre[1] > 0:
            taux = tax[1] / pre[1]
            src_taux = f"{tax[0]} / {pre[0]}"
            if taux < 0 or taux > 0.45:
                taux = 0.25
                src_taux = "taux normatif 25 % (taux effectif hors bornes)"
                notes.append("taux d impot effectif hors bornes, 25 % retenu")
        else:
            taux = 0.25
            src_taux = "taux normatif 25 % (impot ou resultat avant impot non disponible)"
            notes.append("taux d impot non disponible, 25 % retenu")

        dnc = pick(idx, TAGS_DEBT_NC, date)
        dcur = pick(idx, TAGS_DEBT_CUR, date)
        dtot = pick(idx, TAGS_DEBT_TOTAL, date)
        dette_src = []
        if dnc:
            dette = dnc[1]
            dette_src.append(dnc[0])
            if dcur:
                dette += dcur[1]
                dette_src.append(dcur[0])
            else:
                notes.append("part courante de la dette non balisee, 0 retenu")
        elif dtot:
            dette = dtot[1]
            dette_src.append(dtot[0])
        elif dcur:
            dette = dcur[1]
            dette_src.append(dcur[0])
            notes.append("dette long terme non balisee")
        else:
            dette = 0.0
            dette_src.append("aucune balise de dette")
            notes.append("aucune dette financiere balisee, 0 retenu")

        cash = pick(idx, TAGS_CASH, date)
        sti = pick(idx, TAGS_STI, date)
        tresorerie = (cash[1] if cash else 0.0) + (sti[1] if sti else 0.0)
        tres_src = [x[0] for x in (cash, sti) if x] or ["aucune balise de tresorerie"]
        if not cash:
            notes.append("tresorerie non balisee, 0 retenu")

        capital = eq[1] + dette - tresorerie
        if capital <= 0:
            return {"statut": "echec", "cause": "capital investi nul ou negatif",
                    "exercice_clos_le": date}
        nopat = ebit[1] * (1 - taux)
        roic = nopat / capital
        if date < _limite_fraicheur():
            notes.append("exercice retenu anterieur a 18 mois : dernier exercice "
                         "complet non disponible dans les faits XBRL")
        conf = "haute"
        if notes:
            conf = "moyenne"
        if roic > 1:
            notes.append("capital investi residuel au regard du resultat : "
                         "ROIC mathematiquement exact mais peu significatif")
        if abs(roic) > 1 or any("dette" in n for n in notes):
            conf = "faible"
        return {
            "statut": "ok",
            "exercice_clos_le": date,
            "roic": round(roic, 4),
            "origine": "calculee",
            "formule": ("ROIC = (resultat avant impot + charge d interets) x (1 - taux d impot "
                        "effectif) / (capitaux propres totaux + dette financiere - tresorerie et "
                        "placements court terme)") if ebit_reconstitue else
                       ("ROIC = resultat operationnel x (1 - taux d impot effectif) / "
                        "(capitaux propres totaux + dette financiere - tresorerie et placements court terme)"),
            "entrees": {
                "resultat_operationnel": ebit[1],
                "resultat_operationnel_balise": ebit[0],
                "taux_impot_effectif": round(taux, 4),
                "taux_impot_source": src_taux,
                "nopat": round(nopat, 2),
                "capitaux_propres": eq[1],
                "capitaux_propres_balise": eq[0],
                "dette_financiere": dette,
                "dette_balises": dette_src,
                "tresorerie": tresorerie,
                "tresorerie_balises": tres_src,
                "capital_investi": round(capital, 2),
            },
            "source": {
                "type": "faits XBRL SEC (companyfacts)",
                "accession": ebit[2],
                "formulaire": ebit[3],
                "entite": cf.get("entityName"),
                "cik": cf.get("cik"),
            },
            "confiance": conf,
            "notes": notes,
        }
    return {"statut": "echec", "cause": "donnees incompletes sur les dernieres clotures"}


def _limite_fraicheur() -> str:
    """Un exercice clos il y a plus de 18 mois n est pas le dernier exercice."""
    d = datetime.now(timezone.utc)
    return f"{d.year - 2}-{d.month:02d}-{d.day:02d}" if d.month <= 6 else \
           f"{d.year - 1}-{d.month - 6:02d}-{d.day:02d}"


def companyfacts_local(ticker: str):
    for p in [DATA_LAKE / ticker / "xbrl" / "companyfacts.json",
              DATA_LAKE / ticker / "companyfacts.json",
              DATA_LAKE / ticker / "xbrl" / "companyfacts_edgar.json",
              DATA_LAKE / ticker / "xbrl" / "edgar_companyfacts.json"]:
        if p.exists():
            wrong = p.parent / "_WRONG_COMPANY.txt"
            if wrong.exists():
                return None
            try:
                return json.loads(p.read_text())
            except Exception:
                return None
    return None


_cik_extra = {}


def cik_de(ticker: str, cikmap: dict):
    for k in (ticker, ticker.replace(".", "-"), ticker.split(".")[0]):
        if k in cikmap:
            return str(cikmap[k]).zfill(10)
    if ticker in _cik_extra:
        return _cik_extra[ticker]
    # repli : resolution du ticker par EDGAR browse-edgar (gratuit)
    import subprocess
    url = ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK="
           f"{ticker.replace('.', '-')}&type=10-K&dateb=&owner=include&count=1&output=atom")
    try:
        p = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA, url],
                           capture_output=True, text=True)
        m = re.search(r"<cik>(\d+)</cik>", p.stdout)
        if m:
            _cik_extra[ticker] = m.group(1).zfill(10)
            return _cik_extra[ticker]
    except Exception:
        pass
    return None


def traiter_us(c: dict, cikmap: dict, publies: dict) -> dict:
    t = c["ticker"]
    rec = {"ticker": t, "nom": c.get("name"), "secteur": c.get("sector"),
           "sous_secteur": c.get("subsector"), "zone": "US"}
    cf = companyfacts_local(t)
    src_local = cf is not None
    cik = None
    if cf is None:
        cik = cik_de(t, cikmap)
        if not cik:
            rec.update({"statut": "echec", "cause": "CIK introuvable"})
            return rec
        cf = http_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json")
        if cf is None:
            rec.update({"statut": "echec", "cause": "companyfacts SEC indisponible (404)"})
            return rec
    res = calc_depuis_facts(cf)
    if (res.get("statut") == "ok" and src_local
            and res["exercice_clos_le"] < _limite_fraicheur()):
        # fichier local perime : on redemande les faits a la SEC
        cik = cik_de(t, cikmap)
        cf2 = http_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json") if cik else None
        if cf2:
            res2 = calc_depuis_facts(cf2)
            if res2.get("statut") == "ok" and res2["exercice_clos_le"] > res["exercice_clos_le"]:
                res, cf, src_local = res2, cf2, False
    if res.get("statut") != "ok":
        # repli gratuit quand les faits XBRL de la SEC sont incomplets
        # (certaines societes ne publient leurs comptes annuels qu en pieces
        # jointes non balisees, ex Exxon : companyfacts ne contient que des 10-Q)
        repli = traiter_eu(c)
        if repli.get("statut") == "ok":
            repli["notes"] = list(repli.get("notes", [])) + [
                f"faits XBRL SEC inexploitables ({res.get('cause')}), comptes annuels "
                "repris de Yahoo Finance"]
            repli["confiance"] = "faible"
            repli["zone"] = rec["zone"]
            return repli
    if res.get("statut") == "ok":
        res["source"]["origine_fichier"] = ("depot data-lake" if src_local
                                            else "API data.sec.gov (gratuite)")
        pub = publies.get(t)
        if publie_valide(pub):
            res["roic_publie_par_la_societe"] = pub
    rec.update(res)
    return rec


# ------------------------------------------------- societes europeennes ---

ALIAS_YAHOO = {
    "DPW.DE": "DHL.DE",   # Deutsche Post renomme DHL Group
    "ROG.SW": "RO.SW",    # Roche, code Yahoo du bon porteur
}


def traiter_eu(c: dict) -> dict:
    import yfinance as yf
    t = c["ticker"]
    rec = {"ticker": t, "nom": c.get("name"), "secteur": c.get("sector"),
           "sous_secteur": c.get("subsector"), "zone": "EU"}
    try:
        tk = yf.Ticker(ALIAS_YAHOO.get(t, t))
        inc = tk.income_stmt
        bs = tk.balance_sheet
    except Exception as e:
        rec.update({"statut": "echec", "cause": f"yfinance indisponible ({e})"})
        return rec
    if inc is None or bs is None or inc.empty or bs.empty:
        rec.update({"statut": "echec", "cause": "comptes annuels indisponibles"})
        return rec

    def row(df, names):
        for n in names:
            if n in df.index:
                s = df.loc[n]
                return n, s
        return None, None

    dates = [d for d in inc.columns if d in bs.columns]
    dates = sorted(dates, reverse=True)
    if not dates:
        rec.update({"statut": "echec", "cause": "aucune cloture commune compte de resultat / bilan"})
        return rec

    n_ebit, s_ebit = row(inc, ["EBIT", "Operating Income", "Total Operating Income As Reported"])
    n_eq, s_eq = row(bs, ["Total Equity Gross Minority Interest", "Stockholders Equity"])
    n_debt, s_debt = row(bs, ["Total Debt"])
    n_dlt, s_dlt = row(bs, ["Long Term Debt And Capital Lease Obligation", "Long Term Debt"])
    n_dct, s_dct = row(bs, ["Current Debt And Capital Lease Obligation", "Current Debt",
                            "Other Current Borrowings"])
    n_cash, s_cash = row(bs, ["Cash Cash Equivalents And Short Term Investments",
                              "Cash And Cash Equivalents"])
    n_tax, s_tax = row(inc, ["Tax Provision"])
    n_pre, s_pre = row(inc, ["Pretax Income"])
    if s_ebit is None or s_eq is None:
        rec.update({"statut": "echec",
                    "cause": "resultat operationnel ou capitaux propres absents de la source"})
        return rec

    import math

    def val(s, d):
        if s is None or d not in s.index:
            return None
        v = s[d]
        try:
            v = float(v)
        except Exception:
            return None
        return None if math.isnan(v) else v

    for d in dates:
        ebit = val(s_ebit, d)
        eq = val(s_eq, d)
        if ebit is None or eq is None:
            continue
        notes = []
        tax, pre = val(s_tax, d), val(s_pre, d)
        if tax is not None and pre and pre > 0:
            taux = tax / pre
            src_taux = f"{n_tax} / {n_pre}"
            if taux < 0 or taux > 0.45:
                taux, src_taux = 0.25, "taux normatif 25 % (taux effectif hors bornes)"
                notes.append("taux d impot effectif hors bornes, 25 % retenu")
        else:
            taux, src_taux = 0.25, "taux normatif 25 % (impot non disponible)"
            notes.append("taux d impot non disponible, 25 % retenu")
        dette = val(s_debt, d)
        n_dette = n_debt
        if dette is None:
            lt, ct = val(s_dlt, d), val(s_dct, d)
            if lt is not None or ct is not None:
                dette = (lt or 0.0) + (ct or 0.0)
                n_dette = " + ".join(x for x in (n_dlt if lt is not None else None,
                                                 n_dct if ct is not None else None) if x)
            else:
                dette = 0.0
                n_dette = "absente"
                notes.append("dette financiere absente de la source, 0 retenu")
        tres = val(s_cash, d)
        if tres is None:
            tres = 0.0
            notes.append("tresorerie absente de la source, 0 retenu")
        capital = eq + dette - tres
        if capital <= 0:
            rec.update({"statut": "echec", "cause": "capital investi nul ou negatif",
                        "exercice_clos_le": str(d)[:10]})
            return rec
        nopat = ebit * (1 - taux)
        roic = nopat / capital
        if roic > 1:
            notes.append("capital investi residuel au regard du resultat : "
                         "ROIC mathematiquement exact mais peu significatif")
        conf = "moyenne" if not notes else "faible"
        cur = None
        try:
            cur = tk.fast_info.get("currency")
        except Exception:
            pass
        rec.update({
            "statut": "ok",
            "exercice_clos_le": str(d)[:10],
            "roic": round(roic, 4),
            "origine": "calculee",
            "formule": "ROIC = resultat operationnel x (1 - taux d impot effectif) / "
                       "(capitaux propres totaux + dette financiere - tresorerie et placements court terme)",
            "entrees": {
                "resultat_operationnel": ebit,
                "resultat_operationnel_balise": n_ebit,
                "taux_impot_effectif": round(taux, 4),
                "taux_impot_source": src_taux,
                "nopat": round(nopat, 2),
                "capitaux_propres": eq,
                "capitaux_propres_balise": n_eq,
                "dette_financiere": dette,
                "dette_balises": [n_dette or "absente"],
                "tresorerie": tres,
                "tresorerie_balises": [n_cash or "absente"],
                "capital_investi": round(capital, 2),
                "devise": cur,
            },
            "source": {
                "type": "comptes annuels consolides publies, releves via Yahoo Finance (gratuit)",
                "origine_fichier": "yfinance income_stmt + balance_sheet",
            },
            "confiance": conf,
            "notes": notes,
        })
        return rec
    rec.update({"statut": "echec", "cause": "aucune cloture exploitable"})
    return rec


# --------------------------------------------------- ROIC publie (texte) ---

# Les mentions de ROIC dans les 10-K sont le plus souvent des criteres de
# remuneration ("ROIC pondere a 50 %") et non une valeur publiee. Seules les
# mentions ou la societe donne SA valeur sont retenues.
REJET_PUB = ["weight", "target", "payout", "vest", "award", "grant", "psu",
             "performance period", "metric", "pondere", "incentive"]


def publie_valide(hit: dict) -> bool:
    if not hit:
        return False
    x = hit["extrait"].lower()
    if any(re.search(r"\b" + m, x) for m in REJET_PUB):
        return False
    return bool(re.search(r"(?:return on invested capital|roic)[^.%]{0,60}?"
                          r"\d{1,2}(?:[.,]\d)?\s?%", x))


RE_PUB = re.compile(
    r"(?:return on invested capital|ROIC)[^.%]{0,120}?(\d{1,2}(?:[.,]\d)?)\s?%",
    re.I)


def phase_publie(univers):
    res = {}
    if PUBLISHED_FILE.exists():
        res = json.loads(PUBLISHED_FILE.read_text())
    for i, c in enumerate(univers):
        t = c["ticker"]
        if t in res:
            continue
        d = DATA_LAKE / t / "10K"
        cands = sorted(d.glob("*.htm.gz")) if d.exists() else []
        hit = None
        if cands:
            p = cands[-1]
            try:
                txt = gzip.open(p, "rt", errors="ignore").read()
                txt = re.sub(r"<[^>]+>", " ", txt)
                txt = re.sub(r"&nbsp;?", " ", txt)
                txt = re.sub(r"\s+", " ", txt)
                m = RE_PUB.search(txt)
                if m:
                    hit = {"valeur_pct": m.group(1).replace(",", "."),
                           "extrait": txt[max(0, m.start() - 120):m.end() + 40],
                           "document": p.name}
            except Exception:
                pass
        res[t] = hit
        if i % 25 == 0:
            PUBLISHED_FILE.write_text(json.dumps(res, ensure_ascii=False, indent=1))
            print(f"  publie {i}/{len(univers)}", flush=True)
    PUBLISHED_FILE.write_text(json.dumps(res, ensure_ascii=False, indent=1))
    n = sum(1 for v in res.values() if v)
    print(f"ROIC mentionne avec une valeur chiffree dans le dernier 10-K : {n}")


# ------------------------------------------------------------------ main ---

def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "rapport"
    univers = charger_univers()
    for c in univers:
        ex, motif = est_exclu(c)
        c["exclu"] = ex
        c["motif_exclusion"] = motif

    if phase == "publie":
        phase_publie([c for c in univers if not c["exclu"]])
        return

    etat = lire_etat()
    publies = json.loads(PUBLISHED_FILE.read_text()) if PUBLISHED_FILE.exists() else {}
    cikmap = json.loads(CIK_MAP.read_text()) if CIK_MAP.exists() else {}

    if phase in ("us", "eu"):
        cibles = [c for c in univers if not c["exclu"]
                  and (est_us(c["ticker"]) if phase == "us" else not est_us(c["ticker"]))
                  and etat.get(c["ticker"], {}).get("statut") != "ok"]
        print(f"phase {phase} : {len(cibles)} societes a traiter")
        lot = 0
        if phase == "us":
            with ThreadPoolExecutor(max_workers=6) as ex:
                for rec in ex.map(lambda c: _safe(traiter_us, c, cikmap, publies), cibles):
                    ecrire_etat(rec)
                    lot += 1
                    if lot % 25 == 0:
                        print(f"  {lot}/{len(cibles)}", flush=True)
        else:
            with ThreadPoolExecutor(max_workers=4) as ex:
                for rec in ex.map(lambda c: _safe(traiter_eu, c), cibles):
                    ecrire_etat(rec)
                    lot += 1
                    if lot % 20 == 0:
                        print(f"  {lot}/{len(cibles)}", flush=True)
        print("phase terminee")
        return

    if phase in ("build", "rapport"):
        construire(univers, etat, publies, ecrire=(phase == "build"))
        return

    print("phase inconnue")


def _safe(fn, *a):
    c = a[0]
    try:
        return fn(*a)
    except Exception as e:
        return {"ticker": c["ticker"], "nom": c.get("name"), "secteur": c.get("sector"),
                "statut": "echec", "cause": f"exception: {type(e).__name__}: {e}"}


def construire(univers, etat, publies, ecrire=True):
    societes, exclues, echecs = [], [], []
    non_significatifs = []
    for c in univers:
        t = c["ticker"]
        if c["exclu"]:
            exclues.append({"ticker": t, "nom": c.get("name"),
                            "secteur": c.get("sector"), "sous_secteur": c.get("subsector"),
                            "motif": "secteur ou la notion de capital investi ne s applique pas "
                                     "(banque, assurance, fonciere)"})
            continue
        r = etat.get(t)
        if not r or r.get("statut") != "ok":
            cause = (r or {}).get("cause", "non traitee")
            ligne = {"ticker": t, "nom": c.get("name"), "secteur": c.get("sector"),
                     "cause": cause}
            if "capital investi" in cause:
                ligne["explication"] = ("capitaux propres plus dette financiere moins "
                                        "tresorerie inferieurs ou egaux a zero : le ratio "
                                        "n a pas de sens, aucune valeur n est produite")
                non_significatifs.append(ligne)
            else:
                echecs.append(ligne)
            continue
        societes.append(r)
    doc = {
        "genere_le": datetime.now(timezone.utc).isoformat(),
        "univers": TICKERS_FILE.name,
        "nombre_univers": len(univers),
        "methode": {
            "principe": "ROIC du dernier exercice fiscal complet. Valeur publiee par la societe "
                        "si elle en publie une, sinon valeur calculee et reconstituable.",
            "formule_par_defaut": "ROIC = resultat operationnel x (1 - taux d impot effectif) / "
                                  "(capitaux propres totaux + dette financiere - tresorerie et "
                                  "placements court terme)",
            "taux_impot": "taux effectif = impot sur le resultat / resultat avant impot ; "
                          "25 % normatif si indisponible ou hors bornes, signale dans les notes",
            "sources": ["faits XBRL SEC presents dans data-lake",
                        "API publique gratuite data.sec.gov/api/xbrl/companyfacts",
                        "comptes annuels consolides releves via Yahoo Finance pour l Europe"],
            "exclusions": "banques, assureurs et reassureurs, courtiers, financement a la "
                          "consommation, foncieres et REIT",
            "regle": "aucune valeur approchee : une societe sans chiffre fiable reste sans valeur",
        },
        "decompte": {
            "avec_roic": len(societes),
            "ecartees_secteur": len(exclues),
            "capital_investi_negatif": len(non_significatifs),
            "en_echec": len(echecs),
            "taux_couverture_hors_exclusions": round(
                100 * len(societes) / max(1, len(univers) - len(exclues)), 1),
            "taux_couverture_hors_exclusions_et_capital_negatif": round(
                100 * len(societes) / max(1, len(univers) - len(exclues)
                                          - len(non_significatifs)), 1),
            "taux_couverture_univers": round(100 * len(societes) / max(1, len(univers)), 1),
        },
        "societes": sorted(societes, key=lambda r: r["ticker"]),
        "ecartees_secteur": sorted(exclues, key=lambda r: r["ticker"]),
        "capital_investi_negatif": sorted(non_significatifs, key=lambda r: r["ticker"]),
        "en_echec": sorted(echecs, key=lambda r: r["ticker"]),
    }
    if ecrire:
        OUT_FILE.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
        print(f"ecrit : {OUT_FILE}")
    print(json.dumps(doc["decompte"], ensure_ascii=False, indent=1))
    import collections
    print("causes d echec :", collections.Counter(e["cause"][:60] for e in echecs).most_common(10))


if __name__ == "__main__":
    main()
