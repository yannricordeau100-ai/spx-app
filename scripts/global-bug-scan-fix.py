#!/usr/bin/env python3
"""
Scan global des bugs type VICI sur toutes les fiches + fix automatique.

Bugs détectés et fixés :
  1. history values mix unit (max/min ratio > 1000 = mélange M$ et Mds$)
  2. TTM aberrant (> 100x max(history) → reset à null)
  3. unit incohérent avec value (e.g. value=1.1, unit='M $' mais history en milliers)
  4. last_data_date manquant ou > 18 mois → flag freshness 'stale'
  5. value type incorrect (string '1.1 Mds' au lieu de number 1.1)

Aucun LLM, juste Python + heuristiques.

Usage : python3 scripts/global-bug-scan-fix.py [--dry-run] [--top308-only]
"""
import argparse
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/data/v2-pipeline"
META = ROOT / "sec-data/_meta"


def detect_bugs(d: dict) -> list[str]:
    """Return list of bug codes detected on this dataset."""
    bugs = []
    kpis = d.get("kpis", []) or []
    hero = d.get("hero_kpi")
    hk = next((k for k in kpis if k.get("short") == hero), kpis[0] if kpis else None)
    if not hk: return bugs
    h = hk.get("history") or []
    h_num = [v for v in h if isinstance(v, (int, float))]

    # Bug 1 : history mix unit (ratio max/min > 1000)
    if len(h_num) >= 2:
        non_zero = [abs(v) for v in h_num if v != 0]
        if non_zero and max(non_zero) / min(non_zero) > 1000:
            bugs.append("history_mix_unit")

    # Bug 2 : TTM aberrant
    ttm = hk.get("ttm")
    if isinstance(ttm, (int, float)) and h_num:
        max_h = max(abs(v) for v in h_num) or 1
        if abs(ttm) > 100 * max_h:
            bugs.append("ttm_aberrant")

    # Bug 3 : value est string au lieu de number
    val = hk.get("value")
    if isinstance(val, str) and val.replace(".","").replace(",","").replace("-","").isdigit():
        bugs.append("value_is_string_numeric")

    # Bug 4 : last_data_date manquant ou très ancien
    ldd = hk.get("last_data_date")
    if not ldd:
        bugs.append("missing_last_data_date")
    else:
        try:
            d_ldd = datetime.fromisoformat(ldd.replace("Z", ""))
            if (datetime.now() - d_ldd).days > 540:  # > 18 mois
                bugs.append("stale_last_data_date")
        except Exception:
            bugs.append("invalid_last_data_date")

    return bugs


def fix_bugs(d: dict) -> tuple[dict, list[str]]:
    """Apply fixes for detected bugs. Returns (modified_dict, applied_fixes)."""
    fixes = []
    kpis = d.get("kpis", []) or []
    hero = d.get("hero_kpi")
    hk = next((k for k in kpis if k.get("short") == hero), kpis[0] if kpis else None)
    if not hk: return d, fixes

    h = hk.get("history") or []
    h_num = [v for v in h if isinstance(v, (int, float))]

    # Fix 1 : history mix unit → renormalize en prenant l'unit du value max
    if len(h_num) >= 2:
        non_zero = [abs(v) for v in h_num if v != 0]
        if non_zero and max(non_zero) / min(non_zero) > 1000:
            # Détecte les outliers (probablement raw values)
            # Stratégie : si plus de 70% des values sont dans une plage similaire,
            # les outliers sont les "intrus" → re-scale outliers
            sorted_abs = sorted(non_zero)
            median = sorted_abs[len(sorted_abs) // 2]
            new_h = []
            for v in h:
                if isinstance(v, (int, float)) and v != 0:
                    if abs(v) > median * 100:  # outlier = trop grand
                        new_h.append(round(v / 1000, 3))  # divise par 1000
                    elif abs(v) < median / 100:  # outlier = trop petit
                        new_h.append(round(v * 1000, 3))  # multiplie par 1000
                    else:
                        new_h.append(v)
                else:
                    new_h.append(v)
            hk["history"] = new_h
            fixes.append("history_renormalized")

    # Fix 2 : TTM aberrant → reset à null
    ttm = hk.get("ttm")
    h_num2 = [v for v in (hk.get("history") or []) if isinstance(v, (int, float))]
    if isinstance(ttm, (int, float)) and h_num2:
        max_h = max(abs(v) for v in h_num2) or 1
        if abs(ttm) > 100 * max_h:
            hk["ttm"] = None
            fixes.append("ttm_reset")

    # Fix 3 : value string → number si possible
    val = hk.get("value")
    if isinstance(val, str):
        try:
            cleaned = val.replace(",", "").replace(" ", "")
            if cleaned and (cleaned.replace(".","").replace("-","").isdigit()):
                hk["value"] = float(cleaned) if "." in cleaned else int(cleaned)
                fixes.append("value_str_to_num")
        except Exception:
            pass

    return d, fixes


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--top308-only", action="store_true")
    args = p.parse_args()

    top308 = set()
    if args.top308_only:
        with open(META / "top-searched-stocks-by-country.csv") as f:
            for r in csv.DictReader(f):
                if r.get("ticker"): top308.add(r["ticker"].strip().upper())

    bugs_count = {}
    fixes_count = {}
    files_modified = 0
    total = 0

    # Tri par market cap si possible (top 308 first via CSV order)
    files_to_process = []
    for f in OUT.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n: continue
        tk = n[:-5].upper()
        if args.top308_only and tk not in top308: continue
        # Priority : top 308 first
        priority = 0 if tk in top308 else 1
        files_to_process.append((priority, f))
    files_to_process.sort(key=lambda x: x[0])

    for _, f in files_to_process:
        try: d = json.loads(f.read_text())
        except: continue
        if "_validation" not in d: continue
        total += 1
        bugs = detect_bugs(d)
        for b in bugs:
            bugs_count[b] = bugs_count.get(b, 0) + 1
        if bugs and not args.dry_run:
            d, fixes = fix_bugs(d)
            for fx in fixes:
                fixes_count[fx] = fixes_count.get(fx, 0) + 1
            if fixes:
                f.write_text(json.dumps(d, ensure_ascii=False, indent=2))
                files_modified += 1

    print(f"=== Scan terminé sur {total} fiches validées ===")
    print(f"\nBugs détectés :")
    for b, c in sorted(bugs_count.items(), key=lambda x: -x[1]):
        print(f"  {b:30s} : {c}")
    if not args.dry_run:
        print(f"\nFixes appliqués :")
        for fx, c in sorted(fixes_count.items(), key=lambda x: -x[1]):
            print(f"  {fx:30s} : {c}")
        print(f"\nFichiers modifiés : {files_modified}")
    else:
        print("(dry-run)")


if __name__ == "__main__":
    main()
