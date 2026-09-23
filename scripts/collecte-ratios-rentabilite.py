#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Collecte des quatre ratios de rentabilite (ROIC, ROE, ROA, ROCE) sur stockanalysis.com
pour l univers Mettrik (src/data/v1-9-5-clean-all-tickers.json).

Sortie : src/data/ratios-rentabilite-stockanalysis.json
Reprise : .cache/ratios-rentabilite-progress.jsonl (une ligne JSON par societe traitee)

Usage :
  python3 scripts/collecte-ratios-rentabilite.py            # reprend puis complete
  python3 scripts/collecte-ratios-rentabilite.py --rejouer  # repart de zero
  python3 scripts/collecte-ratios-rentabilite.py --seulement-echecs
  python3 scripts/collecte-ratios-rentabilite.py --controle   # compare au ROIC deja calcule
"""

import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
import ssl
import gzip
import io
from datetime import datetime, timezone

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(RACINE, "src", "data", "v1-9-5-clean-all-tickers.json")
SORTIE = os.path.join(RACINE, "src", "data", "ratios-rentabilite-stockanalysis.json")
CACHE = os.path.join(RACINE, ".cache")
PROGRES = os.path.join(CACHE, "ratios-rentabilite-progress.jsonl")

PAUSE_MIN = 1.2          # secondes entre deux requetes (consigne : au moins 0,4 s)
PAUSE_ALEA = 0.5
TENTATIVES = 5
RATIOS = ("roic", "roe", "roa", "roce")

# Codes de place stockanalysis.com par suffixe de ticker.
# Confirmes par test le 23 septembre 2026 : epa, etr, swx, ams.
PLACES = {
    "PA": ["epa"],            # Paris
    "DE": ["etr"],            # Francfort (Xetra)
    "SW": ["swx"],            # Suisse
    "AS": ["ams"],            # Amsterdam
    # Places non presentes dans l univers actuel, gardees pour extension :
    "MI": ["bit"],            # Milan
    "MC": ["bme"],            # Madrid
    "BR": ["ebr"],            # Bruxelles
    "LS": ["eli"],            # Lisbonne
    "L": ["lon"],             # Londres
    "ST": ["sto"],            # Stockholm
    "CO": ["cph"],            # Copenhague
    "HE": ["hel"],            # Helsinki
    "OL": ["osl"],            # Oslo
}

# Tickers a point qui restent des valeurs americaines (classe d action, pas un suffixe de place).
US_AVEC_POINT = {"BF.B"}


# Societes dont le symbole de l univers Mettrik n a pas de page de ratios sur stockanalysis.com.
# On vise alors la cotation principale de la meme societe (verifie un par un le 23 septembre 2026).
# Les ratios sont sans unite : un changement de place de cotation ne change pas la valeur.
ALIAS = {
    "AIR.DE": "quote/epa/AIR",      # Airbus SE, cotation principale a Paris
    "VOW.DE": "quote/etr/VOW3",     # Volkswagen, seule la preferentielle a une page de ratios
    "HEN.DE": "quote/etr/HEN3",     # Henkel, idem
    "DPW.DE": "quote/etr/DHL",      # Deutsche Post devenu DHL Group
    "QIA.DE": "stocks/QGEN",        # Qiagen, cotation principale au Nasdaq
    "MT.PA": "quote/ams/MT",        # ArcelorMittal, cotation principale a Amsterdam
    "REN.AS": "quote/lon/REL",      # RELX, cotation principale a Londres
    "SHELL.AS": "quote/lon/SHEL",   # Shell plc, cotation principale a Londres
    "UNA.AS": "quote/lon/ULVR",     # Unilever plc, cotation principale a Londres
    "STLAP.PA": "stocks/STLA",      # Stellantis, cotation principale a New York
}


ENTETES = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
}


# ---------------------------------------------------------------- adresses

def adresses_possibles(ticker):
    """Renvoie la liste ordonnee des adresses a essayer pour un ticker."""
    if ticker in ALIAS:
        return ["https://stockanalysis.com/%s/financials/ratios/" % ALIAS[ticker]]
    if "." in ticker and ticker not in US_AVEC_POINT:
        base, suffixe = ticker.rsplit(".", 1)
        codes = PLACES.get(suffixe.upper())
        if not codes:
            return []
        return ["https://stockanalysis.com/quote/%s/%s/financials/ratios/" % (c, base)
                for c in codes]
    symbole = ticker.replace("-", ".")   # BRK-B -> BRK.B
    urls = ["https://stockanalysis.com/stocks/%s/financials/ratios/" % symbole]
    if symbole != ticker:
        urls.append("https://stockanalysis.com/stocks/%s/financials/ratios/" % ticker)
    return urls


# ---------------------------------------------------------------- reseau

def _contexte_ssl():
    """Certificats systeme absents de Python sur ce poste : on passe par certifi."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


