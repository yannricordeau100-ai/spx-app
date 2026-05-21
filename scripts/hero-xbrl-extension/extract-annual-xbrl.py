#!/usr/bin/env python3
"""extract-annual-xbrl.py — Annual hero KPI history extension via SEC EDGAR XBRL.

Mission sub-agent #85 — for the 49+ US stés where hero_kpi has period_type=year/annual
but history.length < 5 (audit a_hero_history KO).

Pulls annual values (form=10-K, fp=FY) from companyfacts XBRL for the hero KPI's
matching us-gaap tag. Writes the result as `_hero_history_extension` inside
`src/data/v2-pipeline-enrich/<ticker>.json` (merge format already understood by
SSR load-company.ts).

Output schema (top-level field inside the enrich file):
  "_hero_history_extension": {
    "hero_kpi_short": "...",
    "period_type": "annual",
    "history": [v1, v2, ...],   # at least 5 points
    "_source": "SEC EDGAR XBRL companyfacts",
    "_extracted_at": "ISO-8601",
    "_tag": "us-gaap:Revenues",
    "_citations": [{"fy": 2020, "value": ..., "accession": "...", "end": "..."}, ...]
  }

The script is idempotent: re-runs only overwrite if --force or if the existing
extension has fewer points.

Usage:
  python3 scripts/hero-xbrl-extension/extract-annual-xbrl.py \
    --tickers-file /tmp/hero-us-annual-targets.txt --workers 4 [--force]

Coût : 0 € (SEC EDGAR companyfacts illimité, sleep 0.12s pour rester sous 10 req/s).
"""
import argparse
import gzip
import io
import json
import multiprocessing as mp
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
COMPLETE = ROOT / "src/data/v1-9-complete"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX = ROOT / "sec-data/_meta/cat1-cat2-index.json"
LOG_PATH = ROOT / ".conv-state/hero-annual-xbrl.log"
UA = "Mettrik AI yannricordeau100@gmail.com"
SEC_BASE = "https://data.sec.gov/api/xbrl/companyfacts"
SLEEP = 0.12  # ~8 req/s, sous limite SEC 10 req/s

# Reuse mapping from extract-quarterly-xbrl.py
KPI_TAGS = {
    "Total Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Net Income": ["NetIncomeLoss", "ProfitLoss"],
    "Net Income (Loss)": ["NetIncomeLoss", "ProfitLoss"],
    "Operating Income": ["OperatingIncomeLoss"],
    "Op Income": ["OperatingIncomeLoss"],
    "Gross Profit": ["GrossProfit"],
    "Diluted EPS": ["EarningsPerShareDiluted"],
    "EPS": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    "Operating Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Op Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "R&D": ["ResearchAndDevelopmentExpense"],
    "Total Assets": ["Assets"],
    "Stockholders Equity": ["StockholdersEquity"],
    "Cash and Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "Cash & Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "Dividends Per Share": ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
    "DPS": ["CommonStockDividendsPerShareDeclared"],
}

# Calc tags
CALC_OP_MARGIN = "__calc__OperatingMargin"
CALC_GROSS_MARGIN = "__calc__GrossMargin"
CALC_NET_MARGIN = "__calc__NetMargin"
CALC_FCF = "__calc__FCF"

KPI_TAGS.update({
    "Op Margin": [CALC_OP_MARGIN],
    "Operating Margin": [CALC_OP_MARGIN],
    "Gross Margin": [CALC_GROSS_MARGIN],
    "Net Margin": [CALC_NET_MARGIN],
    "Free Cash Flow": [CALC_FCF],
    "FCF": [CALC_FCF],
})


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
    if not cf or "facts" not in cf:
        return []
    facts = cf["facts"].get("us-gaap", {})
    if tag not in facts:
        return []
    out = []
    units = facts[tag].get("units", {})
    for unit_key, items in units.items():
        for it in items:
            it_copy = dict(it)
            it_copy["_unit"] = unit_key
            out.append(it_copy)
    return out


