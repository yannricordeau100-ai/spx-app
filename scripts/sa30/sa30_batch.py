#!/usr/bin/env python3
"""SA30 batch executor.

Usage: python3 sa30_batch.py /tmp/sa30-batches/batchNN.txt

For each ticker:
  1. Load src/data/v2-pipeline/<lowercase>.json
  2. For KPIs with period_type=None: len>=8 -> 'quarter', else 'year'
  3. If US ticker (CIK known), try to extend history to 20 quarters via SEC EDGAR
     XBRL companyfacts API. Tags us-gaap:
       Revenues / RevenueFromContractWithCustomerExcludingAssessedTax,
       NetIncomeLoss, OperatingIncomeLoss,
       NetCashProvidedByUsedInOperatingActivities,
       ResearchAndDevelopmentExpense
  4. Q4 = FY - (Q1+Q2+Q3)
  5. Never invent.
  6. _fix_log: ["SA30-06 2026-06-03"]
  7. Save.
"""
from __future__ import annotations

import gzip
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path("/Users/yann/spx-app")
PIPE_DIR = ROOT / "src/data/v2-pipeline"
CIK_INDEX_PATH = ROOT / "sec-data/_meta/cat1-cat2-index.json"

UA = "Mettrik mettrik@yann.local"
SLEEP = 0.5  # RAM-light per user request
MARKER = "SA30-06 2026-06-03"

# Map KPI short text -> us-gaap XBRL tags (try in order).
KPI_TAG_MAP = [
    # (regex on lowercase text, list of tags, kind)
    (r"^(total\s+)?revenues?$|^total\s+net\s+sales$|^net\s+sales$|^chiffre\s+d.affaire(s)?$",
     ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet"], "flow"),
    (r"^net\s+income$|^r[ée]sultat\s+net$|^net\s+earnings$",
     ["NetIncomeLoss", "ProfitLoss"], "flow"),
    (r"^operating\s+income$|^op\s+income$|^operating\s+profit$|^r[ée]sultat\s+op[ée]rationnel$",
     ["OperatingIncomeLoss"], "flow"),
    (r"^(net\s+)?operating\s+cash\s+flow$|^op\s+cash\s+flow$|^cash\s+from\s+ops?$|"
     r"^flux\s+de\s+tr[ée]sorerie\s+(d.)?(exploitation|op[ée]rations?)$",
     ["NetCashProvidedByUsedInOperatingActivities"], "flow"),
    (r"^r\s*&\s*d$|^research\s+and\s+development$|"
     r"^research\s*&\s*development\s+expense$|^d[ée]penses?\s+(en\s+)?r\s*&\s*d$",
     ["ResearchAndDevelopmentExpense"], "flow"),
]

_cf_cache: dict[int, dict | None] = {}
_last_call = 0.0


def log(msg: str):
    print(msg, flush=True)


def fetch_companyfacts(cik: int) -> dict | None:
    global _last_call
    if cik in _cf_cache:
        return _cf_cache[cik]
    el = time.time() - _last_call
    if el < SLEEP:
        time.sleep(SLEEP - el)
    _last_call = time.time()
    padded = f"{cik:010d}"
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=40) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            data = json.loads(raw)
            _cf_cache[cik] = data
            return data
    except urllib.error.HTTPError as e:
        log(f"  HTTP {e.code} CIK {cik}")
        _cf_cache[cik] = None
        return None
    except Exception as e:
        log(f"  EXC CIK {cik}: {e}")
        _cf_cache[cik] = None
        return None


def get_us_gaap_units(cf: dict, tag: str) -> dict | None:
    if not cf:
        return None
    facts = cf.get("facts", {})
    ns = facts.get("us-gaap", {})
    if tag in ns:
        return ns[tag].get("units")
    return None


def _filter_q_span(end: str, start: str) -> bool:
    """Quarter has roughly 60-100 days span."""
    if not start or not end:
        return False
    try:
        from datetime import date
        sd = date.fromisoformat(start)
        ed = date.fromisoformat(end)
        days = (ed - sd).days
        return 60 <= days <= 100
    except Exception:
        return False


def _filter_fy_span(end: str, start: str) -> bool:
    """FY span 300-400 days."""
    if not start or not end:
        return False
    try:
        from datetime import date
        sd = date.fromisoformat(start)
        ed = date.fromisoformat(end)
        days = (ed - sd).days
        return 300 <= days <= 400
    except Exception:
        return False


