#!/usr/bin/env python3
"""set-hero-override.py — pose l'override hero dans Supabase
`desk_hero_kpi_overrides` (le SEUL mecanisme qui gagne sur tous les autres).

Pourquoi (constat 11 aout 2026) : quand une ste a un fichier
`.batches-drafts-safe/kpis-haut/<T>.json`, loadV17Company termine par
`data.hero_kpi = bestHero.short` (max pv_score de cette couche). Le hero_kpi
pose par apply-hero-fix.py sur base/enrich est donc ecrase. Seul l'override
Supabase, applique tout a la fin, s'impose.

Entree : {"TICKER": "hero_short", ...}. Idempotent (upsert on_conflict=ticker).

Usage :
  python3 scripts/set-hero-override.py --file /tmp/repoint.json
"""
import json, os, sys
from datetime import datetime, timezone
import requests

URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""


def main():
    a = sys.argv[1:]
    if not a or not URL or not KEY:
        print("usage: set-hero-override.py --file <json>  (SUPABASE_URL + SERVICE_ROLE_KEY requis)")
        return 1
    payload = json.load(open(a[1])) if a[0] == "--file" else json.loads(a[0])
    rows = [{"ticker": t.upper(), "hero_kpi_short": s,
             "updated_at": datetime.now(timezone.utc).isoformat(),
             "updated_by": "n2-qualif-2026-08-11"} for t, s in payload.items()]
    r = requests.post(
        f"{URL}/rest/v1/desk_hero_kpi_overrides?on_conflict=ticker",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        data=json.dumps(rows), timeout=60)
    if r.status_code in (200, 201, 204):
        print(f"{len(rows)} overrides hero posees")
        return 0
    print(f"HTTP {r.status_code} {r.text[:300]}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
