#!/usr/bin/env python3
"""
Sub-agent #96 — Pivot hero vers generic XBRL pour 23 stés US PIVOT_TO_GENERIC_RECOMMENDED.

Lit SEC EDGAR companyfacts pour chaque sté, extrait le pivot_candidate_kpi
sur ≥5 ans (annuel FY) ou ≥8 trimestres (Q1-Q4).

Output dans `src/data/v2-pipeline-enrich/<lowercase>.json` :
- `_hero_history_extension` : format compatible audit script ligne 443
  (history = number[], hero_kpi_short matchant un KPI existant)
- `overrides_hero_kpi` : metadata complet pour SSR (label_en/_fr, unit,
  source XBRL, rationale_pivot)

Output dans `src/data/v2-pipeline-enrich/<lowercase>.hero_name_fr.json` :
- `hero_kpi_override` : repointe hero vers le nouveau short si différent
"""
from __future__ import annotations
import json
import os
import sys
import ssl
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

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENRICH_DIR = REPO_ROOT / "src" / "data" / "v2-pipeline-enrich"
COMPLETE_DIR = REPO_ROOT / "src" / "data" / "v1-9-complete"
ANALYSIS_FILE = REPO_ROOT / "src" / "data" / "v1-9-us-segment-heroes-analysis-21-mai.json"

USER_AGENT = "Mettrik AI yannricordeau100@gmail.com"
THROTTLE_SEC = 0.15

