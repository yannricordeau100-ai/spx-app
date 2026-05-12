#!/usr/bin/env python3
"""Dedup IR scraper PDFs against SEC EDGAR filings.

Pour chaque IR PDF dans ~/Mettrik/sec-data/ir-scrape/<TICKER>/<doctype>/:
  1. Extraire date du nom de fichier / URL (regex YYYYMMDD, YYYY-MM-DD, etc.)
  2. Chercher si SEC EDGAR a un filing pour le même ticker à ±5 jours, type
     équivalent (8-K press release, 10-K annual report, 10-Q quarterly).
  3. Si match → déplacer le PDF dans <TICKER>/_duplicates/<doctype>/
     + ajouter à manifest["duplicates"].

Mapping doctype IR → SEC form :
  - results (earnings press)       → 8-K (USA) ou 6-K (FPI)
  - presentation (earnings slides) → 8-K ou 6-K
  - press (corporate press)        → 8-K ou 6-K
  - proxy                          → DEF14A
  - annual / annual report PDF     → 10-K, 20-F, 40-F, cat3 annual-report
  - misc                           → pas de dedup auto (incertain)

Usage :
  python3 scripts/ir-dedup.py --top307
  python3 scripts/ir-dedup.py --top307 --dry-run
"""
import argparse
import json
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
SEC = Path.home() / "Mettrik" / "sec-data"
SCRAPE = SEC / "ir-scrape"

# Patterns date dans un nom ou URL
DATE_PATTERNS = [
    re.compile(r"(20\d{2})[-_/](\d{2})[-_/](\d{2})"),       # 2024-02-26
    re.compile(r"(20\d{2})(\d{2})(\d{2})"),                  # 20240226
    re.compile(r"(\d{2})[-_/](\d{2})[-_/](20\d{2})"),        # 26-02-2024
    re.compile(r"q([1-4])[-_]?(20\d{2}|\d{2})", re.I),       # q1-2024
    re.compile(r"fy(20\d{2}|\d{2})", re.I),                  # fy2024
]

# Mapping IR doctype → SEC form types possibles
IR_TO_SEC = {
    "results": ["8-K", "6-K"],
    "presentation": ["8-K", "6-K"],
    "press": ["8-K", "6-K"],
    "transcript": ["8-K", "6-K"],
    "proxy": ["DEF14A"],
    "esg": [],  # rarely filed at SEC
    "misc": [],
}


def extract_date(filename, url=""):
    """Tente d'extraire une date YYYYMMDD depuis nom ou URL."""
    s = filename + " " + url
    # Format YYYY-MM-DD ou YYYYMMDD ou YYYY/MM/DD
    for pat in DATE_PATTERNS[:3]:
        m = pat.search(s)
        if not m: continue
        g = m.groups()
        # Determine which is year
        if int(g[0]) > 1999:
            year, mo, dd = g[0], g[1], g[2]
        elif int(g[2]) > 1999:
            year, mo, dd = g[2], g[1], g[0]
        else:
            continue
        try:
            dt = datetime(int(year), int(mo), int(dd))
            return dt.date()
        except ValueError:
            continue
    # Quarter pattern → fin du trimestre approximative
    m = DATE_PATTERNS[3].search(s)
    if m:
        q = int(m.group(1))
        y = m.group(2)
        if len(y) == 2: y = "20" + y
        try:
            return datetime(int(y), q*3, 28).date()
        except ValueError:
            pass
    return None


def index_sec_filings():
    """Build index of (ticker, date) → list of (form, path)."""
    idx = defaultdict(list)

    def add(form, base_path):
        if not base_path.exists(): return
        for year_dir in base_path.iterdir():
            if not year_dir.is_dir(): continue
            for f in year_dir.iterdir():
                # Pattern: TICKER_YYYY-MM-DD_... ou TICKER_YYYYMMDD_...
                m = re.match(r"^([A-Z0-9.-]+)_(\d{4})-?(\d{2})-?(\d{2})", f.name)
                if not m: continue
                ticker, y, mo, dd = m.group(1), m.group(2), m.group(3), m.group(4)
                try:
                    dt = datetime(int(y), int(mo), int(dd)).date()
                except ValueError:
                    continue
                idx[(ticker, dt.isoformat())].append((form, str(f)))

    add("10-K", SEC / "cat1-us" / "10K")
    add("10-Q", SEC / "cat1-us" / "10Q")
    add("8-K", SEC / "cat1-us" / "8K")
    add("DEF14A", SEC / "cat1-us" / "DEF14A")
    add("20-F", SEC / "cat2-foreign-adr" / "20F")
    add("6-K", SEC / "cat2-foreign-adr" / "6K")
    add("40-F", SEC / "cat2-foreign-adr" / "40F-canadian")
    return idx


