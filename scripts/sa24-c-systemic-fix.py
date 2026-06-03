#!/usr/bin/env python3
"""SA24-C — SYSTEMIC FIX V1.9.5 batches 08-11.

Three deterministic tasks (NO LLM, NO paid API):

T1. Extend history via SEC EDGAR XBRL companyfacts for mappable us-gaap KPIs:
    - quarter & n<20   -> extend toward 20 quarters
    - year    & n<5    -> extend toward 5 years
T2. Resolve period_type=None via heuristic:
    - history length >=8 + last_data_date intra-year -> quarter
    - history length 3..7 + last_data_date Dec/year-end -> year
    - else: leave as-is
T3. Add new sectoriels via BS4 from local 10-Q files
    (segment revenue tables tagged us-gaap:RevenueFromContractWithCustomer*
    with srt:ProductOrServiceAxis or us-gaap:StatementBusinessSegmentsAxis).

Range [1, 999]: scale via factor (M/Mds/B). Skip %, x, ratios.

Deep merge enrich/<slug>.json kpis[] additively. _fix_log += "SA24-C ...".
"""
from __future__ import annotations
import gzip, io, json, os, re, ssl, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path("/Users/yann/spx-app")
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX = ROOT / "sec-data/_meta/cat1-cat2-index.json"
SEC_DATA = Path("/Users/yann/Mettrik/sec-data")
LOG = ROOT / ".conv-state/sa24-c.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

UA = "Mettrik Data Pipeline contact@mettrik.ai"
SEC_BASE = "https://data.sec.gov/api/xbrl/companyfacts"
SLEEP = 0.13  # under 10 req/s SEC limit

KPI_TAGS = {
    "Total Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "Net Income": ["NetIncomeLoss", "ProfitLoss"],
    "Operating Income": ["OperatingIncomeLoss"],
    "Op Income": ["OperatingIncomeLoss"],
    "Gross Profit": ["GrossProfit"],
    "Op Margin": ["__calc__OperatingMargin"],
    "Operating Margin": ["__calc__OperatingMargin"],
    "Gross Margin": ["__calc__GrossMargin"],
    "Net Margin": ["__calc__NetMargin"],
    "Diluted EPS": ["EarningsPerShareDiluted"],
    "EPS": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    "Operating Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "Op Cash Flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "OCF": ["NetCashProvidedByUsedInOperatingActivities"],
    "Free Cash Flow": ["__calc__FCF"],
    "FCF": ["__calc__FCF"],
    "Capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "R&D": ["ResearchAndDevelopmentExpense"],
    "Total Assets": ["Assets"],
    "Stockholders Equity": ["StockholdersEquity"],
    "Cash and Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "Cash & Equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
}

PERCENT_UNITS = {"%", "pct", "bp", "bps"}
RATIO_UNITS = {"x", "ratio"}


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


# ───────────────────────── SEC XBRL utilities ─────────────────────────

_cf_cache = {}


def fetch_companyfacts(cik: int):
    if cik in _cf_cache:
        return _cf_cache[cik]
    padded = f"{cik:010d}"
    url = f"{SEC_BASE}/CIK{padded}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
            cf = json.loads(data)
            _cf_cache[cik] = cf
            time.sleep(SLEEP)
            return cf
    except urllib.error.HTTPError as e:
        log(f"  HTTP {e.code} CIK {cik}")
        _cf_cache[cik] = None
        return None
    except Exception as e:
        log(f"  fetch err CIK {cik}: {e}")
        _cf_cache[cik] = None
        return None


def get_facts(cf, tag):
    if not cf or "facts" not in cf:
        return []
    facts = cf["facts"].get("us-gaap", {})
    if tag not in facts:
        return []
    out = []
    for unit_key, items in facts[tag].get("units", {}).items():
        for it in items:
            it2 = dict(it)
            it2["_unit"] = unit_key
            out.append(it2)
    return out


