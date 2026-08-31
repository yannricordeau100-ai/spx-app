#!/usr/bin/env python3
"""Remet les accents dans les libelles de KPI affiches sur le site.

Meme principe que scripts/accents-refresh.py, applique cette fois aux fichiers
.batches-drafts-safe/kpis-haut/<TICKER>.json : ce sont eux qui alimentent les
noms de KPI, les unites et les phrases de signal vues par le visiteur. Une part
importante de ce texte a ete redigee sans accents ("Marge operationnelle",
"Flux de tresorerie", "Livraisons cumulees").

Le moteur ne recoit QUE les chaines francaises et ne peut qu ajouter des
accents : on retire les accents des deux versions et on exige qu elles soient
identiques, avec au plus deux caracteres d ecart par chaine. Toute reformulation
fait rejeter le fichier entier, qui reste alors inchange.

Le champ name_en n est jamais envoye.

Usage : python3 scripts/accents-kpis.py --tickers AAPL,MSFT
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import subprocess
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOSSIER = RACINE / ".batches-drafts-safe" / "kpis-haut"
# Champs francais affiches. name_en est volontairement exclu.
CHAMPS = ("name_fr", "short", "unit", "signal")

ACCENTS = "àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ"

# Mots francais courants qui portent un accent. Leur presence sans accent est le
# signal qu une chaine est a corriger. Liste indicative : elle sert seulement a
# decider s il faut appeler le moteur, jamais a reecrire quoi que ce soit.
INDICES = (
    "resultat|resultats|operationnel|operationnelle|operationnels|operationnelles|"
    "tresorerie|benefice|benefices|activite|activites|capacite|capacites|reseau|reseaux|"
    "depenses|developpement|remuneration|rentabilite|amelioration|donnees|unites|vehicules|"
    "energie|realise|realises|realisee|realisees|electrique|electriques|securite|sante|"
    "numerique|systemes|penetration|frequentation|abonnes|adherents|fidelite|clientele|"
    "cumule|cumulee|cumulees|cumules|deploye|deployes|integre|integres|equipements|equipes|"
    "periode|periodes|societe|societes|strategie|strategique|strategiques|qualite|interet|"
    "interets|creances|prevision|previsions|marche|marches|recurrent|recurrents|recurrente|"
    "publie|publies|publiee|acceleration|accelere|applique|appliques|generee|generes|livrees|"
    "reserve|reserves|reservations|reservees|beneficiaire|proprietaire|degre|geree|gerees|"
    "geres|reglementaire|sequentielle|expose|exposee|employes|ingenieurs|methodes|consecutifs|"
    "priorites|cle|cles|ajuste|ajustee|geopolitique|enchainent|nuitees|elevee|eleve|operateur|"
    "operateurs|decembre|fevrier|aout"
)
# Sensible a la casse : on cherche le mot ECRIT SANS accent.
RX_INDICE = re.compile(r"\b(" + INDICES + r")\b")


def note(m: str) -> None:
    print(f"[accents-kpi] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def sans_accents(t: str) -> str:
    d = unicodedata.normalize("NFD", t)
    return "".join(c for c in d if unicodedata.category(c) != "Mn").lower()


def cibles(donnees: dict) -> list[tuple[dict, str]]:
    """Couples (kpi, champ) dont la valeur est une chaine non vide."""
    out = []
    for k in donnees.get("kpis") or []:
        if not isinstance(k, dict):
            continue
        for champ in CHAMPS:
            v = k.get(champ)
            if isinstance(v, str) and v.strip():
                out.append((k, champ))
    return out


def appelle(prompt: str) -> str:
    env = dict(os.environ)
    env.setdefault("USER", os.environ.get("USER") or "yann")
    env.setdefault("LOGNAME", env["USER"])
    r = subprocess.run(
        ["claude", "-p", "--model", "sonnet", "--output-format", "text"],
        input=prompt, capture_output=True, text=True, timeout=420, env=env,
    )
    if r.returncode != 0:
        raise RuntimeError(f"claude rc={r.returncode}")
    if "Not logged in" in r.stdout[:200] or "[" not in r.stdout:
        raise RuntimeError("reponse inexploitable")
    return r.stdout


def traite(ticker: str) -> str:
    p = DOSSIER / f"{ticker.upper()}.json"
    if not p.exists():
        return "pas de fichier"
    brut_fichier = p.read_text(encoding="utf8")
    # On reecrit le fichier avec SON indentation d origine et sa fin de fichier :
    # sinon le diff couvre le fichier entier et masque la correction reelle.
    lignes = brut_fichier.split("\n")
    indent = 2
    if len(lignes) > 1:
        creux = len(lignes[1]) - len(lignes[1].lstrip(" "))
        if creux > 0:
            indent = creux
    fin = "\n" if brut_fichier.endswith("\n") else ""
    d = json.loads(brut_fichier)
    couples = cibles(d)
    if not couples:
        return "aucun champ"

    liste = [k[c] for k, c in couples]
    # On n appelle le moteur que si au moins une chaine sans accent contient un
    # mot francais qui devrait en porter un.
    # Un fichier partiellement accentue doit etre traite lui aussi : c est le
    # defaut de la premiere version, qui sautait tout fichier des lors que chaque
    # chaine portait au moins un accent, et laissait passer "flux de tresorerie"
    # au milieu d une phrase par ailleurs correcte.
    a_corriger = any(RX_INDICE.search(t) for t in liste)
    if not a_corriger:
        return "deja accentue"

    prompt = "\n".join([
        "Voici des libelles et des phrases en francais auxquels il manque les accents.",
        "Tu renvoies EXACTEMENT les memes chaines, dans le meme ordre, en ajoutant",
        "uniquement les accents et cedilles manquants.",
        "",
        "INTERDIT : traduire, changer un mot, un chiffre, une unite, une abreviation,",
        "une ponctuation, un ordre, une majuscule. Tu n ajoutes rien, tu ne retires",
        "rien, tu ne reformules rien. Les mots anglais, les sigles et les noms propres",
        "restent tels quels. Une chaine deja correcte est renvoyee identique.",
        "",
        "Reponds UNIQUEMENT par un tableau JSON de chaines, rien d autre.",
        "",
        json.dumps(liste, ensure_ascii=False),
    ])
    brut = appelle(prompt)
    m = re.search(r"\[.*\]", brut, re.S)
    if not m:
        return "ECHEC pas de tableau"
    corrige = json.loads(m.group(0))
    if not isinstance(corrige, list) or len(corrige) != len(liste):
        return "ECHEC longueur differente"

    ecarts = 0
    for avant, apres in zip(liste, corrige):
        if not isinstance(apres, str):
            return "ECHEC type inattendu"
        a, b = sans_accents(avant), sans_accents(apres)
        if a == b:
            continue
        diff = sum(1 for x in difflib.ndiff(a, b) if x[0] != " ")
        if diff > 2:
            return f"ECHEC texte modifie ({diff} caracteres d ecart), rejete"
        ecarts += 1

    changes = 0
    for (k, champ), valeur in zip(couples, corrige):
        if k[champ] != valeur:
            k[champ] = valeur
            changes += 1
    if not changes:
        return "rien a changer"
    p.write_text(json.dumps(d, ensure_ascii=False, indent=indent) + fin, encoding="utf8")
    return f"accentue ({changes} champs" + (f", {ecarts} retouches)" if ecarts else ")")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", required=True)
    args = ap.parse_args()
    for t in [x.strip().upper() for x in args.tickers.split(",") if x.strip()]:
        try:
            note(f"{t} : {traite(t)}")
        except Exception as e:  # noqa: BLE001
            note(f"{t} : ECHEC {type(e).__name__} {str(e)[:100]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
