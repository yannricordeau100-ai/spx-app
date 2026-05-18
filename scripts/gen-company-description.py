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
V17_PUBLIC = ROOT / "src/data/v1-7-public.json"
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


PROMPT_TEMPLATE = """Tu rédiges la fiche "Comprendre la société" pour Mettrik AI (KPI Intelligence pour investisseurs).

SOCIÉTÉ :
- Ticker : {ticker}
- Nom : {name}
- Secteur : {sector}
- Sous-secteur : {subsector}
- Hero KPI suivi : {hero_kpi}
- Tagline officielle (EN) : {tagline}

OBJECTIF : produire 2 versions (simple + avancée) × 3 langues (fr, en, de), chacune ORGANISÉE en sections nommées. PAS un pavé en prose, PAS deux pauvres lignes. Une fiche dense, structurée, qui donne envie de lire.

### VERSION 1 — "simple"
PUBLIC : investisseur particulier qui découvre la société, niveau ado 16 ans, non-technique. Mots simples, phrases courtes, pas de jargon.
Structure : 4 sections, 1-2 phrases courtes chacune (~110-150 mots total par langue).
- `activity` : Ce que fait la société, en une phrase percutante.
- `products` : Ses produits ou services principaux concrets (cite 2-4 exemples connus).
- `customers` : Qui sont ses clients principaux (grand public, entreprises, gouvernement, etc.) et ce qu'ils achètent.
- `edge` : Ce qui la rend unique/forte vu de loin. Réponse à : pourquoi un débutant devrait-il s'y intéresser ?

### VERSION 2 — "advanced"
PUBLIC : investisseur informé, connaît le secteur, ne veut PAS la même description que tous les concurrents. Précis, factuel, niveau pro.
Structure : 4 sections, 1-3 phrases chacune (~150-200 mots total par langue).
- `positioning` : Position précise dans la chaîne de valeur du sous-secteur. Mention des concurrents directs et de la place vs eux.
- `tech_products` : Technologies, produits, marques concrètes qui distinguent cette sté. Ex NVDA = CUDA + Hopper/Blackwell + DGX. Ex AMD = Ryzen + EPYC + x86. Ex AVGO = Jericho/Tomahawk + VMware. Pas de définition générique.
- `moat` : Avantages concurrentiels DURABLES (verrous technologiques, brevets, distribution captive, intégration verticale, switching cost). Précis et vérifiable.
- `risks` : 1-2 faiblesses concurrentielles ou risques structurels propres à CETTE société (pas le risque sectoriel générique). Honnête.

CONTRAINTES STRICTES (les 2 versions) :
- PAS d'em-dash ("—" interdit). Utilise ":" ou phrases courtes.
- PAS marketing exubérant. Ton sérieux, factuel d'investisseur.
- Pas d'éloge gratuite. La section `edge` (simple) et `moat` (advanced) doit être prouvable.
- Phrases complètes propres, finit toujours par un point.

FORMAT RÉPONSE : JSON strict, RIEN d'autre. Pas de markdown autour, pas de ```json. Juste l'objet ci-dessous.

{{
  "simple": {{
    "fr": {{ "activity": "...", "products": "...", "customers": "...", "edge": "..." }},
    "en": {{ "activity": "...", "products": "...", "customers": "...", "edge": "..." }},
    "de": {{ "activity": "...", "products": "...", "customers": "...", "edge": "..." }}
  }},
  "advanced": {{
    "fr": {{ "positioning": "...", "tech_products": "...", "moat": "...", "risks": "..." }},
    "en": {{ "positioning": "...", "tech_products": "...", "moat": "...", "risks": "..." }},
    "de": {{ "positioning": "...", "tech_products": "...", "moat": "...", "risks": "..." }}
  }}
}}
"""


