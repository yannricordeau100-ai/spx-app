#!/usr/bin/env python3
"""Controle des fichiers docs/cahier/donnees/<TICKER>.json (recherche de donnees KPI)."""
import json, os, re, sys, glob
R = os.path.dirname(os.path.abspath(__file__))
STATUTS = {"existe", "trouve", "non_trouve", "actuel_seulement", "autre"}
kpis_si = {}
for f in glob.glob(os.path.join(R, "../kpi/[0-9]*.json")):
    d = json.load(open(f)); kpis_si[d["code"]] = {k["short"] for k in d["kpis"] if k.get("type") == "organique"}
ann = json.load(open(os.path.join(R, "../societes-gics.json")))["societes"]
cibles = sys.argv[1:]
pb = []; ok = []
for f in sorted(glob.glob(os.path.join(R, "[A-Z0-9]*.json"))):
    t = os.path.basename(f)[:-5]
    if cibles and t not in cibles: continue
    try: d = json.load(open(f))
    except Exception as e: pb.append((t, f"JSON invalide : {e}")); continue
    err = []
    if d.get("ticker") != t: err.append("ticker different du nom de fichier")
    code = str(d.get("code", ""))
    if ann.get(t) != code: err.append(f"code {code} differe de l annuaire {ann.get(t)}")
    attendus = kpis_si.get(code, set())
    vus = set()
    for k in d.get("kpis", []):
        s = k.get("short"); vus.add(s)
        st = k.get("statut")
        if st not in STATUTS: err.append(f"{s} : statut {st}")
        if st in ("actuel_seulement", "autre", "non_trouve") and not (k.get("commentaire") or "").strip(): err.append(f"{s} : commentaire requis pour {st}")
        an = k.get("annees") or {}
        if st == "trouve":
            if len(an) < 2: err.append(f"{s} : trouve avec {len(an)} annee(s)")
            if not k.get("sources"): err.append(f"{s} : trouve sans source")
            for a, v in an.items():
                if not re.fullmatch(r"\d{4}", str(a)): err.append(f"{s} : cle annee {a}")
                if not isinstance(v, (int, float)): err.append(f"{s} : valeur {a} non numerique")
            if not k.get("unite"): err.append(f"{s} : unite vide")
            if an:
                ys = sorted(int(a) for a in an); attendu_complet = (ys[-1] - ys[0] + 1 == len(ys))
                if bool(k.get("complet")) != attendu_complet: err.append(f"{s} : complet={k.get('complet')} incoherent avec les annees")
        if st == "actuel_seulement" and len(an) > 1: err.append(f"{s} : actuel_seulement avec plusieurs annees")
        for src in k.get("sources") or []:
            if not str(src.get("url", "")).startswith("http"): err.append(f"{s} : source sans URL")
    manquants = attendus - vus
    if manquants: err.append(f"KPI organiques non traites : {sorted(manquants)}")
    if re.search(r"\bYann\b|—", open(f, encoding="utf-8").read()): err.append("texte interdit (prenom ou tiret long)")
    (pb.append((t, " ; ".join(err))) if err else ok.append(t))
print(f"OK {len(ok)}  problemes {len(pb)}")
for t, e in pb: print(t, "->", e)
sys.exit(1 if pb else 0)
