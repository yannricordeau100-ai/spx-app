#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Detecteur d unites (chantier Comparer, point 2, 14 sept 2026), sur TOUS les KPI
servis et toute leur histoire :
  A. ecart d echelle entre societes partageant une meme cle de comparabilite
     (mediane des ordres de grandeur, ecart > 2,5 decades = suspect) ;
  B. rupture d un facteur >= 500 entre deux points consecutifs d une serie ;
  C. unite annoncee incoherente avec la valeur (ex. "Mds $" avec 935 413).
La confrontation au 10-K (point C complet) est laissee a l agent verificateur,
qui ne relit que les cas signales ici.
Sortie : .conv-state/unites-detecteur.json
"""
import json, os, re, math, collections, statistics
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")
SORTIE = os.path.join(ROOT, ".conv-state/unites-detecteur.json")
CAT = os.path.join(ROOT, "src/data/compare-catalogue.json")


def normalise(s):
    s = str(s or "").lower().replace("&", " and ")
    s = re.sub(r"\([^)]*\)", " ", s); s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def famille(u):
    l = str(u or "").lower()
    if "%" in l or "bps" in l or "points de base" in l: return "pct"
    if "/" in l or re.search(r"\bpar\b|\bper\b", l): return "par_unite"
    if re.search(r"\$|€|chf|£|usd|eur|gbp", l): return "money"
    if re.search(r"^x$|ratio|fois", l): return "ratio"
    return "autre"


def echelle(u):
    l = str(u or "").lower()
    if re.search(r"trillion|\btn\b|\$\s?t\b|^t\b|\bt\s?\$", l): return 1e12
    if re.search(r"mds|milliard|billion|\bbn\b|_bn|\bb\b|\bmd\b|\$md|md\s?\$|^g\s?[$€]|\bg(usd|eur)\b", l): return 1e9
    if re.search(r"(^|[^a-z])m($|[^a-z])|million", l): return 1e6
    if re.search(r"(^|[^a-z])k($|[^a-z])|millier|thousand", l): return 1e3
    return 1


def vals(h):
    out = []
    for p in h or []:
        v = p.get("v") if isinstance(p, dict) else p
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v):
            out.append(float(v))
    return out


def main():
    u = json.load(open(UNIVERS))["tickers"]
    cat = json.load(open(CAT)).get("catalogue", {}) if os.path.exists(CAT) else {}
    par_cle = collections.defaultdict(list)
    ruptures, incoherences = [], []
    for t in u:
        vus = set()
        for couche, p, cles in (("haut", os.path.join(ROOT, ".batches-drafts-safe/kpis-haut/%s.json" % t), ["kpis"]),
                                ("base", os.path.join(ROOT, "src/data/v2-pipeline/%s.json" % t.lower()), ["kpis", "stories_kpis"])):
            if not os.path.exists(p): continue
            try: d = json.load(open(p))
            except Exception: continue
            for c in cles:
                for k in d.get(c) or []:
                    s = k.get("short")
                    if couche == "base" and s in vus: continue
                    vus.add(s)
                    v = vals(k.get("history"))
                    if not v: continue
                    lab = normalise(k.get("name_en") or k.get("name_fr") or s); lab = cat.get(lab, lab)
                    fam = famille(k.get("unit")); sc = echelle(k.get("unit"))
                    absv = [abs(x) for x in v if x]
                    if absv:
                        par_cle[(lab, fam)].append((t, couche, s, k.get("unit"), statistics.median(math.log10(x * sc) for x in absv)))
                    for a, b in zip(v, v[1:]):
                        if a and b and (abs(b / a) >= 500 or abs(b / a) <= 1 / 500):
                            ruptures.append({"ticker": t, "couche": couche, "short": s, "unit": k.get("unit"), "avant": a, "apres": b}); break
                    if fam == "money" and sc >= 1e9 and absv and statistics.median(absv) > 5e4:
                        incoherences.append({"ticker": t, "couche": couche, "short": s, "unit": k.get("unit"), "mediane": statistics.median(absv), "cause": "milliards annonces mais valeurs a 5 chiffres ou plus"})
                    if fam == "pct" and absv and statistics.median(absv) > 1000:
                        incoherences.append({"ticker": t, "couche": couche, "short": s, "unit": k.get("unit"), "mediane": statistics.median(absv), "cause": "pourcentage superieur a 1 000"})
    ecarts = []
    for (lab, fam), lst in par_cle.items():
        if fam != "money" or len(lst) < 3: continue
        med = statistics.median(x[4] for x in lst)
        for t, couche, s, un, m in lst:
            if abs(m - med) > 2.5:
                ecarts.append({"cle": lab, "ticker": t, "couche": couche, "short": s, "unit": un, "decades_vs_mediane": round(m - med, 1), "nb_stes": len(lst)})
    out = {"maj": datetime.now().isoformat(timespec="seconds"), "ecarts_entre_societes": sorted(ecarts, key=lambda x: -abs(x["decades_vs_mediane"])),
           "ruptures_de_serie": ruptures, "incoherences_unite_valeur": incoherences}
    json.dump(out, open(SORTIE, "w"), ensure_ascii=False, indent=1)
    print("ecarts", len(ecarts), "| ruptures", len(ruptures), "| incoherences", len(incoherences), "->", SORTIE)


if __name__ == "__main__":
    main()