CONTEXTE = _contexte_ssl()


def telecharger(url):
    """Renvoie (code, texte). Suit les redirections (urllib le fait par defaut)."""
    requete = urllib.request.Request(url, headers=ENTETES)
    try:
        with urllib.request.urlopen(requete, timeout=45, context=CONTEXTE) as reponse:
            brut = reponse.read()
            if reponse.headers.get("Content-Encoding") == "gzip":
                brut = gzip.GzipFile(fileobj=io.BytesIO(brut)).read()
            return reponse.getcode(), brut.decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        try:
            brut = err.read()
        except Exception:
            brut = b""
        return err.code, brut.decode("utf-8", "replace")
    except Exception as err:                      # reseau, DNS, delai depasse
        return 0, "ERREUR_RESEAU: %s" % err


def telecharger_avec_reprise(url):
    """Retente sur 403 (limitation de debit) et sur coupure reseau."""
    attente = 5.0
    for tentative in range(1, TENTATIVES + 1):
        code, texte = telecharger(url)
        if code == 200:
            return code, texte
        if code == 404:
            return code, texte                    # page introuvable : inutile d insister
        if tentative < TENTATIVES:
            time.sleep(attente)
            attente = min(attente * 2, 60)
    return code, texte


# ---------------------------------------------------------------- analyse

def extraire_bloc(html, cle="financialData:{"):
    """Extrait le bloc JS delimite par accolades qui suit la cle."""
    depart = html.find(cle)
    if depart < 0:
        return None
    i = depart + len(cle) - 1                     # sur l accolade ouvrante
    profondeur = 0
    guillemet = None
    j = i
    while j < len(html):
        c = html[j]
        if guillemet:
            if c == "\\":
                j += 2
                continue
            if c == guillemet:
                guillemet = None
        elif c in "\"'`":
            guillemet = c
        elif c == "{":
            profondeur += 1
        elif c == "}":
            profondeur -= 1
            if profondeur == 0:
                return html[i:j + 1]
        j += 1
    return None


def tableau(bloc, nom):
    """Renvoie la liste brute du tableau nom:[...] dans le bloc, ou None."""
    motif = re.compile(r"[{,]" + re.escape(nom) + r":\[([^\]]*)\]")
    trouve = motif.search(bloc)
    if not trouve:
        return None
    contenu = trouve.group(1).strip()
    if contenu == "":
        return []
    elements = []
    courant = ""
    guillemet = None
    for c in contenu:
        if guillemet:
            courant += c
            if c == guillemet:
                guillemet = None
            continue
        if c in "\"'":
            guillemet = c
            courant += c
            continue
        if c == ",":
            elements.append(courant.strip())
            courant = ""
            continue
        courant += c
    elements.append(courant.strip())
    return elements


def valeur_nombre(brut):
    if brut is None:
        return None
    b = brut.strip()
    if b in ("", "null", "void 0", "undefined", "NaN"):
        return None
    if b.startswith('"') or b.startswith("'"):
        b = b[1:-1]
    try:
        return float(b)
    except ValueError:
        return None


def valeur_texte(brut):
    if brut is None:
        return None
    b = brut.strip()
    if b in ("", "null", "void 0", "undefined"):
        return None
    if (b.startswith('"') and b.endswith('"')) or (b.startswith("'") and b.endswith("'")):
        b = b[1:-1]
    return b or None


