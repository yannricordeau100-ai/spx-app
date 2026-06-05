#!/usr/bin/env python3
"""
Yann 5 juin 2026 : migration des overrides hero_kpi existantes vers la table
Supabase `desk_hero_kpi_overrides`.

Sources scannées (pour rétro-compat) :
  1. `src/data/v2-pipeline-enrich/<ticker>.hero_kpi.json`
     Format : {"hero_kpi_override": "<short>"}
  2. `src/data/v2-pipeline/<ticker>.json` avec `_hero_review_status=validated`
     ET `_hero_last_set_by=admin/kpis-toggle` ET `hero_kpi` présent.

Upsert dans `desk_hero_kpi_overrides` (PK ticker UPPERCASE).

Idempotent : ré-exécutable sans dommage. Affiche un récap final
(nb sources, upserts ok/fail).

Usage :
  cd ~/spx-app
  python3 scripts/migrate-hero-kpi-overrides-to-supabase.py

Variables d'env requises :
  - SUPABASE_URL (alias NEXT_PUBLIC_SUPABASE_URL)
  - SUPABASE_SERVICE_ROLE_KEY
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.stderr.write("ERROR: pip install requests\n")
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = ROOT / "src" / "data" / "v2-pipeline"
ENRICH_DIR = ROOT / "src" / "data" / "v2-pipeline-enrich"

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or ""
).rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    sys.stderr.write(
        "ERROR: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env\n"
    )
    sys.exit(1)


def collect_overrides() -> dict[str, dict]:
    """Retourne {ticker_upper: {hero_kpi_short, source}}."""
    out: dict[str, dict] = {}

    # Source 1 : fichiers <ticker>.hero_kpi.json
    for fp in ENRICH_DIR.glob("*.hero_kpi.json"):
        ticker = fp.name.replace(".hero_kpi.json", "").upper()
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception as err:
            print(f"  ! skip {fp.name}: {err}")
            continue
        short = data.get("hero_kpi_override")
        if isinstance(short, str) and short.strip():
            out[ticker] = {
                "hero_kpi_short": short.strip(),
                "source": f"file:{fp.name}",
            }

    # Source 2 : v2-pipeline/<ticker>.json avec _hero_review_status=validated
    # et _hero_last_set_by=admin/kpis-toggle
    for fp in PIPELINE_DIR.glob("*.json"):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        status = data.get("_hero_review_status")
        set_by = data.get("_hero_last_set_by", "")
        hero = data.get("hero_kpi")
        if (
            status == "validated"
            and isinstance(set_by, str)
            and "admin/kpis-toggle" in set_by
            and isinstance(hero, str)
            and hero.strip()
        ):
            ticker = (data.get("ticker") or fp.stem).upper()
            # Ne pas écraser une source 1 déjà posée (les .hero_kpi.json sont
            # le canal le plus récent).
            if ticker not in out:
                out[ticker] = {
                    "hero_kpi_short": hero.strip(),
                    "source": f"pipeline:{fp.name}",
                }
    return out


def upsert(ticker: str, hero_short: str, source: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/desk_hero_kpi_overrides"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = [
        {
            "ticker": ticker,
            "hero_kpi_short": hero_short,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": f"migration:{source}",
        }
    ]
    try:
        resp = requests.post(
            f"{url}?on_conflict=ticker",
            headers=headers,
            data=json.dumps(payload),
            timeout=30,
        )
    except Exception as err:
        print(f"  ! {ticker}: network error {err}")
        return False
    if resp.status_code in (200, 201, 204):
        return True
    print(f"  ! {ticker}: HTTP {resp.status_code} {resp.text[:200]}")
    return False


def main() -> int:
    overrides = collect_overrides()
    print(f"Collected {len(overrides)} overrides to migrate")
    if not overrides:
        print("Nothing to do.")
        return 0
    ok = 0
    fail = 0
    for ticker in sorted(overrides):
        info = overrides[ticker]
        if upsert(ticker, info["hero_kpi_short"], info["source"]):
            ok += 1
            print(f"  ✓ {ticker:<10} {info['hero_kpi_short']:<40} ({info['source']})")
        else:
            fail += 1
    print(f"\nDone: {ok} ok, {fail} fail")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
