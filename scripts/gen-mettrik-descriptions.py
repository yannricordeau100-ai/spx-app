#!/usr/bin/env python3
"""
Génération bloc mettrik_description (simple FR 4 sections + advanced FR 4 sections)
pour les stés de l'univers V1.9.5 (v1-8-tickers-sorted[:307] ∪ sp500).

Output : src/data/v2-pipeline-enrich/<ticker>.mettrik-description.json
LLM : Cerebras gpt-oss-120b (free tier, 3 keys rotation).

Anti-hallucination : on fournit company_description (yfinance/SEC) + nom + secteur
au LLM, qui doit s'en tenir aux faits sourçables. Risques = risques structurels
documentés du secteur/sté (pas inventés).

Règles : FR uniquement, pas d'em-dash (—), vocabulaire Mettrik.
"""
from __future__ import annotations
import json
import os
import ssl
import sys
import time
import argparse
import urllib.request
import urllib.error
from pathlib import Path

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parent.parent
V18 = ROOT / "src/data/v1-8-tickers-sorted.json"
SP500 = ROOT / "src/data/sp500-tickers.json"
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
ENV_FILE = ROOT / ".env.local"

SIG = "subagent-mettrik-desc-2026-06-01"


def load_env() -> dict:
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def build_universe() -> list[str]:
    v18 = json.loads(V18.read_text())
    sp = json.loads(SP500.read_text())
    return sorted({t.upper() for t in v18[:307]} | {t.upper() for t in sp})


def needs_generation(ticker: str) -> bool:
    out = ENRICH / f"{ticker.lower()}.mettrik-description.json"
    return not out.exists()


PROMPT_TPL = """Tu rédiges une fiche pour Mettrik AI (plateforme KPI investisseurs).

SOCIÉTÉ :
- Nom : {name}
- Ticker : {ticker}
- Secteur : {sector}
- Sous-secteur : {subsector}
- Description officielle (source yfinance/SEC, EN) :
{desc}

MISSION : produire 2 blocs FR (jamais EN, jamais DE), structurés en sections nommées.

### Bloc "simple" (investisseur particulier débutant, ado 16 ans, ~110-150 mots)
- `activity` : 1-2 phrases sur ce que fait la société (verbe d'action concret)
- `products` : 1-2 phrases sur les produits ou services principaux (2-4 exemples cités)
- `customers` : 1-2 phrases sur qui sont ses clients (grand public, entreprises, État, etc.)
- `edge` : 1-2 phrases sur sa force ou son avantage (marque, technologie, distribution, échelle)

### Bloc "advanced" (investisseur informé, ~150-200 mots, ton factuel pro)
- `positioning` : 2-3 phrases sur sa position dans la chaîne de valeur du sous-secteur
- `tech_products` : 2-3 phrases sur ses technologies, produits clés, R&D distinctifs
- `moat` : 2-3 phrases sur ses avantages concurrentiels durables (brevets, écosystème, scale)
- `risks` : 2-3 phrases sur les risques structurels documentés propres à cette société ou son sous-secteur (concurrence directe, dépendances, exposition réglementaire, cyclicité)

RÈGLES STRICTES :
- FR uniquement, jamais EN/DE
- Interdit d'utiliser des em-dash (—). Utilise des deux-points (:) ou phrases courtes.
- Ton sérieux d'investisseur, pas marketing exubérant.
- Anti-hallucination : appuie-toi sur la description officielle ci-dessus + faits notoirement publics. N'invente pas de chiffres, de noms de dirigeants, de partenariats, de produits.
- Pour `risks` : risques sectoriels structurels documentés, pas du fud inventé.
- Phrases complètes finissant par un point.

FORMAT : JSON strict, RIEN d'autre. Pas de markdown, pas de ```json.

{{
  "simple": {{
    "fr": {{ "activity": "...", "products": "...", "customers": "...", "edge": "..." }}
  }},
  "advanced": {{
    "fr": {{ "positioning": "...", "tech_products": "...", "moat": "...", "risks": "..." }}
  }}
}}
"""