def has_sec_filing_near(idx, ticker, target_date, sec_forms, window_days=5):
    """Cherche un filing SEC du ticker dans ±window_days jours."""
    if not target_date or not sec_forms: return None
    for delta in range(-window_days, window_days + 1):
        d = (target_date + timedelta(days=delta)).isoformat()
        for form, path in idx.get((ticker, d), []):
            if form in sec_forms:
                return (form, path, d)
    return None


def process_ticker(ticker, sec_idx, dry_run=False, delete=True):
    base = SCRAPE / ticker
    if not base.exists(): return None
    mp = base / "_manifest.json"
    if not mp.exists(): return None
    try:
        manifest = json.loads(mp.read_text())
    except Exception:
        return None

    duplicates = []
    deleted = 0
    moved = 0
    dup_dir = base / "_duplicates"

    # Iterate doctype subdirs
    for sub in base.iterdir():
        if not sub.is_dir(): continue
        if sub.name.startswith("_"): continue
        if sub.name == "snapshots" or sub.name == "extras": continue
        doctype = sub.name
        sec_forms = IR_TO_SEC.get(doctype, [])
        if not sec_forms: continue  # esg, misc → skip dedup
        for f in sub.iterdir():
            if not f.is_file(): continue
            if f.suffix.lower() != ".pdf": continue
            dt = extract_date(f.name)
            if not dt: continue
            match = has_sec_filing_near(sec_idx, ticker, dt, sec_forms)
            if match:
                form, sec_path, sec_date = match
                rec = {"ir_path": str(f.relative_to(SCRAPE)), "ir_date": dt.isoformat(),
                       "matched_sec_form": form, "matched_sec_date": sec_date,
                       "matched_sec_path": sec_path}
                duplicates.append(rec)
                if dry_run:
                    pass
                elif delete:
                    rec["action"] = "deleted"
                    f.unlink()
                    deleted += 1
                else:
                    rec["action"] = "moved"
                    dest = dup_dir / doctype / f.name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(f), str(dest))
                    moved += 1

    if duplicates:
        manifest["dedup_duplicates"] = duplicates
        manifest["dedup_at"] = datetime.utcnow().isoformat() + "Z"
        if not dry_run:
            mp.write_text(json.dumps(manifest, indent=2))
    return {"ticker": ticker, "duplicates_found": len(duplicates), "deleted": deleted, "moved": moved}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top307", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--tickers")
    ap.add_argument("--dry-run", action="store_true", help="détecte sans toucher")
    ap.add_argument("--keep", action="store_true", help="déplace vers _duplicates/ au lieu de supprimer")
    args = ap.parse_args()

    if args.tickers:
        tickers = args.tickers.split(",")
    elif args.top307:
        tickers = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))
    elif args.all:
        tickers = [p.name for p in SCRAPE.iterdir() if p.is_dir() and not p.name.startswith("_")]
    else:
        ap.error("--tickers/--top307/--all required")

    print(f"Indexing SEC EDGAR filings (peut prendre 30 sec)...")
    sec_idx = index_sec_filings()
    print(f"  → {len(sec_idx)} (ticker, date) couples indexés")
    print()
    print(f"Dedup sur {len(tickers)} stés (dry_run={args.dry_run})")
    print()

    total_dup = 0
    affected = 0
    for t in tickers:
        res = process_ticker(t, sec_idx, dry_run=args.dry_run, delete=not args.keep)
        if not res: continue
        if res["duplicates_found"] > 0:
            affected += 1
            total_dup += res["duplicates_found"]
            verb = "détectés" if args.dry_run else ("supprimés" if not args.keep else "déplacés vers _duplicates/")
            print(f"  {t}: {res['duplicates_found']} doublons {verb}")

    print()
    print(f"✅ {total_dup} doublons IR↔SEC trouvés sur {affected} stés.")
    if args.dry_run:
        print("  (dry-run, aucune action sur fichiers)")


if __name__ == "__main__":
    main()
