#!/usr/bin/env python3
"""
seed-ir-sources-bulk.py — consolide les 8 batches de résultats agents et
les upsert en BDD desk_ir_sources.

Usage :
  python3 scripts/seed-ir-sources-bulk.py [--dry-run]

Lit /tmp/ir-batch-{1..8}-result.json (output des 8 agents qui ont scrappé
les URLs IR via WebSearch) et fait un upsert dans desk_ir_sources :
- ticker : PK
- home_url, ir_home_url, ir_docs_main_url
- ir_docs_additional_urls (JSONB array)
- status : recalculé selon nombre d'URLs (todo / partial / complete)
"""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
envPath = ROOT / ".env.local"
if envPath.exists():
    import re
    for line in envPath.read_text().splitlines():
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip('"\'')

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

from supabase import create_client  # type: ignore


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = []
    for i in range(1, 9):
        p = Path(f"/tmp/ir-batch-{i}-result.json")
        if not p.exists():
            print(f"  WARN: batch {i} non trouvé ({p})", file=sys.stderr)
            continue
        data = json.loads(p.read_text())
        rows.extend(data)
        print(f"  batch {i}: {len(data)} stés")

    print(f"\nTotal consolidé : {len(rows)} stés")

    # Normalise + dédoublonne par ticker
    seen = set()
    upserts = []
    for r in rows:
        t = (r.get("ticker") or "").upper()
        if not t or t in seen:
            continue
        seen.add(t)
        home = r.get("home_url") or None
        ir_home = r.get("ir_home_url") or None
        ir_main = r.get("ir_docs_main_url") or None
        additional = r.get("additional") or []
        if not isinstance(additional, list):
            additional = []
        # Status calculé
        filled = sum(1 for u in [home, ir_home, ir_main] if u)
        if filled + len(additional) >= 2:
            status = "complete"
        elif filled + len(additional) >= 1:
            status = "partial"
        else:
            status = "todo"
        upserts.append({
            "ticker": t,
            "home_url": home,
            "ir_home_url": ir_home,
            "ir_docs_main_url": ir_main,
            "ir_docs_additional_urls": additional,
            "status": status,
        })

    print(f"Après dédoublonnage : {len(upserts)} stés à upsert")
    by_status = {"complete": 0, "partial": 0, "todo": 0}
    for u in upserts:
        by_status[u["status"]] += 1
    print(f"  complete: {by_status['complete']} · partial: {by_status['partial']} · todo: {by_status['todo']}")

    if args.dry_run:
        print("\n[dry-run, aucune écriture BDD]")
        return

    supa = create_client(URL, KEY)
    # Upsert par batch de 50 pour pas dépasser la limite payload
    BATCH = 50
    inserted = 0
    for i in range(0, len(upserts), BATCH):
        chunk = upserts[i:i+BATCH]
        res = supa.table("desk_ir_sources").upsert(chunk, on_conflict="ticker").execute()
        inserted += len(chunk)
        print(f"  upserted batch {i//BATCH + 1}: {len(chunk)} stés")
    print(f"\n✅ Total upserted : {inserted} stés")


if __name__ == "__main__":
    main()
