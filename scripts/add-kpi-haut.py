#!/usr/bin/env python3
"""add-kpi-haut.py — injecte un KPI issu d'un fix agent DANS la couche
`.batches-drafts-safe/kpis-haut/<T>.json`.

Pourquoi : sur une ste qui a un fichier kpis-haut, loadV17Company remplace
data.kpis par [kpis-haut, ...extras dont le _source est whiteliste]. Un KPI
ajoute par apply-hero-fix.py sur base/enrich n'y survit pas, et l'override
Supabase qui le vise est ignore (il exige que le short existe dans
company.kpis). Injecter ici est la seule voie.

Le KPI est ajoute avec le pv_score le plus haut du fichier, pour qu'il devienne
aussi le `bestHero` si l'override Supabase venait a manquer.

Usage :
  python3 scripts/add-kpi-haut.py /tmp/fix-muv2.de.json Q2-2026
"""
import json, os, sys

D = ".batches-drafts-safe/kpis-haut"


def qlabels(n, last_q):
    q, y = int(last_q[1]), int(last_q.split("-")[1])
    out = []
    for _ in range(n):
        out.append(f"Q{q}-{y}")
        q -= 1
        if q == 0:
            q, y = 4, y - 1
    return list(reversed(out))


def main():
    fix = json.load(open(sys.argv[1]))
    last_q = sys.argv[2]
    t, h = fix["ticker"], fix["hero"]
    p = f"{D}/{t.upper()}.json"
    if not os.path.exists(p):
        print(f"KO {t}: pas de fichier kpis-haut, passe par apply-hero-fix.py")
        return 1
    d = json.load(open(p))
    if any(k["short"] == h["short"] for k in d.get("kpis", [])):
        print(f"KO {t}: {h['short']} deja present, utilise extend-kpis-haut-history.py")
        return 1

    top = max((k.get("pv_score") or 0) for k in d.get("kpis", [])) if d.get("kpis") else 9
    labels = qlabels(len(h["history"]), last_q)
    d.setdefault("kpis", []).insert(0, {
        "short": h["short"],
        "name_fr": h["name_fr"],
        "name_en": h["name_en"],
        "value": h["value"],
        "unit": h["unit"],
        "history": [{"q": q, "v": v} for q, v in zip(labels, h["history"])],
        "pv_score": top,
        "signal": h.get("signal", ""),
        "frequency": "quarterly",
        "last_data_date": h.get("last_data_date"),
        "_source_note": fix.get("source", "filings"),
    })
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    os.replace(tmp, p)
    print(f"OK {t}: {h['short']} injecte, {len(h['history'])} pts ({labels[0]} a {labels[-1]}), pv_score={top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
