#!/usr/bin/env python3
"""
build_datalake.py — Fondation de la base 5 ans standardisee + verifiable.
Couche 1 (cette etape) = XBRL SEC EDGAR companyfacts : VERBATIM, 0 token, 0
hallucination (donnee balisee par la societe). Ecrit dans:
  - data-lake/mettrik.db  (SQLite, table maitre `facts`)
  - data-lake/<TICKER>/xbrl/facts.json  (verbatim + provenance)
Couches suivantes (table-parse slides/ER/DEF14A + LLM-cite) s'ajoutent
dans la MEME table `facts` avec extracted_by different.
"""
import json, os, subprocess, sqlite3, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LAKE = os.path.join(ROOT, "data-lake")
DB = os.path.join(LAKE, "mettrik.db")

# Registre canonique : tag us-gaap -> (metric_key, bloc). Garantit "rien oublie"
# pour le bloc FINANCIER. Les blocs CA/segments, gouvernance, story = couches
# suivantes (table-parse + llm-cite) mais MEME schema.
REGISTRY = {
  "Revenues": ("revenue", "financier"),
  "RevenueFromContractWithCustomerExcludingAssessedTax": ("revenue", "financier"),
  "NetIncomeLoss": ("net_income", "financier"),
  "OperatingIncomeLoss": ("operating_income", "financier"),
  "GrossProfit": ("gross_profit", "financier"),
  "ResearchAndDevelopmentExpense": ("rd_expense", "financier"),
  "EarningsPerShareDiluted": ("eps_diluted", "financier"),
  "PaymentsToAcquirePropertyPlantAndEquipment": ("capex", "financier"),
  "NetCashProvidedByUsedInOperatingActivities": ("operating_cash_flow", "financier"),
  "Assets": ("total_assets", "financier"),
  "CashAndCashEquivalentsAtCarryingValue": ("cash", "financier"),
  "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost": ("rd_expense", "financier"),
}
CIK = {"META": "0001326801", "GOOGL": "0001652044"}
CUTOFF = "2021-01-01"

def schema(con):
    con.execute("""CREATE TABLE IF NOT EXISTS facts(
      ticker TEXT, metric_key TEXT, bloc TEXT, period_type TEXT, period_end TEXT,
      value REAL, unit TEXT, currency TEXT, source_doc TEXT, source_ref TEXT,
      extracted_by TEXT, citation TEXT, fiscal_period TEXT,
      UNIQUE(ticker, metric_key, period_type, period_end, source_ref))""")
    con.commit()

def fetch_companyfacts(cik):
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    out = subprocess.run(["/usr/bin/curl","-s","-A","Mettrik research contact@mettrik.ai",url],
                         capture_output=True, text=True, timeout=60)
    try: return json.loads(out.stdout)
    except: return None

def period_type(start, end):
    if not start: return "instant"
    try:
        d = (datetime.date.fromisoformat(end) - datetime.date.fromisoformat(start)).days
    except: return "?"
    if 80 <= d <= 100: return "quarter"
    if 350 <= d <= 380: return "year"
    if 170 <= d <= 195: return "semester"
    return "ytd"

def extract(ticker, cik, con):
    cf = fetch_companyfacts(cik)
    if not cf: return 0, []
    facts_out = []
    usgaap = cf.get("facts", {}).get("us-gaap", {})
    for tag, (mkey, bloc) in REGISTRY.items():
        node = usgaap.get(tag)
        if not node: continue
        for unit, arr in node.get("units", {}).items():
            cur = unit if unit in ("USD",) else unit
            for e in arr:
                end = e.get("end"); 
                if not end or end < CUTOFF: continue
                if e.get("form") not in ("10-K","10-Q","20-F","40-F"): continue
                pt = period_type(e.get("start"), end)
                if pt not in ("quarter","year","instant"): continue
                rec = (ticker, mkey, bloc, pt, end, float(e["val"]),
                       unit if "/" not in unit else unit, "USD" if unit=="USD" else unit,
                       e.get("form"), f"accn:{e.get('accn')}",
                       "xbrl", f"us-gaap:{tag} {e.get('fy')}{e.get('fp')}",
                       f"{e.get('fy')}{e.get('fp')}")
                facts_out.append(rec)
    # dedup + insert
    seen=set(); clean=[]
    for r in facts_out:
        k=(r[0],r[1],r[3],r[4]); 
        if k in seen: continue
        seen.add(k); clean.append(r)
    con.executemany("""INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", clean)
    con.commit()
    os.makedirs(os.path.join(LAKE, ticker, "xbrl"), exist_ok=True)
    json.dump([{"metric":r[1],"bloc":r[2],"period_type":r[3],"period_end":r[4],
                "value":r[5],"unit":r[6],"source":r[8],"ref":r[9],"by":r[10]} for r in clean],
              open(os.path.join(LAKE,ticker,"xbrl","facts.json"),"w"), indent=1)
    metrics = sorted(set(r[1] for r in clean))
    return len(clean), metrics

os.makedirs(LAKE, exist_ok=True)
con = sqlite3.connect(DB); schema(con)
for tk, cik in CIK.items():
    n, metrics = extract(tk, cik, con)
    print(f"{tk}: {n} facts XBRL verbatim | metriques: {metrics}")
# resume couverture
cur = con.execute("SELECT ticker, metric_key, period_type, COUNT(*), MIN(period_end), MAX(period_end) FROM facts GROUP BY ticker, metric_key, period_type ORDER BY ticker, metric_key")
print("\n=== couverture (ticker | metric | type | n | min | max) ===")
for row in cur.fetchall(): print("  ", row)
con.close()
