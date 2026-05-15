#!/usr/bin/env python3
"""
extract-quarterly-xbrl.py — extraction QUARTERLY 100 % factuelle via XBRL.

Yann 15 mai 2026 — RÈGLE D'OR : aucun LLM, aucune interpolation, aucune
extrapolation. Uniquement les chiffres TAGUÉS par la sté elle-même dans
ses filings SEC EDGAR (companyfacts API XBRL).

Pour chaque KPI mappable à un tag us-gaap standard :
  - fp=Q1/Q2/Q3 + form=10-Q → valeur trimestrielle directe
  - fp=FY  + form=10-K     → valeur annuelle
  - Q4 = FY - (Q1 + Q2 + Q3) si tous les autres trimestres présents

Sortie : src/data/v2-pipeline-enrich/<ticker>.quarterly-history.json
Avec citation par point : {period, value, unit, accession, end_date}.

Mapping KPI → us-gaap tag :
  Total Revenue        → Revenues, RevenueFromContractWithCustomerExcludingAssessedTax
  Net Income           → NetIncomeLoss
  Operating Income     → OperatingIncomeLoss
  Op Margin            → calculé OperatingIncome / Revenue × 100
  EPS / Diluted EPS    → EarningsPerShareDiluted
  Free Cash Flow       → calculé OperatingCashFlow - Capex
  Gross Profit         → GrossProfit
  Gross Margin         → calculé GrossProfit / Revenue × 100
  Total Assets         → Assets
  Stockholders Equity  → StockholdersEquity
  Capex                → PaymentsToAcquirePropertyPlantAndEquipment
  R&D                  → ResearchAndDevelopmentExpense
  Cash & Equivalents   → CashAndCashEquivalentsAtCarryingValue

Les KPIs SEGMENT (ex Google Cloud Revenue, iPhone Revenue) ne sont pas
en us-gaap standard : ils sont en taxonomie company-specific avec
dimension `srt:ProductOrServiceAxis`. Pour ces KPIs on tente :
  - Tag custom <ticker>:<KpiName>Revenue (rare)
  - Sinon SKIP (= pas d'extension, on garde CONV-DATA)

Usage :
  python3 scripts/extract-quarterly-xbrl.py --universe top307 [--limit N] [--workers 4]

ETA ~5 min top 307 (10 req/s SEC limit, ~3 req/sté).
COÛT : 0 € (SEC EDGAR illimité).
"""
import argparse
import gzip
import io
import json
import multiprocessing as mp
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX = ROOT / "sec-data/_meta/cat1-cat2-index.json"
LOG_PATH = ROOT / ".conv-state/quarterly-xbrl.log"
UA = "Mettrik Data Pipeline contact@mettrik.ai"
SEC_BASE = "https://data.sec.gov/api/xbrl/companyfacts"
SLEEP = 0.12  # ~8 req/s, sous limite SEC 10 req/s

# Mapping KPI short/name → tags us-gaap (priorité haute → basse)
KPI_TAGS = {
    # Revenue family
    "Total Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    # Profitability
    "Net Income": ["NetIncomeLoss", "ProfitLoss"],
    "Operating Income": ["OperatingIncomeLoss"],
    "Op Income": ["OperatingIncomeLoss"],
    "Gross Profit": ["GrossProfit"],
    # Margins (calculated)
    "Op Margin": ["__calc__OperatingMargin"],
    "Operating Margin": ["__calc__OperatingMargin"],
    "Gross Margin": ["__calc__GrossMargin"],
    "Net Margin": ["__calc__NetMargin"],
    # EPS
    "Diluted EPS": ["EarningsPerShareDiluted"],
    "EPS": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    # Cash
    "Operating Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Op Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Free Cash Flow": ["__calc__FCF"],
    "FCF": ["__calc__FCF"],
    # Investment
    "Capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "R&D": ["ResearchAndDevelopmentExpense"],
    # Balance sheet
    "Total Assets": ["Assets"],
    "Stockholders Equity": ["StockholdersEquity"],
    "Cash and Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "Cash & Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
}


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def fetch_companyfacts(cik: int):
    padded = f"{cik:010d}"
    url = f"{SEC_BASE}/CIK{padded}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
            return json.loads(data)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        log(f"  HTTP {e.code} on CIK {cik}")
        return None
    except Exception as e:
        log(f"  fetch err CIK {cik}: {e}")
        return None


