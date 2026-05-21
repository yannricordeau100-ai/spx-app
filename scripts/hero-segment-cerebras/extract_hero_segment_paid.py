#!/usr/bin/env python3
"""
Cerebras paid extraction hero segment KPI history (sub-agent #123).

For each ticker classified LLM_SEGMENT_REQUIRED in v1-9-us-segment-heroes-analysis-21-mai.json:
- Read latest 10-K Item 7 MD&A from sec-data/cat1-us/10K/<year>/<TICKER>_*.htm.gz
- Ask Cerebras qwen-3-235b to find the segment matching hero_kpi.label and extract ≥5 years history
- Write overrides_hero_kpi block to src/data/v2-pipeline-enrich/<lowercase>.json (merge with existing)

Throttle 0.5s entre calls, key_idx=2 (CEREBRAS3 by default).
On 429: backoff 8s then retry (up to 3 times) with key rotation.
"""
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ANALYSIS_JSON = PROJECT_ROOT / "src/data/v1-9-us-segment-heroes-analysis-21-mai.json"
V19_COMPLETE = PROJECT_ROOT / "src/data/v1-9-complete"
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC_10K = PROJECT_ROOT / "sec-data/cat1-us/10K"
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-hero-segment-cerebras.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 1500
CTX_LEN = 22000

PROMPT = """For {ticker} ({name}), the hero KPI is "{hero_label}".

Find this exact segment/sub-revenue line in the 10-K Item 7 MD&A excerpt below and extract its multi-year history.

Return STRICT JSON (no markdown, no commentary):
{{
  "overrides_hero_kpi": {{
    "label": "{hero_label}",
    "label_en": "...",
    "label_fr": "...",
    "value": <last_year_value_as_number>,
    "unit": "Mds $" | "M $" | "%" | "unit_specific",
    "year": YYYY,
    "periodicity": "annual" | "quarterly",
    "history": [
      {{"year": YYYY, "value": N, "unit": "..."}},
      {{"year": YYYY, "value": N, "unit": "..."}},
      {{"year": YYYY, "value": N, "unit": "..."}},
      {{"year": YYYY, "value": N, "unit": "..."}},
      {{"year": YYYY, "value": N, "unit": "..."}}
    ],
    "source": {{
      "type": "10K_local_cerebras",
      "file": "sec-data/cat1-us/10K/<year>/{ticker}_<date>.htm.gz",
      "section": "Item 7 MD&A"
    }},
    "rationale_segment_specific": "<short reasoning>"
  }}
}}

Source text (Item 7 MD&A segment section):
---
{excerpt}
---

Rules (STRICT, NO EXCEPTIONS):
- Every history value MUST appear LITERALLY in the source text below. Do not infer, interpolate, copy values across years, or estimate.
- Return ALL years explicitly stated in the filing for this exact segment (typically 3 in a 10-K MD&A). 3 years is ACCEPTABLE and expected — return them, do not return null.
- ONLY return null if FEWER THAN 3 yearly values are explicit. 3 years = success.
- DO NOT duplicate values across different years. Every history entry must be a distinct, source-cited number.
- Years must be consecutive (gap ≤1) and ordered chronologically (oldest to newest).
- The last history entry's value MUST equal the top-level "value" field (same number).
- "year" = fiscal year reported in the filing.
- Unit MUST be consistent across all years (do not mix Mds $ and M $).
- IMPORTANT: 10-Ks often report values in "(in millions)" or "(in thousands)". You MUST detect this and adjust:
  * If filing says "(in millions)" or "$M" or "in million": unit = "M $", store value AS-IS from filing (e.g. 10336 not 10336000000).
  * If filing says "(in thousands)" or "$K": unit = "M $", but CONVERT value to millions (divide by 1000). Example: filing says "10,335,949" with "(in thousands)" → value = 10335.949 (or rounded), unit = "M $".
  * If filing says "(in billions)" or "$B": unit = "Mds $", store value AS-IS.
  * For percentages (%): unit = "%", value as decimal (e.g. 10.5 for 10.5%).
  * For counts (units, customers, etc.): unit = relevant unit string, value as raw number.
- DO NOT produce values like 10000000+ in unit "M $" — that would mean $10 trillion which is impossible. Convert thousands→millions correctly.
- The hero KPI label "{hero_label}" may be paraphrased. Match it to the closest segment/sub-revenue line in the filing (e.g. "Microsoft Cloud" matches "Microsoft Cloud revenue", "Cloud Backlog" matches "Remaining Performance Obligations cloud" or "cRPO", "MCR" matches "Medical Care Ratio" or "Medical Cost Ratio"). Only return null if NO reasonable segment exists in the filing for this KPI.
- If the filing only discusses growth rates without absolute values, return null.
- Return null rather than fabricate. NEVER infer values from context.

Return ONLY the JSON object."""

HTML_TAG_RE = re.compile(r"<[^>]+>")
HTML_ENTITY_NAMED_RE = re.compile(r"&[a-zA-Z]+;")
HTML_ENTITY_NUM_RE = re.compile(r"&#\d+;")
WHITESPACE_RE = re.compile(r"\s+")


