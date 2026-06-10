#!/usr/bin/env python3
"""seed-disabled-blocks-supabase.py — reporte l'etat actuel des fichiers JSON
(src/data/disabled-blocks.json global + disabled-blocks-per-ste.json per-ste)
dans la table Supabase desk_disabled_blocks. A lancer UNE fois apres creation
de la table (migration 20260609_desk_disabled_blocks.sql).

Idempotent (upsert sur scope). N'efface rien d'autre.

Usage: cd ~/spx-app && set -a; source .env.local; set +a; \
       python3 scripts/seed-disabled-blocks-supabase.py
"""
import json, os, sys
from pathlib import Path
try:
    import requests
except ImportError:
    sys.stderr.write("pip install requests\n"); sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
URL = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not URL or not KEY:
    sys.stderr.write("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants\n"); sys.exit(1)

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
     "Prefer": "resolution=merge-duplicates,return=minimal"}
EP = f"{URL}/rest/v1/desk_disabled_blocks"

def load(p):
    try:
        return json.load(open(ROOT / p))
    except Exception:
        return {}

rows = []
g = load("src/data/disabled-blocks.json").get("disabled") or []
rows.append({"scope": "__global__", "blocks": [x for x in g if isinstance(x, str)]})
per = load("src/data/disabled-blocks-per-ste.json").get("overrides") or {}
for tk, blocks in per.items():
    if isinstance(blocks, list):
        rows.append({"scope": str(tk).upper(), "blocks": [x for x in blocks if isinstance(x, str)]})

r = requests.post(EP, headers=H, data=json.dumps(rows), timeout=30)
if r.status_code >= 300:
    sys.stderr.write(f"ERREUR upsert {r.status_code}: {r.text[:300]}\n"); sys.exit(1)
print(f"OK seed: {len(rows)} scopes upsertes (1 global + {len(rows)-1} per-ste).")
