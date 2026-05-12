#!/usr/bin/env python3
"""Génère le rapport final des stés où le scraping n'a pas pu récupérer de docs.

Output : src/data/ir-scrape-failures.json + résumé console.

Critères :
  - aucun PDF téléchargé (Pass 1 + Pass 2)
  - 0 snapshot HTML
  - aucun extra file
  - Erreurs fetch/timeout/403
"""
import json
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
OUT_ROOT = Path.home() / "Mettrik" / "sec-data" / "ir-scrape"
REPORT_PATH = ROOT / "src" / "data" / "ir-scrape-failures.json"

# Categorize
def cat(t):
    if t == "BABA": return "cat4"
    suf = t.split(".")[-1] if "." in t else ""
    if suf in ("PA","DE","SW","MI","MC","AS","BR","LS","HE","ST","CO","OL","L","VI","IR","LU"):
        return "cat3"
    if suf == "T": return "cat2"
    return "cat1"  # FPI ADRs détectées plus tard si besoin


def main():
    # Filter only top 307 V1.8
    v18 = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))
    target = set(v18)
    # Sinon, --all = tous manifest sur disque
    if "--all" in sys.argv:
        target = None

    failures = []
    partial = []
    success = []
    no_manifest = []

    iter_set = sorted(target) if target else sorted([p.name for p in OUT_ROOT.iterdir() if p.is_dir() and not p.name.startswith("_")])
    for t in iter_set:
        mp = OUT_ROOT / t / "_manifest.json"
        if not mp.exists():
            no_manifest.append(t)
            continue
        try:
            m = json.loads(mp.read_text())
        except Exception as e:
            failures.append({"ticker": t, "reason": "manifest-corrupt", "err": str(e)})
            continue

        p1_dl = m.get("pdfs_downloaded", 0)
        p2_dl = m.get("pass2_pdfs_downloaded", 0)
        snaps = len(m.get("snapshots") or [])
        extras = len(m.get("extras") or [])
        total_docs = p1_dl + p2_dl + extras

        rec = {
            "ticker": t, "cat": cat(t),
            "p1_dl": p1_dl, "p2_dl": p2_dl,
            "snapshots": snaps, "extras": extras,
            "total_docs": total_docs,
            "fetch_errors": len(m.get("fetch_errors") or []),
            "needs_pass2_marked": m.get("needs_pass2", False),
        }
        if total_docs == 0:
            rec["reason"] = "no-doc-found"
            failures.append(rec)
        elif total_docs < 3:
            rec["reason"] = f"only-{total_docs}-docs"
            partial.append(rec)
        else:
            success.append(rec)

    print(f"=== Rapport final scraping (top 307 V1.8) ===")
    print(f"  Stés total ciblées : {len(iter_set)}")
    print(f"  ✅ Succès (≥3 docs)   : {len(success)}")
    print(f"  ⚠ Partiel (1-2 docs) : {len(partial)}")
    print(f"  ❌ Échec (0 doc)      : {len(failures)}")
    print(f"  ⏸ Manifest absent     : {len(no_manifest)}")

    by_cat = defaultdict(lambda: {"total":0,"success":0,"partial":0,"fail":0})
    for r in success:
        by_cat[r["cat"]]["total"]+=1; by_cat[r["cat"]]["success"]+=1
    for r in partial:
        by_cat[r["cat"]]["total"]+=1; by_cat[r["cat"]]["partial"]+=1
    for r in failures:
        by_cat[r["cat"]]["total"]+=1; by_cat[r["cat"]]["fail"]+=1
    print()
    print("=== Par catégorie ===")
    for c, s in sorted(by_cat.items()):
        print(f"  {c}: {s['success']}/{s['total']} OK · {s['partial']} partiel · {s['fail']} échec")

    if failures:
        print(f"\nÉchecs (top 30) :")
        for r in failures[:30]:
            print(f"  {r['ticker']:12} ({r['cat']}) fetch_errs={r['fetch_errors']}")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps({
        "generated_at": "auto",
        "universe": "top307 V1.8" if target else "all",
        "summary": {
            "success": len(success), "partial": len(partial),
            "failures": len(failures), "no_manifest": len(no_manifest),
        },
        "by_cat": dict(by_cat),
        "failures": failures,
        "partial": partial,
        "no_manifest": no_manifest,
    }, indent=2))
    print(f"\n✅ Rapport écrit : {REPORT_PATH}")


if __name__ == "__main__":
    main()
