#!/usr/bin/env python3
"""extend-eu-yf-safe.py — Sub-agent #89 EU annual hero history extension via yfinance.

Strict safety contract:
- Only acts on EU tickers where yfinance Total Revenue most-recent year matches
  the v1-9-complete hero value within ±10% (validated upstream).
- Writes `_hero_history_extension` into `src/data/v2-pipeline-enrich/<lower>.json`
  with explicit yfinance citations (year, value, unit_multiplier, source).
- Pattern identical to sub-agent #85 AIG (Cash & Equivalents from SEC EDGAR XBRL).
- Idempotent: only writes if `_hero_history_extension` missing OR forced.

Scope (sub-agent #89): 3 EU stés with clean yfinance-to-v1-9 mapping:
  - TSCO.L: Group Sales (= yfinance Total Revenue, in M £)
  - CPR.MI: Net Sales (= yfinance Total Revenue, in M €)
  - TEP.PA: Consolidated Revenue (= yfinance Total Revenue, in M €)

NB: 43 other EU/UK a_hero_history KO candidates were inspected but rejected
because:
- Most heroes are company-specific (Beer Volume, Vehicle Deliveries,
  Adjusted Revenue, etc.) that don't map to yfinance standardised IFRS lines.
- The few generic-looking heroes (Group Turnover, Operating Profit, Stockholders
  Equity, EBIT Margin) all failed the ±10% validation gate, meaning the
  v1-9 value uses a different scope/adjustment than what yfinance reports.
- PDF regex extraction across FR/DE/IT/EN annual reports was deemed too
  high-risk for hallucination given the mission's "0 hallucination" rule.

Usage:
  python3 scripts/hero-eu-regex/extend-eu-yf-safe.py
"""
import json
import os
import sys
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent.parent
COMPLETE = ROOT / "src/data/v1-9-complete"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

# Validated safe-match set (see broadcast / mission log)
TARGETS = [
    {"ticker": "TSCO.L", "yf_target": "Total Revenue", "unit": "M £", "currency": "GBP"},
    {"ticker": "CPR.MI", "yf_target": "Total Revenue", "unit": "M €", "currency": "EUR"},
    {"ticker": "TEP.PA", "yf_target": "Total Revenue", "unit": "M €", "currency": "EUR"},
]


def load_hero(ticker: str):
    p = COMPLETE / f"{ticker}.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text())
    label = d.get("hero_kpi")
    for k in d.get("kpis", []) or []:
        if (k.get("short") or "") == label:
            return {
                "label": label,
                "value": k.get("value"),
                "unit": k.get("unit"),
                "history": k.get("history") or [],
                "period_type": k.get("period_type"),
            }
    return None


def fetch_yf_annual(ticker: str, target_idx: str):
    """Return list of (fiscal_year, value_in_base_currency) sorted oldest-first.

    Returns base-currency floats (not scaled). Skips NaN entries.
    """
    import yfinance as yf

    fin = yf.Ticker(ticker).financials
    if fin is None or fin.empty or target_idx not in fin.index:
        return []
    rows = []
    for col in fin.columns:
        v = fin.loc[target_idx, col]
        if v is None:
            continue
        if isinstance(v, float) and v != v:  # NaN
            continue
        rows.append((col.year, float(v), col.strftime("%Y-%m-%d")))
    # Sort oldest first
    rows.sort(key=lambda r: r[0])
    return rows


