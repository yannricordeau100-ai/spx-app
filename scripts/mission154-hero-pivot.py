#!/usr/bin/env python3
"""
Mission #154 — Pivot XBRL hero a_hero_history pour 94 stés US KO.

Workflow :
- Pour chaque ticker dans /tmp/mission154-tickers.txt :
  1. Lookup CIK via /tmp/company_tickers.json
  2. Fetch SEC companyfacts CIK<10digits>.json
  3. Extract Revenue history annuel (≥5 ans) via concepts us-gaap standard
  4. Write overrides_hero_kpi dans src/data/v2-pipeline-enrich/<lower>.json
     (merge si fichier existant, sans toucher autres champs)
- Throttle 110ms (SEC limit 10 req/s)
- 0 LLM, 0 Cerebras, 0 hallucination
"""
from __future__ import annotations
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

REPO_ROOT = Path(__file__).resolve().parent.parent
ENRICH_DIR = REPO_ROOT / "src" / "data" / "v2-pipeline-enrich"
COMPLETE_DIR = REPO_ROOT / "src" / "data" / "v1-9-complete"
TICKERS_FILE = Path("/tmp/mission154-tickers.txt")
CIK_MAP_FILE = Path("/tmp/company_tickers.json")
REPORT_FILE = REPO_ROOT / "scripts" / "mission154-report.json"

USER_AGENT = "Mettrik AI yannricordeau100@gmail.com"
THROTTLE_SEC = 0.12

# Manual ticker → CIK overrides for foreign issuers (FPI) or aliases
# CIK 10-digit zero-padded
MANUAL_CIK = {
    "ASML": "0000937966",  # ASML Holding NV (foreign filer)
    "BUD": "0001668717",  # AB InBev
    "MUFG": None,  # Mitsubishi UFJ — pas de 10-K SEC (6-K only), skip
    "TD": "0000947263",  # Toronto-Dominion Bank (40-F)
    "SHOP": "0001594805",  # Shopify Inc (Canadian, 40-F)
}

# Stés où Revenue XBRL n'est pas un pivot sémantiquement correct
# (banques avec NII, REITs avec FFO, insurance avec premiums, holdings cryptés).
# On skip ces stés pour préserver le hero specific original.
SKIP_PIVOT = {
    "ARE",   # REIT — XBRL Revenue n'est pas le hero pertinent (FFO/Properties)
    "CFG",   # Bank — Net Interest Income (déjà spécifique, pas Revenue total)
    "CPT",   # REIT
    "HUBB",  # KPI shorts en français, pas mappable
    "KEY",   # Bank — Book Value-centric hero
    "LITE",  # Shorts cryptiques (C&N_REV, IND_REV) — pas safe à mapper
    "TD",    # Bank canadienne — NIM, CET1
    "TRV",   # Insurance — Net Investment Income, Combined Ratio
    "UNM",   # Insurance — Premium Income
}

# Mapping explicite ticker → target_short (KPI existant dans v1-9-complete)
# pour les stés où aucun "Revenue / Net Sales" générique n'apparaît dans les shorts.
# Source : audit manuel des shorts disponibles dans v1-9-complete/<T>.json.
TARGET_SHORT_OVERRIDE = {
    "ASML": "Total Net Sales",
    "BEN": "Operating revenues",
    "COF": "Total net revenue",
    "CPAY": "Revenues, net",
    "HRL": "Net Sales",
    "KHC": "Net Sales",
    "LH": "Dx Revenues",  # closest revenue concept on LabCorp
    "MSFT": "Microsoft Cloud",  # hero original — XBRL Revenue total reste compatible
    "PCAR": "Total Revenues",
    "PPL": "Operating Revenues",
    "SBUX": "Net Revenues",
    "TJX": "Net Sales",
    "TSCO": "Net Sales",
    "WSM": "Net Revenues",
    "YUM": "System Sales",
}