def call_cerebras(api_key: str, prompt: str, model: str = "llama3.1-8b", retries: int = 3) -> dict | None:
    """Cerebras fallback quand Gemini 429 daily quota."""
    url = "https://api.cerebras.ai/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2500,
        "temperature": 0.6,
        "response_format": {"type": "json_object"},
    }
    body = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0 Safari/537.36",
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as r:
                data = json.loads(r.read())
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                simple = parsed.get("simple", {})
                advanced = parsed.get("advanced", {})
                sf = ("activity", "products", "customers", "edge")
                af = ("positioning", "tech_products", "moat", "risks")
                ok = True
                for lang in ("fr", "en", "de"):
                    s = simple.get(lang, {})
                    a = advanced.get(lang, {})
                    if not all(isinstance(s.get(f), str) and s[f].strip() for f in sf):
                        ok = False; break
                    if not all(isinstance(a.get(f), str) and a[f].strip() for f in af):
                        ok = False; break
                if ok:
                    return parsed
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 ** attempt)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def call_gemini(api_key: str, prompt: str, retries: int = 3) -> dict | None:
    """Gemini 2.5 Flash via REST API. Retourne dict {fr,en,de} ou None.
    Free tier : 1500 req/jour/clé. Multilingue natif, fiable."""
    # Yann 14 mai 2026 : gemini-2.5-flash-lite a un RPM bien plus haut sur
    # free tier (30 vs 10) → drastiquement moins de 429.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.6,
            "maxOutputTokens": 4000,
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
                # Validation : simple {fr,en,de}{activity,products,customers,edge}
                # + advanced {fr,en,de}{positioning,tech_products,moat,risks}
                simple = parsed.get("simple", {})
                advanced = parsed.get("advanced", {})
                simple_fields = ("activity", "products", "customers", "edge")
                advanced_fields = ("positioning", "tech_products", "moat", "risks")
                ok = True
                for lang in ("fr", "en", "de"):
                    s = simple.get(lang, {})
                    a = advanced.get(lang, {})
                    if not all(isinstance(s.get(f), str) and s[f].strip() for f in simple_fields):
                        ok = False; break
                    if not all(isinstance(a.get(f), str) and a[f].strip() for f in advanced_fields):
                        ok = False; break
                if ok:
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
    ap.add_argument("--source", choices=["v18", "v17"], default="v18",
                    help="v18 = top 307 (default), v17 = univers complet 1597 stés Pass 3")
    args = ap.parse_args()

    env = load_env()
    keys = [env[k] for k in ("GEMINI_API_KEY", "GEMINI_API_KEYS_NEWS") if env.get(k)]
    cerebras_keys = [env[k] for k in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY") if env.get(k)]
    if not keys:
        print("ERR: aucune clé Gemini dans .env.local")
        sys.exit(1)
    print(f"Clés Gemini : {len(keys)}, Cerebras fallback : {len(cerebras_keys)}")

    if args.source == "v17":
        # Univers V1.7 Pass 3 strict (1597 stés actuellement)
        v17 = json.loads(V17_PUBLIC.read_text())
        tickers = list(v17.keys())
        print(f"Source : V1.7 public ({len(tickers)} stés Pass 3)")
    else:
        tickers = json.loads(V18_TICKERS.read_text())
        print(f"Source : V1.8 top ({len(tickers)} stés)")
    if args.all:
        targets = tickers if args.source == "v17" else tickers[:307]
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
        # Fallback Cerebras si Gemini 429 daily quota
        if not result and cerebras_keys:
            ck = cerebras_keys[i % len(cerebras_keys)]
            print(f"  ↩ fallback Cerebras llama3.1-8b...")
            result = call_cerebras(ck, prompt, model="llama3.1-8b")
        if not result:
            fail += 1
            print(f"  ✗ échec")
            continue

        payload = {
            "ticker": ticker,
            "simple": result["simple"],
            "advanced": result["advanced"],
            "_generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "_model": "gemini-2.5-flash-lite",
            "_schema": "v2-sections",
            "_source_fields": ["name", "sector", "subsector", "hero_kpi", "tagline"],
        }
        out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        ok += 1
        print(f"  ✓ simple FR activity: {result['simple']['fr']['activity'][:80]}...")
        time.sleep(args.sleep)

    print()
    print(f"=== Bilan : {ok} ok, {fail} fail, {skipped} skip ===")


if __name__ == "__main__":
    main()
