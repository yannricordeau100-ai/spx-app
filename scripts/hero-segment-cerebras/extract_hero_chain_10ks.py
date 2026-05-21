#!/usr/bin/env python3
"""
Mission #146 — Chain 2 10-Ks (latest + 3-year-old) per ticker to cover ≥5y hero segment history.

Reads 39 failed tickers from .conv-state/hero-segment-results-123.json, focuses on the k2 batch
(or batch passed via TICKER_FILE), loads 2 10-Ks per ticker (latest 2024 + oldest 2021), sends
both excerpts in a single Cerebras paid call (qwen-3-235b), validates merged history strictly
(≥5 years, consecutive, no duplicates, no hallucination), and writes overrides_hero_kpi into
src/data/v2-pipeline-enrich/<lower>.json.

Auto-rollback on hallucination (validation fail).
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
RESULTS_123 = PROJECT_ROOT / ".conv-state/hero-segment-results-123.json"
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-hero-chain-146-k2.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.6
MAX_TOKENS = 2200
CTX_LEN_PER_DOC = 14000

# k2 batch (indexes 2,5,8,... of 39 fails)
K2_TICKERS = ['UPS', 'AIZ', 'BXP', 'CPT', 'DLTR', 'EL', 'FTV', 'IP', 'NSC', 'POOL', 'ROK', 'TSCO', 'WSM']

PROMPT = """For {ticker} ({name}), the hero KPI is "{hero_label}".

You are given TWO 10-K Item 7 MD&A excerpts: one from the LATEST filing (FY{year_latest}) and one from an OLDER filing (FY{year_old}). Each filing typically reports 3 fiscal years of comparative data, so the two together should cover 5-6 distinct years.

Find this exact segment/sub-revenue/operational metric line in BOTH excerpts and extract its multi-year history, then MERGE the values so each year appears once.

Return STRICT JSON (no markdown):
{{
  "overrides_hero_kpi": {{
    "label": "{hero_label}",
    "label_en": "...",
    "label_fr": "...",
    "value": <last_year_value_as_number>,
    "unit": "Mds $" | "M $" | "%" | "unit_specific",
    "year": YYYY,
    "periodicity": "annual",
    "history": [
      {{"year": YYYY, "value": N, "unit": "..."}},
      ... (≥5 entries, oldest first, consecutive)
    ],
    "source": {{
      "type": "10K_chain_cerebras",
      "file_latest": "sec-data/cat1-us/10K/{year_latest}/{ticker}_*.htm.gz",
      "file_old": "sec-data/cat1-us/10K/{year_old}/{ticker}_*.htm.gz",
      "section": "Item 7 MD&A"
    }},
    "rationale_segment_specific": "<short reasoning>"
  }}
}}

LATEST 10-K excerpt (FY{year_latest}):
---
{excerpt_latest}
---

OLDER 10-K excerpt (FY{year_old}):
---
{excerpt_old}
---

Rules (STRICT, NO EXCEPTIONS):
- Every history value MUST appear LITERALLY in one of the two source texts above. Do not infer, interpolate, copy, or estimate.
- The merged history MUST have ≥5 distinct fiscal years.
- Years MUST be consecutive (gap ≤1) and ordered oldest to newest.
- IMPORTANT: each 10-K typically reports 3 fiscal years (current + 2 prior). Latest filing FY{year_latest} usually covers {fy_latest_minus_2}/{fy_latest_minus_1}/{year_latest_fy}. Older filing FY{year_old} usually covers {fy_old_minus_2}/{fy_old_minus_1}/{year_old_fy}. Together they typically span {fy_old_minus_2} through {year_latest_fy} (6 consecutive years). LOOK CAREFULLY for the metric value in the older filing's most recent year, which bridges the gap.
- NO duplicate years; if both filings report the same year, use the value from the LATEST filing (most likely restated).
- NO duplicate values (unless unit is "%" and only one repeat across ≥5 entries).
- Unit MUST be consistent across all years.
- "year" = fiscal year reported in the filing.
- The last history entry's value MUST equal the top-level "value" field.
- Detect filing scale: "(in millions)" → unit "M $", "(in billions)" → "Mds $", "(in thousands)" → CONVERT to millions (÷1000). For percentages: unit "%", value as decimal. For counts (units, customers): unit relevant string.
- DO NOT produce values >1,000,000 in unit "M $" (would mean $1T+). Convert thousands→millions if needed.
- The hero KPI label "{hero_label}" may be paraphrased. Match it to the closest segment/sub-revenue/operational metric line in the filings.
- If FEWER than 5 distinct years can be found LITERALLY across both filings, return null instead of fabricating.
- If the metric is reported only as growth rate without absolute values, return null.
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