# Stés à skip parce qu'aucun KPI existant ne représente Revenue total proprement
# (banques, conglomérats segmentés sans Net Revenue total visible, brand niche)
SKIP_NO_TARGET = {
    "BUD",   # Revenue per hl / Megabrand Revenue — pas de short "Total Revenue"
    "C",     # Banque — Services/Markets/Wealth Revenue segmentés, NII séparé
    "DVA",   # Dialysis — uniquement "Revenue Per Treatment", pas total
    "GRMN",  # Hero = unités produites, Revenue total absent (Segment Revenues only)
    "ICE",   # Exchanges/FixedIncome/Mortgage Revenues, no aggregate "Total Revenue"
    "MAR",   # RevPAR/Rooms hero, only "Fee Revenue" partial
    "RL",    # Regional revenues only (NA/Europe/Asia)
    "SLB",   # Digital/Reservoir/Well/Production segments only
    "T",     # AT&T : Mobility/Consumer/Business segments, no Total Revenue
    "UNH",   # UnitedHealthcare/Optum segments
}

# Revenue concept candidates ordered by preference
REVENUE_CONCEPTS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "Revenue",  # IFRS fallback
]

# NII (Net Interest Income) for banks where Revenue not applicable
NII_CONCEPTS = [
    "InterestIncomeExpenseNet",
]


def load_cik_map() -> dict[str, str]:
    """Returns dict ticker (upper) -> CIK 10-digit padded."""
    data = json.load(open(CIK_MAP_FILE))
    out = {}
    for entry in data.values():
        tk = entry.get("ticker", "").upper()
        cik = entry.get("cik_str")
        if tk and cik is not None:
            out[tk] = str(cik).zfill(10)
    return out


def fetch_companyfacts(cik: str) -> dict | None:
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            data = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                import gzip
                data = gzip.decompress(data)
            return json.loads(data)
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: CIK{cik}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERROR fetching CIK{cik}: {e}", file=sys.stderr)
        return None


def get_concept_series(facts: dict, concept: str) -> list[dict]:
    for tax in ("us-gaap", "ifrs-full"):
        tax_facts = facts.get("facts", {}).get(tax, {})
        if concept not in tax_facts:
            continue
        units = tax_facts[concept].get("units", {})
        for unit_key in ("USD", "CAD", "EUR", "GBP"):
            if unit_key in units:
                return [
                    {**item, "_currency": unit_key, "_taxonomy": tax}
                    for item in units[unit_key]
                ]
    return []


def filter_annual_fy(series: list[dict]) -> list[dict]:
    out = []
    for item in series:
        fp = item.get("fp")
        form = item.get("form")
        if fp == "FY" and form in ("10-K", "10-K/A", "40-F", "40-F/A", "20-F", "20-F/A"):
            out.append(item)
    return out


def dedupe_by_fy(items: list[dict]) -> list[dict]:
    by_fy: dict[int, dict] = {}
    for item in items:
        fy = item.get("fy")
        if fy is None:
            continue
        cur = by_fy.get(fy)
        if cur is None or item.get("end", "") > cur.get("end", ""):
            by_fy[fy] = item
    return sorted(by_fy.values(), key=lambda x: x["fy"])


def extract_revenue_history(facts: dict) -> tuple[str, list[dict]]:
    """Returns (concept_used, history list) — concepts chained to maximize coverage."""
    all_annual: dict[int, dict] = {}
    used_concepts: list[str] = []
    for concept in REVENUE_CONCEPTS:
        series = get_concept_series(facts, concept)
        annual = dedupe_by_fy(filter_annual_fy(series))
        added = False
        for item in annual:
            fy = item["fy"]
            if fy not in all_annual:
                all_annual[fy] = {**item, "_concept": concept}
                added = True
        if added and concept not in used_concepts:
            used_concepts.append(concept)
    if not all_annual:
        return "", []
    merged = sorted(all_annual.values(), key=lambda x: x["fy"])
    label = "+".join(used_concepts) if len(used_concepts) > 1 else used_concepts[0]
    return label, merged


def determine_unit_and_scale(value: float, currency: str = "USD") -> tuple[str, float]:
    sym_map = {"USD": "$", "CAD": "CAD", "EUR": "€", "GBP": "£"}
    sym = sym_map.get(currency, currency)
    abs_val = abs(value)
    if abs_val >= 1e9:
        return f"Mds {sym}", 1e9
    if abs_val >= 1e6:
        return f"M {sym}", 1e6
    return sym, 1.0


