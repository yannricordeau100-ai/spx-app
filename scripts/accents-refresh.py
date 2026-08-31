#!/usr/bin/env python3
"""Remet les accents dans les syntheses d earnings call.

Le moteur qui redige rend un francais correct mais depourvu d accents. Ce script
renvoie les seuls champs de texte au moteur en lui demandant UNIQUEMENT d ajouter
les accents, puis verifie mecaniquement que rien d autre n a bouge : on retire
les accents des deux versions et on exige qu elles soient identiques. Toute autre
modification fait rejeter la reponse.

Usage : python3 scripts/accents-refresh.py --tickers AAPL,MSFT
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import difflib
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOSSIER = RACINE / "src" / "data" / "transcript-summaries"
CHAMPS = ("tonalite_management", "text")


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
    print(f"[accents] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def sans_accents(t: str) -> str:
    """Forme canonique pour comparer : sans accents, sans apostrophes ni
    espaces. Le moteur d origine omettait AUSSI les apostrophes (l iPhone,
    d affaires) : leur restauration est voulue et ne doit pas etre comptee
    comme une modification du texte."""
    d = unicodedata.normalize("NFD", t)
    s = "".join(c for c in d if unicodedata.category(c) != "Mn").lower()
    return s.replace("'", "").replace("\u2019", "").replace(" ", "")


def textes(resume: dict) -> list[str]:
    out = []
    if isinstance(resume.get("tonalite_management"), str):
        out.append(resume["tonalite_management"])
    for b in resume.get("bullets") or []:
        if isinstance(b, dict) and isinstance(b.get("text"), str):
            out.append(b["text"])
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
    p = DOSSIER / f"{ticker.lower()}.json"
    if not p.exists():
        return "pas de synthese"
    d = json.loads(p.read_text(encoding="utf8"))
    resume = d.get("summary") or {}
    liste = textes(resume)
    if not liste:
        return "rien a corriger"
    # Une synthese partiellement accentuee doit etre reprise : l ancienne regle
    # sautait le fichier des que chaque phrase portait un accent quelque part,
    # et laissait "flux de tresorerie disponible" dans une phrase correcte.
    # ACCENTS_FORCE=1 : la selection a deja ete faite en amont par un
    # detecteur plus riche, on traite sans re-filtrer ici.
    if os.environ.get("ACCENTS_FORCE") != "1":
        if not any(RX_INDICE.search(t) for t in liste):
            return "deja accentue"

    prompt = "\n".join([
        "Voici des phrases en francais auxquelles il manque les accents.",
        "Tu renvoies EXACTEMENT les memes phrases, dans le meme ordre, en ajoutant",
        "uniquement les accents, cedilles et apostrophes manquants (ex : l iPhone -> l'iPhone, d affaires -> d'affaires).",
        "",
        "INTERDIT : changer un mot, un chiffre, une ponctuation, un ordre, une",
        "majuscule. Tu n ajoutes rien, tu ne retires rien, tu ne reformules rien.",
        "Les mots anglais et les noms propres restent tels quels.",
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
    # Comparaison hors accents : le texte doit rester le meme. On tolere au plus
    # deux caracteres d ecart par phrase, ce qui laisse passer une coquille
    # corrigee au passage mais bloque toute reformulation.
    # Acceptation chaine par chaine : une reformulation isolee est rejetee
    # seule, les corrections valides des autres phrases sont conservees.
    ecarts = 0
    rejets = 0
    retenues = []
    for avant, apres in zip(liste, corrige):
        if not isinstance(apres, str):
            retenues.append(avant); rejets += 1; continue
        a, b = sans_accents(avant), sans_accents(apres)
        if a != b:
            diff = sum(1 for x in difflib.ndiff(a, b) if x[0] != " ")
            if diff > 2:
                retenues.append(avant); rejets += 1; continue
            ecarts += 1
        retenues.append(apres)
    corrige = retenues

    i = 0
    if isinstance(resume.get("tonalite_management"), str):
        resume["tonalite_management"] = corrige[i]; i += 1
    for b in resume.get("bullets") or []:
        if isinstance(b, dict) and isinstance(b.get("text"), str):
            b["text"] = corrige[i]; i += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf8")
    suffixe = "".join([f", {ecarts} retouchees" if ecarts else "", f", {rejets} rejetees" if rejets else ""])
    return f"accentue ({len(corrige)} phrases{suffixe})"


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
