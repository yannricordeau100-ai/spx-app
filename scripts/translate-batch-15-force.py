#!/usr/bin/env python3
"""
translate-batch-15-force.py

FORCE OVERWRITE batch 15 (34 stés) FR -> EN + DE via Claude Opus direct.
Bypass du skip-7-jours. Sources refreshées 27 mai 2026.

Usage:
  python3 scripts/translate-batch-15-force.py
"""
from __future__ import annotations
import concurrent.futures as cf
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).parent.parent
MERGED_PATH = ROOT / "src/data/v2-pipeline/_merged.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load .env.local
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
MODEL = "claude-opus-4-5"

BATCH_15 = [
    "VST", "VTR", "VTRS", "VWS.CO", "VZ", "WAB", "WAT", "WBD", "WDAY",
    "WDC", "WEC", "WELL", "WFC", "WM", "WMB", "WMS", "WMT", "WRB", "WSM",
    "WST", "WTW", "WWD", "WY", "WYNN", "XEL", "XOM", "XYL", "XYZ",
    "YAR.OL", "YUM", "ZBH", "ZBRA", "ZTS", "ZURN.SW",
]

ACRONYMS = {
    "KPI", "EPS", "FCF", "TTM", "ARPP", "CAGR", "IPO", "EBITDA", "ROIC",
    "ROE", "ROA", "P/E", "FCFF", "FCFE", "NPV", "GMV", "MAU", "DAU", "ARPU",
    "LTV", "CAC", "MRR", "COGS", "OPEX", "CAPEX", "SaaS", "AI", "ESG", "GICS",
    "TAM", "TAC", "ABF", "DAP", "ARR", "DPS", "P&L", "R&D", "M&A", "Q1",
    "Q2", "Q3", "Q4", "FY", "YoY", "QoQ", "B2B", "B2C", "FX", "USD", "EUR",
}

SYSTEM_PROMPT_EN = """You are a professional French to English financial translator (US English business).

STRICT RULES:
1. Translate ONLY in natural, precise US English business prose.
2. Preserve financial acronyms verbatim (KPI, EPS, FCF, TTM, EBITDA, etc.).
3. Preserve proper nouns (companies, people, products) verbatim.
4. Preserve numbers and currency symbols ($, EUR, GBP, %).
5. Tone: clear investor business style, never inflated marketing.
6. No em-dash. Use colon or comma instead.
7. Preserve verbatim: short (KPI ID), year, month (events).
8. If a French field is empty, output empty string "".
9. Preserve JSON keys exactly. Only translate values.

Response: ONLY the translated JSON, no markdown, no commentary."""

SYSTEM_PROMPT_DE = """Sie sind ein professioneller Französisch-Deutsch Finanzübersetzer (Hochdeutsch, Business-Stil).

STRENGE REGELN:
1. Übersetzen Sie NUR in natürliches, präzises Wirtschaftsdeutsch.
2. Finanzakronyme wörtlich beibehalten (KPI, EPS, FCF, TTM, EBITDA, etc.).
3. Eigennamen wörtlich beibehalten (Unternehmen, Personen, Produkte).
4. Zahlen und Währungssymbole beibehalten ($, EUR, GBP, %).
5. Ton: klarer Investor-Business-Stil, niemals übertriebenes Marketing.
6. Kein Gedankenstrich (em-dash). Verwenden Sie Doppelpunkt oder Komma.
7. Wörtlich beibehalten: short (KPI-ID), year, month (events).
8. Wenn ein französisches Feld leer ist, leerer String "".
9. JSON-Schlüssel exakt beibehalten. Nur Werte übersetzen.

Antwort: NUR das übersetzte JSON, kein Markdown, keine Kommentare."""


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


def build_payload(entry: dict) -> dict:
    out: dict[str, Any] = {
        "hero_kpi_rationale": entry.get("hero_kpi_rationale", "") or "",
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
            "description": e.get("description", "") or e.get("body", "") or "",
        }
        for e in events
    ]
    rbs = entry.get("revenue_by_segment") or {}
    if rbs and rbs.get("slices"):
        out["revenue_by_segment"] = {
            "slices": [{"label": s.get("label", "") or ""} for s in rbs.get("slices", [])]
        }
    rbg = entry.get("revenue_by_geography") or {}
    if rbg and rbg.get("slices"):
        out["revenue_by_geography"] = {
            "slices": [{"label": s.get("label", "") or ""} for s in rbg.get("slices", [])]
        }
    return out


