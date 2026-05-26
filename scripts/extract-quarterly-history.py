#!/usr/bin/env python3
"""
extract-quarterly-history.py — extraction historique quarterly/semestriel via Cerebras Qwen-3 235B.

Cible : stés clean_all dont hero_kpi.period_type est undefined ou "year".
Entrée : src/data/_quarterly-extraction-todo.json (liste {ticker, hero_short, ...}).
Sorties :
  - src/data/v2-pipeline-enrich/<ticker>.json field `hero_quarterly_history`
  - log /tmp/quarterly-extraction.log

Stratégie :
  - cat 1 US : 10-Q htm.gz dans sec-data/cat1-us/10Q/<year>/
  - cat 2 FPI ADR : 6-K dans sec-data/cat2-foreign-adr/6K/<year>/
  - cat 3 EU pures : cat3-european/<TICKER>/half-year/<year>.txt ou annual-text

Multi-procs : KEY_INDEX env var (0/1/2). Idempotent : skip si extracted_at <7 jours.

Yann 2026-05-26 — règles : anti-hallucination strict, null si non trouvable.
"""
from __future__ import annotations
import gzip
import json
import os
import re
import sys
import time
import ssl
import urllib.request
import urllib.error
# Disable SSL verification to avoid macOS local issuer cert issues (Cerebras API uses
# valid certs, but Python urllib doesn't always find the system trust store).
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

ROOT = Path("/Users/yann/spx-app")
TODO_FILE = ROOT / "src/data/_quarterly-extraction-todo.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
SEC_DATA = ROOT / "sec-data"
LOG_FILE = Path("/tmp/quarterly-extraction.log")

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY"),
    os.environ.get("CEREBRAS2_API_KEY"),
    os.environ.get("CEREBRAS3_API_KEY"),
]
KEY_INDEX = int(os.environ.get("KEY_INDEX", "0"))
NUM_WORKERS = int(os.environ.get("NUM_WORKERS", "3"))
# WORKER_ID controls item split (0..NUM_WORKERS-1), defaults to KEY_INDEX for backward compat
WORKER_ID = int(os.environ.get("WORKER_ID", str(KEY_INDEX)))
API_KEY = CEREBRAS_KEYS[KEY_INDEX % len(CEREBRAS_KEYS)]
MODEL = "qwen-3-235b-a22b-instruct-2507"
MAX_CHARS_PER_FILE = 25000  # cap per source file
MAX_TOTAL_CHARS = 110000  # cap total context (Cerebras Qwen has 131k limit, leave room for prompt+response)
SLEEP_BETWEEN_CALLS = 5.0  # higher to avoid TPM 429

# FPI ADR tickers (foreign issuers using 20-F / 6-K)
FPI_TICKERS_FILE = ROOT / "src/data/fpi-tickers.json"


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] [W{KEY_INDEX}] {msg}"
    print(line, flush=True)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_fpi_set() -> set[str]:
    try:
        if FPI_TICKERS_FILE.exists():
            data = json.loads(FPI_TICKERS_FILE.read_text())
            if isinstance(data, list):
                return set(t.upper() for t in data)
    except Exception:
        pass
    return set()


def detect_cat(ticker: str, fpi_set: set[str]) -> str:
    t = ticker.upper()
    if t in fpi_set:
        return "cat2"
    if "." in t:
        return "cat3"
    return "cat1"


