#!/usr/bin/env python3
"""
Pipeline LLM PASS 3 — validation qualité Claude Sonnet 4.

Cross-check des datasets v2-pipeline (générés par Cerebras/Gemini en pass 1+2)
via Claude Sonnet 4 pour qualité tier premium.

Pour chaque sté :
  - charge dataset existant src/data/v2-pipeline/<ticker>.json
  - charge sources 10-K/20-F (mêmes que pipeline-llm.py)
  - appelle Claude Sonnet 4 avec instruction "valide et corrige"
  - backup original en src/data/v2-pipeline/<ticker>.gemini.json
  - écrase avec version validée

Pricing Sonnet 4 : $3/M input + $15/M output
Estimation /sté : ~$0.15 (30K input + 5K output)
Budget hard cap : $40 (laisse buffer pour FR top 50)

Run :
    python3 scripts/pipeline-claude-validate.py --ticker AAPL,MSFT,...
    python3 scripts/pipeline-claude-validate.py --top50-us
    python3 scripts/pipeline-claude-validate.py --top100-us  # si budget
"""

from __future__ import annotations
import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "src/data/v2-pipeline"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/pipeline-claude-validate.log"

# Import pipeline-llm pour réutiliser gather_docs/extract_key_sections
import importlib.util
spec = importlib.util.spec_from_file_location(
    "pipeline_llm", str(PROJECT_ROOT / "scripts/pipeline-llm.py")
)
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)


# Modèles supportés (--model sonnet|haiku)
MODELS = {
    "sonnet": {
        "id": "claude-sonnet-4-5-20250929",
        "price_in": 3.0,
        "price_out": 15.0,
        "default_budget": 40.0,
    },
    "haiku": {
        "id": "claude-haiku-4-5-20251001",
        "price_in": 1.0,
        "price_out": 5.0,
        "default_budget": 20.0,
    },
}

# Variables runtime, set par main() selon --model
MODEL_ID = MODELS["sonnet"]["id"]
PRICE_IN_PER_M = MODELS["sonnet"]["price_in"]
PRICE_OUT_PER_M = MODELS["sonnet"]["price_out"]
BUDGET_USD = MODELS["sonnet"]["default_budget"]
MODEL_NAME = "sonnet"

_spent_usd = 0.0
_calls = 0
_in_tok = 0
_out_tok = 0


def spend_summary() -> str:
    pct = (_spent_usd / BUDGET_USD * 100) if BUDGET_USD > 0 else 0
    return (
        f"[{MODEL_NAME.title()} spend] {_calls} calls | "
        f"in={_in_tok:,} | out={_out_tok:,} | "
        f"${_spent_usd:.4f} / ${BUDGET_USD:.2f} ({pct:.1f}%)"
    )


# Compat alias (anciens noms)
def sonnet_spend_summary() -> str:
    return spend_summary()


class SonnetBudgetExceeded(Exception):
    pass


# Alias historique pour compat
BudgetExceeded = SonnetBudgetExceeded


async def call_sonnet(system: str, user: str) -> tuple[str, dict]:
    """Appelle Claude (Sonnet ou Haiku selon MODEL_ID global), retourne (text, usage)."""
    global _spent_usd, _calls, _in_tok, _out_tok
    if _spent_usd >= BUDGET_USD:
        avg = (_spent_usd / _calls) if _calls > 0 else 0.10
        raise BudgetExceeded(
            f"Budget {MODEL_NAME} atteint : ${_spent_usd:.4f} / ${BUDGET_USD:.2f}\n"
            f"  → {_calls} stés validées | coût moyen ${avg:.4f}/sté\n"
            f"  → Pour 50 stés de plus : ~${avg*50:.2f}\n"
            f"  → Pour 100 stés de plus : ~${avg*100:.2f}"
        )
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    headers = {
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": MODEL_ID,
        "max_tokens": 8000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
            timeout=aiohttp.ClientTimeout(total=300),
        ) as r:
            data = await r.json()
            if "content" not in data:
                raise RuntimeError(f"{MODEL_NAME} error: {data}")
            text = data["content"][0]["text"]
            usage = data.get("usage", {})
            in_t = usage.get("input_tokens", 0)
            out_t = usage.get("output_tokens", 0)
            cost = (in_t * PRICE_IN_PER_M + out_t * PRICE_OUT_PER_M) / 1_000_000
            _calls += 1
            _in_tok += in_t
            _out_tok += out_t
            _spent_usd += cost
            return text, {"in_t": in_t, "out_t": out_t, "cost_usd": cost}