def translate_one(payload: dict, ticker: str, locale: str) -> dict | None:
    system = SYSTEM_PROMPT_EN if locale == "en" else SYSTEM_PROMPT_DE
    target_lang = "English" if locale == "en" else "German (Hochdeutsch)"
    name_field = "name_en" if locale == "en" else "name_de"
    explanation_field = "explanation_en" if locale == "en" else "explanation_de"

    user_prompt = (
        f"Translate this JSON for company {ticker} from French to {target_lang}. "
        f"Preserve the exact structure (same keys). "
        f"For KPIs, output `{name_field}` field as {target_lang} translation of `name_fr` (also translate explanation -> `{explanation_field}`, plus description, signal). "
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
        "max_tokens": 12000,
        "system": system,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    for attempt in range(4):
        try:
            r = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=240)
            if r.status_code == 429:
                wait = 15 + attempt * 15
                print(f"[429] {ticker} {locale}: rate-limited, wait {wait}s", flush=True)
                time.sleep(wait)
                continue
            if r.status_code == 529:
                wait = 30 + attempt * 30
                print(f"[529] {ticker} {locale}: overloaded, wait {wait}s", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            text = r.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
                text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                text = text[start:end + 1]
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[json-err] {ticker} {locale} attempt {attempt + 1}: {e}", flush=True)
            if attempt < 3:
                time.sleep(2 + attempt * 2)
                continue
            return None
        except Exception as e:
            print(f"[err] {ticker} {locale} attempt {attempt + 1}: {e}", flush=True)
            if attempt < 3:
                time.sleep(3 + attempt * 3)
                continue
            return None
    return None


def reshape_kpis(translated: dict, locale: str) -> dict:
    name_field = "name_en" if locale == "en" else "name_de"
    explanation_field = "explanation_en" if locale == "en" else "explanation_de"
    kpis = translated.get("kpis") or []
    new_kpis = []
    for k in kpis:
        item = {
            "short": k.get("short", ""),
            name_field: k.get(name_field) or k.get("name_fr") or k.get("name") or "",
            explanation_field: k.get(explanation_field) or k.get("explanation", "") or "",
            "description": k.get("description", "") or "",
            "signal": k.get("signal", "") or "",
        }
        new_kpis.append(item)
    translated["kpis"] = new_kpis
    return translated


def process_ticker_locale(ticker: str, locale: str, entry: dict) -> tuple[str, str, bool, str]:
    """Returns (ticker, locale, success, message)."""
    out_path = OUT_DIR / f"{ticker.lower()}.{locale}.json"
    payload = build_payload(entry)
    translated = translate_one(payload, ticker, locale)
    if translated is None:
        return (ticker, locale, False, "translation failed")
    translated = reshape_kpis(translated, locale)
    translated["ticker"] = ticker
    translated["locale"] = locale
    translated["_translated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    translated["_translated_by"] = "claude-opus-batch15-force"
    out_path.write_text(json.dumps(translated, ensure_ascii=False, separators=(",", ":")))
    return (ticker, locale, True, f"written {out_path.name}")


def main():
    if not ANTHROPIC_API_KEY:
        print("[fatal] ANTHROPIC_API_KEY missing", file=sys.stderr)
        sys.exit(1)
    if not MERGED_PATH.exists():
        print(f"[fatal] {MERGED_PATH} not found", file=sys.stderr)
        sys.exit(1)

    merged = json.loads(MERGED_PATH.read_text())

    # Build task list: (ticker, locale, entry)
    tasks = []
    for ticker in BATCH_15:
        entry = merged.get(ticker)
        if not entry:
            print(f"[missing] {ticker} not in merged", flush=True)
            continue
        entry = merge_enrich_kpis(ticker, entry)
        tasks.append((ticker, "en", entry))
        tasks.append((ticker, "de", entry))

    print(f"[start] {len(tasks)} tasks (34 stés × 2 locales) via {MODEL}", flush=True)
    t0 = time.time()
    done = 0
    failed = 0
    failed_list = []

    # Parallel: 5 workers
    with cf.ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(process_ticker_locale, t, loc, e): (t, loc) for (t, loc, e) in tasks}
        for fut in cf.as_completed(futures):
            ticker, locale, success, msg = fut.result()
            if success:
                done += 1
                print(f"[ok {done}/{len(tasks)}] {ticker}.{locale} | {msg}", flush=True)
            else:
                failed += 1
                failed_list.append(f"{ticker}.{locale}")
                print(f"[fail {failed}] {ticker}.{locale} | {msg}", flush=True)

    elapsed = (time.time() - t0) / 60
    print(f"\n[end] done={done} failed={failed} | {elapsed:.1f} min", flush=True)
    if failed_list:
        print(f"[failed list] {failed_list}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
