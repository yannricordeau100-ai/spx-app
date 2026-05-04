#!/usr/bin/env python3
"""
Pass 3 validation via Anthropic Message Batches API.

Mode SUBMIT : packe N stés en 1 batch, soumet, sauve batch_id.
Mode POLL   : check status, si finished → fetch results + écrit JSON corrigés.
Mode AUTO   : submit + poll loop (default 30 min entre polls).

Bénéfices vs sync :
- 50% prix (-50% Anthropic Batches discount)
- 1 seule connexion (RAM ~5 MB vs 6× procs ~90 MB)
- Latence 1-12h (max 24h SLA Anthropic)

Usage :
    python3 scripts/pipeline-claude-validate-batch.py submit --model haiku --ticker-file /tmp/list.txt
    python3 scripts/pipeline-claude-validate-batch.py poll --job sec-data/_meta/batch-jobs/<id>.json
    python3 scripts/pipeline-claude-validate-batch.py auto --model haiku --ticker-file /tmp/list.txt
"""

import argparse
import asyncio
import importlib.util
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("pl", ROOT / "scripts/pipeline-llm.py")
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)

OUTPUT_DIR = ROOT / "src/data/v2-pipeline"
JOBS_DIR = ROOT / "sec-data/_meta/batch-jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/batch-validate.log"

# Load FPI ticker set au startup pour détection cat 2 fiable
_FPI_PATH = ROOT / "sec-data/_meta/fpi-tickers.json"
try:
    _fpi_data = json.loads(_FPI_PATH.read_text())
    FPI_SET = {t.get("ticker", "").upper() for t in _fpi_data.get("tickers", []) if isinstance(t, dict)}
except Exception:
    FPI_SET = set()

MODELS = {
    "sonnet": {"id": "claude-sonnet-4-5", "price_in": 3.0, "price_out": 15.0},
    "haiku":  {"id": "claude-haiku-4-5",  "price_in": 1.0, "price_out": 5.0},
}

API_VERSION = "2023-06-01"
BETA = "message-batches-2024-09-24"


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def build_prompt(dataset: dict, source_text: str) -> tuple[str, str]:
    system = (
        "Tu es un analyste financier senior chargé d'auditer un dataset KPI extrait "
        "automatiquement d'un 10-K / 20-F. Tu dois :\n"
        "1. Vérifier chaque KPI : nom, valeur numérique, unité, year-over-year, history\n"
        "2. Corriger les unités erronées (B vs Mds, % vs ratio, M vs K)\n"
        "3. Améliorer name_fr, tagline, hero_kpi_rationale (en français, sans em-dash)\n"
        "4. Détecter les KPI hallucinés (valeur fabriquée non présente dans la source)\n"
        "5. Garder la structure JSON identique. Ajouter '_validation' listant les corrections.\n"
        "6. Réponds UNIQUEMENT avec le JSON corrigé entier, pas de texte hors JSON."
    )
    user = (
        f"=== Dataset à valider ===\n{json.dumps(dataset, ensure_ascii=False, indent=2)[:12000]}\n\n"
        f"=== Source 10-K (extrait) ===\n{source_text[:18000]}\n\n"
        "Renvoie le JSON corrigé entier (avec champ _validation listant les corrections)."
    )
    return system, user


def detect_cat(ticker: str, dataset: dict) -> int:
    tk = (dataset.get("ticker", "") or ticker).upper()
    if tk in FPI_SET:
        return 2
    if "." in tk:
        return 3
    return 1


def load_source(ticker: str, dataset: dict) -> str:
    cat = detect_cat(ticker, dataset)
    try:
        docs = pl.gather_docs(ticker, cat)
        s = ""
        for k in ["annual_text", "er_text"]:
            t = docs.get(k)
            if isinstance(t, str) and t:
                s += f"\n=== {k} ===\n{t}\n"
        return s
    except Exception as e:
        log(f"   [WARN] {ticker}: gather_docs fail ({e})")
        return ""


async def http_post(url: str, body: dict, headers: dict) -> dict:
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post(url, headers=headers, json=body, timeout=aiohttp.ClientTimeout(total=300)) as r:
            return await r.json()


async def http_get(url: str, headers: dict, raw: bool = False):
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=300)) as r:
            if raw:
                return await r.text()
            return await r.json()


