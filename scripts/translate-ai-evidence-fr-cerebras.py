#!/usr/bin/env python3
"""
Translate AI positioning evidence EN → FR via Cerebras Qwen-3 235B.

Reads src/data/_ai-evidence-fr-todo.json (from list script).
Writes src/data/v2-pipeline-i18n/<ticker>.fr.json field
  ai_positioning_evidence_fr: [<translated string per evidence idx>, ...]

Each LLM call: batch of 5 items, strict JSON output.
On 429: sleep + retry.
On hallucination (parse fail twice): flag _translation_failed=true.

Usage:
  CEREBRAS_API_KEY=... python3 scripts/translate-ai-evidence-fr-cerebras.py
  # Optional: KEY_INDEX=0|1|2 (default 0) — selects key for multi-proc rotation.
"""
import json
import os
import sys
import time
import ssl
import urllib.request
import urllib.error
from typing import List, Optional

# Use certifi if available (handles macOS Python SSL issues)
try:
    import certifi
    _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    # Fallback : create default context (may fail on macOS Python without certs)
    try:
        _SSL_CONTEXT = ssl.create_default_context()
    except Exception:
        _SSL_CONTEXT = ssl._create_unverified_context()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODO_PATH = os.path.join(ROOT, "src/data/_ai-evidence-fr-todo.json")
I18N_DIR = os.path.join(ROOT, "src/data/v2-pipeline-i18n")
LOG_PATH = "/tmp/ai-evidence-fr-progress.log"

# Load .env.local manually (so we don't depend on python-dotenv)
def load_env_local() -> None:
    p = os.path.join(ROOT, ".env.local")
    if not os.path.exists(p):
        return
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


load_env_local()

KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS_API_KEY_2", "") or os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS_API_KEY_3", "") or os.environ.get("CEREBRAS_API_KEY", ""),
]
KEY_INDEX = int(os.environ.get("KEY_INDEX", "0"))
API_KEY = KEYS[KEY_INDEX % len(KEYS)]
ENDPOINT = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "qwen-3-235b-a22b-instruct-2507"
BATCH_SIZE = 5

