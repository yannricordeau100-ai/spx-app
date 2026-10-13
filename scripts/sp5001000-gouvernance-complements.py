#!/usr/bin/env python3
"""Complements du bloc gouvernance des fiches du niveau 1 (vague sp5001000), 12 oct 2026.

Le bloc gouvernance du niveau 1 vient de data-lake/<T>/gouvernance_fr.json
(extraction du dernier DEF 14A). Il lui manque, par rapport a l univers
principal, quatre champs. Ils sont poses dans `overrides_governance` de
src/data/v2-pipeline-enrich/<t>.json : le chargeur les fusionne champ par champ
SANS JAMAIS ecraser un champ deja rempli (load-company.ts, overrides_governance),
et sp5001000-onboard.py conserve cette cle quand il reconstruit la fiche.

  - voting_structure : premiere phrase de voting_structure_note (texte deja
    extrait du DEF 14A), seulement si la note existe ;
  - avg_tenure_years : moyenne de (annee de l assemblee - annee « Director
    since ») lue dans le dernier DEF 14A local, SEULEMENT si le nombre de
    mentions « Director since AAAA » est egal a la taille du conseil du bloc
    (sinon doublons ou anciens administrateurs : on ne pose rien) ;
  - cfo_name : dirigeant dont le titre contient « Chief Financial Officer » ou
    « CFO » dans la liste des dirigeants Yahoo Finance (companyOfficers), hors
    titres « former », « interim » ou « acting » ;
  - source : « Circulaire de procuration (DEF 14A) deposee le <date> », date lue dans
    le _source de gouvernance_fr.json (aucun chemin de fichier).
Aucun modele de langue, aucune valeur par defaut.

Usage : python3 scripts/sp5001000-gouvernance-complements.py --tickers-file src/data/univers-sp5001000.json [--sans-yahoo]
"""
import argparse
import datetime as dt
import glob
import gzip
import json
import os
import re
import time
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class _Txt(HTMLParser):
    def __init__(self):
        super().__init__()
        self.p, self.skip = [], False

    def handle_starttag(self, tag, a):
        if tag in ("script", "style"):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = False

    def handle_data(self, d):
        if not self.skip:
            self.p.append(d)


def texte(p):
    h = _Txt()
    try:
        h.feed(gzip.open(p, "rt", encoding="utf-8", errors="ignore").read())
    except Exception:
        pass
    return re.sub(r"\s+", " ", " ".join(h.p))


def premiere_phrase(s):
    m = re.match(r"(.+?[.!?])(\s|$)", s.strip())
    return (m.group(1) if m else s).strip()


def anciennete(t, g):
    fs = sorted(glob.glob(f"{ROOT}/data-lake/{t}/DEF14A/*.gz"))
    n = g.get("board_size")
    an = str(g.get("agm_date") or "")[:4]
    if not fs or not isinstance(n, int) or not an.isdigit():
        return None
    ans = [int(x) for x in re.findall(r"Director\s+since[:\s]+((?:19|20)\d\d)\b", texte(fs[-1]), re.I)]
    if len(ans) != n or any(a > int(an) for a in ans):
        return None
    return round(sum(int(an) - a for a in ans) / n, 1)


def cfo_yahoo(t):
    import yfinance as yf
    try:
        off = (yf.Ticker(t).info or {}).get("companyOfficers") or []
    except Exception:
        return None
    for o in off:
        titre = str(o.get("title") or "")
        if re.search(r"chief financial officer|\bCFO\b", titre, re.I) and not re.search(r"former|interim|acting|deputy|assistant", titre, re.I):
            nom = re.sub(r"^(Mr|Ms|Mrs|Dr)\.?\s+", "", str(o.get("name") or "")).strip()
            nom = re.sub(r",?\s+(CPA|CFA|J\.?D\.?|Ph\.?D\.?|M\.?B\.?A\.?)\b.*$", "", nom).strip()
            nom = re.sub(r"\s+", " ", nom)
            if len(nom.split()) >= 2:
                return nom
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", required=True)
    ap.add_argument("--sans-yahoo", action="store_true")
    a = ap.parse_args()
    d = json.load(open(a.tickers_file))
    tickers = d["tickers"] if isinstance(d, dict) else d
    bilan = {"voting_structure": 0, "avg_tenure_years": 0, "cfo_name": 0, "source": 0, "fiches": 0}
    for t in tickers:
        pg = f"{ROOT}/data-lake/{t}/gouvernance_fr.json"
        try:
            brut = json.load(open(pg))
        except Exception:
            continue
        g = brut.get("data") or {}
        try:
            pl = (json.load(open(f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json")).get("governance") or {})
        except Exception:
            pl = {}
        vide = lambda k: pl.get(k) in (None, "", [], {}) and g.get(k) in (None, "", [], {})
        ov = {}
        if vide("voting_structure") and isinstance(g.get("voting_structure_note"), str) and g["voting_structure_note"].strip():
            ov["voting_structure"] = premiere_phrase(g["voting_structure_note"])
        if vide("avg_tenure_years"):
            v = anciennete(t, g)
            if v is not None:
                ov["avg_tenure_years"] = v
        if vide("cfo_name") and not a.sans_yahoo:
            c = cfo_yahoo(t)
            time.sleep(0.3)
            if c and c != g.get("ceo_name"):
                ov["cfo_name"] = c
        if vide("source") and brut.get("_source"):
            # libelle client (aucun chemin de fichier : regle « cuisine interne », assainir-payload.ts)
            m = re.search(r"DEF\s?14A.*?(\d{4}-\d{2}-\d{2})", brut["_source"])
            if m:
                ov["source"] = f"Circulaire de procuration (DEF 14A) déposée le {m.group(1)}"
        if not ov:
            continue
        pe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        cur = en.get("overrides_governance") if isinstance(en.get("overrides_governance"), dict) else {}
        for k, v in ov.items():
            if cur.get(k) in (None, ""):
                cur[k] = v
                bilan[k] += 1
        en["overrides_governance"] = cur
        if "cfo_name" in ov:
            en["_cfo_name_source"] = "Yahoo Finance, liste des dirigeants (companyOfficers)"
        en["_gouvernance_complements_at"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(pe, "w", encoding="utf-8") as f:
            json.dump(en, f, ensure_ascii=False, indent=2)
        bilan["fiches"] += 1
    print(json.dumps(bilan, ensure_ascii=False))


if __name__ == "__main__":
    main()
