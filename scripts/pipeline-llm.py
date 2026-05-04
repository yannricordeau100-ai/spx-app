#!/usr/bin/env python3
"""
Pipeline LLM — extraction KPI structurée pour V2.

Workflow par société :
  1. Charge template KPI du secteur (kpi-templates-by-gics.json)
  2. Charge overrides user (kpi-overrides.ts → eval simplifié)
  3. Extrait sections clés du dernier 10-K/20-F + dernier ER 8-K/6-K
  4. Build prompt LLM (template + sections + schéma JSON strict)
  5. Call LLM avec rotation multi-provider (Groq → Cerebras → Gemini)
  6. Parse + valide JSON output
  7. Écrit src/data/v2-pipeline/<ticker>.json
  8. Cache hash content → skip si rerun

Usage :
    python3 scripts/pipeline-llm.py --ticker AAPL,MSFT [--cat 1|2]
    python3 scripts/pipeline-llm.py --batch top20cat1
    python3 scripts/pipeline-llm.py --all
"""

import argparse
import asyncio
import gzip
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = PROJECT_ROOT / "src/lib/kpi-templates-by-gics.json"
OVERRIDES_PATH = PROJECT_ROOT / "src/lib/kpi-overrides.ts"
OUTPUT_DIR = PROJECT_ROOT / "src/data/v2-pipeline"
CACHE_DIR = PROJECT_ROOT / ".pipeline-cache"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/pipeline-llm.log"

CAT1_DIR = Path("/Volumes/250GB/Mettrik/sec-data/cat1-us")
CAT2_DIR = Path("/Volumes/250GB/Mettrik/sec-data/cat2-foreign-adr")

# Top 20 cat 1 (US) — par market cap 2024-2025, hors META + GOOGL (V1)
TOP20_CAT1 = [
    "AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "AVGO", "JPM", "WMT",
    "LLY", "UNH", "V", "XOM", "MA", "ORCL", "JNJ", "HD", "PG", "BAC",
]

# Top 20 cat 2 (FPI) — hors TSM + ASML + NVO (déjà raffinées V2)
TOP20_CAT2 = [
    "BABA", "SAP", "SHEL", "TM", "SE", "HSBC", "BP",
    "NVS", "AZN", "RY", "SHOP", "HDB", "UL", "TD", "RIO", "BHP", "SNY",
]

# Mapping sector approx pour les top stés (à enrichir par LLM si manquant)
SECTOR_GUESS = {
    "AAPL": "Information Technology",  "MSFT": "Information Technology",
    "NVDA": "Information Technology",  "AMZN": "Consumer Discretionary",
    "TSLA": "Consumer Discretionary",  "AVGO": "Information Technology",
    "JPM":  "Financials",              "WMT":  "Consumer Staples",
    "LLY":  "Healthcare",              "UNH":  "Healthcare",
    "V":    "Financials",              "XOM":  "Energy",
    "MA":   "Financials",              "ORCL": "Information Technology",
    "JNJ":  "Healthcare",              "HD":   "Consumer Discretionary",
    "PG":   "Consumer Staples",        "BAC":  "Financials",
    "BABA": "Communication Services",  "SAP":  "Information Technology",
    "SHEL": "Energy",                  "TM":   "Industrials",
    "SE":   "Communication Services",  "HSBC": "Financials",
    "BP":   "Energy",                  "NVS":  "Healthcare",
    "AZN":  "Healthcare",              "RY":   "Financials",
    "SHOP": "Information Technology",  "HDB":  "Financials",
    "UL":   "Consumer Staples",        "TD":   "Financials",
    "RIO":  "Materials",               "BHP":  "Materials",
    "SNY":  "Healthcare",
}

# ─────────────────────────────────────────────────────────────────────
# Providers LLM (rotation)
# ─────────────────────────────────────────────────────────────────────
PROVIDERS = []  # rempli au démarrage selon clés dispo


def load_env():
    """Charge .env.local en variables d'environnement."""
    env_file = PROJECT_ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ[k.strip()] = v.strip().strip('"').strip("'")


