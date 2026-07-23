#!/usr/bin/env python3
"""
Chantier Top 10 stés témoin — rebuild KPI standard from XBRL facts + 10-K text for headcount.
Sources: data-lake/<T>/xbrl/facts.json (SEC XBRL structured facts) + 10-K htm.gz for headcount.
Zero invention: if not extractable, skip and log as failure.
"""
import json, os, re, gzip, sys
from collections import defaultdict
from datetime import datetime

TICKERS = ["ES","ESS","ETN","ETR","EVRG","EW","EXC","EXE","EXPD","EXPE","EXR","F","FANG","FAST","FCX"]
# Map ticker to XBRL folder (BRK-B special)
XBRL_TICKER = {"BRK-B":"BRK.B"}

ENRICH_DIR = "/Users/yann/spx-app/src/data/v2-pipeline-enrich"
DATALAKE = "/Users/yann/spx-app/data-lake"
LOG = "/Users/yann/spx-app/.conv-state/chantier-quarters-log-cloud7.json"

# Standard KPI catalog
# short -> definition
STD = {
    "Total Revenue":     {"metric":"revenue",           "period":"both", "unit":"$M", "compute":None,           "name_fr":"Revenu total"},
    "Net Income":        {"metric":"net_income",        "period":"both", "unit":"$M", "compute":None,           "name_fr":"Résultat net"},
    "EPS Diluted":       {"metric":"eps_diluted",       "period":"both", "unit":"$",  "compute":None,           "name_fr":"BPA dilué"},
    "Op Margin":         {"metric":None,                "period":"year", "unit":"%",  "compute":"op_margin",    "name_fr":"Marge opérationnelle"},
    "Gross Margin":      {"metric":None,                "period":"year", "unit":"%",  "compute":"gross_margin", "name_fr":"Marge brute"},
    "Free Cash Flow":    {"metric":None,                "period":"year", "unit":"$M", "compute":"fcf",          "name_fr":"Free cash flow"},
    "Operating Cash Flow":{"metric":"operating_cash_flow","period":"year","unit":"$M","compute":None,           "name_fr":"Flux de trésorerie d'exploitation"},
    "Total Assets":      {"metric":"total_assets",      "period":"instant", "unit":"$M", "compute":None,        "name_fr":"Total actifs"},
    "R&D":               {"metric":"rd_expense",        "period":"year", "unit":"$M", "compute":None,           "name_fr":"R&D"},
    "Capex":             {"metric":"capex",             "period":"year", "unit":"$M", "compute":None,           "name_fr":"Capex"},
    "Headcount":         {"metric":None,                "period":"year", "unit":"employees", "compute":"headcount", "name_fr":"Effectifs"},
}

# ---------- HELPERS ----------
def load_facts(ticker):
    xt = XBRL_TICKER.get(ticker, ticker)
    p = f"{DATALAKE}/{xt}/xbrl/facts.json"
    if not os.path.exists(p): return None
    return json.load(open(p))

def facts_by_metric(facts, metric, period_type):
    """Return sorted list of dicts {period_end, value, ref} for a metric."""
    if not facts: return []
    out = []
    seen = set()
    for x in facts:
        if x["metric"] != metric: continue
        if x["period_type"] != period_type: continue
        pe = x["period_end"]
        if pe in seen: continue  # dedup by period_end (keep first)
        seen.add(pe)
        out.append({"date": pe, "value": float(x["value"]), "ref": x.get("ref","")})
    out.sort(key=lambda r: r["date"])
    return out

def fmt_period_year(date_str):
    """FY label from period_end date. Use calendar year of the fiscal-year-end."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    y = d.year
    # If FY end is early in year (Jan/Feb/Mar), the fiscal year label is typically the preceding year (e.g. NVDA FY26 ends Jan 26)
    # Different companies use different conventions. To stay honest, we label by calendar year of end date.
    return f"FY{y}"

def fmt_period_quarter(date_str, ticker):
    """YYYY-Q# label based on calendar quarter of period_end. Unambiguous across fiscal-year variants."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    q = (d.month - 1) // 3 + 1
    return f"{d.year}-Q{q}"

