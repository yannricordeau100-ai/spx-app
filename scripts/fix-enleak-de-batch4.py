#!/usr/bin/env python3
"""
Fix EN-leak DE batch 4 (76 tickers from /tmp/enleak-batch-4.txt).

Reads src/data/v2-pipeline-i18n/<ticker>.de.json, detects EN markers in
specific fields (risks/kpis/events/gov/ai_positioning/hero_kpi_rationale),
translates EN -> DE inline via Cerebras Qwen-3 235B (free tier, §0bis OK),
overwrites file.

Anti-hallucination: preserves numbers, dates, units, acronyms (EPS/EBITDA/
FCF/CAGR/ROIC), proper nouns, quoted citations. "United States" -> "Vereinigte Staaten".
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any
import requests

ROOT = Path(__file__).parent.parent
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

CEREBRAS_KEYS = [k for k in [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
] if k]
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "gpt-oss-120b"

I18N_DIR = ROOT / "src/data/v2-pipeline-i18n"

# EN markers to detect (case-sensitive for English-looking words)
EN_MARKERS = [
    "through ", "of the ", "to the ", "for the ", "against ", "because ",
    "between ", "during ", "throughout ", "involving ", "according ",
    "revenue growth", "customers", "businesses", "compliance",
    "operations", "investments", "significant", "delivered", "compared",
    "growing", "environment", "business model", "inability",
    "continue to", "strategy to", "attract", "hire", "develop",
    "motivate", "retain", "United States",
    # Extra catches:
    "the company", "the group", "such as", "as well as", "in order to",
    "is expected", "are expected", "will continue", "may not be",
]


def has_en_leak(text: str) -> bool:
    if not isinstance(text, str) or not text.strip():
        return False
    for m in EN_MARKERS:
        if m in text:
            return True
    return False


SYSTEM_PROMPT = """Sie sind ein professioneller Übersetzer für Finanzdokumente (Englisch → Hochdeutsch, Investor-Stil).

REGELN:
- Übersetzen Sie ALLE englischen Satzteile ins professionelle Hochdeutsch.
- Wenn der Text bereits auf Deutsch ist: unverändert zurückgeben.
- Wenn der Text gemischt ist (DE+EN): nur EN-Teile übersetzen, DE-Teile beibehalten.
- "United States" → "Vereinigte Staaten"
- Akronyme NIEMALS übersetzen: EPS, EBITDA, FCF, CAGR, ROIC, ROE, KPI, IPO, R&D, M&A, Q1-Q4, FY, YoY, QoQ, ESG, AI, SaaS, TAM, GMV, MAU, DAU, ARR, MRR, CapEx, OpEx, B2B, B2C, USD, EUR
- Eigennamen (Personen, Unternehmen, Produkte, Orte) wörtlich beibehalten.
- Zahlen, Daten, Prozentangaben, Währungen wörtlich beibehalten.
- Zitate in Anführungszeichen ("...") aus SEC-Filings UNVERÄNDERT lassen.
- Kein Gedankenstrich (—). Nutzen Sie Doppelpunkt oder zwei Sätze.
- Professioneller Investor-Business-Stil, sachlich.