def read_gz_text(p: Path, max_chars: int = MAX_CHARS_PER_FILE) -> str:
    try:
        with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as f:
            data = f.read(2_000_000)  # read up to 2MB raw HTML
        # Strip HTML tags crudely
        text = re.sub(r"<script[^>]*>.*?</script>", " ", data, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        text = re.sub(r"\s+", " ", text)
        # Try to find financial-relevant section (revenue/segment tables)
        # Search for the first occurrence of key terms and slice around it
        keywords = ["Revenue", "revenue", "Net sales", "Segment", "segment", "Operating income", "Total revenues"]
        best_pos = -1
        for kw in keywords:
            idx = text.find(kw)
            if idx >= 0 and (best_pos < 0 or idx < best_pos):
                best_pos = idx
                break
        if best_pos > 5000:
            text = text[max(0, best_pos - 2000):]
        return text[:max_chars]
    except Exception as e:
        log(f"  read_gz_text fail {p}: {e}")
        return ""


def read_txt(p: Path, max_chars: int = MAX_CHARS_PER_FILE) -> str:
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
        text = re.sub(r"\s+", " ", text)
        return text[:max_chars]
    except Exception as e:
        log(f"  read_txt fail {p}: {e}")
        return ""


def gather_sources(ticker: str, cat: str) -> list[tuple[str, str]]:
    """Return list of (source_label, text) for the ticker."""
    sources: list[tuple[str, str]] = []
    T = ticker.upper()

    if cat == "cat1":
        # 5 derniers 10-Q + 1 dernier 10-K
        candidates_10q: list[Path] = []
        for year_dir in sorted((SEC_DATA / "cat1-us" / "10Q").glob("*"), reverse=True):
            if not year_dir.is_dir():
                continue
            for f in sorted(year_dir.glob(f"{T}_*.htm.gz"), reverse=True):
                candidates_10q.append(f)
                if len(candidates_10q) >= 5:
                    break
            if len(candidates_10q) >= 5:
                break
        for f in candidates_10q:
            text = read_gz_text(f)
            if text:
                sources.append((f.name, text))

        # dernier 10-K
        for year_dir in sorted((SEC_DATA / "cat1-us" / "10K").glob("*"), reverse=True):
            if not year_dir.is_dir():
                continue
            found = sorted(year_dir.glob(f"{T}_*.htm.gz"), reverse=True)
            if found:
                text = read_gz_text(found[0])
                if text:
                    sources.append((found[0].name, text))
                break

    elif cat == "cat2":
        # 5 derniers 6-K + 1 dernier 20-F
        candidates_6k: list[Path] = []
        for year_dir in sorted((SEC_DATA / "cat2-foreign-adr" / "6K").glob("*"), reverse=True):
            if not year_dir.is_dir():
                continue
            for f in sorted(year_dir.glob(f"{T}_*.htm.gz"), reverse=True):
                candidates_6k.append(f)
                if len(candidates_6k) >= 5:
                    break
            if len(candidates_6k) >= 5:
                break
        for f in candidates_6k:
            text = read_gz_text(f)
            if text:
                sources.append((f.name, text))

        for year_dir in sorted((SEC_DATA / "cat2-foreign-adr" / "20F").glob("*"), reverse=True):
            if not year_dir.is_dir():
                continue
            found = sorted(year_dir.glob(f"{T}_*.htm.gz"), reverse=True)
            if found:
                text = read_gz_text(found[0])
                if text:
                    sources.append((found[0].name, text))
                break

    elif cat == "cat3":
        # half-year + annual-text
        base = SEC_DATA / "cat3-european" / T
        if not base.exists():
            base = SEC_DATA / "cat3-european" / ticker
        hy_dir = base / "half-year"
        if hy_dir.exists():
            for f in sorted(hy_dir.glob("*.txt"), reverse=True)[:5]:
                text = read_txt(f)
                if text:
                    sources.append((f"half-year/{f.name}", text))
        at_dir = base / "annual-text"
        if at_dir.exists():
            for f in sorted(at_dir.glob("*.txt"), reverse=True)[:3]:
                text = read_txt(f)
                if text:
                    sources.append((f"annual-text/{f.name}", text))

    # Cap total chars
    total = 0
    capped: list[tuple[str, str]] = []
    for label, text in sources:
        if total + len(text) > MAX_TOTAL_CHARS:
            remaining = MAX_TOTAL_CHARS - total
            if remaining > 5000:
                capped.append((label, text[:remaining]))
            break
        capped.append((label, text))
        total += len(text)
    return capped


def call_cerebras(prompt: str, retries: int = 3) -> str | None:
    if not API_KEY:
        log(f"  NO API KEY for index {KEY_INDEX}")
        return None
    url = "https://api.cerebras.ai/v1/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1500,
        "temperature": 0.1,
    }
    data = json.dumps(payload).encode("utf-8")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "curl/7.79.1",
                },
            )
            with urllib.request.urlopen(req, timeout=120, context=SSL_CONTEXT) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                content = resp_data["choices"][0]["message"]["content"]
                return content
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="ignore")[:200]
            except Exception:
                pass
            log(f"  HTTPError {e.code}: {body[:150]}")
            if e.code == 400 and "reduce the length" in body.lower():
                log(f"  context too long, abort")
                return None
            if e.code in (429, 503):
                time.sleep(30 * (attempt + 1))
            elif e.code in (402,):
                log(f"  Quota exhausted, abort")
                return None
            else:
                time.sleep(5)
        except Exception as e:
            log(f"  Exception: {e}")
            time.sleep(5)
    return None


def build_prompt(ticker: str, hero_short: str, hero_name_fr: str, sources: list[tuple[str, str]]) -> str:
    src_block = "\n\n".join(
        f"=== SOURCE: {label} ===\n{text}" for label, text in sources
    )
    return f"""Tu reçois plusieurs filings d'une société. Le hero KPI Mettrik est "{hero_short}" (nom FR = "{hero_name_fr}", ticker = {ticker}).

Extrais l'historique trimestriel (ou semestriel si la sté fait semestriel) de ce KPI sur les 12-20 derniers trimestres OU 6-10 derniers semestres.

Réponds UNIQUEMENT en JSON (aucun autre texte) :
{{
  "period_type": "quarter" | "semester",
  "history": [<number>, <number>, ...],
  "history_periods": ["Q1 2022", "Q2 2022", ...],
  "last_data_date": "YYYY-MM-DD",
  "source": "<URL ou nom du filing source>"
}}

Règle absolue : si un point n'est pas trouvable dans le texte fourni, retourne null à sa place dans history. JAMAIS d'invention.
Si TOUT le contenu est introuvable, retourne : {{"history": [], "skip_reason": "<raison concise>"}}

L'ordre du tableau "history" est chronologique : du plus ancien au plus récent.
L'unité doit rester cohérente avec celle du dataset (généralement Mds$ ou Mds€ ou autre). Garde les valeurs telles que rapportées (pas de conversion).

=== FILINGS ===
{src_block}

JSON :"""


