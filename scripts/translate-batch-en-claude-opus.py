#!/usr/bin/env python3
"""
translate-batch-en-claude-opus.py

Mission batch 6/6 final FR -> EN translation pour 110 stés.
Sub-agent Claude Opus (modele claude-opus-4-5 via Anthropic API).

Output: src/data/v2-pipeline-i18n/<ticker>.en.json
Markers: _translated_at (ISO UTC) + _translated_by: "claude-opus-subagent"

Idempotent: skip si fichier existant a _translated_at < 7 jours.

Usage:
  python3 scripts/translate-batch-en-claude-opus.py /tmp/en-batch-6.json
"""
from __future__ import annotations
import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("[fatal] pip install requests", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).parent.parent
MERGED_PATH = ROOT / "src/data/v2-pipeline/_merged.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load .env.local if env not already set
ENV_FILE = ROOT / ".env.local"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and not os.environ.get(k):
            os.environ[k] = v

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-opus-4-5"  # Claude Opus 4.5 latest

ACRONYMS = {
    "KPI", "EPS", "FCF", "TTM", "ARPP", "CAGR", "IPO", "EBITDA", "ROIC",
    "ROE", "ROA", "P/E", "FCFF", "FCFE", "NPV", "GMV", "MAU", "DAU", "ARPU",
    "LTV", "CAC", "MRR", "COGS", "OPEX", "CAPEX", "SaaS", "AI", "ESG", "GICS",
    "TAM", "TAC", "ABF", "DAP", "ARR", "DPS", "P&L", "R&D", "M&A", "Q1",
    "Q2", "Q3", "Q4", "FY", "YoY", "QoQ", "B2B", "B2C", "FX", "USD", "EUR",
}

SYSTEM_PROMPT = """You are a professional French to English financial translator (US English business).

STRICT RULES:
1. Translate ONLY in natural, precise US English business prose.
2. Preserve financial acronyms verbatim (KPI, EPS, FCF, TTM, EBITDA, etc.).
3. Preserve proper nouns (companies, people, products) verbatim.
4. Preserve numbers and currency symbols ($, EUR, GBP, %).
5. Tone: clear investor business style, never inflated marketing.
6. No em-dash. Use colon or comma instead.
7. Preserve verbatim: short (KPI ID), year, month (events).
8. If a French field is empty, output empty string "".

Response: ONLY the translated JSON, no markdown, no commentary."""


def is_pass3(entry: dict) -> bool:
    return bool(entry.get("_validation") or entry.get("_validation_global"))


def merge_enrich_kpis(ticker: str, entry: dict) -> dict:
    slug = ticker.lower()
    enrich_path = ENRICH_DIR / f"{slug}.json"
    if not enrich_path.exists():
        return entry
    try:
        enrich = json.loads(enrich_path.read_text())
    except Exception:
        return entry
    enrich_kpis = enrich.get("kpis")
    if not isinstance(enrich_kpis, list) or not enrich_kpis:
        return entry
    existing = entry.get("kpis") or []
    existing_shorts = {k.get("short") for k in existing if isinstance(k, dict)}
    extra = [k for k in enrich_kpis if isinstance(k, dict) and k.get("short") not in existing_shorts]
    if not extra:
        return entry
    merged_entry = dict(entry)
    merged_entry["kpis"] = list(existing) + list(extra)
    return merged_entry


def build_translation_payload(entry: dict) -> dict:
    out: dict[str, Any] = {
        "tagline": entry.get("tagline", "") or "",
        "hero_kpi_rationale": entry.get("hero_kpi_rationale", "") or "",
        "company_description": entry.get("company_description", "") or "",
    }
    kpis = entry.get("kpis") or []
    out["kpis"] = [
        {
            "short": k.get("short", ""),
            "name_fr": k.get("name_fr", "") or k.get("name", "") or "",
            "explanation": k.get("explanation", "") or "",
            "description": k.get("description", "") or "",
            "signal": k.get("signal", "") or "",
        }
        for k in kpis
    ]
    risks = entry.get("risks") or []
    out["risks"] = [
        {
            "title": r.get("title", "") or "",
            "description": r.get("description", "") or "",
            "summary": r.get("summary", "") or "",
            "score_rationale": r.get("score_rationale", "") or "",
        }
        for r in risks
    ]
    gov = entry.get("governance") or {}
    out["governance"] = {
        "notes": gov.get("notes", "") or "",
        "voting_structure_note": gov.get("voting_structure_note", "") or "",
    }
    ai = entry.get("ai_positioning") or {}
    out["ai_positioning"] = {
        "summary": ai.get("summary", "") or "",
        "evidence": ai.get("evidence", []) or [],
    }
    events = entry.get("events") or []
    out["events"] = [
        {
            "year": e.get("year", ""),
            "month": e.get("month", ""),
            "title": e.get("title", "") or "",
            "body": e.get("body", "") or "",
        }
        for e in events
    ]
    stories = entry.get("stories_kpis") or []
    out["stories_kpis"] = [
        {
            "short": s.get("short", ""),
            "signal": s.get("signal", "") or "",
            "description": s.get("description", "") or "",
        }
        for s in stories
    ]
    return out


