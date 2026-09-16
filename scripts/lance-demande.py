#!/usr/bin/env python3
"""Affiche une demande "Indicateurs varies - Moyen terme" en attente.

Usage : python3 scripts/lance-demande.py [numero]
Sans argument : liste toutes les demandes en attente.
Fonctionne depuis n importe quelle session Claude Code (la file est en base,
aucun compte n est impose).
"""
import json
import os
import ssl
import sys
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def env() -> dict:
    v = dict(os.environ)
    chemin = os.path.join(RACINE, ".env.local")
    if os.path.exists(chemin):
        for ligne in open(chemin):
            if "=" in ligne and not ligne.startswith("#"):
                c, val = ligne.split("=", 1)
                v.setdefault(c.strip(), val.strip().strip('"'))
    return v


def main() -> None:
    e = env()
    url = e["NEXT_PUBLIC_SUPABASE_URL"]
    cle = e.get("SUPABASE_SERVICE_ROLE_KEY") or e["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    filtre = "status=in.(claude_pending,todo)"
    if len(sys.argv) > 1:
        filtre = f"display_number=eq.{int(sys.argv[1])}"
    r = urllib.request.Request(
        f"{url}/rest/v1/desk_image_findings_requests?select=id,display_number,query,status,target_tickers,languages,notes&{filtre}",
        headers={"apikey": cle, "Authorization": "Bearer " + cle},
    )
    rows = json.load(urllib.request.urlopen(r, context=CTX))
    if not rows:
        print("Aucune demande en attente.")
        return
    for d in rows:
        print(f"--- demande #{d['display_number']} [{d['status']}] id={d['id']}")
        print(f"    societes : {', '.join(d['target_tickers'] or [])}")
        print(f"    demande  : {d['query']}")
        if d.get("notes"):
            print(f"    notes    : {d['notes']}")
    print("\nRappel : graphiques reconstruits au gabarit Mettrik (scripts/finding-svg.py),")
    print("jamais d image copiee, valeurs publiees et sourcees uniquement.")


if __name__ == "__main__":
    main()
