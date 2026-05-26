#!/usr/bin/env python3
"""
extract-new-filings-cerebras.py — Composant 2 mission daily-doc-watcher.

Scanne sec-data/cat1-us/ (et cat2, cat3) pour filings ajoutés < N jours
(default 7). Pour chaque, identifie ticker + type (10-Q, 10-K, 8-K).

Extraction Cerebras Qwen-3 free tier (3 keys rotation) :
- Hero KPI history : étendre avec le nouveau trimestre
- Earnings call sentiment si 8-K
- Risks update si Item 1A modifié

Merge dans src/data/v2-pipeline-enrich/<ticker>.json field latest_filing_update.

Si Cerebras saturé : skip avec _extraction_pending: true, retry au prochain cron.
ZÉRO API Anthropic payant.

Usage :
  python3 scripts/extract-new-filings-cerebras.py [--days 7] [--max 50] [--dry-run]
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEC_DATA = ROOT / "sec-data"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SSL_CTX = ssl.create_default_context()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_api_keys() -> list[str]:
    """3 keys rotation Cerebras free tier."""
    raw = [
        os.environ.get("CEREBRAS_API_KEY_0") or os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS_API_KEY_1") or os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS_API_KEY_2") or os.environ.get("CEREBRAS3_API_KEY"),
    ]
    return [k for k in raw if k]


def call_cerebras(prompt: str, api_key: str, retries: int = 2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "content-type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError:
                        pass
                return None, "json_parse"
        except urllib.error.HTTPError as e:
            if e.code == 429:
                return None, "rate_limit"
            if e.code in (402, 401):
                return None, f"http_{e.code}_quota"
            return None, f"http_{e.code}"
        except Exception as ex:
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"ex_{type(ex).__name__}"
    return None, "exhausted"


FILING_FILENAME_RE = re.compile(r"^([A-Z0-9.\-]+)_(\d{4}-\d{2}-\d{2})\.(htm\.gz|txt|html?)$", re.I)


def scan_recent_filings(days: int = 7) -> list[dict]:
    """Trouve les filings cat1/cat2/cat3 modifiés/créés dans les N derniers jours."""
    cutoff = time.time() - days * 86400
    out = []

    # cat1-us : sec-data/cat1-us/{10K,10Q,8K}/<year>/<TICKER>_<date>.htm.gz
    for form in ("10K", "10Q", "8K"):
        form_dir = SEC_DATA / "cat1-us" / form
        if not form_dir.exists():
            continue
        for f in form_dir.rglob("*"):
            if not f.is_file():
                continue
            if f.stat().st_mtime < cutoff:
                continue
            m = FILING_FILENAME_RE.match(f.name)
            if not m:
                continue
            ticker, filing_date = m.group(1), m.group(2)
            out.append({
                "ticker": ticker,
                "form": form,
                "filing_date": filing_date,
                "path": str(f.relative_to(ROOT)),
                "category": "cat1-us",
            })

    # cat2-foreign-adr : sec-data/cat2-foreign-adr/{20F,6K}/<year>/<TICKER>_<date>.htm.gz
    for form in ("20F", "6K"):
        form_dir = SEC_DATA / "cat2-foreign-adr" / form
        if not form_dir.exists():
            continue
        for f in form_dir.rglob("*"):
            if not f.is_file():
                continue
            if f.stat().st_mtime < cutoff:
                continue
            m = FILING_FILENAME_RE.match(f.name)
            if not m:
                continue
            ticker, filing_date = m.group(1), m.group(2)
            out.append({
                "ticker": ticker,
                "form": form,
                "filing_date": filing_date,
                "path": str(f.relative_to(ROOT)),
                "category": "cat2-foreign-adr",
            })

    # cat3-european : sec-data/cat3-european/<TICKER>/annual-text/<year>.txt (recent mod)
    cat3 = SEC_DATA / "cat3-european"
    if cat3.exists():
        for d in cat3.iterdir():
            if not d.is_dir():
                continue
            ticker = d.name
            annual = d / "annual-text"
            if not annual.exists():
                continue
            for f in annual.iterdir():
                if not f.is_file():
                    continue
                if f.stat().st_mtime < cutoff:
                    continue
                stem = f.stem
                if not re.match(r"^\d{4}$", stem):
                    continue
                out.append({
                    "ticker": ticker,
                    "form": "ANNUAL",
                    "filing_date": f"{stem}-12-31",
                    "path": str(f.relative_to(ROOT)),
                    "category": "cat3-european",
                })
    return out


def read_filing_text(rel_path: str, max_chars: int = 60000) -> str:
    p = ROOT / rel_path
    try:
        if p.suffix == ".gz":
            with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as fh:
                raw = fh.read(max_chars * 4)
        else:
            raw = p.read_text(errors="ignore")[: max_chars * 4]
    except Exception:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\s+", " ", text)
    return text[:max_chars]


def find_enrich_file(ticker: str) -> Path | None:
    for c in [ticker.lower(), ticker.lower().replace(".", "-"), ticker.lower().replace("-", ".")]:
        p = ENRICH_DIR / f"{c}.json"
        if p.exists():
            return p
    return None


def find_pipeline_file(ticker: str) -> Path | None:
    for c in [ticker.lower(), ticker.lower().replace(".", "-"), ticker.lower().replace("-", ".")]:
        p = PIPELINE_DIR / f"{c}.json"
        if p.exists():
            return p
    return None


def build_prompt(ticker: str, form: str, filing_date: str, hero_kpi_short: str | None, hero_unit: str | None, text: str) -> str:
    hero_hint = f'Hero KPI to update: "{hero_kpi_short}" (unit: {hero_unit or "?"}).' if hero_kpi_short else ""
    return f"""You are a financial extractor. Read this {form} filing for {ticker} dated {filing_date}.

