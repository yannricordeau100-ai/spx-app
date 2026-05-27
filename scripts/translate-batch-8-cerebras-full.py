#!/usr/bin/env python3
"""
FULL FORCE-OVERWRITE of batch 15 (34 stés × 2 locales = 68 files) via Cerebras Qwen-3-235B (free).

The previous Anthropic-direct run reported "ok" but most files were left unchanged
(suspected ThreadPoolExecutor + parallel writes silently swallowed). This script
serializes per (ticker, locale), verifies the write succeeded by re-reading the file
and checking the new _translated_at, and retries until confirmed.

§0bis compliant: Cerebras Qwen-3 free tier only. 3 keys rotation.
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

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
]
CEREBRAS_KEYS = [k for k in CEREBRAS_KEYS if k]
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"

BATCH_15 = [
    "HSY",
    "HUBB",
    "HUM",
    "HWM",
    "IBKR",
    "IBM",
    "ICE",
    "IDXX",
    "IEX",
    "IFF",
    "III.L",
    "ILMN",
    "INCY",
    "INGA.AS",
    "INTC",
    "INTU",
    "INVH",
    "IP",
    "IQV",
    "IR",
    "IRM",
    "ISP.MI",
    "ISRG",
    "IT",
    "ITRK.L",
    "ITW",
    "IVZ",
    "J",
    "JAZZ",
    "JBHT",
    "JBL",
    "JCI",
    "JEF",
    "JKHY",
    "JNJ",
    "JPM",
    "KDP",
    "KER.PA",
    "KEY",
    "KEYS",
    "KHC",
    "KIM",
    "KKR",
    "KLAC",
]

ACRONYMS = sorted({
    "KPI", "EPS", "FCF", "TTM", "ARPP", "CAGR", "IPO", "EBITDA", "ROIC",
    "ROE", "ROA", "P/E", "FCFF", "FCFE", "NPV", "GMV", "MAU", "DAU", "ARPU",
    "LTV", "CAC", "MRR", "COGS", "OPEX", "CAPEX", "SaaS", "AI", "ESG", "GICS",
    "TAM", "TAC", "ABF", "DAP", "ARR", "DPS", "R&D", "M&A", "Q1",
    "Q2", "Q3", "Q4", "FY", "YoY", "QoQ", "B2B", "B2C", "FX", "USD", "EUR",
})

SYS_EN = """You are a French to English financial translator. Output VALID JSON only.

RULES:
- Translate values from French to US business English.
- Preserve acronyms (KPI, EPS, FCF, EBITDA, etc.), proper nouns, numbers, currency symbols.
- Tone: professional investor business style.
- No em-dash.
- Preserve verbatim: short, year, month.
- Empty French = empty string "".
- Same JSON keys.
- Escape every double quote inside strings with backslash. No raw newlines inside strings.

OUTPUT: ONLY the JSON object, no markdown fences, no commentary."""

SYS_DE = """Sie sind ein Französisch-Deutsch Finanzübersetzer. Geben Sie NUR gültiges JSON aus.

REGELN:
- Übersetzen Sie Werte ins Hochdeutsch (Business-Stil).
- Akronyme, Eigennamen, Zahlen und Währungen wörtlich beibehalten.
- Kein Gedankenstrich.
- Wörtlich: short, year, month.
- Leeres Französisch = leerer String "".
- Gleiche JSON-Schlüssel.
- Jedes doppelte Anführungszeichen in Strings mit Backslash escapen.