def build_quarter_series(cf: dict, tags: list[str], max_q: int = 20
                         ) -> list[tuple[str, float, str]]:
    """Return [(period_label, value, end_date)] up to max_q quarters.
    Tries each tag; uses Q1/Q2/Q3 from 10-Q + computed Q4 = FY - (Q1+Q2+Q3).
    """
    for tag in tags:
        units = get_us_gaap_units(cf, tag)
        if not units:
            continue
        unit_data = units.get("USD") or next(iter(units.values()), None)
        if not unit_data:
            continue
        # Collect quarterly facts (Q1/Q2/Q3) and FY facts
        q_pool: dict[tuple[int, str], dict] = {}
        fy_pool: dict[int, dict] = {}
        for item in unit_data:
            form = item.get("form", "")
            fp = item.get("fp", "")
            fy = item.get("fy")
            val = item.get("val")
            end = item.get("end", "")
            start = item.get("start", "")
            filed = item.get("filed", "")
            if fy is None or val is None:
                continue
            if fp in ("Q1", "Q2", "Q3"):
                if form not in ("10-Q", "10-Q/A"):
                    continue
                if not _filter_q_span(end, start):
                    continue
                key = (fy, fp)
                prev = q_pool.get(key)
                if not prev or filed > prev.get("filed", ""):
                    q_pool[key] = {"val": float(val), "filed": filed, "end": end}
            elif fp == "FY":
                if form not in ("10-K", "10-K/A"):
                    continue
                if not _filter_fy_span(end, start):
                    continue
                prev = fy_pool.get(fy)
                if not prev or filed > prev.get("filed", ""):
                    fy_pool[fy] = {"val": float(val), "filed": filed, "end": end}
        if not q_pool and not fy_pool:
            continue
        # Combine + derive Q4
        out: dict[tuple[int, str], dict] = dict(q_pool)
        for fy, fye in fy_pool.items():
            q1 = q_pool.get((fy, "Q1"))
            q2 = q_pool.get((fy, "Q2"))
            q3 = q_pool.get((fy, "Q3"))
            if q1 and q2 and q3:
                q4_val = fye["val"] - q1["val"] - q2["val"] - q3["val"]
                out[(fy, "Q4")] = {"val": q4_val, "filed": fye["filed"],
                                    "end": fye["end"]}
        if not out:
            continue
        items = sorted(out.items(), key=lambda kv: kv[1]["end"])
        items = items[-max_q:]
        return [(f"{fp} {fy}", d["val"], d["end"]) for (fy, fp), d in items]
    return []


def build_year_series(cf: dict, tags: list[str], max_y: int = 10
                      ) -> list[tuple[str, float, str]]:
    for tag in tags:
        units = get_us_gaap_units(cf, tag)
        if not units:
            continue
        unit_data = units.get("USD") or next(iter(units.values()), None)
        if not unit_data:
            continue
        pool: dict[int, dict] = {}
        for item in unit_data:
            form = item.get("form", "")
            fp = item.get("fp", "")
            fy = item.get("fy")
            val = item.get("val")
            end = item.get("end", "")
            start = item.get("start", "")
            filed = item.get("filed", "")
            if fy is None or val is None or fp != "FY":
                continue
            if form not in ("10-K", "10-K/A"):
                continue
            if not _filter_fy_span(end, start):
                continue
            prev = pool.get(fy)
            if not prev or filed > prev.get("filed", ""):
                pool[fy] = {"val": float(val), "filed": filed, "end": end}
        if not pool:
            continue
        items = sorted(pool.items(), key=lambda kv: kv[1]["end"])
        items = items[-max_y:]
        return [(f"FY{fy}", d["val"], d["end"]) for fy, d in items]
    return []


def match_concept(kpi: dict) -> tuple[list[str], str] | None:
    """Return (tags, kind) if KPI text matches a known XBRL concept."""
    candidates = []
    for fld in ("short", "name_fr", "name_en"):
        v = kpi.get(fld)
        if isinstance(v, str) and v.strip():
            candidates.append(v.strip().lower())
    if not candidates:
        return None
    for text in candidates:
        for pat, tags, kind in KPI_TAG_MAP:
            if re.search(pat, text):
                return (tags, kind)
    return None


def detect_unit_scale(unit_str: str) -> float:
    """Return divisor for raw USD -> displayed unit."""
    if not unit_str:
        return 1.0
    u = unit_str.lower()
    if "mds" in u or "billion" in u or "$b" in u or "b$" in u:
        return 1e9
    if " m " in f" {u} " or u.startswith("m ") or u.endswith(" m") or u == "m $" or "million" in u:
        return 1e6
    if u in ("$", "usd"):
        return 1.0
    return 1.0