def analyser(html):
    """Renvoie un dictionnaire {exercice, cloture, ratios:{...}} ou leve ValueError."""
    bloc = extraire_bloc(html)
    if bloc is None:
        raise ValueError("bloc financialData absent")
    dates = [valeur_texte(x) for x in (tableau(bloc, "datekey") or [])]
    exercices = [valeur_texte(x) for x in (tableau(bloc, "fiscalYear") or [])]
    if not dates and not exercices:
        raise ValueError("aucune colonne d exercice")
    longueur = max(len(dates), len(exercices))

    def a(liste, i):
        return liste[i] if i < len(liste) else None

    # Colonnes des exercices complets : on ecarte la colonne TTM (cumul glissant).
    indices = [i for i in range(longueur) if (a(dates, i) or "").upper() != "TTM"]

    sortie = {"exercice": None, "cloture": None, "ratios": {}}
    if indices:
        premier = indices[0]
        sortie["exercice"] = a(exercices, premier)
        cloture = a(dates, premier)
        sortie["cloture"] = cloture if (cloture and re.match(r"^\d{4}-\d{2}-\d{2}$", cloture)) else None

    for nom in RATIOS:
        brut = tableau(bloc, nom)
        if brut is None:
            continue                              # ratio non publie pour cette societe
        valeurs = [valeur_nombre(x) for x in brut]
        historique = []
        for i in indices:
            v = a(valeurs, i)
            if v is None:
                continue
            historique.append({
                "exercice": a(exercices, i),
                "cloture": a(dates, i),
                "valeur": v,
            })
        if not historique:
            continue                              # aucune valeur publiee : on ne garde rien
        dernier = historique[0]
        entree = {
            "valeur": dernier["valeur"],
            "exercice": dernier["exercice"],
            "cloture": dernier["cloture"],
            "historique": historique,
        }
        ttm_indices = [i for i in range(longueur) if (a(dates, i) or "").upper() == "TTM"]
        if ttm_indices:
            v = a(valeurs, ttm_indices[0])
            if v is not None:
                entree["cumul_glissant"] = v
        sortie["ratios"][nom] = entree

    devise = None
    bloc_detail = extraire_bloc(html, "details:{")
    if bloc_detail:
        trouve = re.search(r"fiscalYear:\"([^\"]+)\"", bloc_detail)
        if trouve:
            devise = trouve.group(1)
    sortie["exercice_fiscal"] = devise
    return sortie


# ---------------------------------------------------------------- collecte

def traiter(ticker):
    urls = adresses_possibles(ticker)
    if not urls:
        return {"ticker": ticker, "statut": "echec",
                "cause": "place de cotation inconnue pour le suffixe"}
    derniere_cause = None
    for url in urls:
        code, texte = telecharger_avec_reprise(url)
        if code == 404:
            derniere_cause = "page introuvable (404) : place de cotation ou symbole faux"
            continue
        if code != 200:
            derniere_cause = "reponse HTTP %s" % (code or "reseau indisponible")
            continue
        try:
            donnees = analyser(texte)
        except ValueError as err:
            derniere_cause = "page lue mais %s" % err
            continue
        titre = re.search(r"<title>([^<]*)</title>", texte)
        enregistrement = {
            "ticker": ticker,
            "url": url,
            "nom_page": (titre.group(1).strip() if titre else None),
            "exercice": donnees["exercice"],
            "cloture": donnees["cloture"],
            "exercice_fiscal": donnees["exercice_fiscal"],
            "ratios": donnees["ratios"],
            "collecte_le": datetime.now(timezone.utc).isoformat(),
        }
        if not donnees["ratios"]:
            enregistrement["statut"] = "sans_ratio"
            enregistrement["cause"] = "aucun des quatre ratios n est publie sur la page"
        else:
            enregistrement["statut"] = "ok"
        return enregistrement
    return {"ticker": ticker, "statut": "echec", "url": urls[0],
            "cause": derniere_cause or "cause inconnue",
            "collecte_le": datetime.now(timezone.utc).isoformat()}


def charger_progres():
    faits = {}
    if not os.path.exists(PROGRES):
        return faits
    with open(PROGRES, "r", encoding="utf-8") as f:
        for ligne in f:
            ligne = ligne.strip()
            if not ligne:
                continue
            try:
                e = json.loads(ligne)
            except json.JSONDecodeError:
                continue
            faits[e["ticker"]] = e
    return faits


def ecrire_sortie(faits, tickers):
    ordonnes = [faits[t] for t in tickers if t in faits]
    decompte = {"total_univers": len(tickers), "traitees": len(ordonnes)}
    for nom in RATIOS:
        decompte[nom] = sum(1 for e in ordonnes if e.get("ratios", {}).get(nom))
    decompte["ok"] = sum(1 for e in ordonnes if e.get("statut") == "ok")
    decompte["sans_ratio"] = sum(1 for e in ordonnes if e.get("statut") == "sans_ratio")
    decompte["echec"] = sum(1 for e in ordonnes if e.get("statut") == "echec")
    contenu = {
        "genere_le": datetime.now(timezone.utc).isoformat(),
        "source": "stockanalysis.com, onglet Financials > Ratios, vue annuelle",
        "univers": "v1-9-5-clean-all-tickers.json",
        "methode": {
            "valeur_retenue": "dernier exercice fiscal complet publie, la colonne de cumul glissant (TTM) est ecartee",
            "unite": "fraction decimale (0,1678 = 16,78 %)",
            "historique": "toutes les colonnes annuelles affichees par la page, de la plus recente a la plus ancienne",
            "absence": "une societe dont un ratio n est pas publie n a pas la cle correspondante, aucune valeur approchee",
            "places": {"PA": "epa", "DE": "etr", "SW": "swx", "AS": "ams"},
        },
        "decompte": decompte,
        "societes": ordonnes,
    }
    provisoire = SORTIE + ".tmp"
    with open(provisoire, "w", encoding="utf-8") as f:
        json.dump(contenu, f, ensure_ascii=False, indent=1)
    os.replace(provisoire, SORTIE)