def quarterly_series(cf, tags, min_year=2020, flow=True):
    """Returns list of (period_label, value, unit, end_date) chrono ascending.

    For FLOW tags (Revenue, NetIncome, EPS, etc.) some filers report YTD
    in 10-Qs. Strategy: bucket by (fy, fp) keeping BEST candidate where
    "best" = quarterly-only period (~90 days) when available. Fallback: keep
    YTD and convert to incremental at the end (Q2_inc = Q2_YTD - Q1_YTD, etc).

    For STOCK tags (Assets, Equity, Cash) values are point-in-time. flow=False.
    """
    from datetime import date

    def period_days(it):
        s = it.get("start"); e = it.get("end")
        if not s or not e:
            return None
        try:
            return (date.fromisoformat(e) - date.fromisoformat(s)).days
        except Exception:
            return None

    # Pick the tag with the most recent data (newer accounting standards)
    tag_choices = []
    for tag in tags:
        facts = get_facts(cf, tag)
        if not facts:
            continue
        max_fy = max((it.get("fy") or 0 for it in facts), default=0)
        tag_choices.append((max_fy, tag, facts))
    if not tag_choices:
        return [], ""
    tag_choices.sort(key=lambda x: -x[0])

    for _, tag, facts in tag_choices:
        # Bucket: (fy, fp) -> list of candidates {val, end, unit, days}
        buckets = {}
        for it in facts:
            fy = it.get("fy"); fp = it.get("fp"); form = it.get("form", "")
            if fy is None or fy < min_year:
                continue
            if fp not in ("Q1", "Q2", "Q3", "Q4", "FY"):
                continue
            if form not in ("10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A", "6-K"):
                continue
            end = it.get("end", "")
            days = period_days(it) if flow else None
            buckets.setdefault((fy, fp), []).append({
                "val": it.get("val"), "end": end, "unit": it["_unit"],
                "days": days, "form": form,
            })
        if not buckets:
            continue

        # Pick best per bucket
        by = {}
        for key, cands in buckets.items():
            fy, fp = key
            if not flow:
                # Stock: pick latest end date
                best = max(cands, key=lambda c: c["end"])
            else:
                if fp == "FY":
                    # Want full year (~365 days)
                    fy_cands = [c for c in cands if c["days"] is None or 300 <= c["days"] <= 400]
                    best = max(fy_cands or cands, key=lambda c: c["end"])
                elif fp in ("Q1", "Q2", "Q3", "Q4"):
                    # Prefer 90-day window
                    q_cands = [c for c in cands if c["days"] is not None and 60 <= c["days"] <= 100]
                    if q_cands:
                        best = max(q_cands, key=lambda c: c["end"])
                        best["_is_quarter"] = True
                    else:
                        # YTD fallback (will incrementalize later)
                        best = max(cands, key=lambda c: c["end"])
                        best["_is_quarter"] = False
            by[key] = best

        unit = next(iter(by.values()))["unit"]
        fys = sorted({fy for (fy, _) in by})
        out = []
        for fy in fys:
            # Build YTD ladder if any non-quarter values found (incrementalize)
            ytd_prev = None
            for fp in ("Q1", "Q2", "Q3"):
                if (fy, fp) not in by:
                    ytd_prev = None
                    continue
                e = by[(fy, fp)]
                v = e["val"]
                if flow and not e.get("_is_quarter", True):
                    # YTD value: subtract previous YTD to get incremental
                    if fp == "Q1":
                        inc = v
                        ytd_prev = v
                    elif ytd_prev is not None and isinstance(v, (int, float)) and isinstance(ytd_prev, (int, float)):
                        inc = v - ytd_prev
                        ytd_prev = v
                    else:
                        ytd_prev = v
                        continue
                    out.append((f"{fp} {fy}", inc, e["unit"], e["end"]))
                else:
                    out.append((f"{fp} {fy}", v, e["unit"], e["end"]))
                    # Also track YTD for incremental Q2/Q3 if those are YTD
                    if fp == "Q1":
                        ytd_prev = v
                    elif ytd_prev is not None and isinstance(v, (int, float)) and isinstance(ytd_prev, (int, float)):
                        ytd_prev = ytd_prev + v
            # Q4
            if (fy, "Q4") in by:
                e = by[(fy, "Q4")]
                v = e["val"]
                if flow and not e.get("_is_quarter", True) and (fy, "FY") in by:
                    # Q4 = FY - Q1Q2Q3 sum
                    fyv = by[(fy, "FY")]["val"]
                    qs = [by.get((fy, q), {}).get("val") for q in ("Q1", "Q2", "Q3")]
                    if all(isinstance(x, (int, float)) for x in [fyv] + qs):
                        # But our out has already incrementalized Q1/Q2/Q3
                        # So sum the LAST 3 in out (they're already increments)
                        last_qs = [x[1] for x in out[-3:]] if len(out) >= 3 else []
                        if len(last_qs) == 3 and all(isinstance(x, (int, float)) for x in last_qs):
                            out.append((f"Q4 {fy}", fyv - sum(last_qs), e["unit"], e["end"]))
                            continue
                out.append((f"Q4 {fy}", v, e["unit"], e["end"]))
            elif (fy, "FY") in by and all((fy, q) in by for q in ("Q1", "Q2", "Q3")):
                fyv = by[(fy, "FY")]["val"]
                last_qs = [x[1] for x in out[-3:]] if len(out) >= 3 else []
                if len(last_qs) == 3 and all(isinstance(x, (int, float)) for x in last_qs + [fyv]):
                    e = by[(fy, "FY")]
                    out.append((f"Q4 {fy}", fyv - sum(last_qs), e["unit"], e["end"]))
        if out:
            return out, unit
    return [], ""


