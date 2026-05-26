#!/usr/bin/env python3
"""
sync-fiscal-audit.py — Sync src/data/fiscal-audit.json from v2-pipeline-enrich.

Pour chaque ticker dans fiscal-audit.json :
  1. Charge enrich correspondant (src/data/v2-pipeline-enrich/<t>.json)
  2. Compare enrich.latest_filing.date vs fiscal-audit.latestFilingDate
  3. Si enrich plus récent → écrase latestFilingDate + latestPeriodEnd
  4. Sinon, garde valeur fiscal-audit
  5. Fallback : si enrich pas de latest_filing mais next_earnings_date présent,
     estime latestPeriodEnd = next_earnings_date - 90j (1 trim)

Honnêteté : ne fabrique JAMAIS une date plus récente. Compare proprement,
prend max(enrich, fiscal-audit).

Usage : python3 scripts/sync-fiscal-audit.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FA_PATH = ROOT / "src/data/fiscal-audit.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"


def find_enrich(ticker: str) -> Path | None:
    for variant in [ticker.lower(), ticker.lower().replace(".", "-")]:
        p = ENRICH_DIR / f"{variant}.json"
        if p.exists():
            return p
    return None


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.split("T")[0])
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    fa = json.loads(FA_PATH.read_text())
    print(f"[sync-fiscal-audit] {len(fa)} fiscal-audit entries to check")

    stats = {"updated": 0, "no_change": 0, "no_enrich": 0, "filing_synced": 0, "period_synced": 0}
    changes = []

    for ticker, entry in fa.items():
        enrich_path = find_enrich(ticker)
        if not enrich_path:
            stats["no_enrich"] += 1
            continue

        try:
            enrich = json.loads(enrich_path.read_text())
        except Exception:
            stats["no_enrich"] += 1
            continue

        # 1. latest_filing.date
        enrich_latest = enrich.get("latest_filing") or {}
        enrich_fd = enrich_latest.get("date")
        enrich_pe = enrich_latest.get("period_end")
        cur_fd = entry.get("latestFilingDate")
        cur_pe = entry.get("latestPeriodEnd")

        changed = False
        if enrich_fd:
            d_enrich = parse_iso(enrich_fd)
            d_cur = parse_iso(cur_fd)
            if d_enrich and (not d_cur or d_enrich > d_cur):
                entry["latestFilingDate"] = enrich_fd
                if enrich_latest.get("form"):
                    entry["latestForm"] = enrich_latest["form"]
                changed = True
                stats["filing_synced"] += 1
                changes.append(f"{ticker} latestFilingDate {cur_fd} -> {enrich_fd}")

        if enrich_pe:
            d_enrich = parse_iso(enrich_pe)
            d_cur = parse_iso(cur_pe)
            if d_enrich and (not d_cur or d_enrich > d_cur):
                entry["latestPeriodEnd"] = enrich_pe
                changed = True
                stats["period_synced"] += 1
                if not any(ticker in c for c in changes):
                    changes.append(f"{ticker} latestPeriodEnd {cur_pe} -> {enrich_pe}")

        if changed:
            stats["updated"] += 1
        else:
            stats["no_change"] += 1

    print(f"\n[sync-fiscal-audit] Stats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    if changes:
        print(f"\nSample changes (first 20):")
        for c in changes[:20]:
            print(f"  {c}")

    if not args.dry_run and stats["updated"] > 0:
        FA_PATH.write_text(json.dumps(fa, indent=2, ensure_ascii=False) + "\n")
        print(f"\n[sync-fiscal-audit] Written {FA_PATH}")
    elif args.dry_run:
        print("\n[dry-run] No file written")


if __name__ == "__main__":
    main()