AUSGABE: NUR der übersetzte Text als einfacher String, KEIN Markdown, KEINE Kommentare, KEINE Anführungszeichen drumherum.
"""


def translate_field(text: str, key_idx: int = 0) -> str:
    """Translate a single field via Cerebras Qwen-3 235B."""
    if not text or not isinstance(text, str):
        return text
    if not has_en_leak(text):
        return text

    key = CEREBRAS_KEYS[key_idx % len(CEREBRAS_KEYS)]
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": CEREBRAS_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "temperature": 0.1,
        "max_tokens": 2000,
    }
    for attempt in range(3):
        try:
            r = requests.post(CEREBRAS_URL, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                time.sleep(8 * (attempt + 1))
                # rotate key
                key_idx += 1
                key = CEREBRAS_KEYS[key_idx % len(CEREBRAS_KEYS)]
                headers["Authorization"] = f"Bearer {key}"
                continue
            r.raise_for_status()
            out = r.json()["choices"][0]["message"]["content"].strip()
            # strip outer quotes if model wrapped
            if out.startswith('"') and out.endswith('"') and out.count('"') == 2:
                out = out[1:-1]
            # remove em-dashes
            out = out.replace("—", ":")
            return out
        except Exception as e:
            if attempt == 2:
                print(f"  [WARN] translate failed after 3 tries: {e!r}", file=sys.stderr)
                return text
            time.sleep(3 * (attempt + 1))
    return text


def process_ticker(ticker: str, key_offset: int = 0) -> dict:
    """Process one ticker's .de.json. Returns stats."""
    path = I18N_DIR / f"{ticker}.de.json"
    if not path.exists():
        return {"ticker": ticker, "status": "missing", "fixed": 0}

    data = json.loads(path.read_text())
    fixed = 0
    field_count = 0

    # hero_kpi_rationale
    if "hero_kpi_rationale" in data and isinstance(data["hero_kpi_rationale"], str):
        field_count += 1
        if has_en_leak(data["hero_kpi_rationale"]):
            new = translate_field(data["hero_kpi_rationale"], key_offset)
            if new != data["hero_kpi_rationale"]:
                data["hero_kpi_rationale"] = new
                fixed += 1
                key_offset += 1

    # ai_positioning.summary + evidence[]
    ai = data.get("ai_positioning")
    if isinstance(ai, dict):
        if isinstance(ai.get("summary"), str):
            field_count += 1
            if has_en_leak(ai["summary"]):
                new = translate_field(ai["summary"], key_offset)
                if new != ai["summary"]:
                    ai["summary"] = new
                    fixed += 1
                    key_offset += 1
        ev_list = ai.get("evidence")
        if isinstance(ev_list, list):
            for idx, item in enumerate(ev_list):
                if isinstance(item, str):
                    field_count += 1
                    if has_en_leak(item):
                        new = translate_field(item, key_offset)
                        if new != item:
                            ev_list[idx] = new
                            fixed += 1
                            key_offset += 1

    # governance.voting_structure_note + governance.notes
    gov = data.get("governance")
    if isinstance(gov, dict):
        for gkey in ("voting_structure_note", "notes"):
            v = gov.get(gkey)
            if isinstance(v, str):
                field_count += 1
                if has_en_leak(v):
                    new = translate_field(v, key_offset)
                    if new != v:
                        gov[gkey] = new
                        fixed += 1
                        key_offset += 1

    # risks[].{title, summary, description, score_rationale}
    for risk in data.get("risks", []) or []:
        if not isinstance(risk, dict):
            continue
        for rkey in ("title", "summary", "description", "score_rationale"):
            v = risk.get(rkey)
            if isinstance(v, str):
                field_count += 1
                if has_en_leak(v):
                    new = translate_field(v, key_offset)
                    if new != v:
                        risk[rkey] = new
                        fixed += 1
                        key_offset += 1

    # kpis[].{name, explanation, description, signal}
    for kpi in data.get("kpis", []) or []:
        if not isinstance(kpi, dict):
            continue
        for kkey in ("name", "explanation", "description", "signal"):
            v = kpi.get(kkey)
            if isinstance(v, str):
                field_count += 1
                if has_en_leak(v):
                    new = translate_field(v, key_offset)
                    if new != v:
                        kpi[kkey] = new
                        fixed += 1
                        key_offset += 1

    # stories_kpis[] (same as kpis)
    for kpi in data.get("stories_kpis", []) or []:
        if not isinstance(kpi, dict):
            continue
        for kkey in ("name", "explanation", "description", "signal"):
            v = kpi.get(kkey)
            if isinstance(v, str):
                field_count += 1
                if has_en_leak(v):
                    new = translate_field(v, key_offset)
                    if new != v:
                        kpi[kkey] = new
                        fixed += 1
                        key_offset += 1

    # events[].{description, body, title}
    for ev in data.get("events", []) or []:
        if not isinstance(ev, dict):
            continue
        for ekey in ("description", "body", "title"):
            v = ev.get(ekey)
            if isinstance(v, str):
                field_count += 1
                if has_en_leak(v):
                    new = translate_field(v, key_offset)
                    if new != v:
                        ev[ekey] = new
                        fixed += 1
                        key_offset += 1

    # tagline (some tickers leak it)
    if isinstance(data.get("tagline"), str):
        field_count += 1
        if has_en_leak(data["tagline"]):
            new = translate_field(data["tagline"], key_offset)
            if new != data["tagline"]:
                data["tagline"] = new
                fixed += 1
                key_offset += 1

    # Skip hero_kpi_rationale_en deliberately (named _en, stays in English)

    # Write back
    if fixed > 0:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return {"ticker": ticker, "status": "ok", "fixed": fixed, "scanned": field_count}


def main():
    if not CEREBRAS_KEYS:
        print("ERROR: no Cerebras keys", file=sys.stderr)
        sys.exit(1)

    args = sys.argv[1:]
    if args and args[0] == "--tickers":
        tickers = args[1].split(",")
    else:
        list_path = Path("/tmp/enleak-batch-4.txt")
        tickers = [t.strip() for t in list_path.read_text().splitlines() if t.strip()]

    print(f"Processing {len(tickers)} tickers with {len(CEREBRAS_KEYS)} Cerebras keys")
    total_fixed = 0
    total_scanned = 0
    for i, t in enumerate(tickers):
        try:
            stats = process_ticker(t, key_offset=i)
            status = stats["status"]
            if status == "ok":
                total_fixed += stats["fixed"]
                total_scanned += stats["scanned"]
                marker = "✓" if stats["fixed"] > 0 else "·"
                print(f"  {marker} [{i+1:3d}/{len(tickers)}] {t}: fixed {stats['fixed']}/{stats['scanned']}", flush=True)
            else:
                print(f"  ✗ [{i+1:3d}/{len(tickers)}] {t}: {status}", flush=True)
        except Exception as e:
            print(f"  ✗ [{i+1:3d}/{len(tickers)}] {t}: ERROR {e!r}", flush=True)

    print(f"\nDone. Fixed {total_fixed} fields across {len(tickers)} tickers (scanned {total_scanned}).")


if __name__ == "__main__":
    main()