def yearly_series(cf, tags, min_year=2018):
    """Returns list of (year, value, unit, end_date) chrono ascending."""
    tag_choices = []
    for tag in tags:
        facts = get_facts(cf, tag)
        if not facts:
            continue
        max_fy = max((it.get("fy") or 0 for it in facts), default=0)
        tag_choices.append((max_fy, tag, facts))
    if not tag_choices:
        return [], ""
    tag_choices.sort(key=lambda x: -x[0])
    for _, tag, facts in tag_choices:
        by = {}
        for it in facts:
            fy = it.get("fy"); fp = it.get("fp"); form = it.get("form", "")
            if fy is None or fy < min_year:
                continue
            if fp != "FY":
                continue
            if form not in ("10-K", "10-K/A", "20-F", "20-F/A"):
                continue
            end = it.get("end", "")
            cur = by.get(fy)
            if not cur or end > cur.get("end", ""):
                by[fy] = {"val": it.get("val"), "end": end, "unit": it["_unit"]}
        if not by:
            continue
        unit = next(iter(by.values()))["unit"]
        out = []
        for fy in sorted(by):
            e = by[fy]
            out.append((str(fy), e["val"], e["unit"], e["end"]))
        if out:
            return out, unit
    return [], ""


def compute_margin(num, den):
    den_by = {s[0]: s[1] for s in den}
    out = []
    for p, nv, _, e in num:
        dv = den_by.get(p)
        if dv is None or dv == 0:
            continue
        out.append((p, (nv / dv) * 100, "%", e))
    return out


def compute_fcf(ocf, capex):
    cx = {s[0]: s[1] for s in capex}
    out = []
    for p, o, u, e in ocf:
        c = cx.get(p)
        if c is None:
            continue
        out.append((p, o - c, u, e))
    return out


# ───────────────────────── Range [1, 999] scaling ─────────────────────────

def in_range(v):
    if v is None:
        return False
    a = abs(v)
    return 1 <= a < 1000


def is_pct_or_ratio(unit):
    if not unit:
        return False
    u = unit.lower().strip()
    return u in PERCENT_UNITS or u in RATIO_UNITS or u == "x"


