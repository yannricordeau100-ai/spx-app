#!/usr/bin/env python3
"""enrich-capex-kpi.py — Extraire Capex comme KPI standalone pour stés
de /tmp/scope-660.txt et l'ajouter dans v2-pipeline-enrich/<t>.json
champ `kpis_supplementary` (APPEND).

Sources :
- US (no suffix) : SEC EDGAR XBRL companyconcept us-gaap/PaymentsToAcquirePropertyPlantAndEquipment
  fallback yfinance.cashflow["Capital Expenditure"]
- EU/FPI (avec suffixe) : yfinance.cashflow["Capital Expenditure"]

Anti-doublon : skip si Capex déjà présent dans data.kpis OR kpis_supplementary.

Output : append dans v2-pipeline-enrich/<t>.json -> kpis_supplementary[]
Schéma KPI :
  {
    "short": "Capex",
    "name_fr": "Investissements (Capex)",
    "name_en": "Capital Expenditures",
    "value": <last absolute>,
    "unit": "Mds $" or "M $",
    "yoy": "+X.X%" or "-X.X%",
    "history": [5y absolute],
    "period_type": "year",
    "_source": "SEC XBRL" or "yfinance"
  }

Note: les Capex sont stockés en valeurs POSITIVES (magnitude des investissements).
yfinance les renvoie négatifs (cashflow sortant), SEC XBRL les renvoie positifs
(PaymentsToAcquirePropertyPlantAndEquipment = montant payé).
"""
import json
import os
import re
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

try:
    import yfinance as yf
