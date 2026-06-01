#!/usr/bin/env python3
"""
Merge des drafts FR mass extract unifiés vers src/data/v2-pipeline/.

PRINCIPE APPEND-ONLY :
  - Ne JAMAIS écraser une valeur non-null existante du fichier canonical.
  - Compléter uniquement les champs absents ou explicitement null.
  - Backups OBLIGATOIRES avant toute écriture en mode --apply.

Modes :
  --dry-run (défaut) : affiche le diff (nb de champs ajoutés/ignorés) sans
                       toucher aux fichiers.
  --apply             : applique les changements. Nécessite aussi --confirm
                       (saisie interactive "MERGE FR APPEND-ONLY") sinon
                       refuse de procéder.

Cible : tous les tickers présents dans /tmp/eu5n-fr-mass-extract-unified/
Filtre optionnel : --tickers AC.PA,DG.PA

Backup format : src/data/v2-pipeline/<ticker>.before-fr-mass-extract.bak.json
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UNIFIED_DIR = Path("/tmp/eu5n-fr-mass-extract-unified")
CANONICAL_DIR = Path("/Users/yann/spx-app/src/data/v2-pipeline")
BACKUP_SUFFIX = ".before-fr-mass-extract.bak.json"
CONFIRM_PHRASE = "MERGE FR APPEND-ONLY"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_path(ticker: str) -> Path:
    return CANONICAL_DIR / f"{ticker.lower()}.json"


def is_empty(v: Any) -> bool:
    """Détermine si une valeur est 'vide' au sens append-only."""
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    if isinstance(v, (list, dict)) and len(v) == 0:
        return True
    return False


def append_only_merge(
    canonical: dict, draft: dict, path: str = ""
) -> tuple[dict, list[str]]:
    """Renvoie (merged, changes). N'écrase JAMAIS une valeur non vide existante."""
    changes: list[str] = []
    if not isinstance(canonical, dict) or not isinstance(draft, dict):
        return canonical, changes
    out = dict(canonical)
    for k, v in draft.items():
        # Ignore champs internes du draft
        if k.startswith("_raw_") or k in {
            "_aggregated_at", "_aggregator_version", "_sources_present",
            "_sources_count", "_source_main", "_requires_yann_validation",
            "extracted_at", "kpis_enriched",
        }:
            continue
        sub_path = f"{path}.{k}" if path else k
        if k not in out or is_empty(out.get(k)):
            out[k] = v
            changes.append(f"ADD    {sub_path}")
        else:
            existing = out[k]
            if isinstance(existing, dict) and isinstance(v, dict):
                merged_sub, sub_changes = append_only_merge(existing, v, sub_path)
                out[k] = merged_sub
                changes.extend(sub_changes)
            elif isinstance(existing, list) and isinstance(v, list):
                # Listes : on ne touche pas (append-only sur structures imbriquées
                # listées = risque de doublons). Skip.
                changes.append(f"SKIP   {sub_path} (list non vide conservée)")
            else:
                changes.append(f"SKIP   {sub_path} (valeur existante conservée)")
    return out, changes


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--dry-run", action="store_true", default=True,
        help="Mode par défaut. Affiche le diff sans écrire.",
    )
    p.add_argument(
        "--apply", action="store_true",
        help="Applique les changements (nécessite --confirm).",
    )
    p.add_argument(
        "--confirm", type=str, default="",
        help=f"Phrase de confirmation requise pour --apply : '{CONFIRM_PHRASE}'",
    )
    p.add_argument(
        "--tickers", type=str, default="",
        help="Liste de tickers séparés par virgule. Vide = tous.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    apply_mode = bool(args.apply)
    if apply_mode and args.confirm != CONFIRM_PHRASE:
        print(
            f"ERR  mode --apply nécessite --confirm '{CONFIRM_PHRASE}'",
            file=sys.stderr,
        )
        return 2
    if not UNIFIED_DIR.exists():
        print(f"ERR  {UNIFIED_DIR} absent", file=sys.stderr)
        return 1

    filter_tickers: set[str] = set()
    if args.tickers:
        filter_tickers = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}

    files = sorted(UNIFIED_DIR.glob("*.unified.json"))
    n_ok = 0
    n_skip_missing_canonical = 0
    n_apply = 0
    diff_summary: list[dict] = []

    for fp in files:
        with fp.open("r", encoding="utf-8") as f:
            draft = json.load(f)
        ticker = draft.get("ticker") or fp.stem.replace(".unified", "")
        if filter_tickers and ticker.upper() not in filter_tickers:
            continue
        canon_p = canonical_path(ticker)
        if not canon_p.exists():
            print(f"  SKIP  {ticker}: pas de canonical {canon_p.name}", file=sys.stderr)
            n_skip_missing_canonical += 1
            continue
        with canon_p.open("r", encoding="utf-8") as f:
            canonical = json.load(f)

        merged, changes = append_only_merge(canonical, draft)
        added = sum(1 for c in changes if c.startswith("ADD"))
        skipped = sum(1 for c in changes if c.startswith("SKIP"))
        n_ok += 1
        diff_summary.append({
            "ticker": ticker,
            "canonical": canon_p.name,
            "added": added,
            "skipped": skipped,
            "first_changes": changes[:10],
        })
        print(
            f"  {ticker:8s}  ADD={added:3d}  SKIP={skipped:3d}  "
            f"({canon_p.name})",
            file=sys.stderr,
        )

        if apply_mode and (added > 0):
            backup_p = CANONICAL_DIR / f"{ticker.lower()}{BACKUP_SUFFIX}"
            if not backup_p.exists():
                shutil.copy2(canon_p, backup_p)
            # Annotation
            merged["_fr_mass_extract_merge_at"] = now_iso()
            merged["_fr_mass_extract_aggregator_version"] = draft.get(
                "_aggregator_version"
            )
            merged.setdefault(
                "_requires_yann_validation_fr_merge", True,
            )
            with canon_p.open("w", encoding="utf-8") as f:
                json.dump(merged, f, ensure_ascii=False, indent=2)
            n_apply += 1

    summary = {
        "mode": "apply" if apply_mode else "dry-run",
        "generated_at": now_iso(),
        "n_drafts": len(files),
        "n_processed": n_ok,
        "n_skip_missing_canonical": n_skip_missing_canonical,
        "n_applied": n_apply,
        "diff_summary": diff_summary,
    }
    out = UNIFIED_DIR / ("_MERGE_APPLY.json" if apply_mode else "_MERGE_DRYRUN.json")
    with out.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(
        f"\n=== {summary['mode']} : processed={n_ok} "
        f"skip_canonical_missing={n_skip_missing_canonical} "
        f"applied={n_apply} ===",
        file=sys.stderr,
    )
    print(f"summary: {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
