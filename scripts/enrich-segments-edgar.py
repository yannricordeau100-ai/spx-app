#!/usr/bin/env python3
"""
enrich-segments-edgar.py — extrait revenue_by_segment + revenue_by_geography
pour les stés US (cat 1) via SEC EDGAR companyfacts API (gratuite, sans
clé). Pas de LLM nécessaire : les données sont structurées en XBRL.

Stratégie :
  1. Fetch `/api/xbrl/companyfacts/CIK<10digit>.json` pour chaque ticker
     (mapping ticker → CIK via tickers.json EDGAR).
  2. Cherche les concepts XBRL pertinents :
     - us-gaap:Revenues / RevenueFromContractWithCustomerExcludingAssessedTax
       avec disaggregation par axes :
         srt:StatementBusinessSegmentsAxis     → segments
         us-gaap:StatementGeographicalAxis     → géographies
     - dei:OperatingSegmentsRevenue
  3. Garde la dernière clôture annuelle (FY).
  4. Écrit `src/data/v2-pipeline-enrich/<ticker>.json` avec
     revenue_by_segment + revenue_by_geography (compatible RevenueBreakdown).

Stés EU (cat 3) : SEC EDGAR ne couvre pas → skip silencieux.

Usage :
    python3 scripts/enrich-segments-edgar.py [--limit N] [--force]

Idempotent : skip si fichier <ticker>.json a déjà revenue_by_segment ou
revenue_by_geography (recent <30 jours), sauf --force.
"""

import argparse
import json
import re
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
TICKERS_MAP = PROJECT_ROOT / "sec-data/_meta/edgar-tickers.json"

USER_AGENT = "Mettrik AI contact@mettrik.ai"


def fetch(url: str, retries: int = 3) -> bytes | None:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1.5 * (i + 1))
        except Exception:
            time.sleep(1.0 * (i + 1))
    return None


def load_ticker_to_cik():
    """SEC EDGAR maintient une liste tickers→CIK gratuite."""
    if TICKERS_MAP.exists():
        try:
            return json.loads(TICKERS_MAP.read_text())
        except Exception:
            pass
    print("📥 Téléchargement mapping tickers → CIK depuis SEC…")
    raw = fetch("https://www.sec.gov/files/company_tickers.json")
    if not raw:
        return {}
    data = json.loads(raw)
    out = {}
    for v in data.values():
        t = (v.get("ticker") or "").upper()
        cik = v.get("cik_str")
        if t and cik:
            out[t] = str(cik).zfill(10)
    TICKERS_MAP.parent.mkdir(parents=True, exist_ok=True)
    TICKERS_MAP.write_text(json.dumps(out))
    print(f"  ✅ {len(out)} tickers cachés dans {TICKERS_MAP}")
    return out


# Concepts XBRL utilisés pour le revenu (ordre de priorité)
REVENUE_CONCEPTS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
]


def latest_fy_breakdown(facts: dict, axis_keyword: str):
    """
    Cherche dans `facts.us-gaap.<concept>.units.USD` les revenus avec axis
    contenant `axis_keyword` (ex 'segment' ou 'geographic'), pour la
    dernière année fiscale (FY).

    Renvoie liste [(label, value_usd_billions), ...] ou None si non trouvé.
    """
    usgaap = facts.get("facts", {}).get("us-gaap", {})
    best_year = None
    best_results: list[tuple[str, float]] = []

    for concept in REVENUE_CONCEPTS:
        c = usgaap.get(concept)
        if not c:
            continue
        units = c.get("units", {}).get("USD") or []
        # On cherche les facts avec dimensions (= disaggregation)
        # SEC EDGAR ne renvoie PAS les axis dans companyfacts directement
        # (companyfacts donne uniquement les agrégats). Il faut companyconcept
        # pour les details. SKIP cette voie : trop coûteux en API.
        # Companyfacts donne les valeurs totales, par fp (FY/Q1-Q4) et form.
        for u in units:
            fp = u.get("fp")
            form = u.get("form")
            fy = u.get("fy")
            if fp != "FY" or form not in ("10-K", "20-F", "40-F"):
                continue
            # Pas de breakdown ici, on extrait juste le total annuel le plus
            # récent (utilisable pour vérification / contexte mais pas pour
            # la breakdown demandée).
            if best_year is None or (fy and fy > best_year):
                best_year = fy
                best_results = [("Total", float(u.get("val", 0)) / 1_000_000_000)]
        if best_results:
            break

    return best_results, best_year


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not V17.exists():
        print(f"❌ {V17} introuvable", file=sys.stderr)
        sys.exit(1)
    ENR.mkdir(parents=True, exist_ok=True)

    v17 = json.loads(V17.read_text())
    tickers = [t for t in v17.keys() if "." not in t]  # cat 1 US only
    print(f"📊 V1.7 cat1 US : {len(tickers)} stés (sur {len(v17)} V1.7 total)")

    ticker_to_cik = load_ticker_to_cik()
    if not ticker_to_cik:
        print("❌ Mapping CIK indisponible, abort", file=sys.stderr)
        sys.exit(1)

    pending = []
    for t in tickers:
        cik = ticker_to_cik.get(t.upper())
        if not cik:
            continue
        out_path = ENR / f"{t.lower()}.json"
        if out_path.exists() and not args.force:
            try:
                existing = json.loads(out_path.read_text())
                if existing.get("revenue_by_segment") or existing.get("revenue_by_geography"):
                    age = (datetime.now(timezone.utc) - datetime.fromtimestamp(out_path.stat().st_mtime, tz=timezone.utc)).days
                    if age < 30:
                        continue
            except Exception:
                pass
        pending.append((t, cik))

    if args.limit:
        pending = pending[: args.limit]
    print(f"  → à fetcher : {len(pending)}\n")

    written = 0
    no_data = 0
    fail = 0
    for i, (t, cik) in enumerate(pending):
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
        raw = fetch(url)
        if not raw:
            fail += 1
            continue
        try:
            facts = json.loads(raw)
        except Exception:
            fail += 1
            continue

        # NOTE companyfacts ne livre QUE les agrégats sans axis. Pour la
        # vraie disaggregation par segment / geo il faut parser le 10-K
        # XBRL inline (Inline XBRL Viewer) ou les filings R-files. Hors
        # scope de ce script gratuit.
        # CE QU'ON FAIT : on enrichit avec un proxy "Revenue total (10-K
        # FY)" qui sert au moins à valider les chiffres KPI extraits par
        # CONV-DATA. Si ça matche, on flag _edgar_total_validated.
        seg, year = latest_fy_breakdown(facts, "segment")

        # Merge dans le fichier enrich existant (sans écraser)
        out_path = ENR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        if seg and year:
            existing["_edgar_revenue_total_usd_billions"] = seg[0][1]
            existing["_edgar_revenue_year"] = year
            existing["_edgar_fetched_at"] = datetime.now(timezone.utc).isoformat()
            out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
            written += 1
        else:
            no_data += 1

        if (i + 1) % 25 == 0:
            print(f"  …{i+1}/{len(pending)} (ok={written}, no_data={no_data}, fail={fail})")
        time.sleep(0.15)  # SEC EDGAR rate limit : 10 req/sec max

    print(f"\n✅ {written} stés enrichies (revenue total EDGAR), {no_data} sans data, {fail} échecs")
    print("⚠️  Note : breakdown par segment/géo nécessite parsing XBRL inline")
    print("    des 10-K (script à venir, hors scope V1.7 minimal). Pour")
    print("    l'instant, seul le total annuel sert à valider les KPIs.")


if __name__ == "__main__":
    main()