except ImportError:
    print("pip install yfinance required", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX_PATH = PROJECT_ROOT / "sec-data/_meta/cat1-cat2-index.json"
SCOPE_FILE = Path(os.environ.get("SCOPE_FILE", "/tmp/scope-660.txt"))

UA = "Mettrik Data Pipeline contact@mettrik.ai"

XBRL_KEYS = [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
]

SEC_SLEEP = 0.12  # ~8 req/sec
YF_SLEEP = 0.5  # rate limit yfinance


def has_capex_kpi(d: dict) -> bool:
    """Check if Capex KPI already exists in kpis or kpis_supplementary."""
    if not isinstance(d, dict):
        return False
    for key in ("kpis", "kpis_supplementary"):
        arr = d.get(key) or []
        if not isinstance(arr, list):
            continue
        for k in arr:
            if not isinstance(k, dict):
                continue
            short = (k.get("short") or "").lower()
            name_en = (k.get("name_en") or "").lower()
            name_fr = (k.get("name_fr") or "").lower()
            if "capex" in short or "capex" in name_en or "capital expenditure" in name_en or "investissements" in name_fr and "capex" in name_fr:
                return True
            if "capital expenditure" in name_fr:
                return True
    return False


def fetch_sec_companyconcept(cik: int, key: str):
    padded = f"{cik:010d}"
    url = f"https://data.sec.gov/api/xbrl/companyconcept/CIK{padded}/us-gaap/{key}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
            import gzip
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
            return json.loads(data)
    except urllib.error.HTTPError as e:
        if e.code in (404, 403):
            return None
        return None
    except Exception:
        return None


def extract_sec_annual(cc: dict, max_points: int = 5):
    """From companyconcept JSON, get annual FY values (10-K) in USD."""
    if not cc:
        return []
    units = cc.get("units", {})
    usd = units.get("USD") or next(iter(units.values()), None)
    if not usd:
        return []
    annual = {}
    for item in usd:
        if item.get("form") not in ("10-K", "10-K/A", "20-F", "20-F/A"):
            continue
        if item.get("fp") != "FY":
            continue
        fy = item.get("fy")
        val = item.get("val")
        if fy is None or val is None:
            continue
        if fy not in annual or item.get("end", "") > annual[fy].get("end", ""):
            annual[fy] = {"val": val, "end": item.get("end", "")}
    if not annual:
        return []
    sorted_fy = sorted(annual.keys())[-max_points:]
    return [(fy, annual[fy]["val"]) for fy in sorted_fy]


def yf_capex_series(ticker: str, max_points: int = 5):
    """Get annual Capital Expenditure from yfinance cashflow. Returns list of (year, abs_value)."""
    try:
        t = yf.Ticker(ticker)
        cf = t.cashflow
    except Exception:
        return []
    if cf is None or cf.empty:
        return []
    # Try multiple possible keys
    candidates = ["Capital Expenditure", "Capital Expenditures",
                  "CapitalExpenditure", "Purchase Of Ppe"]
    row = None
    for k in candidates:
        if k in cf.index:
            row = cf.loc[k]
            break
    if row is None:
        return []
    out = []
    for col, val in row.items():
        if val is None:
            continue
        try:
            if hasattr(val, "isna") and val.isna():
                continue
            if isinstance(val, float) and (val != val):
                continue
            year = col.year if hasattr(col, "year") else int(str(col)[:4])
            v = abs(float(val))  # store positive magnitude
            out.append((year, v))
        except Exception:
            continue
    out.sort(key=lambda x: x[0])
    return out[-max_points:]


def format_capex_kpi(series, source: str):
    """Build the kpis_supplementary entry from a list of (year, value_in_usd_or_local)."""
    if not series or len(series) < 2:
        return None
    vals = [v for _, v in series]
    last = vals[-1]
    prev = vals[-2]
    # Choose unit : Mds $ if >= 1e9, else M $
    if last >= 1e9:
        history = [round(v / 1e9, 2) for v in vals]
        unit = "Mds $"
    else:
        history = [round(v / 1e6, 1) for v in vals]
        unit = "M $"
    last_h = history[-1]
    prev_h = history[-2]
    yoy = ""
    if prev_h and prev_h != 0:
        pct = (last_h - prev_h) / abs(prev_h) * 100
        yoy = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
    return {
        "short": "Capex",
        "name_fr": "Investissements (Capex)",
        "name_en": "Capital Expenditures",
        "value": last_h,
        "unit": unit,
        "yoy": yoy,
        "history": history,
        "period_type": "year",
        "_source": source,
        "_extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def load_enrich(tk: str):
    """Load v2-pipeline-enrich/<lower>.json (create empty dict if missing)."""
    p = ENRICH / f"{tk.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            if isinstance(d, dict):
                return p, d
        except Exception:
            pass
    return p, {"ticker": tk}


def save_enrich(p: Path, d: dict):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    if not SCOPE_FILE.exists():
        print(f"missing scope file {SCOPE_FILE}", file=sys.stderr)
        sys.exit(1)
    tickers = [t.strip() for t in SCOPE_FILE.read_text().splitlines() if t.strip()]
    cik_index = json.loads(CIK_INDEX_PATH.read_text())

    print(f"Capex enrichment scope: {len(tickers)} stés", flush=True)

    n_enriched = 0
    n_skip_existing = 0
    n_fail = 0
    n_no_pipeline = 0
    last_sec = 0.0

    for i, tk in enumerate(tickers):
        if i and i % 50 == 0:
            print(f"  [{i}/{len(tickers)}] enriched={n_enriched} skip={n_skip_existing} fail={n_fail} no_pipe={n_no_pipeline}", flush=True)

        # Load pipeline + enrich to check existing Capex (anti-doublon)
        pipe_path = PIPELINE / f"{tk.lower()}.json"
        if not pipe_path.exists():
            # ticker may be uppercase suffix .L .PA etc; try direct
            pipe_path_alt = PIPELINE / f"{tk}.json"
            if pipe_path_alt.exists():
                pipe_path = pipe_path_alt
        pipe_d = {}
        if pipe_path.exists():
            try:
                pipe_d = json.loads(pipe_path.read_text())
            except Exception:
                pipe_d = {}

        enrich_path, enrich_d = load_enrich(tk)

        if has_capex_kpi(pipe_d) or has_capex_kpi(enrich_d):
            n_skip_existing += 1
            continue

        # If neither pipeline nor enrich, still proceed (create new enrich)
        is_us = "." not in tk
        capex_kpi = None

        # 1) US -> SEC XBRL first
        if is_us and tk in cik_index:
            elapsed = time.time() - last_sec
            if elapsed < SEC_SLEEP:
                time.sleep(SEC_SLEEP - elapsed)
            cik = cik_index[tk].get("cik")
            if cik:
                for key in XBRL_KEYS:
                    cc = fetch_sec_companyconcept(int(cik), key)
                    last_sec = time.time()
                    series = extract_sec_annual(cc, max_points=5)
                    if series and len(series) >= 2:
                        capex_kpi = format_capex_kpi(series, "SEC XBRL")
                        break

        # 2) Fallback yfinance for US or main path for EU/FPI
        if not capex_kpi:
            time.sleep(YF_SLEEP)
            series = yf_capex_series(tk, max_points=5)
            if series and len(series) >= 2:
                capex_kpi = format_capex_kpi(series, "yfinance")

        if not capex_kpi:
            n_fail += 1
            continue

        # APPEND to kpis_supplementary
        ks = enrich_d.get("kpis_supplementary")
        if not isinstance(ks, list):
            ks = []
        ks.append(capex_kpi)
        enrich_d["kpis_supplementary"] = ks
        try:
            save_enrich(enrich_path, enrich_d)
            n_enriched += 1
        except Exception as e:
            n_fail += 1
            print(f"  write fail {tk}: {e}", file=sys.stderr)

    print(f"DONE: enriched={n_enriched} skip_existing={n_skip_existing} fail={n_fail} no_pipe={n_no_pipeline}", flush=True)


if __name__ == "__main__":
    main()
