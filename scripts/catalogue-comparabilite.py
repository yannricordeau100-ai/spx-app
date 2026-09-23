#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Catalogue de comparabilite des libelles d indicateurs. Reconstruit a zero le
23 septembre 2026 sur decision de Yann : un seul vocabulaire, tenu par le
script, au lieu d un melange de cles nommees par Claude et de cles nommees par
un moteur gratuit.

A QUOI IL SERT
    Sur une fiche societe, le bouton Comparer propose les societes qui suivent
    le MEME indicateur. Le rapprochement se fait sur une cle de comparabilite
    calculee par src/lib/compare-keys.ts : libelle canonique + famille d unite.
    Ce catalogue est la table qui donne le libelle canonique. Sans lui, deux
    societes qui appellent la meme mesure « net sales » et « chiffre d
    affaires » ne se rencontrent jamais.

CE QUI CASSE SI LE VOCABULAIRE CHANGE
    src/data/compare-index.json est bati sur ces cles (scripts/build-compare-
    index*.ts) et l API /api/compare interroge cet index. Renommer une cle sans
    rebatir l index coupe le rapprochement pour toutes les societes concernees :
    la page reste servie, mais le panneau Comparer se vide. D ou la regle R8 de
    la nomenclature : une cle publiee ne change plus de nom.

NOMENCLATURE
    scripts/catalogue_nomenclature.py, regles R1 a R8. Le moteur ne nomme
    jamais une cle : il repond par le NUMERO d un concept candidat, ou zero.

ENTREE   fiches servies (.batches-drafts-safe/kpis-haut + src/data/v2-pipeline)
         Le libelle lu est celui que la production utilise vraiment :
         type_comparable.en, sinon name_en, sinon short.
SORTIE   src/data/compare-catalogue.json
         .conv-state/catalogue-etat.json      reprise apres interruption
         .conv-state/catalogue-journal.jsonl  une ligne par decision, auditable
         .conv-state/catalogue.log
MOTEUR   moteurs GRATUITS (Cerebras, puis Groq, puis Gemini) via
         scripts/moteur_gratuit.py. JAMAIS Claude, meme en secours : une tache
         automatique serait facturee au compte connecte au hasard du moment.
         Si aucun moteur ne repond, un brouillon est depose dans .conv-state et
         RIEN n est ecrit dans src/data.

USAGE    python3 scripts/catalogue-comparabilite.py [--limit N] [--sans-moteur]
                                                    [--reprise] [--sortie X]
         --reprise     repart de l etat existant au lieu de reconstruire
         --sans-moteur passe deterministe seule (aucun appel reseau)
