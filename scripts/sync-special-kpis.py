#!/usr/bin/env python3
"""Reverse les KPI speciaux publies dans les fiches KPI du pipeline.

Les KPI crees depuis /sandbox/special-kpis vivent dans Supabase. Tant qu ils y
restent, ils ne sont ni comptes, ni rafraichis, ni visibles des outils de
qualite. Ce script les recopie dans .batches-drafts-safe/kpis-haut/<TICKER>.json
comme des KPI a part entiere.

Deux etiquettes internes les accompagnent, jamais affichees sur le site :
  hors_document      : l historique ne vient pas des documents de resultats
  source_officielle  : faux des qu une valeur vient d une source tierce

La passe nocturne (scripts/earnings-refresh.py) refuse de mettre a jour un KPI
portant ces etiquettes : melanger deux sources dans une meme serie produit une
rupture invisible.

Usage : python3 scripts/sync-special-kpis.py [--apply]
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HAUT = ROOT / ".batches-drafts-safe" / "kpis-haut"
ENV = ROOT / ".env.local"


def ssl_ctx() -> ssl.SSLContext:
    try:
        import certifi  # type: ignore

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


SSL_CTX = ssl_ctx()


def env(cle: str) -> str:
    for ligne in ENV.read_text(encoding="utf8").splitlines():
        if ligne.startswith(f"{cle}="):
            return ligne.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"{cle} absente de .env.local")


def lignes_publiees() -> list[dict]:
    url = env("NEXT_PUBLIC_SUPABASE_URL")
    cle = env("SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        f"{url}/rest/v1/desk_special_kpis?select=*&published=eq.true",
        headers={"apikey": cle, "Authorization": f"Bearer {cle}"},
    )
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
        return json.loads(r.read())


def cibles(row: dict) -> list[str]:
    if row.get("mode") == "multi" and row.get("target_tickers"):
        return [t.strip().upper() for t in row["target_tickers"] if t and t.strip()]
    return [row["ticker"].strip().upper()] if row.get("ticker") else []


def en_kpi(row: dict, ticker: str) -> dict | None:
    donnees = row.get("data") or {}
    points = donnees.get("values_by_period") or []
    points = [p for p in points if isinstance(p, dict) and isinstance(p.get("value"), (int, float))]
    if not points:
        return None
    officielle = bool(donnees.get("official_source"))
    return {
        "short": row["kpi_short"],
        "name_fr": row.get("kpi_name_fr"),
        "name_en": row.get("kpi_name_en"),
        "unit": row.get("kpi_unit"),
        "category": row.get("kpi_category"),
        "frequency": "annual",
        "value": points[-1]["value"],
        "history": [{"q": str(p.get("period")), "v": p["value"]} for p in points],
        "source": donnees.get("data_source") or row.get("data_source"),
        # Etiquettes internes : jamais rendues cote public.
        "hors_document": True,
        "source_officielle": officielle,
        "origine": f"desk_special_kpis:{row['id']}",
    }


def main() -> int:
    apply = "--apply" in sys.argv
    ajoutes = remplaces = ignores = 0
    for row in lignes_publiees():
        for ticker in cibles(row):
            kpi = en_kpi(row, ticker)
            if kpi is None:
                ignores += 1
                print(f"  {ticker} {row['kpi_short']} : aucun point exploitable")
                continue
            chemin = HAUT / f"{ticker}.json"
            if not chemin.exists():
                ignores += 1
                print(f"  {ticker} : pas de fiche KPI, ignore")
                continue
            fiche = json.loads(chemin.read_text(encoding="utf8"))
            liste = fiche.setdefault("kpis", [])
            pos = next((i for i, k in enumerate(liste) if k.get("short") == kpi["short"]), None)
            if pos is None:
                liste.append(kpi)
                ajoutes += 1
            else:
                liste[pos] = kpi
                remplaces += 1
            if apply:
                chemin.write_text(
                    json.dumps(fiche, ensure_ascii=False, indent=1), encoding="utf8"
                )
            print(f"  {ticker} {kpi['short']} : {len(kpi['history'])} points")
    mode = "APPLIQUE" if apply else "SIMULATION"
    print(f"{mode} : {ajoutes} ajoutes, {remplaces} remplaces, {ignores} ignores")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
