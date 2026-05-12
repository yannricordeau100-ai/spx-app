#!/usr/bin/env python3
"""
fix-yoy-from-history.py — corrige les yoy invalides en les recalculant
depuis le history. Pattern systémique sur les KPIs LLM-générés :
beaucoup ont yoy='stable' / null / '...' / 'n/a' alors qu'on peut
calculer la vraie variation depuis 2 derniers points d'history.

Critères yoy "invalide" :
- None, "", "stable", "n/a", "na", "-", "—", "...", "tbd"

Action :
- Si history >= 2 points numériques : recalculer (curr-prev)/prev * 100
- Sinon : flag is_short_history=true + yoy="n.d." (passe en Stories)

Idempotent : un yoy déjà calculé (+X% ou -X%) n'est pas retouché.

Usage :
    python3 scripts/fix-yoy-from-history.py            # tout v2-pipeline/
    python3 scripts/fix-yoy-from-history.py --top 307  # top 307 V1.8 only
    python3 scripts/fix-yoy-from-history.py --dry-run
"""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
TOP_FILE = ROOT / "src/data/v1-8-tickers-sorted.json"


def calc_yoy(history):
    if not isinstance(history, list) or len(history) < 2:
        return None
    try:
        prev, curr = history[-2], history[-1]
        if prev is None or curr is None:
            return None
        prev_f, curr_f = float(prev), float(curr)
        if prev_f == 0:
            return None
        pct = (curr_f - prev_f) / prev_f * 100
        return f"+{pct:.1f}%" if pct >= 0 else f"{pct:.1f}%"
    except Exception:
        return None


def is_bad_yoy(y):
    if y is None:
        return True
    if not isinstance(y, str):
        return False
    s = y.strip().lower()
    return s in ("", "stable", "n/a", "na", "-", "—", "...", "tbd")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--top", type=int, default=0, help="Limiter au top N V1.8 par market cap")
    args = ap.parse_args()

    if args.top > 0:
        top_tickers = set(t.lower() for t in json.load(open(TOP_FILE))[: args.top])
        files = [f"{t}.json" for t in top_tickers if (PIPELINE / f"{t}.json").exists()]
        print(f"Scope : top {args.top} V1.8 ({len(files)} fichiers trouvés)")
    else:
        files = sorted(f for f in os.listdir(PIPELINE)
                       if f.endswith(".json") and ".gemini" not in f and not f.startswith("_"))
        print(f"Scope : TOUT v2-pipeline/ ({len(files)} fichiers)")

    total_files_touched = 0
    total_yoy_recalc = 0
    total_yoy_marked_nd = 0

    for fname in files:
        path = PIPELINE / fname
        try:
            d = json.load(open(path))
        except Exception as e:
            print(f"  skip {fname}: {e}", file=sys.stderr)
            continue
        kpis = d.get("kpis") or []
        if not kpis:
            continue
        fixed = 0
        for k in kpis:
            if is_bad_yoy(k.get("yoy")):
                h = k.get("history") or []
                nv = calc_yoy(h)
                if nv:
                    k["yoy"] = nv
                    fixed += 1
                    total_yoy_recalc += 1
                else:
                    if not k.get("is_short_history"):
                        k["is_short_history"] = True
                        k["yoy"] = "n.d."
                        fixed += 1
                        total_yoy_marked_nd += 1
        if fixed:
            total_files_touched += 1
            if not args.dry_run:
                json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)

    print()
    print(f"Stés touchées : {total_files_touched}")
    print(f"yoy recalculés depuis history : {total_yoy_recalc}")
    print(f"yoy marqués 'n.d.' + is_short_history (history <2 pts) : {total_yoy_marked_nd}")
    print(f"Total : {total_yoy_recalc + total_yoy_marked_nd} KPIs corrigés")
    if args.dry_run:
        print("[dry-run actif, aucune écriture]")


if __name__ == "__main__":
    main()
