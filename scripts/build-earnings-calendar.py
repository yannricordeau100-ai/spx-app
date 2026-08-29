#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construit le calendrier des publications de resultats de l univers Mettrik.

Pourquoi ce script : la veille documentaire sait reconnaitre un document qui
arrive, mais elle est incapable de voir qu une publication ATTENDUE n est PAS
arrivee. Il faut donc une reference externe des dates attendues. C est ce
fichier, consomme ensuite par scripts/verifie-publications.py.

Source unique : Financial Modeling Prep, endpoint "stable".
  - /stable/earnings-calendar?from=&to=  -> calendrier global du marche US
  - /stable/earnings?symbol=X            -> historique + dates futures d une ste
Les deux ne repondent que pour les symboles US. Pour les societes europeennes,
FMP refuse le parametre symbol suffixe ("Premium Query Parameter") sur toutes
les cles du projet. On ne devine JAMAIS la date en retirant le suffixe : le
symbole nu appartient presque toujours a une autre societe (ACA.PA = Credit
Agricole, mais ACA = Arcosa Inc). Le rapprochement n est accepte que si les
deux profils portent le meme nom de societe (cas des ADR, ex. SAP.DE / SAP).

Rejouable a volonte. N ecrit que src/data/earnings-calendar.json.
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import ssl
from datetime import date, timedelta

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(RACINE, "src", "data", "v1-9-5-clean-all-tickers.json")
SORTIE = os.path.join(RACINE, "src", "data", "earnings-calendar.json")
BASE = "https://financialmodelingprep.com/stable"

# Le Python systeme de ce Mac n a pas de magasin de certificats utilisable :
# sans ce contexte explicite, tous les appels tombent en CERTIFICATE_VERIFY_FAILED.
try:
    import certifi
    CONTEXTE_SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CONTEXTE_SSL = ssl.create_default_context()
JOURS = 120           # profondeur demandee du calendrier
RECUL = 15            # on remonte aussi un peu en arriere : sans la derniere
                      # date DEJA passee, le controle des publications manquees
                      # n aurait jamais rien a examiner (le script est rejoue
                      # chaque nuit et ecraserait la date du jour meme).
PAS_JOURS = 30        # le calendrier global est interroge par tranches
PAUSE = 0.12          # petite pause entre appels, on ne bouscule pas l API


def cle_api():
    """Lit la cle FMP dans .env.local. On privilegie la cle payante."""
    chemin = os.path.join(RACINE, ".env.local")
    cles = {}
    with open(chemin, encoding="utf-8") as f:
        for ligne in f:
            ligne = ligne.strip()
            if ligne.startswith("FMP") and "=" in ligne:
                nom, valeur = ligne.split("=", 1)
                cles[nom.strip()] = valeur.strip().strip('"').strip("'")
    for nom in ("FMP_PAID_API_KEY", "FMP_API_KEY", "FMP2_API_KEY"):
        if cles.get(nom):
            return cles[nom]
    raise SystemExit("Aucune cle FMP utilisable dans .env.local")


def appel(chemin, params, cle):
    """Appel GET JSON. Retourne None si la reponse n est pas exploitable."""
    params = dict(params)
    params["apikey"] = cle
    url = "%s/%s?%s" % (BASE, chemin, urllib.parse.urlencode(params))
    try:
        with urllib.request.urlopen(url, timeout=60, context=CONTEXTE_SSL) as rep:
            donnees = json.loads(rep.read().decode("utf-8"))
    except Exception as err:
        print("  ! echec %s %s : %s" % (chemin, params.get("symbol", ""), err))
        return None
    # FMP renvoie un dict d erreur (403 deguise) au lieu d une liste
    if isinstance(donnees, dict):
        return None
    time.sleep(PAUSE)
    return donnees


# Formes juridiques seulement. On n enleve surtout pas "co", "group" ni
# "holding" : sans cette prudence "Merck KGaA" et "Merck & Co., Inc." se
# reduisent tous les deux a "merck" et le rapprochement colle deux societes
# differentes.
SUFFIXES = {
    "se", "sa", "ag", "nv", "plc", "inc", "corp", "corporation", "kgaa",
    "ltd", "ab", "asa", "oyj", "spa", "aktiengesellschaft", "publ", "sca",
}


def normalise(nom):
    """Reduit un nom de societe a un noyau comparable (accents, forme juridique)."""
    if not nom:
        return ""
    nom = unicodedata.normalize("NFKD", nom)
    nom = "".join(c for c in nom if not unicodedata.combining(c)).lower()
    mots = re.split(r"[^a-z0-9]+", nom)
    return " ".join(m for m in mots if m and m not in SUFFIXES)


def nom_societe(ticker, cle):
    """Nom de societe vu par FMP pour ce symbole exact, ou None."""
    donnees = appel("profile", {"symbol": ticker}, cle)
    if not donnees:
        return None
    return donnees[0].get("companyName")


