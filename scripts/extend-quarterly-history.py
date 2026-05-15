#!/usr/bin/env python3
"""
extend-quarterly-history.py — re-extraction MASSIVE de l'history quarterly
(16-22 trimestres = 4-5 ans) pour tous les KPIs visibles de chaque sté.

Yann 15 mai 2026 : V1.8 dataset CONV-DATA a souvent <10 quarters d'history
(ex GOOGL Cloud Revenue : 9 quarters seulement). Or les 10-K/10-Q locaux
contiennent les chiffres remontant à 2020-2021 minimum. Cette script
re-extrait l'history complète depuis sec-data/cat1-us/{10K,10Q}/{2021..2026}/
via Cerebras (3 clés rotation), en parallèle 4 workers.

Output : src/data/v2-pipeline-enrich/<ticker>.quarterly-history.json
(NE collisionne PAS avec v2-pipeline/<ticker>.json CONV-DATA — merge au
SSR via load-company.ts).

Usage :
  CEREBRAS_API_KEY=xxx CEREBRAS2_API_KEY=yyy CEREBRAS3_API_KEY=zzz \
    python3 scripts/extend-quarterly-history.py --universe top307 [--limit N] [--workers 4]

Universes :
  top307 : src/data/v1-8-tickers-sorted.json[:307]
  sp500  : src/data/v1-7-public.json (~970 stés actuellement)
  test   : ["GOOGL", "NVDA", "AAPL"] (smoke test 3 stés)

RAM cap : 4 workers × ~60 MB chacun = ~240 MB. Sleep 0.3s entre calls
pour éviter rate-limit Cerebras (30 req/min/key × 3 keys = 90/min effectif).
"""
import argparse
import gzip
import json
import multiprocessing as mp
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
SEC = ROOT / "sec-data"
LOG_PATH = ROOT / ".conv-state/quarterly-extend.log"

# Charge .env.local pour récupérer les 3 clés Cerebras si pas dans env
def load_env_local():
    env_file = ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            if k.strip() and not os.environ.get(k.strip()):
                os.environ[k.strip()] = v

load_env_local()

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
]
CEREBRAS_KEYS = [k for k in CEREBRAS_KEYS if k]
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "qwen-3-235b-a22b-instruct-2507"

# Min history target avant skip
MIN_QUARTERS_TARGET = 16  # 4 ans
MAX_KPIS_PER_TICKER = 6   # top 6 KPIs visible par sté (limite tokens prompt)
MAX_DOC_CHARS = 60000     # cap total des docs SEC concaténés
SLEEP_BETWEEN_CALLS = 1.0  # 4 workers × 1s = 4 req/s = 240/min total (sous 270/min limit 3 keys)


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def find_filings(ticker: str, years=range(2020, 2027)) -> list[Path]:
    """Tous les 10-K + 10-Q locaux pour un ticker, triés par date asc.
    Yann 15 mai 2026 : élargi aux 3 catégories source (US cat1, FPI ADR cat2,
    EU pure cat3) pour maximiser la couverture top 307 V1.8."""
    out = []
    for ftype in ("10K", "10Q"):
        for year in years:
            d = SEC / "cat1-us" / ftype / str(year)
            if not d.exists():
                continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                out.append(f)
    # Fallback 1 : FPI ADR (20-F) si pas de 10-K cat1
    if not out:
        for year in years:
            d = SEC / "cat2-foreign-adr" / "20F" / str(year)
            if d.exists():
                for f in d.glob(f"{ticker}_*.htm.gz"):
                    out.append(f)
    # Fallback 2 : EU pure (annual-text dans cat3-european)
    if not out:
        d = SEC / "cat3-european" / ticker / "annual-text"
        if d.exists():
            for f in sorted(d.glob("*.txt")):
                out.append(f)
    return sorted(out)


def extract_text_cat3(txt_file: Path, max_chars: int = 12000) -> str:
    """cat3-european stocke en .txt clean, pas en .htm.gz."""
    try:
        text = txt_file.read_text(errors="ignore")
        text = re.sub(r"\s+", " ", text)
        return text[:max_chars]
    except Exception:
        return ""


def extract_text(htm_gz: Path, max_chars: int = 12000) -> str:
    try:
        with gzip.open(htm_gz, "rt", errors="ignore") as f:
            html = f.read()
    except Exception:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;|&[a-z]+;|&#\d+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text[:max_chars]


