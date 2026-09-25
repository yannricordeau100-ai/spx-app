#!/usr/bin/env python3
"""Index des graphiques moyen terme pour le catalogue de la sandbox (26 sept 2026).
Pour chaque spec (scripts/specs-findings) : frequence (annuel, trimestriel,
mensuel, semestriel, autre), nombre de points, series, nature estimee
(societe / comparaison concurrents / marche ou secteur).
Ecrit src/data/findings-catalogue.json (cle = slug)."""
import json, glob, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOIS = r"(janv|fevr|févr|mars|avr|mai|juin|juil|aout|août|sept|oct|nov|dec|déc|jan|feb|mar|apr|may|jun|jul|aug|sep)"
def frequence(cats):
    c = [str(x).strip().lower() for x in cats]
    if not c: return "autre"
    if sum(bool(re.fullmatch(r"(fy\s?|exercice\s)?(19|20)\d{2}(\s?[epr]|\s?\([epr]\))?", x)) for x in c) >= 0.6 * len(c): return "annuel"
    if sum(bool(re.search(r"\b(t|q)[1-4]\b|\b[1-4]t\b|trim", x)) for x in c) >= len(c) / 2: return "trimestriel"
    if sum(bool(re.search(r"\b(s|h)[12]\b|semestre", x)) for x in c) >= len(c) / 2: return "semestriel"
    if sum(bool(re.search(MOIS, x)) for x in c) >= len(c) / 2: return "mensuel"
    if not any(re.search(r"(19|20)\d{2}|\b[tqsh][1-4]\b|" + MOIS, x) for x in c): return "categories"
    return "autre"
out = {}
for p in glob.glob(f"{ROOT}/scripts/specs-findings/*.json") + glob.glob(f"{ROOT}/scripts/specs-findings/*/*.json"):
    try: s = json.load(open(p))
    except Exception: continue
    if not isinstance(s, dict) or "slug" not in s: continue
    series = s.get("series") or []
    noms = [str(se.get("nom", "")) for se in series]
    points = sum(1 for se in series for v in (se.get("valeurs") or []) if isinstance(v, (int, float)))
    titre = str(s.get("titre", ""))
    t = titre.lower()
    if re.search(r"face à|face a|\bvs\b|versus|compar", t) or (len(series) >= 2 and len({n.split()[0] for n in noms if n}) >= 2 and any(re.match(r"[A-Z]", n) for n in noms)):
        nature = "comparaison"
    elif re.search(r"march|secteur|mondial|monde|industrie|filière|pays|états-unis|europe|chine|fédéral|national|population|prix d|cours d|consommation|demande|production mondiale", t):
        nature = "marche"
    else:
        nature = "societe"
    out[s["slug"]] = {"frequence": frequence(s.get("categories") or []), "points": points, "categories": len(s.get("categories") or []),
                      "series": noms[:4], "nature": nature, "debut": str((s.get("categories") or [""])[0]), "fin": str((s.get("categories") or [""])[-1])}
json.dump(out, open(f"{ROOT}/src/data/findings-catalogue.json", "w"), ensure_ascii=False)
from collections import Counter
print(len(out), Counter(v["frequence"] for v in out.values()), Counter(v["nature"] for v in out.values()))
