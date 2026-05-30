#!/usr/bin/env python3
"""
Yann FIX 4d (29 mai 2026) — Table de traduction manuelle des 30 KPIs records
des sociétés démo (GOOGL, MSFT, AAPL, META, NVDA, TSLA, V, JPM, LLY, MSCI, SPGI, CAT).

Pourquoi pas Cerebras : free tier renvoie soit content vide soit traductions
tronquées. Table manuelle = 100% fiable pour la démo investisseur.

Écrit dans : src/data/v2-pipeline/<ticker>.json (modifie kpi.name_fr in-place).
name_en jamais touché. explanation jamais touché. Skip si name_fr déjà différent
de name_en (= traduit ailleurs).

Usage :
  python3 scripts/translate-kpi-name-fr-manual.py
  python3 scripts/translate-kpi-name-fr-manual.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2_DIR = ROOT / "src" / "data" / "v2-pipeline"

# Table manuelle : (ticker, short_en, name_fr_traduit)
# Top 30 KPIs records démo (priorité Yann FIX 4d).
TRANSLATIONS = [
    # GOOGL
    ("googl", "Google Search Revenue", "Revenu Search Google"),
    ("googl", "YouTube Ads Revenue", "Revenu publicitaire YouTube"),
    ("googl", "Cloud Backlog (RPO)", "Carnet de commandes Cloud (RPO)"),
    ("googl", "Google Cloud Op Income", "Résultat opérationnel Google Cloud"),
    ("googl", "Paid Subscriptions", "Abonnements payants"),
    # MSFT
    ("msft", "Azure Growth", "Croissance Azure"),
    ("msft", "AI Run Rate", "Run rate IA"),
    ("msft", "Capex", "Investissements (Capex)"),
    ("msft", "M365 Copilot Seats", "Licences Copilot Microsoft 365"),
    # AAPL
    ("aapl", "Mac Revenue", "Revenu Mac"),
    ("aapl", "iPad Revenue", "Revenu iPad"),
    ("aapl", "Wearables/Home/Acc", "Wearables/Maison/Accessoires"),
    ("aapl", "Operating Cash Flow", "Trésorerie d'exploitation"),
    ("aapl", "Net Income", "Résultat net"),
    ("aapl", "Services Gross Margin", "Marge brute des Services"),
    # META
    ("meta", "DAP (Daily Active People)", "DAP (personnes actives quotidiennes)"),
    # NVDA
    ("nvda", "Networking Revenue", "Revenu Networking"),
    ("nvda", "Gaming Revenue", "Revenu Gaming"),
    ("nvda", "Free Cash Flow", "Trésorerie disponible"),
    ("nvda", "Sovereign AI Revenue", "Revenu IA souveraine"),
    # TSLA
    ("tsla", "Auto GM ex-credits", "Marge brute auto hors crédits"),
    ("tsla", "Energy Storage GWh", "Stockage d'énergie (GWh)"),
    ("tsla", "Energy GM", "Marge brute Énergie"),
    ("tsla", "Regulatory Credits", "Crédits réglementaires"),
    # V (Visa)
    ("v", "Cross-Border Volume", "Volume transfrontalier"),
    ("v", "Processed Transactions", "Transactions traitées"),
    ("v", "Data Processing Revenue", "Revenu Traitement de données"),
    ("v", "International Transaction Rev", "Revenu Transactions internationales"),
    ("v", "Non-GAAP EPS", "BPA ajusté (non-GAAP)"),
    ("v", "Cards en circulation", "Cartes en circulation"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    # Group by ticker
    by_ticker: dict[str, list[tuple[str, str]]] = {}
    for ticker, short_en, name_fr in TRANSLATIONS:
        by_ticker.setdefault(ticker, []).append((short_en, name_fr))

    total_applied = 0
    total_skipped = 0
    files_written = 0

    for ticker, mappings in by_ticker.items():
        f = V2_DIR / f"{ticker}.json"
        if not f.exists():
            print(f"  MISSING {f}", file=sys.stderr)
            continue
        try:
            data = json.loads(f.read_text())
        except Exception as e:
            print(f"  PARSE ERROR {f}: {e}", file=sys.stderr)
            continue
        if not isinstance(data, dict):
            continue
        kpis = data.get("kpis") or []
        applied_here = 0
        for short_en, name_fr_new in mappings:
            for k in kpis:
                # Match par short OU par name_en
                if k.get("short") == short_en or k.get("name_en") == short_en:
                    current_fr = (k.get("name_fr") or "").strip()
                    current_en = (k.get("name_en") or "").strip()
                    if current_fr and current_fr != current_en and current_fr != name_fr_new:
                        # Déjà traduit en autre chose → on respecte
                        total_skipped += 1
                        print(f"  {ticker} #{short_en!r}: name_fr déjà '{current_fr}' (skip)")
                    else:
                        if current_fr != name_fr_new:
                            k["name_fr"] = name_fr_new
                            applied_here += 1
                            total_applied += 1
                            print(f"  {ticker} #{short_en!r}: '{current_fr}' -> '{name_fr_new}'")
                        else:
                            total_skipped += 1
                    break
        if applied_here > 0:
            data["kpis"] = kpis
            data["_kpi_name_fr_translated_at"] = "2026-05-29"
            data["_kpi_name_fr_translated_by"] = "CONV-MAIN-FIX-4D-MANUAL-TABLE"
            if not args.dry_run:
                f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
                files_written += 1
            print(f"  -> {f.name}: {applied_here} traductions {'(dry-run)' if args.dry_run else 'écrites'}")

    print(f"\nDONE. Applied={total_applied} Skipped={total_skipped} Files={files_written}")


if __name__ == "__main__":
    main()
