#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Types de KPI (chantier Comparer, point 5, 14 sept 2026).

Pour chaque KPI IC (kpis, pas les stories) de chaque societe, Opus decide :
  - type comparable : libelle du referentiel officiel des 74 industries GICS
    (docs/cahier/kpi-referentiel-gics-74.json) quand il existe, sinon un
    libelle nouveau generalise (regle du concurrent : un concurrent peut le
    publier, meme en theorie) ; « part de marche de Chrome » devient « part de
    marche des navigateurs web » ; « villes desservies par Waymo » devient
    « villes couvertes par un service de robotaxi » ;
  - KPI unique : aucun concurrent ne peut publier la meme mesure.
Sonnet relit un echantillon (1 KPI sur 10) et les types nouveaux.

Champ pose sur le KPI (invisible dans le tableau, affiche dans le « i »,
utilise par le Comparer) : type_comparable = {fr, en, origine} avec origine
« referentiel » | « nouveau », ou type_comparable = null pour un KPI unique.

Couches : .batches-drafts-safe/kpis-haut/<T>.json (kpis) et
src/data/v2-pipeline/<t>.json (kpis, hors ceux remplaces par kpis-haut).
Reprise : .conv-state/types-kpi-etat.json ; journal .conv-state/types-kpi.log
Usage : python3 scripts/types-kpi.py [--tickers A,B] [--exclure ...] [--dry-run]
"""
import argparse, json, os, re, subprocess, random
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")
REF = os.path.join(ROOT, "docs/cahier/kpi-referentiel-gics-74.json")
GICS = os.path.join(ROOT, "docs/cahier/societes-gics.json")
HAUT = os.path.join(ROOT, ".batches-drafts-safe/kpis-haut")
V2 = os.path.join(ROOT, "src/data/v2-pipeline")
ETAT = os.path.join(ROOT, ".conv-state/types-kpi-etat.json")
LOG = os.path.join(ROOT, ".conv-state/types-kpi.log")
LOT = 25

CONSIGNE = """Tu classes les KPI d une societe cotee ({nom}, {ticker}, industrie GICS {industrie}) pour une application d analyse d actions.

Pour CHAQUE KPI, decide s il est un TYPE COMPARABLE ou un KPI UNIQUE :
- Type comparable : au moins un concurrent pourrait publier la meme mesure, meme en theorie. Le type est alors un libelle GENERIQUE (francais et anglais) : si un libelle du referentiel officiel de l industrie ci-dessous correspond a la mesure, utilise-le EXACTEMENT (origine "referentiel") ; sinon ecris un libelle nouveau, court, generique (origine "nouveau"). Generalise l actif propre a la societe : « part de marche de Chrome » -> « part de marche des navigateurs web », « villes desservies par Waymo » -> « villes couvertes par un service de robotaxi », « chiffre d affaires iPhone » -> « chiffre d affaires smartphones ». Toute « part de marche de X » est un type. Les mesures financieres standard (chiffre d affaires, resultat net, BPA, marge, effectifs, capex, flux de tresorerie, dette) sont des types.
- KPI unique : la mesure n a de sens que pour cette societe et aucun concurrent, meme en theorie, ne publierait la meme chose (ex. nombre de systemes Android en circulation). N abuse pas de « unique » : en cas de doute, generalise.

Referentiel officiel de l industrie (fr | en) :
{referentiel}

KPI a classer (identifiant -> nom, unite, description) :
{lot}

Reponds UNIQUEMENT par un objet JSON {{"<identifiant>": {{"fr": "...", "en": "...", "origine": "referentiel"|"nouveau"}} ou null}} avec exactement les identifiants fournis. Francais avec accents, sans tiret long."""

VERIF = """Tu verifies un classement de KPI en types comparables. Pour chaque ligne (nom du KPI, unite, type propose), reponds "ok" si le type est bien une generalisation correcte de la mesure (meme mesure, perimetre generique qu un concurrent pourrait publier) ou si "unique" est justifie, sinon "ko". Reponds UNIQUEMENT par un JSON {{"<identifiant>": "ok"|"ko"}}.

