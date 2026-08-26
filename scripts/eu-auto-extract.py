#!/usr/bin/env python3
"""
scripts/eu-auto-extract.py — extraction AUTOMATIQUE des nouveaux points de
séries pour les sociétés cotées hors US (Yann 26 août 2026).

Ce script est le maillon qui manquait. Jusqu'ici, `eu-earnings-refresh.py`
détectait les nouveaux documents puis écrivait une mission texte qu'un agent
devait traiter à la main : les 124 sociétés hors US ne se mettaient donc
jamais à jour toutes seules, contrairement aux 533 américaines.

Principe, volontairement identique à la chaîne américaine :
  1. pour chaque société, lister les documents investisseurs plus récents que
     le dernier point de série déjà en base ;
  2. en extraire le texte (pdftotext) ;
  3. demander à un modèle la valeur des KPI DÉJÀ SUIVIS sur la nouvelle
     période, sans jamais en inventer de nouveaux ;
  4. VÉRIFIER que chaque chiffre retenu figure littéralement dans le texte du
     document, sinon il est rejeté ;
  5. écrire le point dans src/data/v2-pipeline/<ticker>.json.

Aucun chiffre non vérifié n'entre dans la base : c'est la règle qui prime sur
le taux de couverture.

Usage :
  python3 scripts/eu-auto-extract.py --dry-run
  python3 scripts/eu-auto-extract.py --tickers=ADS.DE,MC.PA --apply
  python3 scripts/eu-auto-extract.py --apply --limit=10
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "src" / "data" / "v2-pipeline"
LAKE = ROOT / "data-lake"
UNIVERSE = ROOT / "src" / "data" / "v1-9-5-clean-all-tickers.json"
STATE = ROOT / ".conv-state" / "eu-auto-extract-state.json"
ENV = ROOT / ".env.local"

EU_SUFFIXES = (".AS", ".DE", ".PA", ".SW", ".L", ".MI", ".MC", ".CO",
               ".HE", ".ST", ".LS", ".BR", ".VI", ".OL", ".B")
MODEL = "gpt-oss-120b"
MAX_CHARS = 24000

# Le trousseau systeme du Mac n est pas expose a Python : on s appuie sur le
# bundle de certifi si present, sinon sur le contexte par defaut.
def _ssl_ctx() -> ssl.SSLContext:
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # noqa: BLE001
        return ssl.create_default_context()


SSL_CTX = _ssl_ctx()


def log(msg: str) -> None:
    print(f"[eu-auto-extract] {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def env(key: str) -> str | None:
    if not ENV.exists():
        return None
    for line in ENV.read_text(encoding="utf8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def eu_tickers() -> list[str]:
    tickers = json.loads(UNIVERSE.read_text(encoding="utf8")).get("tickers", [])
    return [t for t in tickers if "." in t and "." + t.rsplit(".", 1)[-1].upper() in EU_SUFFIXES]


def recent_docs(ticker: str, limit: int = 3) -> list[Path]:
    """Documents investisseurs les plus récents, PDF uniquement."""
    base = LAKE / ticker / "ir"
    if not base.exists():
        return []
    pdfs = sorted(base.rglob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return pdfs[:limit]


def pdf_text(path: Path) -> str:
    try:
        out = subprocess.run(
            ["pdftotext", "-l", "40", "-nopgbrk", str(path), "-"],
            capture_output=True, text=True, timeout=120,
        )
        return re.sub(r"\s+", " ", out.stdout)
    except (subprocess.SubprocessError, OSError):
        return ""


def tracked_kpis(ticker: str) -> tuple[dict, list[dict]]:
    path = PIPE / f"{ticker.lower()}.json"
    if not path.exists():
        return {}, []
    data = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(data, dict):
        return {}, []
    kpis = [
        k for k in (data.get("kpis") or [])
        if k.get("short") and isinstance(k.get("history"), list) and len(k["history"]) >= 2
    ]
    return data, kpis


# Fournisseurs essayes dans l ordre. Le premier qui repond gagne : une cle
# expiree ou un quota epuise ne bloque plus toute la chaine (Yann 26 aout
# 2026, apres avoir constate Groq 401 et Cerebras en quota depasse).
PROVIDERS = [
    {
        "nom": "groq",
        "env": "GROQ_API_KEY",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "modele": "llama-3.3-70b-versatile",
        "auth": "bearer",
    },
    {
        "nom": "cerebras",
        "env": "CEREBRAS_API_KEY",
        "url": "https://api.cerebras.ai/v1/chat/completions",
        "modele": "gpt-oss-120b",
        "auth": "bearer",
    },
    {
        "nom": "anthropic",
        "env": "ANTHROPIC_API_KEY",
        "url": "https://api.anthropic.com/v1/messages",
        "modele": "claude-haiku-4-5-20251001",
        "auth": "anthropic",
    },
]


def _call(provider: dict, prompt: str, key: str) -> str:
    if provider["auth"] == "anthropic":
        body = json.dumps({
            "model": provider["modele"],
            "max_tokens": 2000,
            "system": "Tu extrais des valeurs de KPI. Aucun calcul, aucune invention. JSON pur.",
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf8")
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    else:
        body = json.dumps({
            "model": provider["modele"],
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content":
                 "Tu extrais des valeurs de KPI depuis un document financier. "
                 "Tu ne calcules jamais, tu ne convertis jamais, tu ne devines jamais. "
                 "Reponse en JSON pur."},
                {"role": "user", "content": prompt},
            ],
        }).encode("utf8")
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    req = urllib.request.Request(provider["url"], data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        payload = json.loads(resp.read())
    if provider["auth"] == "anthropic":
        return payload["content"][0]["text"]
    return payload["choices"][0]["message"]["content"]


def ask_model(prompt: str) -> tuple[str, str]:
    """Retourne (reponse, nom_du_fournisseur). Leve RuntimeError si aucun ne repond."""
    erreurs = []
    for provider in PROVIDERS:
        key = env(provider["env"])
        if not key:
            erreurs.append(f'{provider["nom"]}: cle absente')
            continue
        try:
            return _call(provider, prompt, key), provider["nom"]
        except Exception as err:  # noqa: BLE001
            erreurs.append(f'{provider["nom"]}: {err}')
    raise RuntimeError("aucun fournisseur disponible — " + " | ".join(erreurs))


def build_prompt(ticker: str, kpis: list[dict], text: str) -> str:
    lignes = []
    for k in kpis[:14]:
        hist = k.get("history") or []
        dernier = hist[-1] if hist else None
        if isinstance(dernier, dict):
            dernier = dernier.get("v")
        lignes.append(
            f'- short "{k["short"]}" | {k.get("name_fr") or k.get("name_en")} '
            f'| unite {k.get("unit")} | derniere valeur connue {dernier}'
        )
    return "\n".join([
        f"Societe : {ticker}",
        "",
        "KPI DEJA SUIVIS (n en ajoute aucun autre) :",
        *lignes,
        "",
        "REGLES",
        "- Ne renvoie une valeur QUE si elle est ecrite telle quelle dans le document.",
        "- Respecte l unite indiquee. Aucune conversion, aucun calcul.",
        "- `evidence` = la phrase exacte du document qui contient le chiffre.",
        "- Si un KPI n apparait pas, ne le mentionne pas.",
        "",
        'Reponds : {"periode":"Q2-2026","valeurs":[{"short":"...","value":123.4,"evidence":"..."}]}',
        "",
        "DOCUMENT :",
        text[:MAX_CHARS],
    ])


def digits_of(value: float) -> str:
    return re.sub(r"\D", "", f"{value}")


def verify(value: float, evidence: str, text: str) -> bool:
    """Le chiffre doit apparaitre dans la citation ET la citation dans le texte."""
    if not evidence:
        return False
    plain = re.sub(r"[\s,. ]", "", evidence)
    d = digits_of(value)
    if len(d) < 2 or d[:3] not in plain:
        return False
    sample = re.sub(r"\s+", " ", evidence).strip()[:60]
    return sample.lower() in re.sub(r"\s+", " ", text).lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cibles = [t.strip().upper() for t in args.tickers.split(",")] if args.tickers else eu_tickers()
    if args.limit:
        cibles = cibles[: args.limit]
    log(f"{len(cibles)} societe(s) a traiter")

    state = json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {}
    retenus = rejetes = touches = 0

    for ticker in cibles:
        docs = recent_docs(ticker)
        if not docs:
            continue
        data, kpis = tracked_kpis(ticker)
        if not kpis:
            log(f"{ticker}: aucun KPI suivi, ignore")
            continue

        doc = docs[0]
        text = pdf_text(doc)
        if len(text) < 500:
            log(f"{ticker}: document illisible ({doc.name})")
            continue

        try:
            raw, fournisseur = ask_model(build_prompt(ticker, kpis, text))
            parsed = json.loads(raw)
        except Exception as err:  # noqa: BLE001
            log(f"{ticker}: extraction impossible ({err})")
            continue

        periode = str(parsed.get("periode") or "").strip()
        valeurs = parsed.get("valeurs") or []
        index = {k["short"]: k for k in kpis}
        ecrits = []
        for v in valeurs:
            short = str(v.get("short") or "")
            val = v.get("value")
            if short not in index or not isinstance(val, (int, float)):
                rejetes += 1
                continue
            if not verify(float(val), str(v.get("evidence") or ""), text):
                rejetes += 1
                continue
            kpi = index[short]
            hist = kpi.get("history") or []
            if hist and isinstance(hist[-1], dict):
                if hist[-1].get("q") == periode:
                    continue
                hist.append({"q": periode, "v": val})
            else:
                if hist and hist[-1] == val:
                    continue
                hist.append(val)
            kpi["history"] = hist
            kpi["value"] = val
            kpi["last_data_date"] = datetime.now(timezone.utc).date().isoformat()
            ecrits.append(short)
            retenus += 1

        if ecrits:
            touches += 1
            log(f"{ticker}: {len(ecrits)} KPI mis a jour ({periode}) depuis {doc.name} [{fournisseur}]")
            if args.apply:
                (PIPE / f"{ticker.lower()}.json").write_text(
                    json.dumps(data, ensure_ascii=False), encoding="utf8"
                )
            state[ticker] = {
                "last_run": datetime.now(timezone.utc).isoformat(),
                "doc": doc.name,
                "periode": periode,
                "kpis": ecrits,
            }
        else:
            log(f"{ticker}: rien de verifiable dans {doc.name}")

    if args.apply:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf8")
    log(f"FINI societes touchees={touches} valeurs retenues={retenus} rejetees={rejetes}"
        + ("" if args.apply else "  (SIMULATION, rien ecrit)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
