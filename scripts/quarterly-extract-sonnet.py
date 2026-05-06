#!/usr/bin/env python3
"""
Quarterly mass-extraction v2 : Sonnet 4.5 + pré-parsing regex tables 10-Q.

Améliorations vs Cerebras :
  - Pré-parser regex extrait les tables financières structurées (Revenue, Op Income,
    segments) des 10-Q → LLM reçoit ~5-10K chars structurés au lieu de 60K chaotiques
  - Sonnet 4.5 : meilleure compréhension de tables financières, ~80% succès vs 10% Cerebras
  - Skip si period_type=quarter déjà présent (idempotent)

Usage :
  ANTHROPIC_API_KEY=sk-... python3 scripts/quarterly-extract-sonnet.py \
    --ticker-file <list> [--limit N] [--budget 5]
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

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-5"
PRICE_IN = 3.0   # $/M tokens
PRICE_OUT = 15.0  # $/M tokens

_spent = 0.0
_calls = 0


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n"); fh.flush()


def find_filings(ticker: str, types: list[str] = None) -> list[Path]:
    """Trouve 10-Q + 10-K du ticker dans cat1-us et cat2-foreign-adr."""
    if types is None:
        types = ["10Q", "10K"]
    out = []
    for ftype in types:
        # Cat 1 USA
        for year in range(2021, 2027):
            d = SEC_DIR / "cat1-us" / ftype / str(year)
            if d.exists():
                out.extend(d.glob(f"{ticker}_*.htm.gz"))
        # Cat 2 ADR (20-F annuel + 6-K interim)
        for ftype2 in ("20F", "6K"):
            for year in range(2021, 2027):
                d = SEC_DIR / "cat2-foreign-adr" / ftype2 / str(year)
                if d.exists():
                    out.extend(d.glob(f"{ticker}_*.htm.gz"))
    return sorted(out)


def extract_text_clean(htm_gz: Path) -> str:
    """Lit + clean HTML simplement, retourne texte plat."""
    try:
        with gzip.open(htm_gz, "rt", errors="ignore") as f:
            html = f.read()
    except Exception:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;|&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


# ---- Pré-parser regex : extrait les tables financières structurées ----
TABLE_KEYWORDS = [
    "Revenue", "Net revenue", "Net sales", "Total revenue", "Total net sales",
    "Operating income", "Operating loss", "Operating profit", "Net income",
    "Adjusted EBITDA", "Total revenues",
    # Segments
    "Service revenue", "Product revenue", "Subscription revenue",
    "Cloud revenue", "Data Center", "Gaming", "Automotive",
    "Consumer", "Enterprise", "International",
]


def extract_tables(text: str) -> str:
    """Extrait les zones de texte autour des keywords financiers (tables)."""
    text_lower = text.lower()
    excerpts = []
    seen_pos = set()
    for kw in TABLE_KEYWORDS:
        kw_lower = kw.lower()
        idx = 0
        while True:
            pos = text_lower.find(kw_lower, idx)
            if pos < 0:
                break
            # Skip si déjà couvert
            if any(abs(pos - s) < 800 for s in seen_pos):
                idx = pos + 1
                continue
            seen_pos.add(pos)
            # Extrait ±800 chars autour
            start = max(0, pos - 200)
            end = min(len(text), pos + 800)
            excerpts.append(text[start:end])
            idx = pos + 1
            if len(excerpts) > 30:
                break
        if len(excerpts) > 30:
            break
    # Concat unique, max 12K chars
    joined = "\n---\n".join(excerpts)
    return joined[:12000]


def call_sonnet(system: str, user: str) -> tuple[dict | None, dict]:
    global _spent, _calls
    body = {
        "model": MODEL,
        "max_tokens": 3000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        r = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=120)
        if r.status_code != 200:
            return None, {"error": f"http_{r.status_code}", "body": r.text[:200]}
        data = r.json()
        if "content" not in data:
            return None, {"error": "no_content", "data": str(data)[:200]}
        text = data["content"][0]["text"]
        # Strip markdown
        text = re.sub(r"^```(?:json)?\s*|\s*```\s*$", "", text.strip(), flags=re.M)
        usage = data.get("usage", {})
        in_t = usage.get("input_tokens", 0)
        out_t = usage.get("output_tokens", 0)
        cost = (in_t * PRICE_IN + out_t * PRICE_OUT) / 1_000_000
        _spent += cost
        _calls += 1
        try:
            return json.loads(text), {"in_t": in_t, "out_t": out_t, "cost": cost}
        except Exception:
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                try: return json.loads(m.group(0)), {"in_t": in_t, "out_t": out_t, "cost": cost}
                except: pass
            return None, {"error": "json_parse", "text": text[:200]}
    except Exception as e:
        return None, {"error": str(e)[:200]}


def process_ticker(ticker: str, fh=None, budget_max=5.0) -> str:
    global _spent
    if _spent >= budget_max:
        return "budget-exceeded"

    json_path = OUT_DIR / f"{ticker.lower()}.json"
    if not json_path.exists():
        return "no-dataset"
    try:
        d = json.loads(json_path.read_text())
    except:
        return "bad-json"

    kpis = d.get("kpis", [])
    hero_short = d.get("hero_kpi")
    hero_kpi = next((k for k in kpis if k.get("short") == hero_short), kpis[0] if kpis else None)
    if not hero_kpi:
        return "no-hero"
    if hero_kpi.get("period_type") == "quarter":
        return "skip-already-quarter"

    filings = find_filings(ticker)
    if not filings:
        return "no-filings"

    # Concat texte des 8 derniers filings, pré-parse tables
    texts = []
    for f in filings[-8:]:
        text = extract_text_clean(f)
        if text:
            tables = extract_tables(text)
            if tables:
                texts.append(f"=== {f.name} ===\n{tables}")
    if not texts:
        return "no-tables"

    combined = "\n\n".join(texts)[:30000]

    system = """Tu extrais les valeurs trimestrielles d'un KPI depuis des extraits de 10-Q/10-K SEC.

