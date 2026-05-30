#!/usr/bin/env python3
"""
Merge KPI v2-pipeline-kpi-v2 (kpi-extract-<TICKER>.json) + v2-pipeline-exhaustive (<ticker>.json)
into v2-pipeline-specific-kpis/<ticker_lowercase>.json (canonical lowercase).

Rules (cf prompt CONV-MERGE-KPI-V2-EXHAUSTIVE-2026-05-30):
1. If specific-kpis/<t>.json exists with >=4 KPIs already, MERGE only new shorts (no overwrite).
2. Skip generic KPIs (listed in kpi-generic-library.json).
3. From kpi-v2: take verified_existing + new_kpis, ordered by pv_score desc.
4. From exhaustive: take segments + geography (if 3+ history values available).
5. Anti-invention: skip KPI if history < 3 values.
6. Filename mandatory lowercase: aapl.json, etc.

Idempotent.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
KPI_V2_DIR = ROOT / "src/data/v2-pipeline-kpi-v2"
EXHAUSTIVE_DIR = ROOT / "src/data/v2-pipeline-exhaustive"
SPECIFIC_DIR = ROOT / "src/data/v2-pipeline-specific-kpis"
GENERIC_LIB = ROOT / "src/data/kpi-generic-library.json"

SIGNATURE = "CONV-MERGE-KPI-V2-EXHAUSTIVE-2026-05-30"


def load_generic_shorts() -> set[str]:
    """Load list of generic KPI shorts to exclude (lowercased)."""
    data = json.loads(GENERIC_LIB.read_text())
    shorts = {entry["short"].lower().strip() for entry in data}
    # Common variants
    extra = {
        "revenue", "total revenue", "net income", "operating income",
        "op margin", "operating margin", "ebitda", "ebitda margin",
        "gross margin", "fcf", "free cash flow", "ocf", "operating cash flow",
        "eps", "dps", "payout ratio", "cap return", "buybacks", "r&d", "capex",
        "headcount", "total assets", "total debt", "net debt", "leverage ratio",
        "cash & equivalents", "cash", "roe", "roic", "p/e", "p/e ratio",
        "market cap", "shares outstanding", "tax rate", "net margin",
    }
    return shorts | extra


GENERIC_SHORTS = load_generic_shorts()


def is_generic(short: str) -> bool:
    s = (short or "").lower().strip()
    return s in GENERIC_SHORTS


def list_kpi_v2_tickers() -> dict[str, Path]:
    """Map TICKER (preserving case) -> file path."""
    out: dict[str, Path] = {}
    for p in KPI_V2_DIR.iterdir():
        m = re.match(r"kpi-extract-(.+)\.json$", p.name)
        if not m:
            continue
        ticker = m.group(1)
        # Normalize ABBN_SW -> ABBN.SW (underscore variant)
        if "_" in ticker and "." not in ticker:
            ticker_norm = ticker.replace("_", ".")
        else:
            ticker_norm = ticker
        # Keep canonical (prefer .SW over _SW if both exist)
        if ticker_norm in out:
            # Already have one; prefer the dotted version
            if "." in ticker and "_" not in ticker:
                out[ticker_norm] = p
        else:
            out[ticker_norm] = p
    return out


def list_exhaustive_tickers() -> dict[str, Path]:
    """Map TICKER -> exhaustive file path (filename already lowercase)."""
    out: dict[str, Path] = {}
    for p in EXHAUSTIVE_DIR.iterdir():
        if not p.name.endswith(".json"):
            continue
        ticker = p.stem.upper()  # e.g. abbn.sw -> ABBN.SW
        out[ticker] = p
    return out


def to_filename(ticker: str) -> str:
    """Return lowercase filename for ticker (canonical)."""
    return ticker.lower() + ".json"


def parse_history(h: Any) -> list[float] | None:
    """Convert to a list of floats; return None if <3 valid values."""
    if not isinstance(h, list):
        return None
    out: list[float] = []
    for v in h:
        if v is None:
            continue
        try:
            out.append(float(v))
        except (TypeError, ValueError):
            continue
    if len(out) < 3:
        return None
    return out


def extract_kpis_from_kpi_v2(data: dict) -> list[dict]:
    """Extract KPIs from kpi-extract format, in PV order desc."""
    kpis: list[dict] = []

    # verified_existing
    for k in data.get("verified_existing", []) or []:
        short = (k.get("short") or "").strip()
        if not short or is_generic(short):
            continue
        # Value: prefer true_value, fall back to verified_value or stored_value
        val = k.get("true_value") or k.get("verified_value") or k.get("stored_value")
        # Some kpi-v2 files have true_value_Q2_FY26 etc; try first numeric field
        if val is None:
            for key, v in k.items():
                if key.startswith(("true_value", "verified_value", "stored_value")) and isinstance(v, (int, float)):
                    val = v
                    break
        history = parse_history(k.get("history"))
        if history is None:
            continue  # Anti-invention rule
        if val is None:
            val = history[0] if history else None
        if val is None:
            continue
        unit = k.get("unit") or ""
        kpis.append({
            "short": short,
            "name_fr": short,
            "name_en": short,
            "value": val,
            "unit": unit,
            "history": history,
            "period_type": "year",
            "pv_score": 8,  # Verified existing = high confidence
            "type": "Revenue" if "revenue" in short.lower() else "Other",
            "signal": k.get("note") or k.get("comment") or "",
            "description_fr": k.get("note") or k.get("comment") or "",
            "description_en": k.get("note") or k.get("comment") or "",
            "yoy": "",
            "last_data_date": "",
            "_source": "kpi-v2.verified_existing",
        })

    # new_kpis
    for k in data.get("new_kpis", []) or []:
        short = (k.get("short") or "").strip()
        if not short or is_generic(short):
            continue
        history = parse_history(k.get("history") or k.get("history_quarterly_Q1_FY25_to_Q2_FY26") or k.get("history_H1_FY25_H1_FY26") or k.get("history_Q2_FY25_to_Q2_FY26"))
        if history is None:
            continue
        val = k.get("value")
        if val is None:
            val = history[-1] if history else None
        if val is None:
            continue
        unit = k.get("unit") or ""
        pv = k.get("pv") or k.get("PV") or k.get("pv_score") or 7
        try:
            pv = int(pv)
        except (TypeError, ValueError):
            pv = 7
        pv = max(5, min(10, pv))
        kpis.append({
            "short": short,
            "name_fr": short,
            "name_en": short,
            "value": val,
            "unit": unit,
            "history": history,
            "period_type": "year",
            "pv_score": pv,
            "type": "Revenue" if "revenue" in short.lower() else "Other",
            "signal": k.get("rationale") or k.get("comment") or "",
            "description_fr": k.get("rationale") or k.get("comment") or "",
            "description_en": k.get("rationale") or k.get("comment") or "",
            "yoy": "",
            "last_data_date": "",
            "_source": "kpi-v2.new_kpis",
        })

    # Sort by pv_score desc
    kpis.sort(key=lambda k: k.get("pv_score", 0), reverse=True)
    return kpis


def _coerce_list_of_dicts(obj: Any) -> list[dict]:
    """Some exhaustive files store segments/geography as dict keyed by name or as list. Normalize."""
    if isinstance(obj, list):
        return [x for x in obj if isinstance(x, dict)]
    if isinstance(obj, dict):
        out: list[dict] = []
        for k, v in obj.items():
            if isinstance(v, dict):
                # Ensure name present
                if "name" not in v and "region" not in v:
                    v = dict(v)
                    v["name"] = k
                out.append(v)
        return out
    return []


def extract_kpis_from_exhaustive(data: dict) -> list[dict]:
    """Extract specific KPIs from exhaustive format (segments + geography)."""
    kpis: list[dict] = []
    currency = (data.get("financials", {}) or {}).get("currency", "")
    unit_currency = currency or "USD"

    # Segments
    for seg in _coerce_list_of_dicts(data.get("segments")):
        name = (seg.get("name") or seg.get("segment_name") or "").strip()
        if not name or is_generic(name):
            continue
        rev_series = seg.get("revenue") or []
        if not isinstance(rev_series, list):
            continue
        # Build year-ordered history
        rev_pts = []
        for r in rev_series:
            if not isinstance(r, dict):
                continue
            if r.get("value") is not None:
                try:
                    rev_pts.append((r.get("year"), float(r["value"])))
                except (TypeError, ValueError):
                    pass
        rev_pts.sort(key=lambda x: x[0] or 0)
        history = [v for _, v in rev_pts]
        if len(history) < 3:
            continue  # Anti-invention
        value = history[-1]
        unit_raw = ""
        if rev_series and isinstance(rev_series[0], dict):
            unit_raw = rev_series[0].get("unit") or ""
        # Normalize unit (e.g., "CHF millions" -> "M CHF")
        unit = unit_raw
        m = re.match(r"(\w+)\s+(millions|millions)", unit_raw, re.IGNORECASE)
        if m:
            unit = f"M {m.group(1)}"
        m = re.match(r"(\w+)\s+(billions)", unit_raw, re.IGNORECASE)
        if m:
            unit = f"Mds {m.group(1)}"
        pct = seg.get("percentage_total")
        signal = f"Segment {name}"
        if pct:
            signal += f" ({pct}% du CA)"
        kpis.append({
            "short": f"{name} Revenue",
            "name_fr": f"CA {name}",
            "name_en": f"{name} Revenue",
            "value": value,
            "unit": unit,
            "history": history,
            "period_type": "year",
            "pv_score": 8,
            "type": "Revenue",
            "signal": signal,
            "description_fr": f"Revenu segment {name}.",
            "description_en": f"{name} segment revenue.",
            "yoy": "",
            "last_data_date": "",
            "_source": "exhaustive.segments",
        })

    # Geography (often only 2 years -> skip per rule)
    for geo in _coerce_list_of_dicts(data.get("geography_revenue")):
        region = (geo.get("region") or geo.get("name") or "").strip()
        if not region or is_generic(region):
            continue
        rev_series = geo.get("revenue") or []
        if not isinstance(rev_series, list):
            continue
        rev_pts = []
        for r in rev_series:
            if not isinstance(r, dict):
                continue
            if r.get("value") is not None:
                try:
                    rev_pts.append((r.get("year"), float(r["value"])))
                except (TypeError, ValueError):
                    pass
        rev_pts.sort(key=lambda x: x[0] or 0)
        history = [v for _, v in rev_pts]
        if len(history) < 3:
            continue
        value = history[-1]
        unit_raw = ""
        if rev_series and isinstance(rev_series[0], dict):
            unit_raw = rev_series[0].get("unit") or ""
        unit = unit_raw
        m = re.match(r"(\w+)\s+millions", unit_raw, re.IGNORECASE)
        if m:
            unit = f"M {m.group(1)}"
        pct = geo.get("percentage_total")
        signal = f"Zone géographique {region}"
        if pct:
            signal += f" ({pct}% du CA)"
        kpis.append({
            "short": f"{region} Revenue",
            "name_fr": f"CA {region}",
            "name_en": f"{region} Revenue",
            "value": value,
            "unit": unit,
            "history": history,
            "period_type": "year",
            "pv_score": 6,
            "type": "Revenue",
            "signal": signal,
            "description_fr": f"Revenu région {region}.",
            "description_en": f"{region} regional revenue.",
            "yoy": "",
            "last_data_date": "",
            "_source": "exhaustive.geography",
        })

    return kpis


def merge_with_existing(ticker: str, new_kpis: list[dict]) -> tuple[dict, str]:
    """
    Merge new_kpis with existing specific-kpis/<t>.json if present.
    Returns (final_data, action) where action in {created, skipped, merged}.
    """
    target = SPECIFIC_DIR / to_filename(ticker)
    existing_data: dict = {}
    existing_kpis: list[dict] = []

    if target.exists():
        try:
            existing_data = json.loads(target.read_text())
            existing_kpis = existing_data.get("kpis", []) or []
        except json.JSONDecodeError:
            existing_data = {}
            existing_kpis = []

    # Filter out any generic that may have leaked in
    existing_kpis = [k for k in existing_kpis if not is_generic(k.get("short", ""))]

    # Rule 1: if existing has >=4 valid KPIs, only merge new shorts (no overwrite)
    if len(existing_kpis) >= 4:
        existing_shorts = {k.get("short", "").lower().strip() for k in existing_kpis}
        added = [k for k in new_kpis if k.get("short", "").lower().strip() not in existing_shorts]
        if not added:
            return existing_data, "skipped"
        merged = existing_kpis + added
        # Sort by pv desc, then preserve original order
        merged.sort(key=lambda k: k.get("pv_score", 0) or 5, reverse=True)
        existing_data["kpis"] = merged
        existing_data["_kpis_supplementary_signed_by"] = SIGNATURE
        existing_data["_source_path"] = "v2-pipeline-kpi-v2 + v2-pipeline-exhaustive (merged)"
        existing_data["_fit_for_site"] = True
        existing_data["_verification_needed"] = False
        existing_data["ticker"] = ticker
        return existing_data, "merged"

    # Otherwise create fresh from new_kpis
    if not new_kpis:
        # Nothing to write
        if existing_data:
            return existing_data, "skipped"
        return {}, "skipped"

    # Deduplicate by short
    seen = set()
    final_kpis: list[dict] = []
    # Preserve existing first
    for k in existing_kpis:
        s = k.get("short", "").lower().strip()
        if s and s not in seen:
            seen.add(s)
            final_kpis.append(k)
    for k in new_kpis:
        s = k.get("short", "").lower().strip()
        if s and s not in seen:
            seen.add(s)
            final_kpis.append(k)

    final_kpis.sort(key=lambda k: k.get("pv_score", 0) or 5, reverse=True)

    out = {
        "ticker": ticker,
        "_kpis_supplementary_signed_by": SIGNATURE,
        "_source_path": "v2-pipeline-kpi-v2 + v2-pipeline-exhaustive",
        "_fit_for_site": True,
        "_verification_needed": False,
        "kpis": final_kpis,
    }
    action = "merged" if existing_kpis else "created"
    return out, action


def main():
    kpi_v2_map = list_kpi_v2_tickers()
    exhaustive_map = list_exhaustive_tickers()
    all_tickers = sorted(set(kpi_v2_map) | set(exhaustive_map))
    print(f"Total tickers candidates: {len(all_tickers)}")
    print(f"  - kpi-v2 sources: {len(kpi_v2_map)}")
    print(f"  - exhaustive sources: {len(exhaustive_map)}")

    counts = {"created": 0, "merged": 0, "skipped": 0, "error": 0}
    merged_list: list[str] = []

    for ticker in all_tickers:
        new_kpis: list[dict] = []
        # kpi-v2 first (priority on verified data)
        if ticker in kpi_v2_map:
            try:
                data = json.loads(kpi_v2_map[ticker].read_text())
                new_kpis.extend(extract_kpis_from_kpi_v2(data))
            except Exception as e:
                print(f"  ERROR kpi-v2 {ticker}: {e}")
                counts["error"] += 1
                continue
        if ticker in exhaustive_map:
            try:
                data = json.loads(exhaustive_map[ticker].read_text())
                new_kpis.extend(extract_kpis_from_exhaustive(data))
            except Exception as e:
                print(f"  ERROR exhaustive {ticker}: {e}")
                counts["error"] += 1
                continue

        # Dedup by short within new_kpis
        seen = set()
        dedup: list[dict] = []
        for k in new_kpis:
            s = k.get("short", "").lower().strip()
            if s and s not in seen:
                seen.add(s)
                dedup.append(k)
        new_kpis = dedup

        final_data, action = merge_with_existing(ticker, new_kpis)
        if action == "skipped":
            counts["skipped"] += 1
            continue
        if not final_data.get("kpis"):
            counts["skipped"] += 1
            continue

        target = SPECIFIC_DIR / to_filename(ticker)
        target.write_text(json.dumps(final_data, ensure_ascii=False, indent=2))
        counts[action] += 1
        merged_list.append(ticker)

    print("\n=== Summary ===")
    print(f"  created: {counts['created']}")
    print(f"  merged:  {counts['merged']}")
    print(f"  skipped: {counts['skipped']}")
    print(f"  errors:  {counts['error']}")
    print(f"\nTop 30 tickers processed: {merged_list[:30]}")


if __name__ == "__main__":
    main()