def parse_response(content: str) -> dict[str, Any] | None:
    if not content:
        return None
    # Strip markdown fences
    content = content.strip()
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    # Try direct parse
    try:
        return json.loads(content)
    except Exception:
        pass
    # Try to find JSON block
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None


def write_enrich(ticker: str, payload: dict[str, Any]) -> None:
    fp = ENRICH_DIR / f"{ticker.lower()}.json"
    existing: dict[str, Any] = {}
    if fp.exists():
        try:
            existing = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    existing["hero_quarterly_history"] = payload
    ENRICH_DIR.mkdir(parents=True, exist_ok=True)
    fp.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")


def already_recent(ticker: str) -> bool:
    fp = ENRICH_DIR / f"{ticker.lower()}.json"
    if not fp.exists():
        return False
    try:
        d = json.loads(fp.read_text(encoding="utf-8"))
        h = d.get("hero_quarterly_history") or {}
        ts = h.get("extracted_at")
        if ts:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - dt < timedelta(days=7):
                return True
    except Exception:
        pass
    return False


def process_ticker(item: dict[str, Any], fpi_set: set[str]) -> str:
    ticker = item["ticker"]
    hero_short = item.get("hero_short") or ""
    hero_name_fr = item.get("hero_name_fr") or ""
    if not hero_short:
        log(f"{ticker}: no hero_short, skip")
        return "skip_no_hero"
    if already_recent(ticker):
        log(f"{ticker}: already recent, skip")
        return "skip_recent"
    cat = detect_cat(ticker, fpi_set)
    sources = gather_sources(ticker, cat)
    if not sources:
        log(f"{ticker} [{cat}]: no sources found, skip")
        write_enrich(ticker, {
            "short": hero_short,
            "period_type": None,
            "history": [],
            "skip_reason": "no_source",
            "extracted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })
        return "no_source"
    log(f"{ticker} [{cat}] {hero_short}: {len(sources)} sources, total {sum(len(t) for _,t in sources)} chars")
    prompt = build_prompt(ticker, hero_short, hero_name_fr, sources)
    resp = call_cerebras(prompt)
    if not resp:
        log(f"{ticker}: cerebras fail")
        return "llm_fail"
    parsed = parse_response(resp)
    if not parsed:
        log(f"{ticker}: parse fail. Raw start: {resp[:200]}")
        return "parse_fail"
    history = parsed.get("history") or []
    skip_reason = parsed.get("skip_reason")
    if not history:
        log(f"{ticker}: empty history, skip_reason={skip_reason}")
        write_enrich(ticker, {
            "short": hero_short,
            "period_type": parsed.get("period_type"),
            "history": [],
            "skip_reason": skip_reason or "empty_history",
            "extracted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })
        return "empty_history"
    payload = {
        "short": hero_short,
        "period_type": parsed.get("period_type") or "quarter",
        "history": history,
        "history_periods": parsed.get("history_periods"),
        "last_data_date": parsed.get("last_data_date"),
        "source": parsed.get("source"),
        "extracted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "method": "cerebras-qwen3-235b",
    }
    write_enrich(ticker, payload)
    log(f"{ticker}: OK {len(history)} points period={payload['period_type']}")
    return "ok"


def main() -> None:
    todo = json.loads(TODO_FILE.read_text(encoding="utf-8"))
    fpi_set = load_fpi_set()
    # Split by KEY_INDEX modulo
    my_items = [item for i, item in enumerate(todo) if i % NUM_WORKERS == WORKER_ID]
    log(f"Starting worker_id={WORKER_ID} key_index={KEY_INDEX} num_workers={NUM_WORKERS}, {len(my_items)}/{len(todo)} items")
    stats: dict[str, int] = {}
    for i, item in enumerate(my_items):
        result = process_ticker(item, fpi_set)
        stats[result] = stats.get(result, 0) + 1
        if (i + 1) % 10 == 0:
            log(f"Progress {i+1}/{len(my_items)}: {stats}")
        time.sleep(SLEEP_BETWEEN_CALLS)
    log(f"DONE worker {KEY_INDEX}: {stats}")


if __name__ == "__main__":
    main()
