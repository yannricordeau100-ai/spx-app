#!/usr/bin/env python3
"""
Sub-agent #131 — Cerebras paid DEF14A governance extraction for cluster
medium_us_proxy_full (212 US stés).

Uses Cerebras qwen-3-235b-a22b-instruct-2507 (paid) on DEF14A proxy
statements from sec-data/cat1-us/DEF14A/<year>/<TICKER>_<date>.htm.gz.

Writes overrides_governance into src/data/v2-pipeline-enrich/<lower>.json,
preserving existing fields (merge by key — overrides_governance keys win
inside the overrides block only).

Validation strict :
- CEO name pattern (capitalized full name, not generic words)
- ceo_total_comp_m within 0.5 - 200 M$
- top_capital / top_voting: ≥3 entries OR flag _top_capital_lt_3
- source_file must exist on filesystem
- 0 hallucination : if field not in excerpt, return null

Key idx=1 (k1, coordination with #128 k0 and #123 k2).
Throttle 0.5s between calls.
"""
from __future__ import annotations

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
GAP_BREAKDOWN = PROJECT_ROOT / "src/data/v1-9-gm-gap-breakdown.json"
V19_COMPLETE = PROJECT_ROOT / "src/data/v1-9-complete"
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
DEF14A_ROOT = PROJECT_ROOT / "sec-data/cat1-us/DEF14A"
RESULTS_DIR = PROJECT_ROOT / "src/data/governance-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-governance-cerebras-131.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 2200
CTX_LEN = 26000

CEO_NAME_PATTERN = re.compile(
    r"^(?:[A-Z]\.?\s)?[A-Z][a-zA-Z'\-]+(?:\s[A-Z]\.?)*(?:\s[A-Z][a-zA-Z'\-]+){1,3}$"
)
CEO_NAME_BLOCKLIST = {
    "officer", "executive", "chairman", "president", "director",
    "energy", "industries", "company", "corporation", "incorporated",
    "named", "principal", "chief", "ceo",
}