AUSGABE: NUR das JSON-Objekt, keine Markdown, keine Kommentare."""


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


def try_parse(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    text = text[start:end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        fixed = re.sub(r'(?<!\\)\n', r'\\n', text)
        fixed = re.sub(r'(?<!\\)\t', r'\\t', fixed)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    try:
        fixed = re.sub(r',(\s*[}\]])', r'\1', text)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    return None


def call_cerebras(system: str, user: str, key_index: int = 0) -> str | None:
    if not CEREBRAS_KEYS:
        return None
    headers = {
        "Authorization": f"Bearer {CEREBRAS_KEYS[key_index % len(CEREBRAS_KEYS)]}",
        "Content-Type": "application/json",
    }
    body = {
        "model": CEREBRAS_MODEL,
        "max_tokens": 14000,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        r = requests.post(CEREBRAS_URL, headers=headers, json=body, timeout=180)
        if r.status_code in (429, 402, 503):
            return None
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"  [cerebras-err key{key_index}] {e}", flush=True)
        return None


def translate_one(payload: dict, ticker: str, locale: str) -> dict | None:
    system = SYS_EN if locale == "en" else SYS_DE
    target = "English" if locale == "en" else "German"
    name_field = "name_en" if locale == "en" else "name_de"
    expl_field = "explanation_en" if locale == "en" else "explanation_de"

    user = (
        f"Translate this JSON for company {ticker} from French to {target}. "
        f"Preserve structure. "
        f"For KPIs use field name `{name_field}` (translate name_fr) and `{expl_field}` (translate explanation), plus description and signal. "
        f"Preserve verbatim: KPI short IDs, event year/month, acronyms: {', '.join(ACRONYMS)}.\n\n"
        f"Source:\n{json.dumps(payload, ensure_ascii=False)}\n\n"
        f"Output JSON only."
    )

    for attempt in range(8):
        key_idx = attempt % len(CEREBRAS_KEYS)
        text = call_cerebras(system, user, key_idx)
        if text:
            parsed = try_parse(text)
            if parsed:
                return parsed
            print(f"  [parse-fail] {ticker}.{locale} attempt {attempt + 1}", flush=True)
        else:
            print(f"  [api-fail] {ticker}.{locale} attempt {attempt + 1} key{key_idx}", flush=True)
        time.sleep(4 + attempt * 2)
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


def write_and_verify(out_path: Path, content: dict) -> bool:
    text = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    out_path.write_text(text)
    # Verify
    try:
        d = json.loads(out_path.read_text())
    except Exception:
        return False
    return d.get("_translated_at", "").startswith("2026-05-27") and "batch15" in d.get("_translated_by", "")


def main():
    if not CEREBRAS_KEYS:
        print("[fatal] No Cerebras keys", file=sys.stderr)
        sys.exit(1)
    merged = json.loads(MERGED_PATH.read_text())

    # Determine which (ticker, locale) need refresh
    targets = []
    for t in BATCH_15:
        for loc in ("en", "de"):
            p = OUT_DIR / f"{t.lower()}.{loc}.json"
            needs = True
            if p.exists():
                try:
                    d = json.loads(p.read_text())
                    if d.get("_translated_at", "").startswith("2026-05-27") and "batch15" in d.get("_translated_by", ""):
                        needs = False
                except Exception:
                    needs = True
            if needs:
                targets.append((t, loc))

    print(f"[full-refresh] {len(targets)} targets to refresh | keys={len(CEREBRAS_KEYS)}", flush=True)
    t0 = time.time()
    done = 0
    failed = 0
    failed_list = []

    for i, (ticker, locale) in enumerate(targets):
        entry = merged.get(ticker)
        if not entry:
            failed += 1
            failed_list.append(f"{ticker}.{locale}")
            continue
        entry = merge_enrich_kpis(ticker, entry)
        payload = build_payload(entry)
        print(f"[{i+1}/{len(targets)}] {ticker}.{locale}", flush=True)
        translated = translate_one(payload, ticker, locale)
        if translated is None:
            failed += 1
            failed_list.append(f"{ticker}.{locale}")
            print(f"  [FAIL]", flush=True)
            continue
        translated = reshape_kpis(translated, locale)
        translated["ticker"] = ticker
        translated["locale"] = locale
        translated["_translated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        translated["_translated_by"] = "cerebras-qwen3-batch15-full"
        out_path = OUT_DIR / f"{ticker.lower()}.{locale}.json"

        if write_and_verify(out_path, translated):
            done += 1
            print(f"  [OK + verified]", flush=True)
        else:
            failed += 1
            failed_list.append(f"{ticker}.{locale}")
            print(f"  [WRITE-FAIL or VERIFY-FAIL]", flush=True)
        time.sleep(2)

    elapsed = (time.time() - t0) / 60
    print(f"\n[end] done={done} failed={failed} | {elapsed:.1f} min", flush=True)
    if failed_list:
        print(f"[still failed] {failed_list}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
