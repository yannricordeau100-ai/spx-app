#!/usr/bin/env python3
"""
Générateur de descriptions société "PV Mettrik" multilingues.

Yann 14 mai 2026 : résumé sté dans la langue de la page (FR/EN/DE pour
commencer, NL/SV/DA/IT/ES si on étend). Pas un copier-coller de Wikipédia,
inclut un angle distinctif (PV Mettrik) tout en restant compréhensible
par un débutant.

Format : 40-60 mots, sans em-dash, niveau 16 ans non-technique.

Output : `src/data/v2-pipeline-enrich/<ticker>.description.json`
         { ticker, fr, en, de, generated_at, model, source_fields }

RAM-light : 1 seul proc, sleep 4s entre stés (Cerebras 30 req/min/key,
2 langues par appel = 1 appel par sté en JSON multi-lang).

Usage :
  python3 scripts/gen-company-description.py             # top 5 POC
  python3 scripts/gen-company-description.py --top 50    # top 50 V1.8
  python3 scripts/gen-company-description.py --all       # tous V1.8 top 307
"""
from __future__ import annotations
import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# macOS Python SSL : utiliser ssl context permissif (data publique).
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parent.parent
V18_TICKERS = ROOT / "src/data/v1-8-tickers-sorted.json"
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
ENV_FILE = ROOT / ".env.local"


def load_env() -> dict[str, str]:
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


PROMPT_TEMPLATE = """Tu rédiges DEUX descriptions de la société pour l'app Mettrik AI (KPI Intelligence pour investisseurs).

SOCIÉTÉ :
- Ticker : {ticker}
- Nom : {name}
- Secteur : {sector}
- Sous-secteur : {subsector}
- Hero KPI : {hero_kpi}
- Tagline officielle (EN) : {tagline}

DEUX VERSIONS À PRODUIRE, en 3 langues (fr, en, de) chacune :

### VERSION 1 — "simple"
PUBLIC : investisseur particulier de 16 ans, non-technique.
OBJECTIF : comprendre en 10 secondes ce que fait la société et sa PV (plus-value distinctive).
- Longueur : 40-60 mots par langue.
- Style : mots simples, phrases courtes, pas de jargon.
- Phrase 1 : ce que fait la société, comme on l'expliquerait à un ado.
- Phrase 2 : sa PV, son angle distinctif vu de "loin" (= ce que tout le monde devrait savoir).

### VERSION 2 — "avance"
PUBLIC : investisseur informé qui connaît déjà le secteur et les concurrents directs.
OBJECTIF : préciser POURQUOI cette société est différente de ses concurrents directs. NE PAS répéter ce qu'on dirait pour TOUTES les sociétés du sous-secteur. Exemple : pour NVIDIA, mentionner CUDA + architecture Hopper/Blackwell + position datacenter ; pour AMD, mentionner positionnement x86 + Ryzen/EPYC + valeur prix-perf. Pas la même définition générique "fabricant de puces".
- Longueur : 50-80 mots par langue (un peu plus dense).
- Style : précis, mention de produits/technos/marchés concrets propres à cette société.
- Phrase 1 : positionnement précis dans la chaîne de valeur de son sous-secteur.
- Phrase 2 : 1-2 leviers stratégiques propres à cette société (technos, brevets, marchés captés, intégration verticale, distribution, etc.).

CONTRAINTES STRICTES (les deux versions) :
- PAS d'em-dash ("—" interdit). Utilise ":" ou phrases courtes séparées.
- PAS exubérant, PAS original au point de surprendre. Ressembler à du sérieux d'investisseur, pas du marketing.
- Pas d'éloge gratuite. Si la société a des faiblesses notoires dans son sous-secteur, on les évoque dans la version avancée.

FORMAT RÉPONSE : JSON strict, RIEN d'autre. Pas de markdown, pas de ```json. Juste l'objet.

{{
  "simple": {{ "fr": "...", "en": "...", "de": "..." }},
  "advanced": {{ "fr": "...", "en": "...", "de": "..." }}
}}
"""


