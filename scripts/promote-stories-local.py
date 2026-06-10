#!/usr/bin/env python3
"""
promote-stories-local.py — DÉTERMINISTE, ZÉRO LLM, ZÉRO hallucination.

Réutilise l'existant : déplace les KPIs SPÉCIFIQUES à HISTOIRE COURTE (2-4 pts)
déjà extraits dans kpis[] vers stories_kpis[] pour qu'ils s'affichent dans le
bloc Stories. Le gate n'est pas impacté (le loader re-merge stories_kpis dans
kpis[] avec is_short_history=true, donc le kpis[] mergé est identique -> même
compte de spécifiques). Pas de doublon d'affichage (MOVE, pas COPY).

Garde-fous anti-contamination (Yann) :
  - blocklist générique = set exact du rendu (BASIC_GENERIC_STORY_EXCLUDE) +
    lib canonique kpi-generic-library.json + variantes (adjusted/total/net/...).
  - ne promeut QUE des KPIs non-génériques, value non nulle, name_fr présent,
    signal OU description présent (= exigences isStoryKpiUsable du rendu).
  - garde >=4 indicateurs spécifiques en place (ne vide pas le tableau).
  - cap 3 stories promues / sté.
  - cible : stés clean_all SANS stories actuelles, hors Nasdaq-100 (agents) et
    hors 7 témoins golden.

Usage : python3 scripts/promote-stories-local.py [--apply]
        (sans --apply = dry-run rapport seulement)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = "--apply" in sys.argv

NDX = set("AAPL MSFT NVDA AMZN AVGO META GOOGL GOOG TSLA COST NFLX TMUS PLTR CSCO AMD LIN INTU TXN ISRG QCOM BKNG AMGN PEP ADBE HON GILD AMAT CMCSA ADP VRTX PANW MU ADI LRCX MELI KLAC INTC SBUX CRWD CEG MDLZ CTAS DASH ABNB ORLY PYPL CDNS MAR REGN SNPS MRVL FTNT WDAY TEAM ADSK MNST AEP CSX ROP AXON PCAR PAYX CHTR NXPI ROST KDP FANG FAST EXC ODFL VRSK CCEP EA CTSH KHC GEHC XEL DDOG LULU TTWO IDXX CPRT BKR ON MCHP CSGP ZS ANSS DXCM WBD GFS TTD ARM MDB BIIB".split())
TEMOINS = {"AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"}

# Set exact du rendu (src/lib/kpi-stories-ordering.ts BASIC_GENERIC_STORY_EXCLUDE)
RENDER_SET = {
    "total revenue", "revenue", "net sales", "sales", "total sales", "net revenue",
    "chiffre d'affaires", "chiffre d'affaires net", "chiffre d'affaires total", "revenu total",
    "net income", "net profit", "net margin", "net margin %",
    "operating income", "op income", "operating profit", "ebit",
    "operating margin", "op margin", "operating margin %",
    "gross margin", "gross margin %", "ebitda", "ebitda margin",
    "free cash flow", "fcf", "operating cash flow", "ocf",
    "eps", "earnings per share", "eps diluted", "diluted eps",
    "total assets", "total debt", "net debt", "cash & equivalents", "cash and equivalents",
    "leverage ratio", "roe", "roic", "return on equity",
    "p/e ratio", "market cap", "market capitalization", "shares outstanding",
    "tax rate", "effective tax rate", "headcount", "capex", "r&d",
}
EXTRA = {
    "gross profit", "gross op income", "gross operating income", "operating expenses", "opex",
    "sg&a", "sga", "net earnings", "pretax income", "pre-tax income", "income before taxes",
    "income tax", "income tax expense", "depreciation", "amortization", "d&a",
    "working capital", "net working capital", "book value", "book value per share",
    "dividends", "dividend", "dividend payments", "dividends paid", "dividend per share", "dps",
    "payout ratio", "cap return", "buybacks", "share buybacks", "capital returned",
    "total equity", "total liabilities", "stockholders equity", "shareholders equity", "equity",
    "roa", "roce", "return on assets", "return on capital employed", "return on invested capital",
    "basic eps", "weighted average shares", "diluted shares", "share count",
    "uncertain tax positions", "goodwill", "intangible assets", "inventory", "inventories",
    "interest expense", "net interest expense", "financial expenses",
    "cost of revenue", "cost of sales", "cost of goods sold", "cogs",
    "gross profit margin", "contribution margin", "selling expenses",
    "revenue growth", "sales growth", "organic growth", "net sales growth",
    "eps growth", "earnings growth", "comparable sales", "comparable sales growth", "same store sales",
    "revenues", "net revenues", "profit before tax", "pbt", "operating profit margin",
    "pretax margin", "net margin %", "return on tangible equity", "rotce",
    "adjusted ebitda", "adjusted operating margin", "adjusted operating income",
    "adjusted net income", "adjusted eps", "adjusted earnings", "adjusted free cash flow",
    "net debt / ebitda", "net debt to ebitda",
}
FR_GEN = {
    "revenu", "revenus", "produits d'exploitation", "produit d'exploitation",
    "marge brute", "marge nette", "marge operationnelle", "marge d'exploitation", "marge ebitda",
    "resultat net", "resultat operationnel", "resultat d'exploitation", "resultat avant impots",
    "benefice net", "benefice par action", "bpa", "effectif", "effectifs",
    "capitaux propres", "dette nette", "dette totale", "endettement net",
    "dividende", "dividendes", "dividende par action", "flux de tresorerie",
    "flux de tresorerie disponible", "tresorerie", "tresorerie disponible",
    "taux de distribution", "rachats d'actions", "capital retourne",
}
PLURAL_GEN = {
    "operating revenue", "operating revenues", "total revenues", "revenues",
    "total borrowings", "borrowings", "net borrowings", "dividends per share",
    "net debt/ebitda", "net debt / ebitda", "net debt to ebitda", "retained earnings",
    "total leverage exposures", "leverage exposure", "total leverage exposure",
    "gross profit", "total equity", "total liabilities", "total stockholders equity",
    "net financial debt", "financial debt", "total capital",
    "accumulated oci", "other comprehensive income", "oci",
    "total leverage ratio exposures", "leverage ratio exposures", "total leverage ratio exposure",
    "risk weighted assets density", "tangible book value", "employees",
    "adjusted group result after tax", "group result after tax", "result after tax",
    "adjusted group result", "group net debt", "net asset value", "nav",
    "reingewinn", "konzernergebnis", "konzerngewinn", "nettoergebnis", "jahresueberschuss",
    "betriebsergebnis", "umsatz", "fee-ergebnis", "fee ergebnis", "ergebnis nach steuern",
}
BLOCK = RENDER_SET | EXTRA | FR_GEN | PLURAL_GEN
QUAL = {"adjusted", "adj", "ajuste", "ajustee", "core", "underlying", "comparable", "organic",
        "normalized", "total", "consolidated", "group", "non-gaap", "reported", "net", "gross"}
# suffixes generiques : un short se terminant ainsi est generique meme prefixe par un segment
GEN_SUFFIX = (" op income", " operating income", " operating margin", " net income",
              " gross margin", " gross profit", " ebitda margin", " ebitda", " net margin",
              " operating revenue", " operating revenues", " per share", " borrowings",
              " operating profit", " op margin")
ESG_RX = re.compile(r"\b(co2|co2e|scope [123]|scope1|scope2|scope3|emission|ghg|carbon|carbone|empreinte)\b", re.I)

# lib canonique
try:
    for it in json.load(open(os.path.join(ROOT, "src/data/kpi-generic-library.json"))):
        BLOCK.add(it["short"].lower().strip())
except Exception:
    pass

import unicodedata
def deaccent(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

def norm(s):
    s = deaccent(str(s).lower())
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\b20\d\d\b", "", s)
    s = re.sub(r"\b(trim|trimestriel|trimestrielle|quarterly|annuel|annuelle|annual|ttm|fy|q[1-4])\b", "", s)
    return re.sub(r"\s+", " ", s).strip()

# versions deaccentuees du blocklist
BLOCK_NA = {deaccent(x) for x in BLOCK}

def is_generic(short):
    raw = str(short or "")
    if ESG_RX.search(raw):
        return True
    b = norm(short)
    if not b or b in BLOCK_NA:
        return True
    # suffixe generique (segment + metrique banale)
    if any(b.endswith(suf.strip()) or b.endswith(suf) for suf in GEN_SUFFIX):
        return True
    toks = b.split()
    while toks and toks[0] in QUAL:
        toks = toks[1:]
    return " ".join(toks) in BLOCK_NA

def nums(h):
    if not isinstance(h, list):
        return None
    return [(x.get("value") if isinstance(x, dict) else x) for x in h]

def has_narr(k):
    return bool(str(k.get("signal") or "").strip()) or bool(str(k.get("description") or "").strip())

def val_ok(k):
    v = k.get("value")
    if isinstance(v, (int, float)):
        return abs(v) > 0
    if isinstance(v, str):
        s = v.strip()
        return len(s) > 0 and s != "—"
    return False

CAT_RULES = [
    ("Innovation", re.compile(r"\b(ai|cloud|innovat|r&d|pipeline|launch|gen|platform|digital|software|subscription|saas|patent|new product)\b", re.I)),
    ("Adoption", re.compile(r"\b(subscriber|user|customer|adoption|member|mau|dau|active|account|installed|seat|enroll)\b", re.I)),
    ("Capacite", re.compile(r"\b(capacity|production|store|unit|volume|gw|ton|wafer|fleet|network|coverage|shipment|deliver|backlog|orders|sites|beds|rooms)\b", re.I)),
    ("Marche", re.compile(r"\b(segment|revenue|sales|market|share|tam|region|americas|europe|asia|china|emea|apac|division|brand)\b", re.I)),
]
def infer_cat(k):
    blob = f"{k.get('short','')} {k.get('name_fr','')} {k.get('name_en','')} {k.get('signal','')}"
    for cat, rx in CAT_RULES:
        if rx.search(blob):
            return {"Capacite": "Capacité", "Marche": "Marché"}.get(cat, cat)
    return "Marché"

A = json.load(open(os.path.join(ROOT, "src/data/v1-9-pre-publication-audit.json")))
audits = A.get("audits") if isinstance(A, dict) else A
clean = [e["ticker"] for e in audits if isinstance(e, dict) and e.get("is_clean_all") is True]

promoted_stes = 0
promoted_total = 0
report = []
for t in sorted(clean):
    if t.upper() in NDX or t.upper() in TEMOINS:
        continue
    p = os.path.join(ROOT, f"src/data/v2-pipeline/{t.lower()}.json")
    if not os.path.exists(p):
        continue
    raw = open(p).read()
    try:
        d = json.loads(raw)
    except Exception:
        continue
    if d.get("stories_kpis"):  # a deja des stories
        continue
    kpis = d.get("kpis")
    if not isinstance(kpis, list):
        continue
    specific_idx = [i for i, k in enumerate(kpis)
                    if isinstance(k, dict) and not is_generic(k.get("short", "")) and val_ok(k)]
    n_spec = len(specific_idx)
    if n_spec < 5:  # garde au moins 4 indicateurs apres move -> besoin 5+ specifiques
        continue
    # candidats short-history (2-4 pts numeriques, value+name+narrative)
    hero = norm(d.get("hero_kpi"))
    cand = []
    for i in specific_idx:
        k = kpis[i]
        hv = nums(k.get("history"))
        sh = str(k.get("short", "")).strip()
        if not sh or len(sh) > 40:
            continue
        # JAMAIS déplacer le hero vers stories (sinon hero short-history -> gate FAIL / rendu 307)
        if norm(sh) == hero or norm(k.get("name_en")) == hero or norm(k.get("name_fr")) == hero:
            continue
        if not str(k.get("name_fr") or "").strip():
            continue
        if not has_narr(k):
            continue
        if hv and all(isinstance(x, (int, float)) for x in hv) and 2 <= len(hv) <= 5 and hv[0] not in (None, 0) and hv[-1] not in (None, 0):
            cand.append(i)
    if not cand:
        continue
    n_move = min(3, n_spec - 4, len(cand))
    if n_move <= 0:
        continue
    move_idx = set(cand[:n_move])
    stories = []
    for i in sorted(move_idx):
        k = dict(kpis[i])
        k.pop("is_generic", None)
        k["is_short_history"] = True
        if not k.get("story_category"):
            k["story_category"] = infer_cat(k)
        stories.append(k)
    new_kpis = [k for i, k in enumerate(kpis) if i not in move_idx]
    d["kpis"] = new_kpis
    d["stories_kpis"] = stories
    d["_stories_local_promoted"] = True
    promoted_stes += 1
    promoted_total += len(stories)
    report.append((t, [s.get("short") for s in stories]))
    if APPLY:
        pretty = raw[:300].count(chr(10)) > 3
        open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2 if pretty else None))

print(f"{'APPLIED' if APPLY else 'DRY-RUN'} : {promoted_stes} stes promues, {promoted_total} stories ajoutees")
for t, shorts in report[:40]:
    print(f"  {t}: {', '.join(str(s) for s in shorts)}")
if len(report) > 40:
    print(f"  ... +{len(report)-40} autres stes")