{hero_hint}

Return STRICT JSON :
{{
  "hero_value_new": <number or null>,
  "hero_period_end": "<YYYY-MM-DD or null>",
  "risks_changed": <true|false>,
  "sentiment": "<positive|neutral|cautious|null>",
  "key_takeaway": "<one short FR sentence or null>"
}}

Only fill hero_value_new if you find the EXACT figure for "{hero_kpi_short}" in this filing.
If unsure or not found, return null. NEVER fabricate.

TEXT:
{text}
"""


def extract_one(filing: dict, keys: list[str], key_idx_ref: list[int]) -> dict:
    ticker = filing["ticker"]
    result = {"ticker": ticker, "form": filing["form"], "filing_date": filing["filing_date"], "status": "skip"}

    enrich_path = find_enrich_file(ticker)
    if not enrich_path:
        result["status"] = "no_enrich"
        return result

    try:
        enrich = json.loads(enrich_path.read_text())
    except Exception:
        result["status"] = "enrich_parse_err"
        return result

    existing = enrich.get("latest_filing_update") or {}
    if existing.get("filing_date") == filing["filing_date"] and existing.get("form_type") == filing["form"]:
        result["status"] = "already_extracted"
        return result

    # Hero KPI context
    hero_short = None
    hero_unit = None
    pipe_path = find_pipeline_file(ticker)
    if pipe_path:
        try:
            pipe = json.loads(pipe_path.read_text())
            hero_short = pipe.get("hero_kpi")
            if hero_short:
                for k in pipe.get("kpis", []):
                    if k.get("short") == hero_short:
                        hero_unit = k.get("unit")
                        break
        except Exception:
            pass

    text = read_filing_text(filing["path"])
    if not text or len(text) < 500:
        result["status"] = "text_too_short"
        return result

    prompt = build_prompt(ticker, filing["form"], filing["filing_date"], hero_short, hero_unit, text)

    if not keys:
        result["status"] = "no_cerebras_key"
        return result

    data, err = call_cerebras(prompt, keys[key_idx_ref[0] % len(keys)])
    key_idx_ref[0] += 1

    if err == "rate_limit" or (err and "quota" in err):
        # Saturé : mark pending, retry au prochain cron
        enrich["latest_filing_update"] = {
            "filing_date": filing["filing_date"],
            "form_type": filing["form"],
            "_extraction_pending": True,
            "_last_attempt_at": now_iso(),
            "_last_error": err,
        }
        enrich_path.write_text(json.dumps(enrich, indent=2, ensure_ascii=False) + "\n")
        result["status"] = "pending"
        result["error"] = err
        return result

    if err or not data:
        result["status"] = "llm_err"
        result["error"] = err or "no_data"
        return result

    enrich["latest_filing_update"] = {
        "filing_date": filing["filing_date"],
        "form_type": filing["form"],
        "hero_value_new": data.get("hero_value_new"),
        "hero_period_end": data.get("hero_period_end"),
        "risks_changed": bool(data.get("risks_changed")),
        "sentiment": data.get("sentiment"),
        "key_takeaway": data.get("key_takeaway"),
        "source_path": filing["path"],
        "extracted_at": now_iso(),
    }
    enrich_path.write_text(json.dumps(enrich, indent=2, ensure_ascii=False) + "\n")
    result["status"] = "extracted"
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--max", type=int, default=50, help="Max filings to process this run")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    filings = scan_recent_filings(args.days)
    print(f"[extract-new-filings] Found {len(filings)} filings modified < {args.days}d")

    if args.dry_run:
        for f in filings[:20]:
            print(f"  {f['ticker']:8} {f['form']:6} {f['filing_date']} {f['path']}")
        return

    keys = get_api_keys()
    print(f"  Cerebras keys: {len(keys)} (rotation)")
    if not keys:
        print("  WARN: no Cerebras keys, will mark all pending")

    filings = filings[: args.max]
    key_idx_ref = [0]
    results = []
    for i, f in enumerate(filings, 1):
        r = extract_one(f, keys, key_idx_ref)
        results.append(r)
        if i % 10 == 0 or i == len(filings):
            print(f"  {i}/{len(filings)}")

    counts = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print(f"\n[extract-new-filings] Done. Status: {counts}")


if __name__ == "__main__":
    main()