def calendrier_global(debut, fin, cle):
    """Dates du calendrier global, tranche par tranche. {symbole: [(date, eps_publie)]}"""
    par_symbole = {}
    curseur = debut
    while curseur <= fin:
        borne = min(curseur + timedelta(days=PAS_JOURS - 1), fin)
        print("  calendrier %s -> %s" % (curseur, borne))
        lignes = appel(
            "earnings-calendar",
            {"from": curseur.isoformat(), "to": borne.isoformat()},
            cle,
        )
        for ligne in lignes or []:
            sym = ligne.get("symbol")
            jour = ligne.get("date")
            if not sym or not jour:
                continue
            publie = ligne.get("epsActual") is not None or ligne.get("revenueActual") is not None
            par_symbole.setdefault(sym, []).append((jour, publie))
        curseur = borne + timedelta(days=1)
    return par_symbole


def prochaine_date(entrees, aujourdhui):
    """Premiere date a venir (aujourd hui inclus) d une liste (date, publie)."""
    futures = sorted(d for d, _ in entrees if d >= aujourdhui)
    return futures[0] if futures else None


def date_precedente(entrees, aujourdhui):
    """Derniere date deja passee. C est elle que surveille l alerte."""
    passees = sorted(d for d, _ in entrees if d < aujourdhui)
    return passees[-1] if passees else None


def main():
    cle = cle_api()
    aujourdhui = date.today()
    debut = aujourdhui - timedelta(days=RECUL)
    fin = aujourdhui + timedelta(days=JOURS)
    univers = json.load(open(UNIVERS, encoding="utf-8"))["tickers"]

    print("Univers : %d societes, fenetre %s -> %s" % (len(univers), debut, fin))
    global_par_symbole = calendrier_global(debut, fin, cle)
    print("  %d symboles dans le calendrier global" % len(global_par_symbole))

    par_ticker = {}
    introuvables = {}

    # 1) societes cotees aux Etats-Unis : symbole identique cote FMP
    us = [t for t in univers if "." not in t]
    for ticker in us:
        entrees = global_par_symbole.get(ticker, [])
        jour = prochaine_date(entrees, aujourdhui.isoformat())
        if jour:
            par_ticker[ticker] = {
                "prochaine": jour,
                "precedente": date_precedente(entrees, aujourdhui.isoformat()),
                "estimee": True,
                "source": "calendrier",
            }

    # Les societes absentes de la fenetre publient plus tard : on interroge
    # leur fiche individuelle, qui porte aussi les dates au dela de 120 jours.
    restants = [t for t in us if t not in par_ticker]
    print("  %d societes US sans date dans la fenetre, appel individuel" % len(restants))
    for i, ticker in enumerate(restants, 1):
        if i % 50 == 0:
            print("    %d/%d" % (i, len(restants)))
        lignes = appel("earnings", {"symbol": ticker}, cle)
        if not lignes:
            introuvables[ticker] = "aucune fiche earnings FMP"
            continue
        entrees = [
            (l.get("date"), l.get("epsActual") is not None)
            for l in lignes
            if l.get("date")
        ]
        jour = prochaine_date(entrees, aujourdhui.isoformat())
        if jour:
            par_ticker[ticker] = {
                "prochaine": jour,
                "precedente": date_precedente(entrees, aujourdhui.isoformat()),
                "estimee": True,
                "source": "fiche",
            }
        else:
            introuvables[ticker] = "aucune date future publiee par FMP"

    # 2) societes hors Etats-Unis : le parametre symbol suffixe est refuse.
    # Seul rattrapage honnete : un symbole nu qui designe la MEME societe.
    hors_us = [t for t in univers if "." in t]
    print("  %d societes hors US, tentative de rapprochement par nom" % len(hors_us))
    for i, ticker in enumerate(hors_us, 1):
        if i % 25 == 0:
            print("    %d/%d" % (i, len(hors_us)))
        base = ticker.split(".")[0]
        entrees = global_par_symbole.get(base)
        lignes = None
        if not entrees:
            lignes = appel("earnings", {"symbol": base}, cle)
            if lignes:
                entrees = [
                    (l.get("date"), l.get("epsActual") is not None)
                    for l in lignes
                    if l.get("date")
                ]
        if not entrees:
            introuvables[ticker] = "place non couverte par le plan FMP"
            continue
        nom_local = normalise(nom_societe(ticker, cle))
        nom_nu = normalise(nom_societe(base, cle))
        if not nom_local or not nom_nu or nom_local != nom_nu:
            introuvables[ticker] = (
                "symbole nu %s = autre societe (%s vs %s)" % (base, nom_nu or "?", nom_local or "?")
            )
            continue
        jour = prochaine_date(entrees, aujourdhui.isoformat())
        if jour:
            par_ticker[ticker] = {
                "prochaine": jour,
                "precedente": date_precedente(entrees, aujourdhui.isoformat()),
                "estimee": True,
                "source": "ligne americaine %s" % base,
            }
        else:
            introuvables[ticker] = "aucune date future pour la ligne americaine %s" % base

    sortie = {
        "MAJ": aujourdhui.isoformat(),
        "fenetre_jours": JOURS,
        "source": "financialmodelingprep /stable",
        "couverts": len(par_ticker),
        "par_ticker": dict(sorted(par_ticker.items())),
        "introuvables": dict(sorted(introuvables.items())),
    }
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("Ecrit %s : %d dates, %d introuvables" % (SORTIE, len(par_ticker), len(introuvables)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