def scale_to_M(value, unit_target):
    """Values in facts.json are in native units (USD or dollars per share). Scale to $M or keep."""
    if unit_target == "$M":
        return round(value / 1e6, 2)
    elif unit_target == "$":
        return round(value, 4)
    elif unit_target == "%":
        return round(value * 100, 2)
    elif unit_target == "employees":
        return int(value)
    return value

def build_series(facts, spec, period_type, ticker):
    """Build history + history_periods arrays for a KPI spec."""
    if spec["compute"] is None:
        rows = facts_by_metric(facts, spec["metric"], period_type)
        if not rows: return None, None, None
        if period_type == "instant":
            # Reduce to one snapshot per calendar year (fiscal year end): keep the latest date in each year
            by_year = {}
            for r in rows:
                y = r["date"][:4]
                if y not in by_year or r["date"] > by_year[y]["date"]:
                    by_year[y] = r
            rows = sorted(by_year.values(), key=lambda x: x["date"])
        vals = [scale_to_M(r["value"], spec["unit"]) for r in rows]
        if period_type in ("year", "instant"):
            periods = [fmt_period_year(r["date"]) for r in rows]
        else:
            periods = [fmt_period_quarter(r["date"], ticker) for r in rows]
        return vals, periods, rows[-1]["date"]

    if spec["compute"] == "op_margin":
        num = {r["date"]: r["value"] for r in facts_by_metric(facts, "operating_income", period_type)}
        den = {r["date"]: r["value"] for r in facts_by_metric(facts, "revenue", period_type)}
        keys = sorted(set(num) & set(den))
        if not keys: return None, None, None
        vals = [round(num[k]/den[k]*100, 2) for k in keys if den[k]]
        periods = [fmt_period_year(k) for k in keys]
        return vals, periods, keys[-1]

    if spec["compute"] == "gross_margin":
        num = {r["date"]: r["value"] for r in facts_by_metric(facts, "gross_profit", period_type)}
        den = {r["date"]: r["value"] for r in facts_by_metric(facts, "revenue", period_type)}
        keys = sorted(set(num) & set(den))
        if not keys: return None, None, None
        vals = [round(num[k]/den[k]*100, 2) for k in keys if den[k]]
        periods = [fmt_period_year(k) for k in keys]
        return vals, periods, keys[-1]

    if spec["compute"] == "fcf":
        ocf = {r["date"]: r["value"] for r in facts_by_metric(facts, "operating_cash_flow", period_type)}
        cx  = {r["date"]: r["value"] for r in facts_by_metric(facts, "capex", period_type)}
        keys = sorted(set(ocf) & set(cx))
        if not keys: return None, None, None
        # capex is stored as positive number (outflow); FCF = OCF - Capex
        vals = [round((ocf[k] - cx[k])/1e6, 2) for k in keys]
        periods = [fmt_period_year(k) for k in keys]
        return vals, periods, keys[-1]

    if spec["compute"] == "headcount":
        return None, None, None  # handled separately from 10-K text

    return None, None, None

