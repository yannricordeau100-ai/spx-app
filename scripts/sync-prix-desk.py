#!/usr/bin/env python3
"""Reporte les tarifs Stripe LIVE dans la table desk pricing_prices.

Sans cela, la page Tarifs envoie au paiement des identifiants de tarifs
crees en mode TEST en mai : avec des cles live, Stripe repond "No such price"
et l abonnement est impossible. Ce script prend stripe-products.json (source
de verite, regeneree par setup-stripe-products.ts) et met a jour, pour chaque
plan / devise / frequence, la colonne stripe_price_id.

Usage : python3 scripts/sync-prix-desk.py [--apply]
"""
from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
CONFIG = RACINE / "src" / "lib" / "billing" / "stripe-products.json"
ENV = RACINE / ".env.local"

try:
    import certifi

    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # pragma: no cover
    CTX = ssl.create_default_context()

# code du plan en base -> identifiants produits du catalogue Stripe
PLANS = {
    "Premium": {"monthly": "mettrik_premium_monthly", "annual": "mettrik_premium_annual"},
    "Max": {"monthly": "mettrik_max_monthly", "annual": "mettrik_max_annual"},
}


def env(cle: str) -> str:
    for ligne in ENV.read_text(encoding="utf8").splitlines():
        if ligne.startswith(f"{cle}="):
            return ligne.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"{cle} absente de .env.local")


URL = env("NEXT_PUBLIC_SUPABASE_URL")
CLE = env("SUPABASE_SERVICE_ROLE_KEY")
ENTETES = {
    "apikey": CLE,
    "Authorization": f"Bearer {CLE}",
    "Content-Type": "application/json",
}


def appel(methode: str, chemin: str, corps=None, retour=False):
    entetes = dict(ENTETES)
    entetes["Prefer"] = "return=representation" if retour else "return=minimal"
    r = urllib.request.Request(
        URL + chemin,
        data=json.dumps(corps).encode() if corps is not None else None,
        headers=entetes,
        method=methode,
    )
    with urllib.request.urlopen(r, timeout=90, context=CTX) as x:
        b = x.read()
        return json.loads(b) if b else None


def main() -> int:
    applique = "--apply" in sys.argv
    conf = json.loads(CONFIG.read_text(encoding="utf8"))
    if conf.get("mode") != "live":
        print(f"Refus : le catalogue est en mode {conf.get('mode')}, pas live.")
        return 1
    plans = appel("GET", "/rest/v1/pricing_plans?select=id,code")
    par_code = {p["code"]: p["id"] for p in plans}
    lignes = appel(
        "GET",
        "/rest/v1/pricing_prices?select=id,plan_id,currency,frequency,stripe_price_id",
    )
    faits = manquants = inchanges = 0
    for l in lignes:
        code = next((c for c, i in par_code.items() if i == l["plan_id"]), None)
        if code not in PLANS:
            continue
        meta = PLANS[code].get(l["frequency"])
        prix = (conf.get("prices") or {}).get(meta, {}).get(str(l["currency"]).lower())
        if not prix:
            manquants += 1
            print(f"  manquant : {code} {l['currency']} {l['frequency']}")
            continue
        if l.get("stripe_price_id") == prix:
            inchanges += 1
            continue
        print(f"  {code} {l['currency']} {l['frequency']} -> {prix}")
        if applique:
            appel("PATCH", f"/rest/v1/pricing_prices?id=eq.{l['id']}", {"stripe_price_id": prix})
        faits += 1
    print(
        ("APPLIQUE" if applique else "SIMULATION")
        + f" : {faits} tarifs relies au live, {inchanges} deja bons, {manquants} sans correspondance"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
