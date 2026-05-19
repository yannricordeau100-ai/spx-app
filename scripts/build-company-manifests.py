#!/usr/bin/env python3
"""build-company-manifests.py — un manifest par société, lecture seule.

Pour chaque ticker, scan tous les paths possibles dans sec-data/ et écrit
un manifest JSON qui dit, en lecture seule, ce qui est présent et ce qui
manque, adapté par pays.

Output :
  - sec-data/_manifests/<TICKER>.json    (1 manifest par sté)
  - src/data/sec-data-manifest-summary.json   (agrégat lisible par conv)
  - src/data/sec-data-manifest-summary.csv    (lisible Excel par Yann)

Adaptation par pays :
  - US (cat1) : 10-K + 10-Q + 8-K + DEF14A + IR + home snapshot
  - FPI (cat2) : 20-F + 6-K + IR + home snapshot (pas de DEF14A)
  - EU (cat3) : annual-report PDF + IR + home + half-year + ad-hoc + IR-pres + ESG
  - JP/HK (cat3-asia) : annual report + IR + home
  - UK (cat3-uk) : annual report + IR + home + transcripts

Yann 19 mai 2026.

Usage :
    python3 scripts/build-company-manifests.py --tickers-file <list>
    python3 scripts/build-company-manifests.py --tickers AAPL,MSFT,LVMH,ROG.SW,BABA  # test
    python3 scripts/build-company-manifests.py --all  # scan all sec-data
"""
from __future__ import annotations
import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEC_DATA = ROOT / "sec-data"
MANIFESTS_DIR = SEC_DATA / "_manifests"
SUMMARY_JSON = ROOT / "src/data/sec-data-manifest-summary.json"
SUMMARY_CSV = ROOT / "src/data/sec-data-manifest-summary.csv"

EU_SUFFIXES = (".PA", ".DE", ".L", ".SW", ".AS", ".MI", ".MC", ".ST", ".CO", ".HE", ".OL", ".BR", ".VI", ".LS", ".IR", ".HM", ".HK", ".T")
UK_SUFFIX = (".L",)
ASIA_SUFFIX = (".T", ".HK")

# Quelle catégorie pour chaque suffixe ? Et quels docs sont REQUIS par catégorie.
COUNTRY_PROFILE = {
    "US": {
        "category": "cat1-us",
        "required": ["annual_report", "quarterly_report", "proxy_statement", "ir_page_snapshot", "home_page_snapshot"],
        "optional": ["current_report", "transcripts"],
    },
    "FPI": {
        "category": "cat2-foreign-adr",
        "required": ["annual_report", "ir_page_snapshot", "home_page_snapshot"],
        # FPI ADR (BABA, NVS, NVO, etc.) déposent 20-F mais pas DEF14A en règle générale.
        "optional": ["interim_report", "transcripts"],
    },
    "EU": {
        "category": "cat3-european",
        "required": ["annual_report", "ir_page_snapshot", "home_page_snapshot"],
        "optional": ["half_year_report", "ad_hoc", "ir_presentations", "esg_report", "transcripts"],
    },
    "UK": {
        "category": "cat3-european",
        "required": ["annual_report", "ir_page_snapshot", "home_page_snapshot"],
        # UK = European mais annual report obligatoire + transcripts fréquents
        "optional": ["half_year_report", "transcripts"],
    },
    "JP": {
        "category": "cat3-european",  # bucket
        "required": ["annual_report", "ir_page_snapshot", "home_page_snapshot"],
        "optional": ["semi_annual_report", "transcripts"],
    },
    "HK": {
        "category": "cat3-european",
        "required": ["annual_report", "ir_page_snapshot", "home_page_snapshot"],
        "optional": ["interim_report", "transcripts"],
    },
}


def detect_country(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".T"): return "JP"
    if t.endswith(".HK"): return "HK"
    if t.endswith(".L"): return "UK"
    if any(t.endswith(s) for s in EU_SUFFIXES):
        return "EU"
    # Check FPI list (cat2-foreign-adr presence)
    cat2_paths = [
        SEC_DATA / "cat2-foreign-adr" / "20F",
        SEC_DATA / "cat2-foreign-adr" / "40F-canadian",
    ]
    for d in cat2_paths:
        if not d.exists(): continue
        for yd in d.iterdir():
            if not yd.is_dir(): continue
            if any(f.name.startswith(t + "_") for f in yd.iterdir()):
                return "FPI"
    return "US"