def build_validation_prompt(dataset: dict, source_text: str) -> tuple[str, str]:
    """Construit (system, user) pour validation Sonnet."""
    system = (
        "Tu es un analyste financier senior chargé d'auditer un dataset KPI extrait "
        "automatiquement d'un 10-K / 20-F. "
        "Tu dois :\n"
        "1. Vérifier chaque KPI : nom, valeur numérique, unité, year-over-year, history\n"
        "2. Corriger les unités erronées (B vs Mds, % vs ratio, M vs K)\n"
        "3. Améliorer name_fr, tagline (en anglais), hero_kpi_rationale (en français, sans em-dash)\n"
        "4. Détecter les KPI hallucinés (valeur fabriquée non présente dans la source)\n"
        "5. Garder la structure JSON identique. Ajouter un champ '_validation' "
        "qui liste les corrections faites.\n"
        "6. Réponds UNIQUEMENT avec le JSON corrigé entier, pas de texte hors JSON."
    )
    user = (
        f"=== Dataset à valider ===\n{json.dumps(dataset, ensure_ascii=False, indent=2)[:12000]}\n\n"
        f"=== Source 10-K (extrait MD&A + Financials) ===\n{source_text[:18000]}\n\n"
        "Renvoie le JSON corrigé entier (avec champ _validation listant les corrections)."
    )
    return system, user


async def validate_ticker(ticker: str, log) -> dict | None:
    """Valide 1 sté via Sonnet."""
    json_path = OUTPUT_DIR / f"{ticker.lower()}.json"
    if not json_path.exists():
        log(f"   [SKIP] {ticker}: pas de dataset v2-pipeline existant")
        return None
    backup_path = OUTPUT_DIR / f"{ticker.lower()}.gemini.json"
    if backup_path.exists():
        log(f"   [SKIP] {ticker}: déjà validé (backup existe)")
        return None

    try:
        dataset = json.loads(json_path.read_text())
    except Exception as e:
        log(f"   [ERR] {ticker}: parse JSON fail: {e}")
        return None

    # Détermine cat depuis dataset ou heuristique
    cat = 1  # par défaut
    tk_upper = (dataset.get("ticker", "") or ticker).upper()
    if hasattr(pl, "TOP20_CAT2") and tk_upper in pl.TOP20_CAT2:
        cat = 2
    # Heuristique cat 3 : ticker contenant un "." (suffix bourse EU)
    # Exclut les hyphens US courants (BRK-B, BF-B)
    if "." in tk_upper:
        cat = 3

    # Charge source via pipeline-llm
    try:
        docs = pl.gather_docs(ticker, cat)
        source_text = ""
        for k in ["annual_text", "er_text"]:
            txt = docs.get(k)
            if isinstance(txt, str) and txt:
                source_text += f"\n=== {k} ===\n{txt}\n"
        if not source_text or len(source_text) < 5000:
            log(f"   [SKIP] {ticker}: source trop courte ({len(source_text)} chars)")
            return None
    except Exception as e:
        log(f"   [WARN] {ticker}: gather_docs fail ({e}), validation sans source")
        source_text = "(source non disponible)"

    system, user = build_validation_prompt(dataset, source_text)
    t0 = time.time()
    try:
        response_text, usage = await call_sonnet(system, user)
    except SonnetBudgetExceeded:
        raise
    except Exception as e:
        log(f"   [ERR] {ticker}: Sonnet call fail: {e}")
        return None
    dt = time.time() - t0

    # Parse JSON renvoyé
    clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", response_text.strip(), flags=re.M)
    try:
        validated = json.loads(clean)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", clean)
        if not m:
            log(f"   [ERR] {ticker}: réponse Sonnet sans JSON parsable, raw: {response_text[:300]}")
            return None
        try:
            validated = json.loads(m.group(0))
        except Exception as e:
            log(f"   [ERR] {ticker}: JSON parse fail: {e}")
            return None

    # Backup original
    backup_path.write_text(json_path.read_text())
    # Écrit version validée
    json_path.write_text(json.dumps(validated, ensure_ascii=False, indent=2))
    n_corrections = len(validated.get("_validation", []))
    log(
        f"   ✅ {ticker} validé en {dt:.1f}s, {n_corrections} corrections, "
        f"in={usage['in_t']} out={usage['out_t']} cost=${usage['cost_usd']:.4f}"
    )
    log(f"      {sonnet_spend_summary()}")
    return validated


