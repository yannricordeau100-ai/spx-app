#!/usr/bin/env python3
"""
Translate kpis[].description EN -> FR for the 59 tickers listed in
/tmp/fr-kpi_description.txt via Cerebras Qwen-3 235B.

Workflow:
- Read src/data/v2-pipeline/<lower(ticker)>.json (read-only)
- For each kpi with a non-empty description that is detected as EN, translate.
- Merge into src/data/v2-pipeline-enrich/<lower(ticker)>.json under field
  kpis_description_fr (dict: {kpi.short: description_fr}).

Rules:
- Max 300 chars per translation.
- No em-dash. No leading filler phrase. Stay sober/factual.
- Skip strings already in French.

Usage:
  CEREBRAS_API_KEY=... python3 scripts/translate-kpis-description-fr-cerebras.py
"""
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import List, Optional, Tuple

try:
    import certifi
    _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    try:
        _SSL_CONTEXT = ssl.create_default_context()
    except Exception:
        _SSL_CONTEXT = ssl._create_unverified_context()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPELINE_DIR = os.path.join(ROOT, "src/data/v2-pipeline")
ENRICH_DIR = os.path.join(ROOT, "src/data/v2-pipeline-enrich")
TODO_PATH = "/tmp/fr-kpi_description.txt"
LOG_PATH = "/tmp/kpi-desc-fr-progress.log"


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

API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
ENDPOINT = "https://api.cerebras.ai/v1/chat/completions"
MODEL = os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b")
BATCH_SIZE = 5
MAX_CHARS = 300

if not API_KEY:
    print("[fatal] CEREBRAS_API_KEY missing", file=sys.stderr)
    sys.exit(1)


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# FR detection heuristic: accented chars or common FR-only stop words
_FR_MARKERS = re.compile(
    r"[àâäéèêëîïôöùûüç]|"
    r"\b(?:le|la|les|des|du|aux|une?|et|est|sont|avec|pour|par|dans|"
    r"croissance|revenus|chiffre|marge|trimestre|année|société|entreprise)\b",
    re.IGNORECASE,
)


def is_french(text: str) -> bool:
    if not text:
        return True
    return bool(_FR_MARKERS.search(text))


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
        with urllib.request.urlopen(req, timeout=90, context=_SSL_CONTEXT) as resp:
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
            log(f"[err] {e} - retry")
            time.sleep(5)
            return cerebras_call(payload, attempt + 1)
        log(f"[fatal_err] {e}")
        return None


def clean_translation(s: str) -> str:
    if not s:
        return ""
    # Remove em-dash and en-dash, replace by ", " or " "
    s = s.replace("—", ", ").replace("–", "-")
    s = s.strip().strip('"').strip("'")
    # Collapse repeated spaces
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > MAX_CHARS:
        # Truncate on last sentence boundary <= MAX_CHARS
        cut = s[:MAX_CHARS]
        for sep in (". ", " ; ", ", "):
            i = cut.rfind(sep)
            if i >= MAX_CHARS - 80:
                cut = cut[: i + 1].rstrip()
                break
        s = cut.rstrip(",;: ").rstrip()
        if not s.endswith("."):
            s += "."
    return s


