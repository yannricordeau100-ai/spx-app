#!/usr/bin/env python3
"""Calendrier (events) des fiches du niveau 1 (vague sp5001000), 12 oct 2026.

Les fiches de l univers principal portent dans leur PL 8 evenements tires des
formulaires 8-K de la SEC (champs date, title_fr, description_fr, category,
source_url, _accession, _item). Le script qui les a produits n est plus dans le
depot : celui-ci reproduit le MEME format, avec les memes libelles par rubrique
8-K (releves sur les 3 855 evenements de l univers principal), sans modele de
langue : uniquement la liste officielle des depots (data.sec.gov/submissions,
champ « items »). Rien n est invente : la date, la rubrique et le lien sont ceux
du depot.

Ecrit la cle `events` dans src/data/v2-pipeline-enrich/<t>.json (fusionnee par
le chargeur quand le PL n a pas d evenements ; sp5001000-onboard.py conserve
cette cle). N ecrase pas des events deja presents sauf --force.

Usage : python3 scripts/sp5001000-events-8k.py --tickers-file src/data/univers-sp5001000.json [--force] [--limit N]
"""
import argparse
import json
import os
import ssl
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mettrik AI yannricordeau100@gmail.com"
try:
    import certifi
    SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL = ssl.create_default_context()

# rubrique 8-K -> (titre, categorie, description) : libelles majoritaires de l univers principal
LIBELLES = {
    "2.02": ("Publication des résultats", "financier", "{n} publie ses résultats trimestriels via un communiqué déposé auprès de la SEC."),
    "1.01": ("Accord matériel", "acquisition", "{n} annonce la conclusion d'un accord matériel important."),
    "2.05": ("Coûts liés à un plan de sortie", "restructuration", "{n} annonce des coûts liés à un plan de restructuration ou de sortie d'activités."),
    "5.02": ("Changement au sein de la direction", "dirigeant", "{n} annonce un changement au sein de son équipe dirigeante ou de son conseil d'administration."),
    "5.07": ("Vote de l'assemblée annuelle", "réglementaire", "{n} rapporte les résultats du vote de son assemblée générale des actionnaires."),
    "2.03": ("Nouvelle obligation financière", "financier", "{n} contracte une obligation financière directe significative."),
    "8.01": ("Événement significatif", "stratégie", "{n} rapporte un événement significatif via un communiqué déposé auprès de la SEC."),
    "7.01": ("Communication Regulation FD", "guidance", "{n} publie une communication Regulation FD auprès de la SEC."),
    "5.03": ("Modification statutaire", "réglementaire", "{n} publie une modification de ses statuts ou règlement intérieur."),
}
PRIORITE = list(LIBELLES)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25, context=SSL) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def events_8k(cik: str, nom: str, cap: int = 8):
    d = get(f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json")
    if not d:
        return None
    r = (d.get("filings") or {}).get("recent") or {}
    out = []
    for f, date, acc, items in zip(r.get("form", []), r.get("filingDate", []), r.get("accessionNumber", []), r.get("items", [])):
        if f != "8-K":
            continue
        its = [x.strip() for x in str(items or "").split(",") if x.strip()]
        it = next((p for p in PRIORITE if p in its), None)
        if not it:
            continue
        titre, cat, desc = LIBELLES[it]
        out.append({
            "date": date,
            "title_fr": titre,
            "description_fr": desc.format(n=nom),
            "category": cat,
            "source_url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{acc}-index.htm",
            "_accession": acc,
            "_item": it,
        })
        if len(out) >= cap:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", required=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    d = json.load(open(a.tickers_file))
    tickers = d["tickers"] if isinstance(d, dict) else d
    if a.limit:
        tickers = tickers[: a.limit]
    bilan = {"ecrit": 0, "deja": 0, "sans_cik": 0, "sans_8k": 0, "echec_sec": 0}
    for t in tickers:
        pe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        if en.get("events") and not a.force:
            bilan["deja"] += 1
            continue
        try:
            pl = json.load(open(f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json"))
        except Exception:
            pl = {}
        cik = str(((pl.get("_sp5001000") or {}) if isinstance(pl.get("_sp5001000"), dict) else {}).get("cik") or "")
        if not cik:
            try:
                cik = str(json.load(open(f"{ROOT}/data-lake/{t}/xbrl/companyfacts.json")).get("cik") or "")
            except Exception:
                cik = ""
        if not cik.isdigit():
            bilan["sans_cik"] += 1
            continue
        ev = events_8k(cik, pl.get("name") or t)
        time.sleep(0.15)
        if ev is None:
            bilan["echec_sec"] += 1
            continue
        if not ev:
            bilan["sans_8k"] += 1
            continue
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}  # relu juste avant ecriture
        en["events"] = ev
        en["_events_8k_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with open(pe, "w", encoding="utf-8") as f:
            json.dump(en, f, ensure_ascii=False, indent=2)
        bilan["ecrit"] += 1
    print(json.dumps(bilan, ensure_ascii=False))


if __name__ == "__main__":
    main()
