#!/usr/bin/env python3
"""
Retry failed translations from batch 15 with better parsing + larger token budget.
"""
from __future__ import annotations
import datetime
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).parent.parent
MERGED_PATH = ROOT / "src/data/v2-pipeline/_merged.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"

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

FAILED = [
    ("WBD", "en"),
    ("WELL", "en"),
    ("WMT", "en"),
    ("XEL", "en"),
    ("XYL", "en"),
    ("XEL", "de"),
    ("XYL", "de"),
    ("XYZ", "en"),
    ("YUM", "en"),
    ("ZBH", "de"),
]

ACRONYMS = sorted({
    "KPI", "EPS", "FCF", "TTM", "ARPP", "CAGR", "IPO", "EBITDA", "ROIC",
    "ROE", "ROA", "P/E", "FCFF", "FCFE", "NPV", "GMV", "MAU", "DAU", "ARPU",
    "LTV", "CAC", "MRR", "COGS", "OPEX", "CAPEX", "SaaS", "AI", "ESG", "GICS",
    "TAM", "TAC", "ABF", "DAP", "ARR", "DPS", "R&D", "M&A", "Q1",
    "Q2", "Q3", "Q4", "FY", "YoY", "QoQ", "B2B", "B2C", "FX", "USD", "EUR",
})

SYS_EN = """You are a professional French to English financial translator (US English business).

CRITICAL: Output VALID JSON only. Escape all double quotes inside strings with \\". Never include unescaped newlines inside strings (use \\n). Never include raw control characters.

STRICT RULES:
1. Translate ONLY in natural, precise US English business prose.
2. Preserve financial acronyms verbatim.
3. Preserve proper nouns verbatim.
4. Preserve numbers and currency symbols.
5. Tone: clear investor business style.
6. No em-dash. Use colon or comma instead.
7. Preserve verbatim: short, year, month.
8. If a French field is empty, output empty string "".
9. Preserve JSON keys exactly. Only translate values.

Response: ONLY the translated JSON object. No markdown fences. No commentary."""

SYS_DE = """Sie sind ein professioneller Französisch-Deutsch Finanzübersetzer.

KRITISCH: Geben Sie NUR gültiges JSON aus. Escapen Sie alle Anführungszeichen in Strings mit \\". Niemals unescapte Zeilenumbrüche in Strings (verwenden Sie \\n). Niemals rohe Steuerzeichen.

STRENGE REGELN:
1. Übersetzen Sie NUR in natürliches, präzises Wirtschaftsdeutsch.
2. Finanzakronyme wörtlich beibehalten.
3. Eigennamen wörtlich beibehalten.
4. Zahlen und Währungssymbole beibehalten.
5. Ton: klarer Investor-Business-Stil.
6. Kein Gedankenstrich.
7. Wörtlich beibehalten: short, year, month.
8. Wenn ein französisches Feld leer ist, leerer String "".
9. JSON-Schlüssel exakt beibehalten.

Antwort: NUR das übersetzte JSON-Objekt. Keine Markdown-Codeblöcke. Keine Kommentare."""


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


def repair_json(text: str) -> str | None:
    """Try aggressive repair of malformed JSON."""
    # Strip markdown fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()
    # Find outer braces
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    text = text[start:end + 1]
    # Replace literal control chars inside strings (rough)
    # Replace \r with \n then escape unescaped newlines
    return text


def try_parse(text: str) -> dict | None:
    repaired = repair_json(text)
    if not repaired:
        return None
    # Try direct
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass
    # Try fixing common issues: unescaped newlines inside strings
    try:
        # Replace literal newlines/tabs inside quoted strings
        fixed = re.sub(r'(?<!\\)\n', r'\\n', repaired)
        fixed = re.sub(r'(?<!\\)\t', r'\\t', fixed)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    # Try removing trailing commas
    try:
        fixed = re.sub(r',(\s*[}\]])', r'\1', repaired)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    return None


