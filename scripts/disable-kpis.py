#!/usr/bin/env python3
"""disable-kpis.py — masque des KPIs contamines via le mecanisme officiel
`src/data/disabled-kpis-per-ste.json` (celui de /admin/kpis-toggle).

Pourquoi : le `remove[]` de apply-hero-fix.py ne nettoie que base + enrich +
specific-kpis. Les KPIs venus des autres couches mergees par loadV17Company
(stories, sa22d, kpis-v3, kpis-haut, desk_special_kpis...) y survivent. Le filtre
`disabled-kpis` s'applique APRES tous les merges : il attrape tout.

Ajout uniquement (jamais d'ecrasement des choix de Yann), ecriture atomique.

Usage :
  python3 scripts/disable-kpis.py '{"TRV":["GWP"],"KLAC":["INVENTORY"]}'
  python3 scripts/disable-kpis.py --file /tmp/disable.json
"""
import json, os, sys

P = "src/data/disabled-kpis-per-ste.json"


def main():
    a = sys.argv[1:]
    if not a:
        print("usage: disable-kpis.py '<json>' | --file <path>")
        return 1
    payload = json.load(open(a[1])) if a[0] == "--file" else json.loads(a[0])

    d = json.load(open(P))
    ov = d.setdefault("overrides", {})
    added = 0
    for t, shorts in payload.items():
        cur = ov.setdefault(t, [])
        for s in shorts:
            if s not in cur:
                cur.append(s)
                added += 1
        ov[t] = cur

    tmp = P + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    os.replace(tmp, P)
    print(f"{added} KPIs desactives sur {len(payload)} stes -> {P}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