def load_existing_enrich(ticker_lower: str) -> dict:
    path = ENRICH_DIR / f"{ticker_lower}.json"
    if path.exists():
        try:
            return json.load(open(path))
        except Exception:
            return {}
    return {}


def load_complete_hero(ticker: str) -> dict | None:
    path = COMPLETE_DIR / f"{ticker}.json"
    if not path.exists():
        return None
    try:
        data = json.load(open(path))
        hero_short = data.get("hero_kpi")
        if not hero_short:
            return None
        for k in data.get("kpis", []):
            if k.get("short") == hero_short:
                return {
                    "original_short": hero_short,
                    "original_label_fr": k.get("name_fr"),
                    "original_label_en": k.get("name_en"),
                }
        return {"original_short": hero_short}
    except Exception:
        return None


def load_complete_kpi_shorts(ticker: str) -> list[str]:
    path = COMPLETE_DIR / f"{ticker}.json"
    if not path.exists():
        return []
    try:
        data = json.load(open(path))
        return [k.get("short", "") for k in data.get("kpis", []) if isinstance(k, dict)]
    except Exception:
        return []


def _word_boundary_fuzzy(kpi_short: str, target: str) -> bool:
    """Mirror de la logique fuzzy de audit-v1-9-pre-publication.js (ligne 539-549)."""
    import re
    lo = kpi_short.lower()
    tlo = target.lower()
    if not lo or not tlo:
        return False
    if lo == tlo:
        return True
    esc_t = re.escape(tlo)
    if re.search(rf"(^|[^a-z]){esc_t}([^a-z]|$)", lo):
        return True
    if len(lo) >= 4:
        esc_lo = re.escape(lo)
        if re.search(rf"(^|[^a-z]){esc_lo}([^a-z]|$)", tlo):
            return True
    return False


def pick_target_short(ticker: str, target_candidates: list[str] | None = None) -> str | None:
    """Choisit un short KPI existant qui représente le Revenue TOTAL de la sté.

    On veut un short générique (Total Revenue, Revenue, Net Sales) PAS un short
    segmenté (Mobility Revenue, Optum Revenue, B2B Revenue) — sinon l'history
    XBRL Revenue ne correspond pas sémantiquement.

    Ordre :
    1. TARGET_SHORT_OVERRIDE explicite si présent.
    2. Match strict (lowercase exact ou exact substring sans ambiguïté) sur
       liste de termes "totaux" : Total Revenue(s), Revenue, Net Sales,
       Total Net Sales, Operating Revenues, System Sales.
    3. None si rien de strict → le caller skip pour éviter d'écraser un KPI
       segmenté avec une history Revenue total.
    """
    if ticker in TARGET_SHORT_OVERRIDE:
        return TARGET_SHORT_OVERRIDE[ticker]
    shorts = load_complete_kpi_shorts(ticker)
    if not shorts:
        return None

    # Ordre canonical des shorts généralistes acceptables pour pivot Revenue total
    canonical_targets = target_candidates or [
        "total revenue",
        "total revenues",
        "revenue",
        "revenues",
        "total net sales",
        "net sales",
        "operating revenues",
        "operating revenue",
        "sales",
        "system sales",
    ]

    shorts_lower = [(s, s.lower()) for s in shorts]

    # Pass 1 : match exact (case insensitive) sur un canonical short total
    for target_lc in canonical_targets:
        for orig, lc in shorts_lower:
            if lc == target_lc:
                return orig

    # Pass 2 : aucun match exact générique → ne pas accepter un short segmenté
    # (sinon on pollue le KPI avec une history Revenue total qui n'a pas le
    #  même périmètre).
    return None