# Mapping ticker → pivot KPI + target_short (must match an existing KPI in
# v1-9-complete or v2-pipeline). Verified manually from grep of `.kpis[]?.short`.
PIVOT_MAP: dict[str, dict] = {
    "C":     {"cik": "0000831001", "kpi": "NetInterestIncome", "target_short": "Net Interest Income",   "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Net Interest Income"},
    "TD":    {"cik": "0000947263", "kpi": "Revenue",           "target_short": None,                    "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Loan Book"},
    "TRV":   {"cik": "0000086312", "kpi": "Revenue",           "target_short": None,                    "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Investment Portfolio"},
    "AZO":   {"cik": "0000866787", "kpi": "Revenue",           "target_short": "Revenue",               "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Store Count"},
    "PSA":   {"cik": "0001393311", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "NOI"},
    "KHC":   {"cik": "0001637459", "kpi": "Revenue",           "target_short": "Net Sales",             "label_en": "Net Sales",            "label_fr": "Chiffre d'affaires",          "original_hero": "North America Revenue"},
    "OHI":   {"cik": "0000888491", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Rental Income"},
    "CASY":  {"cik": "0000726958", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Store Count"},
    "CFG":   {"cik": "0000759944", "kpi": "NetInterestIncome", "target_short": "Net Interest Income",   "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Net Interest Income"},
    "DINO":  {"cik": "0001915657", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Revenu net"},
    "FHN":   {"cik": "0000036966", "kpi": "NetInterestIncome", "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "ROTCE Avg"},
    "FITB":  {"cik": "0000035527", "kpi": "NetInterestIncome", "target_short": "Net Interest Income",   "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Net Interest Income"},
    "HBAN":  {"cik": "0000049196", "kpi": "NetInterestIncome", "target_short": "Net Interest Income",   "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Net Interest Income"},
    "HRL":   {"cik": "0000048465", "kpi": "Revenue",           "target_short": "Net Sales",             "label_en": "Net Sales",            "label_fr": "Chiffre d'affaires",          "original_hero": "Net Sales"},
    "IFF":   {"cik": "0000051253", "kpi": "Revenue",           "target_short": "Sales",                 "label_en": "Sales",                "label_fr": "Chiffre d'affaires",          "original_hero": "Sales"},
    "KEY":   {"cik": "0000091576", "kpi": "NetInterestIncome", "target_short": None,                    "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Book Value"},
    "ODFL":  {"cik": "0000878927", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Cap Return"},
    "SJM":   {"cik": "0000091419", "kpi": "Revenue",           "target_short": "Net Sales",             "label_en": "Net Sales",            "label_fr": "Chiffre d'affaires",          "original_hero": "Net Sales"},
    "SRE":   {"cik": "0001032208", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Earnings"},
    "SW":    {"cik": "0002005951", "kpi": "Revenue",           "target_short": "Net Sales",             "label_en": "Net Sales",            "label_fr": "Chiffre d'affaires",          "original_hero": "Net Sales"},
    # TAP: use "Total Revenue" target to avoid audit fuzzy-match collision with
    # "Americas Net Sales" which includes substring "Net sales".
    "TAP":   {"cik": "0000024545", "kpi": "Revenue",           "target_short": "Total Revenue",         "label_en": "Total Revenue",        "label_fr": "Chiffre d'affaires",          "original_hero": "Net sales"},
    "TFC":   {"cik": "0000092230", "kpi": "NetInterestIncome", "target_short": "Net Interest Income",   "label_en": "Net Interest Income",  "label_fr": "Produit net d'intérêts",      "original_hero": "Net Interest Income"},
    "TJX":   {"cik": "0000109198", "kpi": "Revenue",           "target_short": "Net Sales",             "label_en": "Net Sales",            "label_fr": "Chiffre d'affaires",          "original_hero": "Net Sales"},
}

CONCEPT_CANDIDATES = {
    "Revenue": [
        "Revenues",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        # IFRS fallback for Canadian / foreign issuers
        "Revenue",
    ],
    "NetIncome": ["NetIncomeLoss", "ProfitLoss"],
    "OperatingIncome": ["OperatingIncomeLoss"],
    "NetInterestIncome": [
        "InterestIncomeExpenseNet",
        "InterestIncomeOperating",  # paired with InterestExpense fallback
    ],
}

CURRENCY_UNIT_LABEL = {
    "USD": "$",
    "CAD": "CAD",
    "EUR": "€",
    "GBP": "£",
}


def fetch_companyfacts(cik: str) -> dict | None:
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            data = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                import gzip
                data = gzip.decompress(data)
            return json.loads(data)
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        return None


def get_concept_series(facts: dict, concept: str, taxonomies: list[str] | None = None) -> list[dict]:
    """Return list of facts for a concept. Tries us-gaap then ifrs-full."""
    if taxonomies is None:
        taxonomies = ["us-gaap", "ifrs-full"]
    for tax in taxonomies:
        tax_facts = facts.get("facts", {}).get(tax, {})
        if concept not in tax_facts:
            continue
        units = tax_facts[concept].get("units", {})
        for unit_key in ("USD", "CAD", "EUR", "GBP", "USD/shares"):
            if unit_key in units:
                return [{**item, "_currency": unit_key, "_taxonomy": tax} for item in units[unit_key]]
    return []


def filter_annual_fy(series: list[dict]) -> list[dict]:
    out = []
    for item in series:
        if item.get("fp") == "FY" and item.get("form") in ("10-K", "10-K/A", "40-F", "40-F/A", "20-F", "20-F/A"):
            out.append(item)
    return out


def filter_quarterly(series: list[dict]) -> list[dict]:
    out = []
    for item in series:
        if item.get("fp") in ("Q1", "Q2", "Q3", "Q4") and item.get("form") in ("10-Q", "10-Q/A"):
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


def dedupe_quarterly(items: list[dict]) -> list[dict]:
    by_key: dict[tuple, dict] = {}
    for item in items:
        key = (item.get("fy"), item.get("fp"))
        cur = by_key.get(key)
        if cur is None or item.get("filed", "") > cur.get("filed", ""):
            by_key[key] = item
    return sorted(by_key.values(), key=lambda x: (x["fy"], x["fp"]))


def extract_history(facts: dict, kpi: str) -> tuple[str, list[dict], str]:
    """Returns (concept_used, history, periodicity in {annual, quarterly})."""
    if kpi == "NetInterestIncome":
        for concept in ["InterestIncomeExpenseNet"]:
            series = get_concept_series(facts, concept)
            annual = dedupe_by_fy(filter_annual_fy(series))
            if len(annual) >= 5:
                return concept, [{**a, "_concept": concept} for a in annual], "annual"
        ii_series = get_concept_series(facts, "InterestIncomeOperating")
        ie_series = get_concept_series(facts, "InterestExpense")
        ii_annual = dedupe_by_fy(filter_annual_fy(ii_series))
        ie_annual = dedupe_by_fy(filter_annual_fy(ie_series))
        ii_map = {x["fy"]: x for x in ii_annual}
        ie_map = {x["fy"]: x for x in ie_annual}
        common_fy = sorted(set(ii_map.keys()) & set(ie_map.keys()))
        diff = []
        for fy in common_fy:
            diff.append({
                "fy": fy,
                "end": ii_map[fy]["end"],
                "val": ii_map[fy]["val"] - ie_map[fy]["val"],
                "accn": ii_map[fy].get("accn", ""),
                "form": ii_map[fy].get("form", ""),
                "_currency": ii_map[fy].get("_currency", "USD"),
                "_concept": "InterestIncomeOperating-InterestExpense",
            })
        if len(diff) >= 5:
            return "InterestIncomeOperating-InterestExpense", diff, "annual"
        return "", [], ""

    candidates = CONCEPT_CANDIDATES.get(kpi, [])
    # CHAIN concepts: legacy locks early years, modern extends post-ASC606
    all_annual: dict[int, dict] = {}
    used_concepts: list[str] = []
    for concept in candidates:
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
    if len(all_annual) >= 5:
        merged = sorted(all_annual.values(), key=lambda x: x["fy"])
        concept_label = "+".join(used_concepts) if len(used_concepts) > 1 else (used_concepts[0] if used_concepts else "")
        return concept_label, merged, "annual"

    # Quarterly fallback
    for concept in candidates:
        series = get_concept_series(facts, concept)
        quarterly = dedupe_quarterly(filter_quarterly(series))
        if len(quarterly) >= 8:
            return concept, [{**q, "_concept": concept} for q in quarterly], "quarterly"
    return "", [], ""


def determine_unit_and_scale(value: float, currency: str = "USD") -> tuple[str, float]:
    cur_sym = CURRENCY_UNIT_LABEL.get(currency, currency)
    abs_val = abs(value)
    if abs_val >= 1e9:
        return f"Mds {cur_sym}", 1e9
    if abs_val >= 1e6:
        return f"M {cur_sym}", 1e6
    return cur_sym, 1.0


def load_company_kpi_shorts(ticker: str) -> list[str]:
    """Read v1-9-complete/<TICKER>.json to get available KPI shorts."""
    path = COMPLETE_DIR / f"{ticker}.json"
    if not path.exists():
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        return [k.get("short", "") for k in data.get("kpis", []) if isinstance(k, dict)]
    except Exception:
        return []


def build_history_extension(target_short: str, concept: str, history: list[dict], periodicity: str) -> dict:
    """Build _hero_history_extension dict (audit-script format).
    history values are numbers (raw / divisor), period_labels are FY20-style.
    """
    if not history:
        return {}
    last_val = history[-1]["val"]
    last_currency = history[-1].get("_currency", "USD")
    unit, divisor = determine_unit_and_scale(last_val, last_currency)

    history_values: list[float] = []
    period_labels: list[str] = []
    sources_used: list[str] = []
    accns: list[str] = []

    for item in history:
        val = item["val"]
        history_values.append(round(val / divisor, 4))
        fy = item.get("fy")
        if periodicity == "annual":
            period_labels.append(f"FY{str(fy)[-2:]}" if fy is not None else "")
        else:
            fp = item.get("fp", "")
            period_labels.append(f"FY{str(fy)[-2:]} {fp}" if fy is not None else fp)
        c = item.get("_concept", concept)
        if c and c not in sources_used:
            sources_used.append(c)
        accn = item.get("accn", "")
        if accn and accn not in accns:
            accns.append(accn)

    last_end = history[-1].get("end", "")

    return {
        "hero_kpi_short": target_short,
        "history": history_values,
        "period_labels": period_labels,
        "unit": unit,
        "period_type": periodicity if periodicity == "annual" else "quarter",
        "last_data_date": last_end,
        "_source_concepts": sources_used,
        "_xbrl_accessions_sample": accns[:3],
        "extractor": "Sub-agent #96 (CONV-CONCEPTS pivot XBRL companyfacts)",
        "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def build_overrides_metadata(ticker: str, pivot: dict, concept: str, history: list[dict], periodicity: str) -> dict:
    """Build full overrides_hero_kpi metadata (SSR layer / documentation)."""
    if not history:
        return {}
    last = history[-1]
    last_val_raw = last["val"]
    last_currency = last.get("_currency", "USD")
    unit, divisor = determine_unit_and_scale(last_val_raw, last_currency)

    history_out = []
    for item in history:
        val_raw = item.get("val")
        end = item.get("end", "")
        accn = item.get("accn", "")
        form = item.get("form", "10-K")
        fy = item.get("fy")
        fp = item.get("fp", "FY")
        year_label = fy if periodicity == "annual" else f"{fy} {fp}"
        item_concept = item.get("_concept", concept)
        history_out.append({
            "year": year_label,
            "value": round(val_raw / divisor, 4),
            "value_raw": val_raw,
            "unit": unit,
            "period_end": end,
            "source": {
                "type": "xbrl_companyfacts",
                "concept": item_concept,
                "accession_number": accn,
                "form": form,
                "currency": last_currency,
            },
        })

    last_year = history_out[-1]["year"]
    last_value = history_out[-1]["value"]
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

    return {
        "label": pivot["label_en"],
        "label_en": pivot["label_en"],
        "label_fr": pivot["label_fr"],
        "value": last_value,
        "unit": unit,
        "year": last_year,
        "periodicity": periodicity,
        "history": history_out,
        "rationale_pivot": (
            f"Original hero '{pivot['original_hero']}' too specific, pivoted to "
            f"'{pivot['label_en']}' (XBRL us-gaap:{concept}) for ≥5y history coverage"
        ),
        "source": "xbrl_companyfacts_pivot_sub_agent_96",
        "verified_at": now_iso,
    }


def merge_into_enrich(ticker: str, extension: dict, overrides: dict) -> str:
    """Write to v2-pipeline-enrich/<lowercase>.json."""
    enrich_path = ENRICH_DIR / f"{ticker.lower()}.json"
    if enrich_path.exists():
        with open(enrich_path, "r") as f:
            data = json.load(f)
    else:
        data = {}
    data["_hero_history_extension"] = extension
    data["overrides_hero_kpi"] = overrides
    data["_pivot_sub_agent_96_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open(enrich_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(enrich_path)


def write_hero_override(ticker: str, target_short: str, label_fr: str) -> str:
    """Write to v2-pipeline-enrich/<lowercase>.hero_name_fr.json with hero_kpi_override."""
    path = ENRICH_DIR / f"{ticker.lower()}.hero_name_fr.json"
    if path.exists():
        with open(path) as f:
            data = json.load(f)
    else:
        data = {}
    data["hero_kpi_override"] = target_short
    # Also write the name_fr override for the new hero
    data["overrides_hero_name_fr"] = {
        "hero_short": target_short,
        "name_fr": label_fr,
    }
    data["_pivot_sub_agent_96_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(path)


def main():
    targets = list(PIVOT_MAP.keys())
    print(f"=== Sub-agent #96 pivot XBRL — {len(targets)} stés ===\n")

    results = {
        "sub_agent": 96,
        "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stes": [],
        "summary": {"success": 0, "skipped_no_target_kpi": 0, "skipped_insufficient_history": 0, "errors": 0},
    }

    for ticker in targets:
        pivot = PIVOT_MAP[ticker]
        cik = pivot["cik"]
        kpi = pivot["kpi"]
        target_short = pivot["target_short"]
        print(f"[{ticker}] CIK={cik} pivot_kpi={kpi} target_short={target_short!r}")

        # Resolve target_short if None (no existing KPI matches generic) → SKIP
        if target_short is None:
            # Try to find any sensible existing KPI
            shorts = load_company_kpi_shorts(ticker)
            shorts_lower = [s.lower() for s in shorts]
            candidates_lower = ["net interest income", "total revenue", "revenues", "net sales", "sales", "net income"]
            found = None
            for cand in candidates_lower:
                if cand in shorts_lower:
                    idx = shorts_lower.index(cand)
                    found = shorts[idx]
                    break
            if found:
                target_short = found
                print(f"  → auto-resolved target_short to existing KPI: '{target_short}'")
            else:
                print(f"  ⚠️  SKIP : no matching generic KPI exists in v1-9-complete")
                results["stes"].append({
                    "ticker": ticker, "status": "skipped_no_target_kpi",
                    "kpi": kpi, "kpis_available": shorts[:10],
                })
                results["summary"]["skipped_no_target_kpi"] += 1
                continue

        facts = fetch_companyfacts(cik)
        time.sleep(THROTTLE_SEC)

        if facts is None:
            print(f"  ❌ Failed to fetch companyfacts")
            results["stes"].append({"ticker": ticker, "status": "error_fetch", "kpi": kpi})
            results["summary"]["errors"] += 1
            continue

        concept, history, periodicity = extract_history(facts, kpi)

        if not history:
            print(f"  ⚠️  extraction_failed_insufficient_history (kpi={kpi})")
            results["stes"].append({
                "ticker": ticker, "status": "extraction_failed_insufficient_history",
                "kpi": kpi, "tried_concepts": CONCEPT_CANDIDATES.get(kpi, [kpi]),
            })
            results["summary"]["skipped_insufficient_history"] += 1
            continue

        n = len(history)
        if periodicity == "annual" and n < 5:
            print(f"  ⚠️  insufficient annual history ({n}/5)")
            results["stes"].append({
                "ticker": ticker, "status": "extraction_failed_insufficient_history",
                "kpi": kpi, "found": n, "concept": concept,
            })
            results["summary"]["skipped_insufficient_history"] += 1
            continue
        if periodicity == "quarterly" and n < 8:
            print(f"  ⚠️  insufficient quarterly history ({n}/8)")
            results["stes"].append({
                "ticker": ticker, "status": "extraction_failed_insufficient_history",
                "kpi": kpi, "found": n, "concept": concept,
            })
            results["summary"]["skipped_insufficient_history"] += 1
            continue

        extension = build_history_extension(target_short, concept, history, periodicity)
        overrides = build_overrides_metadata(ticker, pivot, concept, history, periodicity)

        enrich_path = merge_into_enrich(ticker, extension, overrides)

        # If hero is being repointed (different from original), write hero_kpi_override
        wrote_override = False
        if pivot["original_hero"].lower() != target_short.lower():
            override_path = write_hero_override(ticker, target_short, pivot["label_fr"])
            wrote_override = True

        years_range = f"{history[0].get('fy')}-{history[-1].get('fy')}"
        print(f"  ✅ {periodicity} {n} pts {years_range} target={target_short!r} unit={extension['unit']} override={wrote_override}")
        results["stes"].append({
            "ticker": ticker, "status": "success", "kpi": kpi, "concept": concept,
            "target_short": target_short, "original_hero": pivot["original_hero"],
            "hero_repointed": wrote_override,
            "periodicity": periodicity, "n_points": n,
            "years_range": years_range,
            "last_value": extension["history"][-1], "unit": extension["unit"],
            "enrich_path": enrich_path,
        })
        results["summary"]["success"] += 1

    results["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    report_path = REPO_ROOT / "scripts" / "hero-pivot-xbrl" / "pivot-report.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n=== SUMMARY ===")
    print(f"  Success                            : {results['summary']['success']}")
    print(f"  Skipped (no target KPI)            : {results['summary']['skipped_no_target_kpi']}")
    print(f"  Skipped (insufficient history)     : {results['summary']['skipped_insufficient_history']}")
    print(f"  Errors                             : {results['summary']['errors']}")
    print(f"  Report                             : {report_path}")


if __name__ == "__main__":
    main()