Format JSON strict obligatoire :
{
  "values": [
    {"quarter": "Q1 2021", "value": 12.3, "unit": "Mds $"},
    ...
  ],
  "last_data_date": "2025-12-31",
  "currency": "USD"
}

CONTRAINTES :
- Ordre chronologique ascendant.
- Cible 16-20 trimestres si possible (Q1 2021 → Q4 2025).
- Si valeur incertaine ou absente : OMETTRE l'entrée. Ne jamais inventer.
- Unité : "Mds $" pour milliards, "M $" pour millions, "%" pour pourcent.
- last_data_date au format YYYY-MM-DD (fin de période).
- Réponds UNIQUEMENT avec le JSON, sans markdown."""

    user = (
        f"KPI à extraire : {hero_kpi.get('name_fr') or hero_short}\n"
        f"  EN : {hero_kpi.get('name_en','')}\n"
        f"  Description : {hero_kpi.get('explanation','')[:200]}\n"
        f"Société : {d.get('name','')} ({ticker})\n"
        f"Unité actuelle : {hero_kpi.get('unit','')}\n\n"
        f"EXTRAITS DES TABLES FINANCIÈRES :\n{combined}\n\n"
        f"Renvoie le JSON quarterly extrait."
    )

    result, meta = call_sonnet(system, user)
    if not result:
        return f"llm-fail-{meta.get('error','?')}"
    values = result.get("values", [])
    if len(values) < 6:
        return "too-few-values"

    history = [v.get("value") for v in values if v.get("value") is not None]
    if len(history) < 6:
        return "no-numeric"

    hero_kpi["period_type"] = "quarter"
    hero_kpi["history"] = history
    if result.get("last_data_date"):
        hero_kpi["last_data_date"] = result["last_data_date"]
    if values[-1].get("unit"):
        hero_kpi["unit"] = values[-1]["unit"]
    if values[-1].get("value") is not None:
        hero_kpi["value"] = values[-1]["value"]
    d.setdefault("_quarterly_extraction", {}).update({
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "n_quarters": len(history),
        "model": MODEL,
        "cost_usd": round(meta.get("cost", 0), 4),
    })
    json_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    return f"ok-{len(history)}q"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker-file", required=True)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--budget", type=float, default=5.0)
    args = p.parse_args()

    if not ANTHROPIC_API_KEY:
        print("[fatal] ANTHROPIC_API_KEY missing", file=sys.stderr)
        sys.exit(1)

    log_path = ROOT / f"sec-data/_meta/quarterly-sonnet-{os.getpid()}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = open(log_path, "a")

    tickers = [l.strip().upper() for l in Path(args.ticker_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    log(f"QUARTERLY SONNET : {len(tickers)} stés, budget=${args.budget}", fh)

    counts = {}
    for tk in tickers:
        if _spent >= args.budget:
            log(f"  Budget cap ${args.budget} atteint", fh)
            break
        try:
            r = process_ticker(tk, fh, args.budget)
        except Exception as e:
            r = f"err-{type(e).__name__}"
        counts[r] = counts.get(r, 0) + 1
        marker = "✅" if r.startswith("ok") else ("⏭" if r.startswith("skip") else "⚠")
        log(f"  {marker} {tk} : {r} (spent ${_spent:.3f})", fh)
    log(f"=== TOTAL : {counts} | spent ${_spent:.3f} | calls {_calls} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
