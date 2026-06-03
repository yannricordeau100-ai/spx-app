#!/usr/bin/env python3
"""SA24-F : SYSTEMIC FIX V1.9.5 batches 20-23 (~85 stés).

3 tâches :
  1. Extension history via SEC EDGAR XBRL companyfacts
     - quarter & len<20 : tente d'allonger jusqu'à 16-20 trims
     - year & len<5    : tente d'allonger jusqu'à 5-10 ans
  2. period_type=None / 'None' -> heuristique year/quarter
  3. Nouveaux KPIs sectoriels via BS4 sur 10-Q cat1-us (whitelist conservatrice)

Règle 1-999 : rescale value + history dans plage lisible (Mds, M, $ unitaire).
Deep merge dans v2-pipeline-enrich/<slug>.json avec _fix_log = ['SA24-F ...'].

ZERO API payante (Anthropic interdit, Cerebras épuisé).
SEC EDGAR companyfacts = gratuit, illimité, rate-limit 10 req/sec.
Anti-invention strict : aucune valeur fabriquée.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path("/Users/yann/spx-app")
BASE_DIR = ROOT / "src/data/v2-pipeline"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX_PATH = ROOT / "sec-data/_meta/cat1-cat2-index.json"
SEC_DATA = Path("/Users/yann/Mettrik/sec-data")
CAT1_10Q = SEC_DATA / "cat1-us/10Q"

UA = "Mettrik Data Pipeline contact@mettrik.ai"
SLEEP = 0.12  # ~8 req/sec sous limite SEC 10
MARKER = "SA24-F"
NOW_ISO = datetime.now(timezone.utc).isoformat()

# ----- XBRL concept maps -----
# (short token, list of xbrl-keys, default unit, kpi_type)
XBRL_CONCEPTS = OrderedDict([
    ("revenue", (["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                  "SalesRevenueNet", "SalesRevenueGoodsNet"], "Mds $", "Revenue")),
    ("net_income", (["NetIncomeLoss", "ProfitLoss",
                      "NetIncomeLossAvailableToCommonStockholdersBasic"], "Mds $", "Profit")),
    ("operating_income", (["OperatingIncomeLoss"], "Mds $", "Profit")),
    ("gross_profit", (["GrossProfit"], "Mds $", "Profit")),
    ("eps_diluted", (["EarningsPerShareDiluted"], "$", "EPS")),
    ("eps_basic", (["EarningsPerShareBasic"], "$", "EPS")),
    ("total_assets", (["Assets"], "Mds $", "Balance Sheet")),
    ("stockholders_equity", (["StockholdersEquity"], "Mds $", "Balance Sheet")),
    ("op_cash_flow", (["NetCashProvidedByUsedInOperatingActivities"], "Mds $", "Cash Flow")),
    ("capex", (["PaymentsToAcquirePropertyPlantAndEquipment"], "Mds $", "Cash Flow")),
    ("cash", (["CashAndCashEquivalentsAtCarryingValue", "Cash"], "Mds $", "Balance Sheet")),
    ("long_term_debt", (["LongTermDebt", "LongTermDebtNoncurrent"], "Mds $", "Balance Sheet")),
    ("rd_expense", (["ResearchAndDevelopmentExpense"], "M $", "Opex")),
    ("interest_expense", (["InterestExpense"], "M $", "Opex")),
    ("dps", (["CommonStockDividendsPerShareDeclared",
              "CommonStockDividendsPerShareCashPaid"], "$", "Dividend")),
])

# Mapping from KPI short text -> XBRL concept key.
# IMPORTANT: only match TRUE consolidated-totals (Total Revenue, Net Income, etc.).
# Sub-segment revenue (AI Ad Revenue, Premium Revenue, etc.) must NOT match
# because XBRL companyfacts only has the consolidated value.
SHORT_PATTERNS = [
    # (regex pattern anchored to full short text (lowercase), concept_key)
    (r"^(total\s+)?revenues?$|^total\s+net\s+sales$|^net\s+sales$|^revenu(s)?$|^chiffre\s+d.affaire(s)?$|^total\s+rev$", "revenue"),
    (r"^net\s+income$|^r[ée]sultat\s+net$|^net\s+earnings$|^net\s+income\s+from\s+continuing\s+ops$", "net_income"),
    (r"^operating\s+income$|^op\s+income$|^r[ée]sultat\s+op[ée]rationnel$|^op\s+profit$|^adj\s+operating(\s+income)?$|^operating\s+profit$", "operating_income"),
    (r"^gross\s+profit$|^b[ée]n[ée]fice\s+brut$", "gross_profit"),
    (r"^diluted\s+eps$|^bpa\s+dilu[ée]$|^eps\s+diluted$|^diluted\s+earnings?\s+per\s+share$", "eps_diluted"),
    (r"^eps$|^basic\s+eps$|^bpa\s+(de\s+)?base$", "eps_basic"),
    (r"^total\s+assets$|^actifs\s+totaux$", "total_assets"),
    (r"^stockholders?\s+equity$|^capitaux\s+propres$", "stockholders_equity"),
    (r"^(net\s+)?operating\s+cash\s+flow$|^op\s+cash\s+flow$|^cash\s+from\s+ops?$|^flux\s+de\s+tr[ée]sorerie\s+(d.)?(exploitation|op[ée]rations?)$|^operating\s+cash$", "op_cash_flow"),
    (r"^capex$|^cap\s+ex$|^d[ée]penses\s+d.investissement$|^capital\s+expenditure$", "capex"),
    (r"^cash$|^cash\s+(\&|and)\s+(equiv|cash)|^tr[ée]sorerie$", "cash"),
    (r"^(long.?term|lt)\s+debt$|^dette\s+(long|à\s+long)\s+terme$|^total\s+debt$", "long_term_debt"),
    (r"^r\s*&\s*d$|^research\s+and\s+development$|^rd\s+expense$|^research\s*&\s*development\s+expense$", "rd_expense"),
    (r"^interest\s+expense$|^charges?\s+d.int[ée]r[êe]ts?$", "interest_expense"),
    (r"^dps$|^dividend\s+per\s+share$|^dividende\s+par\s+action$|^dividends?\s+per\s+share\s+(declared|paid)$", "dps"),
]


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ----- SEC EDGAR XBRL companyfacts fetch -----
_cf_cache: dict[int, dict | None] = {}
_last_call = 0.0

def fetch_companyfacts(cik: int) -> dict | None:
    global _last_call
    if cik in _cf_cache:
        return _cf_cache[cik]
    # rate limit
    el = time.time() - _last_call
    if el < SLEEP:
        time.sleep(SLEEP - el)
    _last_call = time.time()
    padded = f"{cik:010d}"
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=40) as r:
            import io as _io
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            data = json.loads(raw)
            _cf_cache[cik] = data
            return data
    except urllib.error.HTTPError as e:
        if e.code == 404:
            _cf_cache[cik] = None
            return None
        log(f"   HTTP {e.code} for CIK {cik}")
        _cf_cache[cik] = None
        return None
    except Exception as e:
        log(f"   EXC fetch CIK {cik}: {e}")
        _cf_cache[cik] = None
        return None


def _fact_units(cf: dict, key: str) -> dict | None:
    if not cf or "facts" not in cf:
        return None
    facts = cf["facts"]
    # try us-gaap first then ifrs-full
    for ns in ("us-gaap", "ifrs-full"):
        if key in facts.get(ns, {}):
            return facts[ns][key].get("units")
    return None


def _series_for_key(cf: dict, key: str, mode: str, max_points: int) -> list[tuple[str, float]]:
    """Return ordered series (period_label, value).
    mode='year' uses 10-K/20-F FY filings; 'quarter' uses 10-Q.
    period_label = 'FY2024' or 'Q3 2024'.
    """
    units = _fact_units(cf, key)
    if not units:
        return []
    # Prefer USD/USD-per-shares
    unit_data = units.get("USD") or units.get("USD/shares") or next(iter(units.values()), None)
    if not unit_data:
        return []
    pool: dict[str, dict] = {}  # period_label -> {val, filed}
    for item in unit_data:
        form = item.get("form", "")
        fp = item.get("fp", "")
        fy = item.get("fy")
        val = item.get("val")
        end = item.get("end", "")
        filed = item.get("filed", "")
        if fy is None or val is None:
            continue
        if mode == "year":
            if form not in ("10-K", "10-K/A", "20-F", "20-F/A"):
                continue
            if fp != "FY":
                continue
            label = f"FY{fy}"
        else:  # quarter
            if form not in ("10-Q", "10-Q/A"):
                continue
            if fp not in ("Q1", "Q2", "Q3"):
                # Q4 derived elsewhere (not stored as 10-Q)
                continue
            label = f"{fp} {fy}"
        prev = pool.get(label)
        if not prev or filed > prev.get("filed", ""):
            pool[label] = {"val": val, "filed": filed, "end": end}
    if not pool:
        return []
    # Sort by end date or label
    items = sorted(pool.items(), key=lambda kv: kv[1].get("end", ""))
    items = items[-max_points:]
    return [(lab, float(d["val"])) for lab, d in items]


def get_series(cf: dict, concept_key: str, mode: str, max_points: int) -> list[tuple[str, float]]:
    """Try each candidate XBRL key for concept_key; return first non-empty series."""
    keys, _, _ = XBRL_CONCEPTS[concept_key]
    for k in keys:
        s = _series_for_key(cf, k, mode, max_points)
        if len(s) >= 4:
            return s
    return []


# ----- Rescale 1-999 -----
def _as_numeric_history(values: list) -> list[float]:
    """Coerce a heterogenous history array into a flat list of numerics.
    Items may be numbers, None, or dicts of shape {value, quarter, ...}.
    Strings are best-effort parsed."""
    out: list[float] = []
    for v in values or []:
        if v is None:
            continue
        if isinstance(v, (int, float)):
            out.append(float(v))
        elif isinstance(v, dict):
            x = v.get("value")
            if isinstance(x, (int, float)):
                out.append(float(x))
        elif isinstance(v, str):
            try:
                out.append(float(v.replace(",", ".").strip()))
            except ValueError:
                pass
    return out


def auto_rescale(values: list, current_unit: str) -> tuple[list, str, bool]:
    """Rescale values to keep dominant magnitude in 1-999 range.
    Returns (new_values, new_unit, changed). Accepts mixed dict/numeric histories."""
    nums = _as_numeric_history(values)
    if not nums:
        return values, current_unit, False
    abs_vals = [abs(v) for v in nums]
    abs_vals = [v for v in abs_vals if v > 1e-9]
    if not abs_vals:
        return values, current_unit, False
    abs_vals.sort()
    median = abs_vals[len(abs_vals) // 2]

    unit_l = (current_unit or "").lower()

    def _rescale(v, factor):
        if isinstance(v, (int, float)):
            return round(v * factor, 3)
        if isinstance(v, dict) and isinstance(v.get("value"), (int, float)):
            nv = dict(v)
            nv["value"] = round(v["value"] * factor, 3)
            return nv
        return v

    # If current is M and median > 1000 => rescale to Mds
    if ("md" not in unit_l and "billion" not in unit_l) and ("m " in unit_l + " " or unit_l.startswith("m")) and median >= 1000:
        new_unit = current_unit
        new_unit = re.sub(r"\bM\b", "Mds", new_unit, count=1) if re.search(r"\bM\b", new_unit) else current_unit + " (Mds)"
        new_vals = [_rescale(v, 1.0 / 1000.0) for v in values]
        return new_vals, new_unit if new_unit != current_unit else "Mds $", True
    # If Mds and median < 1 => rescale to M
    if ("md" in unit_l or "billion" in unit_l) and median < 1.0:
        new_unit = re.sub(r"Mds", "M", current_unit) if "Mds" in current_unit else "M $"
        new_vals = [_rescale(v, 1000.0) for v in values]
        return new_vals, new_unit, True
    return values, current_unit, False


# ----- Heuristic period_type -----
def derive_period_type(k: dict, hero_short: str = "", hero_pt: str | None = None) -> str | None:
    """Heuristique year/quarter pour KPI sans period_type."""
    pt = k.get("period_type")
    if pt and pt not in ("None", "null"):
        return pt
    h = k.get("history") or []
    n = len(h)
    sht = (k.get("short") or "").lower()
    ktype = (k.get("type") or "").lower()
    name_fr = (k.get("name_fr") or "").lower()
    desc = (k.get("description") or "").lower()
    sig = (k.get("signal") or "").lower()

    text = f"{sht} {name_fr} {desc} {sig}"

    # Strong signals quarter
    if re.search(r"\b(q[1-4]|trim(estre)?|quarter|sequential)\b", text):
        return "quarter"
    # Strong signals annual
    if re.search(r"\b(annual|yearly|annuel|fiscal year|fy\s?20|exercice)\b", text):
        return "year"

    # Dividend/Payout KPIs : annual by convention if 5-10 points
    if any(tok in sht for tok in ["dps", "payout", "cap return", "dividend"]):
        if 3 <= n <= 12:
            return "year"

    # Length-based heuristic (after textual checks)
    if n == 0:
        return None  # nothing to infer
    if n <= 7:
        # 3-7 points typical of annual
        # Hero context: if hero is quarterly and this KPI has same length, lean quarter
        if hero_pt == "quarter" and n >= 4:
            return "quarter"
        return "year"
    if n >= 8:
        # 8+ typical quarterly OR longer annual
        # If <=10 and hero is annual, treat annual
        if hero_pt == "year" and n <= 10:
            return "year"
        return "quarter"
    return None


# ----- KPI short -> concept matching -----
def match_kpi_concept(short: str, name_fr: str = "", kpi_type: str = "") -> str | None:
    if not short:
        return None
    # Try matching short alone first, then name_fr alone (each must match
    # the full string thanks to ^...$ anchors).
    candidates = [short.strip().lower()]
    nf = (name_fr or "").strip().lower()
    if nf and nf != candidates[0]:
        candidates.append(nf)
    for text in candidates:
        for pat, key in SHORT_PATTERNS:
            if re.search(pat, text):
                return key
    return None


# ----- Find Q4 from annual - Q1-Q2-Q3 -----
def derive_q4_series(cf: dict, concept_key: str, max_points: int = 20) -> list[tuple[str, float]]:
    """Compute Q4 = FY - (Q1+Q2+Q3) for each year, then merge with Q1-Q3 series."""
    annual = get_series(cf, concept_key, "year", max_points=8)
    qtr = get_series(cf, concept_key, "quarter", max_points=24)
    if not annual or not qtr:
        return qtr
    # Index quarters by fy
    by_fy: dict[int, dict[str, float]] = {}
    for lab, v in qtr:
        m = re.match(r"Q([1-3])\s+(\d{4})", lab)
        if not m:
            continue
        q = int(m.group(1)); fy = int(m.group(2))
        by_fy.setdefault(fy, {})[f"Q{q}"] = v
    extra = []
    for lab, fyv in annual:
        m = re.match(r"FY(\d{4})", lab)
        if not m:
            continue
        fy = int(m.group(1))
        qs = by_fy.get(fy, {})
        if "Q1" in qs and "Q2" in qs and "Q3" in qs:
            q4 = fyv - (qs["Q1"] + qs["Q2"] + qs["Q3"])
            extra.append((f"Q4 {fy}", q4))
    merged = list(qtr) + extra
    # Sort by year-quarter
    def keyfn(item):
        lab = item[0]
        m = re.match(r"Q([1-4])\s+(\d{4})", lab)
        if m:
            return (int(m.group(2)), int(m.group(1)))
        return (0, 0)
    merged.sort(key=keyfn)
    return merged[-max_points:]


# ----- Load v2-pipeline + v2-pipeline-enrich -----
def slug_for(ticker: str) -> str:
    return ticker.lower().replace(" ", "_")


def load_base(ticker: str) -> tuple[Path, dict | None]:
    p = BASE_DIR / f"{slug_for(ticker)}.json"
    if not p.exists():
        return p, None
    try:
        return p, json.loads(p.read_text())
    except Exception:
        return p, None


def load_enrich(ticker: str) -> tuple[Path, dict]:
    p = ENRICH_DIR / f"{slug_for(ticker)}.json"
    if p.exists():
        try:
            return p, json.loads(p.read_text())
        except Exception:
            return p, {}
    return p, {}


# ----- BS4 sectoral KPI extraction -----
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


def latest_10q_files(ticker: str, max_n: int = 6) -> list[Path]:
    out = []
    for year in (2024, 2025, 2026):
        d = CAT1_10Q / str(year)
        if not d.exists():
            continue
        out.extend(sorted(d.glob(f"{ticker.upper()}_*.htm.gz")))
    out.sort()
    return out[-max_n:]


def read_html_gz(path: Path) -> str:
    try:
        with gzip.open(path, "rt", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


# Curated sectoral patterns: keys are regex of segment label in 10-Q
SECTORAL_PATTERNS = [
    # (regex pattern matching segment row label, KPI short suggestion)
    # Conservative: only if regex matches AND value extracted as $-amount near it.
]


def extract_segment_table_text(html: str, max_chars: int = 30000) -> str:
    """Strip HTML and focus on segment information section of a 10-Q."""
    if not html:
        return ""
    # Quick strip
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"\s+", " ", txt)
    # Find segment info section (after TOC ~10% of doc)
    sectors = []
    body_start = len(txt) // 10
    body = txt[body_start:]
    for pat in (r"Segment\s+Information", r"Reportable\s+Segments?",
                r"Revenue\s+by\s+(Segment|Reportable|Business|End\s+Market|Product|Geography)",
                r"Net\s+Sales\s+by\s+(Segment|Reportable|Business)",
                r"Results\s+of\s+Operations"):
        for m in re.finditer(pat, body, re.IGNORECASE):
            s = max(0, m.start() - 200)
            e = min(len(body), m.start() + 6000)
            sectors.append((s, e))
    if not sectors:
        return ""
    sectors.sort()
    merged = []
    for s, e in sectors:
        if merged and s <= merged[-1][1] + 200:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    chunks = [body[s:e] for s, e in merged[:4]]
    out = " | ".join(chunks)
    return out[:max_chars]


# ----- Main per-ticker processor -----
class TickerReport:
    def __init__(self, ticker: str):
        self.ticker = ticker
        self.task1_history_extended = 0  # KPIs whose history grew
        self.task2_period_type_set = 0   # KPIs whose period_type was inferred
        self.task3_new_kpis_added = 0
        self.rescaled = 0
        self.skipped_reason: str | None = None
        self.notes: list[str] = []


def process_ticker(ticker: str, cik_index: dict, dry_run: bool = False) -> TickerReport:
    rep = TickerReport(ticker)
    base_path, base = load_base(ticker)
    if base is None:
        rep.skipped_reason = "no v2-pipeline file"
        return rep
    enrich_path, enrich = load_enrich(ticker)

    base_kpis = base.get("kpis") or []
    if not base_kpis:
        rep.skipped_reason = "no kpis in base"
        return rep

    # Get hero context
    hero_short = base.get("hero_kpi") or ""
    hero_kpi = next((k for k in base_kpis if k.get("short") == hero_short), None)
    hero_pt = (hero_kpi or {}).get("period_type")
    if hero_pt in ("None", "null"):
        hero_pt = None

    # Fetch companyfacts if US/ADR ticker
    cik_info = cik_index.get(ticker.upper()) or cik_index.get(ticker)
    cik = cik_info.get("cik") if cik_info else None
    cf = fetch_companyfacts(cik) if cik else None

    # The enrich kpis = overlay layer. We collect modifications keyed by short.
    # Don't mutate base; only put deltas in enrich["kpis"] as overrides.
    # However site rendering already deep-merges enrich on top of base in v2 pipeline.
    enrich_kpis = enrich.get("kpis") or []
    enrich_kpi_by_short: dict[str, dict] = {}
    for ek in enrich_kpis:
        sh = ek.get("short")
        if sh:
            enrich_kpi_by_short[sh] = ek

    def get_overlay(short: str) -> dict:
        if short not in enrich_kpi_by_short:
            enrich_kpi_by_short[short] = {"short": short}
        return enrich_kpi_by_short[short]

    # Iterate base KPIs to plan modifications
    for k in base_kpis:
        sht = k.get("short", "")
        if not sht:
            continue
        # Current state (taking into account existing overlay)
        ov = enrich_kpi_by_short.get(sht, {})
        cur_history = ov.get("history") if isinstance(ov.get("history"), list) else (k.get("history") or [])
        cur_pt = ov.get("period_type") or k.get("period_type")
        if cur_pt in ("None", "null"):
            cur_pt = None
        cur_unit = ov.get("unit") or k.get("unit") or ""

        modified = False
        fix_log_entries = []

        # ---- TASK 2 : period_type heuristic ----
        if cur_pt is None:
            inferred = derive_period_type(k, hero_short=hero_short, hero_pt=hero_pt)
            if inferred:
                overlay = get_overlay(sht)
                overlay["period_type"] = inferred
                overlay["_period_type_source"] = "SA24-F heuristic"
                cur_pt = inferred
                rep.task2_period_type_set += 1
                modified = True
                fix_log_entries.append(f"{MARKER} period_type=None -> '{inferred}' (heuristic)")

        # ---- TASK 1 : extend history via SEC XBRL ----
        need_ext_q = cur_pt == "quarter" and len(cur_history) < 20
        need_ext_y = cur_pt == "year" and len(cur_history) < 5
        if cf and (need_ext_q or need_ext_y):
            concept_key = match_kpi_concept(sht, k.get("name_fr", ""), k.get("type", ""))
            if concept_key:
                if cur_pt == "quarter":
                    series = derive_q4_series(cf, concept_key, max_points=20)
                else:
                    series = get_series(cf, concept_key, "year", max_points=8)
                # Only accept if strictly longer than current
                if series and len(series) > len(cur_history):
                    # Compute divisor based on existing unit
                    unit_l = cur_unit.lower()
                    if "md" in unit_l or "billion" in unit_l:
                        div = 1e9
                    elif "m " in unit_l + " " or unit_l.startswith("m ") or unit_l == "m $" or "million" in unit_l:
                        div = 1e6
                    elif concept_key in ("eps_diluted", "eps_basic", "dps"):
                        div = 1.0
                    else:
                        # default Mds for monetary, $ for EPS
                        div = 1e9
                    new_vals = [round(v / div, 4) for _, v in series]
                    new_labels = [lab for lab, _ in series]
                    # Sanity: ensure series direction = ascending (oldest -> newest)
                    overlay = get_overlay(sht)
                    overlay["history"] = new_vals
                    overlay["history_periods"] = new_labels
                    overlay["value"] = new_vals[-1]
                    overlay["_history_source"] = "SEC EDGAR XBRL companyfacts"
                    overlay["_history_extracted_at"] = NOW_ISO
                    # Compute YoY same-period
                    if cur_pt == "quarter" and len(new_vals) >= 5:
                        prev_same = new_vals[-5]
                        if prev_same != 0:
                            pct = (new_vals[-1] - prev_same) / abs(prev_same) * 100
                            overlay["yoy"] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
                    elif cur_pt == "year" and len(new_vals) >= 2:
                        prev = new_vals[-2]
                        if prev != 0:
                            pct = (new_vals[-1] - prev) / abs(prev) * 100
                            overlay["yoy"] = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
                    rep.task1_history_extended += 1
                    modified = True
                    cur_history = new_vals
                    fix_log_entries.append(
                        f"{MARKER} history {cur_pt}: {len(k.get('history') or [])} -> {len(new_vals)} via XBRL"
                    )

        # ---- RESCALE 1-999 ----
        if cur_history:
            new_vals, new_unit, changed = auto_rescale(list(cur_history), cur_unit)
            if changed:
                overlay = get_overlay(sht)
                overlay["history"] = new_vals
                if new_vals:
                    overlay["value"] = new_vals[-1]
                overlay["unit"] = new_unit
                overlay["_unit_rescaled"] = f"{cur_unit} -> {new_unit} for 1-999 readability"
                rep.rescaled += 1
                modified = True
                fix_log_entries.append(f"{MARKER} rescale {cur_unit} -> {new_unit}")

        # Persist _fix_log entries
        if fix_log_entries:
            overlay = get_overlay(sht)
            existing_log = overlay.get("_fix_log") or []
            overlay["_fix_log"] = existing_log + fix_log_entries

    # ---- TASK 3 : new sectoral KPIs via BS4 on 10-Q ----
    if HAS_BS4 and cik_info:  # Only US/ADR
        existing_shorts = {k.get("short", "").strip().lower() for k in base_kpis}
        existing_shorts |= {k.get("short", "").strip().lower() for k in enrich_kpis}
        new_kpis = extract_new_sectoral_kpis(ticker, existing_shorts)
        if new_kpis:
            # Append them to enrich
            for nk in new_kpis:
                nk["_fix_log"] = [f"{MARKER} new sectoral KPI via 10-Q BS4 whitelist"]
                # Append to enrich kpi list (not by short overlay since it's new)
                enrich_kpi_by_short[f"_new::{nk['short']}"] = nk
            rep.task3_new_kpis_added = len(new_kpis)

    # Rebuild enrich kpis list (overlays then new)
    overlay_list = []
    overlay_keys = []
    # Preserve existing enrich kpi entries order; merge updates
    existing_shorts_in_enrich = [ek.get("short") for ek in enrich_kpis]
    for ek in enrich_kpis:
        sh = ek.get("short")
        if sh and sh in enrich_kpi_by_short:
            overlay_list.append(enrich_kpi_by_short[sh])
            overlay_keys.append(sh)
        else:
            overlay_list.append(ek)
    # Add new overlays not previously present
    for sh, ov in enrich_kpi_by_short.items():
        if sh.startswith("_new::"):
            overlay_list.append(ov)
            continue
        if sh not in existing_shorts_in_enrich:
            overlay_list.append(ov)
    # Strip empty overlays (no useful keys beyond 'short')
    overlay_list = [o for o in overlay_list if len(o) > 1]

    has_changes = (rep.task1_history_extended + rep.task2_period_type_set
                   + rep.task3_new_kpis_added + rep.rescaled) > 0
    if has_changes and not dry_run:
        if overlay_list:
            enrich["kpis"] = overlay_list
        enrich.setdefault("_sa24_f", {})
        enrich["_sa24_f"] = {
            "at": NOW_ISO,
            "history_extended": rep.task1_history_extended,
            "period_type_set": rep.task2_period_type_set,
            "new_sectoral_kpis": rep.task3_new_kpis_added,
            "rescaled": rep.rescaled,
        }
        # Ensure ticker key
        enrich.setdefault("ticker", ticker.upper())
        enrich_path.write_text(json.dumps(enrich, ensure_ascii=False, indent=2))

    return rep


def extract_new_sectoral_kpis(ticker: str, existing_shorts: set[str]) -> list[dict]:
    """Conservative BS4 extraction of new sectoral KPIs from latest 10-Q.

    Strategy: parse latest 4 10-Q files. Look for HTML tables containing the
    word 'Segment' or 'Revenue by' in caption/header. Extract row labels +
    quarterly $ values. Only emit a KPI if:
      - row label is a clear product/segment (1-4 words, mostly alphabetic)
      - at least 3 quarters of values found
      - values strictly numeric (after stripping $, ',', '(') and within
        sane bounds (1e5 .. 1e12)
      - short not already present (case-insensitive)
    Returns empty list if anything ambiguous.
    """
    files = latest_10q_files(ticker, max_n=6)
    if len(files) < 2:
        return []
    # Maintain per-label values across filings (label -> ordered list of (period, val))
    series_by_label: dict[str, list[tuple[str, float]]] = {}

    for fp in files:
        # Period from filename YYYY-MM-DD
        m = re.search(r"_(\d{4})-(\d{2})-(\d{2})\.htm", fp.name)
        if not m:
            continue
        y = int(m.group(1)); mo = int(m.group(2))
        # Quarter calendar approx (filing month -> quarter ending prior)
        if mo <= 4:
            q_label = f"Q4 {y - 1}"  # FY-end roll? actually 10-Q never Q4. likely FY
            continue  # skip annual-ish 10-Qs that may be 10-K
        elif mo <= 6:
            q_label = f"Q1 {y}"
        elif mo <= 9:
            q_label = f"Q2 {y}"
        else:
            q_label = f"Q3 {y}"
        html = read_html_gz(fp)
        if not html:
            continue
        try:
            soup = BeautifulSoup(html, "html.parser")
        except Exception:
            continue
        # Find tables whose caption/header mentions segment/revenue
        tables = soup.find_all("table")
        for tbl in tables[:200]:  # cap to avoid huge cost
            txt = tbl.get_text(" ", strip=True).lower()[:600]
            if not re.search(r"(segment|revenue by|net sales by|reportable)", txt):
                continue
            # Skip tables that are obviously TOC or item index
            if re.search(r"item\s+\d+\.|table of contents", txt):
                continue
            for tr in tbl.find_all("tr"):
                cells = tr.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                # Label = first cell text; value = first numeric cell that looks like $
                label_raw = cells[0].get_text(" ", strip=True)
                label = re.sub(r"\s+", " ", label_raw).strip()
                if not label or len(label) > 60:
                    continue
                # Filter: alphabetic-dominant, 1-5 words, no $, no %, no parens
                if re.search(r"[\$%()]|\d", label):
                    continue
                if not re.search(r"[A-Za-z]", label):
                    continue
                if len(label.split()) > 5:
                    continue
                # Reject single super-short tokens that are likely headers
                if len(label) < 3:
                    continue
                # Aggressive blacklist of any income-statement / balance-sheet / cash-flow line.
                # We only want product / business-line / geography names.
                bl_re = re.compile(
                    r"(?:^|\W)("
                    r"total|net|gross|other|revenue|sales|income|expense|expenses|"
                    r"cost|costs|operating|consolidated|segment|reportable|"
                    r"amortization|amortized|depreciation|depreciated|forex|"
                    r"foreign\s+exchange|interest|tax|taxes|loss|losses|gain|gains|"
                    r"adjustment|impairment|restructur|goodwill|intangible|"
                    r"intangibles|writeoff|writeoffs|write-off|adjusted|ebitda|ebit|"
                    r"margin|compensation|stock-based|share-based|equity|liabilities|"
                    r"asset|assets|debt|cash|capex|capital|earnings|profit|payments|"
                    r"receivables|payables|inventory|inventories|allowance|provision|"
                    r"distributions|dividends|royalty|royalties|payable|receivable|"
                    r"deferred|accrued|contingent|warranty|pension|benefit|insurance|"
                    r"lease|leases|right-of-use|impaired|stockholders|shareholders|"
                    r"comprehensive|amortisation"
                    r")\w*",
                    re.I,
                )
                if bl_re.search(label):
                    continue
                # Find first numeric cell
                value = None
                for c in cells[1:]:
                    ct = c.get_text(" ", strip=True)
                    if not ct:
                        continue
                    cleaned = ct.replace(",", "").replace("$", "").strip()
                    neg = cleaned.startswith("(") and cleaned.endswith(")")
                    cleaned = cleaned.strip("()")
                    try:
                        v = float(cleaned)
                    except ValueError:
                        continue
                    if neg:
                        v = -v
                    # Sanity bounds
                    if abs(v) < 1.0 or abs(v) > 1e7:
                        continue
                    # Value generally in millions in 10-Q tables (1 - 10M = thousand-mil)
                    value = v
                    break
                if value is None:
                    continue
                series_by_label.setdefault(label, []).append((q_label, value))

    # Filter: keep labels with >= 3 distinct quarters and consistent sign-magnitude
    out: list[dict] = []
    for label, vals in series_by_label.items():
        # Dedupe by q_label keeping last
        seen: dict[str, float] = {}
        for q, v in vals:
            seen[q] = v
        if len(seen) < 3:
            continue
        # Reject if already exists (case-insensitive)
        if label.strip().lower() in existing_shorts:
            continue
        # Order by year-quarter
        ordered = sorted(seen.items(), key=lambda kv: (int(kv[0].split()[1]), int(kv[0][1])))
        periods = [p for p, _ in ordered]
        values = [v for _, v in ordered]
        # Magnitude check: similar order of magnitude within the same KPI
        if max(values) > 0 and min(values) > 0:
            ratio = max(values) / min(values)
            if ratio > 10:
                continue
        # Assume millions $; convert if >1000 to Mds
        median = sorted(values)[len(values) // 2]
        if median >= 1000:
            values_disp = [round(v / 1000, 3) for v in values]
            unit = "Mds $"
        else:
            values_disp = [round(v, 1) for v in values]
            unit = "M $"
        short = label.strip()
        # YoY same-Q
        yoy = ""
        if len(values_disp) >= 5 and values_disp[-5] != 0:
            pct = (values_disp[-1] - values_disp[-5]) / abs(values_disp[-5]) * 100
            yoy = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
        new_kpi = {
            "short": short,
            "name_fr": short,
            "name_en": short,
            "value": values_disp[-1],
            "unit": unit,
            "yoy": yoy,
            "history": values_disp,
            "history_periods": periods,
            "period_type": "quarter",
            "type": "Revenue",
            "nature": "Conjoncturel",
            "comparable": "Comparable",
            "signal": "",
            "description": f"{short} extrait via parser BS4 sur tables 'Segment Information' / 'Revenue by Segment' des 10-Q SEC EDGAR (cat1-us).",
            "_source": "SEC 10-Q BS4 whitelist",
            "_extracted_at": NOW_ISO,
        }
        out.append(new_kpi)
        # Limit to 5 per ticker to avoid noise
        if len(out) >= 5:
            break
    return out


# ----- Driver -----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batches", default="20,21,22,23")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only-ticker")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-task3", action="store_true")
    args = ap.parse_args()

    cik_index = json.loads(CIK_INDEX_PATH.read_text())

    tickers: list[str] = []
    if args.only_ticker:
        tickers = [args.only_ticker]
    else:
        for b in args.batches.split(","):
            b = b.strip()
            p = Path(f"/tmp/sa24-batch-{b}.json")
            if p.exists():
                tickers.extend(json.loads(p.read_text()))
    if args.limit:
        tickers = tickers[:args.limit]

    log(f"SA24-F processing {len(tickers)} stés (batches {args.batches})")
    log(f"Tasks: 1=XBRL history extension, 2=period_type heuristic"
        f"{', 3=BS4 new sectoral' if not args.skip_task3 else ''}, +rescale 1-999")

    totals = {
        "ok": 0, "skipped": 0,
        "t1": 0, "t2": 0, "t3": 0, "rescale": 0,
    }
    skipped_tickers: list[str] = []
    if args.skip_task3:
        # monkey-patch
        global extract_new_sectoral_kpis
        _orig = extract_new_sectoral_kpis
        def _noop(*a, **k): return []
        extract_new_sectoral_kpis = _noop

    for i, tk in enumerate(tickers, 1):
        try:
            rep = process_ticker(tk, cik_index, dry_run=args.dry_run)
        except Exception as e:
            log(f"  [{i}/{len(tickers)}] {tk:10s} EXC: {e}")
            skipped_tickers.append(tk)
            totals["skipped"] += 1
            continue
        if rep.skipped_reason:
            log(f"  [{i}/{len(tickers)}] {tk:10s} SKIP: {rep.skipped_reason}")
            skipped_tickers.append(tk)
            totals["skipped"] += 1
            continue
        totals["ok"] += 1
        totals["t1"] += rep.task1_history_extended
        totals["t2"] += rep.task2_period_type_set
        totals["t3"] += rep.task3_new_kpis_added
        totals["rescale"] += rep.rescaled
        log(f"  [{i}/{len(tickers)}] {tk:10s} t1={rep.task1_history_extended} "
            f"t2={rep.task2_period_type_set} t3={rep.task3_new_kpis_added} rs={rep.rescaled}")

    log("=" * 60)
    log(f"DONE ok={totals['ok']} skipped={totals['skipped']} | "
        f"hist_ext={totals['t1']} pt_set={totals['t2']} "
        f"new_kpis={totals['t3']} rescaled={totals['rescale']}")
    if skipped_tickers:
        log(f"SKIPPED: {skipped_tickers}")


if __name__ == "__main__":
    main()