if not API_KEY:
    print("[fatal] CEREBRAS_API_KEY missing", file=sys.stderr)
    sys.exit(1)


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [k{KEY_INDEX}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def cerebras_call(payload: dict, attempt: int = 0) -> Optional[str]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
            "User-Agent": "curl/7.79.1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        code = e.code
        body_err = ""
        try:
            body_err = e.read().decode("utf-8")[:300]
        except Exception:
            pass
        if code == 429 and attempt < 5:
            wait = 30 + attempt * 15
            log(f"[429] waiting {wait}s (attempt {attempt + 1})")
            time.sleep(wait)
            return cerebras_call(payload, attempt + 1)
        if code in (500, 502, 503, 504) and attempt < 3:
            wait = 10 + attempt * 5
            log(f"[{code}] waiting {wait}s")
            time.sleep(wait)
            return cerebras_call(payload, attempt + 1)
        log(f"[http {code}] {body_err}")
        return None
    except Exception as e:
        if attempt < 2:
            log(f"[err] {e} — retry")
            time.sleep(5)
            return cerebras_call(payload, attempt + 1)
        log(f"[fatal_err] {e}")
        return None


def translate_batch(items: List[dict]) -> Optional[List[dict]]:
    """Translate a batch of 5 evidence items. Returns list[{idx, text_fr}] or None."""
    user_prompt = (
        "Traduit ces phrases du anglais vers le français. "
        "Garde les nombres, dates, devises, noms propres exacts. "
        "Réponds uniquement avec le JSON [{idx, text_fr}].\n\n"
        f"Items à traduire:\n{json.dumps(items, ensure_ascii=False, indent=2)}"
    )
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "Tu es un traducteur professionnel anglais→français pour des contenus d'investissement. Tu réponds toujours uniquement avec du JSON valide, sans texte avant ni après."},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 4000,
    }
    out = cerebras_call(payload)
    if not out:
        return None
    # Strip ```json ... ``` fence
    cleaned = out.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1] if cleaned.count("```") >= 2 else cleaned.lstrip("`")
        if cleaned.lstrip().lower().startswith("json"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[4:]
    # Try to extract JSON array
    try:
        # Find first '[' and last ']'
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            return None
        # Validate structure
        result = []
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("idx")
            text_fr = entry.get("text_fr")
            if isinstance(idx, int) and isinstance(text_fr, str) and text_fr.strip():
                result.append({"idx": idx, "text_fr": text_fr.strip()})
        return result if result else None
    except json.JSONDecodeError as e:
        log(f"[parse_fail] {e} — output: {out[:200]}")
        return None


def merge_into_fr_file(ticker: str, translations: dict, original_evidence: List[str], failed: bool = False) -> None:
    """Write translations into v2-pipeline-i18n/<ticker>.fr.json field ai_positioning_evidence_fr.

    translations: dict {idx: text_fr}
    original_evidence: full evidence list from enrich (used to size output array)
    """
    path = os.path.join(I18N_DIR, f"{ticker.lower()}.fr.json")
    os.makedirs(I18N_DIR, exist_ok=True)
    existing: dict = {}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    # Build the full list (preserving any prior translations + adding new)
    n = len(original_evidence)
    existing_list = existing.get("ai_positioning_evidence_fr")
    if not isinstance(existing_list, list):
        existing_list = []
    full = [None] * n
    for i in range(min(n, len(existing_list))):
        if isinstance(existing_list[i], str) and existing_list[i].strip():
            full[i] = existing_list[i]
    for idx, tr in translations.items():
        if 0 <= idx < n:
            full[idx] = tr
    # Replace None by original EN (so we always have a string) — but only if user truly accepts that fallback
    # To preserve "fallback EN if translation missing", we leave None and let the loader fall back.
    # But output JSON must be valid. Use empty string for missing entries so order is preserved.
    full_clean = [s if isinstance(s, str) else "" for s in full]

    existing["ai_positioning_evidence_fr"] = full_clean
    existing["ticker"] = ticker
    existing["locale"] = "fr"
    if failed:
        existing["_translation_failed"] = True
    elif "_translation_failed" in existing:
        del existing["_translation_failed"]

    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main() -> int:
    if not os.path.exists(TODO_PATH):
        print(f"[fatal] todo file not found: {TODO_PATH}", file=sys.stderr)
        return 1

    with open(TODO_PATH, "r", encoding="utf-8") as f:
        todo = json.load(f)

    # Multi-proc partition by KEY_INDEX (3 workers split by ticker hash)
    n_workers = int(os.environ.get("N_WORKERS", "3"))
    todo = [entry for i, entry in enumerate(todo) if i % n_workers == KEY_INDEX]
    log(f"[start] {len(todo)} stés assigned to k{KEY_INDEX} (every {n_workers}th)")

    enrich_dir = os.path.join(ROOT, "src/data/v2-pipeline-enrich")
    total_ok = 0
    total_failed = 0
    total_items = 0

    for sti, sty in enumerate(todo):
        ticker = sty["ticker"]
        items = sty["items"]
        total_items += len(items)
        # Load original evidence to know array size
        ep = os.path.join(enrich_dir, f"{ticker.lower()}.json")
        if not os.path.exists(ep):
            ep = os.path.join(enrich_dir, f"{ticker}.json")
        try:
            with open(ep, "r", encoding="utf-8") as f:
                enrich = json.load(f)
            evidence = enrich["ai_positioning"]["evidence"]
        except Exception as e:
            log(f"[skip {ticker}] cannot reload evidence: {e}")
            continue

        log(f"[{sti+1}/{len(todo)}] {ticker} — {len(items)} items")
        translations: dict = {}
        any_failed = False
        # Batch by BATCH_SIZE
        for bstart in range(0, len(items), BATCH_SIZE):
            batch = items[bstart : bstart + BATCH_SIZE]
            res = translate_batch(batch)
            if res is None:
                # Retry once
                log(f"  [retry batch starting at idx {batch[0]['idx']}]")
                time.sleep(3)
                res = translate_batch(batch)
            if res is None:
                log(f"  [fail batch starting at idx {batch[0]['idx']}]")
                any_failed = True
                continue
            for entry in res:
                translations[entry["idx"]] = entry["text_fr"]
            # Cerebras free 30 req/min/key → sleep 2s between calls
            time.sleep(2)

        if translations:
            merge_into_fr_file(ticker, translations, evidence, failed=any_failed and len(translations) == 0)
            total_ok += 1
            log(f"  [ok {ticker}] {len(translations)}/{len(items)} translated")
        else:
            merge_into_fr_file(ticker, {}, evidence, failed=True)
            total_failed += 1

    log(f"[done k{KEY_INDEX}] ok={total_ok} failed={total_failed} total_items={total_items}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