def get_xbrl_facts(cf: dict, tag: str) -> list[dict]:
    """Retourne tous les facts pour un tag, dans toutes les units."""
    if not cf or "facts" not in cf:
        return []
    facts = cf["facts"].get("us-gaap", {})
    if tag not in facts:
        return []
    out = []
    units = facts[tag].get("units", {})
    # USD prioritaire (montants), puis USD/shares (EPS), puis premier dispo
    for unit_key, items in units.items():
        for it in items:
            it_copy = dict(it)
            it_copy["_unit"] = unit_key
            out.append(it_copy)
    return out


def quarterly_series(cf: dict, tags: list[str], min_year: int = 2020) -> tuple[list[tuple[str, float, str, str, str]], str]:
    """Extrait la série trimestrielle Q1/Q2/Q3 (10-Q) + Q4 calculé (10-K - Q1Q2Q3).

    Returns: (series, unit)
      series = list of (period_label, value, unit, accession, end_date)
      Ordre chronologique ascendant.
    """
    for tag in tags:
        facts = get_xbrl_facts(cf, tag)
        if not facts:
            continue
        # Bucket par fy + fp
        # fp ∈ {"Q1","Q2","Q3","FY"} (sometimes "Q4" but rare)
        by_fy_fp = {}  # (fy, fp) → {"val", "end", "accn", "unit", "form"}
        for it in facts:
            fy = it.get("fy")
            fp = it.get("fp")
            form = it.get("form", "")
            if fy is None or fy < min_year:
                continue
            if fp not in ("Q1", "Q2", "Q3", "Q4", "FY"):
                continue
            if form not in ("10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A", "6-K"):
                continue
            key = (fy, fp)
            cur = by_fy_fp.get(key)
            # Garder le filing le plus récent (par filed/end)
            end_date = it.get("end", "")
            if not cur or end_date > cur.get("end", ""):
                by_fy_fp[key] = {
                    "val": it.get("val"),
                    "end": end_date,
                    "accn": it.get("accn", ""),
                    "unit": it["_unit"],
                    "form": form,
                    "fp": fp,
                }
        if not by_fy_fp:
            continue

        # Construit la série
        unit = next(iter(by_fy_fp.values()))["unit"]
        fys = sorted({fy for fy, fp in by_fy_fp.keys()})
        series = []
        for fy in fys:
            for fp in ("Q1", "Q2", "Q3"):
                if (fy, fp) in by_fy_fp:
                    e = by_fy_fp[(fy, fp)]
                    series.append((f"{fp} {fy}", e["val"], e["unit"], e["accn"], e["end"]))
            # Q4 : soit explicite (rare), soit calculé = FY - (Q1+Q2+Q3) si les 3 dispo
            if (fy, "Q4") in by_fy_fp:
                e = by_fy_fp[(fy, "Q4")]
                series.append((f"Q4 {fy}", e["val"], e["unit"], e["accn"], e["end"]))
            elif (fy, "FY") in by_fy_fp and all((fy, q) in by_fy_fp for q in ("Q1", "Q2", "Q3")):
                fy_val = by_fy_fp[(fy, "FY")]["val"]
                q1 = by_fy_fp[(fy, "Q1")]["val"]
                q2 = by_fy_fp[(fy, "Q2")]["val"]
                q3 = by_fy_fp[(fy, "Q3")]["val"]
                if all(isinstance(x, (int, float)) for x in (fy_val, q1, q2, q3)):
                    q4_val = fy_val - q1 - q2 - q3
                    e = by_fy_fp[(fy, "FY")]
                    # Citation : 10-K (FY) − somme 10-Q (Q1+Q2+Q3)
                    series.append((f"Q4 {fy}", q4_val, e["unit"], f"calc-{e['accn']}", e["end"]))
        if series:
            return series, unit
    return [], ""


def normalize_unit(unit: str, sample_val: float) -> tuple[str, float]:
    """Convertit USD bruts → 'Mds $' si magnitude milliard, 'M $' si million.
    Retourne (display_unit, factor) avec sample_val * factor = display_val."""
    if unit == "USD":
        if abs(sample_val) >= 1e9:
            return "Mds $", 1e-9
        if abs(sample_val) >= 1e6:
            return "M $", 1e-6
        return "$", 1.0
    if unit == "USD/shares":
        return "$", 1.0
    if unit == "shares":
        return "actions", 1.0
    return unit, 1.0