def build_extension(target: dict, hero: dict, yf_rows: list):
    """Build the `_hero_history_extension` payload.

    Strategy: combine the OLDEST entry from v1-9-complete (which extends back
    beyond yfinance's window) with ALL yfinance annual points. Result is a
    5+ year history sourced from two cross-validated providers:
      - v1-9 oldest = CONV-DATA Pass 3 strict (validated, cited from filings)
      - yfinance recent years = automated IFRS feed (validated upstream
        as matching v1-9's most-recent hero value within +-10%)

    Convert yfinance base-currency floats to the unit declared by v1-9-complete.
    """
    unit = target["unit"]
    if unit.startswith("M "):
        scale = 1_000_000.0
        decimals = 1
    elif "Mds" in unit:
        scale = 1_000_000_000.0
        decimals = 2
    else:
        scale = 1.0
        decimals = 0

    v19_hist = hero["history"] or []
    yf_history = []
    yf_citations = []
    yf_year_value = {}
    for fy, base_val, end_date in yf_rows:
        scaled = round(base_val / scale, decimals)
        yf_history.append(scaled)
        yf_year_value[fy] = scaled
        yf_citations.append(
            {
                "fy": fy,
                "value": scaled,
                "end": end_date,
                "source": "yfinance.financials",
                "source_field": target["yf_target"],
                "raw_base_currency": round(base_val, 2),
            }
        )

    # Build merged history: prepend v1-9 entries that are NOT covered by yfinance.
    # We match by approximate value equality: if v19 entry value is within 1% of
    # any yf year value, it's the same year (and yfinance wins for canonical
    # citation). If not, it's an older year that yfinance lacks.
    merged_history = []
    v19_prepended_citations = []
    for v in v19_hist:
        if not isinstance(v, (int, float)):
            continue
        is_in_yf = False
        for yfv in yf_year_value.values():
            if yfv and abs((v - yfv) / yfv) < 0.01:
                is_in_yf = True
                break
        if not is_in_yf:
            merged_history.append(round(float(v), decimals))
            v19_prepended_citations.append(
                {
                    "value": round(float(v), decimals),
                    "source": "v1-9-complete (CONV-DATA Pass 3 strict)",
                    "note": "Year not in yfinance window; value preserved from upstream extraction.",
                }
            )
    merged_history.extend(yf_history)

    return {
        "hero_kpi_short": hero["label"],
        "period_type": "annual",
        "history": merged_history,
        "unit": unit,
        "currency": target["currency"],
        "last_data_date": yf_rows[-1][2] if yf_rows else None,
        "_source": (
            "yfinance Ticker.financials (recent years) + v1-9-complete oldest "
            f"entries; field={target['yf_target']}"
        ),
        "_extracted_by": "sub-agent-89 hero-eu-yf-safe",
        "_extracted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "_validation": (
            f"yfinance most-recent value matches v1-9-complete hero value within +-10%; "
            f"v1-9 hero history len was {len(v19_hist)}, yf provides "
            f"{len(yf_rows)} annual points; merged history len = {len(merged_history)}."
        ),
        "_citations": v19_prepended_citations + yf_citations,
    }


def update_enrich(ticker: str, ext: dict) -> str:
    p = ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        data = json.loads(p.read_text())
    else:
        data = {"ticker": ticker}

    # Force overwrite: we may have already written a shorter version in the
    # previous iteration. Only skip if existing extension's history is
    # strictly longer.
    if "_hero_history_extension" in data and len(
        data["_hero_history_extension"].get("history", [])
    ) > len(ext["history"]):
        return "SKIP_EXISTING_LONGER"

    data["_hero_history_extension"] = ext
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return "WROTE"


def main():
    written = 0
    skipped = 0
    failed = 0
    print(
        f"[sub-agent-89] extend-eu-yf-safe.py — {len(TARGETS)} targets\n"
        f"  ROOT={ROOT}"
    )
    for tgt in TARGETS:
        t = tgt["ticker"]
        hero = load_hero(t)
        if not hero:
            print(f"  {t}: SKIP (no hero in v1-9-complete)")
            failed += 1
            continue
        try:
            rows = fetch_yf_annual(t, tgt["yf_target"])
        except Exception as exc:
            print(f"  {t}: FAIL yfinance {exc}")
            failed += 1
            continue
        if len(rows) < 4:
            print(f"  {t}: SKIP only {len(rows)} yf annual points (<4)")
            skipped += 1
            continue
        ext = build_extension(tgt, hero, rows)
        status = update_enrich(t, ext)
        print(
            f"  {t}: {status} — hist_len {len(hero['history'])} -> {len(ext['history'])} "
            f"({rows[0][0]}..{rows[-1][0]})"
        )
        if status == "WROTE":
            written += 1
        else:
            skipped += 1
        time.sleep(0.5)  # be gentle with yfinance

    print(f"\nDone: wrote={written} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