def scale_series(values, current_unit):
    """Pick scale factor to keep median in [1, 999]. Returns (new_values, new_unit)."""
    if is_pct_or_ratio(current_unit):
        return values, current_unit
    if not values:
        return values, current_unit
    nonzero = [abs(v) for v in values if isinstance(v, (int, float)) and v != 0]
    if not nonzero:
        return values, current_unit
    med = sorted(nonzero)[len(nonzero) // 2]
    if 1 <= med < 1000:
        return values, current_unit
    # Determine current order
    base_units = {
        "USD": 0, "$": 0, "EUR": 0, "€": 0, "GBP": 0, "JPY": 0,
        "K": 3, "K $": 3, "K€": 3,
        "M": 6, "M $": 6, "M€": 6, "Mn $": 6,
        "B": 9, "Mds $": 9, "B $": 9, "Mds€": 9,
        "T $": 12,
    }
    cur_order = base_units.get(current_unit, 0)
    # Find best target order
    targets = [(0, "$"), (3, "K $"), (6, "M $"), (9, "Mds $")]
    if "€" in (current_unit or ""):
        targets = [(0, "€"), (3, "K€"), (6, "M€"), (9, "Mds€")]
    elif current_unit in ("£", "GBP"):
        targets = [(0, "£"), (3, "K£"), (6, "M£"), (9, "Mds£")]
    best = None
    for order, label in targets:
        delta = cur_order - order
        scaled_med = med * (10 ** delta)
        if 1 <= scaled_med < 1000:
            best = (order, label, delta)
            break
    if not best:
        return values, current_unit
    order, label, delta = best
    factor = 10 ** delta
    new_vals = [round(v * factor, 4) if isinstance(v, (int, float)) else v for v in values]
    return new_vals, label


def display_unit_from_xbrl(unit_xbrl, sample):
    """Pick display unit for raw XBRL value to keep in [1, 999]."""
    if unit_xbrl == "USD/shares":
        return "$", 1.0
    if unit_xbrl == "shares":
        if abs(sample) >= 1e9:
            return "Mds", 1e-9
        if abs(sample) >= 1e6:
            return "M", 1e-6
        return "actions", 1.0
    if unit_xbrl == "USD":
        a = abs(sample)
        if a >= 1e9:
            return "Mds $", 1e-9
        if a >= 1e6:
            return "M $", 1e-6
        if a >= 1e3:
            return "K $", 1e-3
        return "$", 1.0
    return unit_xbrl, 1.0


# ───────────────────────── KPI tag lookup ─────────────────────────

def kpi_lookup_tags(short, name_fr="", name_en=""):
    if short in KPI_TAGS:
        return KPI_TAGS[short]
    text = f"{short} {name_fr} {name_en}".lower()
    if "total revenue" in text or "chiffre d'affaires" in text or "total rev" in text:
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
    if "free cash flow" in text or text.strip() == "fcf":
        return KPI_TAGS["FCF"]
    if "capex" in text or "capital expenditure" in text:
        return KPI_TAGS["Capex"]
    if "r&d" in text or "research and development" in text:
        return KPI_TAGS["R&D"]
    if "total assets" in text or "total actifs" in text:
        return KPI_TAGS["Total Assets"]
    if "stockholders equity" in text or "capitaux propres" in text:
        return KPI_TAGS["Stockholders Equity"]
    if "cash & equiv" in text or "cash and equiv" in text or "trésorerie" in text:
        return KPI_TAGS["Cash and Equivalents"]
    if "op margin" in text or "operating margin" in text or "marge opérationnelle" in text:
        return KPI_TAGS["Op Margin"]
    if "gross margin" in text:
        return KPI_TAGS["Gross Margin"]
    if "net margin" in text or "marge nette" in text:
        return KPI_TAGS["Net Margin"]
    return []


# ───────────────────────── T1: Extension XBRL ─────────────────────────

STOCK_TAGS = {"Assets", "StockholdersEquity", "CashAndCashEquivalentsAtCarryingValue", "Cash"}


def try_extend_kpi(kpi, cf, want_quarter):
    short = kpi.get("short") or ""
    name_fr = kpi.get("name_fr") or ""
    name_en = kpi.get("name_en") or ""
    tags = kpi_lookup_tags(short, name_fr, name_en)
    if not tags:
        return None
    is_stock = any(t in STOCK_TAGS for t in tags)

    if tags == ["__calc__OperatingMargin"]:
        if want_quarter:
            rev, _ = quarterly_series(cf, KPI_TAGS["Total Revenue"])
            opi, _ = quarterly_series(cf, KPI_TAGS["Operating Income"])
        else:
            rev, _ = yearly_series(cf, KPI_TAGS["Total Revenue"])
            opi, _ = yearly_series(cf, KPI_TAGS["Operating Income"])
        series = compute_margin(opi, rev); unit_xbrl = "%"
    elif tags == ["__calc__GrossMargin"]:
        if want_quarter:
            rev, _ = quarterly_series(cf, KPI_TAGS["Total Revenue"])
            gp, _ = quarterly_series(cf, KPI_TAGS["Gross Profit"])
        else:
            rev, _ = yearly_series(cf, KPI_TAGS["Total Revenue"])
            gp, _ = yearly_series(cf, KPI_TAGS["Gross Profit"])
        series = compute_margin(gp, rev); unit_xbrl = "%"
    elif tags == ["__calc__NetMargin"]:
        if want_quarter:
            rev, _ = quarterly_series(cf, KPI_TAGS["Total Revenue"])
            ni, _ = quarterly_series(cf, KPI_TAGS["Net Income"])
        else:
            rev, _ = yearly_series(cf, KPI_TAGS["Total Revenue"])
            ni, _ = yearly_series(cf, KPI_TAGS["Net Income"])
        series = compute_margin(ni, rev); unit_xbrl = "%"
    elif tags == ["__calc__FCF"]:
        if want_quarter:
            ocf, _ = quarterly_series(cf, KPI_TAGS["Op Cash Flow"])
            cx, _ = quarterly_series(cf, KPI_TAGS["Capex"])
        else:
            ocf, _ = yearly_series(cf, KPI_TAGS["Op Cash Flow"])
            cx, _ = yearly_series(cf, KPI_TAGS["Capex"])
        series = compute_fcf(ocf, cx); unit_xbrl = "USD"
    else:
        if want_quarter:
            series, unit_xbrl = quarterly_series(cf, tags, flow=not is_stock)
        else:
            series, unit_xbrl = yearly_series(cf, tags)

    if len(series) < 4:
        return None

    if want_quarter:
        series = series[-20:]
    else:
        series = series[-5:]

    sample = series[-1][1] if series else 0
    disp_unit, factor = display_unit_from_xbrl(unit_xbrl, sample)
    if unit_xbrl == "%":
        disp_unit, factor = "%", 1.0
    history = [round(v * factor, 4) for (_, v, _, _) in series]
    periods = [p for (p, _, _, _) in series]
    last_end = series[-1][3]
    return {
        "history": history,
        "history_periods": periods,
        "unit": disp_unit,
        "last_data_date": last_end,
        "period_type": "quarter" if want_quarter else "year",
        "_xbrl_tag": tags[0] if not tags[0].startswith("__calc__") else tags[0].replace("__calc__", "calc/"),
    }


# ───────────────────────── T2: period_type heuristic ─────────────────────────

def resolve_period_type(kpi):
    pt = kpi.get("period_type")
    if pt in ("quarter", "year"):
        return pt
    hist = kpi.get("history") or []
    n = len(hist)
    ldd = kpi.get("last_data_date") or ""
    if n >= 8:
        return "quarter"
    if 3 <= n <= 7:
        # check if last_data_date is year-end (Dec, Sep for fiscal, etc.)
        m = re.match(r"^\d{4}-(\d{2})-(\d{2})$", ldd)
        if m:
            mm, dd = m.group(1), m.group(2)
            # year-end indicators: Dec 31, Sep 30, Jun 30, Mar 31
            if (mm, dd) in (("12", "31"), ("09", "30"), ("06", "30"), ("03", "31"), ("01", "31"), ("01", "28"), ("01", "29"), ("01", "30")):
                # 5 points = year typical; 6-7 quarters also possible
                if n <= 5:
                    return "year"
                else:
                    return "quarter"
        # Default for n in [3,5]: year
        if n <= 5:
            return "year"
        return "quarter"
    if n == 0:
        return None
    # n in [1,2] : ambiguous
    return None


# ───────────────────────── T3: Sectoriels BS4 segment tables ─────────────────────────

def latest_10q_path(ticker):
    """Find latest 10-Q gzipped HTML for ticker."""
    ticker_u = ticker.upper()
    for year in (2026, 2025, 2024):
        d = SEC_DATA / f"cat1-us/10Q/{year}"
        if not d.exists():
            continue
        candidates = sorted(d.glob(f"{ticker_u}_*.htm.gz"), reverse=True)
        if candidates:
            return candidates[0]
    return None


SEG_HEADERS = re.compile(r"\b(segment|reportable segment|business segment|operating segment|product|geograph|revenu)\b", re.I)


SEG_BLACKLIST = re.compile(
    r"^(total|consolidated|net sales|revenue|revenues|cost|cost of |sales|"
    r"research|selling|general|administr|operating expense|other|"
    r"interest|provision|income|expenses?|margin|%|earnings|basic|diluted|"
    r"net|gross|amortization|depreciation|impairment|tax|stock|cash|"
    r"assets|liabilities|equity|share|weighted)",
    re.I,
)


def looks_like_segment_table(tbl, context_text):
    """Decide if a table is a segment revenue breakdown vs income statement etc."""
    ctx = context_text.lower()
    # Must have explicit segment-revenue context near the table
    has_seg_kw = any(
        kw in ctx for kw in (
            "segment information", "segment results", "operating segments",
            "reportable segments", "segment reporting",
            "disaggregation of revenue", "revenue by segment",
            "revenue by product", "product revenue", "net product sales",
            "geographic revenue", "revenue by geography",
        )
    )
    if not has_seg_kw:
        return False
    text = tbl.get_text(" ", strip=True).lower()
    # Reject obvious income statements
    income_kw = ["cost of sales", "cost of revenue", "selling, general",
                 "research and development", "operating expenses",
                 "provision for income", "net income per share", "diluted shares"]
    nb_income = sum(1 for k in income_kw if k in text)
    if nb_income >= 2:
        return False
    return True


def extract_segment_table(htm_path):
    """Extract segment quarterly revenue from a 10-Q HTML using BS4.
    Returns dict {seg_name: {value_M_USD: float, period_end: str}} or {}."""
    try:
        with gzip.open(htm_path, "rb") as f:
            html = f.read().decode("utf-8", errors="replace")
    except Exception:
        return {}
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return {}
    soup = BeautifulSoup(html, "html.parser")
    m = re.search(r"_(\d{4}-\d{2}-\d{2})", htm_path.name)
    period_end = m.group(1) if m else ""

    segments = {}
    tables = soup.find_all("table")
    for idx, tbl in enumerate(tables):
        # Look at preceding text (heading + paragraph) for context
        prev_text_parts = []
        prev = tbl.find_previous(["h1", "h2", "h3", "h4", "p"])
        i = 0
        while prev is not None and i < 6:
            prev_text_parts.append(prev.get_text(" ", strip=True))
            prev = prev.find_previous(["h1", "h2", "h3", "h4", "p"])
            i += 1
        context = " ".join(prev_text_parts)
        if not looks_like_segment_table(tbl, context):
            continue
        rows = tbl.find_all("tr")
        if len(rows) < 3 or len(rows) > 25:
            continue
        local_segs = {}
        for r in rows:
            cells = r.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            name = cells[0].get_text(" ", strip=True)
            if not name or len(name) > 50 or len(name) < 3:
                continue
            if SEG_BLACKLIST.match(name):
                continue
            if "%" in name or name.endswith(":"):
                continue
            # Get first numeric cell with $ or number
            for c in cells[1:]:
                txt = c.get_text(" ", strip=True)
                if "%" in txt:
                    break
                neg = "(" in txt and ")" in txt
                clean = re.sub(r"[^\d.]", "", txt)
                if not clean or clean.count(".") > 1:
                    continue
                try:
                    val = float(clean)
                except ValueError:
                    continue
                if neg:
                    val = -val
                if 0.5 < val < 5e5:
                    local_segs[name] = {"value_M": val, "period_end": period_end}
                break
        # Must have at least 3 reasonable segments to consider this a segment table
        if len(local_segs) >= 3 and len(local_segs) <= 15:
            for n, v in local_segs.items():
                segments.setdefault(n, v)
        if len(segments) >= 10:
            break
    if len(segments) < 2:
        return {}
    # Final cleanup: trim
    return dict(list(segments.items())[:8])


# ───────────────────────── Main processing ─────────────────────────

def deep_merge_kpi_list(existing_kpis, new_kpis_by_short, fix_log_entry):
    """Merge in-place additive. Returns updated list + flag if changed."""
    out = list(existing_kpis)
    by_short = {k.get("short"): i for i, k in enumerate(out) if k.get("short")}
    changed = False
    for short, update in new_kpis_by_short.items():
        if short in by_short:
            idx = by_short[short]
            cur = out[idx]
            for k, v in update.items():
                if v is None:
                    continue
                cur[k] = v
            changed = True
        else:
            # New KPI append
            out.append(update)
            changed = True
    return out, changed


TICKER_SLUG_ALIASES = {
    "ABLZF": "abbn.sw",
    "NDA-SE.ST": "nda-fi.he",
}


def process_ticker(ticker, cik_index):
    slug = TICKER_SLUG_ALIASES.get(ticker, ticker.lower())
    p_pipe = PIPELINE / f"{slug}.json"
    p_enr = ENRICH / f"{slug}.json"
    if not p_pipe.exists():
        return f"{ticker}: no pipeline file"
    try:
        pipe = json.loads(p_pipe.read_text())
    except Exception as e:
        return f"{ticker}: pipe load err {e}"
    try:
        enr = json.loads(p_enr.read_text()) if p_enr.exists() else {"ticker": ticker, "kpis": []}
    except Exception as e:
        return f"{ticker}: enrich load err {e}"

    upper = ticker.upper()
    entry = cik_index.get(upper) or cik_index.get(ticker)
    cik = entry.get("cik") if isinstance(entry, dict) else None

    cf = None
    if cik:
        cf = fetch_companyfacts(cik)

    fix_notes = []
    summary = {"t1_extend": 0, "t2_resolved": 0, "t3_sectoriels": 0}

    # --- T2 first: resolve period_type=None for pipeline AND enrich
    for src_name, src_data in (("pipe", pipe), ("enr", enr)):
        for k in src_data.get("kpis") or []:
            if k.get("period_type") in (None, "", "unknown"):
                resolved = resolve_period_type(k)
                if resolved:
                    k["period_type"] = resolved
                    k.setdefault("_period_type_source", "SA24-C heuristic")
                    summary["t2_resolved"] += 1

    # --- T1: extend short histories where mappable
    pipe_updates = {}  # short -> partial dict
    enr_updates = {}
    if cf:
        for k in pipe.get("kpis") or []:
            short = k.get("short")
            if not short:
                continue
            pt = k.get("period_type")
            hist = k.get("history") or []
            n = len(hist)
            need = (pt == "quarter" and n < 20) or (pt == "year" and n < 5)
            if not need:
                continue
            want_q = (pt == "quarter")
            ext = try_extend_kpi(k, cf, want_q)
            if not ext:
                continue
            # Apply [1, 999] scaling unless % or ratio
            cur_unit = ext["unit"]
            new_hist, new_unit = scale_series(ext["history"], cur_unit)
            ext["history"] = new_hist
            ext["unit"] = new_unit
            # Only update if extension is actually longer
            if len(ext["history"]) > n:
                pipe_updates[short] = {
                    "history": ext["history"],
                    "history_periods": ext["history_periods"],
                    "last_data_date": ext["last_data_date"],
                    "unit": ext["unit"],
                    "period_type": ext["period_type"],
                    "_xbrl_tag": ext["_xbrl_tag"],
                    "_extended_by": "SA24-C SEC XBRL",
                }
                summary["t1_extend"] += 1

        for k in enr.get("kpis") or []:
            short = k.get("short")
            if not short:
                continue
            pt = k.get("period_type")
            hist = k.get("history") or []
            n = len(hist)
            need = (pt == "quarter" and n < 20) or (pt == "year" and n < 5)
            if not need:
                continue
            want_q = (pt == "quarter")
            ext = try_extend_kpi(k, cf, want_q)
            if not ext:
                continue
            cur_unit = ext["unit"]
            new_hist, new_unit = scale_series(ext["history"], cur_unit)
            ext["history"] = new_hist
            ext["unit"] = new_unit
            if len(ext["history"]) > n:
                enr_updates[short] = {
                    "history": ext["history"],
                    "history_periods": ext["history_periods"],
                    "last_data_date": ext["last_data_date"],
                    "unit": ext["unit"],
                    "period_type": ext["period_type"],
                    "_xbrl_tag": ext["_xbrl_tag"],
                    "_extended_by": "SA24-C SEC XBRL",
                }
                summary["t1_extend"] += 1

    # --- T3: sectoriels BS4 (DISABLED: deterministic extraction too unreliable
    # without LLM disambiguation between segment table vs income statement.
    # Set SA24C_T3=1 to re-enable for experimentation.)
    new_sectoriels = []
    if cik and os.environ.get("SA24C_T3"):  # only US filers
        htm = latest_10q_path(ticker)
        if htm:
            segs = extract_segment_table(htm)
            # Existing KPI shorts to avoid duplication
            existing_shorts = {k.get("short", "").lower() for k in (pipe.get("kpis") or []) + (enr.get("kpis") or [])}
            for seg_name, info in segs.items():
                short = seg_name[:30]
                if short.lower() in existing_shorts:
                    continue
                val_m = info["value_M"]
                # Scale to keep in [1, 999]
                if val_m >= 1000:
                    val = round(val_m / 1000, 2)
                    unit = "Mds $"
                else:
                    val = round(val_m, 1)
                    unit = "M $"
                if not in_range(val):
                    continue
                new_sectoriels.append({
                    "short": short,
                    "name_fr": f"Revenu segment {seg_name}",
                    "name_en": f"Segment Revenue {seg_name}",
                    "value": val,
                    "unit": unit,
                    "history": [val],
                    "history_periods": [info["period_end"]],
                    "last_data_date": info["period_end"],
                    "period_type": "quarter",
                    "type": "Sectoriel",
                    "_source": "SA24-C BS4 10-Q segment table",
                })
                existing_shorts.add(short.lower())
                summary["t3_sectoriels"] += 1

    # Apply updates
    if pipe_updates:
        new_kpis, ch = deep_merge_kpi_list(pipe.get("kpis", []), pipe_updates, None)
        if ch:
            pipe["kpis"] = new_kpis
            pipe.setdefault("_fix_log", [])
            pipe["_fix_log"].append(f"SA24-C XBRL extend: +{len(pipe_updates)} KPIs")
            fix_notes.append("pipe extended")

    enr_changes_made = False
    if enr_updates or new_sectoriels or any(k.get("_period_type_source") == "SA24-C heuristic" for k in enr.get("kpis") or []):
        # Merge enr_updates
        if enr_updates:
            new_kpis, _ = deep_merge_kpi_list(enr.get("kpis", []), enr_updates, None)
            enr["kpis"] = new_kpis
            enr_changes_made = True
        # Append sectoriels
        if new_sectoriels:
            enr.setdefault("kpis", [])
            enr["kpis"].extend(new_sectoriels)
            enr_changes_made = True
        # Period type changes
        if any(k.get("_period_type_source") == "SA24-C heuristic" for k in enr.get("kpis") or []):
            enr_changes_made = True

    if enr_changes_made or (enr is not None and summary["t2_resolved"] > 0):
        enr.setdefault("_fix_log", [])
        note = f"SA24-C 2026-06-03: T1={summary['t1_extend']} T2={summary['t2_resolved']} T3={summary['t3_sectoriels']}"
        enr["_fix_log"].append(note)

    # Write files
    wrote = []
    if pipe_updates or any(k.get("_period_type_source") == "SA24-C heuristic" for k in pipe.get("kpis") or []):
        p_pipe.write_text(json.dumps(pipe, ensure_ascii=False, indent=2))
        wrote.append("pipe")
    if enr_changes_made or summary["t2_resolved"] > 0 or new_sectoriels:
        # Always rewrite if any change applied via period_type direct mutation
        p_enr.write_text(json.dumps(enr, ensure_ascii=False, indent=2))
        wrote.append("enr")

    return f"{ticker}: T1={summary['t1_extend']} T2={summary['t2_resolved']} T3={summary['t3_sectoriels']} wrote={','.join(wrote) or 'none'}"


def main():
    cik_index = json.loads(CIK_INDEX.read_text())
    batches = []
    for i in (8, 9, 10, 11):
        f = Path(f"/tmp/sa24-batch-{i:02d}.json")
        if not f.exists():
            log(f"missing batch {i}")
            continue
        batches.extend(json.loads(f.read_text()))
    # Dedup keeping order
    seen = set(); tickers = []
    for t in batches:
        if t not in seen:
            seen.add(t); tickers.append(t)
    log(f"=== SA24-C START: {len(tickers)} tickers ===")
    counts = {"ok": 0, "err": 0}
    for i, t in enumerate(tickers, 1):
        try:
            r = process_ticker(t, cik_index)
            log(f"[{i}/{len(tickers)}] {r}")
            counts["ok"] += 1
        except Exception as e:
            log(f"[{i}/{len(tickers)}] {t}: ERR {type(e).__name__}: {e}")
            counts["err"] += 1
    log(f"=== DONE counts={counts} ===")


if __name__ == "__main__":
    main()