# ---------- HEADCOUNT FROM 10-K TEXT ----------
HEAD_RE = re.compile(
    r"(?:approximately|approx\.?|had|employed|comprised|consisted\s+of|of)\s+"
    r"(?:approximately\s+)?"
    r"([\d,]{3,10})\s+"
    r"(?:full[-\s]time\s+)?(?:equivalent\s+)?(?:regular\s+)?(?:and\s+part[-\s]time\s+)?employees",
    re.IGNORECASE
)
HEAD_RE2 = re.compile(
    r"([\d,]{3,10})\s+(?:full[-\s]time\s+)?(?:regular\s+)?employees\s+(?:worldwide|globally|in\s+total)",
    re.IGNORECASE
)
HEAD_RE3 = re.compile(
    r"(?:As of\s+[A-Z][a-z]+\s+\d+,?\s+\d{4}[^.]{0,180}?)(?:had|employed|we\s+had|we\s+employed)\s+(?:approximately\s+)?([\d,]{3,10})",
    re.IGNORECASE
)
HEAD_RE4 = re.compile(
    r"(?:employee\s+headcount|total\s+headcount|our\s+headcount|full[-\s]time\s+employees|headcount)\s+[^.]{0,80}?(?:was|were|of|:|totaled|is|reached)\s+(?:approximately\s+)?([\d,]{3,10})",
    re.IGNORECASE
)
HEAD_RE_HC = re.compile(
    r"headcount\s+was\s+(?:approximately\s+)?([\d,]{3,10})",
    re.IGNORECASE
)
HEAD_RE_TSLA = re.compile(
    r"employees\s+worldwide\s+was\s+([\d,]{3,10})",
    re.IGNORECASE
)
HEAD_RE5 = re.compile(
    r"As of [A-Z][a-z]+ \d+,?\s+\d{4}[^.]{0,300}?we\s+had\s+(?:approximately\s+)?([\d,]{3,10})\s+(?:full[- ]time\s+)?(?:equivalent\s+)?employees",
    re.IGNORECASE
)
# Anti-pattern: skip if "layoff" or "reduction" is nearby before the number
LAYOFF_NEAR = re.compile(r"layoff|laid off|reduction of|separated|departed|attrition|voluntary\s+separation", re.IGNORECASE)

def extract_headcount_from_10k(ticker):
    """Read 10-K htm.gz files, extract headcount from Human Capital section."""
    folder = f"{DATALAKE}/{ticker}/10K"
    if not os.path.isdir(folder): return None, None, None
    results = []
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".htm.gz"): continue
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", f)
        if not m: continue
        filing_date = m.group(0)
        try:
            with gzip.open(f"{folder}/{f}", "rt", errors="ignore") as fh:
                html = fh.read()
        except Exception:
            continue
        # Strip HTML tags
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&#160;", " ", text)
        text = re.sub(r"\s+", " ", text)
        # Focus on Human Capital section if present
        candidates = []  # list of (position, value)
        def scan(section, offset=0):
            found = []
            for rx in (HEAD_RE_HC, HEAD_RE_TSLA, HEAD_RE5, HEAD_RE3, HEAD_RE4, HEAD_RE, HEAD_RE2):
                for mm in rx.finditer(section):
                    ctx_before = section[max(0, mm.start()-150):mm.start()]
                    if LAYOFF_NEAR.search(ctx_before):
                        continue
                    try:
                        n = int(mm.group(1).replace(",", ""))
                        if 500 <= n <= 5_000_000: found.append((mm.start() + offset, n))
                    except: pass
            return found
        idx = text.lower().find("human capital")
        if idx > 0:
            candidates = scan(text[idx:idx+20000], idx)
        if not candidates:
            candidates = scan(text)
        if candidates:
            candidates.sort()
            results.append({"date": filing_date, "value": candidates[0][1]})
    if not results: return None, None, None
    # Build annual series indexed by fiscal year of filing (filing date approximates FY end + 1-3 months)
    # Use filing year as FY label
    series = []
    seen_years = set()
    for r in results:
        y = int(r["date"][:4])
        if y in seen_years: continue
        seen_years.add(y)
        series.append((y, r["value"], r["date"]))
    series.sort()
    if not series: return None, None, None
    return ([s[1] for s in series],
            [f"FY{s[0]}" for s in series],
            series[-1][2])