def call_cerebras(api_key: str, prompt: str, retries: int = 3) -> dict | None:
    url = "https://api.cerebras.ai/v1/chat/completions"
    payload = {
        "model": "gpt-oss-120b",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 8000,
        "temperature": 0.4,
        "reasoning_effort": "low",
        "response_format": {"type": "json_object"},
    }
    body = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as r:
                data = json.loads(r.read())
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                # Validate structure
                s = parsed.get("simple", {}).get("fr", {})
                a = parsed.get("advanced", {}).get("fr", {})
                req_s = ("activity", "products", "customers", "edge")
                req_a = ("positioning", "tech_products", "moat", "risks")
                if all(isinstance(s.get(f), str) and len(s[f].strip()) > 20 for f in req_s) and \
                   all(isinstance(a.get(f), str) and len(a[f].strip()) > 30 for f in req_a):
                    # Strip em-dashes safety net
                    for f in req_s:
                        s[f] = s[f].replace("—", " : ").replace("–", "-")
                    for f in req_a:
                        a[f] = a[f].replace("—", " : ").replace("–", "-")
                    return parsed
                return None
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(2 ** attempt + 1)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def load_source(ticker: str) -> tuple[dict | None, str | None]:
    """Returns (meta_dict, source_kind). meta_dict has name/sector/subsector/desc."""
    p = PIPELINE / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            return {
                "name": d.get("name") or ticker,
                "sector": d.get("sector") or "?",
                "subsector": d.get("subsector") or "?",
                "desc": (d.get("company_description") or d.get("tagline") or "")[:2500],
            }, "v2-pipeline"
        except Exception:
            pass
    # Fallback : existing .description.json (EN content)
    fp = ENRICH / f"{ticker.lower()}.description.json"
    if fp.exists():
        try:
            d = json.loads(fp.read_text())
            en_simple = d.get("simple", {}).get("en", {})
            desc_parts = [en_simple.get(k, "") for k in ("activity", "products", "customers", "edge")]
            desc = " ".join([p for p in desc_parts if p])[:2500]
            return {
                "name": ticker,
                "sector": "?",
                "subsector": "?",
                "desc": desc,
            }, "description-en"
        except Exception:
            pass
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Limit number of tickers (0=all)")
    ap.add_argument("--sleep", type=float, default=1.5)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    env = load_env()
    keys = [env[k] for k in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY") if env.get(k)]
    if not keys:
        print("ERR: no Cerebras keys")
        sys.exit(1)
    print(f"[INFO] {len(keys)} Cerebras keys", file=sys.stderr)

    universe = build_universe()
    targets = []
    for t in universe:
        if args.force or needs_generation(t):
            targets.append(t)
    targets = targets[args.start:]
    if args.limit > 0:
        targets = targets[:args.limit]
    print(f"[INFO] universe={len(universe)} to_generate={len(targets)}", file=sys.stderr)

    ENRICH.mkdir(parents=True, exist_ok=True)

    ok = 0
    fail = 0
    nosource = 0
    for i, ticker in enumerate(targets):
        meta, kind = load_source(ticker)
        if not meta or not meta["desc"] or len(meta["desc"]) < 50:
            nosource += 1
            print(f"[{i+1}/{len(targets)}] {ticker} : no source skip", file=sys.stderr)
            continue

        prompt = PROMPT_TPL.format(
            name=meta["name"], ticker=ticker,
            sector=meta["sector"], subsector=meta["subsector"],
            desc=meta["desc"],
        )
        key = keys[i % len(keys)]
        result = call_cerebras(key, prompt)
        if not result:
            fail += 1
            print(f"[{i+1}/{len(targets)}] {ticker} : LLM fail", file=sys.stderr)
            time.sleep(args.sleep)
            continue

        payload = {
            "ticker": ticker,
            "mettrik_description": {
                "simple": result["simple"],
                "advanced": result["advanced"],
            },
            "_mettrik_desc_signed_by": SIG,
            "_generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "_model": "cerebras-gpt-oss-120b",
            "_source_kind": kind,
            "_source_fields": ["name", "sector", "subsector", "company_description"],
        }
        out = ENRICH / f"{ticker.lower()}.mettrik-description.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        ok += 1
        if ok <= 3 or ok % 20 == 0:
            print(f"[{i+1}/{len(targets)}] {ticker} OK : {result['simple']['fr']['activity'][:70]}", file=sys.stderr)
        time.sleep(args.sleep)

    print(f"[DONE] ok={ok} fail={fail} no_source={nosource} total={len(targets)}", file=sys.stderr)


if __name__ == "__main__":
    main()