def translate_batch(items: List[Tuple[int, str]]) -> Optional[List[dict]]:
    """items: list of (idx, text_en). Returns list of {idx, text_fr}."""
    payload_items = [{"idx": i, "text": t} for i, t in items]
    user_prompt = (
        "Traduis ces descriptions de KPI financiers de l'anglais vers le français. "
        "Style: sobre, factuel, vocabulaire investisseur. "
        "Conserve les nombres, devises, pourcentages, dates et noms propres exacts. "
        "Maximum 300 caractères par traduction. "
        "INTERDIT: tiret cadratin (em-dash), em-dash (—). Utilise virgule ou point-virgule. "
        "Réponds uniquement avec un JSON valide: [{\"idx\": int, \"text_fr\": str}, ...].\n\n"
        f"Items:\n{json.dumps(payload_items, ensure_ascii=False)}"
    )
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Tu es un traducteur professionnel anglais vers français pour des contenus "
                    "d'investissement. Tu réponds toujours uniquement avec du JSON valide, "
                    "sans texte avant ni après, sans bloc markdown."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 4000,
    }
    out = cerebras_call(payload)
    if not out:
        return None
    cleaned = out.strip()
    if cleaned.startswith("```"):
        # strip fence
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.lstrip().lower().startswith("json"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[4:]
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            return None
        result = []
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("idx")
            text_fr = entry.get("text_fr")
            if isinstance(idx, int) and isinstance(text_fr, str) and text_fr.strip():
                result.append({"idx": idx, "text_fr": clean_translation(text_fr)})
        return result if result else None
    except json.JSONDecodeError as e:
        log(f"[parse_fail] {e} - output head: {out[:200]}")
        return None


def process_ticker(ticker: str) -> Tuple[int, int]:
    """Return (translated_count, total_en_count)."""
    lower = ticker.lower()
    src_path = os.path.join(PIPELINE_DIR, f"{lower}.json")
    enrich_path = os.path.join(ENRICH_DIR, f"{lower}.json")
    if not os.path.exists(src_path):
        log(f"[skip] {ticker}: source missing")
        return 0, 0
    with open(src_path, "r", encoding="utf-8") as f:
        src = json.load(f)
    kpis = src.get("kpis") or []
    # Build list of (short, en_text) needing translation
    pending: List[Tuple[str, str]] = []
    seen_shorts = set()
    for k in kpis:
        if not isinstance(k, dict):
            continue
        short = k.get("short")
        desc = k.get("description") or ""
        if not isinstance(short, str) or not short.strip():
            continue
        if short in seen_shorts:
            continue
        seen_shorts.add(short)
        if not isinstance(desc, str) or not desc.strip():
            continue
        if is_french(desc):
            continue
        pending.append((short, desc.strip()))

    total_en = len(pending)
    if total_en == 0:
        log(f"[{ticker}] no EN description to translate")
        return 0, 0

    # Load (or init) enrich file
    enrich = {"ticker": ticker}
    if os.path.exists(enrich_path):
        try:
            with open(enrich_path, "r", encoding="utf-8") as f:
                enrich = json.load(f)
        except Exception:
            enrich = {"ticker": ticker}
    existing = enrich.get("kpis_description_fr") or {}
    if not isinstance(existing, dict):
        existing = {}

    # Filter out anything already translated (idempotent)
    pending = [(s, t) for (s, t) in pending if s not in existing or not str(existing[s]).strip()]
    if not pending:
        log(f"[{ticker}] all {total_en} already translated")
        return 0, total_en

    log(f"[{ticker}] translating {len(pending)}/{total_en}")
    # Batch
    translations: dict = dict(existing)
    for i in range(0, len(pending), BATCH_SIZE):
        chunk = pending[i : i + BATCH_SIZE]
        items = [(j, txt) for j, (_, txt) in enumerate(chunk)]
        res = translate_batch(items)
        if not res:
            # retry once more with smaller batches
            log(f"[{ticker}] batch {i} failed, retry single")
            for j, (short, txt) in enumerate(chunk):
                r2 = translate_batch([(0, txt)])
                if r2:
                    for e in r2:
                        if e["idx"] == 0:
                            translations[short] = e["text_fr"]
                            break
                else:
                    log(f"[{ticker}] FAIL {short}")
            continue
        # Map idx -> short
        for entry in res:
            idx = entry["idx"]
            if 0 <= idx < len(chunk):
                short = chunk[idx][0]
                translations[short] = entry["text_fr"]
        time.sleep(0.5)  # be polite

    enrich["ticker"] = ticker
    enrich["kpis_description_fr"] = translations
    os.makedirs(ENRICH_DIR, exist_ok=True)
    tmp = enrich_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(enrich, f, ensure_ascii=False, indent=2)
    os.replace(tmp, enrich_path)
    new_count = sum(1 for s, _ in pending if s in translations)
    log(f"[{ticker}] done: {new_count}/{len(pending)} new translations written")
    return new_count, total_en


def main() -> int:
    with open(TODO_PATH, "r", encoding="utf-8") as f:
        tickers = [ln.strip() for ln in f if ln.strip()]
    log(f"[start] {len(tickers)} tickers to process")
    total_new = 0
    total_en = 0
    failed_tickers: List[str] = []
    for i, t in enumerate(tickers, 1):
        log(f"--- ({i}/{len(tickers)}) {t} ---")
        try:
            n, en = process_ticker(t)
            total_new += n
            total_en += en
        except Exception as e:
            log(f"[{t}] EXCEPTION: {e}")
            failed_tickers.append(t)
    log(f"[end] new={total_new} en_total={total_en} failed={failed_tickers}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