# Pour chaque doc_type, liste les paths possibles avec template {ticker}.
# Le scanner cherche dans l'ordre : 1er hit est canonical, mais on liste tout pour count.
DOC_PATHS = {
    "annual_report": {
        "US": [
            "cat1-us/10K/*/{ticker}_*.htm.gz",
        ],
        "FPI": [
            "cat2-foreign-adr/20F/*/{ticker}_*.htm.gz",
            "cat2-foreign-adr/40F-canadian/*/{ticker}_*.htm.gz",
        ],
        "EU": [
            "cat3-european/{ticker}/annual-report/*.pdf",
            "cat3-european/{ticker}/annual-text/*.txt",
        ],
        "UK": [
            "cat3-european/{ticker}/annual-report/*.pdf",
            "cat3-european/{ticker}/annual-text/*.txt",
        ],
        "JP": [
            "cat3-european/{ticker}/annual-report/*.pdf",
            "cat3-european/{ticker}/annual-text/*.txt",
        ],
        "HK": [
            "cat3-european/{ticker}/annual-report/*.pdf",
            "cat3-european/{ticker}/annual-text/*.txt",
        ],
    },
    "quarterly_report": {
        "US": ["cat1-us/10Q/*/{ticker}_*.htm.gz"],
    },
    "current_report": {
        "US": ["cat1-us/8K/*/{ticker}_*.htm.gz"],
    },
    "proxy_statement": {
        "US": ["cat1-us/DEF14A/*/{ticker}_*.htm.gz"],
    },
    "interim_report": {
        "FPI": ["cat2-foreign-adr/6K/*/{ticker}_*.htm.gz"],
        "HK": ["cat3-european/{ticker}/half-year/*", "cat3-european/{ticker}/ad-hoc/*"],
    },
    "semi_annual_report": {
        "JP": ["cat3-european/{ticker}/half-year/*"],
    },
    "half_year_report": {
        "EU": ["cat3-european/{ticker}/half-year/*"],
        "UK": ["cat3-european/{ticker}/half-year/*"],
    },
    "ad_hoc": {
        "EU": ["cat3-european/{ticker}/ad-hoc/*"],
    },
    "ir_presentations": {
        "EU": ["cat3-european/{ticker}/ir-presentations/*"],
    },
    "esg_report": {
        "EU": ["cat3-european/{ticker}/esg/*"],
    },
    "transcripts": {
        "*": [
            "cat3-european/{ticker}/transcripts/*",
            "{ticker}/transcripts/*",
            "ir-scrape/{ticker}/transcript/*",
        ],
    },
    "ir_page_snapshot": {
        "*": [
            "{ticker}/ir-page-snapshot/*.html",
            "cat1-us/{ticker}/ir-page-snapshot/*.html",
            "cat3-european/{ticker}/ir-page-snapshot/*.html",
            "cat3-european/{ticker}/snapshots/ir-page-*.html",
        ],
    },
    "home_page_snapshot": {
        "*": [
            "{ticker}/home-page-snapshot/*.html",
            "cat1-us/{ticker}/home-page-snapshot/*.html",
            "cat3-european/{ticker}/home-page-snapshot/*.html",
            "cat3-european/{ticker}/snapshots/home-page-*.html",
        ],
    },
}


def scan_doc(ticker: str, doc_type: str, country: str) -> dict:
    """Scan tous les paths possibles pour ce doc_type, return summary."""
    patterns_by_country = DOC_PATHS.get(doc_type, {})
    patterns = patterns_by_country.get(country, []) + patterns_by_country.get("*", [])
    if not patterns:
        return {"present": False, "count": 0, "paths": []}

    all_paths = []
    years = set()
    for pattern in patterns:
        glob_pattern = pattern.format(ticker=ticker)
        for p in SEC_DATA.glob(glob_pattern):
            if not p.exists(): continue
            all_paths.append(str(p.relative_to(SEC_DATA)))
            # Try extract year from filename or path
            m = re.search(r'(20\d{2})', p.name)
            if m:
                years.add(int(m.group(1)))
            else:
                # try parent dirs
                for parent in p.parents:
                    m2 = re.match(r'^(19|20)\d{2}$', parent.name)
                    if m2:
                        years.add(int(parent.name)); break

    return {
        "present": len(all_paths) > 0,
        "count": len(all_paths),
        "years": sorted(years, reverse=True)[:10] if years else [],
        "latest_path": all_paths[0] if all_paths else None,
    }