def call_gemini(api_key: str, prompt: str, retries: int = 3) -> dict | None:
    """Gemini 2.5 Flash via REST API. Retourne dict {fr,en,de} ou None.
    Free tier : 1500 req/jour/clé. Multilingue natif, fiable."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.6,
            "maxOutputTokens": 2000,
            "thinkingConfig": {"thinkingBudget": 0},  # désactive thinking (Gemini 2.5)
        },
    }
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
                data = json.loads(r.read())
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(content)
                # Validation : simple + advanced, chacun avec fr/en/de
                simple = parsed.get("simple", {})
                advanced = parsed.get("advanced", {})
                if (
                    all(isinstance(simple.get(k), str) and simple[k].strip() for k in ("fr", "en", "de"))
                    and all(isinstance(advanced.get(k), str) and advanced[k].strip() for k in ("fr", "en", "de"))
                ):
                    return parsed
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** attempt
                print(f"  429 rate-limit, sleep {wait}s")
                time.sleep(wait)
                continue
            print(f"  HTTPError {e.code}: {e.reason}")
            return None
        except Exception as e:
            print(f"  err: {e}")
            time.sleep(2)
            continue
    return None


def build_prompt(ticker: str) -> str | None:
    path = PIPELINE_DIR / f"{ticker.lower()}.json"
    if not path.exists():
        return None
    try:
        d = json.loads(path.read_text())
    except Exception:
        return None
    name = d.get("name") or ticker
    sector = d.get("sector") or "?"
    subsector = d.get("subsector") or "?"
    hero_kpi = d.get("hero_kpi") or "?"
    tagline = d.get("tagline") or ""
    return PROMPT_TEMPLATE.format(
        ticker=ticker,
        name=name,
        sector=sector,
        subsector=subsector,
        hero_kpi=hero_kpi,
        tagline=tagline,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=5, help="Nombre de stés à traiter")
    ap.add_argument("--all", action="store_true", help="V1.8 top 307 complet")
    ap.add_argument("--force", action="store_true", help="Re-générer même si déjà fait")
    ap.add_argument("--sleep", type=float, default=4.0)
    ap.add_argument("--start-from", type=int, default=0, help="Offset")
    args = ap.parse_args()

    env = load_env()
    keys = [env[k] for k in ("GEMINI_API_KEY", "GEMINI_API_KEYS_NEWS") if env.get(k)]
    if not keys:
        print("ERR: aucune clé Gemini dans .env.local")
        sys.exit(1)
    print(f"Clés Gemini : {len(keys)}")

    tickers = json.loads(V18_TICKERS.read_text())
    if args.all:
        targets = tickers[:307]
    else:
        targets = tickers[args.start_from:args.start_from + args.top]

    ENRICH_DIR.mkdir(parents=True, exist_ok=True)

    ok = 0
    fail = 0
    skipped = 0
    for i, ticker in enumerate(targets):
        out_path = ENRICH_DIR / f"{ticker.lower()}.description.json"
        if out_path.exists() and not args.force:
            skipped += 1
            print(f"[{i+1}/{len(targets)}] {ticker} : déjà fait, skip")
            continue

        prompt = build_prompt(ticker)
        if not prompt:
            fail += 1
            print(f"[{i+1}/{len(targets)}] {ticker} : pas de dataset pipeline, skip")
            continue

        key = keys[i % len(keys)]
        print(f"[{i+1}/{len(targets)}] {ticker} : génération...")
        result = call_gemini(key, prompt)
        if not result:
            fail += 1
            print(f"  ✗ échec")
            continue

        payload = {
            "ticker": ticker,
            "simple": {
                "fr": result["simple"]["fr"].strip(),
                "en": result["simple"]["en"].strip(),
                "de": result["simple"]["de"].strip(),
            },
            "advanced": {
                "fr": result["advanced"]["fr"].strip(),
                "en": result["advanced"]["en"].strip(),
                "de": result["advanced"]["de"].strip(),
            },
            "_generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "_model": "gemini-2.5-flash",
            "_source_fields": ["name", "sector", "subsector", "hero_kpi", "tagline"],
        }
        out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        ok += 1
        print(f"  ✓ simple FR: {result['simple']['fr'][:60]}...")
        print(f"  ✓ avancée FR: {result['advanced']['fr'][:60]}...")
        time.sleep(args.sleep)

    print()
    print(f"=== Bilan : {ok} ok, {fail} fail, {skipped} skip ===")


if __name__ == "__main__":
    main()