def translate_payload_claude(payload: dict, ticker: str) -> dict | None:
    user_prompt = (
        f"Translate this JSON for company {ticker} from French to English. "
        f"Preserve the exact structure (same keys). For KPIs, output `name_en` field as English translation of `name_fr` (also include all other fields translated). "
        f"Preserve verbatim: KPI `short` IDs, event `year` and `month`, and financial acronyms: {', '.join(sorted(ACRONYMS))}.\n\n"
        f"Source JSON:\n{json.dumps(payload, ensure_ascii=False)}\n\n"
        f"Output the translated JSON object only."
    )
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": MODEL,
        "max_tokens": 8000,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    for attempt in range(4):
        try:
            r = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=180)
            if r.status_code == 429:
                wait = 10 + attempt * 10
                print(f"[429] {ticker}: rate-limited, wait {wait}s")
                time.sleep(wait)
                continue
            if r.status_code == 529:
                wait = 30 + attempt * 30
                print(f"[529] {ticker}: overloaded, wait {wait}s")
                time.sleep(wait)
                continue
            r.raise_for_status()
            text = r.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                # Strip code fences
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
                text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()
            # Find JSON braces
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                text = text[start:end+1]
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[json-err] {ticker} attempt {attempt+1}: {e}")
            if attempt < 3:
                time.sleep(2 + attempt * 2)
                continue
            print(f"[err] {ticker}: JSON decode failed after retries")
            return None
        except Exception as e:
            print(f"[err] {ticker} attempt {attempt+1}: {e}")
            if attempt < 3:
                time.sleep(3 + attempt * 3)
                continue
            return None
    return None


def is_fresh_skip(out_path: Path) -> bool:
    """Skip if file exists, has _translated_at, and is < 7 days old."""
    if not out_path.exists():
        return False
    try:
        d = json.loads(out_path.read_text())
        ts = d.get("_translated_at")
        if not ts:
            return False
        dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        age = datetime.datetime.now(datetime.timezone.utc) - dt
        return age.days < 7
    except Exception:
        return False


def reshape_kpis(translated: dict) -> dict:
    """Map name_fr -> name_en in translated KPI items per spec."""
    kpis = translated.get("kpis") or []
    new_kpis = []
    for k in kpis:
        # Claude may have already produced name_en. If not, fallback to name_fr field
        # (which after translation should be EN actually). The spec maps name_fr->name_en.
        item = {
            "short": k.get("short", ""),
            "name_en": k.get("name_en") or k.get("name_fr") or k.get("name") or "",
            "explanation": k.get("explanation", "") or "",
            "description": k.get("description", "") or "",
            "signal": k.get("signal", "") or "",
        }
        new_kpis.append(item)
    translated["kpis"] = new_kpis
    return translated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batch_file", help="Path to JSON file with array of tickers")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--start", type=int, default=0)
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("[fatal] ANTHROPIC_API_KEY missing", file=sys.stderr)
        sys.exit(1)

    tickers = json.load(open(args.batch_file))
    if args.start:
        tickers = tickers[args.start:]
    if args.limit > 0:
        tickers = tickers[: args.limit]

    if not MERGED_PATH.exists():
        print(f"[fatal] {MERGED_PATH} not found", file=sys.stderr)
        sys.exit(1)
    merged = json.loads(MERGED_PATH.read_text())

    print(f"[start] {len(tickers)} stes a traduire EN via {MODEL}")
    done = 0
    skipped = 0
    failed = 0
    failed_tickers = []
    t0 = time.time()

    for i, ticker in enumerate(tickers):
        ticker_u = ticker.upper()
        out_path = OUT_DIR / f"{ticker.lower()}.en.json"

        if is_fresh_skip(out_path):
            skipped += 1
            print(f"[skip-fresh] {ticker} (<7j)")
            continue

        entry = merged.get(ticker_u)
        if not entry or not isinstance(entry, dict):
            print(f"[missing-fr] {ticker}")
            failed += 1
            failed_tickers.append(ticker)
            continue

        entry = merge_enrich_kpis(ticker_u, entry)
        payload = build_translation_payload(entry)
        translated = translate_payload_claude(payload, ticker_u)

        if translated is None:
            failed += 1
            failed_tickers.append(ticker)
            continue

        translated = reshape_kpis(translated)
        translated["ticker"] = ticker_u
        translated["locale"] = "en"
        translated["_translated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        translated["_translated_by"] = "claude-opus-subagent"

        out_path.write_text(json.dumps(translated, ensure_ascii=False, separators=(",", ":")))
        done += 1

        if (i + 1) % 5 == 0 or (i + 1) == len(tickers):
            elapsed = time.time() - t0
            rate = (done + failed) / elapsed if elapsed else 0
            remaining = len(tickers) - (i + 1)
            eta_min = (remaining / rate / 60) if rate else 0
            print(f"[progress] {i+1}/{len(tickers)} | done={done} skip={skipped} fail={failed} | ETA {eta_min:.1f} min")

        time.sleep(1.0)

    elapsed = (time.time() - t0) / 60
    print(f"\n[end] done={done} skipped={skipped} failed={failed} | {elapsed:.1f} min")
    if failed_tickers:
        print(f"[failed] {failed_tickers}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
