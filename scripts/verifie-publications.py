#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Detecte les publications ATTENDUES qui ne sont pas arrivees dans le data-lake.

Pourquoi : la veille documentaire ne sait signaler que ce qu elle voit passer.
Une societe qui publie ses resultats sans que le document soit capte reste
invisible : la fiche Mettrik vieillit en silence. Ce script compare les dates
attendues (src/data/earnings-calendar.json) a ce qui est reellement tombe dans
data-lake/<TICKER>/ et ecrit un bilan.

Regle de la fenetre : on ne regarde que les societes dont la date attendue est
passee de 1 a 5 jours. Moins d un jour, le document n a pas encore eu le temps
d arriver ; au dela de cinq, l alerte a deja ete levee au tour precedent et
resterait affichee indefiniment.

AUCUN appel LLM, aucun appel reseau. Pur mecanique de fichiers.
Ecrit uniquement .conv-state/publications-manquees.json.
"""

import json
import os
import re
import sys
from datetime import date, datetime, timedelta

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CALENDRIER = os.path.join(RACINE, "src", "data", "earnings-calendar.json")
DATA_LAKE = os.path.join(RACINE, "data-lake")
SORTIE = os.path.join(RACINE, ".conv-state", "publications-manquees.json")

JOURS_MIN = 1   # on laisse au moins un jour au document pour arriver
JOURS_MAX = 5   # au dela, l alerte a deja ete levee
MARGE_AVANT = 2  # un document date de la veille de la date attendue compte aussi

DATE_DANS_NOM = re.compile(r"(20\d{2})-(\d{2})-(\d{2})")


def documents_recents(dossier, debut, fin):
    """
    Fichiers du dossier d une societe rattachables a la fenetre [debut, fin].
    Deux indices, l un ou l autre suffit :
      - une date AAAA-MM-JJ dans le nom du fichier (convention du data-lake)
      - une date de modification dans la fenetre (documents sans date au nom)
    """
    trouves = []
    for racine, _, fichiers in os.walk(dossier):
        for nom in fichiers:
            if nom.startswith("."):
                continue
            chemin = os.path.join(racine, nom)
            correspondance = DATE_DANS_NOM.search(nom)
            if correspondance:
                try:
                    jour = date(*map(int, correspondance.groups()))
                except ValueError:
                    jour = None
                if jour and debut <= jour <= fin:
                    trouves.append(os.path.relpath(chemin, dossier))
                    continue
            try:
                mtime = date.fromtimestamp(os.path.getmtime(chemin))
            except OSError:
                continue
            if debut <= mtime <= fin:
                trouves.append(os.path.relpath(chemin, dossier))
    return sorted(set(trouves))


def main():
    aujourdhui = date.today()

    if not os.path.exists(CALENDRIER):
        bilan = {
            "MAJ": aujourdhui.isoformat(),
            "etat": "calendrier absent",
            "detail": "lancer scripts/build-earnings-calendar.py",
            "manquantes": [],
        }
        ecrire(bilan)
        print("publications : calendrier absent, rien a verifier")
        return 0

    calendrier = json.load(open(CALENDRIER, encoding="utf-8"))
    par_ticker = calendrier.get("par_ticker", {})

    manquantes = []
    recues = []
    sans_dossier = []

    for ticker, info in par_ticker.items():
        # On regarde la derniere date DEJA passee en priorite : c est elle qui
        # peut avoir ete manquee. "prochaine" ne sert que si le calendrier n a
        # pas ete rejoue depuis et que cette date est entre temps devenue
        # passee, cas frequent quand le Mac est reste eteint quelques jours.
        attendue = None
        attendue_txt = None
        for champ in ("precedente", "prochaine"):
            valeur = info.get(champ)
            if not valeur:
                continue
            try:
                jour = datetime.strptime(valeur, "%Y-%m-%d").date()
            except ValueError:
                continue
            if JOURS_MIN <= (aujourdhui - jour).days <= JOURS_MAX:
                attendue, attendue_txt = jour, valeur
                break
        if attendue is None:
            continue
        ecart = (aujourdhui - attendue).days

        dossier = os.path.join(DATA_LAKE, ticker)
        if not os.path.isdir(dossier):
            sans_dossier.append(ticker)
            manquantes.append(
                {
                    "ticker": ticker,
                    "attendue": attendue_txt,
                    "jours_ecoules": ecart,
                    "raison": "aucun dossier data-lake",
                }
            )
            continue

        debut = attendue - timedelta(days=MARGE_AVANT)
        docs = documents_recents(dossier, debut, aujourdhui)
        if docs:
            recues.append({"ticker": ticker, "attendue": attendue_txt, "documents": docs[:5]})
        else:
            manquantes.append(
                {
                    "ticker": ticker,
                    "attendue": attendue_txt,
                    "jours_ecoules": ecart,
                    "raison": "aucun document dans la fenetre",
                }
            )

    bilan = {
        "MAJ": aujourdhui.isoformat(),
        "calendrier_du": calendrier.get("MAJ"),
        "fenetre_jours": [JOURS_MIN, JOURS_MAX],
        "examinees": len(manquantes) + len(recues),
        "recues": recues,
        "manquantes": sorted(manquantes, key=lambda x: (-x["jours_ecoules"], x["ticker"])),
    }
    ecrire(bilan)

    # Affichage destine au log du cron : court et lisible d un coup d oeil.
    print(
        "publications attendues J-%d a J-%d : %d examinees, %d recues, %d manquantes"
        % (JOURS_MAX, JOURS_MIN, bilan["examinees"], len(recues), len(manquantes))
    )
    for item in bilan["manquantes"]:
        print(
            "  MANQUE %-12s attendue %s (J+%d) : %s"
            % (item["ticker"], item["attendue"], item["jours_ecoules"], item["raison"])
        )
    return 0


def ecrire(bilan):
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(bilan, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    sys.exit(main())
