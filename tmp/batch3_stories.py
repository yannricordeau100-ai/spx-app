"""Batch 3 story categorization (CMS-FRT, 100 stes). Same method as batch2:
retag existing KPI entries into story_category (Capital/Innovation/Adoption/Capacite/Segments)
using keyword heuristics on real fields (short/_short_raw/name_fr). Zero invention:
no value/signal is fabricated, only classification of KPI already present in the pipeline.
Only touches KPIs currently untagged (story_category None) or generically tagged "Marche".
Generic financial KPIs (revenue/gross_profit/operating_income/net_income/eps/margins) are left as-is.
"""
import json, os, re

TICKERS = "CMS CNC CNP COF COHR COIN COO COP COR COST CPAY CPB CPRT CPT CRH CRL CRM CRWD CSCO CSGP CSX CTAS CTSH CTVA CVNA CVS CVX D DAL DASH DD DDOG DE DECK DELL DG DGX DHI DHR DIS DLR DLTR DOC DOV DOW DPZ DRI DTE DUK DVA DVN DXCM EA EBAY ECL ED EFX EG EIX EL ELV EME EMR EOG EPAM EQIX EQR EQT ERIE ES ESS ETN ETR EVRG EW EXC EXE EXPD EXPE EXR F FANG FAST FCX FDS FDX FE FFIV FICO FIS FISV FITB FIX FOX FOXA FRT".split()

GENERIC_SHORTS = {"revenue","gross_profit","operating_income","net_income","eps","eps_diluted",
                   "operating_margin","net_margin","free_cash_flow","fcf","headcount"}

# ordered rules: first match wins
RULES = [
 ("Capital", [
    "repurchas", "buyback", "rachat", "dividend", "dividende", "notes issued", "senior notes",
    "bond", "debt repa", "debt reduc", "deleverag", "remboursement", "dette", "capex",
    "capital expenditure", "capital plan", "investment plan", "cash & equival", "cash and equival",
    "roic", "return on invested capital", "payout ratio", "acquisition", "equity offering",
    "atm equity", "equity units", "financing commitment", "cost savings", "synerg",
    "capital returned", "capital deployed", "capital investment", "stock repurchase",
 ]),
 ("Innovation", [
    "r&d", "research and development", "patent", "brevet", "pipeline (drug", "clinical trial",
    "pivotal stud", "irad", "technology investment", "innovation",
 ]),
 ("Adoption", [
    "customer", "client", "subscriber", "subscription", "member", "user", "policyholder",
    "policies in force", "policies", "penetration", "retention", "log-in", "logins", "downloads",
    "active users", "loyalty", "co-brand", "cardholder", "card holder", "enrollment", "adoption",
 ]),
 ("Capacité", [
    "employee", "headcount", "workforce", "plant", "facility", "facilities", "store count",
    "total store", "aircraft", "fleet", "capacity", "production", "manufactur", "network",
    "square feet", "sq ft", "data center", "distribution center", "mro", "warehouse",
    "wifi", "generation capacity", "throughput", "processed",
 ]),
 ("Segments", [
    "segment",
 ]),
]

def classify(short, short_raw, name_fr):
    text = " ".join([short or "", short_raw or "", name_fr or ""]).lower()
    for cat, kws in RULES:
        for kw in kws:
            if kw in text:
                return cat
    return None

report = {}
base = '/Users/yann/spx-app/src/data/v2-pipeline/'
skipped_no_report = []

for tk in TICKERS:
    p = base + tk.lower() + '.json'
    if not os.path.exists(p):
        skipped_no_report.append(tk)
        continue
    d = json.load(open(p))
    kpis = d.get('kpis', [])
    if not kpis:
        skipped_no_report.append(tk)
        continue
    before = sum(1 for k in kpis if k.get('story_category') and k.get('story_category') != 'Marché')
    added = []
    for k in kpis:
        cur = k.get('story_category')
        if cur not in (None, 'Marché'):
            continue
        short = k.get('short', '')
        if short.lower() in GENERIC_SHORTS:
            continue
        cat = classify(short, k.get('_short_raw'), k.get('name_fr'))
        if cat is None:
            continue
        k['story_category'] = cat
        k['is_short_history'] = True
        if not k.get('_source'):
            k['_source'] = 'batch3-retag'
        added.append(short)
    after = sum(1 for k in kpis if k.get('story_category') and k.get('story_category') != 'Marché')
    report[tk] = {'before': before, 'after': after, 'added_count': len(added), 'added_shorts': added}
    with open(p, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)

stes_processed = len(TICKERS) - len(skipped_no_report)
stories_added = sum(v['added_count'] for v in report.values())

print(json.dumps({
    "stes_processed": stes_processed,
    "stories_added": stories_added,
    "skipped_no_report": skipped_no_report
}, ensure_ascii=False))
