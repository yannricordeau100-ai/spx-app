#!/usr/bin/env python3
"""
translate-en-batch-5.py

Batch 3/6 EN translation via Claude Opus sub-agent.
Idempotent : skips tickers translated <7 days ago.

Reads /tmp/en-batch-5.json (list of tickers).
Reuses build_translation_payload from translate-v17-kpis-to-en.py.

Output: src/data/v2-pipeline-i18n/<ticker>.en.json with metadata:
  - _translated_at: ISO timestamp
  - _translated_by: "claude-opus-subagent"

Usage:
  export ANTHROPIC_API_KEY=...
  python3 scripts/translate-en-batch-5.py [--limit N] [--force]
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

# Import the payload builder from the existing script to keep workflow identical
import importlib.util
spec = importlib.util.spec_from_file_location(
    "translate_v17_en", ROOT / "scripts/translate-v17-kpis-to-en.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
build_translation_payload = mod.build_translation_payload
merge_enrich_kpis = mod.merge_enrich_kpis
ACRONYMS = mod.ACRONYMS

MERGED_PATH = ROOT / "src/data/v2-pipeline/_merged.json"
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"
BATCH_FILE = Path("/tmp/en-batch-5.json")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_OPUS = "claude-opus-4-5"  # Opus subagent

SYSTEM_PROMPT = """You are a professional financial translator (French to US English).

STRICT RULES:
1. Translate ONLY into natural, precise US English (business register).
2. Preserve financial acronyms verbatim (KPI, EPS, FCF, TTM, EBITDA, ROIC, etc.).
3. Preserve proper nouns (company names, people, products) verbatim.
4. Preserve numbers and currency symbols ($, EUR, GBP, %).
5. Tone: clear investor-facing, never marketing-inflated.
6. NO em-dash. Use colon or comma instead.
7. KPI "short" fields are IDs: do NOT translate.
8. Events: preserve year/month exactly as integers; translate title and body.
9. If a French field is empty, return empty string.
10. The tagline in source is already English: keep verbatim.

Output: ONLY the translated JSON object, no markdown fence, no commentary."""


def translate_with_opus(payload: dict[str, Any], ticker: str) -> dict[str, Any] | None:
    user_prompt = (
        f"Translate this JSON for ticker {ticker} from French to English. "
        f"Preserve the exact structure (same keys). Preserve KPI `short` "
        f"fields verbatim (they are identifiers). Preserve event year/month. "
        f"Preserve financial acronyms: {', '.join(sorted(ACRONYMS))}.\n\n"
        f"Source JSON:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": MODEL_OPUS,
        "max_tokens": 16000,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    for attempt in range(4):
        try:
            r = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=300)
            if r.status_code == 429:
                wait = 10 + attempt * 10
                print(f"[429] {ticker}: rate-limited, wait {wait}s")
                time.sleep(wait)
                continue
            if r.status_code == 529:
                wait = 30 + attempt * 30
                print(f"[529-overload] {ticker}: wait {wait}s")
                time.sleep(wait)
                continue
            r.raise_for_status()
            text = r.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                # strip fence
                lines = text.split("\n")
                text = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
                text = text.strip()
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[json-err] {ticker} attempt {attempt}: {e}")
            print(f"[raw] {text[:500]}")
            if attempt == 3:
                return None
            time.sleep(3)
        except Exception as e:
            print(f"[err] {ticker} attempt {attempt}: {e}")
            if attempt == 3:
                return None
            time.sleep(5 + attempt * 5)
    return None


def needs_translation(out_path: Path, force: bool, cutoff_days: int = 7) -> bool:
    if force:
        return True
    if not out_path.exists():
        return True
    try:
        existing = json.loads(out_path.read_text())
        ts = existing.get("_translated_at")
        if not ts:
            # Old file without metadata: re-translate if older than cutoff
            mtime = out_path.stat().st_mtime
            return (time.time() - mtime) > cutoff_days * 86400
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - dt).total_seconds()
        return age > cutoff_days * 86400
    except Exception:
        return True


def main() -> int:
    if not ANTHROPIC_API_KEY:
        print("[fatal] ANTHROPIC_API_KEY missing", file=sys.stderr)
        return 1

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not BATCH_FILE.exists():
        print(f"[fatal] {BATCH_FILE} not found", file=sys.stderr)
        return 1
    tickers = json.loads(BATCH_FILE.read_text())
    if not isinstance(tickers, list):
        print("[fatal] batch file must be a JSON list", file=sys.stderr)
        return 1

    print(f"[start] {len(tickers)} tickers in batch 5")

    merged = json.loads(MERGED_PATH.read_text())

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    todo: list[str] = []
    skipped_idempotent = 0
    skipped_missing_source = 0
    for tk in tickers:
        out_path = OUT_DIR / f"{tk.lower()}.en.json"
        if not needs_translation(out_path, args.force):
            skipped_idempotent += 1
            continue
        if tk not in merged or not isinstance(merged[tk], dict):
            print(f"[no-source] {tk}")
            skipped_missing_source += 1
            continue
        todo.append(tk)

    print(f"[plan] {len(todo)} to translate · {skipped_idempotent} skipped idempotent · {skipped_missing_source} no source")

    if args.dry_run:
        print("[dry-run] would translate:", ", ".join(todo))
        return 0

    if args.limit > 0:
        todo = todo[: args.limit]

    done = 0
    failed = 0
    t0 = time.time()
    for tk in todo:
        entry = merged[tk]
        entry = merge_enrich_kpis(tk, entry)
        payload = build_translation_payload(entry)
        translated = translate_with_opus(payload, tk)
        if translated is None:
            failed += 1
            print(f"[fail] {tk}")
            continue
        translated["ticker"] = tk
        translated["locale"] = "en"
        translated["_translated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        translated["_translated_by"] = "claude-opus-subagent"
        out_path = OUT_DIR / f"{tk.lower()}.en.json"
        out_path.write_text(json.dumps(translated, ensure_ascii=False, separators=(",", ":")))
        done += 1
        elapsed = time.time() - t0
        rate = done / elapsed if elapsed else 0
        eta = (len(todo) - done) / rate if rate else 0
        print(f"[ok] {tk} ({done}/{len(todo)}) · {failed} fail · ETA {eta/60:.1f}min")
        time.sleep(1.0)

    total_min = (time.time() - t0) / 60
    print(f"[end] {done} translated · {failed} failed · {skipped_idempotent} skipped · {total_min:.1f} min")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