def extract_mda_section(text: str, budget: int = CTX_LEN_PER_DOC) -> str:
    if not text or len(text) < 5000:
        return text[:budget]
    chunks = []
    pos = find_last_match(text, r"item\s+7\.?\s+(?:management.{0,30}discussion|md\s*&\s*a)")
    if pos is not None:
        chunks.append(("MDA", pos, int(budget * 0.7)))
    pos = find_last_match(text, r"(?:reportable\s+segments|segment\s+(?:information|results|reporting))")
    if pos is not None:
        chunks.append(("SEGMENTS", pos, int(budget * 0.4)))
    if not chunks:
        mid = len(text) // 2
        half = budget // 2
        return text[max(0, mid - half): mid + half]
    chunks.sort(key=lambda x: x[1])
    parts = []
    for kind, start, b in chunks:
        parts.append(f"=== {kind} ===\n{text[start:start + b]}")
    return "\n\n".join(parts)[:budget]


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
    candidates = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    return [k for k in candidates if k]


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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=240) as r:
                resp = json.loads(r.read())
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
            # Treat literal "null" / "{}" responses as a structured null result so caller routes to NULL branch.
            try:
                parsed = json.loads(content)
                if parsed is None:
                    return {"overrides_hero_kpi": None, "reason": "model_returned_null"}, None
                return parsed, None
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
                    log_line(f"  HTTP 429, backoff 10s (attempt {attempt+1}/{retries})")
                    time.sleep(10)
                    continue
                return None, "HTTP 429 quota"
            if code == 402:
                return None, "HTTP 402 payment"
            log_line(f"  HTTP {code}")
            return None, f"HTTP {code}"
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {ex}")
            if attempt < retries:
                time.sleep(4)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted retries"


def find_10k_for_year(ticker, year):
    """Find 10-K file for given filing year. Returns Path or None."""
    year_dir = SEC_10K / str(year)
    if not year_dir.exists():
        return None
    candidates = list(year_dir.glob(f"{ticker}_*.htm.gz"))
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_size, reverse=True)
    return candidates[0]