def annual_series(cf: dict, tags: list[str], min_year: int = 2017) -> tuple[list[tuple[int, float, str, str, str]], str]:
    """Extrait la série annuelle FY (form=10-K) sur ≥5 ans.

    Returns: (series, unit)
      series = list of (fy, val, unit, accession, end_date)
      Ordre chronologique ascendant.
    """
    for tag in tags:
        facts = get_xbrl_facts(cf, tag)
        if not facts:
            continue
        by_fy = {}
        for it in facts:
            fy = it.get("fy")
            fp = it.get("fp")
            form = it.get("form", "")
            if fy is None or fy < min_year:
                continue
            if fp != "FY":
                continue
            if form not in ("10-K", "10-K/A", "20-F", "20-F/A"):
                continue
            end_date = it.get("end", "")
            cur = by_fy.get(fy)
            if not cur or end_date > cur.get("end", ""):
                by_fy[fy] = {
                    "val": it.get("val"),
                    "end": end_date,
                    "accn": it.get("accn", ""),
                    "unit": it["_unit"],
                }
        if not by_fy:
            continue
        unit = next(iter(by_fy.values()))["unit"]
        series = []
        for fy in sorted(by_fy.keys()):
            e = by_fy[fy]
            series.append((fy, e["val"], e["unit"], e["accn"], e["end"]))
        if series:
            return series, unit
    return [], ""


def normalize_unit(unit: str, sample_val: float) -> tuple[str, float]:
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
    if short in KPI_TAGS:
        return KPI_TAGS[short]
    if any(p in text for p in ["total revenue", "chiffre d'affaires", "total rev"]):
        return KPI_TAGS["Total Revenue"]
    if "net income" in text or "résultat net" in text or "bénéfice net" in text:
        return KPI_TAGS["Net Income"]
    if "op income" in text or "operating income" in text or "résultat opérationnel" in text:
        return KPI_TAGS["Operating Income"]
    if "gross profit" in text or "marge brute" in text:
        return KPI_TAGS["Gross Profit"]
    if "diluted eps" in text or "eps dilué" in text or "bpa dilué" in text:
        return KPI_TAGS["Diluted EPS"]
    if "operating cash flow" in text or "op cash flow" in text:
        return KPI_TAGS["Operating Cash Flow"]
    if "free cash flow" in text or " fcf" in text or text.startswith("fcf"):
        return KPI_TAGS["FCF"]
    if "capex" in text or "capital expenditure" in text:
        return KPI_TAGS["Capex"]
    if "r&d" in text or "research and development" in text:
        return KPI_TAGS["R&D"]
    if "total assets" in text or "total actifs" in text:
        return KPI_TAGS["Total Assets"]
    if "stockholders equity" in text or "capitaux propres" in text:
        return KPI_TAGS["Stockholders Equity"]
    if "cash & equiv" in text or "cash and equiv" in text:
        return KPI_TAGS["Cash and Equivalents"]
    if "dividend" in text and ("per share" in text or "/share" in text):
        return KPI_TAGS["Dividends Per Share"]
    return []


def compute_margin_annual(series_num: list, series_den: list) -> list:
    den_by_fy = {s[0]: s[1] for s in series_den}
    out = []
    for fy, num_val, _, accn, end in series_num:
        den_val = den_by_fy.get(fy)
        if den_val is None or den_val == 0:
            continue
        pct = (num_val / den_val) * 100
        out.append((fy, pct, "%", accn, end))
    return out


