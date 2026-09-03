#!/usr/bin/env python3
"""Reevalue le positionnement IA d une societe depuis ses documents reels.

V1 valide par Yann le 30 aout 2026 : ~90 stes portent stance "absent" douteux
(47 ont pourtant des preuves renseignees) et ~10 n ont pas de bloc IA. Pour
chaque societe : lecture du texte source du data-lake (10-K / rapport annuel,
transcript s il existe), decision de stance parmi leader / integrator /
cautious / absent, resume FR et preuves. GARDE-FOU : chaque extrait cite doit
etre present verbatim dans la source, sinon la reponse est rejetee.

Usage : python3 scripts/ia-stance-refresh.py --tickers TSLA,TXN
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
MAX_CAR = 70000


def note(m: str) -> None:
    print(f"[ia-stance] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def texte_source(ticker: str) -> tuple[str, str]:
    base = RACINE / "data-lake" / ticker.upper()
    for nom in ("_srctext_60k.txt", "_srctext.txt", "_digest.txt"):
        p = base / nom
        if p.exists() and p.stat().st_size > 5000:
            return nom, p.read_text(encoding="utf8", errors="ignore")[:MAX_CAR]
    tr = RACINE / "src" / "data" / "transcripts" / f"{ticker.lower()}.json"
    if tr.exists():
        try:
            c = json.loads(tr.read_text(encoding="utf8")).get("latest", {}).get("content") or ""
            if len(c) > 5000:
                return tr.name, c[:MAX_CAR]
        except Exception:  # noqa: BLE001
            pass
    return "", ""


def normalise(t: str) -> str:
    d = unicodedata.normalize("NFD", t)
    return re.sub(r"\s+", " ", "".join(c for c in d if unicodedata.category(c) != "Mn")).lower()


def appelle(prompt: str) -> str:
    env = dict(os.environ)
    env.setdefault("USER", os.environ.get("USER") or "yann")
    env.setdefault("LOGNAME", env["USER"])
    r = subprocess.run(
        ["claude", "-p", "--model", "sonnet", "--output-format", "text"],
        input=prompt, capture_output=True, text=True, timeout=600, env=env,
    )
    if r.returncode != 0 or "Not logged in" in r.stdout[:200] or "{" not in r.stdout:
        raise RuntimeError("moteur indisponible")
    return r.stdout


def traite(ticker: str) -> str:
    nom, src = texte_source(ticker)
    if not src:
        return "aucune source"
    p = RACINE / "src" / "data" / "v2-pipeline" / f"{ticker.lower()}.json"
    if not p.exists():
        return "fiche absente"
    prompt = "\n".join([
        f"Societe : {ticker}. Source : {nom} (texte du dernier rapport officiel).",
        "",
        "Evalue le positionnement de la societe sur l intelligence artificielle.",
        "- stance : leader (l IA est au coeur de l offre), integrator (l IA est",
        "  integree aux produits ou operations), cautious (mentionnee surtout",
        "  comme risque ou observation), absent (reellement pas evoquee).",
        "- summary : 1 phrase en francais accentue, sans tiret cadratin.",
        "- evidence : 1 a 3 extraits, chacun {\"quote\": extrait EXACTEMENT",
        "  copie de la source (verbatim strict, 15 a 40 mots), \"description_fr\":",
        "  reprise en francais introduite par 'en substance :'}.",
        "- stance absent => evidence vide [].",
        "Reponds UNIQUEMENT par ce JSON :",
        '{"stance":"integrator","summary":"...","evidence":[{"quote":"...","description_fr":"..."}]}',
        "",
        "SOURCE",
        src,
    ])
    m = re.search(r"\{.*\}", appelle(prompt), re.S)
    if not m:
        return "reponse sans JSON"
    rep = json.loads(m.group(0))
    stance = rep.get("stance")
    if stance not in ("leader", "integrator", "cautious", "absent"):
        return f"stance invalide ({stance})"
    srcn = normalise(src)
    preuves = []
    for e in rep.get("evidence") or []:
        q = str(e.get("quote") or "")
        if len(q) < 40 or normalise(q) not in srcn:
            return "extrait non verbatim, rejete"
        preuves.append({
            "title": f"Mention IA ({nom})",
            "description_fr": str(e.get("description_fr") or ""),
            "text": q,
        })
    if stance != "absent" and not preuves:
        return "stance sans preuve, rejete"
    d = json.loads(p.read_text(encoding="utf8"))
    d["ai_positioning"] = {
        "stance": stance,
        "summary": str(rep.get("summary") or ""),
        "evidence": preuves,
        "source": f"Analyse Mettrik du {datetime.now(timezone.utc).date().isoformat()} ({nom})",
    }
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf8")
    return f"{stance} ({len(preuves)} preuves)"


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
