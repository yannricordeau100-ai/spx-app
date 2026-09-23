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

Moteur : moteurs GRATUITS (Cerebras, puis Groq, puis Gemini) via
         scripts/moteur_gratuit.py. Jamais Claude : une tache automatique
         serait facturee au compte connecte au hasard du moment (23 sept 2026).
         Si aucun moteur ne repond, un brouillon part dans .conv-state et
         RIEN n est ecrit dans les fiches.
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
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur_gratuit import (  # noqa: E402
    MoteurIndisponible, appelle as appelle_moteur, charge_env, ecris_brouillon,
)

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
- 150 caracteres MAXIMUM, espaces compris (vise 100 a 130 : compte les caracteres avant de repondre).
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
    """Moteurs gratuits uniquement. MoteurIndisponible remonte a l appelant,
    qui depose un brouillon et n ecrit rien."""
    rep, moteur = appelle_moteur(prompt, json_attendu=True, temperature=0.0)
    if not isinstance(rep, dict):
        raise RuntimeError("reponse hors format (%s)" % moteur)
    return rep, moteur


def _chiffres(texte):
    """Suites de chiffres d un texte, separateurs de decimale et de milliers
    retires, pour comparer une ecriture francaise et une ecriture anglaise."""
    plat = re.sub("(?<=\\d)[ ,.\u00a0\u202f](?=\\d)", "", str(texte or ""))
    return re.findall(r"\d+", plat)


def valide(txt, source=""):
    """Controle renforce le 23 sept 2026 : un moteur gratuit invente plus
    volontiers qu un grand modele, on refuse au moindre doute.

    Le controle decisif porte sur les chiffres : tout nombre du nouveau texte
    doit deja figurer dans le texte d origine, dans la description ou dans les
    derniers points. Un chiffre venu de nulle part est un fait invente.
    """
    if not isinstance(txt, str):
        return None
    t = re.sub(r"\s+", " ", txt).strip().strip('"').strip()
    t = t.replace("\u2014", ",").replace("\u2013", ",")
    if not t or len(t) > MAX or "http" in t or "www." in t:
        return None
    if len(t) < 40:
        return None  # une explication de moins de 40 signes n explique rien
    if '"' in t or "{" in t or "}" in t:
        return None  # reste de JSON dans la reponse
    # 23 sept 2026 : un moteur gratuit rend souvent un francais sans accents
    # ("amelioration", "benefice"). Le texte part sur une fiche client : on
    # refuse plutot que de publier une faute. Liste volontairement courte et
    # sans ambiguite (aucun de ces mots n existe sans accent en francais).
    bas = t.lower()
    for mot in ("amelioration", "ameliore", "benefice", "activite", "strategie",
                "reflete", "operations", "operationnel", "immediate", "developpement",
                "resultat", "rentabilite", "generer", "elevee", "eleve", "qualite",
                "securite", "reduit", "cle ", "financiere", "reguliere", "marches"):
        if mot in bas:
            return None
    dispo = "".join(_chiffres(source))
    for n in _chiffres(t):
        if n not in dispo:
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
        prompt = CONSIGNE.format(nom=nom, ticker=ticker, lot=json.dumps(payload, ensure_ascii=False, indent=1))
        try:
            rep, moteur = appelle(prompt)
        except MoteurIndisponible as e:
            # Regle absolue : jamais d appel Claude en secours. On depose le
            # prompt en brouillon et on remonte l arret : rien n est ecrit.
            chemin = ecris_brouillon("signaux-a-traiter", "%s-lot%d.prompt.txt" % (ticker, debut // LOT), prompt)
            log("%s : BROUILLON A TRAITER %s (%s)" % (ticker, chemin, str(e)[:70]))
            raise
        except Exception as e:  # noqa
            log("%s : ECHEC lot %d (%s)" % (ticker, debut // LOT, e))
            continue  # reponse mal formee : on passe au lot suivant
        for j, (couche, p, i, cle, k) in enumerate(lot):
            # Source autorisee pour les chiffres : ce que le moteur a recu, et
            # rien d autre. Tout nombre absent d ici est un fait invente.
            source = json.dumps(payload[str(j)], ensure_ascii=False)
            nouveau = valide(rep.get(str(j)), source)
            if not nouveau:
                echecs += 1
                continue
            if nouveau == (k.get("signal") or "").strip():
                continue  # texte inchange : rien a ecrire
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
        # 14 sept 2026 : d autres passes (agents KPI par industrie) ecrivent les
        # memes fichiers en parallele. On relit le fichier juste avant d ecrire
        # et on ne remplace que les textes reecrits (par identifiant), pour ne
        # jamais ecraser un KPI ajoute entre-temps.
        for p, doc in fichiers.items():
            nouveaux = {}
            for cle in ("kpis", "stories_kpis"):
                for k in doc.get(cle) or []:
                    if k.get("_signal_regle_150"):
                        nouveaux[(cle, k.get("short"))] = (k.get("signal"), k.get("_signal_regle_150"))
            frais = lire(p) or doc
            for cle in ("kpis", "stories_kpis"):
                for k in frais.get(cle) or []:
                    v = nouveaux.get((cle, k.get("short")))
                    if v:
                        k["signal"], k["_signal_regle_150"] = v
            with open(p, "w", encoding="utf-8") as f:
                json.dump(frais, f, ensure_ascii=False, indent=1)
    return faits, echecs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--tous", action="store_true", help="aussi les textes deja <= 150 caracteres")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    charge_env(os.path.join(ROOT, ".env.local"))
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
        except MoteurIndisponible:
            log("arret : aucun moteur gratuit ne repond. Brouillons deposes dans "
                ".conv-state/signaux-a-traiter, rien ecrit dans les fiches. "
                "Reprise possible (etat conserve). Jamais d appel Claude ici.")
            break
        except Exception as e:  # noqa
            log("arret : %s (etat conserve)" % str(e)[:120])
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