async def main():
    global MODEL_ID, PRICE_IN_PER_M, PRICE_OUT_PER_M, BUDGET_USD, MODEL_NAME
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["sonnet", "haiku"], default="sonnet",
                        help="Modèle Claude à utiliser (sonnet = qualité premium, haiku = tier 2)")
    parser.add_argument("--budget", type=float, default=None,
                        help="Override budget USD (default selon modèle)")
    parser.add_argument("--ticker", help="Comma-separated tickers à valider")
    parser.add_argument("--top50-us", action="store_true",
                        help="Valide top 50 USA (rang 1-50 du CSV)")
    parser.add_argument("--top100-us", action="store_true",
                        help="Valide top 51-100 USA (rang 51-100 du CSV)")
    parser.add_argument("--ticker-file", help="Fichier avec 1 ticker par ligne")
    args = parser.parse_args()

    pl.load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERREUR : ANTHROPIC_API_KEY missing")
        sys.exit(1)

    # Set model + pricing selon args
    cfg = MODELS[args.model]
    MODEL_ID = cfg["id"]
    PRICE_IN_PER_M = cfg["price_in"]
    PRICE_OUT_PER_M = cfg["price_out"]
    BUDGET_USD = args.budget if args.budget is not None else cfg["default_budget"]
    MODEL_NAME = args.model

    # Build ticker list
    tickers: list[str] = []
    if args.ticker:
        tickers = [t.strip().upper() for t in args.ticker.split(",")]
    elif args.top50_us:
        csv_path = Path.home() / "Downloads/top100_US_investisseurs_americains.csv"
        with open(csv_path) as f:
            for i, line in enumerate(f):
                if i == 0 or i > 50:
                    continue
                parts = line.split(",")
                if len(parts) >= 2 and parts[1].strip():
                    tickers.append(parts[1].strip().upper())
    elif args.top100_us:
        csv_path = Path.home() / "Downloads/top100_US_investisseurs_americains.csv"
        with open(csv_path) as f:
            for i, line in enumerate(f):
                if i <= 50 or i > 100:
                    continue
                parts = line.split(",")
                if len(parts) >= 2 and parts[1].strip():
                    tickers.append(parts[1].strip().upper())
    elif args.ticker_file:
        with open(args.ticker_file) as f:
            tickers = [line.strip().upper() for line in f if line.strip()]
    else:
        print("Specify --ticker, --top50-us, --top100-us, ou --ticker-file")
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log(f"PASS 3 {MODEL_NAME.upper()} démarré. Modèle : {MODEL_ID}, budget cap ${BUDGET_USD}")
    log(f"Total stés à valider : {len(tickers)}")

    n_ok = 0
    n_skip = 0
    n_err = 0
    for ticker in tickers:
        try:
            result = await validate_ticker(ticker, log)
            if result:
                n_ok += 1
            else:
                n_skip += 1
        except SonnetBudgetExceeded as e:
            log(f"\n⛔ {e}")
            log(f"=== Arrêt budget. {n_ok} validés, {n_skip} skipped, {n_err} erreurs ===")
            break
        except Exception as e:
            log(f"   [ERR] {ticker}: {e}")
            n_err += 1

    log(f"\n=== TOTAL : {n_ok} validés, {n_skip} skipped, {n_err} erreurs ===")
    log(f"   {sonnet_spend_summary()}")
    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