async def call_groq(prompt: str, system: str = "") -> str:
    """Appel Groq Llama 3.3 70B."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"Groq error: {data}")
            return data["choices"][0]["message"]["content"]


# Cerebras paid tier : qwen-3-235b ~$0.60/M input + $1.20/M output (estim, à ajuster avec usage réel)
# ~1500-2000 tok/s = 6-8× plus rapide que Gemini/Groq
CEREBRAS_PRICE_IN_PER_M = 0.60
CEREBRAS_PRICE_OUT_PER_M = 1.20
CEREBRAS_BUDGET_USD = float(os.environ.get("CEREBRAS_BUDGET_USD", "48.0"))  # buffer $2 vs $50
_cerebras_spent_usd = 0.0
_cerebras_calls = 0
_cerebras_in_tok = 0
_cerebras_out_tok = 0


def cerebras_spend_summary() -> str:
    pct = (_cerebras_spent_usd / CEREBRAS_BUDGET_USD * 100) if CEREBRAS_BUDGET_USD > 0 else 0
    return (
        f"[Cerebras spend] {_cerebras_calls} calls | "
        f"in={_cerebras_in_tok:,} | out={_cerebras_out_tok:,} | "
        f"${_cerebras_spent_usd:.4f} / ${CEREBRAS_BUDGET_USD:.2f} ({pct:.1f}%)"
    )


class CerebrasBudgetExceeded(Exception):
    pass


async def call_cerebras_with_key(prompt: str, system: str, key: str) -> str:
    global _cerebras_spent_usd, _cerebras_calls, _cerebras_in_tok, _cerebras_out_tok
    if _cerebras_spent_usd >= CEREBRAS_BUDGET_USD:
        avg = (_cerebras_spent_usd / _cerebras_calls) if _cerebras_calls > 0 else 0.02
        raise CerebrasBudgetExceeded(
            f"Budget Cerebras atteint : ${_cerebras_spent_usd:.4f} / ${CEREBRAS_BUDGET_USD:.2f}\n"
            f"  → {_cerebras_calls} calls | coût moyen ${avg:.4f}/call (~${avg*4:.4f}/sté)\n"
            f"  → Pour 100 stés de plus : ~${avg*4*100:.2f}\n"
            f"  → Pour 1000 stés de plus : ~${avg*4*1000:.2f}"
        )
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.cerebras.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": "qwen-3-235b-a22b-instruct-2507",  # paid tier Cerebras, 1500-2000 tok/s
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"Cerebras error: {data}")
            usage = data.get("usage", {})
            in_t = usage.get("prompt_tokens", 0)
            out_t = usage.get("completion_tokens", 0)
            cost = (in_t * CEREBRAS_PRICE_IN_PER_M + out_t * CEREBRAS_PRICE_OUT_PER_M) / 1_000_000
            _cerebras_calls += 1
            _cerebras_in_tok += in_t
            _cerebras_out_tok += out_t
            _cerebras_spent_usd += cost
            return data["choices"][0]["message"]["content"]


async def call_cerebras(prompt: str, system: str = "") -> str:
    return await call_cerebras_with_key(prompt, system, os.environ["CEREBRAS_API_KEY"])


async def call_cerebras2(prompt: str, system: str = "") -> str:
    return await call_cerebras_with_key(prompt, system, os.environ["CEREBRAS2_API_KEY"])


async def call_cerebras3(prompt: str, system: str = "") -> str:
    """Cerebras3 = clé PAYANTE ($50 deposit). Pas de rate limit, max throughput."""
    return await call_cerebras_with_key(prompt, system, os.environ["CEREBRAS3_API_KEY"])


async def call_sambanova(prompt: str, system: str = "") -> str:
    """SambaNova Cloud — Llama 3.3 70B free tier généreux."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.sambanova.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['SAMBANOVA_API_KEY']}"},
            json={
                "model": "Meta-Llama-3.3-70B-Instruct",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"SambaNova error: {data}")
            return data["choices"][0]["message"]["content"]




async def call_together_with_key(prompt: str, system: str, key: str) -> str:
    """Together AI — Llama 3.3 70B Turbo (free $25 crédit)."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"Together error: {data}")
            return data["choices"][0]["message"]["content"]


async def call_together(prompt: str, system: str = "") -> str:
    return await call_together_with_key(prompt, system, os.environ["TOGETHER_AI"])


async def call_together2(prompt: str, system: str = "") -> str:
    return await call_together_with_key(prompt, system, os.environ["TOGETHER2_AI"])


async def call_together3(prompt: str, system: str = "") -> str:
    return await call_together_with_key(prompt, system, os.environ["TOGETHER3_AI"])


async def call_nvidia_with_key(prompt: str, system: str, key: str) -> str:
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": "meta/llama-3.3-70b-instruct",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"NVIDIA error: {data}")
            return data["choices"][0]["message"]["content"]


async def call_nvidia(prompt: str, system: str = "") -> str:
    return await call_nvidia_with_key(prompt, system, os.environ["NVIDIA_API_KEY"])


async def call_nvidia2(prompt: str, system: str = "") -> str:
    return await call_nvidia_with_key(prompt, system, os.environ["NVIDIA2_API_KEY"])


async def call_github_models(prompt: str, system: str = "") -> str:
    """GitHub Models — GPT-4o-mini gratuit pour devs."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://models.inference.ai.azure.com/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['GITHUB_MODELS_KEY']}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"GitHub Models error: {data}")
            return data["choices"][0]["message"]["content"]


