#!/usr/bin/env python3
"""Shared helpers for the Super-KPI XBRL backfill mission.

Objectif : remplir les inputs manquants (Total Revenue, Operating Margin,
Capex) des Super-KPI (Rule of 40, Capital Intensity, Quality of Compounding,
Concentration Risk) pour les stés US, en mode PROGRAMMATIQUE (SEC EDGAR
companyfacts XBRL, zéro LLM).

Les KPIs ajoutés portent `is_generic: true` → masqués à l'affichage via
`isGenericKpi(short)` mais lus par `src/lib/super-kpi.ts` (findRevenueKpi /
findMarginKpi / findCapexKpi).

RÈGLE : verbatim XBRL ou rien. Jamais inventer. NULL/skip si tag absent.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
CLEAN_TICKERS = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
CIK_INDEX_PATH = ROOT / "sec-data/_meta/cat1-cat2-index.json"

# Mapping ticker -> canonical (réplique src/lib/company-core/load-company.ts
# ALIASES, sous-ensemble pertinent pour le périmètre US). On garde large pour
# ne pas casser une résolution future.
ALIASES = {
    "GOOG": "GOOGL",
    "BRK.A": "BRK-B",
    "BRK-A": "BRK-B",
    "BRK.B": "BRK-B",
    "FOX": "FOXA",
    "NWSA": "NWS",
    "UAA": "UA",
}


def load_us_tickers() -> list[str]:
    """Univers US = tickers SANS suffixe pays (pas de point).

    Les share classes `.B` (BF.B, BRK.B) sont US-listed -> conservées.
    Les suffixes pays (.PA/.L/.DE/.SW/.AS/.MI/.ST/.HE/.OL/.MC/.BR/.T/.AX/.LS/.CO)
    sont SKIP (pas de XBRL US).
    """
    data = json.loads(CLEAN_TICKERS.read_text())
    tickers = data["tickers"]
    us = []
    for t in tickers:
        if "." not in t:
            us.append(t)
        elif t.rsplit(".", 1)[1] == "B":
            # share class, US-listed
            us.append(t)
    return us


def is_us_ticker(t: str) -> bool:
    if "." not in t:
        return True
    return t.rsplit(".", 1)[1] == "B"


def slug_for(ticker: str) -> str:
    """Canonical slug = (ALIAS resolved).lower() — comme le runtime
    load-company.ts qui lit `${canonical.toLowerCase()}.json`."""
    upper = ticker.upper()
    canonical = ALIASES.get(upper, upper)
    return canonical.lower()


def pipeline_path(ticker: str) -> Path:
    return PIPELINE_DIR / f"{slug_for(ticker)}.json"


# ── CIK resolution ──────────────────────────────────────────────────────────
_CIK_INDEX: dict | None = None


def _load_cik_index() -> dict:
    global _CIK_INDEX
    if _CIK_INDEX is None:
        _CIK_INDEX = json.loads(CIK_INDEX_PATH.read_text())
    return _CIK_INDEX


def cik_for_ticker(ticker: str, extra_map: dict | None = None) -> int | None:
    """Résout ticker -> CIK via l'index local sec-data, avec variantes de
    forme SEC (BRK-B, BF-B). Fallback sur extra_map (company_tickers.json)."""
    idx = _load_cik_index()
    upper = ticker.upper()
    canon = ALIASES.get(upper, upper)
    candidates = [
        upper,
        canon,
        upper.replace(".", "-"),
        canon.replace(".", "-"),
        upper.replace("-", "."),
        canon.replace("-", "."),
    ]
    for c in candidates:
        if c in idx and isinstance(idx[c], dict) and idx[c].get("cik"):
            return int(idx[c]["cik"])
    if extra_map:
        for c in candidates:
            if c in extra_map:
                return int(extra_map[c])
    return None


# ── KPI matcher replication (src/lib/super-kpi.ts) ───────────────────────────
def _num(v) -> float | None:
    if isinstance(v, (int, float)):
        try:
            f = float(v)
            return f if f == f and abs(f) != float("inf") else None
        except Exception:
            return None
    if isinstance(v, str):
        s = v.replace(",", "").replace(" ", "")
        m = re.search(r"-?\d+(\.\d+)?", s)
        if m:
            try:
                return float(m.group(0))
            except Exception:
                return None
    return None


def _find_kpi(kpis: list[dict], short: str) -> dict | None:
    for k in kpis:
        if k.get("short") == short:
            return k
    return None


REVENUE_SHORTS = [
    "Revenue", "Total Revenue", "Total Revenues", "Net Sales", "Total Net Sales",
    "Sales", "Net Sales (Group)", "Net Revenue", "Total Net Revenue", "Revenues",
    "Net Revenues", "Group Revenue", "Group Sales", "Total fee revenue",
    "Net interest income", "Operating revenue", "Operating revenues",
]
REVENUE_NAMES = {
    "total revenue", "total revenues", "net sales", "total net sales", "revenue",
    "net revenues", "group revenue", "operating revenue", "operating revenues",
    "net interest income",
}
REVENUE_NAMES_FR = {
    "chiffre d'affaires", "chiffre d'affaires total", "revenu total",
    "produit net bancaire",
}


def has_revenue(c: dict) -> bool:
    kpis = c.get("kpis", []) or []
    for s in REVENUE_SHORTS:
        k = _find_kpi(kpis, s)
        if k and k.get("unit") != "%" and isinstance(k.get("history"), list) and len(k["history"]) >= 2:
            return True
    for k in kpis:
        unit = (k.get("unit") or "")
        if unit == "%" or "YoY" in unit:
            continue
        if not isinstance(k.get("history"), list) or len(k["history"]) < 2:
            continue
        en = (k.get("name_en") or "").lower()
        fr = (k.get("name_fr") or "").lower()
        if en in REVENUE_NAMES or fr in REVENUE_NAMES_FR:
            return True
    return False


MARGIN_SHORTS = [
    "Op Margin", "Operating Margin", "EBITDA Mgn", "EBITDA Margin", "Op. Margin",
    "Op Mgn", "Adjusted Operating Margin", "Adj Operating Margin", "Adj Op Margin",
    "Adjusted EBITDAC Margin", "Adjusted EBITDA Margin", "Adj EBITDA Margin",
    "EBIT Margin", "EBIT Margin before Special Items", "Pre-tax margin",
]
MARGIN_NAMES = {
    "operating margin", "op margin", "ebitda margin", "ebit margin",
    "adjusted operating margin", "adj operating margin", "adjusted ebitda margin",
    "adjusted ebit margin", "pre-tax margin",
}
MARGIN_NAMES_FR = {"marge opérationnelle", "marge op.", "marge ebitda", "marge ebit"}

OP_INCOME_SHORTS = [
    "Operating Income", "Op Income", "Adjusted Operating Income", "EBIT", "Adjusted EBIT",
]


def _unit_factor(u: str) -> float:
    s = (u or "").strip().lower()
    if s.startswith("mds") or s.startswith("bn") or "billion" in s or s.startswith("md €") or s.startswith("md $"):
        return 1000.0
    return 1.0


def has_margin(c: dict) -> bool:
    """Margin disponible si KPI direct OU computeOperatingMargin (Op Income/Revenue)."""
    kpis = c.get("kpis", []) or []
    for s in MARGIN_SHORTS:
        k = _find_kpi(kpis, s)
        if k and k.get("unit") == "%":
            return True
    for k in kpis:
        if k.get("unit") != "%":
            continue
        en = (k.get("name_en") or "").lower()
        fr = (k.get("name_fr") or "").lower()
        if en in MARGIN_NAMES or fr in MARGIN_NAMES_FR:
            return True
    # computeOperatingMargin fallback: needs Op Income (abs) + Revenue (abs)
    op = None
    for s in OP_INCOME_SHORTS:
        k = _find_kpi(kpis, s)
        if k and k.get("unit") != "%" and isinstance(k.get("history"), list) and len(k["history"]) >= 2:
            op = k
            break
    if op and has_revenue(c):
        return True
    return False


def selected_revenue_kpi(c: dict) -> dict | None:
    """Réplique findRevenueKpi (priorité shorts standards) pour connaître le
    KPI Revenue que super-kpi.ts utilisera (et sa period_type)."""
    kpis = c.get("kpis", []) or []
    for s in REVENUE_SHORTS:
        k = _find_kpi(kpis, s)
        if k and k.get("unit") != "%" and isinstance(k.get("history"), list) and len(k["history"]) >= 2:
            return k
    for k in kpis:
        unit = (k.get("unit") or "")
        if unit == "%" or "YoY" in unit:
            continue
        if not isinstance(k.get("history"), list) or len(k["history"]) < 2:
            continue
        en = (k.get("name_en") or "").lower()
        fr = (k.get("name_fr") or "").lower()
        if en in REVENUE_NAMES or fr in REVENUE_NAMES_FR:
            return k
    return None


def revenue_period(c: dict) -> str:
    k = selected_revenue_kpi(c)
    if k and k.get("period_type") == "quarter":
        return "quarter"
    if k and k.get("period_type") == "semester":
        return "semester"
    return "year"


CAPEX_SHORTS = ["Capex", "CapEx", "Capex Total", "Capex total", "Capital Expenditure", "Capital Expenditures"]


def has_capex(c: dict) -> bool:
    kpis = c.get("kpis", []) or []
    for s in CAPEX_SHORTS:
        if _find_kpi(kpis, s):
            return True
    for k in kpis:
        en = (k.get("name_en") or "").lower()
        fr = (k.get("name_fr") or "").lower()
        if k.get("unit") == "%":
            continue
        if "capital expenditure" in en or (en.startswith("capex") and "%" not in en):
            return True
        if "capex" in fr and "%" not in fr and "ratio" not in fr:
            return True
    return False


def has_concentration(c: dict) -> bool:
    """Concentration Risk OK si revenue_by_segment.slices >=1 OR legacy SEGMENT_MAP.
    On ne backfill PAS la concentration (segments != XBRL standard), donc on se
    contente d'auditer. Voir rapport."""
    rbs = c.get("revenue_by_segment")
    if isinstance(rbs, dict) and isinstance(rbs.get("slices"), list) and len(rbs["slices"]) > 0:
        return True
    SEGMENT_MAP = {
        "GOOGL": ["Search", "Cloud", "YT Ads", "Subs"],
        "META": ["FoA Op"],
        "MSCI": ["Index", "Sub RR", "ABF", "Analytics"],
        "SPGI": ["MI", "Ratings", "Indices", "Energy", "Mobility"],
        "CAT": ["Energy", "Construction", "Resource"],
    }
    t = (c.get("ticker") or "").upper()
    return t in SEGMENT_MAP


if __name__ == "__main__":
    us = load_us_tickers()
    print(f"US tickers: {len(us)}")