def call_cerebras(system: str, user: str, key_idx: int = 0, max_retries: int = 3) -> dict | None:
    """Retry sur key différente si fail/rate-limit. Backoff 2s entre tentatives."""
    if not CEREBRAS_KEYS:
        return None
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
    }
    for attempt in range(max_retries):
        key = CEREBRAS_KEYS[(key_idx + attempt) % len(CEREBRAS_KEYS)]
        try:
            r = requests.post(
                CEREBRAS_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
                timeout=120,
            )
            if r.status_code == 429:
                # Rate limit : attendre puis retry sur clé suivante
                time.sleep(2 + attempt * 2)
                continue
            if r.status_code != 200:
                time.sleep(1)
                continue
            content = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content or content.strip() in ("{}", ""):
                time.sleep(1)
                continue
            return json.loads(content)
        except Exception:
            time.sleep(1)
            continue
    return None


def needs_extension(kpi: dict) -> bool:
    """Un KPI nécessite extension si history < 16 trimestres OU period_type
    pas 'quarter' ET history annuel < 5 ans."""
    hist = kpi.get("history") or []
    if not isinstance(hist, list):
        return True
    if kpi.get("period_type") == "quarter":
        return len(hist) < MIN_QUARTERS_TARGET
    # Annual : on veut au moins 5 ans, sinon convertir en quarter ≥16
    return len(hist) < 5


