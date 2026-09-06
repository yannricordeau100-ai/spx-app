#!/usr/bin/env python3
"""Pose sur les fiches les KPI du Cahier (docs/cahier/donnees/<T>.json), 6 sept 2026.

Usage : python3 scripts/cahier-pose.py [--autres] [--retire] TICKER [TICKER...]

Ecrit dans .batches-drafts-safe/kpis-haut/<T>.json (couche qui remplace les KPI a la
fusion) :
  - statut `trouve`  (>= 2 annees) : NOUVEAU KPI annuel, marque _cahier = "nouveau" ;
  - statut `autre`   (>= 2 annees, avec --autres) : NOUVEAU KPI, marque _cahier = "autre" ;
  - statut `existe`  (annees non vides) :
      * serie en ligne ANNUELLE dans kpis-haut (meme unite ou conversion connue) :
        exercices manquants ajoutes, marque _cahier = "allonge", _cahier_periodes =
        exercices ajoutes ;
      * sinon (serie en ligne trimestrielle ou hors kpis-haut) : NOUVEAU KPI
        « (serie annuelle) », marque _cahier = "allonge", toutes periodes marquees.
--retire : enleve tout ce qui a ete pose par ce script (marque _added_batch) et
retire les periodes ajoutees aux series allongees.
Jamais de valeur inventee : tout vient du Cahier, sources reprises dans _src_note.
"""
import json, os, re, sys

LOT = "kpi-cahier-sept-2026"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONV = {("moz", "koz"): 1000.0, ("koz", "moz"): 0.001, ("mds $", "m $"): 1000.0, ("m $", "mds $"): 0.001,
        ("mds €", "m €"): 1000.0, ("m €", "mds €"): 0.001, ("millions", "m"): 1.0, ("m", "millions"): 1.0}


def norm_unit(u):
    return (u or "").strip().lower().replace("us$", "$").replace("usd", "$")


def annee_de(q):
    m = re.search(r"(20\d{2}|19\d{2})", str(q))
    return int(m.group(1)) if m else None


def yoy(vals):
    if len(vals) < 2 or vals[-2] in (0, None) or vals[-1] is None:
        return "n/a"
    return f"{(vals[-1] / vals[-2] - 1) * 100:+.1f}%"


def cle_tri(h):
    y = annee_de(h["q"]) or 0
    m = re.match(r"^Q([1-4])", str(h["q"]))
    return y * 10 + (int(m.group(1)) if m else 5)


