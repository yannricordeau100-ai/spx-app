#!/usr/bin/env python3
"""
enrich-ai-positioning-cerebras.py — extrait `ai_positioning` (stance +
3-5 evidences) pour les stés V1.7 Pass 3 strict qui en manquent, via
Cerebras Llama 3.3 70B (gratuit, 30 req/min).

Stratégie :
  1. Lire `src/data/v1-7-blocks-audit.json` → liste des MISSING_AI_POSITIONING
  2. Pour chaque ticker, charger le dernier 10-K local depuis
     `~/spx-app/sec-data/cat1-us/<ticker>/10K/<year>/<file>.txt.gz`
     (ou variantes cat 2 / cat 3).
  3. Extraire les passages "AI / artificial intelligence / machine learning"
     via regex (max 8000 chars de contexte).
  4. Envoyer à Cerebras avec le prompt stance-evidence (cf. pipeline-llm-pass2).
  5. Merger le résultat dans `v2-pipeline-enrich/<ticker>.json` (sans
     écraser CONV-DATA dans v2-pipeline/).

Usage :
    python3 scripts/enrich-ai-positioning-cerebras.py [--limit N] [--force]

Idempotent : skip si <ticker>.json a déjà ai_positioning rempli (sauf --force).
Single proc, ~2 sec/sté → ~20 min pour 563 stés. Sans pression Mac (pas de
parallèle). Quota Cerebras 30 req/min, on plafonne à 25 par sécurité.
"""

import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
AUDIT = PROJECT_ROOT / "src/data/v1-7-blocks-audit.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC = PROJECT_ROOT / "sec-data"


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def _strip_html(html: str) -> str:
    """Strip HTML tags + decode entities, garde le texte."""
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"&lt;", "<", txt)
    txt = re.sub(r"&gt;", ">", txt)
    txt = re.sub(r"&#\d+;|&[a-z]+;", " ", txt)
    txt = re.sub(r"\s+", " ", txt)
    return txt


def find_10k_text(ticker: str) -> str | None:
    """
    Layout réel sec-data : `cat1-us/10K/<year>/<TICKER>_<date>.htm.gz`
    (pas `<ticker>/10K/<year>/`). On scanne les années récentes en
    décroissant et on prend le 1er fichier matchant le ticker.
    """
    tu = ticker.upper()
    candidates_dirs = [
        SEC / "cat1-us" / "10K",
        SEC / "cat2-foreign-adr" / "20F",
        SEC / "cat2-foreign-adr" / "10K",
        SEC / "cat3-european" / "AnnualReport",
    ]
    for base in candidates_dirs:
        if not base.exists():
            continue
        years = sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)
        for year_dir in years[:5]:  # 5 dernières années
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        html = g.read()
                    return _strip_html(html)
                except Exception:
                    continue
            for f in year_dir.glob(f"{tu}_*.txt.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return g.read()
                except Exception:
                    continue
    return None


# Extrait les passages mentionnant l'IA / AI / artificial intelligence
AI_PATTERN = re.compile(
    r"(artificial\s+intelligence|machine\s+learning|generative\s+ai|"
    r"\bai\b\s+(model|technology|capabilit|product|service|infrastructure)|"
    r"large\s+language\s+model|\bllm\b|deep\s+learning|"
    r"intelligence\s+artificielle)",
    re.IGNORECASE,
)


def extract_ai_context(text: str, max_chars: int = 8000) -> str:
    """
    Cherche les mentions IA dans le 10-K (HTML stripped) et extrait des
    fenêtres de contexte autour. Le HTML stripped n'a généralement pas de
    \\n\\n donc on travaille sur des windows de chars.
    """
    if not text:
        return ""
    matches = list(AI_PATTERN.finditer(text))
    if not matches:
        return ""
    # Dédup par position (overlap entre matches consécutifs)
    windows: list[tuple[int, int]] = []
    WINDOW_BEFORE = 400
    WINDOW_AFTER = 800
    for m in matches:
        start = max(0, m.start() - WINDOW_BEFORE)
        end = min(len(text), m.end() + WINDOW_AFTER)
        if windows and start <= windows[-1][1]:
            # Merge avec la window précédente
            windows[-1] = (windows[-1][0], max(windows[-1][1], end))
        else:
            windows.append((start, end))
    chunks = []
    total = 0
    for s, e in windows:
        chunk = re.sub(r"\s+", " ", text[s:e]).strip()
        chunks.append(chunk)
        total += len(chunk)
        if total >= max_chars:
            break
    return "\n\n---\n\n".join(chunks)[:max_chars]


CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
PROMPT_TEMPLATE = """Tu es un analyste investisseur. Lis ces extraits du 10-K de {ticker} et extrais le positionnement IA de la société.

Extraits :
{context}

Renvoie UNIQUEMENT un JSON valide, sans aucun autre texte :
{{
  "stance": "leader|integrator|cautious|absent",
  "evidence": ["…", "…", "…"],
  "summary": "1-2 phrases en français résumant le positionnement IA",
  "source": "10-K {year}"
}}

Définitions stance :
- leader : développe ses propres modèles IA et les vend (ou les rend dispo à grande échelle)
- integrator : utilise l'IA en interne ou intégrée à ses produits
- cautious : mention défensive (risque concurrence, cyber, etc.)
- absent : pas de mention significative

evidence = 3 à 5 phrases citation directe de l'extrait (en anglais ou la langue du 10-K).
Si stance = absent, evidence peut être vide [].
Pas d'invention. Si rien dans les extraits, stance=absent et summary explicite.
"""


def _try_provider(url: str, model: str, prompt: str, api_key: str) -> dict | None:
    is_anthropic = "anthropic" in url
    if is_anthropic:
        body = json.dumps({
            "model": model,
            "max_tokens": 800,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
        }).encode()
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    else:
        body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
        }).encode()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
            resp = json.loads(r.read())
        if is_anthropic:
            content = resp.get("content", [{}])[0].get("text", "")
        else:
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", content, re.DOTALL)
            if m:
                return json.loads(m.group(0))
            return None
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {"_rate_limited": True}
        return None
    except Exception:
        return None


