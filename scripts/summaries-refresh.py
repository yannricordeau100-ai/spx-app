#!/usr/bin/env python3
"""Produit les syntheses d earnings call a partir des transcripts recuperes.

Entree  : src/data/transcripts/<ticker>.json  (latest.content)
Sortie  : src/data/transcript-summaries/<ticker>.json, schema existant
Moteur  : moteurs GRATUITS (Cerebras, puis Groq, puis Gemini) via
          scripts/moteur_gratuit.py. Jamais Claude : une tache automatique
          serait facturee au compte connecte au hasard du moment.
          Si aucun moteur ne repond, un brouillon part dans .conv-state et
          RIEN n est ecrit dans src/data.

Ne regenere que si le transcript est plus recent que la synthese existante.
Usage : python3 scripts/summaries-refresh.py --tickers AAPL,MSFT
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from moteur_gratuit import (  # noqa: E402
    MoteurIndisponible, appelle as appelle_moteur, charge_env, ecris_brouillon,
)

RACINE = Path(__file__).resolve().parents[1]
TRANS = RACINE / "src" / "data" / "transcripts"
SORTIE = RACINE / "src" / "data" / "transcript-summaries"
MAX_CAR = 90000


def note(m: str) -> None:
    print(f"[syntheses] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def consigne(ticker: str, quarter: str, contenu: str) -> str:
    return "\n".join([
        f"Societe : {ticker}. Trimestre : {quarter}.",
        "",
        "Tu produis la synthese de cet earnings call pour des investisseurs francophones.",
        "",
        "REGLES",
        "- Francais soigne et accentue, vocabulaire non technique, aucun tiret cadratin.",
        "- Chaque puce s appuie sur ce qui est dit dans le transcript. Aucun chiffre invente.",
        "- Les chiffres sont ecrits a la francaise : 111,2 Mds $ et non $111.2B.",
        "- 8 a 10 puces. Chaque puce fait une a trois phrases, dense, sans remplissage.",
        "- `type` vaut synthesis, driver, guidance, strategy, vigilance ou citation.",
        "  Une seule synthesis, placee en premier. Au moins une vigilance.",
        "- `terms_used` liste 1 a 4 expressions exactes du transcript qui fondent la puce.",
        "- `sentiment` vaut bullish, neutral ou bearish.",
        "- `tonalite_management` fait une a deux phrases sur le ton et ce qui le justifie.",
        "",
        "Reponds UNIQUEMENT par ce JSON, sans texte autour :",
        '{"tonalite_management":"...","sentiment":"bullish",'
        '"bullets":[{"text":"...","type":"synthesis","terms_used":["..."]}]}',
        "",
        "TRANSCRIPT",
        contenu[:MAX_CAR],
    ])


TYPES = {"synthesis", "driver", "guidance", "strategy", "vigilance", "citation"}
SENTIMENTS = {"bullish", "neutral", "bearish"}


def appelle(prompt: str) -> tuple[dict, str]:
    """Moteurs gratuits uniquement. Leve MoteurIndisponible si tous echouent."""
    donnees, moteur = appelle_moteur(prompt, json_attendu=True, temperature=0.0)
    if not isinstance(donnees, dict):
        raise ValueError("reponse hors format (pas un objet JSON)")
    return donnees, moteur


def json_de(brut: str) -> dict:
    m = re.search(r"\{.*\}", brut, re.S)
    if not m:
        raise ValueError("aucun JSON")
    return json.loads(m.group(0))


def _plat(texte: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (texte or "").lower())


def controle(resume: dict, contenu: str):
    """Controle renforce du 23 sept 2026, effectue PUCE PAR PUCE.

    Un moteur gratuit invente plus volontiers qu un grand modele. Le controle
    decisif est celui des expressions citees : chacune doit se lire dans le
    transcript, sinon la puce ne s appuie sur rien et elle est RETIREE. Une
    puce douteuse ne part jamais sur une fiche. Si trop de puces tombent, ou si
    la structure exigee n est plus tenue, la synthese entiere est rejetee.

    `resume` est modifie sur place (puces retirees). Rend (motif, retirees) :
    motif vide quand la synthese est acceptable.
    """
    puces = resume.get("bullets")
    if not isinstance(puces, list) or not 6 <= len(puces) <= 14:
        return "nombre de puces hors bornes (6 a 14 attendues)", 0
    if str(resume.get("sentiment") or "").lower() not in SENTIMENTS:
        return "sentiment hors liste", 0
    if not isinstance(resume.get("tonalite_management"), str) or len(resume["tonalite_management"]) < 20:
        return "tonalite du management absente ou trop courte", 0
    plat = _plat(contenu)
    gardees = []
    for b in puces:
        if not isinstance(b, dict):
            continue
        texte = b.get("text")
        if not isinstance(texte, str) or not 30 <= len(texte) <= 600:
            continue
        b["text"] = texte.replace("\u2014", ", ").replace("\u2013", ", ")
        if str(b.get("type") or "").lower() not in TYPES:
            continue
        b["type"] = str(b["type"]).lower()
        termes = b.get("terms_used")
        if not isinstance(termes, list) or not 1 <= len(termes) <= 6:
            continue
        # Toutes les expressions citees doivent se lire dans le transcript.
        if any(not isinstance(x, str) or len(x.strip()) < 3 or _plat(x).strip() not in plat
               for x in termes):
            continue
        gardees.append(b)
    retirees = len(puces) - len(gardees)
    types = [b["type"] for b in gardees]
    if len(gardees) < 6:
        return "%d puce(s) verifiee(s) seulement sur %d" % (len(gardees), len(puces)), retirees
    if types.count("synthesis") != 1 or types[0] != "synthesis":
        return "il faut une seule synthesis, placee en premier", retirees
    if "vigilance" not in types:
        return "aucune vigilance apres verification", retirees
    resume["bullets"] = gardees
    return "", retirees


EXPORT = ""
IMPORT = ""


def traite(ticker: str) -> str:
    src = TRANS / f"{ticker.lower()}.json"
    if not src.exists():
        return "pas de transcript"
    d = json.loads(src.read_text(encoding="utf8"))
    l = d.get("latest") or {}
    contenu = l.get("content") or ""
    if len(contenu) < 3000:
        return "transcript trop court"
    quarter = f"{l.get('year')}Q{l.get('quarter')}"
    cible = SORTIE / f"{ticker.lower()}.json"
    if cible.exists():
        try:
            anc = json.loads(cible.read_text(encoding="utf8")).get("quarter") or ""
            if str(anc) >= quarter:
                return "deja a jour"
        except Exception:  # noqa: BLE001
            pass
    # 15 sept 2026 : mode sans moteur local (prompts exportes, reponses importees)
    if EXPORT:
        Path(EXPORT).mkdir(parents=True, exist_ok=True)
        (Path(EXPORT) / f"{ticker}.prompt.txt").write_text(consigne(ticker, quarter, contenu), encoding="utf8")
        return "prompt exporte"
    prompt = consigne(ticker, quarter, contenu)
    if IMPORT:
        rep = Path(IMPORT) / f"{ticker}.json"
        if not rep.exists():
            return "reponse absente"
        resume, moteur = json_de(rep.read_text(encoding="utf8")), "import"
    else:
        try:
            resume, moteur = appelle(prompt)
        except MoteurIndisponible as e:
            # Regle absolue : aucun appel Claude ici. On depose le prompt en
            # brouillon, on n ecrit RIEN dans src/data, et on le signale.
            chemin = ecris_brouillon("syntheses-a-traiter", f"{ticker}.prompt.txt", prompt)
            return f"BROUILLON A TRAITER {chemin} (moteurs gratuits indisponibles : {str(e)[:60]})"
    motif, retirees = controle(resume, contenu)
    if motif:
        chemin = ecris_brouillon(
            "syntheses-a-traiter", f"{ticker}.rejet.json",
            {"ticker": ticker, "quarter": quarter, "moteur": moteur,
             "motif": motif, "reponse_rejetee": resume},
        )
        return f"REJETEE ({motif}) : brouillon {chemin}, rien ecrit dans src/data"
    SORTIE.mkdir(parents=True, exist_ok=True)
    cible.write_text(
        json.dumps({
            "ticker": ticker,
            "quarter": quarter,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": l.get("source_url") or "transcript",
            "model": moteur,
            "summary": resume,
        }, ensure_ascii=False, indent=1),
        encoding="utf8",
    )
    return (f"ecrite ({len(resume['bullets'])} puces, {retirees} retiree(s) "
            f"faute de preuve, moteur {moteur})")


def main() -> int:
    global EXPORT, IMPORT
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", required=True)
    ap.add_argument("--export", default="")
    ap.add_argument("--import-dir", default="")
    args = ap.parse_args()
    EXPORT, IMPORT = args.export, args.import_dir
    charge_env(str(RACINE / ".env.local"))
    for t in [x.strip().upper() for x in args.tickers.split(",") if x.strip()]:
        try:
            note(f"{t} : {traite(t)}")
        except Exception as e:  # noqa: BLE001
            note(f"{t} : ECHEC {type(e).__name__} {str(e)[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