def base_headers() -> dict:
    return {
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": API_VERSION,
        "anthropic-beta": BETA,
        "content-type": "application/json",
    }


async def submit_batch(model: str, tickers: list[str]) -> str:
    """Build et soumet 1 batch. Retourne batch_id."""
    cfg = MODELS[model]
    requests_list = []
    skipped = []

    for ticker in tickers:
        ticker = ticker.upper()
        json_path = OUTPUT_DIR / f"{ticker.lower()}.json"
        if not json_path.exists():
            skipped.append((ticker, "no dataset"))
            continue
        backup = OUTPUT_DIR / f"{ticker.lower()}.gemini.json"
        if backup.exists():
            skipped.append((ticker, "already validated"))
            continue
        try:
            dataset = json.loads(json_path.read_text())
        except Exception as e:
            skipped.append((ticker, f"parse fail: {e}"))
            continue
        source = load_source(ticker, dataset)
        if not source or len(source) < 5000:
            skipped.append((ticker, f"source too short ({len(source)} chars)"))
            continue
        system, user = build_prompt(dataset, source)
        requests_list.append({
            "custom_id": ticker,
            "params": {
                "model": cfg["id"],
                "max_tokens": 8000,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        })

    log(f"Build batch : {len(requests_list)} requests, {len(skipped)} skipped")
    for t, r in skipped[:10]:
        log(f"   skip {t}: {r}")
    if len(skipped) > 10:
        log(f"   ... +{len(skipped)-10} more skipped")

    if not requests_list:
        log("ERROR: 0 valid requests, abort batch.")
        return None

    body = {"requests": requests_list}
    resp = await http_post(
        "https://api.anthropic.com/v1/messages/batches",
        body, base_headers()
    )
    if "id" not in resp:
        log(f"ERROR submit: {resp}")
        return None

    batch_id = resp["id"]
    job = {
        "batch_id": batch_id,
        "model": model,
        "submitted_at": datetime.now().isoformat(),
        "n_requests": len(requests_list),
        "n_skipped": len(skipped),
        "skipped": skipped,
        "tickers_in_batch": [r["custom_id"] for r in requests_list],
    }
    job_path = JOBS_DIR / f"{batch_id}.json"
    job_path.write_text(json.dumps(job, indent=2, ensure_ascii=False))
    log(f"✅ Batch submitted : {batch_id} ({len(requests_list)} stés)")
    log(f"   Job file : {job_path}")
    return batch_id


async def check_batch(batch_id: str) -> dict:
    return await http_get(
        f"https://api.anthropic.com/v1/messages/batches/{batch_id}",
        base_headers()
    )


async def fetch_results(batch_id: str) -> list[dict]:
    """Récupère les results JSONL du batch terminé."""
    info = await check_batch(batch_id)
    results_url = info.get("results_url")
    if not results_url:
        log(f"ERROR: no results_url for {batch_id}, info: {info}")
        return []
    raw = await http_get(results_url, base_headers(), raw=True)
    out = []
    for line in raw.strip().split("\n"):
        if line:
            try:
                out.append(json.loads(line))
            except Exception as e:
                log(f"   [WARN] parse result line fail: {e}")
    return out


def apply_results(results: list[dict]) -> tuple[int, int, int]:
    """Pour chaque result succès, écrit le JSON validé. Retourne (ok, err, skip)."""
    ok = err = skip = 0
    for item in results:
        ticker = item.get("custom_id", "")
        result = item.get("result", {})
        rtype = result.get("type", "")
        if rtype != "succeeded":
            log(f"   [ERR] {ticker}: result type={rtype}, msg={result}")
            err += 1
            continue
        msg = result.get("message", {})
        content = msg.get("content", [])
        if not content:
            log(f"   [ERR] {ticker}: empty content")
            err += 1
            continue
        text = content[0].get("text", "")
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.M)
        try:
            validated = json.loads(clean)
        except Exception:
            m = re.search(r"\{[\s\S]*\}", clean)
            if not m:
                log(f"   [ERR] {ticker}: no JSON parsable")
                err += 1
                continue
            try:
                validated = json.loads(m.group(0))
            except Exception as e:
                log(f"   [ERR] {ticker}: JSON parse fail: {e}")
                err += 1
                continue
        json_path = OUTPUT_DIR / f"{ticker.lower()}.json"
        if not json_path.exists():
            log(f"   [SKIP] {ticker}: dataset disparu")
            skip += 1
            continue
        backup_path = OUTPUT_DIR / f"{ticker.lower()}.gemini.json"
        backup_path.write_text(json_path.read_text())
        json_path.write_text(json.dumps(validated, ensure_ascii=False, indent=2))
        n_corr = len(validated.get("_validation", []))
        usage = msg.get("usage", {})
        log(f"   ✅ {ticker} : {n_corr} corrections (in={usage.get('input_tokens', 0)} out={usage.get('output_tokens', 0)})")
        ok += 1
    return ok, err, skip