{lot}"""


def log(m):
    l = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), m)
    print(l, flush=True)
    open(LOG, "a", encoding="utf-8").write(l + "\n")


def lire(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None


def appelle(modele, prompt):
    r = subprocess.run(["claude", "-p", "--model", modele, "--output-format", "text"], input=prompt,
                       capture_output=True, text=True, timeout=900, env=dict(os.environ, USER="yann"))
    out = r.stdout or ""
    if r.returncode != 0 or ("limit" in out[:200].lower() and "{" not in out):
        raise RuntimeError("moteur indisponible : " + (out[:150] or r.stderr[:150]))
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        raise RuntimeError("pas de JSON : " + out[:150])
    return json.loads(m.group(0))


def propre(s):
    return re.sub(r"\s+", " ", str(s or "")).replace("—", ",").replace("–", ",").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="")
    ap.add_argument("--exclure", default="")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    ref = lire(REF)
    par_ind = {i["code"]: i for i in ref["liste"]}
    gics = lire(GICS); gics = gics.get("societes", gics)
    etat = lire(ETAT) or {"faites": []}
    u = lire(UNIVERS)["tickers"]
    exclues = {t.strip().upper() for t in a.exclure.split(",") if t.strip()}
    cible = [t.strip().upper() for t in a.tickers.split(",") if t.strip()] if a.tickers else [t for t in u if t not in etat["faites"] and t not in exclues]
    log("types de KPI : %d societes" % len(cible))
    for n, t in enumerate(cible, 1):
        ph = os.path.join(HAUT, "%s.json" % t); pv = os.path.join(V2, "%s.json" % t.lower())
        haut = lire(ph); base = lire(pv)
        if not base:
            continue
        code = str(gics.get(t) or "")[:6]
        ind = par_ind.get(code, {})
        refs = "\n".join("- %s | %s" % (k["fr"], k["en"]) for k in ind.get("kpis", [])) or "- (aucun referentiel pour cette industrie)"
        # KPI IC : kpis-haut d abord, puis ceux de la base qui ne sont pas remplaces
        items = []
        shorts_haut = set()
        for i, k in enumerate((haut or {}).get("kpis") or []):
            shorts_haut.add(k.get("short")); items.append(("haut", i, k))
        for i, k in enumerate(base.get("kpis") or []):
            if k.get("short") not in shorts_haut:
                items.append(("base", i, k))
        todo = [(c, i, k) for c, i, k in items if "type_comparable" not in k]
        if not todo:
            etat["faites"].append(t); json.dump(etat, open(ETAT, "w")); continue
        result = {}
        try:
            for d in range(0, len(todo), LOT):
                lot = todo[d:d + LOT]
                payload = {str(j): {"nom": k.get("name_fr") or k.get("short"), "en": k.get("name_en") or "", "unite": k.get("unit") or "",
                                    "description": propre(k.get("description_fr") or k.get("explanation") or k.get("signal") or "")[:220]}
                           for j, (c, i, k) in enumerate(lot)}
                rep = appelle("opus", CONSIGNE.format(nom=base.get("name") or t, ticker=t, industrie=ind.get("industrie") or code or "inconnue",
                                                      referentiel=refs, lot=json.dumps(payload, ensure_ascii=False, indent=0)))
                # verification Sonnet : 1 sur 10 + tous les types nouveaux
                verif = {}
                for j, (c, i, k) in enumerate(lot):
                    v = rep.get(str(j), "absent")
                    if v == "absent":
                        continue
                    if v is None or (isinstance(v, dict) and v.get("origine") == "nouveau") or random.random() < 0.1:
                        verif[str(j)] = {"nom": payload[str(j)]["nom"], "unite": payload[str(j)]["unite"], "type": (v.get("fr") if isinstance(v, dict) else "unique")}
                refus = set()
                if verif:
                    try:
                        rv = appelle("sonnet", VERIF.format(lot=json.dumps(verif, ensure_ascii=False, indent=0)))
                        refus = {j for j, s in rv.items() if not str(s).lower().startswith("ok")}
                    except Exception as e:  # noqa
                        log("%s : verification impossible (%s)" % (t, e))
                for j, (c, i, k) in enumerate(lot):
                    v = rep.get(str(j), "absent")
                    if v == "absent" or str(j) in refus:
                        continue
                    if v is None:
                        result[(c, i)] = None
                    elif isinstance(v, dict) and v.get("fr") and v.get("en"):
                        result[(c, i)] = {"fr": propre(v["fr"]), "en": propre(v["en"]), "origine": "referentiel" if v.get("origine") == "referentiel" else "nouveau"}
        except Exception as e:
            log("%s : ARRET (%s)" % (t, e)); break
        if not a.dry_run and result:
            for chemin, couche in ((ph, "haut"), (pv, "base")):
                sel = {i: v for (c, i), v in result.items() if c == couche}
                if not sel:
                    continue
                frais = lire(chemin)
                if not frais:
                    continue
                for i, v in sel.items():
                    if i < len(frais.get("kpis") or []):
                        frais["kpis"][i]["type_comparable"] = v
                        frais["kpis"][i]["_type_pose_le"] = "2026-09-14"
                json.dump(frais, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        nb_types = sum(1 for v in result.values() if v); nb_uniques = sum(1 for v in result.values() if v is None)
        log("%d/%d %s : %d types, %d uniques, %d non classes" % (n, len(cible), t, nb_types, nb_uniques, len(todo) - len(result)))
        if not a.dry_run and not a.tickers:
            etat["faites"].append(t); json.dump(etat, open(ETAT, "w"))
        if a.dry_run:
            for (c, i), v in list(result.items())[:12]:
                k = dict(items)[(c, i)] if False else None
            for (c, i), v in list(result.items())[:12]:
                kk = (haut if c == "haut" else base)["kpis"][i]
                log("  %s -> %s" % (kk.get("name_fr") or kk.get("short"), v["fr"] if v else "UNIQUE"))


if __name__ == "__main__":
    main()