def process_ticker(ticker: str, worker_id: int) -> str:
    json_path = PIPELINE / f"{ticker.lower()}.json"
    if not json_path.exists():
        return "no-dataset"
    try:
        d = json.loads(json_path.read_text())
    except Exception:
        return "bad-json"

    kpis = d.get("kpis") or []
    if not isinstance(kpis, list) or not kpis:
        return "no-kpis"

    # Sélectionne les top 6 KPIs visibles qui nécessitent extension
    targets = [k for k in kpis[:MAX_KPIS_PER_TICKER] if needs_extension(k)]
    if not targets:
        return "skip-already-complete"

    filings = find_filings(ticker)
    if len(filings) < 3:
        return f"too-few-filings-{len(filings)}"

    # Concat texte (cap MAX_DOC_CHARS total). Prend les filings les plus
    # récents en priorité (5 derniers 10-Q + 5 derniers 10-K).
    chars_per_filing = max(2000, MAX_DOC_CHARS // max(len(filings[-15:]), 1))
    docs_text = []
    for f in filings[-15:]:
        if f.suffix == ".txt":
            txt = extract_text_cat3(f, max_chars=chars_per_filing)
        else:
            txt = extract_text(f, max_chars=chars_per_filing)
        if txt:
            docs_text.append(f"=== {f.name} ===\n{txt}")
    full = "\n\n".join(docs_text)[:MAX_DOC_CHARS]

    if len(full) < 5000:
        return "no-text"

    kpi_list_text = "\n".join(
        f"  - short: {k.get('short')!r} | name: {k.get('name_fr') or k.get('name_en')!r} | unit_actuelle: {k.get('unit')!r}"
        f" | explanation: {(k.get('explanation') or '')[:120]}"
        for k in targets
    )

    system = (
        "Tu es un analyste financier qui extrait des séries temporelles trimestrielles depuis des filings SEC."
        " Tu reçois plusieurs 10-Q et 10-K. Tu dois extraire pour chaque KPI demandé l'history trimestrielle"
        " (16 à 22 trimestres = 4 à 5 ans, du plus ancien au plus récent).\n\n"
        "RÈGLES STRICTES :\n"
        "1. Ordre CHRONOLOGIQUE ASCENDANT (Q1 N-5 → dernier trimestre dispo).\n"
        "2. Si une valeur trimestrielle n'est PAS explicitement présente dans le filing → omettre l'entrée.\n"
        "3. JAMAIS extrapoler / interpoler / inventer.\n"
        "4. Unité : 'Mds $' (milliards USD), 'M $' (millions USD), '%' (pourcentage).\n"
        "5. period_type='quarter' (sauf si KPI annuel uniquement, alors 'year').\n"
        "6. last_data_date = fin de période du dernier point (YYYY-MM-DD).\n"
        "7. Réponse JSON UNIQUEMENT, pas de markdown.\n\n"
        "Format réponse JSON strict :\n"
        '{\n'
        '  "kpis": [\n'
        '    {"short": "<short donné>", "period_type": "quarter|year", "values": [{"period": "Q1 2021", "value": 12.3, "unit": "Mds $"}, ...], "last_data_date": "YYYY-MM-DD"},\n'
        '    ...\n'
        '  ]\n'
        '}'
    )
    user = (
        f"Société : {d.get('name','')} ({ticker})\n"
        f"KPIs à extraire (max {len(targets)}) :\n{kpi_list_text}\n\n"
        f"FILINGS SEC :\n{full}\n\n"
        f"Réponds avec le JSON strict."
    )

    result = call_cerebras(system, user, key_idx=worker_id)
    if not result or not isinstance(result.get("kpis"), list):
        return "llm-fail"

    extracted = result["kpis"]
    out_kpis = []
    for entry in extracted:
        short = entry.get("short")
        if not short:
            continue
        values = entry.get("values") or []
        if len(values) < 4:
            continue
        history = [v.get("value") for v in values if isinstance(v.get("value"), (int, float))]
        periods = [v.get("period") for v in values if isinstance(v.get("value"), (int, float))]
        if not history:
            continue
        out_kpis.append({
            "short": short,
            "period_type": entry.get("period_type") or "quarter",
            "history": history,
            "history_periods": periods,
            "last_data_date": entry.get("last_data_date"),
            "unit": values[-1].get("unit") if values else None,
            "_extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "_source": "cerebras-qwen-3-235b · 10-K/10-Q",
        })

    if not out_kpis:
        return "llm-empty"

    ENRICH.mkdir(parents=True, exist_ok=True)
    out_path = ENRICH / f"{ticker.lower()}.quarterly-history.json"
    out_path.write_text(json.dumps({
        "ticker": ticker,
        "extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "n_kpis": len(out_kpis),
        "kpis": out_kpis,
    }, ensure_ascii=False, indent=2))
    return f"ok-{len(out_kpis)}kpis"


def worker_main(args):
    ticker, worker_id = args
    try:
        r = process_ticker(ticker, worker_id)
    except Exception as e:
        r = f"err-{type(e).__name__}-{str(e)[:60]}"
    log(f"  {('✅' if r.startswith('ok') else '⚠')} [w{worker_id}] {ticker:8} → {r}")
    time.sleep(SLEEP_BETWEEN_CALLS)
    return ticker, r


def load_universe(name: str) -> list[str]:
    if name == "top307":
        f = ROOT / "src/data/v1-8-tickers-sorted.json"
        return json.loads(f.read_text())[:307]
    if name == "sp500":
        f = ROOT / "src/data/v1-7-public.json"
        if not f.exists():
            return []
        data = json.loads(f.read_text())
        if isinstance(data, list):
            # array of objects or strings
            if data and isinstance(data[0], str):
                return data
            return [d.get("ticker") for d in data if d.get("ticker")]
        if isinstance(data, dict):
            return list(data.keys())
        return []
    if name == "test":
        return ["GOOGL", "NVDA", "AAPL"]
    raise ValueError(f"unknown universe {name}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--universe", choices=["top307", "sp500", "test"], default="test")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--skip-existing", action="store_true",
                   help="skip stés qui ont déjà un .quarterly-history.json à jour <7 jours")
    args = p.parse_args()

    if not CEREBRAS_KEYS:
        print("[FATAL] No CEREBRAS_API_KEY found in env or .env.local", file=sys.stderr)
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log(f"=== START universe={args.universe} workers={args.workers} keys={len(CEREBRAS_KEYS)} ===")

    tickers = load_universe(args.universe)
    if args.limit:
        tickers = tickers[:args.limit]

    if args.skip_existing:
        before = len(tickers)
        ENRICH.mkdir(parents=True, exist_ok=True)
        kept = []
        cutoff = time.time() - 7 * 24 * 3600
        for t in tickers:
            f = ENRICH / f"{t.lower()}.quarterly-history.json"
            if f.exists() and f.stat().st_mtime > cutoff:
                continue
            kept.append(t)
        log(f"skip-existing : {before} → {len(kept)}")
        tickers = kept

    log(f"processing {len(tickers)} stés")
    work = [(t, i % args.workers) for i, t in enumerate(tickers)]

    counts = {}
    with mp.Pool(args.workers) as pool:
        for ticker, r in pool.imap_unordered(worker_main, work):
            counts[r.split("-")[0]] = counts.get(r.split("-")[0], 0) + 1

    log(f"=== DONE counts={counts} ===")


if __name__ == "__main__":
    main()