def load_hero_info(ticker: str) -> tuple[str, str, str]:
    """Return (hero_short, hero_name_fr, hero_name_en) for the given ticker.

    Looks first in v1-9-complete (audit-canonical merged), then v2-pipeline.
    """
    candidates = [
        COMPLETE / f"{ticker}.json",
        PIPELINE / f"{ticker.lower()}.json",
        PIPELINE / f"{ticker}.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        try:
            d = json.loads(path.read_text())
        except Exception:
            continue
        hero_short = d.get("hero_kpi") or ""
        if not hero_short:
            continue
        kpis = d.get("kpis") or []
        hero_kpi = next(
            (k for k in kpis if isinstance(k, dict) and k.get("short") == hero_short),
            None,
        )
        if hero_kpi:
            return (
                hero_short,
                hero_kpi.get("name_fr") or "",
                hero_kpi.get("name_en") or "",
            )
        return (hero_short, "", "")
    return ("", "", "")


def process_ticker(ticker: str, cik: int, force: bool) -> tuple[str, str]:
    hero_short, name_fr, name_en = load_hero_info(ticker)
    if not hero_short:
        return ticker, "no-hero"

    tags = kpi_lookup_tags(hero_short, name_fr, name_en)
    if not tags:
        return ticker, "no-tag-mapping"

    enrich_path = ENRICH / f"{ticker.lower()}.json"
    if enrich_path.exists():
        try:
            current_enrich = json.loads(enrich_path.read_text())
        except Exception:
            current_enrich = {}
    else:
        current_enrich = {"ticker": ticker}

    existing = current_enrich.get("_hero_history_extension") or {}
    if (
        not force
        and isinstance(existing, dict)
        and isinstance(existing.get("history"), list)
        and len(existing["history"]) >= 5
        and existing.get("hero_kpi_short") == hero_short
    ):
        return ticker, "skip-already"

    cf = fetch_companyfacts(cik)
    time.sleep(SLEEP)
    if not cf:
        return ticker, "no-companyfacts"

    if tags == [CALC_OP_MARGIN]:
        s_num, _ = annual_series(cf, KPI_TAGS["Operating Income"])
        s_den, _ = annual_series(cf, KPI_TAGS["Total Revenue"])
        series = compute_margin_annual(s_num, s_den)
        unit_raw = "%"
    elif tags == [CALC_GROSS_MARGIN]:
        s_num, _ = annual_series(cf, KPI_TAGS["Gross Profit"])
        s_den, _ = annual_series(cf, KPI_TAGS["Total Revenue"])
        series = compute_margin_annual(s_num, s_den)
        unit_raw = "%"
    elif tags == [CALC_NET_MARGIN]:
        s_num, _ = annual_series(cf, KPI_TAGS["Net Income"])
        s_den, _ = annual_series(cf, KPI_TAGS["Total Revenue"])
        series = compute_margin_annual(s_num, s_den)
        unit_raw = "%"
    elif tags == [CALC_FCF]:
        s_ocf, _ = annual_series(cf, KPI_TAGS["Operating Cash Flow"])
        s_cx, _ = annual_series(cf, KPI_TAGS["Capex"])
        cx_by_fy = {s[0]: s[1] for s in s_cx}
        series = []
        for fy, ocf_val, ocf_unit, accn, end in s_ocf:
            cap_val = cx_by_fy.get(fy)
            if cap_val is None:
                continue
            series.append((fy, ocf_val - cap_val, ocf_unit, f"calc-{accn}", end))
        unit_raw = "USD"
    else:
        series, unit_raw = annual_series(cf, tags)

    if len(series) < 5:
        return ticker, f"insufficient-{len(series)}"

    # Keep last 8 fiscal years max
    series = series[-8:]
    sample_val = series[-1][1] if series else 0
    display_unit, factor = normalize_unit(unit_raw, sample_val)
    history_vals = [round(v * factor, 4) for (_, v, _, _, _) in series]
    citations = [
        {"fy": fy, "value": round(v * factor, 4), "accession": accn, "end": end}
        for (fy, v, _, accn, end) in series
    ]

    extension = {
        "hero_kpi_short": hero_short,
        "period_type": "annual",
        "history": history_vals,
        "unit": display_unit,
        "last_data_date": series[-1][4],
        "_source": "SEC EDGAR XBRL companyfacts",
        "_tag": tags[0] if not tags[0].startswith("__calc__") else tags[0].replace("__calc__", "calc/"),
        "_extracted_by": "sub-agent-85 hero-xbrl-extension",
        "_extracted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "_citations": citations,
    }

    current_enrich["_hero_history_extension"] = extension

    ENRICH.mkdir(parents=True, exist_ok=True)
    enrich_path.write_text(json.dumps(current_enrich, ensure_ascii=False, indent=2))
    return ticker, f"ok-{len(history_vals)}pts"


def worker(args):
    ticker, cik, force = args
    try:
        return process_ticker(ticker, cik, force)
    except Exception as e:
        return ticker, f"err-{type(e).__name__}"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers-file", type=str, required=True)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--force", action="store_true")
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CIK_INDEX.exists():
        log(f"[FATAL] CIK index missing: {CIK_INDEX}")
        sys.exit(1)
    cik_index = json.loads(CIK_INDEX.read_text())

    tf = Path(args.tickers_file)
    if not tf.exists():
        log(f"[FATAL] tickers file missing: {tf}")
        sys.exit(1)
    tickers = [ln.strip() for ln in tf.read_text().splitlines() if ln.strip()]

    work = []
    skipped = 0
    for t in tickers:
        upper = t.upper()
        if "." in upper:
            skipped += 1
            continue
        entry = cik_index.get(upper) or cik_index.get(t)
        cik = entry.get("cik") if isinstance(entry, dict) else entry
        if not cik:
            skipped += 1
            continue
        work.append((upper, cik, args.force))

    log(f"=== START annual-xbrl workers={args.workers} tickers={len(work)} (skipped {skipped} no-CIK) ===")
    counts = {}
    with mp.Pool(args.workers) as pool:
        for tk, status in pool.imap_unordered(worker, work):
            key = status.split("-")[0]
            counts[key] = counts.get(key, 0) + 1
            icon = "✅" if status.startswith("ok") else "⚠"
            log(f"  {icon} {tk:8} → {status}")
    log(f"=== DONE counts={counts} skipped-no-cik={skipped} ===")


if __name__ == "__main__":
    main()