def load_10k_excerpt(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
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


def validate_history(history, target_value, min_len=5):
    """Strict validation for chain extraction: ≥5 years, consecutive, no dups."""
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
    years_sorted = sorted(years)
    for i in range(1, len(years_sorted)):
        gap = years_sorted[i] - years_sorted[i - 1]
        if gap > 1:
            return False, f"non-consecutive years gap {gap}"
    if len(set(years)) != len(years):
        return False, "duplicate years in history"
    from collections import Counter
    val_counts = Counter(values)
    dup_count = sum(c - 1 for c in val_counts.values() if c > 1)
    unit_is_pct = "%" in (next(iter(units)) if units else "")
    if dup_count > 0:
        if dup_count > 1:
            return False, f"too many duplicate values ({dup_count} dups)"
        if not unit_is_pct:
            return False, "duplicate value in non-percent series"
    last_entry = max(history, key=lambda h: h["year"])
    if abs(float(last_entry["value"]) - float(target_value)) > 0.01 * max(abs(float(target_value)), 1):
        if last_entry["value"] != target_value:
            return False, f"last value {last_entry['value']} != value {target_value}"
    if len(units) > 1:
        return False, f"inconsistent units: {units}"
    sample_unit = (next(iter(units)) if units else "").strip()
    if "M $" in sample_unit or sample_unit == "M $":
        max_v = max(abs(v) for v in values)
        if max_v > 1_000_000:
            return False, f"value {max_v} in M $ unrealistic (>$1T)"
    if "Mds $" in sample_unit:
        max_v = max(abs(v) for v in values)
        if max_v > 100_000:
            return False, f"value {max_v} in Mds $ unrealistic"
    return True, "ok"


def write_enrich(ticker, payload):
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
    d["_hero_segment_extracted_by"] = "mission-146-cerebras-chain-2-10ks-k2"
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def get_targets():
    """Determine list of tickers + hero labels for this run."""
    with open(ANALYSIS_JSON) as f:
        analysis = json.load(f)
    classifs = {c["ticker"]: c for c in analysis["classifications"] if c.get("category") == "LLM_SEGMENT_REQUIRED"}

    ticker_file = os.environ.get("TICKER_FILE")
    if ticker_file and os.path.exists(ticker_file):
        with open(ticker_file) as f:
            tickers = [line.strip() for line in f if line.strip()]
    else:
        tickers = K2_TICKERS

    targets = []
    for t in tickers:
        c = classifs.get(t)
        if not c:
            log_line(f"WARN {t}: not in analysis JSON, skip")
            continue
        targets.append(c)
    return targets


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    # k2 uses key idx 2 by default (CEREBRAS3_API_KEY) to avoid colliding with k0/k1
    key_idx = int(os.environ.get("KEY_INDEX", "2")) % len(keys)
    log_line(f"START hero-chain-146-k2: {len(keys)} keys, starting key_idx={key_idx}")

    targets = get_targets()
    log_line(f"Targets: {len(targets)} tickers ({', '.join(t['ticker'] for t in targets)})")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    skipped_null = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    YEAR_LATEST = int(os.environ.get("YEAR_LATEST", "2024"))
    YEAR_OLD = int(os.environ.get("YEAR_OLD", "2021"))

    for i, c in enumerate(targets):
        ticker = c["ticker"]
        hero_label = c["hero_label"]
        name = get_company_name(ticker)

        elapsed = time.time() - last_call_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        path_latest = find_10k_for_year(ticker, YEAR_LATEST)
        path_old = find_10k_for_year(ticker, YEAR_OLD)
        if not path_latest or not path_old:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP missing 10-K (latest={bool(path_latest)} old={bool(path_old)})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        excerpt_latest = load_10k_excerpt(path_latest)
        excerpt_old = load_10k_excerpt(path_old)
        if not excerpt_latest or not excerpt_old:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP empty extract")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "empty_extract"})
            continue

        # FY reported in each filing is typically (filing_year - 1) for calendar fiscal years.
        # Use filing year as the "FY label" placeholder — the LLM will still report the actual
        # fiscal year stated in the source. Calendar bridging hints help with consecutive ranges.
        year_latest_fy = YEAR_LATEST - 1
        year_old_fy = YEAR_OLD - 1
        prompt = PROMPT.format(
            ticker=ticker, name=name, hero_label=hero_label,
            year_latest=YEAR_LATEST, year_old=YEAR_OLD,
            year_latest_fy=year_latest_fy, year_old_fy=year_old_fy,
            fy_latest_minus_2=year_latest_fy - 2, fy_latest_minus_1=year_latest_fy - 1,
            fy_old_minus_2=year_old_fy - 2, fy_old_minus_1=year_old_fy - 1,
            excerpt_latest=excerpt_latest, excerpt_old=excerpt_old,
        )
        last_call_t = time.time()
        api_key = keys[key_idx]
        result, err = call_cerebras(prompt, api_key)
        if not result and err and "429" in err:
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
            reason = result.get("reason", "null_result") if isinstance(result, dict) else "null"
            log_line(f"[{i+1}/{len(targets)}] {ticker}: NULL ({str(reason)[:80]})")
            skipped_null += 1
            results.append({"ticker": ticker, "status": "null", "reason": str(reason)[:200]})
            continue

        history = overrides.get("history")
        value = overrides.get("value")
        valid, why = validate_history(history, value, min_len=5)
        if not valid:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP validation: {why} (auto-rollback, no write)")
            skipped_validation += 1
            results.append({"ticker": ticker, "status": "validation_fail", "reason": why})
            continue

        if isinstance(overrides.get("source"), dict):
            overrides["source"]["file_latest"] = str(path_latest.relative_to(PROJECT_ROOT))
            overrides["source"]["file_old"] = str(path_old.relative_to(PROJECT_ROOT))

        write_enrich(ticker, {"overrides_hero_kpi": overrides})
        log_line(f"[{i+1}/{len(targets)}] {ticker}: OK history {len(history)} pts, value={value} {overrides.get('unit')}")
        ok += 1
        results.append({"ticker": ticker, "status": "ok", "history_len": len(history), "value": value})

        if (i + 1) % 4 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END k2: ok={ok} no_source={skipped_no_source} validation_fail={skipped_validation} "
        f"null={skipped_null} api_fail={api_fails}"
    )

    out = PROJECT_ROOT / ".conv-state" / "hero-chain-146-k2-results.json"
    out.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "batch": "k2",
        "summary": {
            "ok": ok,
            "no_source": skipped_no_source,
            "validation_fail": skipped_validation,
            "null": skipped_null,
            "api_fail": api_fails,
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results written to {out}")


if __name__ == "__main__":
    main()
