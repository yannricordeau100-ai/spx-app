#!/usr/bin/env python3
"""Synthese d un trimestre depuis le COMMUNIQUE DE RESULTATS officiel.

Pour les societes dont le transcript d earnings call n est pas publie
(Motley Fool lacunaire, decision Yann du 30 aout 2026) : la synthese est
generee depuis le communique de resultats (ER/8-K du data-lake), marquee
"source": "earnings_release", et le bloc de la page l affiche comme telle.
HONNETETE ABSOLUE : jamais presentee comme un call, aucune citation du
management qui ne soit pas ecrite verbatim dans le communique.

N ecrase une synthese existante que si elle couvre un trimestre plus ancien.
Quand un vrai transcript arrive plus tard, le cron de 23h reprend la main.

Usage : python3 scripts/summaries-from-er.py --tickers GOOGL,JNJ
"""
from __future__ import annotations

import argparse
import gzip
import ssl
import urllib.request
import importlib.util
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
SORTIE = RACINE / "src" / "data" / "transcript-summaries"
MAX_CAR = 60000

_spec = importlib.util.spec_from_file_location(
    "er", RACINE / "scripts" / "earnings-refresh.py"
)
_er = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_er)


def note(m: str) -> None:
    print(f"[syntheses-er] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)


def consigne(ticker: str, contenu: str) -> str:
    return "\n".join([
        f"Societe : {ticker}.",
        "",
        "Tu produis la synthese du dernier COMMUNIQUE DE RESULTATS officiel de la",
        "societe (pas d un earnings call : le transcript n est pas disponible).",
        "Public : investisseurs francophones.",
        "",
        "REGLES",
        "- Francais soigne, vocabulaire non technique, aucun tiret cadratin.",
        "- Chaque puce s appuie sur le communique. Aucun chiffre invente.",
        "- Chiffres a la francaise : 111,2 Mds $ et non $111.2B.",
        "- 7 a 10 puces, une a trois phrases chacune, denses.",
        "- `type` : synthesis, driver, guidance, strategy, vigilance ou citation.",
        "  Une seule synthesis en premier. Au moins une vigilance.",
        "- `citation` UNIQUEMENT si la phrase est ecrite VERBATIM dans le",
        "  communique (declaration attribuee au dirigeant). Sinon aucune citation.",
        "- `terms_used` : 1 a 4 expressions exactes du communique fondant la puce.",
        "- `sentiment` : bullish, neutral ou bearish, d apres le contenu.",
        "- `tonalite_management` : une a deux phrases sur le ton du communique",
        "  (jamais presente comme le ton d un call).",
        "- `periode` : le trimestre couvert, format 2026Q2, lu dans le document.",
        "",
        "Reponds UNIQUEMENT par ce JSON :",
        '{"periode":"2026Q2","tonalite_management":"...","sentiment":"bullish",'
        '"bullets":[{"text":"...","type":"synthesis","terms_used":["..."]}]}',
        "",
        "COMMUNIQUE",
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
    if r.returncode != 0 or "Not logged in" in r.stdout[:200] or "{" not in r.stdout:
        raise RuntimeError(f"moteur indisponible ({r.stdout.strip()[:80]})")
    return r.stdout


try:
    import certifi
    _CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # pragma: no cover
    _CTX = ssl.create_default_context()

RE_ACCESSION = re.compile(r"_(\d{10})-(\d{2})-(\d{6})\.htm")


def complete_depot(ticker: str, chemin: Path) -> Path | None:
    """Un 8-K de resultats archive avant le correctif du 28 aout n a que sa
    page de couverture : les chiffres sont dans l exhibit 99.1, jamais
    telecharge. On recupere le depot COMPLET aupres d EDGAR, on l ajoute au
    data-lake, et la synthese se fait dessus."""
    m = RE_ACCESSION.search(chemin.name)
    if not m:
        return None
    cik = int(m.group(1))
    acc = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    cible = chemin.parent / f"{chemin.name.split('_0')[0]}_complet.txt.gz"
    if cible.exists():
        return cible
    url = (f"https://www.sec.gov/Archives/edgar/data/{cik}/"
           f"{acc.replace('-', '')}/{acc}.txt")
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mettrik research yannricordeau100@gmail.com"}
        )
        with urllib.request.urlopen(req, timeout=90, context=_CTX) as r:
            contenu = r.read()
        with gzip.open(cible, "wb") as gz:
            gz.write(contenu)
        return cible
    except Exception:  # noqa: BLE001
        return None


RE_RESULTATS = re.compile(
    r"(results of operations and financial condition|announces? (its )?(financial )?results"
    r"|quarterly report|earnings release|resultats (trimestriels|semestriels|annuels)"
    r"|chiffre d affaires|net revenues?|total revenues?|revenue of)",
    re.I,
)


def traite(ticker: str) -> str:
    # Un 8-K peut annoncer autre chose que des resultats (emission obligataire,
    # dirigeant...). On prend le PREMIER document recent qui parle de resultats.
    candidats = []
    for chemin in _er.documents(ticker)[:6]:
        texte = _er.read_document(chemin)
        if len(texte) < 2000 or not RE_RESULTATS.search(texte[:60000]):
            continue
        # Page de couverture seule : aller chercher le depot complet sur EDGAR.
        if len(texte) < 15000 and "Results of Operations" in texte:
            complet = complete_depot(ticker, chemin)
            if complet is not None:
                texte = _er.read_document(complet)
                chemin = complet
        if len(texte) >= 15000:
            candidats.append((chemin.name, texte))
    if not candidats:
        return "aucun communique de resultats exploitable"
    nom, contenu = candidats[0]
    m = re.search(r"\{.*\}", appelle(consigne(ticker, contenu)), re.S)
    if not m:
        return "reponse sans JSON"
    resume = json.loads(m.group(0))
    periode = str(resume.pop("periode", "") or "").strip().upper()
    # tolerances de forme : Q2-2026, 2026-Q2, FY2026Q2...
    m2 = re.search(r"(20\d\d).{0,3}Q([1-4])|Q([1-4]).{0,3}(20\d\d)", periode)
    if m2:
        periode = f"{m2.group(1) or m2.group(4)}Q{m2.group(2) or m2.group(3)}"
    if not re.fullmatch(r"20\d\dQ[1-4]", periode):
        return f"periode illisible ({periode})"
    if not resume.get("bullets"):
        return "synthese vide, rejetee"
    cible = SORTIE / f"{ticker.lower()}.json"
    if cible.exists():
        try:
            anc = str(json.loads(cible.read_text(encoding="utf8")).get("quarter") or "")
            if anc >= periode:
                return f"deja a jour ({anc})"
        except Exception:  # noqa: BLE001
            pass
    SORTIE.mkdir(parents=True, exist_ok=True)
    cible.write_text(
        json.dumps({
            "ticker": ticker.upper(),
            "quarter": periode,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "earnings_release",
            "source_document": nom,
            "model": "claude-sonnet-5",
            "summary": resume,
        }, ensure_ascii=False, indent=1),
        encoding="utf8",
    )
    return f"ecrite depuis {nom} ({periode}, {len(resume['bullets'])} puces)"


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