def fix_period_types(kpis: list[dict]) -> int:
    n = 0
    for k in kpis:
        pt = k.get("period_type")
        if pt is not None and pt not in ("None", "null", ""):
            continue
        h = k.get("history") or []
        if not isinstance(h, list):
            continue
        ln = len(h)
        if ln >= 8:
            k["period_type"] = "quarter"
        else:
            k["period_type"] = "year"
        n += 1
    return n


def extend_history_us(cik: int, kpis: list[dict]) -> int:
    """Try to extend history for KPIs whose short/name maps to a known XBRL tag."""
    cf = fetch_companyfacts(cik)
    if cf is None:
        return 0
    n_extended = 0
    for k in kpis:
        match = match_concept(k)
        if not match:
            continue
        tags, kind = match
        h = k.get("history") or []
        pt = k.get("period_type")
        unit = k.get("unit", "")
        scale = detect_unit_scale(unit)

        if pt == "quarter":
            if len(h) >= 20:
                continue
            series = build_quarter_series(cf, tags, max_q=20)
            if len(series) < max(len(h), 4):
                continue
            # Rescale values to KPI unit
            new_hist = [round(v / scale, 4) for (_, v, _) in series]
            k["history"] = new_hist
            # last_data_date
            last_end = series[-1][2]
            if last_end:
                k["last_data_date"] = last_end
            n_extended += 1
        elif pt == "year":
            if len(h) >= 8:
                continue
            series = build_year_series(cf, tags, max_y=10)
            if len(series) < max(len(h), 3):
                continue
            new_hist = [round(v / scale, 4) for (_, v, _) in series]
            k["history"] = new_hist
            last_end = series[-1][2]
            if last_end:
                k["last_data_date"] = last_end
            n_extended += 1
    return n_extended


def process_ticker(ticker: str, cik_idx: dict) -> dict:
    slug = ticker.lower()
    fp = PIPE_DIR / f"{slug}.json"
    if not fp.exists():
        return {"ticker": ticker, "status": "missing"}
    data = json.loads(fp.read_text())
    kpis = data.get("kpis") or []
    if not kpis:
        return {"ticker": ticker, "status": "no_kpis"}

    n_pt = fix_period_types(kpis)
    n_ext = 0

    # US ticker if CIK known and ticker has no dot (heuristic)
    cik = None
    entry = cik_idx.get(ticker)
    if isinstance(entry, dict):
        cik = entry.get("cik")
    elif isinstance(entry, (int, str)):
        try:
            cik = int(entry)
        except Exception:
            cik = None
    if cik and "." not in ticker:
        try:
            n_ext = extend_history_us(int(cik), kpis)
        except Exception as e:
            log(f"  {ticker} extend exc: {e}")

    if n_pt > 0 or n_ext > 0:
        log_arr = data.get("_fix_log") or []
        if not isinstance(log_arr, list):
            log_arr = []
        if MARKER not in log_arr:
            log_arr.append(MARKER)
        data["_fix_log"] = log_arr
        fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return {"ticker": ticker, "n_pt": n_pt, "n_ext": n_ext,
            "status": "ok" if (n_pt or n_ext) else "noop"}


def main():
    if len(sys.argv) < 2:
        print("usage: sa30_batch.py <batch.txt>")
        sys.exit(1)
    batch_fp = Path(sys.argv[1])
    tickers = []
    for line in batch_fp.read_text().splitlines():
        s = line.strip()
        if not s:
            continue
        parts = s.split("\t") if "\t" in s else s.split()
        tickers.append(parts[0])
    cik_idx = {}
    if CIK_INDEX_PATH.exists():
        try:
            cik_idx = json.loads(CIK_INDEX_PATH.read_text())
        except Exception:
            cik_idx = {}
    log(f"SA30 batch: {len(tickers)} tickers")
    results = []
    for t in tickers:
        r = process_ticker(t, cik_idx)
        results.append(r)
        log(f"  {t}: {r}")
        time.sleep(0.5)
    # summary
    n_ok = sum(1 for r in results if r.get("status") == "ok")
    n_noop = sum(1 for r in results if r.get("status") == "noop")
    n_miss = sum(1 for r in results if r.get("status") in ("missing", "no_kpis"))
    log(f"Done: ok={n_ok} noop={n_noop} miss={n_miss}")
    log(f"period_types fixed: {sum(r.get('n_pt', 0) for r in results)}")
    log(f"histories extended: {sum(r.get('n_ext', 0) for r in results)}")


if __name__ == "__main__":
    main()
