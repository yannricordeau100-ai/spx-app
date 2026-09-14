#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Catalogue canonique de comparabilite des libelles de KPI (chantier Comparer,
point 1, 14 sept 2026). Opus range chaque libelle distinct dans une cle
canonique (meme mesure, meme perimetre) ; Sonnet verifie les regroupements
(seuls les groupes ou plusieurs libelles fusionnent sont relus).

Entree  : toutes les fiches servies (kpis-haut + v2-pipeline, kpis et stories)
Sortie  : src/data/compare-catalogue.json  {libelle_normalise: cle_canonique}
          .conv-state/catalogue-etat.json (reprise), .conv-state/catalogue.log
Moteur  : claude -p (opus puis sonnet), aucune cle API.
Usage   : python3 scripts/catalogue-comparabilite.py [--limit N] [--sans-verif]
"""
import argparse, json, os, re, subprocess, collections
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")
SORTIE = os.path.join(ROOT, "src/data/compare-catalogue.json")
ETAT = os.path.join(ROOT, ".conv-state/catalogue-etat.json")
LOG = os.path.join(ROOT, ".conv-state/catalogue.log")
LOT = 120

SYN = [
    (r"^(total )?(net )?(revenues?|sales)$", "revenue"), (r"^total net sales$", "revenue"),
    (r"^(diluted eps|eps diluted|diluted earnings per share|earnings per share diluted|eps)$", "eps diluted"),
    (r"^(capital expenditures?|capex)$", "capex"), (r"^(free cash flow|fcf)$", "free cash flow"),
    (r"^(employees|headcount|(total )?number of employees|total employees|workforce)$", "employees"),
    (r"^(net income|net profit|net earnings)$", "net income"),
]


def log(m):
    l = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), m)
    print(l, flush=True)
    open(LOG, "a", encoding="utf-8").write(l + "\n")


def normalise(s):
    s = str(s or "").lower().replace("&", " and ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for re_, v in SYN:
        if re.match(re_, s):
            return v
    return s


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


CONSIGNE = """Tu construis un catalogue de comparabilite pour une application d analyse d actions.
Pour chaque libelle de KPI ci-dessous (anglais ou francais, avec un exemple d unite et un exemple de societe), donne une CLE CANONIQUE : un libelle anglais court, en minuscules, qui designe la MEME MESURE au MEME PERIMETRE. Deux libelles recoivent la meme cle seulement si un investisseur pourrait comparer leurs valeurs entre deux societes sans reserve (ex : "total revenues", "net sales", "chiffre d affaires" -> "revenue" ; "cloud revenue" et "aws revenue" -> "cloud revenue" ; "iphone revenue" reste "iphone revenue" car propre a une societe ; "same store sales growth" et "comparable sales growth" -> "comparable sales growth" ; un ratio et un montant ne fusionnent jamais). Ne generalise pas un perimetre different (segment, zone, marque) vers le total. Reponds UNIQUEMENT par un objet JSON {"<libelle>": "<cle>"} avec exactement les libelles fournis.

Libelles :
{lot}"""

VERIF = """Tu verifies un catalogue de comparabilite de KPI. Voici des groupes de libelles qu un premier modele a juges comparables (meme mesure, meme perimetre). Pour chaque groupe, reponds "ok" si TOUS les libelles designent bien la meme mesure au meme perimetre, sinon "ko". Reponds UNIQUEMENT par un JSON {"<cle>": "ok"|"ko"}.

{groupes}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sans-verif", action="store_true")
    a = ap.parse_args()
    u = json.load(open(UNIVERS))["tickers"]
    infos = {}
    for t in u:
        for p, cles in ((os.path.join(ROOT, ".batches-drafts-safe/kpis-haut/%s.json" % t), ["kpis"]),
                        (os.path.join(ROOT, "src/data/v2-pipeline/%s.json" % t.lower()), ["kpis", "stories_kpis"])):
            if not os.path.exists(p):
                continue
            try:
                d = json.load(open(p))
            except Exception:
                continue
            for c in cles:
                for k in d.get(c) or []:
                    lab = normalise(k.get("name_en") or k.get("name_fr") or k.get("short"))
                    if len(lab) < 3:
                        continue
                    e = infos.setdefault(lab, {"n": 0, "unite": k.get("unit") or "", "ex": t, "fr": k.get("name_fr") or ""})
                    e["n"] += 1
    etat = json.load(open(ETAT)) if os.path.exists(ETAT) else {"cat": {}, "verif": {}}
    cat = etat["cat"]
    restants = sorted(l for l in infos if l not in cat)
    if a.limit:
        restants = restants[:a.limit]
    log("libelles distincts %d, deja ranges %d, a ranger %d" % (len(infos), len(cat), len(restants)))
    for i in range(0, len(restants), LOT):
        lot = restants[i:i + LOT]
        payload = {l: {"unite": infos[l]["unite"], "societe": infos[l]["ex"], "fr": infos[l]["fr"][:60]} for l in lot}
        try:
            rep = appelle("opus", CONSIGNE.replace("{lot}", json.dumps(payload, ensure_ascii=False, indent=0)))
        except Exception as e:
            log("ARRET : %s" % e)
            break
        for l in lot:
            v = rep.get(l)
            cat[l] = normalise(v) if isinstance(v, str) and v.strip() else l
        json.dump(etat, open(ETAT, "w"), ensure_ascii=False)
        log("lot %d/%d range" % (i // LOT + 1, (len(restants) + LOT - 1) // LOT))
    # verification Sonnet des groupes fusionnes
    if not a.sans_verif:
        groupes = collections.defaultdict(list)
        for l, k in cat.items():
            groupes[k].append(l)
        fusion = {k: v for k, v in groupes.items() if len(v) > 1 and k not in etat["verif"]}
        cles = sorted(fusion)
        log("groupes fusionnes a verifier : %d" % len(cles))
        for i in range(0, len(cles), 60):
            sous = {k: fusion[k][:12] for k in cles[i:i + 60]}
            try:
                rep = appelle("sonnet", VERIF.replace("{groupes}", json.dumps(sous, ensure_ascii=False, indent=0)))
            except Exception as e:
                log("ARRET verif : %s" % e)
                break
            for k in sous:
                etat["verif"][k] = "ok" if str(rep.get(k, "")).lower().startswith("ok") else "ko"
            json.dump(etat, open(ETAT, "w"), ensure_ascii=False)
        # un groupe refuse est defait : chaque libelle garde sa propre cle
        defaits = 0
        for k, st in etat["verif"].items():
            if st == "ko":
                for l in groupes.get(k, []):
                    if cat.get(l) == k and l != k:
                        cat[l] = l
                        defaits += 1
        log("libelles remis a part apres verification : %d" % defaits)
    final = {l: k for l, k in cat.items() if k != l}
    json.dump({"maj": datetime.now().strftime("%Y-%m-%d"), "libelles": len(cat), "regroupes": len(final), "catalogue": final},
              open(SORTIE, "w"), ensure_ascii=False, indent=0)
    log("ecrit %s : %d libelles, %d regroupes" % (SORTIE, len(cat), len(final)))


if __name__ == "__main__":
    main()
