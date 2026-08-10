#!/usr/bin/env python3
"""purge-kpis-haut.py — retire des KPIs contamines de
`.batches-drafts-safe/kpis-haut/<TICKER>.json`.

Pourquoi cette couche a part : loadV17Company merge kpis-haut APRES le filtre
`disabled-kpis-per-ste` et APRES le remove[] de apply-hero-fix.py. Un KPI
contamine qui y vit survit donc a toutes les autres purges (constat 11 aout
2026 : KLAC "INVENTORY", TRV "GWP", CHRW "oth_opinc" = CA total, invisibles
aux deux mecanismes existants).

Entree : {"TICKER": ["short", ...]}. Ecriture atomique, idempotent.

Usage :
  python3 scripts/purge-kpis-haut.py --file /tmp/disable.json
"""
import json, os, sys, glob

D = ".batches-drafts-safe/kpis-haut"
ARRAYS = ("kpis", "kpis_supplementary", "stories_kpis")


def main():
    a = sys.argv[1:]
    if not a:
        print("usage: purge-kpis-haut.py --file <json> | '<json>'")
        return 1
    payload = json.load(open(a[1])) if a[0] == "--file" else json.loads(a[0])

    tot = 0
    for t, shorts in payload.items():
        sset = {s.strip().lower() for s in shorts if s}
        hits = [p for p in glob.glob(f"{D}/*.json")
                if os.path.basename(p)[:-5].upper() == t.upper()]
        for p in hits:
            d = json.load(open(p))
            n = 0
            for arr in ARRAYS:
                if isinstance(d.get(arr), list):
                    before = len(d[arr])
                    d[arr] = [k for k in d[arr]
                              if str((k or {}).get("short", "")).strip().lower() not in sset]
                    n += before - len(d[arr])
            if n:
                tmp = p + ".tmp"
                with open(tmp, "w") as f:
                    json.dump(d, f, indent=2, ensure_ascii=False)
                os.replace(tmp, p)
                print(f"  {t}: {n} retires de {os.path.basename(p)}")
                tot += n
    print(f"{tot} KPIs purges de kpis-haut")
    return 0


if __name__ == "__main__":
    sys.exit(main())