async def call_fireworks(prompt: str, system: str = "") -> str:
    """Fireworks AI — Llama 3.3 70B (free $1 crédit). max_tokens 4096 max sans stream."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.fireworks.ai/inference/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['FIREWORKS_AI']}"},
            json={
                "model": "accounts/fireworks/models/llama-v3p3-70b-instruct",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 4000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"Fireworks error: {data}")
            return data["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────
# Gemini 2.5 Flash-Lite — provider PAYANT principal (~$0.018/sté pour 4 passes)
# Pricing : $0.10/M input + $0.40/M output (pas de thinking activé)
# Garde-fou : hard stop si cumulative cost > GEMINI_BUDGET_USD
# ─────────────────────────────────────────────────────────────────────────
GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_PRICE_IN_PER_M = 0.10   # USD per 1M input tokens
GEMINI_PRICE_OUT_PER_M = 0.40  # USD per 1M output tokens
GEMINI_BUDGET_USD = float(os.environ.get("GEMINI_BUDGET_USD", "48.0"))  # hard cap = $48 (buffer $2 vs $50 réel)
_gemini_spent_usd = 0.0
_gemini_calls = 0
_gemini_in_tok = 0
_gemini_out_tok = 0
_gemini_avg_cost_per_call = 0.0  # mis à jour dynamiquement


def gemini_spend_summary() -> str:
    pct = (_gemini_spent_usd / GEMINI_BUDGET_USD * 100) if GEMINI_BUDGET_USD > 0 else 0
    return (
        f"[Gemini spend] {_gemini_calls} calls | "
        f"in={_gemini_in_tok:,} | out={_gemini_out_tok:,} | "
        f"${_gemini_spent_usd:.4f} / ${GEMINI_BUDGET_USD:.2f} ({pct:.1f}%)"
    )


class GeminiBudgetExceeded(Exception):
    pass


async def call_gemini(prompt: str, system: str = "") -> str:
    """Gemini 2.5 Flash-Lite. JSON mode + thinking OFF + hard cost cap."""
    global _gemini_spent_usd, _gemini_calls, _gemini_in_tok, _gemini_out_tok, _gemini_avg_cost_per_call
    if _gemini_spent_usd >= GEMINI_BUDGET_USD:
        avg = _gemini_avg_cost_per_call if _gemini_avg_cost_per_call > 0 else 0.005
        # Estimation : 4 calls par sté (1 pass1 + 3 pass2). 1 call = 1/4 sté.
        stés_done_eq = _gemini_calls / 4.0
        raise GeminiBudgetExceeded(
            f"Budget Gemini atteint : ${_gemini_spent_usd:.4f} / ${GEMINI_BUDGET_USD:.2f}\n"
            f"  → {_gemini_calls} calls Gemini effectués (~{stés_done_eq:.0f} stés équivalent 4 passes)\n"
            f"  → Coût moyen /call : ${avg:.4f} (= ~${avg*4:.4f} /sté complète)\n"
            f"  → Pour 100 stés supplémentaires : ~${avg*4*100:.2f}\n"
            f"  → Pour 500 stés supplémentaires : ~${avg*4*500:.2f}\n"
            f"  → Pour 1000 stés supplémentaires : ~${avg*4*1000:.2f}\n"
            f"  → DEMANDE USER si OK pour recharger ou switch sur free tier."
        )
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    full_prompt = (system + "\n\n" + prompt) if system else prompt
    body = {
        "contents": [{"parts": [{"text": full_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": 8000,
            "thinkingConfig": {"thinkingBudget": 0},  # CRITIQUE : pas de thinking = -90% coût output
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={os.environ['GEMINI_API_KEY']}"
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(url, json=body, timeout=aiohttp.ClientTimeout(total=180)) as r:
            data = await r.json()
            if "candidates" not in data:
                raise RuntimeError(f"Gemini error: {data}")
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            usage = data.get("usageMetadata", {})
            in_t = usage.get("promptTokenCount", 0)
            out_t = usage.get("candidatesTokenCount", 0)
            cost = (in_t * GEMINI_PRICE_IN_PER_M + out_t * GEMINI_PRICE_OUT_PER_M) / 1_000_000
            _gemini_calls += 1
            _gemini_in_tok += in_t
            _gemini_out_tok += out_t
            _gemini_spent_usd += cost
            _gemini_avg_cost_per_call = _gemini_spent_usd / _gemini_calls
            return text


async def call_openrouter(prompt: str, system: str = "") -> str:
    """OpenRouter — proxie multiple modèles free (Llama 405B, Qwen 72B, Gemini)."""
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
                "HTTP-Referer": "https://mettrik.ai",
                "X-Title": "Mettrik AI Pipeline",
            },
            json={
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
                "response_format": {"type": "json_object"},
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as r:
            data = await r.json()
            if "choices" not in data:
                raise RuntimeError(f"OpenRouter error: {data}")
            return data["choices"][0]["message"]["content"]


# Round-robin index + cooldown par provider
_provider_idx = 0
_provider_cooldown_until: dict = {}  # name → epoch quand de nouveau utilisable


async def call_llm_rotated(prompt: str, system: str, log) -> str:
    """Round-robin sur les providers dispo + cooldown + retry exponentiel."""
    global _provider_idx
    if not PROVIDERS:
        raise RuntimeError("Aucun provider LLM configuré")

    # 3 tentatives globales avec backoff exponentiel
    for global_retry in range(3):
        last_err = None
        for attempt in range(len(PROVIDERS)):
            provider = PROVIDERS[(_provider_idx + attempt) % len(PROVIDERS)]
            # Skip provider en cooldown
            if _provider_cooldown_until.get(provider["name"], 0) > time.time():
                log(f"      [LLM-SKIP-cooldown] {provider['name']}")
                continue
            try:
                log(f"      [LLM] try {provider['name']}")
                result = await provider["call"](prompt, system)
                _provider_idx = (_provider_idx + attempt + 1) % len(PROVIDERS)
                return result
            except GeminiBudgetExceeded as e:
                log(f"      [GEMINI-BUDGET-STOP] {e} — Gemini désactivé, fallback free providers")
                _provider_cooldown_until["Gemini"] = time.time() + 86400
                continue
            except CerebrasBudgetExceeded as e:
                log(f"      [CEREBRAS-BUDGET-STOP] {e} — Cerebras désactivé, fallback Gemini/free")
                _provider_cooldown_until["Cerebras"] = time.time() + 86400
                _provider_cooldown_until["Cerebras2"] = time.time() + 86400
                _provider_cooldown_until["Cerebras3"] = time.time() + 86400
                continue
            except Exception as e:
                last_err = e
                err_str = str(e)[:200]
                log(f"      [LLM-WARN] {provider['name']} fail: {err_str[:120]}")
                # Si quota/queue → cooldown 90s
                if any(x in err_str.lower() for x in ["quota", "queue", "rate_limit", "too_many", "429"]):
                    _provider_cooldown_until[provider["name"]] = time.time() + 90
                    log(f"      [LLM-COOLDOWN-90s] {provider['name']}")
                await asyncio.sleep(0.5)

        # Tous les providers ont échoué cette passe → backoff global
        wait = 10 * (2 ** global_retry)  # 10s, 20s, 40s
        log(f"      [LLM-BACKOFF] all providers failed retry {global_retry+1}/3, sleep {wait}s")
        await asyncio.sleep(wait)

    raise RuntimeError(f"All providers failed after 3 global retries: {last_err}")


# ─────────────────────────────────────────────────────────────────────
# Document extraction
# ─────────────────────────────────────────────────────────────────────
_DOC_CACHE_DIR = PROJECT_ROOT / ".pipeline-doc-cache"


def extract_text_from_htm_gz(path: Path) -> str:
    """gunzip + strip HTML → texte brut. Cache disque pour gagner 1-2 min/sté en re-run."""
    if not path or not path.exists():
        return ""

    # Cache key = mtime + size + filename
    cache_key = f"{path.name}_{path.stat().st_size}_{int(path.stat().st_mtime)}"
    cache_file = _DOC_CACHE_DIR / f"{cache_key}.txt"
    if cache_file.exists():
        try:
            return cache_file.read_text(encoding="utf-8")
        except Exception:
            pass  # cache corrompu, retombe sur extraction

    try:
        with gzip.open(path, "rb") as f:
            html = f.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""
    # Stripping HTML naïf mais suffisant pour LLM
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()

    # Save cache (best effort)
    try:
        _DOC_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(text, encoding="utf-8")
    except Exception:
        pass

    return text


def extract_key_sections(text: str) -> str:
    """Extrait Item 5 MD&A + Item 4 Business + Item 3 Risk Factors (10-K/20-F)."""
    if not text or len(text) < 5000:
        return text  # Probablement un 8-K court ou 6-K, garde tout

    sections = []

    # Helper : prend la DERNIÈRE occurrence d'un pattern (pour skip TOC qui est en haut)
    def find_last(pattern: str) -> int | None:
        positions = [m.start() for m in re.finditer(pattern, text, re.I)]
        return positions[-1] if positions else None

    # Item 1 Business (10-K) ou Item 4 Information on the Company (20-F)
    pos = find_last(r"item\s+[14]\.?\s+(?:business|information on the company)")
    if pos: sections.append(("BUSINESS", pos))

    # Item 7 MD&A (10-K) ou Item 5 Operating and Financial Review (20-F)
    pos = find_last(r"item\s+[57]\.?\s+(?:management.{0,30}discussion|operating and financial review)")
    if pos: sections.append(("MDA", pos))

    # Item 8 Financial Statements (10-K)
    pos = find_last(r"item\s+8\.?\s+(?:financial\s+statements?|consolidated\s+financial)")
    if pos: sections.append(("FINANCIALS", pos))

    # Item 1A / 3D Risk Factors
    pos = find_last(r"(?:item\s+1a\.?\s+risk\s+factors|item\s+3\.?\s*d\s+risk\s+factors)")
    if pos: sections.append(("RISK", pos))

    if not sections:
        # Fallback : prendre les 25K chars du milieu (souvent MD&A est milieu doc)
        mid = len(text) // 2
        return text[max(0, mid - 12500): mid + 12500]

    sections.sort(key=lambda x: x[1])
    chunks = []
    # Budget total : ~25K chars (= ~6K tokens, sous le 12K TPM Groq avec marge)
    # MD&A prioritaire (12K), Financials (8K), Business (3K), Risk (2K)
    budgets = {"MDA": 12000, "FINANCIALS": 8000, "BUSINESS": 3000, "RISK": 2000}
    seen_kinds = set()
    for i, (kind, start) in enumerate(sections):
        if kind in seen_kinds:
            continue
        seen_kinds.add(kind)
        budget = budgets.get(kind, 3000)
        chunks.append(f"=== {kind} ===\n{text[start:start + budget]}")

    return "\n\n".join(chunks)


def find_latest_filing(ticker: str, cat: int, form_dir: str) -> Path | None:
    """Trouve le dernier filing d'un type donné pour un ticker, trié par date
    extraite du NOM DE FICHIER (pas mtime, qui est l'heure de téléchargement).

    Cherche d'abord sur disque externe (CAT1_DIR/CAT2_DIR), puis fallback local
    (~/spx-app/sec-data/cat1-us et cat2-foreign-adr) si rien trouvé.
    """
    bases = []
    if cat == 1:
        bases.append(CAT1_DIR / form_dir)
        bases.append(PROJECT_ROOT / "sec-data/cat1-us" / form_dir)
    else:
        bases.append(CAT2_DIR / form_dir)
        bases.append(PROJECT_ROOT / "sec-data/cat2-foreign-adr" / form_dir)

    candidates = []
    for base in bases:
        if not base.exists():
            continue
        for year_dir in base.iterdir():
            if not year_dir.is_dir():
                continue
            for f in year_dir.glob(f"{ticker}_*.htm.gz"):
                m = re.search(r"_(\d{4}-\d{2}-\d{2})", f.name)
                date_key = m.group(1) if m else "0000-00-00"
                candidates.append((date_key, f))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


CAT3_DIR = Path("/Volumes/250GB/Mettrik/sec-data/cat3-european")
CAT3_DIR_LOCAL = PROJECT_ROOT / "sec-data/cat3-european"


def find_cat3_text(ticker: str) -> tuple[Path | None, str]:
    """Pour cat 3 EU pures : trouve le dernier annual-report en .txt depuis cat3-european/."""
    for base in [CAT3_DIR, CAT3_DIR_LOCAL]:
        d = base / ticker / "annual-text"
        if d.exists():
            txts = sorted(d.glob("*.txt"), reverse=True)  # latest year first
            if txts:
                latest = txts[0]
                try:
                    text = latest.read_text(encoding="utf-8", errors="ignore")
                    return latest, text
                except Exception:
                    continue
    return None, ""


def gather_docs(ticker: str, cat: int) -> dict:
    """Rassemble les docs principaux pour la sté."""
    if cat == 1:
        annual = find_latest_filing(ticker, 1, "10K")
        quarter = find_latest_filing(ticker, 1, "10Q")
        er = find_latest_filing(ticker, 1, "8K")
        annual_text = extract_key_sections(extract_text_from_htm_gz(annual)) if annual else ""
        quarter_text = extract_text_from_htm_gz(quarter)[:8000] if quarter else ""
        er_text = extract_text_from_htm_gz(er)[:6000] if er else ""
    elif cat == 2:
        annual = (
            find_latest_filing(ticker, 2, "20F")
            or find_latest_filing(ticker, 2, "40F-canadian")
        )
        quarter = None
        er = find_latest_filing(ticker, 2, "6K")
        annual_text = extract_key_sections(extract_text_from_htm_gz(annual)) if annual else ""
        quarter_text = ""
        er_text = extract_text_from_htm_gz(er)[:6000] if er else ""
    else:  # cat 3 EU pures : annual-report converti en .txt
        annual, annual_full = find_cat3_text(ticker)
        # Truncate à 25K chars (mêmes ordres de grandeur que extract_key_sections cat 1)
        annual_text = annual_full[:25000] if annual_full else ""
        quarter = None
        quarter_text = ""
        er = None
        er_text = ""

    return {
        "annual_path": annual,
        "annual_text": annual_text,
        "quarter_path": quarter,
        "quarter_text": quarter_text,
        "er_path": er,
        "er_text": er_text,
    }


# ─────────────────────────────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────────────────────────────
def build_prompt(ticker: str, sector: str, template: dict, docs: dict) -> tuple[str, str]:
    """Retourne (system_prompt, user_prompt)."""

    sector_template = template["KPI_TEMPLATES"].get(sector_to_key(sector), {})

    system = """Tu es un analyste financier expert. Ta mission : extraire des KPI structurés pour une société à partir de ses filings SEC.

CONTRAINTES STRICTES :
- Toutes les valeurs viennent EXCLUSIVEMENT du texte fourni. Ne JAMAIS inventer.
- Si une valeur n'est pas dans le texte, OMETTRE le KPI plutôt que mettre "Non disponible".
- VISE 6 à 10 KPI dans kpis[] et 2 à 4 dans stories_kpis[]. SOIS EXHAUSTIF, lis tout le texte.
- History 5 ans quand dispo (history doit être un array de NOMBRES, pas de strings).
- Stories : valeur du DERNIER exercice fiscal OBLIGATOIRE. Sinon NE PAS inclure le KPI.
- Tous les noms en français accessible (niveau 16 ans). Acronymes traduits.
- Devises : reporter dans la devise locale (TWD, EUR, JPY, CNY, DKK) avec format "Mds X".
- Hero KPI : choisir LE wow propre à la société (segment driver, pas Revenue/Op Margin sauf vraiment rien).
- Pour les chiffres en milliards : value="69.9" et unit="Mds $" (PAS de doublon "Mds $ Mds $").
- yoy : format "+12%" ou "-5%" ou "+1.5 pts" pour les marges. PAS "n/a" — omet le champ ou mets "stable".

Cherche activement les KPI typiques du secteur dans le template fourni. Pour Apple par exemple : iPhone Revenue, Mac Revenue, iPad Revenue, Wearables Revenue, Services Revenue, Greater China Revenue, Gross Margin, Op Margin, R&D %, Capex.

Retourne UNIQUEMENT un objet JSON valide selon le schéma demandé."""

    user = f"""SOCIÉTÉ : {ticker}
SECTEUR GICS : {sector}

═══ TEMPLATE KPI POUR CE SECTEUR (STRUCTURE seulement, AUCUNE valeur n'est applicable à cette sté — toutes les valeurs doivent venir du texte 10-K/20-F ci-dessous) ═══
{json.dumps(strip_template_examples(sector_template), ensure_ascii=False)[:3500]}

═══ EXTRAITS 10-K / 20-F (sections clés Business + MD&A + Risk) ═══
{docs['annual_text'][:14000]}

═══ DERNIER 8-K / 6-K (earnings release récent) ═══
{docs['er_text'][:3000]}

═══ TÂCHE ═══
Extrais les KPI suivants pour {ticker}, en respectant strictement le format JSON ci-dessous :

{{
  "ticker": "{ticker}",
  "name": "...",
  "sector": "{sector}",
  "subsector": "...",
  "tagline": "tagline officielle de la sté en anglais",
  "founded": <year>,
  "ipo": <year>,
  "logo_treatment": "orbit",
  "ranks": {{
    "global_world": "≈ #XX",
    "global_us": "...",
    "sector": "...",
    "subsector": "..."
  }},
  "hero_kpi": "<short du KPI Hero>",
  "hero_kpi_rationale": "1-2 phrases : POURQUOI ce KPI est le Hero (segment driver, vague IA, etc.)",
  "kpis": [
    // 6-10 KPI mix wow + generic, ordre wow first
    {{
      "short": "...",
      "name_fr": "...",
      "name_en": "...",
      "explanation": "1 phrase, niveau 16 ans",
      "value": "<dernière valeur>",
      "unit": "Mds $|Mds €|%|...",
      "yoy": "+X%|-X%|n/a",
      "type": "Demand|Revenue|Margin|Investment|Risk|Cash|User|Mix|Recurring|Adoption|Capital|Pipeline",
      "nature": "Cyclique|Structurel|Conjoncturel",
      "comparable": "Comparable|Non comparable",
      "signal": "1 ligne wow",
      "description": "1-2 phrases contexte",
      "history": [<5 valeurs historiques>],
      "last_data_date": "YYYY-MM-DD",
      "is_wow": true/false,
      "is_generic": true/false,
      "is_short_history": false
    }}
    // ... 5-9 autres KPI
  ],
  "stories_kpis": [
    // 2-4 KPI courte histoire (<5 ans), valeur 2025 OBLIGATOIRE
    // mêmes champs que kpis[], avec is_short_history: true et story_category: "Innovation|Marché|Adoption|Capacité"
  ],
  "ai_positioning": {{
    "stance": "leader|integrator|cautious|absent",
    "summary": "2-3 phrases sur position IA",
    "evidence": ["evidence 1", "evidence 2", "evidence 3"],
    "source": ""
  }}
}}

ATTENTION :
- Si tu n'as pas les chiffres pour un KPI, OMETS-LE plutôt que d'inventer.
- Si la sté n'a pas de wow distinctif, prends le KPI maître secteur (du template) en Hero, et marque hero_kpi_rationale en notant "pas de wow distinctif identifié".
- Stories : SI valeur 2025 absente du texte, NE PAS INCLURE le KPI dans stories_kpis.
"""
    return system, user


def strip_template_examples(template: dict) -> dict:
    """Retire les exemples chiffrés (value, history, yoy) du template pour
    que le LLM ne les confonde avec les données de la sté ciblée."""
    if not isinstance(template, dict):
        return template
    cleaned = {}
    for k, v in template.items():
        if isinstance(v, list):
            cleaned[k] = [strip_kpi_example(x) if isinstance(x, dict) else x for x in v]
        elif isinstance(v, dict):
            cleaned[k] = strip_template_examples(v)
        else:
            cleaned[k] = v
    return cleaned


def strip_kpi_example(kpi: dict) -> dict:
    """Garde la structure conceptuelle, retire les exemples chiffrés."""
    keep = {
        "short": kpi.get("short"),
        "name_fr": kpi.get("name_fr"),
        "name_en": kpi.get("name_en"),
        "explanation": kpi.get("explanation"),
        "why_pv": kpi.get("why_pv"),
        "unit": kpi.get("unit"),
        "type": kpi.get("type"),
        "wow_or_generic": kpi.get("wow_or_generic"),
    }
    return {k: v for k, v in keep.items() if v is not None}


def sector_to_key(sector: str) -> str:
    """Normalise un secteur en clé KPI_TEMPLATES."""
    s = sector.upper().replace(" ", "_").replace("-", "_")
    mapping = {
        "INFORMATION_TECHNOLOGY": "INFORMATION_TECHNOLOGY",
        "TECHNOLOGY": "INFORMATION_TECHNOLOGY",
        "TECHNOLOGIE": "INFORMATION_TECHNOLOGY",
        "FINANCIALS": "FINANCIALS",
        "FINANCE": "FINANCIALS",
        "HEALTHCARE": "HEALTHCARE",
        "HEALTH_CARE": "HEALTHCARE",
        "SANTE": "HEALTHCARE",
        "ENERGY": "ENERGY",
        "ENERGIE": "ENERGY",
        "INDUSTRIALS": "INDUSTRIALS",
        "INDUSTRIE": "INDUSTRIALS",
        "CONSUMER_DISCRETIONARY": "CONSUMER_DISCRETIONARY",
        "CONSUMER_STAPLES": "CONSUMER_STAPLES",
        "MATERIALS": "MATERIALS",
        "MATERIAUX": "MATERIALS",
        "REAL_ESTATE": "REAL_ESTATE",
        "IMMOBILIER": "REAL_ESTATE",
        "UTILITIES": "UTILITIES",
        "COMMUNICATION_SERVICES": "COMMUNICATION_SERVICES",
    }
    return mapping.get(s, "INFORMATION_TECHNOLOGY")


# ─────────────────────────────────────────────────────────────────────
# Main pipeline per ticker
# ─────────────────────────────────────────────────────────────────────
async def process_ticker(ticker: str, cat: int, template: dict, log):
    log(f"\n{'='*60}")
    log(f"=== {ticker} (cat {cat}) ===")
    sector = SECTOR_GUESS.get(ticker, "Information Technology")
    log(f"   Secteur : {sector}")

    docs = gather_docs(ticker, cat)
    if not docs["annual_text"]:
        log(f"   [SKIP] pas de 10-K/20-F dispo pour {ticker}")
        return None

    log(f"   docs : annual={len(docs['annual_text'])} chars, ER={len(docs['er_text'])} chars")

    # Cache key sur le contenu hashable
    cache_key = hashlib.sha256(
        (ticker + sector + docs["annual_text"][:5000] + docs["er_text"][:1000]).encode()
    ).hexdigest()[:16]
    cache_path = CACHE_DIR / f"{ticker}_{cache_key}.json"
    if cache_path.exists():
        log(f"   [CACHE] reuse {cache_path.name}")
        with open(cache_path) as f:
            return json.load(f)

    system, user = build_prompt(ticker, sector, template, docs)
    log(f"   prompt size : {len(system) + len(user):,} chars")

    t0 = time.time()
    try:
        response_text = await call_llm_rotated(user, system, log)
    except Exception as e:
        log(f"   [ERR] LLM all providers failed: {e}")
        return None
    dt = time.time() - t0
    log(f"   LLM répondu en {dt:.1f}s, {len(response_text)} chars")

    # Parse JSON
    try:
        # Sometimes LLM wraps in ```json ... ```
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", response_text.strip(), flags=re.M)
        # LLMs may prefix JSON with explanatory text ("Voici les KPI extraits pour CVNA :")
        # Extract the first balanced { ... } block
        try:
            data = json.loads(clean)
        except Exception:
            m = re.search(r"\{[\s\S]*\}", clean)
            if not m:
                raise
            candidate = m.group(0)
            try:
                data = json.loads(candidate)
            except Exception:
                # Try to find the largest valid JSON object by trimming trailing junk
                # Walk backwards from the last } to find a parseable substring
                last_close = candidate.rfind("}")
                while last_close > 0:
                    try:
                        data = json.loads(candidate[: last_close + 1])
                        break
                    except Exception:
                        last_close = candidate.rfind("}", 0, last_close)
                else:
                    raise
    except Exception as e:
        log(f"   [ERR] JSON parse fail: {e}, raw: {response_text[:500]}")
        return None

    # Normalize : lower-case all top-level keys (LLM peut renvoyer Ticker/Kpis/Hero_KPI)
    if isinstance(data, dict):
        data = {(k.lower() if isinstance(k, str) else k): v for k, v in data.items()}
        # Re-normalize nested keys courants
        for key in ["hero_kpi_rationale", "stories_kpis", "ai_positioning", "kpis"]:
            for k in list(data.keys()):
                if k.lower() == key.lower() and k != key:
                    data[key] = data.pop(k)

    # Inject ticker depuis l'argument si manquant
    if "ticker" not in data or not data["ticker"]:
        data["ticker"] = ticker
    # Accepte alias : kpi, indicators, KPIs, Kpis, key_performance_indicators
    if "kpis" not in data:
        for alias in ["kpi", "indicators", "key_performance_indicators", "metrics"]:
            v = data.get(alias)
            if isinstance(v, list) and len(v) > 0:
                data["kpis"] = v
                break
    if "kpis" not in data or not isinstance(data["kpis"], list) or len(data["kpis"]) == 0:
        log(f"   [ERR] schema invalide, kpis vide. Top keys: {list(data.keys())[:12]}")
        return None
    # Normalize chaque KPI : lower-case keys
    data["kpis"] = [
        {(k.lower() if isinstance(k, str) else k): v for k, v in kpi.items()}
        if isinstance(kpi, dict)
        else kpi
        for kpi in data["kpis"]
    ]

    # Save cache
    CACHE_DIR.mkdir(exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Save output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{ticker.lower()}.json"
    # Préserve _validation field si déjà existant (Pass 3 Sonnet/Haiku) — ne pas écraser
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text())
            if existing.get("_validation"):
                # Conserve les corrections Pass 3, mais update le reste depuis nouveau extract
                data["_validation_preserved_from_previous"] = True
                # Don't overwrite — laisse l'ancien fichier validé intact
                # SAUF si user veut explicitement re-extract via flag (à ajouter plus tard si besoin)
                log(f"   ⚠ Preserve : {ticker} a déjà _validation Pass 3 actif, on n'écrase PAS")
                return existing
        except Exception:
            pass
    with open(out_path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    n_kpis = len(data.get("kpis", []))
    n_stories = len(data.get("stories_kpis", []))
    log(f"   ✅ {ticker} : {n_kpis} KPI + {n_stories} stories → {out_path.name}")
    if _cerebras_calls > 0:
        log(f"   {cerebras_spend_summary()}")
    if _gemini_calls > 0:
        log(f"   {gemini_spend_summary()}")
    return data


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="ex: AAPL,MSFT")
    parser.add_argument("--batch", choices=["top20cat1", "top20cat2", "top20both"])
    parser.add_argument("--cat", type=int, default=None)
    args = parser.parse_args()

    load_env()

    # Configure providers selon clés dispo
    # Filtre les placeholders / clés évidentes (csk_xxx, AIzaXxxx)
    def is_real_key(k):
        if not k or len(k) < 20:
            return False
        if k.lower().startswith(("csk_xxx", "aizaxxx", "gsk_xxx", "todo")):
            return False
        if "xxx" in k.lower() or "placeholder" in k.lower():
            return False
        return True

    # ⚠ Providers DÉSACTIVÉS (HS confirmés ce jour) :
    #   - Groq : day quota épuisé (reset minuit)
    #   - Cerebras / Cerebras2 : day quota épuisé
    #   - Together / Together2 / Together3 : invalid key + credits dépassés
    #   - OpenRouter : 429 free tier saturé
    #   - GitHub Models : permission "Models" manquante
    # Pour réactiver, retirer le commentaire et le pipeline les utilisera.

    # PROVIDER #1 : Cerebras3 PAYANT ($50 deposit, no rate limit, ~2000 tok/s)
    # Provider #2 : Gemini Flash-Lite en filet payant secondaire ($48 cap)
    # Cerebras et Cerebras2 (free, quota épuisé) restent désactivés
    if is_real_key(os.environ.get("CEREBRAS3_API_KEY")):
        PROVIDERS.append({"name": "Cerebras3", "call": call_cerebras3})
    if is_real_key(os.environ.get("GEMINI_API_KEY")):
        PROVIDERS.append({"name": "Gemini", "call": call_gemini})
    # if is_real_key(os.environ.get("CEREBRAS_API_KEY")):
    #     PROVIDERS.append({"name": "Cerebras", "call": call_cerebras})
    # if is_real_key(os.environ.get("CEREBRAS2_API_KEY")):
    #     PROVIDERS.append({"name": "Cerebras2", "call": call_cerebras2})
    # if is_real_key(os.environ.get("GROQ_API_KEY")):
    #     PROVIDERS.append({"name": "Groq", "call": call_groq})
    if is_real_key(os.environ.get("SAMBANOVA_API_KEY")):
        PROVIDERS.append({"name": "SambaNova", "call": call_sambanova})
    # if is_real_key(os.environ.get("OPENROUTER_API_KEY")):
    #     PROVIDERS.append({"name": "OpenRouter", "call": call_openrouter})
    # if is_real_key(os.environ.get("TOGETHER_AI")):
    #     PROVIDERS.append({"name": "Together", "call": call_together})
    # if is_real_key(os.environ.get("TOGETHER2_AI")):
    #     PROVIDERS.append({"name": "Together2", "call": call_together2})
    # if is_real_key(os.environ.get("TOGETHER3_AI")):
    #     PROVIDERS.append({"name": "Together3", "call": call_together3})
    if is_real_key(os.environ.get("FIREWORKS_AI")):
        PROVIDERS.append({"name": "Fireworks", "call": call_fireworks})
    if is_real_key(os.environ.get("NVIDIA_API_KEY")):
        PROVIDERS.append({"name": "NVIDIA", "call": call_nvidia})
    if is_real_key(os.environ.get("NVIDIA2_API_KEY")):
        PROVIDERS.append({"name": "NVIDIA2", "call": call_nvidia2})
    # if is_real_key(os.environ.get("GITHUB_MODELS_KEY")):
    #     PROVIDERS.append({"name": "GitHub", "call": call_github_models})

    if not PROVIDERS:
        print("ERREUR : aucune clé API trouvée dans .env.local (GROQ/CEREBRAS/GEMINI_API_KEY)")
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log(f"Pipeline LLM démarré. Providers : {[p['name'] for p in PROVIDERS]}")

    # Charge template
    with open(TEMPLATE_PATH) as f:
        template = json.load(f)

    # Determine ticker list + cat
    tickers_to_process = []  # list of (ticker, cat)

    if args.batch == "top20cat1":
        tickers_to_process = [(t, 1) for t in TOP20_CAT1]
    elif args.batch == "top20cat2":
        tickers_to_process = [(t, 2) for t in TOP20_CAT2]
    elif args.batch == "top20both":
        tickers_to_process = [(t, 1) for t in TOP20_CAT1] + [(t, 2) for t in TOP20_CAT2]
    elif args.ticker:
        for t in args.ticker.split(","):
            t = t.strip().upper()
            cat = args.cat if args.cat else (1 if t in TOP20_CAT1 else 2)
            tickers_to_process.append((t, cat))

    log(f"Total stés à traiter : {len(tickers_to_process)}")

    successes = 0
    failures = 0
    for ticker, cat in tickers_to_process:
        try:
            result = await process_ticker(ticker, cat, template, log)
            if result:
                successes += 1
            else:
                failures += 1
        except Exception as e:
            log(f"[ERR] {ticker}: {e}")
            failures += 1
        # Petite pause entre stés pour ne pas saturer le rate limit
        await asyncio.sleep(0.5)

    log(f"\n=== TOTAL : {successes} OK, {failures} fail ===")
    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
