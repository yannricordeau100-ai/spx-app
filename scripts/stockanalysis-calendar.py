#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Calendrier des resultats depuis stockanalysis.com (gratuit) pour les societes
NON americaines (MarketBeat couvre les americaines) : prochaine date
(page de la societe, ligne « Earnings Date ») et historique (dates des
appels de resultats listes sur la page transcripts).

Ecrit src/data/earnings-calendar-stockanalysis.json, meme format que le
fichier MarketBeat : {MAJ, source, par_ticker: {t: {historique, prochaine,
estimee, maj}}, sans_page}. Fusionne par scripts/build-earnings-calendar.py.

Usage : python3 scripts/stockanalysis-calendar.py [--tickers A.PA,B.DE] [--all]
"""
import argparse
import datetime
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module  # noqa: E402

sa = import_module("stockanalysis-transcripts")

ROOT = sa.ROOT
OUT = os.path.join(ROOT, "src", "data", "earnings-calendar-stockanalysis.json")
RE_DATE = sa.RE_DATE
RE_EARN = re.compile(r'Earnings Date\s*(?:<[^>]+>\s*)*([A-Z][a-z]{2}[a-z]*\.? \d{1,2}, \d{4})')


def iso(txt):
    m = RE_DATE.search(txt)
    if not m:
        return None
    return "%04d-%02d-%02d" % (int(m.group(3)), sa.MOIS[m.group(1).lower()[:3]], int(m.group(2)))


def adresses(ticker):
    """Adresses candidates : celle deja verifiee par la passe transcripts
    (cache), puis les adresses directes, puis la recherche du site avec
    controle du nom (Deutsche Post ne doit pas tomber sur Deutsche Borse)."""
    connue = sa.cache_symboles().get(ticker.upper())
    liste = ([connue] if connue else []) + [u for u in sa.chemins(ticker) if u != connue]
    return liste


def page_societe(ticker, suffixe=""):
    """Retourne (code, corps, adresse_transcripts) pour la page demandee."""
    mots = sa.mots_distinctifs(sa.nom_societe(ticker))
    essais = adresses(ticker)
    directes = len(essais)
    i, code, body = 0, 0, ""
    while i < len(essais):
        base = essais[i]
        i += 1
        url = base if suffixe == "transcripts" else base.replace("transcripts/", "")
        code, body = sa.fetch(url)
        time.sleep(sa.PAUSE)
        if code == 200 and body:
            if i > directes and mots and not (mots & sa.mots_distinctifs(sa.nom_page(body))):
                continue
            return code, body, base
        if i == len(essais) and len(essais) == directes:
            essais = essais + sa.recherche_symboles(ticker)
    return code, "", None


def prochaine(ticker):
    code, body, base = page_societe(ticker)
    if base:
        sa.enregistre_symbole(ticker, base)
    if code != 200 or not body:
        return None, code
    m = re.search(r'Earnings Date(.{0,400})', body, re.S)
    if not m:
        return None, code
    d = iso(re.sub(r'<[^>]+>', ' ', m.group(1)))
    return d, code


def historique(ticker):
    code, body, _ = page_societe(ticker, "transcripts")
    if code != 200 or not body:
        return []
    dates = set()
    for m in re.finditer(r'Earnings Call: (?:Q[1-4]|H[12]|FY) ?\d{4}', body):
        seg = re.sub(r'<[^>]+>', ' ', body[m.start():m.start() + 800])
        d = iso(seg)
        if d:
            dates.add(d)
    return sorted(dates)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    cible = [t.strip() for t in a.tickers.split(",") if t.strip()] if a.tickers else sa.calcule_cible(a.all)
    try:
        ancien = json.load(open(OUT)).get("par_ticker", {})
    except Exception:
        ancien = {}
    out, sans = dict(ancien), []
    today = datetime.date.today().isoformat()
    for i, t in enumerate(cible, 1):
        proch, code = prochaine(t)
        hist = historique(t)
        if code != 200 and not hist:
            sans.append(t)
            print("%d/%d %s : sans page (HTTP %s)" % (i, len(cible), t, code), flush=True)
            continue
        anc = set(ancien.get(t, {}).get("historique", []))
        if proch and proch < today:
            anc.add(proch)
            proch = None
        out[t] = {"historique": sorted(anc | set(hist)), "prochaine": proch, "estimee": False if proch else True, "maj": today}
        print("%d/%d %s : prochaine %s, historique %d" % (i, len(cible), t, proch, len(out[t]["historique"])), flush=True)
    json.dump({"MAJ": today, "source": "stockanalysis", "par_ticker": out, "sans_page": sans},
              open(OUT, "w"), ensure_ascii=False, indent=1)
    print("ecrit", OUT, ":", len(out), "societes,", len(sans), "sans page")


if __name__ == "__main__":
    main()