def translate_one(payload: dict, ticker: str, locale: str) -> dict | None:
    system = SYS_EN if locale == "en" else SYS_DE
    target = "English" if locale == "en" else "German (Hochdeutsch)"
    name_field = "name_en" if locale == "en" else "name_de"
    expl_field = "explanation_en" if locale == "en" else "explanation_de"

    user = (
        f"Translate this JSON for company {ticker} from French to {target}. "
        f"Preserve the exact structure (same keys). "
        f"For KPIs, output `{name_field}` (translate name_fr) and `{expl_field}` (translate explanation), plus translate description and signal. "
        f"Preserve verbatim: KPI `short` IDs, event year/month, acronyms: {', '.join(ACRONYMS)}.\n\n"
        f"IMPORTANT: Output STRICTLY VALID JSON. Escape every \\\" inside strings. Never put raw newlines inside string values.\n\n"
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
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    for attempt in range(5):
        try:
            r = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=300)
            if r.status_code == 429:
                time.sleep(15 + attempt * 15)
                continue
            if r.status_code == 529:
                time.sleep(30 + attempt * 30)
                continue
            r.raise_for_status()
            text = r.json()["content"][0]["text"]
            parsed = try_parse(text)
            if parsed:
                return parsed
            print(f"[parse-fail] {ticker} {locale} attempt {attempt + 1}", flush=True)
            time.sleep(3 + attempt * 2)
        except Exception as e:
            print(f"[err] {ticker} {locale} attempt {attempt + 1}: {e}", flush=True)
            time.sleep(3 + attempt * 3)
    return None


def reshape_kpis(translated: dict, locale: str) -> dict:
    name_field = "name_en" if locale == "en" else "name_de"
    expl_field = "explanation_en" if locale == "en" else "explanation_de"
    kpis = translated.get("kpis") or []
    new_kpis = []
    for k in kpis:
        item = {
            "short": k.get("short", ""),
            name_field: k.get(name_field) or k.get("name_fr") or k.get("name") or "",
            expl_field: k.get(expl_field) or k.get("explanation", "") or "",
            "description": k.get("description", "") or "",
            "signal": k.get("signal", "") or "",
        }
        new_kpis.append(item)
    translated["kpis"] = new_kpis
    return translated


def main():
    if not ANTHROPIC_API_KEY:
        print("[fatal] ANTHROPIC_API_KEY missing", file=sys.stderr)
        sys.exit(1)
    merged = json.loads(MERGED_PATH.read_text())

    print(f"[retry] {len(FAILED)} failed translations", flush=True)
    t0 = time.time()
    done = 0
    failed = 0
    failed_list = []

    for ticker, locale in FAILED:
        entry = merged.get(ticker)
        if not entry:
            print(f"[missing] {ticker}", flush=True)
            failed += 1
            failed_list.append(f"{ticker}.{locale}")
            continue
        entry = merge_enrich_kpis(ticker, entry)
        payload = build_payload(entry)
        translated = translate_one(payload, ticker, locale)
        if translated is None:
            failed += 1
            failed_list.append(f"{ticker}.{locale}")
            print(f"[fail] {ticker}.{locale}", flush=True)
            continue
        translated = reshape_kpis(translated, locale)
        translated["ticker"] = ticker
        translated["locale"] = locale
        translated["_translated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        translated["_translated_by"] = "claude-opus-batch15-retry"
        out_path = OUT_DIR / f"{ticker.lower()}.{locale}.json"
        out_path.write_text(json.dumps(translated, ensure_ascii=False, separators=(",", ":")))
        done += 1
        print(f"[ok {done}/{len(FAILED)}] {ticker}.{locale}", flush=True)
        time.sleep(1)

    elapsed = (time.time() - t0) / 60
    print(f"\n[end] done={done} failed={failed} | {elapsed:.1f} min", flush=True)
    if failed_list:
        print(f"[still failed] {failed_list}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