def strip_html(html: str) -> str:
    text = HTML_TAG_RE.sub(" ", html)
    text = HTML_ENTITY_NAMED_RE.sub(" ", text)
    text = HTML_ENTITY_NUM_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def find_last_match(text: str, pattern: str):
    positions = [m.start() for m in re.finditer(pattern, text, re.I)]
    return positions[-1] if positions else None


def extract_mda_section(text: str) -> str:
    """Return Item 7 MD&A + segment data, budget 22K chars."""
    if not text or len(text) < 5000:
        return text
    chunks = []
    pos = find_last_match(text, r"item\s+7\.?\s+(?:management.{0,30}discussion|md\s*&\s*a)")
    if pos is not None:
        chunks.append(("MDA", pos, 16000))
    pos = find_last_match(text, r"(?:reportable\s+segments|segment\s+(?:information|results|reporting))")
    if pos is not None:
        chunks.append(("SEGMENTS", pos, 6000))
    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]
    chunks.sort(key=lambda x: x[1])
    parts = []
    for kind, start, budget in chunks:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def load_env():
    env_p = PROJECT_ROOT / ".env.local"
    if not env_p.exists():
        return
    for line in env_p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def get_keys():
    """Return list of available Cerebras keys."""
    candidates = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    keys = [k for k in candidates if k]
    return keys


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
                resp = json.loads(r.read())
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError as e:
                        return None, f"JSON parse fail: {e}"
                return None, "no JSON in response"
        except urllib.error.HTTPError as e:
            code = e.code
            if code == 429:
                if attempt < retries:
                    log_line(f"  HTTP 429, backoff 8s (attempt {attempt+1}/{retries})")
                    time.sleep(8)
                    continue
                return None, f"HTTP 429 quota"
            if code == 402:
                return None, f"HTTP 402 payment"
            log_line(f"  HTTP {code}")
            return None, f"HTTP {code}"
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {ex}")
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted retries"


def find_latest_10k(ticker):
    """Find the latest 10-K for ticker by year. Returns (path, year) or (None, None)."""
    if not SEC_10K.exists():
        return None, None
    candidates = []
    for year_dir in sorted([d for d in SEC_10K.iterdir() if d.is_dir() and d.name.isdigit()], reverse=True):
        for f in year_dir.glob(f"{ticker}_*.htm.gz"):
            candidates.append((f, int(year_dir.name), f.stat().st_size))
    if not candidates:
        return None, None
    # Pick newest year first, ties broken by largest file
    candidates.sort(key=lambda p: (-p[1], -p[2]))
    best = candidates[0]
    return best[0], best[1]


