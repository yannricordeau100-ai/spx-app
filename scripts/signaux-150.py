#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reecriture des textes des KPI (champ `signal`, affiche sous chaque graphique)
selon la regle du proprietaire (14 sept 2026) :
  - 150 caracteres au maximum ;
  - une EXPLICATION (pourquoi le chiffre bouge, ce qu il revele, ce qu il
    change pour l investisseur) plutot qu une description du chiffre deja
    visible sur le graphique ;
  - aucun fait nouveau : le texte d origine et la description du KPI sont la
    seule source ; francais accentue, sans tiret long, sans adresse web.

Couches traitees (celles que lit la fiche) :
  .batches-drafts-safe/kpis-haut/<T>.json   (prioritaire)
  src/data/v2-pipeline/<t>.json             (kpis + stories_kpis hors kpis-haut)

Moteur : session Claude Code locale (claude -p), aucune cle API.
Sauvegarde de chaque texte remplace : .conv-state/signaux-150-sauvegarde.jsonl
Reprise : .conv-state/signaux-150-etat.json (societes deja traitees).

Usage :
  python3 scripts/signaux-150.py --tickers BE --dry-run
  python3 scripts/signaux-150.py --tickers BE,RDDT
  python3 scripts/signaux-150.py --all            (toutes les societes)
  python3 scripts/signaux-150.py --all --tous     (aussi les textes <= 150)
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")
HAUT = os.path.join(ROOT, ".batches-drafts-safe", "kpis-haut")
V2 = os.path.join(ROOT, "src", "data", "v2-pipeline")
ETAT = os.path.join(ROOT, ".conv-state", "signaux-150-etat.json")
SAUVEGARDE = os.path.join(ROOT, ".conv-state", "signaux-150-sauvegarde.jsonl")
LOG = os.path.join(ROOT, ".conv-state", "signaux-150.log")
MAX = 150
LOT = 20

CONSIGNE = """Tu reecris les textes courts affiches sous les graphiques de KPI d une application pour investisseurs francophones (societe : {nom}, {ticker}).

REGLE ABSOLUE pour chaque texte :
- 150 caracteres MAXIMUM, espaces compris (vise 110 a 145).
- Une EXPLICATION, pas une description : le lecteur voit deja le chiffre et sa courbe sur le graphique. Ne repete pas la valeur ni la tendance. Dis plutot ce qui fait bouger l indicateur, ce qu il revele de la societe, ou pourquoi il compte pour la valeur de l action.
- Un seul chiffre au plus, et seulement s il n est pas sur le graphique (part du chiffre d affaires, objectif publie, comparaison).
- AUCUN fait nouveau : n utilise que les informations presentes dans le texte actuel et la description fournis. Si l explication n y est pas, reformule prudemment ce qui y est, sans rien inventer.
- Francais soigne AVEC accents, vocabulaire simple, aucun tiret long, aucune adresse web, pas de guillemets.

KPI a reecrire (JSON) :
{lot}

Reponds UNIQUEMENT par un objet JSON {{"<id>": "<nouveau texte>", ...}} avec exactement les memes identifiants."""