def kpi_lookup_tags(short: str, name_fr: str = "", name_en: str = "") -> list[str]:
    text = f"{short} {name_fr} {name_en}".lower()
    # Match exact short first
    if short in KPI_TAGS:
        return KPI_TAGS[short]
    # Fuzzy text match
    if any(p in text for p in ["total revenue", "chiffre d'affaires", "total rev"]):
        return KPI_TAGS["Total Revenue"]
    if "net income" in text or "résultat net" in text or "bénéfice net" in text:
        return KPI_TAGS["Net Income"]
    if "op income" in text or "operating income" in text or "résultat opérationnel" in text:
        return KPI_TAGS["Operating Income"]
    if "gross profit" in text or "marge brute" in text.replace(" ", "") and "gross" in text:
        return KPI_TAGS["Gross Profit"]
    if "diluted eps" in text or "eps dilué" in text or "bpa dilué" in text:
        return KPI_TAGS["Diluted EPS"]
    if "operating cash flow" in text or "op cash flow" in text or "flux trésorerie opér" in text:
        return KPI_TAGS["Operating Cash Flow"]
    if "free cash flow" in text or "fcf" in text:
        return KPI_TAGS["FCF"]
    if "capex" in text or "capital expenditure" in text or "investissements" in text:
        return KPI_TAGS["Capex"]
    if "r&d" in text or "research and development" in text or "recherche et développement" in text:
        return KPI_TAGS["R&D"]
    if "total assets" in text or "total actifs" in text:
        return KPI_TAGS["Total Assets"]
    if "stockholders equity" in text or "capitaux propres" in text:
        return KPI_TAGS["Stockholders Equity"]
    if "cash & equiv" in text or "cash and equiv" in text or "trésorerie" in text:
        return KPI_TAGS["Cash and Equivalents"]
    return []


def compute_margin(series_num: list, series_den: list) -> list:
    """OperatingIncome / Revenues × 100, aligné par (period_label)."""
    den_by_period = {s[0]: s[1] for s in series_den}
    out = []
    for period, num_val, _, accn, end in series_num:
        den_val = den_by_period.get(period)
        if den_val is None or den_val == 0:
            continue
        pct = (num_val / den_val) * 100
        out.append((period, pct, "%", accn, end))
    return out


