#!/usr/bin/env python3
"""build-sec-data-counts.py — Snapshot des compteurs sec-data pour la
page /sandbox/data-status (sur Vercel, le filesystem sec-data n'est PAS
disponible — bundle trop gros, fs read-only).

Output : src/data/sec-data-counts.json
{
  "generated_at": "2026-05-17T...",
  "cat1": { "tickers_downloaded_3y": 222, "total_files": 12345 },
  "cat2": { "tickers_downloaded_3y": 33, "total_files": 5678 },
  "cat3": { "tickers_dirs": 89, "total_files": 9012 }
}

À lancer en local + commit avant push. La page data-status lit ce JSON.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEC = ROOT / "sec-data"
OUT = ROOT / "src/data/sec-data-counts.json"

TICKER_RE = re.compile(r"^([A-Z0-9.\-]+)_\d{4}-\d{2}-\d{2}\.htm\.gz$")


def count_cat(base: Path, recent_years: int = 3) -> dict:
    """Compte les tickers uniques téléchargés dans les N dernières années."""
    if not base.exists():
        return {"tickers_downloaded": 0, "total_files": 0}
    tickers = set()
    total_files = 0
    try:
        years = sorted(
            [d.name for d in base.iterdir() if d.is_dir() and d.name.isdigit() and len(d.name) == 4],
            reverse=True,
        )[:recent_years]
        for y in years:
            year_dir = base / y
            for f in year_dir.iterdir():
                if f.is_file():
                    total_files += 1
                    m = TICKER_RE.match(f.name)
                    if m:
                        tickers.add(m.group(1))
    except Exception as e:
        print(f"  err {base}: {e}", file=sys.stderr)
    return {"tickers_downloaded": len(tickers), "total_files": total_files}


def count_cat3() -> dict:
    """Cat 3 EU = arborescence par ticker (pas par année)."""
    base = SEC / "cat3-european"
    if not base.exists():
        return {"tickers_dirs": 0, "total_files": 0}
    tickers = 0
    total_files = 0
    try:
        for d in base.iterdir():
            if d.is_dir():
                tickers += 1
                # Compter récursivement les fichiers
                for _root, _dirs, files in os.walk(d):
                    total_files += len(files)
    except Exception as e:
        print(f"  err cat3: {e}", file=sys.stderr)
    return {"tickers_dirs": tickers, "total_files": total_files}


def main():
    print(f"Scanning {SEC}...")
    if not SEC.exists():
        print(f"❌ sec-data dir not found: {SEC}")
        sys.exit(1)
    cat1 = count_cat(SEC / "cat1-us/10K")
    cat2 = count_cat(SEC / "cat2-foreign-adr/20F")
    cat3 = count_cat3()
    snap = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cat1": cat1,
        "cat2": cat2,
        "cat3": cat3,
    }
    OUT.write_text(json.dumps(snap, indent=2, ensure_ascii=False) + "\n")
    print(f"✅ Écrit {OUT}")
    print(f"  cat1 : {cat1['tickers_downloaded']} tickers, {cat1['total_files']} files")
    print(f"  cat2 : {cat2['tickers_downloaded']} tickers, {cat2['total_files']} files")
    print(f"  cat3 : {cat3['tickers_dirs']} tickers, {cat3['total_files']} files")


if __name__ == "__main__":
    main()