def build_manifest(ticker: str) -> dict:
    """Construit le manifest complet pour 1 ticker."""
    tk = ticker.upper().strip()
    country = detect_country(tk)
    profile = COUNTRY_PROFILE.get(country, COUNTRY_PROFILE["US"])
    required = profile["required"]
    optional = profile["optional"]

    present = {}
    all_types = set(required + optional + list(DOC_PATHS.keys()))
    for dt in sorted(all_types):
        present[dt] = scan_doc(tk, dt, country)

    missing = [dt for dt in required if not present.get(dt, {}).get("present")]
    n_required_ok = sum(1 for dt in required if present.get(dt, {}).get("present"))
    completion_pct = round(100 * n_required_ok / len(required)) if required else 0

    return {
        "ticker": tk,
        "country": country,
        "category": profile["category"],
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "required_for_country": required,
        "optional_for_country": optional,
        "present": present,
        "missing": missing,
        "complete": len(missing) == 0,
        "completion_pct": completion_pct,
    }


def write_manifest(m: dict):
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    p = MANIFESTS_DIR / f"{m['ticker'].replace('/', '_')}.json"
    p.write_text(json.dumps(m, indent=2, ensure_ascii=False))


def build_summary(manifests: list[dict]):
    """Agrégat global lisible par Yann (CSV) et par conv (JSON)."""
    SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(manifests),
        "complete": sum(1 for m in manifests if m["complete"]),
        "incomplete": sum(1 for m in manifests if not m["complete"]),
        "by_country": {},
        "stes": [],
    }
    for m in manifests:
        c = m["country"]
        s = summary["by_country"].setdefault(c, {"total": 0, "complete": 0, "incomplete": 0})
        s["total"] += 1
        if m["complete"]: s["complete"] += 1
        else: s["incomplete"] += 1
        summary["stes"].append({
            "ticker": m["ticker"],
            "country": m["country"],
            "complete": m["complete"],
            "completion_pct": m["completion_pct"],
            "missing": m["missing"],
        })

    SUMMARY_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    # CSV
    with open(SUMMARY_CSV, "w") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "country", "complete", "completion_pct", "missing"])
        for s in summary["stes"]:
            w.writerow([s["ticker"], s["country"], "OUI" if s["complete"] else "non", s["completion_pct"], "|".join(s["missing"])])

    return summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", type=str, help="Comma-separated")
    ap.add_argument("--tickers-file", type=str)
    ap.add_argument("--all", action="store_true", help="Scan tous les tickers sec-data/* + cat1-us/* + cat2/* + cat3/*")
    ap.add_argument("--no-summary", action="store_true")
    args = ap.parse_args()

    targets = []
    if args.tickers:
        targets = [t.strip().upper() for t in args.tickers.split(",")]
    elif args.tickers_file:
        targets = [l.strip().upper() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    elif args.all:
        # Tous les tickers existants dans sec-data/ (top-level + cat1-us/ + cat3-european/)
        s = set()
        if SEC_DATA.exists():
            for d in SEC_DATA.iterdir():
                if d.is_dir() and not d.name.startswith("_") and not d.name.startswith(".") and d.name not in ("cat1-us", "cat2-foreign-adr", "cat3-european", "eu", "ir-scrape", "quarterly-pdfs"):
                    s.add(d.name)
        cat1 = SEC_DATA / "cat1-us"
        if cat1.exists():
            for d in cat1.iterdir():
                if d.is_dir() and d.name not in ("10K", "10Q", "8K", "DEF14A", "_gics", "_meta", "_placeholder_ER", "_placeholder_other", "_placeholder_transcripts"):
                    s.add(d.name)
        cat3 = SEC_DATA / "cat3-european"
        if cat3.exists():
            for d in cat3.iterdir():
                if d.is_dir() and not d.name.startswith("_"):
                    s.add(d.name)
        targets = sorted(s)
    else:
        print("--tickers or --tickers-file or --all required"); sys.exit(1)

    print(f"=== Building manifests for {len(targets)} tickers ===")
    manifests = []
    for i, tk in enumerate(targets):
        m = build_manifest(tk)
        write_manifest(m)
        manifests.append(m)
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(targets)} done")

    if not args.no_summary:
        s = build_summary(manifests)
        print()
        print(f"=== SUMMARY ===")
        print(f"Total stés : {s['total']}")
        print(f"Complètes  : {s['complete']} ({100*s['complete']//s['total']}%)")
        print(f"Incomplètes: {s['incomplete']}")
        print()
        print("By country :")
        for c, st in sorted(s['by_country'].items()):
            print(f"  {c}: {st['complete']}/{st['total']} complètes")
        print()
        print(f"JSON : {SUMMARY_JSON.relative_to(ROOT)}")
        print(f"CSV  : {SUMMARY_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
