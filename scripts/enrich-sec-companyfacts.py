#!/usr/bin/env python3
"""enrich-sec-companyfacts.py — Fill hero_history et KPIs longues séries
via SEC EDGAR companyfacts API (XBRL, gratuit, illimité, 10-15 ans d'historique).

Pour chaque sté US (sans suffixe) ou FPI ADR :
- Fetch https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json
- Extrait les facts annuels (form=10-K) pour les metrics us-gaap clés
- Fill hero_history si hero matches Revenue/Net Income/Op Income/EPS/Assets
- Ajoute nouveaux KPIs si manquants

ETA : ~30 min pour 1000+ stés US (rate limit SEC 10 req/sec).
Coût : GRATUIT.
"""
import json
import os
import re
import sys
import time
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
CIK_INDEX = PROJECT_ROOT / "sec-data/_meta/cat1-cat2-index.json"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", ""))

UA = "Mettrik Data Pipeline contact@mettrik.ai"

# Map ticker hero patterns → us-gaap XBRL concepts (priority list)
HERO_TO_XBRL = {
    "Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet", "Revenues_NB"],
    "Total Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Net Income": ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    "Operating Income": ["OperatingIncomeLoss"],
    "Diluted EPS": ["EarningsPerShareDiluted", "IncomeLossFromContinuingOperationsPerDilutedShare"],
    "EPS": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    "Free Cash Flow": [],  # FCF = OpCF - Capex, computed
    "EBITDA": [],  # not directly in us-gaap
    "Total Assets": ["Assets"],
    "Total Debt": ["LongTermDebt", "DebtCurrent", "LongTermDebtNoncurrent"],
    "Cash & Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "Stockholders Equity": ["StockholdersEquity"],
    "Operating Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "Gross Profit": ["GrossProfit"],
}

# Generic KPIs to add if missing
ADD_KPIS = [
    ("Total Revenue", ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], "Chiffre d'affaires", "Mds $", "Revenue"),
    ("Net Income", ["NetIncomeLoss", "ProfitLoss"], "Résultat net", "Mds $", "Profit"),
    ("Operating Income", ["OperatingIncomeLoss"], "Résultat opérationnel", "Mds $", "Profit"),
    ("Diluted EPS", ["EarningsPerShareDiluted"], "BPA dilué", "$", "EPS"),
    ("Total Assets", ["Assets"], "Total des actifs", "Mds $", "Balance Sheet"),
    ("Stockholders Equity", ["StockholdersEquity"], "Capitaux propres", "Mds $", "Balance Sheet"),
]


def fetch_companyfacts(cik: int):
    padded = f"{cik:010d}"
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
            import gzip, io
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
            return json.loads(data)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except Exception:
        return None


def extract_annual_series(cf: dict, xbrl_keys: list, max_points: int = 10):
    """Extract annual values (form=10-K, period=FY) from companyfacts data.
    Returns list of (fiscal_year, value) sorted by year ascending.
    """
    if not cf or "facts" not in cf:
        return []
    facts = cf["facts"].get("us-gaap", {})
    for key in xbrl_keys:
        if key not in facts:
            continue
        units = facts[key].get("units", {})
        # Prefer USD, then USD/shares for EPS, else first available
        usd_data = units.get("USD") or units.get("USD/shares") or next(iter(units.values()), None)
        if not usd_data:
            continue
        annual = {}  # fp=FY only
        for item in usd_data:
            if item.get("form") not in ("10-K", "10-K/A", "20-F", "20-F/A"):
                continue
            if item.get("fp") != "FY":
                continue
            fy = item.get("fy")
            val = item.get("val")
            if fy is None or val is None:
                continue
            # Keep the latest filing's value per FY
            if fy not in annual or item.get("end", "") > annual[fy].get("end", ""):
                annual[fy] = {"val": val, "end": item.get("end", "")}
        if annual:
            sorted_fy = sorted(annual.keys())[-max_points:]
            return [(fy, annual[fy]["val"]) for fy in sorted_fy]
    return []


def match_hero_to_xbrl(hero_short: str, hero_name: str = ""):
    text = (hero_short + " " + hero_name).lower()
    if any(p in text for p in ["revenue", "sales", "chiffre d.affaire", "total rev"]):
        return HERO_TO_XBRL["Revenue"]
    if any(p in text for p in ["net income", "résultat net", "profit"]):
        return HERO_TO_XBRL["Net Income"]
    if any(p in text for p in ["operating income", "op income", "résultat opérationnel"]):
        return HERO_TO_XBRL["Operating Income"]
    if any(p in text for p in ["eps", "earnings per share", "bpa", "bénéfice par action"]):
        return HERO_TO_XBRL["Diluted EPS"]
    if any(p in text for p in ["total assets", "actifs totaux"]):
        return HERO_TO_XBRL["Total Assets"]
    return []


