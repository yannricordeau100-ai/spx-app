#!/usr/bin/env python3
"""
EU5+N pre-pipeline manifest builder.

Scans cat3-european/<TICKER>.<SUFFIX>/ for tickers whose suffix is in EU5+N,
enriches with official name + GICS sector via yfinance (light usage, throttled,
only when needed), checks SEC EDGAR 20-F filing presence (using bundled CIK
table for the well-known FPI ADRs), and cross-references existing extractions
in src/data/companies/ and src/data/v2-pipeline/.

Outputs:
  - sec-data/_meta/eu5n-pipeline-manifest.json
  - sec-data/_meta/eu5n-pipeline-manifest.md
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/yann/spx-app")
CAT3 = ROOT / "sec-data" / "cat3-european"
META = ROOT / "sec-data" / "_meta"
COMPANIES = ROOT / "src" / "data" / "companies"
V2 = ROOT / "src" / "data" / "v2-pipeline"

EU5N_SUFFIXES = {
    "PA": "France",
    "DE": "Allemagne",
    "MI": "Italie",
    "SW": "Suisse",
    "AS": "Pays-Bas",
    "ST": "Suède",
    "CO": "Danemark",
    "HE": "Finlande",
    "OL": "Norvège",
}

# Curated CIK list for the well-known EU5+N FPIs with 20-F filings.
# Source: SEC EDGAR (CIK lookups). Tickers are .SUFFIX as in cat3-european/.
KNOWN_CIK_20F = {
    "SAP.DE": "0001000184",      # SAP SE
    "ASML.AS": "0000937966",     # ASML Holding
    "INGA.AS": "0001039765",     # ING Groep
    "MT.AS": "0001304721",       # ArcelorMittal
    "RACE.MI": "0001648416",     # Ferrari
    "STM.MI": "0001181232",      # STMicroelectronics
    "TEN.MI": "0001190723",      # Tenaris
    "SAN.PA": "0001121404",      # Sanofi
    "TTE.PA": "0000912727",      # TotalEnergies
    "NOK.HE": "0000924613",      # Nokia
    "ERIC.ST": "0000717826",     # Ericsson
    "EQNR.OL": "0001140625",     # Equinor
    "NVS.SW": "0001114448",      # Novartis (NVS NYSE)
    "NOVN.SW": "0001114448",     # Novartis (Swiss)
    "ABBN.SW": "0001091587",     # ABB Ltd
    "CS.PA": "0001333986",       # AXA (no 20-F currently but historical)
    "AIR.PA": "0001340539",      # Airbus (no 20-F officially)
    "LIN.DE": "0001707925",      # Linde
    "DTG.DE": "",                # Daimler Truck (no 20-F)
    "BAS.DE": "",                # BASF (no 20-F)
    "ADYEN.AS": "",              # Adyen (no 20-F)
    "PHIA.AS": "0000313216",     # Philips
    "UNA.AS": "0000217410",      # Unilever NV (legacy)
    "AKER.OL": "",
    "STL.OL": "0001140625",      # Statoil legacy = Equinor
    "VOLV-B.ST": "0001034670",   # Volvo AB
    "SAND.ST": "0001140625",     # (placeholder)
    "ATCO-A.ST": "",             # Atlas Copco
    "HM-B.ST": "",               # H&M (no 20-F)
    "ESSITY-B.ST": "",
    "TRYG.CO": "",
    "NOVO-B.CO": "0000353278",   # Novo Nordisk
    "MAERSK-B.CO": "",
    "DSV.CO": "",
    "CARL-B.CO": "",
    "ORSTED.CO": "",
    "GN.CO": "",
    "DANSKE.CO": "",
    "FORTUM.HE": "",
    "NESTE.HE": "",
    "UPM.HE": "",
    "KNEBV.HE": "",
    "SAMPO.HE": "",
    "STERV.HE": "",
}

# Manual GICS hints for the largest stes when yfinance is unavailable.
MANUAL_GICS_HINTS = {
    "ALV.DE": ("Financials", "Insurance"),
    "SAP.DE": ("Information Technology", "Software"),
    "SIE.DE": ("Industrials", "Industrial Conglomerates"),
    "MBG.DE": ("Consumer Discretionary", "Automobiles"),
    "BMW.DE": ("Consumer Discretionary", "Automobiles"),
    "VOW3.DE": ("Consumer Discretionary", "Automobiles"),
    "BAS.DE": ("Materials", "Chemicals"),
    "BAYN.DE": ("Health Care", "Pharmaceuticals"),
    "LIN.DE": ("Materials", "Industrial Gases"),
    "DTE.DE": ("Communication Services", "Diversified Telecommunication"),
    "DBK.DE": ("Financials", "Banks"),
    "ASML.AS": ("Information Technology", "Semiconductors"),
    "INGA.AS": ("Financials", "Banks"),
    "PHIA.AS": ("Health Care", "Health Care Equipment"),
    "AD.AS": ("Consumer Staples", "Food Retail"),
    "MT.AS": ("Materials", "Metals & Mining"),
    "HEIA.AS": ("Consumer Staples", "Beverages"),
    "UNA.AS": ("Consumer Staples", "Household Products"),
    "ADYEN.AS": ("Financials", "Capital Markets"),
    "NESN.SW": ("Consumer Staples", "Food Products"),
    "ROG.SW": ("Health Care", "Pharmaceuticals"),
    "NOVN.SW": ("Health Care", "Pharmaceuticals"),
    "ZURN.SW": ("Financials", "Insurance"),
    "ABBN.SW": ("Industrials", "Electrical Equipment"),
    "UHR.SW": ("Consumer Discretionary", "Textiles, Apparel & Luxury Goods"),
    "GIVN.SW": ("Materials", "Chemicals"),
    "CFR.SW": ("Consumer Discretionary", "Textiles, Apparel & Luxury Goods"),
    "MC.PA": ("Consumer Discretionary", "Textiles, Apparel & Luxury Goods"),
    "OR.PA": ("Consumer Staples", "Personal Products"),
    "TTE.PA": ("Energy", "Integrated Oil & Gas"),
    "SAN.PA": ("Health Care", "Pharmaceuticals"),
    "BNP.PA": ("Financials", "Banks"),
    "AI.PA": ("Materials", "Industrial Gases"),
    "AIR.PA": ("Industrials", "Aerospace & Defense"),
    "SU.PA": ("Industrials", "Electrical Equipment"),
    "CS.PA": ("Financials", "Insurance"),
    "DG.PA": ("Industrials", "Construction & Engineering"),
    "BN.PA": ("Consumer Staples", "Food Products"),
    "EL.PA": ("Consumer Discretionary", "Textiles, Apparel & Luxury Goods"),
    "RMS.PA": ("Consumer Discretionary", "Textiles, Apparel & Luxury Goods"),
    "STLA.MI": ("Consumer Discretionary", "Automobiles"),
    "ENI.MI": ("Energy", "Integrated Oil & Gas"),
    "ENEL.MI": ("Utilities", "Electric Utilities"),
    "ISP.MI": ("Financials", "Banks"),
    "UCG.MI": ("Financials", "Banks"),
    "RACE.MI": ("Consumer Discretionary", "Automobiles"),
    "G.MI": ("Financials", "Insurance"),
    "STM.MI": ("Information Technology", "Semiconductors"),
    "ATL.MI": ("Industrials", "Transportation Infrastructure"),
    "NOK.HE": ("Information Technology", "Communications Equipment"),
    "NESTE.HE": ("Energy", "Oil, Gas & Consumable Fuels"),
    "UPM.HE": ("Materials", "Paper & Forest Products"),
    "FORTUM.HE": ("Utilities", "Electric Utilities"),
    "KNEBV.HE": ("Industrials", "Machinery"),
    "SAMPO.HE": ("Financials", "Insurance"),
    "ERIC.ST": ("Information Technology", "Communications Equipment"),
    "VOLV-B.ST": ("Industrials", "Machinery"),
    "ATCO-A.ST": ("Industrials", "Machinery"),
    "HM-B.ST": ("Consumer Discretionary", "Specialty Retail"),
    "ESSITY-B.ST": ("Consumer Staples", "Household Products"),
    "INVE-B.ST": ("Financials", "Capital Markets"),
    "SAND.ST": ("Industrials", "Machinery"),
    "NOVO-B.CO": ("Health Care", "Pharmaceuticals"),
    "MAERSK-B.CO": ("Industrials", "Marine Transportation"),
    "DSV.CO": ("Industrials", "Air Freight & Logistics"),
    "CARL-B.CO": ("Consumer Staples", "Beverages"),
    "ORSTED.CO": ("Utilities", "Electric Utilities"),
    "EQNR.OL": ("Energy", "Integrated Oil & Gas"),
    "DNB.OL": ("Financials", "Banks"),
    "TEL.OL": ("Communication Services", "Diversified Telecommunication"),
    "MOWI.OL": ("Consumer Staples", "Food Products"),
    "AKRBP.OL": ("Energy", "Oil & Gas Exploration"),
    "YAR.OL": ("Materials", "Chemicals"),
    "NHY.OL": ("Materials", "Metals & Mining"),
}


def list_eu5n_dirs() -> list[tuple[str, str]]:
    """Return (ticker_with_suffix, country) for every cat3-european dir
    whose suffix is in EU5+N and which has at least one annual-text/*.txt."""
    out = []
    for d in sorted(CAT3.iterdir()):
        if not d.is_dir():
            continue
        name = d.name
        if "." not in name:
            continue
        suffix = name.rsplit(".", 1)[1]
        if suffix not in EU5N_SUFFIXES:
            continue
        text_dir = d / "annual-text"
        if not text_dir.is_dir():
            continue
        if not any(text_dir.glob("*.txt")):
            continue
        out.append((name, EU5N_SUFFIXES[suffix]))
    return out


def annual_years_and_size(ticker_dir: Path) -> tuple[list[str], int]:
    years = []
    total = 0
    for f in sorted((ticker_dir / "annual-text").glob("*.txt")):
        m = re.match(r"^(20[12]\d)\.txt$", f.name)
        if not m:
            continue
        y = m.group(1)
        if "2020" <= y <= "2024":
            years.append(y)
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return years, total


def heuristic_name(ticker: str) -> str:
    """Last-resort name when yfinance fails."""
    base = ticker.split(".")[0]
    base = base.replace("-", " ")
    return base


def existing_extraction_state(ticker: str) -> str:
    """Check src/data/companies and src/data/v2-pipeline for prior work."""
    key = ticker.lower()
    candidates_companies = [
        COMPANIES / f"{key}.json",
        COMPANIES / f"{ticker}.json",
    ]
    candidates_pipeline = [
        V2 / f"{key}.json",
        V2 / f"{ticker}.json",
        V2 / f"{key}.gemini.json",
    ]
    pipeline_path = next((p for p in candidates_pipeline if p.is_file()), None)
    companies_path = next((p for p in candidates_companies if p.is_file()), None)

    if companies_path:
        try:
            txt = companies_path.read_text(encoding="utf-8")
            if "_kpis_supplementary_signed_by" in txt:
                return "kpis_done"
        except Exception:
            pass
        return "extracted_existing"
    if pipeline_path:
        return "extracted_existing"
    return "extraction_pending"


# ---------- yfinance enrichment ----------

_yf_cache: dict[str, dict] = {}


def yf_lookup(ticker: str) -> dict:
    """Single best-effort yfinance call with short timeout and graceful fallback.
    Returns {} on any error."""
    if ticker in _yf_cache:
        return _yf_cache[ticker]
    try:
        import yfinance as yf  # noqa: WPS433
        t = yf.Ticker(ticker)
        info = t.info or {}
        out = {
            "longName": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "irWebsite": info.get("website"),
            "marketCap": info.get("marketCap"),
        }
    except Exception as exc:  # pylint: disable=broad-except
        out = {"_error": str(exc)[:120]}
    _yf_cache[ticker] = out
    return out


def main(use_yfinance: bool = True, yf_throttle_sec: float = 1.5,
         max_yf_calls: int = 380) -> None:
    META.mkdir(parents=True, exist_ok=True)
    dirs = list_eu5n_dirs()

    stes: list[dict] = []
    yf_calls = 0
    yf_errors = 0
    by_country_counts: dict[str, dict] = {}

    for ticker, country in dirs:
        d = CAT3 / ticker
        years, total_bytes = annual_years_and_size(d)
        count_5_5 = len(set(years)) == 5

        # Name + GICS
        official_name: Optional[str] = None
        gics_sector: Optional[str] = None
        gics_industry: Optional[str] = None
        ir_url: Optional[str] = None
        market_cap: Optional[int] = None
        yf_err: Optional[str] = None

        # Try yfinance only if asked and budget allows.
        if use_yfinance and yf_calls < max_yf_calls:
            info = yf_lookup(ticker)
            yf_calls += 1
            if "_error" in info:
                yf_err = info["_error"]
                yf_errors += 1
            else:
                official_name = info.get("longName")
                gics_sector = info.get("sector")
                gics_industry = info.get("industry")
                ir_url = info.get("irWebsite")
                market_cap = info.get("marketCap")
            time.sleep(yf_throttle_sec)

        # Fall back to manual GICS hints if yfinance didn't return sector.
        if (not gics_sector) and ticker in MANUAL_GICS_HINTS:
            gics_sector, gics_industry = MANUAL_GICS_HINTS[ticker]
        if not official_name:
            official_name = heuristic_name(ticker)

        # SEC CIK / 20-F
        cik = KNOWN_CIK_20F.get(ticker, "")
        has_20f = bool(cik)

        extraction_state = existing_extraction_state(ticker)
        ready = count_5_5 and extraction_state == "extraction_pending"

        rec = {
            "ticker": ticker,
            "country": country,
            "official_name": official_name,
            "gics_sector": gics_sector,
            "gics_industry": gics_industry,
            "sec_cik": cik or None,
            "has_20f": has_20f,
            "years_2020_2024": years,
            "count_5_5": count_5_5,
            "total_text_bytes": total_bytes,
            "ir_url_known": ir_url,
            "market_cap": market_cap,
            "extraction_state": extraction_state,
            "ready_for_pipeline": ready,
        }
        if yf_err:
            rec["_yf_error"] = yf_err
        stes.append(rec)

        # Per-country tally
        c = by_country_counts.setdefault(country, {
            "total": 0, "count_5_5": 0, "ready_for_pipeline": 0,
            "kpis_done": 0, "extracted_existing": 0,
            "extraction_pending": 0, "total_text_mb": 0.0,
        })
        c["total"] += 1
        if count_5_5:
            c["count_5_5"] += 1
        if ready:
            c["ready_for_pipeline"] += 1
        c[extraction_state] = c.get(extraction_state, 0) + 1
        c["total_text_mb"] += total_bytes / 1_048_576.0

        # Progress log every 25 stes
        if len(stes) % 25 == 0:
            print(f"  [{len(stes)}/{len(dirs)}] {ticker} {country} "
                  f"5/5={count_5_5} state={extraction_state}",
                  file=sys.stderr, flush=True)

    # Round MB for readability
    for c in by_country_counts.values():
        c["total_text_mb"] = round(c["total_text_mb"], 1)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_stes": len(stes),
        "yf_calls": yf_calls,
        "yf_errors": yf_errors,
        "by_country": by_country_counts,
        "stes": stes,
    }

    out_json = META / "eu5n-pipeline-manifest.json"
    out_json.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                        encoding="utf-8")
    print(f"Wrote {out_json}  ({len(stes)} stes, yf_calls={yf_calls}, "
          f"yf_errors={yf_errors})")

    # Markdown
    md_path = META / "eu5n-pipeline-manifest.md"
    md_path.write_text(render_markdown(manifest), encoding="utf-8")
    print(f"Wrote {md_path}")


def render_markdown(manifest: dict) -> str:
    rows = []
    rows.append("# EU5+N Pre-Pipeline Manifest")
    rows.append("")
    rows.append(f"Genere : `{manifest['generated_at']}`")
    rows.append(f"Total stes : **{manifest['total_stes']}**")
    rows.append(f"yfinance calls : {manifest['yf_calls']}  /  errors : {manifest['yf_errors']}")
    rows.append("")
    rows.append("## Resume par pays")
    rows.append("")
    rows.append("| Pays | Total | 5/5 | Ready pipeline | KPIs done | Extr. partielle | A faire | Texte total (MB) |")
    rows.append("|---|---:|---:|---:|---:|---:|---:|---:|")
    for country, c in sorted(manifest["by_country"].items()):
        rows.append(
            f"| {country} | {c['total']} | {c['count_5_5']} | "
            f"{c['ready_for_pipeline']} | {c.get('kpis_done', 0)} | "
            f"{c.get('extracted_existing', 0)} | "
            f"{c.get('extraction_pending', 0)} | {c['total_text_mb']} |"
        )

    # Top 50 by market cap
    rows.append("")
    rows.append("## Top 50 EU5+N par capitalisation (donnees yfinance)")
    rows.append("")
    rows.append("| Rang | Ticker | Pays | Nom officiel | Secteur GICS | Capi (B) | 5/5 | Etat extraction |")
    rows.append("|---:|---|---|---|---|---:|:-:|---|")
    top = sorted(
        [s for s in manifest["stes"] if s.get("market_cap")],
        key=lambda s: s["market_cap"], reverse=True,
    )[:50]
    for i, s in enumerate(top, 1):
        capb = s["market_cap"] / 1e9
        rows.append(
            f"| {i} | `{s['ticker']}` | {s['country']} | "
            f"{(s['official_name'] or '')[:40]} | {s.get('gics_sector') or ''} | "
            f"{capb:.1f} | {'X' if s['count_5_5'] else ''} | "
            f"{s['extraction_state']} |"
        )

    # Ready-for-pipeline list
    ready = [s for s in manifest["stes"] if s["ready_for_pipeline"]]
    rows.append("")
    rows.append(f"## Stes ready_for_pipeline : {len(ready)}")
    rows.append("")
    rows.append("Priorite extraction LLM (5/5 annual-text ET aucune extraction existante).")
    rows.append("")
    rows.append("| Ticker | Pays | Nom | Secteur | Texte (KB) | Has 20-F |")
    rows.append("|---|---|---|---|---:|:-:|")
    for s in sorted(ready, key=lambda x: (x["country"], x["ticker"])):
        kb = s["total_text_bytes"] // 1024
        rows.append(
            f"| `{s['ticker']}` | {s['country']} | "
            f"{(s['official_name'] or '')[:40]} | "
            f"{s.get('gics_sector') or ''} | {kb} | "
            f"{'X' if s['has_20f'] else ''} |"
        )

    # Aggregate stats
    n_total = manifest["total_stes"]
    n_5_5 = sum(1 for s in manifest["stes"] if s["count_5_5"])
    n_ready = len(ready)
    n_done = sum(1 for s in manifest["stes"] if s["extraction_state"] == "kpis_done")
    n_existing = sum(1 for s in manifest["stes"] if s["extraction_state"] == "extracted_existing")
    n_partial_3_4 = sum(1 for s in manifest["stes"]
                        if not s["count_5_5"] and len(s["years_2020_2024"]) >= 3)

    rows.append("")
    rows.append("## Statistiques globales")
    rows.append("")
    rows.append(f"- Stes totales EU5+N indexees : **{n_total}**")
    rows.append(f"- Stes 5/5 (2020-2024 complet) : **{n_5_5}**")
    rows.append(f"- Stes kpis_done (extraction LLM finalisee) : **{n_done}**")
    rows.append(f"- Stes extracted_existing (companies.json sans signature kpis) : **{n_existing}**")
    rows.append(f"- Stes ready_for_pipeline (5/5 + aucune extraction) : **{n_ready}**")
    rows.append(f"- Stes partielles 3-4/5 (rattrapage scrape recommande) : **{n_partial_3_4}**")
    rows.append("")
    rows.append("### CIK SEC EDGAR connus")
    n_20f = sum(1 for s in manifest["stes"] if s["has_20f"])
    rows.append(f"- Stes avec CIK 20-F connu : **{n_20f}**")
    return "\n".join(rows) + "\n"


if __name__ == "__main__":
    # Allow --no-yf for a dry build that skips network entirely.
    use_yf = "--no-yf" not in sys.argv
    main(use_yfinance=use_yf)