def call_llm(prompt: str, providers: list[tuple[str, str, str]]) -> dict | None:
    """
    Essaie une liste de (url, model, key) dans l'ordre. Renvoie le premier
    JSON valide non-rate-limited. Permet de basculer Cerebras → Groq → Cerebras2…
    quand un provider sature ou refuse.
    """
    for url, model, key in providers:
        if not key:
            continue
        result = _try_provider(url, model, prompt, key)
        if result and not result.get("_rate_limited"):
            return result
        if result and result.get("_rate_limited"):
            time.sleep(2)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    # Priorité Anthropic Haiku 4.5 (reliable) > Groq (rate-limited Cloudflare)
    # > Cerebras (free tier).
    providers = [
        (ANTHROPIC_URL, "claude-haiku-4-5-20251001", os.environ.get("ANTHROPIC_API_KEY", "")),
        (GROQ_URL, "llama-3.3-70b-versatile", os.environ.get("GROQ_API_KEY", "")),
        (CEREBRAS_URL, "llama3.3-70b", os.environ.get("CEREBRAS_API_KEY", "")),
        (CEREBRAS_URL, "llama3.3-70b", os.environ.get("CEREBRAS2_API_KEY", "")),
        (CEREBRAS_URL, "llama3.3-70b", os.environ.get("CEREBRAS3_API_KEY", "")),
    ]
    providers = [p for p in providers if p[2]]
    if not providers:
        print("❌ Aucune clé LLM dispo", file=sys.stderr)
        sys.exit(1)
    print(f"🤖 Providers actifs : {[p[1] for p in providers]}")

    if not AUDIT.exists():
        print(f"❌ {AUDIT} introuvable. Lance d'abord audit-v17-blocks.ts", file=sys.stderr)
        sys.exit(1)
    audit = json.loads(AUDIT.read_text())

    pending_all = [t for t, flags in audit.items() if "MISSING_AI_POSITIONING" in flags]

    # Skip si déjà fait avec un VRAI résultat dans enrich. Les stés
    # marquées stance=absent par défaut (10-K introuvable) restent à retry
    # quand sec-data se complète. Les stés avec evidence non vide sont OK.
    pending = []
    for t in pending_all:
        out_path = ENR / f"{t.lower()}.json"
        if out_path.exists() and not args.force:
            try:
                existing = json.loads(out_path.read_text())
                ai = existing.get("ai_positioning")
                if ai and (ai.get("evidence") or ai.get("stance") in ("leader", "integrator", "cautious")):
                    continue
            except Exception:
                pass
        pending.append(t)

    if args.limit:
        pending = pending[: args.limit]
    print(f"📊 AI positioning Cerebras : {len(pending)} stés à enrichir")

    written = 0
    no_ctx = 0
    no_resp = 0

    last_call = 0.0
    for i, t in enumerate(pending):
        # Rate limit 25/min (cap sous le 30 free tier)
        elapsed = time.time() - last_call
        if elapsed < 2.4:
            time.sleep(2.4 - elapsed)
        last_call = time.time()

        text = find_10k_text(t)
        ctx = extract_ai_context(text or "")
        if not ctx:
            no_ctx += 1
            # Encore on écrit stance=absent pour ne pas re-tenter
            ai = {
                "stance": "absent",
                "evidence": [],
                "summary": "Aucune mention IA significative dans le 10-K disponible.",
                "source": "10-K (auto)",
            }
        else:
            full = PIPELINE / f"{t.lower()}.json"
            year = "n/a"
            try:
                full_data = json.loads(full.read_text())
                year = str(full_data.get("_filing_year") or full_data.get("ipo") or "n/a")
            except Exception:
                pass
            prompt = PROMPT_TEMPLATE.format(ticker=t, context=ctx, year=year)
            ai = call_llm(prompt, providers)
            if not ai or not ai.get("stance"):
                no_resp += 1
                continue

        out_path = ENR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        existing["ai_positioning"] = ai
        existing["_ai_positioning_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1

        if (i + 1) % 20 == 0:
            print(f"  …{i+1}/{len(pending)} (ok={written}, no_ctx={no_ctx}, no_resp={no_resp})")

    print(f"\n✅ {written} stés enrichies, {no_ctx} sans 10-K (stance=absent défaut), {no_resp} sans réponse LLM")


if __name__ == "__main__":
    main()