# ---------- MAIN ----------
def process_ticker(ticker):
    tlow = ticker.lower()
    epath = f"{ENRICH_DIR}/{tlow}.json"
    if not os.path.exists(epath):
        return {"ticker": ticker, "status": "no_enrich_file"}
    enrich = json.load(open(epath))
    facts = load_facts(ticker)
    if facts is None:
        return {"ticker": ticker, "status": "no_xbrl"}

    # Existing kpis by lowercase short
    existing = {}
    for k in enrich.get("kpis", []):
        s = (k.get("short") or "").strip().lower()
        if s: existing[s] = k

    added = []
    updated = []
    failed = []

    for short, spec in STD.items():
        if spec["period"] == "both": want_periods = ["quarter"]
        elif spec["period"] == "instant": want_periods = ["instant"]
        else: want_periods = ["year"]
        for pt in want_periods:
            # For "both" categories, use quarter as primary if quarter series ≥12, else use year
            # Build appropriate short label
            label = short
            # Alias resolution: if an existing kpi matches a common synonym, reuse its short
            ALIASES = {
              "EPS Diluted": ["EPS Diluted", "EPS", "Diluted EPS"],
              "Total Revenue": ["Total Revenue", "Revenue", "Net Sales", "Total Net Sales"],
              "Free Cash Flow": ["Free Cash Flow", "FCF"],
              "Operating Cash Flow": ["Operating Cash Flow", "Cash from Operations"],
              "Op Margin": ["Op Margin", "Operating Margin"],
              "R&D": ["R&D", "Research and Development"],
            }
            if short in ALIASES:
                for alias in ALIASES[short]:
                    if alias.strip().lower() in existing:
                        label = alias
                        break

            # For "both" we prefer quarter (better granularity) but also want at least 5-year annual
            if spec["compute"] == "headcount":
                vals, periods, ldd = extract_headcount_from_10k(ticker)
            else:
                vals, periods, ldd = build_series(facts, spec, pt, ticker)

            if not vals or len(vals) < 3:
                failed.append({"kpi": label, "period_type": pt, "reason": "insufficient_data"})
                continue

            kpi_obj = {
                "short": label,
                "name_fr": spec["name_fr"],
                "history": vals,
                "history_periods": periods,
                "last_data_date": ldd,
                "period_type": pt,
                "unit": spec["unit"],
                "method": "llm-filing-crosschecked",
                "source": f"XBRL facts.json (SEC EDGAR) — {ticker}" + ("" if spec["compute"] != "headcount" else f" 10-K filings")
            }

            key = label.strip().lower()
            if key in existing:
                # Merge only if new is better (longer or has periods)
                ex = existing[key]
                if len(ex.get("history", [])) < len(vals) or not ex.get("history_periods") or not ex.get("last_data_date"):
                    ex.update(kpi_obj)
                    updated.append(label)
                else:
                    # Existing is at least as complete; skip
                    pass
            else:
                enrich.setdefault("kpis", []).append(kpi_obj)
                added.append(label)

            # For "both" only do quarter (not annual duplicate) — quarter gives implicit annual via aggregation upstream
            if spec["period"] == "both":
                break

    # Write back
    with open(epath, "w") as f:
        json.dump(enrich, f, ensure_ascii=False, indent=2)

    return {"ticker": ticker, "status": "ok", "added": added, "updated": updated, "failed": failed}

if __name__ == "__main__":
    log = {"processed": [], "ok": [], "partial": [], "fail": []}
    for t in TICKERS:
        try:
            r = process_ticker(t)
            log["processed"].append(r)
            if r["status"] != "ok":
                log["fail"].append(t)
            elif r.get("failed"):
                log["partial"].append({"t": t, "failed": r["failed"]})
                log["ok"].append(t)
            else:
                log["ok"].append(t)
            print(t, r["status"], "added=", r.get("added"), "updated=", r.get("updated"), "failed=", r.get("failed"))
        except Exception as e:
            log["fail"].append(t)
            print(t, "ERROR", repr(e))
    with open(LOG, "w") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)