"""
import argparse
import collections
import json
import os
import re
import sys
import unicodedata
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalogue_nomenclature import (  # noqa: E402
    LEXIQUE, concept, garde_modificateurs, verifie_nomenclature,
)
from moteur_gratuit import (  # noqa: E402
    MoteurIndisponible, appelle as appelle_moteur, charge_env, ecris_brouillon,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")
SORTIE = os.path.join(ROOT, "src/data/compare-catalogue.json")
ETAT = os.path.join(ROOT, ".conv-state/catalogue-etat.json")
JOURNAL = os.path.join(ROOT, ".conv-state/catalogue-journal.jsonl")
LOG = os.path.join(ROOT, ".conv-state/catalogue.log")
LOT = 20            # libelles soumis au moteur par appel
CANDIDATS = 6       # concepts proposes au moteur par libelle
VERSION_ETAT = 3


def log(m):
    ligne = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), m)
    print(ligne, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(ligne + "\n")


# --------------------------------------------------------------------------
# normalisation du libelle : strictement celle de src/lib/compare-keys.ts,
# SANS la table de synonymes. Le catalogue doit etre consulte AVANT elle.
# --------------------------------------------------------------------------
def normalise(s):
    s = str(s or "").lower().replace("&", " and ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


DEVISES = [r"\$|\busd\b", r"€|\beur\b", r"\bchf\b", r"£|\bgbp\b", r"\b(rmb|cny)\b",
           r"\btwd\b", r"¥|\bjpy\b", r"₩|\bkrw\b", r"\bsek\b", r"\bdkk\b",
           r"\bnok\b", r"\bhkd\b", r"\bcad\b"]
COMPTES = re.compile(
    r"(employ|salari|personne|etp|unit|client|magasin|store|site|centre|brevet|marque|pays|"
    r"v[eé]hicule|agence|usine|logement|home|abonn|subscri|member|membre|restaurant|h[oô]tel|"
    r"user|utilisat|compte|account|avion|aircraft|navire|ship|room|chambre|lit|bed|"
    r"point de vente|outlet|location)", re.I)


def famille_unite(brut):
    """Famille d unite, portage fidele de parseUnite dans compare-keys.ts.
    C est le garde-fou mecanique de la regle R5 : il ne depend d aucun moteur."""
    u = str(brut or "").strip()
    bas = u.lower()
    if re.search(r"points? de base|bps|pb\b", bas):
        return "bps"
    if "%" in bas:
        return "pct"
    if re.search(r"points? de|ratio combin", bas):
        return "autre"
    devise = any(re.search(d, u, re.I) for d in DEVISES)
    if devise and re.search(r"/|par action|per share", u, re.I):
        return "per_share"
    if devise:
        return "money"
    if re.search(r"^x$|ratio|fois", bas):
        return "ratio"
    if re.search(r"jours?|days?", bas):
        return "days"
    if COMPTES.search(bas) or re.match(r"^(m|k|milliers|millions|000|)$", bas):
        return "count"
    return "autre"


# --------------------------------------------------------------------------
def lis_corpus():
    """Renvoie {libelle_normalise: {"n", "familles", "ex", "fr", "unite"}}."""
    tickers = json.load(open(UNIVERS))["tickers"]
    infos = {}
    for t in tickers:
        sources = (
            (os.path.join(ROOT, ".batches-drafts-safe/kpis-haut/%s.json" % t), ["kpis"]),
            (os.path.join(ROOT, "src/data/v2-pipeline/%s.json" % t.lower()), ["kpis", "stories_kpis"]),
        )
        for chemin, cles in sources:
            if not os.path.exists(chemin):
                continue
            try:
                d = json.load(open(chemin))
            except Exception:
                continue
            for c in cles:
                for k in d.get(c) or []:
                    tc = k.get("type_comparable")
                    tc = tc.get("en") if isinstance(tc, dict) else None
                    lab = normalise(tc or k.get("name_en") or k.get("short"))
                    if len(lab) < 3:
                        continue
                    e = infos.setdefault(lab, {"n": 0, "familles": collections.Counter(),
                                               "ex": t, "fr": k.get("name_fr") or "",
                                               "unite": k.get("unit") or ""})
                    e["n"] += 1
                    e["familles"][famille_unite(k.get("unit"))] += 1
    for e in infos.values():
        e["famille"] = e["familles"].most_common(1)[0][0]
        e["mixte"] = len(e["familles"]) > 1
        e["familles"] = dict(e["familles"])
    return infos


MOTS_VIDES = {"the", "a", "an", "of", "and", "to", "for", "in", "on", "by", "from", "with", "as"}


def jetons(libelle):
    return {m for m in libelle.split() if m not in MOTS_VIDES and len(m) > 1}


def candidats(libelle, alias_par_concept, famille):
    """Concepts plausibles pour un libelle, de MEME FAMILLE D UNITE (R5).
    Classement par recouvrement de mots avec les libelles deja rattaches."""
    j = jetons(libelle)
    if not j:
        return []
    scores = []
    for cle, (fam, alias) in alias_par_concept.items():
        if fam != famille:
            continue
        meilleur = 0.0
        for a in alias:
            # R5bis : la garde des modificateurs passe AVANT le moteur. Un
            # libelle qui ajoute ou retire un mot porteur de sens n est jamais
            # propose, meme si le recouvrement est fort.
            if not garde_modificateurs(libelle, a):
                continue
            ja = jetons(a)
            if not ja:
                continue
            inter = len(j & ja)
            if not inter:
                continue
            s = inter / float(len(j | ja))
            if s > meilleur:
                meilleur = s
        if meilleur >= 0.25:
            scores.append((meilleur, cle))
    scores.sort(reverse=True)
    return [c for _, c in scores[:CANDIDATS]]


CONSIGNE = """Tu ranges des libelles d indicateurs financiers dans un catalogue de comparabilite.
Pour chaque libelle, on te donne une liste numerotee de concepts deja existants, avec des exemples de libelles deja rattaches a chacun.
Reponds par le NUMERO du concept qui designe EXACTEMENT LA MEME MESURE, AU MEME PERIMETRE, de sorte qu un investisseur puisse comparer les valeurs de deux societes sans reserve.
Reponds 0 des que tu as un doute, et notamment :
- si le perimetre differe (un segment, une zone, une marque, une gamme face a un total)
- si la nature differe (un montant face a un taux, un stock face a un flux, un brut face a un net)
- si le libelle est propre a une seule societe
Ne propose jamais de nom : uniquement un numero.
- si l un est retraite (ajuste, adjusted, non gaap, pro forma) et l autre publie
Chaque libelle porte un identifiant L1, L2, L3...
Reponds UNIQUEMENT par un objet JSON {"L1": <numero>, "L2": <numero>, ...} couvrant tous les identifiants fournis.

