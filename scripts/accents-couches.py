#!/usr/bin/env python3
"""Remet les accents dans les couches stories, risques, positionnement IA.

Troisieme volet de la serie accents (apres accents-refresh.py pour les
syntheses d earnings et accents-kpis.py pour les libelles KPI). Couvre :

  - src/data/v2-pipeline-enrich/<t>.json : stories_kpis[] (name_fr, unit,
    signal, explanation, description) et company_description ;
  - src/data/v2-pipeline/<t>.json : risks[] (title, summary, score_rationale),
    ai_positioning (summary, evidence[].title, evidence[].description_fr),
    tagline.

Meme garde-fou que les deux autres : le moteur ne peut qu ajouter des accents,
le texte est verifie identique hors accents (deux caracteres d ecart toleres
par chaine), le format du fichier (indentation, fin) est preserve, et tout
ecart fait rejeter le fichier entier.

Usage : python3 scripts/accents-couches.py --tickers AAPL,MSFT
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
ENRICH = RACINE / "src" / "data" / "v2-pipeline-enrich"
PIPELINE = RACINE / "src" / "data" / "v2-pipeline"

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
    "operateurs|decembre|fevrier|aout|decrit|penalise|reglementation|liee|lies|liees|dependance|"
    "concurrentiel|concurrentielle|premiere|derniere|matiere|matieres|croissance|annee|annees|"
    "barrieres|differencie|modele|modeles|procedures|generation|deja|etre|meme|tres|apres"
)
# Sensible a la casse : on cherche le mot ECRIT SANS accent.
RX_INDICE = re.compile(r"\b(" + INDICES + r")\b")

CH_STORY = ("name_fr", "unit", "signal", "explanation", "description")
CH_RISK = ("title", "summary", "score_rationale")
CH_EVID = ("title", "description_fr")


def note(m: str) -> None:
    print(f"[accents-couches] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def sans_accents(t: str) -> str:
    d = unicodedata.normalize("NFD", t)
    return "".join(c for c in d if unicodedata.category(c) != "Mn").lower()


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


def cibles_enrich(d: dict) -> list[tuple[dict, str]]:
    out = []
    for s in d.get("stories_kpis") or []:
        if isinstance(s, dict):
            for c in CH_STORY:
                if isinstance(s.get(c), str) and s[c].strip():
                    out.append((s, c))
    if isinstance(d.get("company_description"), str) and d["company_description"].strip():
        out.append((d, "company_description"))
    return out


def cibles_pipeline(d: dict) -> list[tuple[dict, str]]:
    out = []
    for r in d.get("risks") or []:
        if isinstance(r, dict):
            for c in CH_RISK:
                if isinstance(r.get(c), str) and r[c].strip():
                    out.append((r, c))
    ai = d.get("ai_positioning")
    if isinstance(ai, dict):
        if isinstance(ai.get("summary"), str) and ai["summary"].strip():
            out.append((ai, "summary"))
        for e in ai.get("evidence") or []:
            if isinstance(e, dict):
                for c in CH_EVID:
                    if isinstance(e.get(c), str) and e[c].strip():
                        out.append((e, c))
    if isinstance(d.get("tagline"), str) and d["tagline"].strip():
        out.append((d, "tagline"))
    return out


def corrige_fichier(p: Path, collecteur) -> str:
    if not p.exists():
        return "pas de fichier"
    brut_fichier = p.read_text(encoding="utf8")
    lignes = brut_fichier.split("\n")
    compact = "\n" not in brut_fichier.strip()
    indent = 2
    if not compact and len(lignes) > 1:
        creux = len(lignes[1]) - len(lignes[1].lstrip(" "))
        if creux > 0:
            indent = creux
    fin = "\n" if brut_fichier.endswith("\n") else ""
    d = json.loads(brut_fichier)
    couples = collecteur(d)
    if not couples:
        return "aucun champ"
    liste = [o[c] for o, c in couples]
    if not any(RX_INDICE.search(t) for t in liste):
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
    # Acceptation chaine par chaine : une reponse qui reformule UNE phrase ne
    # doit pas faire perdre les corrections valides des autres. La chaine
    # fautive garde son texte d origine et est comptee rejetee.
    ecarts = 0
    rejets = 0
    retenues: list[str] = []
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
    changes = 0
    for (o, c), v in zip(couples, retenues):
        if o[c] != v:
            o[c] = v
            changes += 1
    if not changes:
        return "rien a changer"
    if compact:
        p.write_text(json.dumps(d, ensure_ascii=False) + fin, encoding="utf8")
    else:
        p.write_text(json.dumps(d, ensure_ascii=False, indent=indent) + fin, encoding="utf8")
    suffixe = "".join([f", {ecarts} retouches" if ecarts else "", f", {rejets} rejetees" if rejets else ""])
    return f"accentue ({changes} champs{suffixe})"


def traite(ticker: str) -> str:
    t = ticker.lower()
    r1 = corrige_fichier(ENRICH / f"{t}.json", cibles_enrich)
    r2 = corrige_fichier(PIPELINE / f"{t}.json", cibles_pipeline)
    return f"enrich={r1} | pipeline={r2}"


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