def load_10k_text(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return None
    text = strip_html(html)
    return extract_mda_section(text)


def get_company_name(ticker):
    p = V19_COMPLETE / f"{ticker.upper()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            return d.get("name") or ticker
        except Exception:
            pass
    return ticker


def validate_history(history, target_value, excerpt=None, min_len=3):
    if not isinstance(history, list) or len(history) < min_len:
        return False, f"history len {len(history) if isinstance(history, list) else 'n/a'} < {min_len}"
    years = []
    units = set()
    values = []
    for h in history:
        if not isinstance(h, dict):
            return False, "history entry not dict"
        y = h.get("year")
        v = h.get("value")
        u = h.get("unit")
        if not isinstance(y, int):
            return False, f"year not int: {y!r}"
        if not isinstance(v, (int, float)):
            return False, f"value not numeric: {v!r}"
        years.append(y)
        values.append(float(v))
        if u:
            units.add(u)
    # Check consecutive (gap <= 1) for sorted years
    years_sorted = sorted(years)
    for i in range(1, len(years_sorted)):
        gap = years_sorted[i] - years_sorted[i-1]
        if gap > 1:
            return False, f"non-consecutive years gap {gap}"
    # No duplicate years
    if len(set(years)) != len(years):
        return False, "duplicate years in history"
    # Reject any duplicate values in history (likely LLM hallucination).
    # Exception: percentages can legitimately repeat (e.g. WMT comp sales 4.8% 2 years in a row).
    # Allow ONE repeat ONLY if unit is % AND series spans 3+ years.
    from collections import Counter
    val_counts = Counter(values)
    dup_count = sum(c - 1 for c in val_counts.values() if c > 1)
    unit_is_pct = "%" in (next(iter(units)) if units else "")
    if dup_count > 0:
        if dup_count > 1:
            return False, f"too many duplicate values ({dup_count} dups)"
        if not unit_is_pct:
            return False, f"duplicate value in non-percent series"
    # Last value matches
    last_entry = max(history, key=lambda h: h["year"])
    if abs(float(last_entry["value"]) - float(target_value)) > 0.01 * max(abs(float(target_value)), 1):
        if last_entry["value"] != target_value:
            return False, f"last value {last_entry['value']} != value {target_value}"
    if len(units) > 1:
        return False, f"inconsistent units: {units}"
    # Sanity: reject impossibly large M $ values (>$1T = 1,000,000 M)
    sample_unit = (next(iter(units)) if units else "").strip()
    if "M $" in sample_unit or sample_unit == "M $":
        max_v = max(abs(v) for v in values)
        if max_v > 1_000_000:
            return False, f"value {max_v} in M $ unrealistic (>$1T), likely thousands-not-converted"
    if "Mds $" in sample_unit:
        max_v = max(abs(v) for v in values)
        if max_v > 100_000:  # $100T impossible
            return False, f"value {max_v} in Mds $ unrealistic"
    return True, "ok"


def write_enrich(ticker, payload):
    """Merge overrides_hero_kpi into v2-pipeline-enrich/<lowercase>.json"""
    p = V2_ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
        except Exception:
            d = {}
    else:
        d = {}
    d["overrides_hero_kpi"] = payload["overrides_hero_kpi"]
    d["_hero_segment_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["_hero_segment_extracted_by"] = "sub-agent-123-cerebras-paid"
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    # Determine starting key index. Default key_idx=2 (CEREBRAS3), env KEY_INDEX override.
    key_idx = int(os.environ.get("KEY_INDEX", "2")) % len(keys)
    log_line(f"START hero-segment-paid: {len(keys)} keys available, starting key_idx={key_idx}")

    with open(ANALYSIS_JSON) as f:
        analysis = json.load(f)
    targets = [c for c in analysis["classifications"] if c.get("category") == "LLM_SEGMENT_REQUIRED"]

    # Allow LIMIT env for testing
    limit = int(os.environ.get("LIMIT", "0"))
    if limit:
        targets = targets[:limit]
    # Allow TICKER_FILE env to restrict to a subset
    ticker_file = os.environ.get("TICKER_FILE")
    if ticker_file and os.path.exists(ticker_file):
        with open(ticker_file) as f:
            allowed = {line.strip() for line in f if line.strip()}
        targets = [c for c in targets if c["ticker"] in allowed]
        log_line(f"Filtered to {len(targets)} via {ticker_file}")
    log_line(f"Targets: {len(targets)} tickers")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    skipped_null_result = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    for i, c in enumerate(targets):
        ticker = c["ticker"]
        hero_label = c["hero_label"]
        name = get_company_name(ticker)

        # Throttle 0.5s
        elapsed = time.time() - last_call_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        # Source
        path, year = find_latest_10k(ticker)
        if not path:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP no 10-K source")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        excerpt = load_10k_text(path)
        if not excerpt:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP empty extract")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "empty_extract"})
            continue

        prompt = PROMPT.format(
            ticker=ticker, name=name, hero_label=hero_label, excerpt=excerpt,
        )
        last_call_t = time.time()
        api_key = keys[key_idx]
        result, err = call_cerebras(prompt, api_key)
        if not result and err and "429" in err:
            # Try other keys
            for trial in range(len(keys) - 1):
                key_idx = (key_idx + 1) % len(keys)
                log_line(f"  Rotate to key_idx={key_idx}")
                time.sleep(2)
                result, err = call_cerebras(prompt, keys[key_idx])
                if result or (err and "429" not in err):
                    break

        if not result:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: FAIL api ({err})")
            api_fails += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        overrides = result.get("overrides_hero_kpi") if isinstance(result, dict) else None
        if overrides is None:
            reason = result.get("reason", "null_result")
            log_line(f"[{i+1}/{len(targets)}] {ticker}: NULL ({reason[:80]})")
            skipped_null_result += 1
            results.append({"ticker": ticker, "status": "null", "reason": reason})
            continue

        # Validate
        history = overrides.get("history")
        value = overrides.get("value")
        valid, why = validate_history(history, value)
        if not valid:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP validation: {why}")
            skipped_validation += 1
            results.append({"ticker": ticker, "status": "validation_fail", "reason": why})
            continue

        # Patch source.file with actual path
        if isinstance(overrides.get("source"), dict):
            overrides["source"]["file"] = str(path.relative_to(PROJECT_ROOT))

        write_enrich(ticker, {"overrides_hero_kpi": overrides})
        log_line(f"[{i+1}/{len(targets)}] {ticker}: OK history {len(history)} pts, value={value} {overrides.get('unit')}")
        ok += 1
        results.append({"ticker": ticker, "status": "ok", "history_len": len(history), "value": value})

        # Rotate key every 5 calls to spread load
        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END: ok={ok} no_source={skipped_no_source} validation_fail={skipped_validation} "
        f"null={skipped_null_result} api_fail={api_fails}"
    )

    # Persist results JSON
    out = PROJECT_ROOT / ".conv-state" / "hero-segment-results-123.json"
    out.write_text(json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(),
                                "summary": {
                                    "ok": ok,
                                    "no_source": skipped_no_source,
                                    "validation_fail": skipped_validation,
                                    "null": skipped_null_result,
                                    "api_fail": api_fails,
                                },
                                "results": results,
                                }, indent=2, ensure_ascii=False))
    log_line(f"Results written to {out}")


if __name__ == "__main__":
    main()
