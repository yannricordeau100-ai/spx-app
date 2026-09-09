#!/usr/bin/env python3
"""
Interrupteurs de la synchronisation quotidienne (9 sept 2026).

Lit dans Supabase (desk_page_content, page synchro / section interrupteurs)
les trois interrupteurs poses par le proprietaire sur /sandbox/synchro :
transcripts, kpi_ic, kpi_stories. Absent ou injoignable = allume (on ne
bloque jamais une mise a jour par accident).

Usage :
  python3 scripts/synchro_flags.py            # affiche les trois etats
  python3 scripts/synchro_flags.py kpi_ic     # code retour 0 = allume, 1 = arrete
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLES = ("transcripts", "kpi_ic", "kpi_stories")


def env_local() -> dict[str, str]:
    env: dict[str, str] = {}
    try:
        for l in (ROOT / ".env.local").read_text().splitlines():
            l = l.strip()
            if "=" in l and not l.startswith("#"):
                k, v = l.split("=", 1)
                env[k] = v.strip().strip('"')
    except Exception:
        pass
    return env


def lire() -> dict[str, bool]:
    etat = {c: True for c in CLES}
    env = env_local()
    url, cle = env.get("NEXT_PUBLIC_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not cle:
        return etat
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/desk_page_content?page_key=eq.synchro&section_key=eq.interrupteurs&select=content_fr",
            headers={"apikey": cle, "Authorization": f"Bearer {cle}"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            rows = json.loads(r.read().decode())
        brut = json.loads(rows[0]["content_fr"]) if rows and rows[0].get("content_fr") else {}
        for c in CLES:
            if brut.get(c) is False:
                etat[c] = False
    except Exception:
        pass
    return etat


def main() -> int:
    etat = lire()
    if len(sys.argv) > 1:
        c = sys.argv[1]
        on = etat.get(c, True)
        print(f"[synchro] {c} = {'on' if on else 'off'}")
        return 0 if on else 1
    print(" ".join(f"{c}={'on' if v else 'off'}" for c, v in etat.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
