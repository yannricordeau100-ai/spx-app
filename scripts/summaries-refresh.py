#!/usr/bin/env python3
"""Produit les syntheses d earnings call a partir des transcripts recuperes.

Entree  : src/data/transcripts/<ticker>.json  (latest.content)
Sortie  : src/data/transcript-summaries/<ticker>.json, schema existant
Moteur  : session Claude Code locale (claude -p), aucune cle API.

Ne regenere que si le transcript est plus recent que la synthese existante.
Usage : python3 scripts/summaries-refresh.py --tickers AAPL,MSFT
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

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


def appelle(prompt: str) -> str:
    env = dict(os.environ)
    env.setdefault("USER", os.environ.get("USER") or "yann")
    env.setdefault("LOGNAME", env["USER"])
    r = subprocess.run(
        ["claude", "-p", "--model", "sonnet", "--output-format", "text"],
        input=prompt, capture_output=True, text=True, timeout=600, env=env,
    )
    if r.returncode != 0:
        raise RuntimeError(f"claude rc={r.returncode}: {r.stderr[:200]}")
    tete = r.stdout.strip()[:200]
    if "Not logged in" in tete or "{" not in r.stdout:
        raise RuntimeError(f"reponse inexploitable : {tete[:120]}")
    return r.stdout


def json_de(brut: str) -> dict:
    m = re.search(r"\{.*\}", brut, re.S)
    if not m:
        raise ValueError("aucun JSON")
    return json.loads(m.group(0))


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
    resume = json_de(appelle(consigne(ticker, quarter, contenu)))
    if not resume.get("bullets"):
        return "synthese vide, rejetee"
    SORTIE.mkdir(parents=True, exist_ok=True)
    cible.write_text(
        json.dumps({
            "ticker": ticker,
            "quarter": quarter,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": l.get("source_url") or "transcript",
            "model": "claude-sonnet-5",
            "summary": resume,
        }, ensure_ascii=False, indent=1),
        encoding="utf8",
    )
    return f"ecrite ({len(resume['bullets'])} puces)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", required=True)
    args = ap.parse_args()
    for t in [x.strip().upper() for x in args.tickers.split(",") if x.strip()]:
        try:
            note(f"{t} : {traite(t)}")
        except Exception as e:  # noqa: BLE001
            note(f"{t} : ECHEC {type(e).__name__} {str(e)[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