def log(m):
    ligne = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), m)
    print(ligne, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(ligne + "\n")


def lire(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None


def appelle(prompt):
    env = dict(os.environ)
    env.setdefault("USER", "yann")
    r = subprocess.run(["claude", "-p", "--model", "sonnet", "--output-format", "text"],
                       input=prompt, capture_output=True, text=True, timeout=600, env=env)
    sortie = r.stdout or ""
    if r.returncode != 0 or "limit" in sortie[:200].lower() and "{" not in sortie:
        raise RuntimeError("moteur indisponible : %s" % (sortie[:160] or r.stderr[:160]))
    m = re.search(r"\{.*\}", sortie, re.S)
    if not m:
        raise RuntimeError("reponse sans JSON : %s" % sortie[:160])
    return json.loads(m.group(0))


def valide(txt):
    if not isinstance(txt, str):
        return None
    t = re.sub(r"\s+", " ", txt).strip().strip('"').strip()
    t = t.replace("—", ",").replace("–", ",")
    if not t or len(t) > MAX or "http" in t or "www." in t:
        return None
    return t


def derniers_points(k):
    h = k.get("history") or []
    vals = [(p.get("q"), p.get("v")) if isinstance(p, dict) else (None, p) for p in h]
    return vals[-3:]


def candidats(ticker, tous):
    """Retourne une liste de (couche, chemin, index_liste, cle_liste, kpi)."""
    sortie = []
    ph = os.path.join(HAUT, "%s.json" % ticker)
    haut = lire(ph) or {}
    shorts_haut = set()
    for i, k in enumerate(haut.get("kpis") or []):
        shorts_haut.add(k.get("short"))
        s = (k.get("signal") or "").strip()
        if s and (tous or len(s) > MAX):
            sortie.append(("haut", ph, i, "kpis", k))
    pv = os.path.join(V2, "%s.json" % ticker.lower())
    base = lire(pv) or {}
    for cle in ("kpis", "stories_kpis"):
        for i, k in enumerate(base.get(cle) or []):
            if k.get("short") in shorts_haut:
                continue
            s = (k.get("signal") or "").strip()
            if s and (tous or len(s) > MAX):
                sortie.append(("base", pv, i, cle, k))
    return sortie, (base.get("name") or ticker)


def traite(ticker, tous, dry):
    cands, nom = candidats(ticker, tous)
    if not cands:
        return 0, 0
    faits = echecs = 0
    fichiers = {}
    for debut in range(0, len(cands), LOT):
        lot = cands[debut:debut + LOT]
        payload = {}
        for j, (couche, p, i, cle, k) in enumerate(lot):
            payload[str(j)] = {
                "nom": k.get("name_fr") or k.get("short"),
                "unite": k.get("unit"),
                "derniers_points": derniers_points(k),
                "texte_actuel": k.get("signal"),
                "description": (k.get("description_fr") or k.get("description") or k.get("explanation") or "")[:600],
            }
        try:
            rep = appelle(CONSIGNE.format(nom=nom, ticker=ticker, lot=json.dumps(payload, ensure_ascii=False, indent=1)))
        except Exception as e:  # noqa
            log("%s : ECHEC lot %d (%s)" % (ticker, debut // LOT, e))
            raise
        for j, (couche, p, i, cle, k) in enumerate(lot):
            nouveau = valide(rep.get(str(j)))
            if not nouveau:
                echecs += 1
                continue
            doc = fichiers.setdefault(p, lire(p))
            cible = doc[cle][i]
            if not dry:
                with open(SAUVEGARDE, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"ticker": ticker, "couche": couche, "short": cible.get("short"),
                                        "avant": cible.get("signal"), "apres": nouveau,
                                        "le": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False) + "\n")
                cible["signal"] = nouveau
                cible["_signal_regle_150"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            else:
                log("  %s | %s -> %s" % (cible.get("short"), (cible.get("signal") or "")[:80], nouveau))
            faits += 1
    if not dry:
        for p, doc in fichiers.items():
            with open(p, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=1)
    return faits, echecs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--tous", action="store_true", help="aussi les textes deja <= 150 caracteres")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    os.makedirs(os.path.dirname(ETAT), exist_ok=True)
    etat = lire(ETAT) or {"faites": []}
    if a.tickers:
        cible = [t.strip().upper() for t in a.tickers.split(",") if t.strip()]
    else:
        u = lire(UNIVERS) or {}
        cible = [t for t in (u.get("tickers") or []) if t not in etat["faites"]]
    log("signaux 150 : %d societes%s" % (len(cible), " (essai)" if a.dry_run else ""))
    total_f = total_e = 0
    for n, t in enumerate(cible, 1):
        try:
            f, e = traite(t, a.tous, a.dry_run)
        except Exception:
            log("arret : moteur indisponible, reprise possible (etat conserve)")
            break
        total_f += f
        total_e += e
        if not a.dry_run and not a.tickers:
            etat["faites"].append(t)
            json.dump(etat, open(ETAT, "w"), ensure_ascii=False)
        log("%d/%d %s : %d reecrits, %d refuses" % (n, len(cible), t, f, e))
    log("bilan : %d reecrits, %d refuses par le controle" % (total_f, total_e))


if __name__ == "__main__":
    main()
