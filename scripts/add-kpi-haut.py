#!/usr/bin/env python3
"""add-kpi-haut.py — INJECTE un KPI hero dans
`.batches-drafts-safe/kpis-haut/<TICKER>.json`, la couche qui gagne au rendu.

Pourquoi ce script existe (constat 12 aout 2026, cas CRH) :
`apply-hero-fix.py` ecrit le nouveau KPI sur `src/data/v2-pipeline/<t>.json`
(base) et pose `hero_kpi`. Mais quand une ste possede un fichier kpis-haut,
`loadV17Company` REMPLACE la liste de KPIs par celle de cette couche : le KPI
fraichement extrait n'existe donc pas dans le rendu. Consequence en chaine,
l'override Supabase `desk_hero_kpi_overrides` ne s'applique pas non plus, car
il exige que le short soit present dans `company.kpis`. Le fix etait invisible
sur les trois mecanismes a la fois.

Ce script complete `purge-kpis-haut.py` (qui, lui, retire). Il prend le MEME
fichier de fix que `apply-hero-fix.py` et convertit l'history :
base = tableau de nombres bruts, kpis-haut = tableau de {"q": "...", "v": n}.

Entree : un ou plusieurs /tmp/fix-<ticker>.json. Un argument qui n'est pas un
.json est ignore avec un avertissement : la version du 11 aout 2026 prenait une
etiquette de periode en 2e argument positionnel ("Q2-2026"), elle est desormais
deduite de `last_data_date` du fix.
Ecriture atomique, backup .bak-<horodatage>, idempotent (re-run = mise a jour
du meme short, pas de doublon).

Usage :
  python3 scripts/add-kpi-haut.py /tmp/fix-crh.json [/tmp/fix-app.json ...]
"""
import json, os, sys, glob, time

D = ".batches-drafts-safe/kpis-haut"

PERIOD_TO_FREQ = {
    "quarter": "quarterly",
    "quarterly": "quarterly",
    "year": "annual",
    "annual": "annual",
    "half-year": "semiannual",
    "semester": "semiannual",
}


def labels(period_type, n, last_data_date):
    """Etiquettes de periode du plus ANCIEN au plus RECENT, deduites de
    last_data_date. Un FY se note "FY2025", un trimestre "Q3-2025", un
    semestre "H1-2025"."""
    y = int(str(last_data_date)[:4])
    m = int(str(last_data_date)[5:7] or 12)
    p = (period_type or "").lower()
    if p in ("year", "annual"):
        return [f"FY{y - (n - 1 - i)}" for i in range(n)]
    if p in ("half-year", "semester"):
        out, cy, ch = [], y, 1 if m <= 6 else 2
        for _ in range(n):
            out.append(f"H{ch}-{cy}")
            ch -= 1
            if ch == 0:
                ch, cy = 2, cy - 1
        return out[::-1]
    out, cy, cq = [], y, max(1, min(4, (m + 2) // 3))
    for _ in range(n):
        out.append(f"Q{cq}-{cy}")
        cq -= 1
        if cq == 0:
            cq, cy = 4, cy - 1
    return out[::-1]


def yoy_str(hist, period_type):
    """Variation sur un an, au format de la couche ("+4,2%"). Le pas depend de
    la periode : 4 points pour du trimestriel, 2 pour du semestriel, 1 pour de
    l'annuel. Sans ce champ la pastille YoY du hero reste vide sur la page,
    constat du 12 aout 2026 apres injection des 7 heros extraits."""
    p = (period_type or "").lower()
    step = 4 if p.startswith("quarter") else 2 if p in ("half-year", "semester") else 1
    if len(hist) <= step:
        return None
    prev, last = hist[-1 - step], hist[-1]
    if not prev:
        return None
    pct = (last / prev - 1) * 100
    return f"{pct:+.1f}".replace(".", ",") + "%"


def sniff_indent(path, default=1):
    """Indentation du fichier existant. Cette couche melange indent=1 et
    indent=2 selon le lot d'extraction : imposer une valeur unique produirait un
    diff de plusieurs milliers de lignes a chaque injection."""
    with open(path, encoding="utf-8") as fh:
        fh.readline()
        second = fh.readline()
    n = len(second) - len(second.lstrip(" "))
    return n if n > 0 else default


def find_file(ticker):
    for p in glob.glob(f"{D}/*.json"):
        if os.path.basename(p)[:-5].upper() == ticker.upper():
            return p
    return None


def main():
    fixes = [a for a in sys.argv[1:] if a.endswith(".json")]
    for a in sys.argv[1:]:
        if not a.endswith(".json"):
            print(f"IGNORE argument '{a}' : les etiquettes de periode sont "
                  f"deduites de last_data_date depuis le 12 aout 2026")
    if not fixes:
        print("usage: add-kpi-haut.py /tmp/fix-<ticker>.json ...")
        return 1

    done = 0
    for f in fixes:
        fix = json.load(open(f))
        t, h = fix["ticker"], fix["hero"]
        p = find_file(t)
        if not p:
            print(f"SKIP {t}: aucun fichier kpis-haut, le fix sur base suffit")
            continue

        d = json.load(open(p))
        arr = d.get("kpis")
        if not isinstance(arr, list):
            print(f"SKIP {t}: pas de tableau kpis dans {p}")
            continue

        hist = [x for x in (h.get("history") or []) if isinstance(x, (int, float))]
        if not hist:
            print(f"SKIP {t}: history vide ou non numerique")
            continue
        labs = labels(h.get("period_type"), len(hist), h.get("last_data_date"))
        kpi = {
            "short": h["short"],
            "name_fr": h.get("name_fr", h["short"]),
            "name_en": h.get("name_en", h["short"]),
            "value": h.get("value", hist[-1]),
            "unit": h.get("unit", ""),
            "yoy": h.get("yoy") or yoy_str(hist, h.get("period_type")),
            "history": [{"q": q, "v": v} for q, v in zip(labs, hist)],
            # pv_score le plus haut du fichier : ce KPI doit gagner la
            # selection du hero de la couche, car loadV17Company termine par
            # data.hero_kpi = short du KPI de pv_score maximal.
            "pv_score": max([10] + [k.get("pv_score") or 0 for k in arr]) + 1,
            "signal": h.get("signal", ""),
            "frequency": PERIOD_TO_FREQ.get((h.get("period_type") or "").lower(), "quarterly"),
            "period_type": h.get("period_type", "quarter"),
            "last_data_date": h.get("last_data_date"),
            "type": h.get("type", "Demand"),
            "nature": h.get("nature", "Structurel"),
            "comparable": h.get("comparable", "Comparable"),
            "is_wow": bool(h.get("is_wow", True)),
            "_source": fix.get("source", "filings"),
        }

        pos = next((i for i, k in enumerate(arr) if k.get("short") == kpi["short"]), None)
        if pos is None:
            arr.insert(0, kpi)
            action = "ajoute"
        else:
            arr[pos] = kpi
            action = "mis a jour"

        indent = sniff_indent(p)
        bak = f"{p}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
        os.replace(p, bak)
        tmp = f"{p}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=indent)
        os.replace(tmp, p)
        done += 1
        print(f"OK {t}: {kpi['short']} {action} dans kpis-haut "
              f"({len(hist)} pts, {kpi['frequency']}, val={kpi['value']}) | backup {os.path.basename(bak)}")

    print(f"\n=== {done}/{len(fixes)} injections kpis-haut ===")
    print("Pense a poser l'override : python3 scripts/set-hero-override.py --file <json>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