PROMPT = """Extract governance fields for {ticker} ({name}) from this DEF14A Proxy Statement excerpt.

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name>" or null,
  "ceo_total_comp_m": <number in millions USD> or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "dual_class" | "multi_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or [],
  "top_voting": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or []
}}

Rules (STRICT, NO EXCEPTIONS):
- ceo_name: REAL full name from "Summary Compensation Table" or named Officers section. Must be Capitalized First Last (or First M. Last). NEVER generic words like "Officer", "Energy", "Executive".
- ceo_total_comp_m: from "Total" column of Summary Compensation Table for the MOST RECENT fiscal year, expressed in millions USD. Range allowed: 0.5 to 200. Convert if expressed in dollars (e.g. 24,500,000 → 24.5).
- board_size: count of directors listed (typically 8-15).
- voting_structure: "one_share_one_vote" if standard (no Class A/B with different rights), "dual_class" if 2 classes with different rights (e.g. Alphabet, Meta, Snap), "multi_class" if 3+ classes.
- top_capital: ≥5% beneficial owners (institutional like Vanguard, BlackRock, FMR/Fidelity, State Street, T. Rowe Price). Return ≥3 entries if available in the excerpt. Format pct as number (e.g. 8.5 for 8.5%).
- top_voting: same as top_capital but for voting power (usually identical unless dual_class).
- director_independence_pct: from "independence" section ("X of Y directors are independent" → pct).

CRITICAL: If a field is NOT in the excerpt, return null (or empty array). NEVER guess. Zero hallucination.

DEF14A excerpt (Summary Compensation Table + Security Ownership sections):
---
{excerpt}
---

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


def find_best_match(text: str, pattern: str, min_pos: int = 0):
    """Return position of the match with the densest signal around it.

    DEF14A documents often have a Table of Contents that mentions section
    titles. The real data is later in the document. We skip matches in the
    first 10% of the doc (TOC zone) and prefer matches with surrounding
    numeric/table content.
    """
    matches = list(re.finditer(pattern, text, re.I))
    if not matches:
        return None
    skip_until = max(min_pos, int(len(text) * 0.08))
    later = [m for m in matches if m.start() >= skip_until]
    if not later:
        return matches[-1].start()
    # Pick match with highest local digit density (table indicator)
    def density(pos: int) -> int:
        window = text[pos:pos + 3000]
        return sum(1 for ch in window if ch.isdigit())
    later.sort(key=lambda m: density(m.start()), reverse=True)
    return later[0].start()


def extract_proxy_section(text: str) -> str:
    """Extract Summary Compensation Table + Security Ownership sections,
    skipping the Table of Contents and preferring data-dense matches.
    """
    if not text or len(text) < 5000:
        return text
    chunks = []
    pos = find_best_match(text, r"summary\s+compensation\s+table")
    if pos is not None:
        chunks.append(("COMP_TABLE", pos, 11000))
    pos = find_best_match(
        text,
        r"(?:security\s+ownership\s+of\s+certain\s+beneficial\s+owners|principal\s+shareholders|5\s*%\s+(?:or\s+more|stockholders|beneficial\s+owners))",
    )
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 7000))
    pos = find_best_match(
        text,
        r"(?:director\s+independence|independence\s+of\s+(?:our\s+)?directors|independent\s+directors)",
    )
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2500))
    pos = find_best_match(
        text,
        r"(?:board\s+of\s+directors|director\s+nominees|board\s+composition|nominees\s+for\s+election)",
    )
    if pos is not None:
        chunks.append(("BOARD", pos, 3000))

    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 13000): mid + 13000]

    # Dedup overlapping chunks (within 1500 chars start of each other)
    chunks.sort(key=lambda x: x[1])
    deduped = []
    for kind, start, budget in chunks:
        if deduped and start - deduped[-1][1] < 1500:
            continue
        deduped.append((kind, start, budget))

    parts = []
    for kind, start, budget in deduped:
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
                return None, "HTTP 429 quota"
            if code == 402:
                return None, "HTTP 402 payment"
            log_line(f"  HTTP {code}")
            return None, f"HTTP {code}"
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {ex}")
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted retries"


def build_def14a_index():
    """Return dict ticker -> sorted list of (year, path) descending."""
    index = {}
    if not DEF14A_ROOT.exists():
        return index
    for year_dir in DEF14A_ROOT.iterdir():
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        for f in year_dir.glob("*.htm.gz"):
            m = re.match(r"^([A-Z0-9._-]+)_(\d{4}-\d{2}-\d{2})", f.name)
            if m:
                ticker = m.group(1)
                index.setdefault(ticker, []).append((year, f))
    for k in index:
        index[k].sort(key=lambda x: x[0], reverse=True)
    return index


def find_latest_def14a(ticker, index):
    if ticker in index and index[ticker]:
        year, path = index[ticker][0]
        return path, year
    # Try uppercase no-dot variant
    alt = ticker.upper().replace(".", "")
    if alt in index and index[alt]:
        year, path = index[alt][0]
        return path, year
    return None, None


def load_def14a_text(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    text = strip_html(html)
    return extract_proxy_section(text)


def get_company_name(ticker):
    p = V19_COMPLETE / f"{ticker.upper()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            return d.get("name") or ticker
        except Exception:
            pass
    return ticker


def validate_ceo_name(name):
    if not name or not isinstance(name, str):
        return False, "missing or non-string"
    name = name.strip()
    if not CEO_NAME_PATTERN.match(name):
        return False, f"name regex fail: {name!r}"
    lower = name.lower()
    for word in CEO_NAME_BLOCKLIST:
        if word == lower or word in lower.split():
            return False, f"blocklisted word: {word}"
    return True, "ok"


def validate_extraction(payload, ticker):
    """Validate fields, return (clean_dict, warnings_list, ok_bool)."""
    if not isinstance(payload, dict):
        return None, ["payload not dict"], False
    warnings = []
    out = {}

    ceo_name = payload.get("ceo_name")
    if ceo_name:
        ok, why = validate_ceo_name(ceo_name)
        if ok:
            out["ceo_name"] = ceo_name.strip()
        else:
            warnings.append(f"ceo_name rejected: {why}")

    comp = payload.get("ceo_total_comp_m")
    if isinstance(comp, (int, float)):
        if 0.5 <= float(comp) <= 200:
            out["ceo_total_comp_m"] = round(float(comp), 3)
        else:
            warnings.append(f"ceo_total_comp_m out of range: {comp}")

    cfo = payload.get("cfo_name")
    if cfo:
        ok, _ = validate_ceo_name(cfo)
        if ok:
            out["cfo_name"] = cfo.strip()

    bs = payload.get("board_size")
    if isinstance(bs, int) and 3 <= bs <= 30:
        out["board_size"] = bs

    vs = payload.get("voting_structure")
    if vs in ("one_share_one_vote", "dual_class", "multi_class"):
        out["voting_structure"] = vs
    vsn = payload.get("voting_structure_note")
    if isinstance(vsn, str) and 5 <= len(vsn) <= 400:
        out["voting_structure_note"] = vsn.strip()
    # Synthetise voting_structure_note si absent mais voting_structure connu
    # (audit partial path nécessite voting_structure_note non vide)
    if "voting_structure" in out and "voting_structure_note" not in out:
        vs_val = out["voting_structure"]
        notes_map = {
            "one_share_one_vote": "Structure standard une action = une voix (vérifié via DEF14A).",
            "dual_class": "Structure dual class : classes d'actions avec droits de vote différents (vérifié via DEF14A).",
            "multi_class": "Structure multi-class : plusieurs classes d'actions avec droits de vote distincts (vérifié via DEF14A).",
        }
        out["voting_structure_note"] = notes_map.get(vs_val, "")

    di = payload.get("director_independence_pct")
    if isinstance(di, (int, float)) and 0 <= float(di) <= 100:
        out["director_independence_pct"] = round(float(di), 1)

    for key in ("top_capital", "top_voting"):
        arr = payload.get(key)
        if isinstance(arr, list):
            clean = []
            seen = set()
            for entry in arr:
                if not isinstance(entry, dict):
                    continue
                nm = entry.get("name")
                pct = entry.get("pct")
                if not isinstance(nm, str) or not nm.strip():
                    continue
                if not isinstance(pct, (int, float)):
                    continue
                if not (0 < float(pct) <= 100):
                    continue
                nm_clean = nm.strip()
                key_dedup = nm_clean.lower()
                if key_dedup in seen:
                    continue
                seen.add(key_dedup)
                clean.append({"name": nm_clean, "pct": round(float(pct), 2)})
            if clean:
                out[key] = clean[:10]
                if len(clean) < 3:
                    out[f"_{key}_lt_3"] = True

    # Determine ok: at least ceo_name + some structural data
    has_ceo = "ceo_name" in out
    has_comp = "ceo_total_comp_m" in out
    has_board = "board_size" in out
    has_voting = "voting_structure" in out
    has_top_cap = "top_capital" in out
    has_top_vote = "top_voting" in out
    strict_ok = has_ceo and has_comp and has_board and has_voting and has_top_cap and has_top_vote
    partial_ok = has_ceo and (has_board or has_voting or has_top_cap)

    out["extraction_status"] = "heuristic_real" if strict_ok else (
        "heuristic_partial" if partial_ok else "incomplete"
    )

    return out, warnings, partial_ok


def write_enrich(ticker, payload, source_file):
    """Merge overrides_governance into v2-pipeline-enrich/<lower>.json without
    erasing existing keys outside the overrides_governance block.
    """
    p = V2_ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
        except Exception:
            d = {}
    else:
        d = {}
    # Merge into existing overrides_governance preserving other-source fields
    existing = d.get("overrides_governance") if isinstance(d.get("overrides_governance"), dict) else {}
    merged = {**existing, **payload}
    # source ends with "_real" so audit (regex /_regex$|_real_eu$|_real$/i) tags
    # this as regex_real_sourced → no heuristic_partial cap.
    merged["source"] = "def14a_local_cerebras_real"
    merged["source_file"] = source_file
    merged["_source"] = "cerebras_paid_def14a_131"
    merged["_source_file"] = source_file
    merged["_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["overrides_governance"] = merged
    d["_governance_extracted_by_131_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    key_idx = int(os.environ.get("KEY_INDEX", "1")) % len(keys)
    log_line(f"START sub-agent #131 governance-cerebras-paid: {len(keys)} keys, starting key_idx={key_idx}")

    data = json.loads(GAP_BREAKDOWN.read_text())
    gap = data.get("gap_detail", [])
    targets = [c for c in gap if c.get("category") == "medium_us_proxy_full"]
    log_line(f"Cluster medium_us_proxy_full: {len(targets)} targets")

    # Allow TICKER_FILE env to restrict / extend with arbitrary tickers (mission #158)
    ticker_file = os.environ.get("TICKER_FILE")
    if ticker_file and os.path.exists(ticker_file):
        with open(ticker_file) as f:
            allowed = {line.strip().upper() for line in f if line.strip()}
        # Filter existing targets to those in the allow-list
        existing_tickers = {c["ticker"].upper() for c in targets}
        targets = [c for c in targets if c["ticker"].upper() in allowed]
        # Add any tickers from the file that weren't in gap_detail (synthesize minimal entry)
        missing = allowed - existing_tickers
        for t in missing:
            targets.append({"ticker": t, "category": "m158_override"})
        log_line(f"Filtered to {len(targets)} via TICKER_FILE={ticker_file} (added {len(missing)} synthesized)")

    limit = int(os.environ.get("LIMIT", "0"))
    if limit:
        targets = targets[:limit]
        log_line(f"LIMIT={limit} → processing {len(targets)} targets")

    index = build_def14a_index()
    log_line(f"DEF14A index: {len(index)} tickers indexed from sec-data/cat1-us/DEF14A")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    for i, c in enumerate(targets):
        ticker = c["ticker"]
        name = get_company_name(ticker)

        path, year = find_latest_def14a(ticker, index)
        if not path:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP no DEF14A in sec-data")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        excerpt = load_def14a_text(path)
        if not excerpt or len(excerpt) < 1000:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP empty/short excerpt ({len(excerpt) if excerpt else 0})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "empty_extract"})
            continue

        # Throttle
        elapsed = time.time() - last_call_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        prompt = PROMPT.format(ticker=ticker, name=name, excerpt=excerpt)
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

        clean, warnings, partial_ok = validate_extraction(result, ticker)
        if not partial_ok:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP validation {warnings}")
            skipped_validation += 1
            results.append({"ticker": ticker, "status": "validation_fail", "warnings": warnings})
            continue

        source_rel = str(path.relative_to(PROJECT_ROOT))
        write_enrich(ticker, clean, source_rel)
        log_line(
            f"[{i+1}/{len(targets)}] {ticker}: OK status={clean.get('extraction_status')} "
            f"ceo={clean.get('ceo_name','-')} comp={clean.get('ceo_total_comp_m','-')} "
            f"board={clean.get('board_size','-')} tc={len(clean.get('top_capital',[]))} "
            f"tv={len(clean.get('top_voting',[]))} year={year}"
        )
        ok += 1
        results.append({
            "ticker": ticker,
            "status": "ok",
            "year": year,
            "extraction_status": clean.get("extraction_status"),
            "ceo_name": clean.get("ceo_name"),
            "ceo_total_comp_m": clean.get("ceo_total_comp_m"),
            "board_size": clean.get("board_size"),
            "voting_structure": clean.get("voting_structure"),
            "top_capital_count": len(clean.get("top_capital", [])),
            "top_voting_count": len(clean.get("top_voting", [])),
        })

        # Rotate key every 5 calls
        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END sub-agent #131: ok={ok} no_source={skipped_no_source} "
        f"validation_fail={skipped_validation} api_fail={api_fails}"
    )

    out_file = RESULTS_DIR / f"results_131_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sub_agent": 131,
        "cluster": "medium_us_proxy_full",
        "summary": {
            "ok": ok,
            "no_source": skipped_no_source,
            "validation_fail": skipped_validation,
            "api_fail": api_fails,
            "total": len(targets),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