def pose(ticker, autres=False, retire=False):
    dp = os.path.join(ROOT, "docs/cahier/donnees", f"{ticker}.json")
    hp = os.path.join(ROOT, ".batches-drafts-safe/kpis-haut", f"{ticker}.json")
    if not os.path.exists(dp):
        return f"{ticker} : pas de fichier Cahier"
    if not os.path.exists(hp):
        return f"{ticker} : pas de couche kpis-haut, pose impossible sans creer la couche (non fait)"
    d = json.load(open(dp))
    h = json.load(open(hp))
    kpis = h.setdefault("kpis", [])
    if retire:
        avant = len(kpis)
        kpis[:] = [k for k in kpis if k.get("_added_batch") != LOT]
        for k in kpis:
            per = set(k.get("_cahier_periodes") or [])
            if per and k.get("_cahier") == "allonge":
                k["history"] = [x for x in k["history"] if x.get("q") not in per]
                for c in ("_cahier", "_cahier_periodes"):
                    k.pop(c, None)
        json.dump(h, open(hp, "w"), ensure_ascii=False)
        return f"{ticker} : {avant - len(kpis)} KPI retires"
    shorts = {k.get("short") for k in kpis}
    bilan = []
    for k in d["kpis"]:
        st, annees = k.get("statut"), k.get("annees") or {}
        annees = {int(y): v for y, v in annees.items() if isinstance(v, (int, float))}
        if not annees:
            continue
        srcs = "; ".join(s.get("url", "") for s in (k.get("sources") or [])[:6])
        note = f"Pose depuis le Cahier le 06/09/2026 (docs/cahier/donnees/{ticker}.json, KPI {k['short']}). Sources : {srcs}"
        if st in ("trouve", "autre") or (st == "existe"):
            if st == "autre" and not autres:
                continue
            if st in ("trouve", "autre") and len(annees) < 2:
                continue
            if st == "existe":
                cible = None
                sel = k.get("short_en_ligne")
                for x in kpis:
                    if sel and (x.get("short") == sel or x.get("name_en") == sel or x.get("name_fr") == sel):
                        cible = x
                        break
                if cible and cible.get("frequency") == "annual":
                    uo, uc = norm_unit(cible.get("unit")), norm_unit(k.get("unite"))
                    fac = 1.0 if uo == uc else CONV.get((uc, uo))
                    if fac is None:
                        bilan.append(f"{k['short']} : unite {k.get('unite')} vs {cible.get('unit')} non convertible, ignore")
                        continue
                    # Les series annuelles de kpis-haut portent parfois des libelles
                    # « Q4-2018 » ; le chargeur ne garde que les libelles FY pour une
                    # serie annuelle, on les normalise donc en « FY2018 ».
                    for x in cible.get("history", []):
                        y0 = annee_de(x.get("q"))
                        if y0 and not re.match(r"^(FY\d{4}|\d{4})$", str(x["q"])):
                            x["_q_origine"] = x["q"]
                            x["q"] = f"FY{y0}"
                    deja = {annee_de(x["q"]) for x in cible.get("history", [])}
                    ajout = []
                    for y in sorted(annees):
                        if y in deja:
                            continue
                        cible.setdefault("history", []).append({"q": f"FY{y}", "v": round(annees[y] * fac, 4)})
                        ajout.append(f"FY{y}")
                    if not ajout:
                        continue
                    cible["history"].sort(key=cle_tri)
                    cible["_cahier"] = "allonge"
                    cible["_cahier_periodes"] = sorted(set(cible.get("_cahier_periodes", []) + ajout))
                    cible["_cahier_note"] = note
                    bilan.append(f"{k['short']} : serie {cible['short']} allongee de {len(ajout)} exercices")
                    continue
                # serie en ligne trimestrielle ou introuvable : serie annuelle a part
                marque, suffixe = "allonge", " (série annuelle)"
            else:
                marque, suffixe = ("nouveau" if st == "trouve" else "autre"), ""
            short = f"CAHIER_{k['short']}"
            if short in shorts:
                continue
            ys = sorted(annees)
            vals = [annees[y] for y in ys]
            nouveau = {
                "short": short,
                "name_fr": (k.get("nom_fr") or k["short"]) + suffixe,
                "name_en": k["short"].replace("_", " ").title(),
                "value": vals[-1],
                "unit": k.get("unite") or "",
                "yoy": yoy(vals),
                "pv_score": 6,
                "frequency": "annual",
                "last_data_date": f"{ys[-1]}-12-31",
                "history": [{"q": f"FY{y}", "v": annees[y]} for y in ys],
                "signal": (k.get("commentaire") or "")[:420],
                "_added_batch": LOT,
                "_cahier": marque,
                "_cahier_periodes": [f"FY{y}" for y in ys],
                "_src_note": note,
            }
            if len(ys) < 5:
                nouveau["is_short_history"] = True
                nouveau["story_category"] = "Adoption"
            kpis.append(nouveau)
            shorts.add(short)
            bilan.append(f"{k['short']} : nouveau ({marque}, {len(ys)} exercices)")
    json.dump(h, open(hp, "w"), ensure_ascii=False)
    return f"{ticker} : " + ("; ".join(bilan) if bilan else "rien a poser")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for t in args:
        print(pose(t, autres="--autres" in sys.argv, retire="--retire" in sys.argv))
