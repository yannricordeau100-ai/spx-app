#!/usr/bin/env python3
"""
Quarterly mass-extraction (CONV-SYSTEMS broadcast 5 mai 05:05).

Pour chaque sté, lit les 10-Q + 10-K locaux des 5 dernières années,
extrait 16-20 valeurs trimestrielles du hero_kpi via Cerebras gratuit,
patche dataset.kpis[hero].period_type='quarter' + history.

Usage : python3 scripts/quarterly-extract.py --ticker-file <list> [--limit N]
"""
import argparse
import gzip
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src/data/v2-pipeline"
SEC_DIR = ROOT / "sec-data"
LOG_PATH = ROOT / "sec-data/_meta/quarterly-extract.log"

CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "qwen-3-235b-a22b-instruct-2507"

QUARTER_END_BY_MONTH = {
    1: ("Q4", "prev"), 2: ("Q4", "prev"), 3: ("Q4", "prev"),
    4: ("Q1", "current"), 5: ("Q1", "current"), 6: ("Q1", "current"),
    7: ("Q2", "current"), 8: ("Q2", "current"), 9: ("Q2", "current"),
    10: ("Q3", "current"), 11: ("Q3", "current"), 12: ("Q3", "current"),
}


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n"); fh.flush()


def find_filings_for_ticker(ticker: str, years: list[int] = None) -> list[Path]:
    """Trouve tous les 10-Q + 10-K pour un ticker dans cat1-us."""
    if years is None:
        years = [2021, 2022, 2023, 2024, 2025]
    out = []
    for ftype in ("10Q", "10K"):
        for year in years:
            d = SEC_DIR / "cat1-us" / ftype / str(year)
            if not d.exists():
                continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                out.append(f)
    return sorted(out)


def extract_text(htm_gz: Path, max_chars: int = 80000) -> str:
    try:
        with gzip.open(htm_gz, "rt", errors="ignore") as f:
            html = f.read()
    except Exception:
        return ""
    # Strip HTML tags simply
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text[:max_chars]


def call_llm(system: str, user: str) -> dict | None:
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "max_tokens": 2500,
    }
    try:
        r = requests.post(CEREBRAS_URL,
            headers={"Authorization": f"Bearer {CEREBRAS_API_KEY}", "Content-Type": "application/json"},
            json=body, timeout=120)
        if r.status_code != 200:
            return None
        return json.loads(r.json()["choices"][0]["message"]["content"])
    except Exception:
        return None


def process_ticker(ticker: str, fh=None) -> str:
    json_path = OUT_DIR / f"{ticker.lower()}.json"
    if not json_path.exists():
        return "no-dataset"
    try:
        d = json.loads(json_path.read_text())
    except Exception:
        return "bad-json"

    kpis = d.get("kpis", [])
    hero_short = d.get("hero_kpi")
    hero_kpi = next((k for k in kpis if k.get("short") == hero_short), None)
    if not hero_kpi:
        # fallback : 1er KPI
        hero_kpi = kpis[0] if kpis else None
    if not hero_kpi:
        return "no-hero"

    if hero_kpi.get("period_type") == "quarter":
        return "skip-already-quarter"

    filings = find_filings_for_ticker(ticker)
    if len(filings) < 4:
        return "too-few-filings"

    # Concat texte (max 80K total)
    docs_text = []
    for f in filings[-12:]:  # 12 derniers filings = 3 ans
        txt = extract_text(f, max_chars=8000)
        if txt:
            docs_text.append(f"=== {f.name} ===\n{txt}")
    full = "\n\n".join(docs_text)[:60000]

    if len(full) < 5000:
        return "no-text"

    system = """Tu es un analyste financier. Tu reçois plusieurs 10-Q et 10-K.
Ta mission : extraire les valeurs TRIMESTRIELLES du KPI demandé sur 16-20 trimestres.

Format réponse JSON strict :
{
  "period_type": "quarter",
  "values": [
    {"quarter": "Q1 2021", "value": 12.3, "unit": "Mds $"},
    {"quarter": "Q2 2021", "value": 13.1, "unit": "Mds $"},
    ...
  ],
  "last_data_date": "2025-09-30",
  "currency": "USD"
}

CONTRAINTES :
- Ordre chronologique ascendant (Q1 2021 → Q4 2025).
- Si valeur manquante → omettre l'entrée plutôt qu'inventer.
- Unité : "Mds $" pour milliards, "M $" pour millions, "%" pour pourcent.
- last_data_date = fin de période du dernier trimestre dispo (YYYY-MM-DD).
- Réponse UNIQUEMENT JSON, pas de markdown."""

    user = (
        f"KPI à extraire : {hero_kpi.get('name_fr') or hero_short} ({hero_kpi.get('name_en','')})\n"
        f"Description : {hero_kpi.get('explanation','')[:300]}\n"
        f"Société : {d.get('name','')} ({ticker})\n"
        f"Unité actuelle : {hero_kpi.get('unit','')}\n\n"
        f"DOCS SEC à parser :\n{full}\n\n"
        f"Renvoie le JSON quarterly extrait."
    )

    result = call_llm(system, user)
    if not result or not result.get("values"):
        return "llm-fail"

    values = result["values"]
    if len(values) < 8:
        return "too-few-values"

    # Patch dataset
    history = [v.get("value") for v in values if v.get("value") is not None]
    if not history:
        return "no-numeric-values"

    hero_kpi["period_type"] = "quarter"
    hero_kpi["history"] = history
    hero_kpi["last_data_date"] = result.get("last_data_date")
    if values[-1].get("unit"):
        hero_kpi["unit"] = values[-1]["unit"]
    if values[-1].get("value") is not None:
        hero_kpi["value"] = values[-1]["value"]

    # Marker
    d.setdefault("_quarterly_extraction", {}).update({
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "n_quarters": len(history),
        "model": "cerebras-qwen-3-235b",
    })

    json_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    return f"ok-{len(history)}q"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker-file", required=True)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    if not CEREBRAS_API_KEY:
        print("[fatal] CEREBRAS_API_KEY missing", file=sys.stderr); sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")

    tickers = [l.strip().upper() for l in Path(args.ticker_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    log(f"QUARTERLY EXTRACT : {len(tickers)} stés", fh)

    counts = {}
    for tk in tickers:
        try:
            r = process_ticker(tk, fh)
        except Exception as e:
            log(f"  [ERR] {tk}: {e}", fh)
            r = f"err-{type(e).__name__}"
        counts[r] = counts.get(r, 0) + 1
        if r.startswith("ok"):
            log(f"  ✅ {tk} : {r}", fh)
        else:
            log(f"  ⚠ {tk} : {r}", fh)
        time.sleep(0.3)
    log(f"=== TOTAL : {counts} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