def main():
    cik_index = json.loads(CIK_INDEX.read_text())
    # Build pending list = US stés in v2-pipeline with CIK + flagged unfit OR want enrichment
    pending = []
    if PENDING_FILE.exists() and PENDING_FILE.stat().st_size > 0:
        pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    else:
        for p in PIPELINE.glob("*.json"):
            if p.stem == "_merged": continue
            tk = p.stem.upper()
            if "." in tk: continue  # skip foreign suffixes (cat3 EU)
            try: d = json.loads(p.read_text())
            except: continue
            if not isinstance(d, dict): continue
            # Skip if already very enriched (hero history >= 4 + 5+ KPIs)
            kpis = d.get("kpis", [])
            hero = d.get("hero_kpi") or ""
            h = next((k for k in kpis if k.get("short")==hero), None)
            if h and len(h.get("history") or []) >= 6 and len(kpis) >= 8:
                continue
            if tk in cik_index:
                pending.append(tk)

    print(f"📊 SEC companyfacts : {len(pending)} stés US à enrichir", flush=True)

    updated_hero = 0
    added_kpis = 0
    no_cik = 0
    no_data = 0
    fails = 0
    last_call = 0.0
    SLEEP = 0.12  # ~8 req/sec, under SEC limit

    for i, tk in enumerate(pending):
        if i and i % 50 == 0:
            print(f"  [{i}/{len(pending)}] hero={updated_hero} kpis={added_kpis} no_cik={no_cik} no_data={no_data} fails={fails}", flush=True)
        elapsed = time.time() - last_call
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)
        last_call = time.time()

        info = cik_index.get(tk)
        if not info or "cik" not in info:
            no_cik += 1
            continue
        cik = info["cik"]
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            no_cik += 1
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue

        cf = fetch_companyfacts(cik)
        if not cf:
            no_data += 1
            continue

        kpis = data.get("kpis") or []
        hero = data.get("hero_kpi") or ""
        h_idx = next((j for j, k in enumerate(kpis) if k.get("short") == hero), None)
        h_kpi = kpis[h_idx] if h_idx is not None else None
        changed = False

        # Fill hero_history if hero matches a standard XBRL metric
        if h_kpi and len(h_kpi.get("history") or []) < 6:
            xbrl_keys = match_hero_to_xbrl(hero, h_kpi.get("name_fr", "") or "")
            if xbrl_keys:
                series = extract_annual_series(cf, xbrl_keys)
                if len(series) >= 4:
                    unit = (h_kpi.get("unit") or "").lower()
                    divisor = 1.0
                    if "md" in unit or "billion" in unit or unit.strip() == "b":
                        divisor = 1e9
                    elif "m " in unit or "million" in unit:
                        divisor = 1e6
                    vals = [round(v / divisor, 3) for _, v in series]
                    kpis[h_idx]["history"] = vals
                    kpis[h_idx]["_hero_history_source"] = "SEC EDGAR companyfacts (XBRL)"
                    kpis[h_idx]["_hero_history_extracted_at"] = datetime.now(timezone.utc).isoformat()
                    kpis[h_idx].pop("_hero_history_unverified", None)
                    kpis[h_idx].pop("_hero_history_unverified_reason", None)
                    # Compute yoy
                    if len(vals) >= 2 and vals[-2] != 0:
                        pct = (vals[-1] - vals[-2]) / abs(vals[-2]) * 100
                        kpis[h_idx]["yoy"] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
                    # Update value
                    kpis[h_idx]["value"] = vals[-1]
                    updated_hero += 1
                    changed = True

        # Add missing KPIs
        if len(kpis) < 8:
            existing_shorts = {k.get("short") for k in kpis}
            for short, xbrl_keys, name_fr, unit, kpi_type in ADD_KPIS:
                if short in existing_shorts:
                    continue
                series = extract_annual_series(cf, xbrl_keys, max_points=8)
                if len(series) < 4:
                    continue
                divisor = 1e9 if "Mds" in unit else (1e6 if "M" in unit else 1.0)
                vals = [round(v / divisor, 3) for _, v in series]
                last = vals[-1]
                prev = vals[-2] if len(vals) >= 2 else None
                yoy = ""
                if prev and prev != 0:
                    pct = (last - prev) / abs(prev) * 100
                    yoy = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
                new_kpi = {
                    "short": short,
                    "name_fr": name_fr,
                    "name_en": short,
                    "value": last,
                    "unit": unit,
                    "yoy": yoy,
                    "history": vals,
                    "type": kpi_type,
                    "nature": "comptable",
                    "comparable": True,
                    "signal": f"{name_fr} de {last} {unit} dernière année fiscale (FY{[fy for fy,_ in series][-1]}).",
                    "description": f"{name_fr} extrait SEC EDGAR companyfacts XBRL sur les {len(vals)} dernières années fiscales déclarées (10-K).",
                    "is_generic": True,
                    "_source": "SEC EDGAR companyfacts XBRL",
                }
                kpis.append(new_kpi)
                added_kpis += 1
                changed = True
                if len(kpis) >= 8:
                    break

        if changed:
            data["kpis"] = kpis
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception:
                fails += 1

    print(f"DONE: hero={updated_hero} kpis_added={added_kpis} no_cik={no_cik} no_data={no_data} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