# ---------------------------------------------------------------- controle

REFERENCE = os.path.join(RACINE, "src", "data", "roic-dernier-exercice.json")


def controle():
    """Compare le ROIC collecte au ROIC deja calcule dans roic-dernier-exercice.json."""
    collecte = json.load(open(SORTIE, encoding="utf-8"))
    reference = json.load(open(REFERENCE, encoding="utf-8"))
    par_ticker = {e["ticker"]: e for e in collecte["societes"]}
    noms = {e["ticker"]: e.get("nom") for e in reference["societes"]}
    for cle in ("ecartees_secteur", "capital_investi_negatif", "en_echec"):
        for e in reference.get(cle, []):
            noms.setdefault(e.get("ticker"), e.get("nom"))

    proches, moyens, lointains, absents = [], [], [], []
    for e in reference["societes"]:
        t = e["ticker"]
        a = par_ticker.get(t, {}).get("ratios", {}).get("roic", {}).get("valeur")
        if a is None:
            absents.append(t)
            continue
        ecart = abs(a - e["roic"]) * 100.0     # en points de pourcentage
        ligne = (ecart, t, noms.get(t) or t, a * 100.0, e["roic"] * 100.0)
        if ecart < 2:
            proches.append(ligne)
        elif ecart <= 10:
            moyens.append(ligne)
        else:
            lointains.append(ligne)

    print("Controle ROIC : reference %d societes, comparables %d"
          % (len(reference["societes"]), len(proches) + len(moyens) + len(lointains)))
    print("  concordance a moins de 2 points  : %d" % len(proches))
    print("  divergence de 2 a 10 points      : %d" % len(moyens))
    print("  divergence de plus de 10 points  : %d" % len(lointains))
    print("  sans ROIC collecte               : %d %s" % (len(absents), absents[:20]))
    print("\n  dix pires ecarts :")
    for ecart, t, nom, a, b in sorted(lointains + moyens, reverse=True)[:10]:
        print("    %-10s %-34s stockanalysis %8.1f %%   calcul interne %8.1f %%   ecart %6.1f pts"
              % (t, nom[:34], a, b, ecart))

    print("\nSocietes sans aucun ratio :")
    aucun = [e for e in collecte["societes"] if not e.get("ratios")]
    manquants = [t for t in json.load(open(UNIVERS, encoding="utf-8"))["tickers"]
                 if t not in par_ticker]
    for e in aucun:
        print("    %-10s %s" % (e["ticker"], e.get("cause") or "cause non renseignee"))
    for t in manquants:
        print("    %-10s non traite par la collecte" % t)
    print("    total %d" % (len(aucun) + len(manquants)))

    print("\nCouverture par ratio :")
    for nom in RATIOS:
        n = collecte["decompte"][nom]
        print("    %-5s %3d / %d  (%.1f %%)" % (nom, n, collecte["decompte"]["total_univers"],
                                                100.0 * n / collecte["decompte"]["total_univers"]))

def main():
    args = set(sys.argv[1:])
    if "--controle" in args:
        controle()
        return
    os.makedirs(CACHE, exist_ok=True)
    tickers = json.load(open(UNIVERS, encoding="utf-8"))["tickers"]

    if "--rejouer" in args and os.path.exists(PROGRES):
        os.remove(PROGRES)
    faits = charger_progres()
    if "--seulement-echecs" in args:
        faits = {t: e for t, e in faits.items() if e.get("statut") != "echec"}

    a_faire = [t for t in tickers if t not in faits]
    print("univers %d, deja fait %d, a faire %d" % (len(tickers), len(faits), len(a_faire)),
          flush=True)

    journal = open(PROGRES, "a", encoding="utf-8")
    try:
        for rang, ticker in enumerate(a_faire, 1):
            debut = time.time()
            entree = traiter(ticker)
            faits[ticker] = entree
            journal.write(json.dumps(entree, ensure_ascii=False) + "\n")
            journal.flush()
            if rang % 10 == 0 or rang == len(a_faire):
                ecrire_sortie(faits, tickers)
                print("  %d/%d  %s  %s" % (rang, len(a_faire), ticker, entree["statut"]),
                      flush=True)
            reste = PAUSE_MIN + random.random() * PAUSE_ALEA - (time.time() - debut)
            if reste > 0:
                time.sleep(reste)
    finally:
        journal.close()
        ecrire_sortie(faits, tickers)
    print("termine", flush=True)


if __name__ == "__main__":
    main()
