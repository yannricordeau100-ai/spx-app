#!/usr/bin/env python3
"""
enrich-pass3-missing.py — wrapper qui identifie les sociétés Pass 3
validées mais avec risks ou governance manquants, et lance pipeline-llm-pass2
sur chacune en série.

Tri prioritaire (Yann 5 mai 2026) :
  1. Cat 1 (top US) d'abord
  2. Cat 3 (Europe) ensuite
  3. Cat 2 (FPI étrangères ADR) en dernier

Run :
    python3 scripts/enrich-pass3-missing.py [--limit N] [--dry-run]

Sortie : pipeline-llm-pass2.py écrit directement dans
src/data/v2-pipeline/<ticker>.json (overwrite des champs ciblés
risks / governance / ai_positioning, KPIs intacts).

Coordination CONV-DATA : ce script ne tourne PAS si CONV-DATA tient
🔄 EN COURS sur src/data/v2-pipeline/ dans SHARED-STATUS.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MERGED = PROJECT_ROOT / "src/data/v2-pipeline/_merged.json"
SHARED_STATUS = PROJECT_ROOT / "SHARED-STATUS.md"


def is_pass3(entry: dict) -> bool:
    return bool(entry.get("_validation") or entry.get("_validation_global"))


def needs_enrichment(entry: dict) -> bool:
    """Sté Pass 3 mais qui manque risks ou governance."""
    if not is_pass3(entry):
        return False
    has_risks = bool(entry.get("risks")) and len(entry.get("risks", [])) > 0
    has_gov = bool(entry.get("governance"))
    return not (has_risks and has_gov)


def category_of(ticker: str, entry: dict) -> int:
    """Retourne 1 (US), 2 (FPI), 3 (EU)."""
    # Heuristique simple : suffixes .PA / .DE / .AS / .ST / .CO / .MI = EU
    eu_suffixes = (".PA", ".DE", ".AS", ".ST", ".CO", ".MI")
    if any(ticker.endswith(s) for s in eu_suffixes):
        return 3
    # Cat 2 = FPI étrangères listées via ADR (TSM, NVO, BABA, SAP, etc.)
    cat2_known = {"TSM", "ASML", "NVO", "BABA", "SAP", "SHEL", "TM", "SE", "HSBC", "BP",
                  "NVS", "AZN", "RY", "SHOP", "HDB", "UL", "TD", "RIO", "BHP", "SNY",
                  "BIDU", "BILI", "BCS", "BCH", "BAYN.DE", "BEKE", "DEO", "ENEL.MI",
                  "FUTU", "GSK", "ITUB", "JD", "LI", "LU", "LYG", "MUFG", "NIO",
                  "NMR", "NTES", "NWG", "PBR", "PDD", "SAN", "SIEGY", "SMFG", "STLA",
                  "TKA.DE", "VALE", "VOW.DE", "WB", "XPEV"}
    if ticker.upper() in cat2_known:
        return 2
    return 1  # cat 1 par défaut (US)


def conv_data_locking() -> bool:
    """Skip run si CONV-DATA tient v2-pipeline en EN COURS."""
    if not SHARED_STATUS.exists():
        return False
    head = SHARED_STATUS.read_text("utf-8").splitlines()[:120]
    for line in head:
        if "CONV-DATA" in line and "🔄" in line and "v2-pipeline" in line:
            return True
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0,
                        help="Stop après N stés (0 = illimité).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Liste seulement, n'appelle pas pass2.")
    parser.add_argument("--force", action="store_true",
                        help="Ignore le lock CONV-DATA dans SHARED-STATUS.")
    args = parser.parse_args()

    if conv_data_locking() and not args.force:
        print("⏸ CONV-DATA tient src/data/v2-pipeline/ en EN COURS. Skip.")
        print("   Ajoute --force pour passer outre (à coordonner avec CONV-DATA).")
        sys.exit(0)

    merged = json.loads(MERGED.read_text("utf-8"))
    candidates = []
    for ticker, entry in merged.items():
        if not isinstance(entry, dict):
            continue
        if not needs_enrichment(entry):
            continue
        candidates.append((ticker, category_of(ticker, entry)))

    # Tri : cat 1 d'abord, cat 3, cat 2.
    cat_order = {1: 0, 3: 1, 2: 2}
    candidates.sort(key=lambda x: (cat_order.get(x[1], 9), x[0]))

    if args.limit:
        candidates = candidates[:args.limit]

    print(f"📊 {len(candidates)} stés à enrichir (Pass 3 valides, risks ou gov manquant)")
    by_cat = {}
    for _, c in candidates:
        by_cat[c] = by_cat.get(c, 0) + 1
    print(f"   Répartition : Cat 1 = {by_cat.get(1, 0)}, Cat 3 = {by_cat.get(3, 0)}, Cat 2 = {by_cat.get(2, 0)}")

    if args.dry_run:
        print("\n--dry-run : pas d'appel pass2. Liste des 20 premières :")
        for t, c in candidates[:20]:
            print(f"   {t:12s} (cat {c})")
        return

    pass2_script = PROJECT_ROOT / "scripts/pipeline-llm-pass2.py"
    if not pass2_script.exists():
        print(f"❌ pipeline-llm-pass2.py introuvable : {pass2_script}")
        sys.exit(1)

    success = 0
    for i, (ticker, cat) in enumerate(candidates):
        print(f"[{i+1}/{len(candidates)}] {ticker} (cat {cat}) ...", flush=True)
        try:
            result = subprocess.run(
                ["python3", str(pass2_script), "--ticker", ticker],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0:
                success += 1
                print(f"   ✅ OK")
            else:
                print(f"   ⚠ rc={result.returncode}: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            print(f"   ⏱ timeout 5min, skip")
        except Exception as e:
            print(f"   ❌ {e}")

    print(f"\n✅ Terminé : {success}/{len(candidates)} stés enrichies")
    print("   Relance npx tsx scripts/build-v2-pipeline-merged.ts pour propager.")


if __name__ == "__main__":
    main()