""" 


def appelle(prompt):
    rep, moteur = appelle_moteur(prompt, json_attendu=True, temperature=0.0)
    if not isinstance(rep, dict):
        raise RuntimeError("reponse hors format (%s)" % moteur)
    return rep, moteur


def ecris_journal(chemin, lignes):
    with open(chemin, "a", encoding="utf-8") as f:
        for l in lignes:
            f.write(json.dumps(l, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="nombre de libelles libres soumis au moteur")
    ap.add_argument("--sans-moteur", action="store_true")
    ap.add_argument("--reprise", action="store_true")
    ap.add_argument("--sortie", default=SORTIE)
    ap.add_argument("--etat", default=ETAT)
    ap.add_argument("--journal", default=JOURNAL)
    ap.add_argument("--panne", action="store_true", help="simule une panne des moteurs gratuits")
    a = ap.parse_args()

    n_concepts = verifie_nomenclature()
    log("nomenclature verifiee : %d concepts, %d motifs" % (n_concepts, len(LEXIQUE)))

    infos = lis_corpus()
    log("corpus : %d libelles distincts, %d occurrences" % (len(infos), sum(e["n"] for e in infos.values())))

    etat = {"version": VERSION_ETAT, "decisions": {}, "lots_faits": 0}
    if a.reprise and os.path.exists(a.etat):
        try:
            vieux = json.load(open(a.etat))
            if vieux.get("version") == VERSION_ETAT:
                etat = vieux
                log("reprise : %d decisions deja prises, %d lots faits"
                    % (len(etat["decisions"]), etat["lots_faits"]))
            else:
                log("etat d une version anterieure ignore : reconstruction a zero")
        except Exception as e:
            log("etat illisible (%s) : reconstruction a zero" % e)

    decisions = etat["decisions"]

    # ---- passe 1 : deterministe, sans moteur ----------------------------
    alias = collections.defaultdict(list)
    familles_concept = {}
    nouveau = []
    for lib, e in infos.items():
        if lib in decisions:
            continue
        cle, fam = concept(lib)
        if cle == "VENTILATION":
            decisions[lib] = {"cle": None, "source": "ventilation"}
            nouveau.append({"libelle": lib, "cle": None, "source": "ventilation", "n": e["n"]})
        elif cle:
            decisions[lib] = {"cle": cle, "source": "lexique"}
            nouveau.append({"libelle": lib, "cle": cle, "source": "lexique", "n": e["n"],
                            "famille": e["famille"]})
    for lib, d in decisions.items():
        if d["source"] == "lexique" and lib in infos:
            alias[d["cle"]].append(lib)
            familles_concept[d["cle"]] = concept(lib)[1]
    alias_par_concept = {c: (familles_concept[c], v) for c, v in alias.items()}
    log("passe deterministe : %d rattaches, %d ventilations, %d concepts servis"
        % (sum(1 for d in decisions.values() if d["source"] == "lexique"),
           sum(1 for d in decisions.values() if d["source"] == "ventilation"),
           len(alias_par_concept)))

    # ---- passe 2 : le moteur choisit un rattachement parmi des candidats --
    libres = sorted(l for l in infos if l not in decisions)
    a_soumettre = []
    for lib in libres:
        cands = candidats(lib, alias_par_concept, infos[lib]["famille"])
        if not cands:
            decisions[lib] = {"cle": None, "source": "aucun_candidat"}
            nouveau.append({"libelle": lib, "cle": None, "source": "aucun_candidat", "n": infos[lib]["n"]})
        else:
            a_soumettre.append((lib, cands))
    log("passe moteur : %d libelles avec candidats, %d sans candidat (laisses seuls)"
        % (len(a_soumettre), sum(1 for d in decisions.values() if d["source"] == "aucun_candidat")))

    if a.limit:
        a_soumettre = a_soumettre[:a.limit]

    panne = ""
    if not a.sans_moteur and a_soumettre:
        charge_env(os.path.join(ROOT, ".env.local"))
        total = (len(a_soumettre) + LOT - 1) // LOT
        for i in range(0, len(a_soumettre), LOT):
            lot = a_soumettre[i:i + LOT]
            bloc = []
            for rang, (lib, cands) in enumerate(lot, 1):
                lignes = ["L%d. libelle : %s" % (rang, lib),
                          "    unite : %s" % (infos[lib]["unite"] or "sans unite")]
                for n, c in enumerate(cands, 1):
                    ex = ", ".join(alias_par_concept[c][1][:3])
                    lignes.append("    %d) %s  [ex : %s]" % (n, c, ex))
                lignes.append("    0) aucun de ces concepts")
                bloc.append("\n".join(lignes))
            prompt = CONSIGNE + "\n\n".join(bloc)
            if a.panne:
                panne = "panne simulee (--panne)"
                log("ARRET : %s" % panne)
                break
            try:
                rep, moteur = appelle(prompt)
            except MoteurIndisponible as e:
                panne = str(e)[:160]
                log("ARRET : aucun moteur gratuit ne repond (%s)" % panne)
                break
            except Exception as e:
                panne = str(e)[:160]
                log("ARRET : %s" % panne)
                break
            attendus = {"L%d" % r for r in range(1, len(lot) + 1)}
            hors = [k for k in rep if k not in attendus]
            if hors:
                log("%s : %d reponse(s) hors lot ignoree(s)" % (moteur, len(hors)))
            for rang, (lib, cands) in enumerate(lot, 1):
                v = rep.get("L%d" % rang)
                try:
                    num = int(str(v).strip())
                except Exception:
                    num = 0
                if 1 <= num <= len(cands):
                    cle = cands[num - 1]
                    decisions[lib] = {"cle": cle, "source": "moteur", "moteur": moteur,
                                      "candidats": cands, "choix": num}
                    nouveau.append({"libelle": lib, "cle": cle, "source": "moteur",
                                    "moteur": moteur, "candidats": cands, "choix": num,
                                    "n": infos[lib]["n"], "famille": infos[lib]["famille"]})
                else:
                    decisions[lib] = {"cle": None, "source": "moteur_refus", "moteur": moteur,
                                      "candidats": cands}
                    nouveau.append({"libelle": lib, "cle": None, "source": "moteur_refus",
                                    "moteur": moteur, "candidats": cands, "n": infos[lib]["n"]})
            etat["lots_faits"] = etat.get("lots_faits", 0) + 1
            json.dump(etat, open(a.etat, "w"), ensure_ascii=False)
            ecris_journal(a.journal, nouveau)
            nouveau = []
            log("lot %d/%d (%s)" % (i // LOT + 1, total, moteur))

    json.dump(etat, open(a.etat, "w"), ensure_ascii=False)
    if nouveau:
        ecris_journal(a.journal, nouveau)

    if panne:
        # Regle absolue : moteurs gratuits en panne, on ne touche pas a
        # src/data. L avancement reste dans .conv-state. Jamais d appel Claude.
        chemin = ecris_brouillon(
            "catalogue-a-reprendre",
            "catalogue-%s.json" % datetime.now().strftime("%Y%m%d-%H%M%S"),
            {"panne": panne,
             "decisions_prises": len(decisions),
             "a_soumettre_restant": len([l for l, _ in a_soumettre if l not in decisions]),
             "reprise": "python3 scripts/catalogue-comparabilite.py --reprise"},
        )
        log("BROUILLON A TRAITER %s : %s n a PAS ete modifie" % (chemin, a.sortie))
        return 2

    catalogue = {l: d["cle"] for l, d in sorted(decisions.items()) if d.get("cle")}
    groupes = collections.defaultdict(list)
    for l, c in catalogue.items():
        groupes[c].append(l)
    sortie = {
        "maj": datetime.now().strftime("%Y-%m-%d"),
        "nomenclature": "scripts/catalogue_nomenclature.py R1-R8",
        "libelles_corpus": len(infos),
        "libelles_ranges": len(catalogue),
        "concepts": len(groupes),
        "catalogue": catalogue,
    }
    json.dump(sortie, open(a.sortie, "w"), ensure_ascii=False, indent=0)
    log("ecrit %s : %d libelles ranges, %d concepts" % (a.sortie, len(catalogue), len(groupes)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