async def cmd_submit(args):
    pl.load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERREUR : ANTHROPIC_API_KEY missing")
        sys.exit(1)
    tickers = [l.strip().upper() for l in open(args.ticker_file).read().splitlines() if l.strip()]
    log(f"SUBMIT : {len(tickers)} tickers, model={args.model}")
    bid = await submit_batch(args.model, tickers)
    if bid:
        print(f"BATCH_ID={bid}")


async def cmd_poll(args):
    pl.load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERREUR : ANTHROPIC_API_KEY missing")
        sys.exit(1)
    job = json.loads(Path(args.job).read_text())
    bid = job["batch_id"]
    info = await check_batch(bid)
    status = info.get("processing_status")
    counts = info.get("request_counts", {})
    log(f"POLL {bid}: status={status} counts={counts}")
    if status == "ended":
        log(f"Batch terminé, fetching results...")
        results = await fetch_results(bid)
        ok, err, skip = apply_results(results)
        log(f"=== Résultats appliqués : {ok} OK, {err} ERR, {skip} SKIP ===")
        # Marquer job comme terminé
        job["completed_at"] = datetime.now().isoformat()
        job["counts_final"] = counts
        job["applied"] = {"ok": ok, "err": err, "skip": skip}
        Path(args.job).write_text(json.dumps(job, indent=2, ensure_ascii=False))


async def cmd_auto(args):
    """Submit puis poll en boucle 5 min jusqu'à fin."""
    pl.load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERREUR : ANTHROPIC_API_KEY missing")
        sys.exit(1)
    tickers = [l.strip().upper() for l in open(args.ticker_file).read().splitlines() if l.strip()]
    log(f"AUTO : {len(tickers)} tickers, model={args.model}")
    bid = await submit_batch(args.model, tickers)
    if not bid:
        return
    job_path = JOBS_DIR / f"{bid}.json"
    while True:
        await asyncio.sleep(args.poll_interval)
        info = await check_batch(bid)
        status = info.get("processing_status")
        counts = info.get("request_counts", {})
        log(f"POLL {bid}: status={status} counts={counts}")
        if status == "ended":
            results = await fetch_results(bid)
            ok, err, skip = apply_results(results)
            log(f"=== AUTO terminé : {ok} OK, {err} ERR, {skip} SKIP ===")
            job = json.loads(job_path.read_text())
            job["completed_at"] = datetime.now().isoformat()
            job["counts_final"] = counts
            job["applied"] = {"ok": ok, "err": err, "skip": skip}
            job_path.write_text(json.dumps(job, indent=2, ensure_ascii=False))
            return


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_submit = sub.add_parser("submit")
    p_submit.add_argument("--model", choices=["sonnet", "haiku"], default="haiku")
    p_submit.add_argument("--ticker-file", required=True)

    p_poll = sub.add_parser("poll")
    p_poll.add_argument("--job", required=True)

    p_auto = sub.add_parser("auto")
    p_auto.add_argument("--model", choices=["sonnet", "haiku"], default="haiku")
    p_auto.add_argument("--ticker-file", required=True)
    p_auto.add_argument("--poll-interval", type=int, default=300, help="seconds between polls")

    args = parser.parse_args()
    if args.cmd == "submit":
        asyncio.run(cmd_submit(args))
    elif args.cmd == "poll":
        asyncio.run(cmd_poll(args))
    elif args.cmd == "auto":
        asyncio.run(cmd_auto(args))


if __name__ == "__main__":
    main()
