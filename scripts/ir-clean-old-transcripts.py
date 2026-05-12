#!/usr/bin/env python3
"""Supprime les transcripts plus vieux que N mois (default 12) dans ir-scrape.

Règle Yann (établie historiquement, rappelée 12 mai 2026 ~23h55) :
transcripts >12 mois inutiles, à exclure des collectes et nettoyer.

Détection date : regex sur nom de fichier (priorité) puis URL stockée dans manifest.

Usage :
  python3 scripts/ir-clean-old-transcripts.py            # delete (default)
  python3 scripts/ir-clean-old-transcripts.py --dry-run  # report only
  python3 scripts/ir-clean-old-transcripts.py --months 24
"""
import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

SCRAPE = Path.home() / "Mettrik" / "sec-data" / "ir-scrape"

DATE_PATTERNS = [
    re.compile(r"(20\d{2})[-_/](\d{2})[-_/](\d{2})"),
    re.compile(r"(20\d{2})(\d{2})(\d{2})"),
    re.compile(r"q([1-4])[-_]?(20\d{2}|\d{2})", re.I),
    re.compile(r"fy(20\d{2}|\d{2})", re.I),
]


def extract_date(s):
    for pat in DATE_PATTERNS[:2]:
        m = pat.search(s)
        if not m: continue
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()
        except ValueError:
            continue
    # Quarter
    m = DATE_PATTERNS[2].search(s)
    if m:
        q = int(m.group(1))
        y = m.group(2)
        if len(y) == 2: y = "20" + y
        try:
            return datetime(int(y), q*3, 28).date()
        except ValueError:
            pass
    # FY annual report
    m = DATE_PATTERNS[3].search(s)
    if m:
        y = m.group(1)
        if len(y) == 2: y = "20" + y
        try:
            return datetime(int(y), 12, 31).date()
        except ValueError:
            pass
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cutoff = datetime.today().date() - timedelta(days=args.months * 30)
    print(f"Cutoff date : {cutoff.isoformat()} (everything before = deleted)")
    print()

    deleted = []
    kept = []
    undated = []

    for ticker_dir in sorted(SCRAPE.iterdir()):
        if not ticker_dir.is_dir() or ticker_dir.name.startswith("_"): continue
        trans_dir = ticker_dir / "transcript"
        if not trans_dir.exists(): continue

        # Load manifest for URL lookup
        mp = ticker_dir / "_manifest.json"
        url_lookup = {}
        if mp.exists():
            try:
                m = json.loads(mp.read_text())
                for p in m.get("pdfs", []) + m.get("pass2_results", []):
                    if p.get("path"):
                        url_lookup[Path(p["path"]).name] = (p.get("url",""), p.get("text",""))
            except Exception:
                pass

        for f in trans_dir.iterdir():
            if not f.is_file(): continue
            url, text = url_lookup.get(f.name, ("", ""))
            dt = extract_date(f.name) or extract_date(url) or extract_date(text)
            if dt is None:
                undated.append(f)
                continue
            if dt < cutoff:
                deleted.append((f, dt))
                if not args.dry_run:
                    f.unlink()
            else:
                kept.append((f, dt))

    print(f"Transcripts trouvés au total : {len(deleted)+len(kept)+len(undated)}")
    print(f"  ✅ Gardés (< {args.months} mois)    : {len(kept)}")
    print(f"  ❌ {'À supprimer' if args.dry_run else 'Supprimés'} (> {args.months} mois) : {len(deleted)}")
    print(f"  ⚠ Date inconnue (gardés)         : {len(undated)}")

    if deleted:
        print(f"\nExemples supprimés :")
        for f, d in deleted[:10]:
            print(f"  {d.isoformat()} {f.relative_to(SCRAPE)}")


if __name__ == "__main__":
    main()
