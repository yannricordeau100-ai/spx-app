#!/usr/bin/env python3
"""Onboarding de la vague sp5001000 (Russell 1000 hors univers Mettrik), NIVEAU 1 SEUL.

Decision de Yann du 9 oct 2026 : le Russell 1000 devient un indice couvert. Ses
societes absentes de Mettrik recoivent leurs fiches d abord UNIQUEMENT sur la
preversion niveau 1 (mettrik-niveau1.vercel.app, deploiement avec UNIVERS=sp5001000,
scripts/deploy-niveau1.sh). mettrik.ai et le niveau 2 n en montrent aucune tant
que Yann n a pas dit « go » (garde-fou : scripts/verif-release.py).

Adapte de scripts/aexdax-onboard.py. Idempotent. Aucune invention : tout vient du
draft kpis-haut (KH, Phase 2) et des blocs data-lake (Phase 3).

Ecrit UNIQUEMENT :
  - src/data/v2-pipeline/<t>.json            (PL minimal : identite, hero, blocs P3, _validation)
  - src/data/v2-pipeline-enrich/<t>.json     (EN minimal : dates _maj_<bloc>)
  - src/data/univers-sp5001000.json          (liste du niveau 1 : une societe n y entre
                                              que si sa fiche est prete)
  - data-lake/_sp5001000/anciens/<T>/        (sauvegarde des anciennes couches deplacees)
  - data-lake/_sp5001000/onboard-rapport.json
N ajoute JAMAIS une societe a v1-9-5-clean-all-tickers.json, v1-7-public.json,
disabled-blocks-per-ste.json, market-cap-order.json, ni a aucune autre liste de
production ; n ecrit rien dans Supabase (desk_curated_companies, desk_disabled_blocks).

Fiche prete =
  1. extraction finie : data-lake/_sp5001000/etat-extraction/<T>.json avec statut
     « fini » (ou champ p3 renseigne), sondes de verification sans echec ;
  2. KH present, au bon ticker, avec un hero (hero_kpi = short d un KPI qui a une valeur) ;
  3. PL valide (nom, hero, kpis, _validation) ;
  4. le VRAI chargeur, en mode niveau 1, rend la fiche « ready »
     (scripts/sp5001000-verif-fiches.ts ; option --sans-verif pour l ignorer).

Anciennes couches : 362 societes de la vague ont des fichiers d anciennes chaines
(V1.7/V1.8, non verifies, rangs calcules dans un autre univers, series
trimestrielles anciennes). Pour qu une fiche du niveau 1 ne melange pas ces
donnees avec la nouvelle extraction, les couches lues par le chargeur sont
DEPLACEES (jamais supprimees) dans data-lake/_sp5001000/anciens/<T>/ ; elles
restent aussi dans l historique git. --garder-anciens desactive ce deplacement.

Usage :
  python3 scripts/sp5001000-onboard.py                       # toutes les extractions finies
  python3 scripts/sp5001000-onboard.py --tickers SNOW,TWLO   # restreint a ces societes
  python3 scripts/sp5001000-onboard.py --simulation          # n ecrit rien
  python3 scripts/sp5001000-onboard.py --liste-seule         # (re)ecrit seulement univers-sp5001000.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAGUE = f"{ROOT}/data-lake/_sp5001000"
LISTE = f"{VAGUE}/liste.json"
ETAT_DIR = f"{VAGUE}/etat-extraction"
ANCIENS = f"{VAGUE}/anciens"
RAPPORT = f"{VAGUE}/onboard-rapport.json"
UNIVERS_N1 = f"{ROOT}/src/data/univers-sp5001000.json"
CLEAN_ALL = f"{ROOT}/src/data/v1-9-5-clean-all-tickers.json"
PL_DIR = f"{ROOT}/src/data/v2-pipeline"
EN_DIR = f"{ROOT}/src/data/v2-pipeline-enrich"
KH_DIR = f"{ROOT}/.batches-drafts-safe/kpis-haut"

# Couches lues par le chargeur (src/lib/company-core/load-company.ts) qui
# injecteraient d anciennes donnees non verifiees dans la fiche du niveau 1.
SATELLITES_ANCIENS = [
    "ranks", "tam", "description", "mettrik-description", "ai-pos", "sa22d",
    "kpis-v3", "quarterly-history", "stories_signal_patch", "hero_name_fr",
]

SECTEURS_EN_FR = {
    "Energy": "Énergie", "Materials": "Matériaux", "Industrials": "Industrie",
    "Consumer Discretionary": "Consommation discrétionnaire", "Consumer Staples": "Consommation de base",
    "Health Care": "Santé", "Financials": "Finance", "Information Technology": "Technologie",
    "Communication Services": "Services de communication", "Utilities": "Services aux collectivités",
    "Real Estate": "Immobilier",
}
SECTEURS_FR = set(SECTEURS_EN_FR.values())


def rj(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wj(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, p)


def rj_ou_none(p):
    try:
        return rj(p)
    except Exception:
        return None


def norm(t: str) -> str:
    return t.upper().replace("-", ".")


# --- GICS : codes et libelles francais (src/lib/desk/gics.ts et gics-en.ts) ---
def charge_gics():
    en = {}
    fr = {}
    try:
        src_en = open(f"{ROOT}/src/lib/desk/gics-en.ts", encoding="utf-8").read()
        for code, nom in re.findall(r'"(\d{8})":\s*"([^"]+)"', src_en):
            en[nom.strip().lower()] = code
        src_fr = open(f"{ROOT}/src/lib/desk/gics.ts", encoding="utf-8").read()
        for code, nom in re.findall(r'code:\s*"(\d{8})",\s*name:\s*"([^"]+)"', src_fr):
            fr[code] = nom
    except Exception:
        pass
    return en, fr


GICS_EN, GICS_FR = charge_gics()

# Repli quand le GICS est inconnu : grand secteur deduit du code SIC de la SEC
# (classification officielle de l emetteur, approximation du secteur GICS,
# signalee dans la fiche par _secteur_source ; aucune sous-industrie inventee).
SIC_SECTEUR = [
    ((100, 999), "Consommation de base"), ((1000, 1099), "Matériaux"), ((1200, 1299), "Énergie"),
    ((1300, 1399), "Énergie"), ((1400, 1499), "Matériaux"), ((1500, 1799), "Industrie"),
    ((2000, 2199), "Consommation de base"), ((2200, 2399), "Consommation discrétionnaire"),
    ((2400, 2499), "Matériaux"), ((2500, 2599), "Consommation discrétionnaire"), ((2600, 2699), "Matériaux"),
    ((2700, 2799), "Services de communication"), ((2830, 2839), "Santé"), ((2840, 2849), "Consommation de base"),
    ((2800, 2899), "Matériaux"), ((2900, 2999), "Énergie"), ((3000, 3099), "Matériaux"),
    ((3100, 3199), "Consommation discrétionnaire"), ((3200, 3399), "Matériaux"), ((3400, 3499), "Industrie"),
    ((3570, 3579), "Technologie"), ((3500, 3599), "Industrie"), ((3630, 3639), "Consommation discrétionnaire"),
    ((3600, 3699), "Technologie"), ((3710, 3719), "Consommation discrétionnaire"), ((3700, 3799), "Industrie"),
    ((3840, 3851), "Santé"), ((3800, 3899), "Technologie"), ((3900, 3999), "Consommation discrétionnaire"),
    ((4000, 4799), "Industrie"), ((4800, 4899), "Services de communication"), ((4950, 4959), "Industrie"),
    ((4900, 4999), "Services aux collectivités"), ((5000, 5199), "Industrie"), ((5400, 5499), "Consommation de base"),
    ((5200, 5999), "Consommation discrétionnaire"), ((6500, 6553), "Immobilier"), ((6798, 6798), "Immobilier"),
    ((6000, 6799), "Finance"), ((7000, 7099), "Consommation discrétionnaire"), ((7370, 7379), "Technologie"),
    ((7200, 7399), "Industrie"), ((7800, 7899), "Services de communication"), ((7900, 7999), "Consommation discrétionnaire"),
    ((8000, 8099), "Santé"), ((8200, 8299), "Consommation discrétionnaire"), ((8700, 8799), "Industrie"),
]


def secteur_sic(sic) -> str | None:
    try:
        n = int(str(sic))
    except Exception:
        return None
    for (a, b), s in SIC_SECTEUR:
        if a <= n <= b:
            return s
    return None


def identite(soc: dict, kh: dict, ancien_pl: dict | None) -> dict:
    """Nom, secteur, sous-secteur, code GICS. Aucune valeur inventee."""
    nom = (kh.get("company") or "").strip()
    if not nom and ancien_pl and str(ancien_pl.get("ticker", "")).upper() == soc["ticker"].upper():
        nom = (ancien_pl.get("name") or "").strip()
    if not nom:
        nom = (soc.get("nom") or soc["ticker"]).strip()
    out = {"name": nom, "sector": "", "subsector": "", "gics_code": None, "_secteur_source": None}
    sous = (soc.get("sous_industrie_gics") or "").strip().lower()
    code = GICS_EN.get(sous)
    if code:
        out["gics_code"] = code
        out["subsector"] = GICS_FR.get(code, "")
        out["sector"] = {
            "10": "Énergie", "15": "Matériaux", "20": "Industrie", "25": "Consommation discrétionnaire",
            "30": "Consommation de base", "35": "Santé", "40": "Finance", "45": "Technologie",
            "50": "Services de communication", "55": "Services aux collectivités", "60": "Immobilier",
        }.get(code[:2], "")
        out["_secteur_source"] = f"GICS ({soc.get('source_gics') or 'liste de la vague'})"
        return out
    if soc.get("secteur_gics") in SECTEURS_EN_FR:
        out["sector"] = SECTEURS_EN_FR[soc["secteur_gics"]]
        out["_secteur_source"] = f"GICS secteur ({soc.get('source_gics') or 'liste de la vague'})"
        return out
    if ancien_pl and ancien_pl.get("sector") in SECTEURS_FR:
        out["sector"] = ancien_pl["sector"]
        out["_secteur_source"] = "ancienne fiche (secteur francais, GICS a confirmer)"
        return out
    # Pas de secteur affiche plutot qu un secteur faux : le code SIC est une
    # approximation qui se trompe (Cheniere, SIC 4924 « distribution de gaz », est
    # Energie en GICS). Indication seulement, pour le classement GICS a faire.
    s = secteur_sic(soc.get("sic_sec"))
    out["_secteur_source"] = (f"GICS inconnu, secteur non affiche (indication SIC SEC {soc.get('sic_sec')} "
                              f"{soc.get('sic_libelle_sec') or ''} : {s or '?'}, a confirmer)")
    return out


def etat_extraction(T: str) -> tuple[bool, str]:
    d = rj_ou_none(f"{ETAT_DIR}/{T}.json")
    if d is None:
        return False, "extraction non commencee ou etat absent"
    statut = str(d.get("statut") or "").strip().lower()
    fini = statut in ("fini", "finie", "termine", "terminé") or bool(d.get("p3"))
    if not fini:
        return False, f"extraction en cours (statut={statut or '-'}, p2={d.get('p2') or '-'}, p3 non ecrit)"
    v = d.get("verif") or {}
    if isinstance(v, dict) and v.get("points") not in (None, 0) and v.get("ok") is not None:
        try:
            if int(v["ok"]) < int(v["points"]):
                return False, f"sondes de verification en echec ({v['ok']}/{v['points']})"
        except Exception:
            pass
    return True, "fini"


def hero_du_kh(kh: dict):
    hs = kh.get("hero_kpi")
    if not hs:
        return None, "KH sans hero_kpi"
    hero = next((k for k in kh.get("kpis") or [] if k.get("short") == hs), None)
    if hero is None:
        return None, f"hero '{hs}' absent des KPI du KH"
    if hero.get("value") in (None, "") and not hero.get("history"):
        return None, f"hero '{hs}' sans valeur"
    return hero, None


def bloc(p, cle="data"):
    d = rj_ou_none(p)
    if not isinstance(d, dict):
        return None
    v = d.get(cle) if cle else d
    return v or None


def avec_unite(rep):
    """Unite au niveau du bloc (sinon le composant affiche « Mds $ » quelle que soit la devise)."""
    if not isinstance(rep, dict):
        return rep
    if not rep.get("unit"):
        unites = {s.get("unit") for s in rep.get("slices") or [] if isinstance(s, dict) and s.get("unit")}
        if len(unites) == 1:
            rep = {**rep, "unit": unites.pop()}
    return rep


def gouvernance(g):
    if not isinstance(g, dict):
        return g
    n = g.get("notes")
    if n is not None and not isinstance(n, list):
        g = {**g, "notes": [n] if n else []}  # un champ notes non tableau fait planter le rendu serveur
    return g


def construit_pl(T: str, soc: dict, kh: dict, hero: dict, ancien_pl: dict | None, aujourd_hui: str) -> tuple[dict, dict]:
    dl = f"{ROOT}/data-lake/{T}"
    risks = (rj_ou_none(f"{dl}/risks/extracted.json") or {}).get("risks") or []
    gov = gouvernance(bloc(f"{dl}/gouvernance_fr.json"))
    seg = avec_unite(bloc(f"{dl}/segments_fr.json"))
    geo = avec_unite(bloc(f"{dl}/geo_fr.json"))
    ia = bloc(f"{dl}/ia_positionnement_fr.json")
    ident = identite(soc, kh, ancien_pl)
    pl = {
        "ticker": T,
        "name": ident["name"],
        "sector": ident["sector"],
        "subsector": ident["subsector"],
        "tagline": None,
        "logo_treatment": "text",
        "hero_kpi": hero.get("short"),
        "hero_kpi_rationale": kh.get("hero_kpi_rationale"),
        "kpis": [hero],
        "risks": risks,
        "governance": gov,
        "revenue_by_segment": seg,
        "revenue_by_geography": geo,
        "ai_positioning": ia,
        "_fit_for_site": True,
        "_sp5001000": {
            "vague": "sp5001000",
            "indice": "Russell 1000",
            "decision": "Yann, 9 oct 2026 : Russell 1000 indice couvert ; fiche servie d abord sur le niveau 1 seul (UNIVERS=sp5001000)",
            "secteur_source": ident["_secteur_source"],
            "cik": soc.get("cik"),
        },
        "_maj_at": aujourd_hui,
        "_maj_by": "sp5001000-onboard",
        "_validation": {
            "validated_by": "sp5001000-onboard",
            "validated_at": aujourd_hui,
            "note": "Extraction des documents SEC (10 ans) par la vague sp5001000 ; KPI du draft kpis-haut, blocs Phase 3 verbatim ; sondes de l orchestrateur dans data-lake/_sp5001000/etat-extraction.",
        },
    }
    if ident["gics_code"]:
        pl["gics_code"] = ident["gics_code"]
    presents = {
        "risques": bool(risks), "gouvernance": bool(gov), "repartition": bool(seg or geo),
        "positionnement_ia": bool(ia),
    }
    return pl, presents


def sans_dates(d):
    if not isinstance(d, dict):
        return d
    o = {k: v for k, v in d.items() if k not in ("_maj_at",)}
    if isinstance(o.get("_validation"), dict):
        o["_validation"] = {k: v for k, v in o["_validation"].items() if k != "validated_at"}
    return o


_LISTES = {}


def existe_exact(p: str) -> bool:
    """Existence SENSIBLE A LA CASSE (le Mac ignore la casse : SNOW.json = snow.json)."""
    d, b = os.path.split(p)
    if d not in _LISTES:
        try:
            _LISTES[d] = set(os.listdir(d))
        except Exception:
            _LISTES[d] = set()
    return b in _LISTES[d] and os.path.isfile(p)


def deplace_anciens(T: str, simulation: bool) -> list[str]:
    t = T.lower()
    cibles = [f"{EN_DIR}/{t}.{s}.json" for s in SATELLITES_ANCIENS]
    cibles += [f"{ROOT}/src/data/v2-pipeline-specific-kpis/{t}.json", f"{ROOT}/src/data/v2-pipeline-specific-kpis/{T}.json"]
    if T != t:
        cibles.append(f"{PL_DIR}/{T}.json")  # doublon en majuscules (contaminations historiques)
    deplaces = []
    for p in dict.fromkeys(cibles):
        if not existe_exact(p):
            continue
        # Les rangs produits pour le niveau 1 (scripts/ranks-sp5001000.py) ne sont pas d anciennes couches.
        if p.endswith(".ranks.json"):
            r = rj_ou_none(p) or {}
            if "sp5001000" in str(r.get("source", "")):
                continue
        rel = os.path.relpath(p, ROOT)
        deplaces.append(rel)
        if not simulation:
            dest = f"{ANCIENS}/{T}/{rel.replace('/', '__')}"
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if not os.path.exists(dest):
                shutil.copy2(p, dest)
            os.remove(p)
            _LISTES.pop(os.path.dirname(p), None)
    return deplaces


def sauvegarde(T: str, p: str, simulation: bool):
    if simulation or not os.path.isfile(p):
        return
    rel = os.path.relpath(p, ROOT)
    dest = f"{ANCIENS}/{T}/{rel.replace('/', '__')}"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest):
        shutil.copy2(p, dest)


def verif_chargeur(tickers: list[str]) -> dict:
    if not tickers:
        return {}
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        sortie = f.name
    env = dict(os.environ, UNIVERS="sp5001000")
    try:
        for l in open(f"{ROOT}/.env.local", encoding="utf-8").read().splitlines():
            if "=" in l and not l.lstrip().startswith("#"):
                k, v = l.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"'))
    except Exception:
        pass
    env["UNIVERS"] = "sp5001000"
    r = subprocess.run(["npx", "tsx", "scripts/sp5001000-verif-fiches.ts", sortie, *tickers],
                       cwd=ROOT, env=env, capture_output=True, text=True, timeout=1800)
    try:
        return rj(sortie)
    except Exception:
        return {t: {"kind": "erreur", "erreur": (r.stderr or r.stdout)[-300:]} for t in tickers}
    finally:
        try:
            os.remove(sortie)
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default=None)
    ap.add_argument("--simulation", action="store_true")
    ap.add_argument("--liste-seule", action="store_true")
    ap.add_argument("--sans-verif", action="store_true")
    ap.add_argument("--garder-anciens", action="store_true")
    a = ap.parse_args()
    aujourd_hui = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    jour = aujourd_hui[:10]

    liste = rj(LISTE)
    clean = rj(CLEAN_ALL)["tickers"]
    deja = {norm(t) for t in clean}
    vague, exclues = [], []
    for s in liste["societes"]:
        if norm(s["ticker"]) in deja or any(norm(c) in deja for c in s.get("classes") or []):
            exclues.append({"ticker": s["ticker"], "raison": "deja dans l univers principal (autre ecriture du ticker ou autre classe)"})
            continue
        vague.append(s)
    par_t = {s["ticker"].upper(): s for s in vague}

    uni = rj_ou_none(UNIVERS_N1) or {}
    autorisees = uni.get("autorisees_univers_principal") or []
    societes = dict(uni.get("societes") or {})
    pretes = [t for t in uni.get("tickers") or [] if t in par_t]

    rapport = {"genere_le": aujourd_hui, "simulation": a.simulation, "ajoutees": [], "mises_a_jour": [], "inchangees": [],
               "refusees": {}, "anciens_deplaces": {}, "exclues_de_la_vague": exclues}

    if not a.liste_seule:
        if a.tickers:
            demandes = [t.strip().upper() for t in a.tickers.split(",") if t.strip()]
        else:
            demandes = sorted(f[:-5] for f in os.listdir(ETAT_DIR) if f.endswith(".json")) if os.path.isdir(ETAT_DIR) else []
        candidats = {}
        for T in demandes:
            soc = par_t.get(T)
            if soc is None:
                rapport["refusees"][T] = "hors de la vague sp5001000 (ou deja dans l univers principal)"
                continue
            if soc.get("radiee"):
                rapport["refusees"][T] = f"societe radiee : {soc.get('statut_sec') or ''}"[:160]
                continue
            ok, motif = etat_extraction(T)
            if not ok:
                rapport["refusees"][T] = motif
                continue
            kh = rj_ou_none(f"{KH_DIR}/{T}.json")
            if not isinstance(kh, dict) or not kh.get("kpis"):
                rapport["refusees"][T] = "KH absent ou vide"
                continue
            if kh.get("ticker") and str(kh["ticker"]).upper() != T:
                rapport["refusees"][T] = f"KH d un autre ticker ({kh.get('ticker')})"
                continue
            hero, err = hero_du_kh(kh)
            if err:
                rapport["refusees"][T] = err
                continue
            t = T.lower()
            ancien_pl = rj_ou_none(f"{PL_DIR}/{t}.json")
            # Identite : l ANCIENNE fiche V1.7 (sauvegardee au premier passage), jamais la notre.
            legacy = rj_ou_none(f"{ANCIENS}/{T}/src__data__v2-pipeline__{t}.json")
            if legacy is None and isinstance(ancien_pl, dict) and not isinstance(ancien_pl.get("_sp5001000"), dict):
                legacy = ancien_pl
            pl, presents = construit_pl(T, soc, kh, hero, legacy, aujourd_hui)
            if not pl["name"] or not pl["kpis"] or not pl.get("_validation"):
                rapport["refusees"][T] = "PL invalide (nom, KPI ou _validation)"
                continue
            candidats[T] = (pl, presents, ancien_pl, kh, hero)

        # Ecriture PL + EN (avant le controle par le chargeur, qui lit les fichiers).
        ecrits = {}
        for T, (pl, presents, ancien_pl, kh, hero) in candidats.items():
            t = T.lower()
            p_pl = f"{PL_DIR}/{t}.json"
            deja_nous = isinstance(ancien_pl, dict) and isinstance(ancien_pl.get("_sp5001000"), dict)
            if deja_nous and sans_dates(ancien_pl) == sans_dates(pl):
                etat = "inchangee"
            else:
                etat = "mise_a_jour" if deja_nous else "ajoutee"
                if not a.simulation:
                    if not deja_nous:
                        sauvegarde(T, p_pl, a.simulation)
                    wj(p_pl, pl)
            if not a.garder_anciens:
                dep = deplace_anciens(T, a.simulation)
                if dep:
                    rapport["anciens_deplaces"][T] = dep
            p_en = f"{EN_DIR}/{t}.json"
            en_ancien = rj_ou_none(p_en)
            en = {"ticker": T, "_sp5001000": True, "_maj_at": jour, "_maj_by": "sp5001000-onboard",
                  "_maj_kpi_stories": jour}
            for cle, present in (("_maj_risques", presents["risques"]), ("_maj_gouvernance", presents["gouvernance"]),
                                 ("_maj_repartition", presents["repartition"]), ("_maj_positionnement_ia", presents["positionnement_ia"])):
                if present:
                    en[cle] = jour
            if isinstance(en_ancien, dict) and en_ancien.get("_sp5001000"):
                # idempotent : on garde les dates deja posees si rien n a change
                if etat == "inchangee":
                    en = en_ancien
            elif not a.simulation:
                sauvegarde(T, p_en, a.simulation)
            if not a.simulation and en != en_ancien:
                wj(p_en, en)
            ecrits[T] = etat

        # Controle par le vrai chargeur (mode niveau 1).
        verdicts = {} if (a.sans_verif or a.simulation) else verif_chargeur(sorted(ecrits))
        for T, etat in ecrits.items():
            pl, presents, ancien_pl, kh, hero = candidats[T]
            v = verdicts.get(T, {"kind": "ready", "non_verifie": True})
            if v.get("kind") != "ready" or (not v.get("non_verifie") and not v.get("kpis")):
                rapport["refusees"][T] = f"chargeur : {v.get('kind')} {v.get('erreur', '')}".strip()
                continue
            rk = rj_ou_none(f"{EN_DIR}/{T.lower()}.ranks.json") or {}
            societes[T] = {
                "nom": pl["name"],
                "secteur": pl["sector"],
                "sous_secteur": pl["subsector"],
                # Hero affiche par la recherche = celui que la fiche sert (choix du chargeur).
                "hero": ({"s": str(v["hero"]), "v": v.get("hero_valeur"), "u": v.get("hero_unite") or "",
                          "y": v.get("hero_yoy") if v.get("hero_yoy") is not None else "", "t": v.get("hero_type") or ""}
                         if v.get("hero") else
                         {"s": str(hero.get("short")), "v": hero.get("value"), "u": hero.get("unit") or "",
                          "y": hero.get("yoy") if hero.get("yoy") is not None else "", "t": hero.get("type") or ""}),
                "capi_usd": rk.get("market_cap_usd") if "sp5001000" in str(rk.get("source", "")) else None,
                "prete_le": (societes.get(T) or {}).get("prete_le") or jour,
                "controle": {k: v.get(k) for k in ("hero", "kpis", "kpis_tableau", "risques", "gouvernance", "ia") if k in v},
            }
            if T not in pretes:
                pretes.append(T)
            {"ajoutee": rapport["ajoutees"], "mise_a_jour": rapport["mises_a_jour"], "inchangee": rapport["inchangees"]}[etat].append(T)

    # Une societe sortie de la vague (ou dont la fiche a disparu) quitte la liste N1.
    pretes = sorted({t for t in pretes if t in par_t and os.path.isfile(f"{PL_DIR}/{t.lower()}.json")},
                    key=lambda t: (-(societes.get(t, {}).get("capi_usd") or 0), t))
    societes = {t: societes[t] for t in pretes if t in societes}
    # Capitalisation (ordre de la recherche du niveau 1) : seulement celle des rangs
    # calcules pour le niveau 1 (scripts/ranks-sp5001000.py), jamais d anciens rangs.
    for t in pretes:
        rk = rj_ou_none(f"{EN_DIR}/{t.lower()}.ranks.json") or {}
        if t in societes and "sp5001000" in str(rk.get("source", "")):
            societes[t]["capi_usd"] = rk.get("market_cap_usd")
    pretes.sort(key=lambda t: (-((societes.get(t) or {}).get("capi_usd") or 0), t))
    sortie = {
        "_regle": ("Univers du NIVEAU 1 SEUL (UNIVERS=sp5001000, scripts/deploy-niveau1.sh). Decision de Yann du 9 oct 2026 : "
                   "Russell 1000 indice couvert, fiches d abord sur mettrik-niveau1.vercel.app. `tickers` = fiches pretes servies "
                   "par le niveau 1 (ecrit par scripts/sp5001000-onboard.py, jamais a la main). `vague_complete` = toutes les "
                   "societes de la vague : sans autorisation, aucune n est servie par mettrik.ai ni par le niveau 2 "
                   "(src/lib/univers-actif.ts, controle rouge dans scripts/verif-release.py). `autorisees_univers_principal` : "
                   "a remplir A LA MAIN, seulement apres le « go » explicite de Yann, au moment ou la societe entre aussi dans "
                   "v1-9-5-clean-all-tickers.json."),
        "genere_le": aujourd_hui,
        "source_vague": "data-lake/_sp5001000/liste.json (iShares Russell 1000 IWB, N-PORT au 2026-06-30)",
        "count": len(pretes),
        "tickers": pretes,
        "societes": societes,
        "vague_complete": sorted(par_t),
        "exclues_de_la_vague": exclues,
        "autorisees_univers_principal": autorisees,
    }
    if not a.simulation:
        ancien = rj_ou_none(UNIVERS_N1)
        if ancien is None or {k: v for k, v in ancien.items() if k != "genere_le"} != {k: v for k, v in sortie.items() if k != "genere_le"}:
            wj(UNIVERS_N1, sortie)
        wj(RAPPORT, rapport)
    rapport["univers_n1"] = len(pretes)
    print(json.dumps({k: v for k, v in rapport.items() if k != "exclues_de_la_vague"}, ensure_ascii=False, indent=1)[:6000])
    print(f"univers-sp5001000.json : {len(pretes)} fiche(s) prete(s) sur {len(par_t)} societes de la vague "
          f"({len(exclues)} exclue(s) car deja couvertes)")


if __name__ == "__main__":
    main()