def build_history_extension(target_short: str, concept: str, history: list[dict]) -> dict:
    """Format `_hero_history_extension` que l'audit-v1-9 reconnaît (cf ligne 531+).

    Le hero_kpi_short doit matcher fuzzy un KPI existant dans v1-9-complete.
    """
    last_val = history[-1]["val"]
    currency = history[-1].get("_currency", "USD")
    unit, divisor = determine_unit_and_scale(last_val, currency)

    history_values = [round(item["val"] / divisor, 4) for item in history]
    period_labels = [
        f"FY{str(item.get('fy', ''))[-2:]}" if item.get("fy") is not None else ""
        for item in history
    ]
    accns = []
    for item in history:
        accn = item.get("accn")
        if accn and accn not in accns:
            accns.append(accn)

    return {
        "hero_kpi_short": target_short,
        "history": history_values,
        "period_labels": period_labels,
        "unit": unit,
        "period_type": "annual",
        "last_data_date": history[-1].get("end", ""),
        "_source_concepts": [concept],
        "_xbrl_accessions_sample": accns[:3],
        "extractor": "Mission #154 pivot XBRL hero (a_hero_history 98 US)",
        "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def build_override(ticker: str, concept: str, history: list[dict]) -> dict:
    last = history[-1]
    last_val = last["val"]
    currency = last.get("_currency", "USD")
    unit, divisor = determine_unit_and_scale(last_val, currency)

    history_out = []
    accns_seen: set[str] = set()
    accns_sample: list[str] = []
    for item in history:
        val_raw = item["val"]
        accn = item.get("accn", "")
        if accn and accn not in accns_seen:
            accns_seen.add(accn)
            if len(accns_sample) < 3:
                accns_sample.append(accn)
        history_out.append({
            "year": item.get("fy"),
            "value": round(val_raw / divisor, 4),
            "value_raw": val_raw,
            "unit": unit,
            "period_end": item.get("end", ""),
            "form": item.get("form", "10-K"),
            "accession_number": accn,
            "concept": item.get("_concept", concept),
        })

    history_values = [round(item["val"] / divisor, 4) for item in history]
    period_labels = [f"FY{str(item.get('fy', ''))[-2:]}" for item in history]

    last_year = history[-1].get("fy")
    last_end = history[-1].get("end", "")

    return {
        "label": "Revenue",
        "label_fr": "Chiffre d'affaires",
        "label_en": "Revenue",
        "value": round(last_val / divisor, 4),
        "value_raw": last_val,
        "unit": unit,
        "year": last_year,
        "periodicity": "annual",
        "history": history_values,
        "period_labels": period_labels,
        "last_data_date": last_end,
        "history_detailed": history_out,
        "source": {
            "type": "xbrl_companyfacts_pivot_154",
            "concept": concept,
            "accession_number": history[-1].get("accn", ""),
            "form": history[-1].get("form", "10-K"),
            "currency": currency,
            "url": "https://data.sec.gov/api/xbrl/companyfacts/",
        },
        "rationale_pivot": (
            "Original hero KPI trop spécifique (segment / produit / metric niche) sans 5+ ans "
            "d'historique fiable. Pivot vers Revenue total annuel XBRL SEC EDGAR pour assurer "
            "couverture ≥5 ans et comparabilité."
        ),
        "extractor": "Mission #154 pivot XBRL hero",
        "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def write_enrich(ticker: str, override: dict, extension: dict) -> Path:
    lower = ticker.lower()
    path = ENRICH_DIR / f"{lower}.json"
    existing = load_existing_enrich(lower)
    existing["overrides_hero_kpi"] = override
    existing["_hero_history_extension"] = extension
    ENRICH_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def main():
    tickers = [t.strip() for t in TICKERS_FILE.read_text().splitlines() if t.strip()]
    print(f"Loaded {len(tickers)} tickers from {TICKERS_FILE}", file=sys.stderr)

    cik_map = load_cik_map()
    print(f"Loaded {len(cik_map)} ticker→CIK pairs", file=sys.stderr)

    report = {
        "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tickers_total": len(tickers),
        "ok": [],
        "skipped_no_cik": [],
        "skipped_no_data": [],
        "skipped_short_history": [],
        "skipped_semantic": [],  # banks/REITs/insurance where Revenue pivot inadequate
        "skipped_no_target_short": [],  # no fuzzy match for hero_kpi_short
        "errors": [],
    }

    for idx, ticker in enumerate(tickers, 1):
        if ticker in SKIP_PIVOT:
            print(f"[{idx}/{len(tickers)}] {ticker}: skip (semantic mismatch)", file=sys.stderr)
            report["skipped_semantic"].append({"ticker": ticker})
            continue
        if ticker in SKIP_NO_TARGET:
            print(f"[{idx}/{len(tickers)}] {ticker}: skip (no aggregate Revenue KPI present)", file=sys.stderr)
            report["skipped_no_target_short"].append({"ticker": ticker, "reason": "manual_skip_no_aggregate"})
            continue

        original_hero = load_complete_hero(ticker)
        cik = MANUAL_CIK.get(ticker) if ticker in MANUAL_CIK else cik_map.get(ticker)
        if cik is None:
            if ticker in MANUAL_CIK:
                print(f"[{idx}/{len(tickers)}] {ticker}: skip (manual=None)", file=sys.stderr)
                report["skipped_no_cik"].append({"ticker": ticker, "reason": "manual_skip"})
            else:
                print(f"[{idx}/{len(tickers)}] {ticker}: no CIK found", file=sys.stderr)
                report["skipped_no_cik"].append({"ticker": ticker, "reason": "not_in_sec_map"})
            continue

        print(f"[{idx}/{len(tickers)}] {ticker} CIK={cik}…", file=sys.stderr)
        facts = fetch_companyfacts(cik)
        time.sleep(THROTTLE_SEC)
        if facts is None:
            report["errors"].append({"ticker": ticker, "cik": cik, "reason": "fetch_failed"})
            continue

        concept, history = extract_revenue_history(facts)
        if not history:
            print(f"  no Revenue concept matched", file=sys.stderr)
            report["skipped_no_data"].append({"ticker": ticker, "cik": cik})
            continue

        if len(history) < 5:
            print(f"  short history ({len(history)} years)", file=sys.stderr)
            report["skipped_short_history"].append({
                "ticker": ticker,
                "cik": cik,
                "years": len(history),
            })
            continue

        target_short = pick_target_short(ticker)
        if not target_short:
            print(f"  no target_short fuzzy-matchable in v1-9-complete kpis", file=sys.stderr)
            report["skipped_no_target_short"].append({"ticker": ticker, "cik": cik})
            continue

        override = build_override(ticker, concept, history)
        extension = build_history_extension(target_short, concept, history)
        path = write_enrich(ticker, override, extension)
        last_val = override["value"]
        years = len(history)
        print(
            f"  ✅ {years} ans, {last_val} {override['unit']}, "
            f"target_short={target_short}, concept={concept}",
            file=sys.stderr,
        )
        report["ok"].append({
            "ticker": ticker,
            "cik": cik,
            "concept": concept,
            "years": years,
            "last_value": last_val,
            "unit": override["unit"],
            "original_hero": original_hero.get("original_short") if original_hero else None,
            "target_short": target_short,
            "path": str(path.relative_to(REPO_ROOT)),
        })

    report["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report["count_ok"] = len(report["ok"])
    report["count_skipped_no_cik"] = len(report["skipped_no_cik"])
    report["count_skipped_no_data"] = len(report["skipped_no_data"])
    report["count_skipped_short_history"] = len(report["skipped_short_history"])
    report["count_skipped_semantic"] = len(report["skipped_semantic"])
    report["count_skipped_no_target_short"] = len(report["skipped_no_target_short"])
    report["count_errors"] = len(report["errors"])

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n=== SUMMARY ===", file=sys.stderr)
    print(f"OK:                   {report['count_ok']}", file=sys.stderr)
    print(f"Skipped (no CIK):     {report['count_skipped_no_cik']}", file=sys.stderr)
    print(f"Skipped (no data):    {report['count_skipped_no_data']}", file=sys.stderr)
    print(f"Skipped (<5 years):   {report['count_skipped_short_history']}", file=sys.stderr)
    print(f"Skipped (semantic):   {report['count_skipped_semantic']}", file=sys.stderr)
    print(f"Skipped (no target):  {report['count_skipped_no_target_short']}", file=sys.stderr)
    print(f"Errors:               {report['count_errors']}", file=sys.stderr)
    print(f"Report: {REPORT_FILE.relative_to(REPO_ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
