#!/usr/bin/env python3
"""extend-kpis-haut-history.py — allonge l'history d'un KPI de la couche
`.batches-drafts-safe/kpis-haut/<T>.json` a partir d'un fix agent verbatim.

Pourquoi : quand une ste a un fichier kpis-haut, loadV17Company REMPLACE
data.kpis par [kpis-haut converted, ...extras dont le _source est whiteliste].
Un KPI ajoute par apply-hero-fix.py y est donc elimine, et l'override Supabase
qui pointe dessus est ignore (il exige que le short existe dans company.kpis).
La seule facon d'allonger un hero sur ces stes est d'ecrire dans kpis-haut.

Garde-fou : la queue de la serie du fix doit correspondre EXACTEMENT a
l'history deja en place (tolerance 0,5 %). Sinon on refuse : deux sources qui
divergent signalent une extraction douteuse, pas une extension.

Usage :
  python3 scripts/extend-kpis-haut-history.py /tmp/fix-dhr.json biotech_rev
"""
import json, os, sys

D = ".batches-drafts-safe/kpis-haut"


def qlabels(n, last_q):
    """Genere n labels Qx-YYYY en remontant depuis last_q (ex 'Q2-2026')."""
    q, y = int(last_q[1]), int(last_q.split("-")[1])
    out = []
    for _ in range(n):
        out.append(f"Q{q}-{y}")
        q -= 1
        if q == 0:
            q, y = 4, y - 1
    return list(reversed(out))


def main():
    fixpath, short = sys.argv[1], sys.argv[2]
    fix = json.load(open(fixpath))
    t = fix["ticker"]
    new = [float(x) for x in fix["hero"]["history"]]

    p = f"{D}/{t.upper()}.json"
    if not os.path.exists(p):
        print(f"KO {t}: pas de fichier kpis-haut")
        return 1
    d = json.load(open(p))
    k = next((x for x in d.get("kpis", []) if x["short"] == short), None)
    if not k:
        print(f"KO {t}: short '{short}' absent de kpis-haut")
        return 1
    old = k.get("history") or []
    n = len(old)
    if n >= len(new):
        print(f"KO {t}: history deja {n} pts, le fix en a {len(new)}")
        return 1

    tail = new[-n:]
    for a, b in zip(tail, [float(x["v"]) for x in old]):
        if abs(a - b) > max(abs(b) * 0.005, 1e-9):
            print(f"KO {t}: divergence {a} vs {b} sur la queue, extension refusee")
            return 1

    labels = qlabels(len(new), old[-1]["q"])
    k["history"] = [{"q": q, "v": v} for q, v in zip(labels, new)]
    k["value"] = new[-1]
    if fix["hero"].get("last_data_date"):
        k["last_data_date"] = fix["hero"]["last_data_date"]

    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    os.replace(tmp, p)
    print(f"OK {t}: {short} {n} -> {len(new)} pts ({labels[0]} a {labels[-1]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