def process_ticker(ticker: str, cik: int) -> dict | None:
    """Retourne dict prêt à écrire ou None si rien à extraire."""
    cf = fetch_companyfacts(cik)
    time.sleep(SLEEP)
    if not cf:
        return None

    # Charge le dataset CONV-DATA pour itérer sur les KPIs
    p = PIPELINE / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
    except Exception:
        return None
    kpis = d.get("kpis") or []
    if not isinstance(kpis, list):
        return None

    # Pré-calcul : on aura besoin de Revenue + OpIncome + GrossProfit + OCF + Capex
    rev_series, _ = quarterly_series(cf, KPI_TAGS["Total Revenue"])
    opinc_series, _ = quarterly_series(cf, KPI_TAGS["Operating Income"])
    gp_series, _ = quarterly_series(cf, KPI_TAGS["Gross Profit"])
    ni_series, _ = quarterly_series(cf, KPI_TAGS["Net Income"])
    ocf_series, _ = quarterly_series(cf, KPI_TAGS["Operating Cash Flow"])
    capex_series, _ = quarterly_series(cf, KPI_TAGS["Capex"])

    out_kpis = []
    for k in kpis[:8]:
        short = k.get("short") or ""
        name_fr = k.get("name_fr") or ""
        name_en = k.get("name_en") or ""
        if not short:
            continue
        tags = kpi_lookup_tags(short, name_fr, name_en)
        if not tags:
            continue

        series = []
        unit = ""
        if tags == ["__calc__OperatingMargin"]:
            series = compute_margin(opinc_series, rev_series)
            unit = "%"
        elif tags == ["__calc__GrossMargin"]:
            series = compute_margin(gp_series, rev_series)
            unit = "%"
        elif tags == ["__calc__NetMargin"]:
            series = compute_margin(ni_series, rev_series)
            unit = "%"
        elif tags == ["__calc__FCF"]:
            # FCF = OCF - Capex, aligné par period
            cx = {s[0]: s[1] for s in capex_series}
            for period, ocf_val, ocf_unit, accn, end in ocf_series:
                cap_val = cx.get(period)
                if cap_val is None:
                    continue
                series.append((period, ocf_val - cap_val, ocf_unit, f"calc-{accn}", end))
            unit = "USD"
        else:
            series, unit = quarterly_series(cf, tags)

        if len(series) < 4:
            continue

        # Garde les 20 derniers trimestres max
        series = series[-20:]
        # Normalize unit
        sample_val = series[-1][1] if series else 0
        display_unit, factor = normalize_unit(unit, sample_val)
        history = [round(v * factor, 4) for (_, v, _, _, _) in series]
        periods = [p for (p, _, _, _, _) in series]
        citations = [
            {"period": p, "value": round(v * factor, 4), "accession": accn, "end": end}
            for (p, v, _, accn, end) in series
        ]

        out_kpis.append({
            "short": short,
            "period_type": "quarter",
            "history": history,
            "history_periods": periods,
            "last_data_date": series[-1][4],
            "unit": display_unit,
            "_source": "SEC EDGAR XBRL companyfacts",
            "_tag": tags[0] if not tags[0].startswith("__calc__") else tags[0].replace("__calc__", "calc/"),
            "_citations": citations[-4:],  # dernières 4 pour traçabilité
        })

    if not out_kpis:
        return None
    return {
        "ticker": ticker,
        "extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "method": "xbrl-companyfacts",
        "cik": cik,
        "n_kpis": len(out_kpis),
        "kpis": out_kpis,
    }


def worker(args):
    ticker, cik = args
    try:
        result = process_ticker(ticker, cik)
    except Exception as e:
        return ticker, f"err-{type(e).__name__}"
    if not result:
        return ticker, "no-match"
    ENRICH.mkdir(parents=True, exist_ok=True)
    out = ENRICH / f"{ticker.lower()}.quarterly-history.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    n = result["n_kpis"]
    return ticker, f"ok-{n}kpis"


def load_universe(name: str) -> list[str]:
    if name == "top307":
        f = ROOT / "src/data/v1-8-tickers-sorted.json"
        return json.loads(f.read_text())[:307]
    if name == "sp500":
        f = ROOT / "src/data/v1-7-public.json"
        if not f.exists():
            return []
        data = json.loads(f.read_text())
        if isinstance(data, dict):
            return list(data.keys())
        return [d.get("ticker") for d in data if d.get("ticker")]
    if name == "test":
        return ["GOOGL", "AAPL", "NVDA", "MSFT", "META"]
    raise ValueError(f"unknown universe {name}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--universe", choices=["top307", "sp500", "test"], default="test")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CIK_INDEX.exists():
        log(f"[FATAL] CIK index missing: {CIK_INDEX}")
        sys.exit(1)
    cik_index = json.loads(CIK_INDEX.read_text())

    tickers = load_universe(args.universe)
    if args.limit:
        tickers = tickers[:args.limit]

    work = []
    skipped_no_cik = 0
    for t in tickers:
        upper = t.upper()
        # Skip tickers with dots (foreign listings, often no SEC CIK)
        if "." in upper:
            skipped_no_cik += 1
            continue
        entry = cik_index.get(upper) or cik_index.get(t)
        cik = entry.get("cik") if isinstance(entry, dict) else entry
        if not cik:
            skipped_no_cik += 1
            continue
        work.append((upper, cik))

    log(f"=== START universe={args.universe} workers={args.workers} tickers={len(work)} (skipped {skipped_no_cik} no-CIK) ===")

    counts = {}
    with mp.Pool(args.workers) as pool:
        for tk, status in pool.imap_unordered(worker, work):
            key = status.split("-")[0]
            counts[key] = counts.get(key, 0) + 1
            icon = "✅" if status.startswith("ok") else "⚠"
            log(f"  {icon} {tk:8} → {status}")

    log(f"=== DONE counts={counts} skipped-no-cik={skipped_no_cik} ===")


if __name__ == "__main__":
    main()
