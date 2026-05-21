#!/usr/bin/env python3
"""
Mission #159 Phase 3 — f_repartition residuels via Cerebras paid

For each top307+SP500 sté with f_repartition KO, try to:
1. Extract revenue_by_segment.slices[] and/or revenue_by_geography.slices[] from 10-K Item 1/7 or annual-text
2. If genuinely mono-segment or mono-region, tag single_segment: true or single_region_legitimate: true
3. Output written to v2-pipeline-enrich/<lower>.json (additive)

Usage:
  PAID_MODE=1 KEY_INDEX=2 python3 scripts/repartition-cerebras/run_mission_159_phase3.py
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
V2P = PROJECT_ROOT / "src/data/v2-pipeline"
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
AUDIT = PROJECT_ROOT / "src/data/v1-9-pre-publication-audit.json"
TOP307_FILE = PROJECT_ROOT / "src/data/v1-8-tickers-sorted.json"
SP500_FILE = PROJECT_ROOT / "src/data/sp500-tickers.json"
SECDATA = PROJECT_ROOT / "sec-data"
RESULTS_DIR = PROJECT_ROOT / "src/data/repartition-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-mission-159-phase3.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 1500
CTX_LEN = 22000

PROMPT = """Analyze this company's filings to extract revenue breakdown by SEGMENT and GEOGRAPHY for {ticker} ({name}).

Return STRICT JSON:
{{
  "segments": [
    {{"label": "<segment name>", "value": <number>, "unit": "<USD M, EUR M, etc.>", "share_pct": <0-100>}}
  ],
  "geographies": [
    {{"label": "<region/country>", "value": <number>, "unit": "<USD M, etc.>", "share_pct": <0-100>}}
  ],
  "is_single_segment": <bool>,
  "is_single_region": <bool>,
  "single_segment_rationale": "<short FR rationale if single_segment=true, else null>",
  "single_region_rationale": "<short FR rationale if single_region=true, else null>",
  "notes": "<observations>"
}}

Rules (STRICT):
- For segments: extract from Item 1 (Business description) or Item 7 (MD&A) sections that report by segment
- For geographies: extract from segment reporting or revenue note that reports by region
- ≥2 slices needed for either array (otherwise return [] AND set is_single_segment/region to true)
- share_pct should sum to ~100 (±5%)
- If company is genuinely mono-segment (e.g. pharma with single therapeutic area, monoline insurer), set is_single_segment=true with rationale
- If company operates only in one region (e.g. UK utility, French infrastructure), set is_single_region=true with rationale
- If you can't find data, return empty arrays and set the flags to null (don't guess)

Document excerpt:
---
{excerpt}
---

Return ONLY JSON."""


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
    cands = [os.environ.get("CEREBRAS_API_KEY"), os.environ.get("CEREBRAS2_API_KEY"), os.environ.get("CEREBRAS3_API_KEY")]
    return [k for k in cands if k]


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "curl/7.79.1"}
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
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
                        return None, f"JSON parse fail"
                return None, "no JSON"
        except urllib.error.HTTPError as e:
            if e.code == 429:
                if attempt < retries:
                    time.sleep(6)
                    continue
                return None, "429"
            if e.code == 402:
                return None, "402"
            return None, f"HTTP {e.code}"
        except Exception as ex:
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted"


def find_source(ticker):
    """Find best source for repartition extraction (10-K Item 1+7 or annual-text)."""
    # Try cat3-european first (EU stés)
    eu_path = SECDATA / "cat3-european" / ticker / "annual-text"
    if eu_path.is_dir():
        files = sorted(eu_path.glob("*.txt"), key=lambda p: p.stat().st_size, reverse=True)
        if files:
            return files[0], "cat3-european"
    # Try cat1-us 10-K (most recent year)
    us_path = SECDATA / "cat1-us" / "10K"
    if us_path.is_dir():
        for year_dir in sorted(us_path.iterdir(), reverse=True):
            if year_dir.is_dir():
                candidates = list(year_dir.glob(f"{ticker.upper()}_*.htm.gz")) + list(year_dir.glob(f"{ticker.upper()}_*.txt"))
                if candidates:
                    return candidates[0], "cat1-us-10K"
    # Try cat2-foreign-adr 20-F
    fpi_path = SECDATA / "cat2-foreign-adr" / "20F"
    if fpi_path.is_dir():
        for year_dir in sorted(fpi_path.iterdir(), reverse=True):
            if year_dir.is_dir():
                candidates = list(year_dir.glob(f"{ticker.upper()}_*.htm.gz")) + list(year_dir.glob(f"{ticker.upper()}_*.txt"))
                if candidates:
                    return candidates[0], "cat2-foreign-adr-20F"
    return None, None


def read_source(path):
    try:
        if str(path).endswith(".gz"):
            with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        else:
            text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def extract_repartition_section(text):
    """Find best section for segment+geo extraction."""
    if not text or len(text) < 5000:
        return text
    # Look for segment reporting section
    patterns = [
        r"(?:segment\s+information|reportable\s+segments|business\s+segments|segments\s+op[ée]rationnels|segment\s+reporting)",
        r"(?:revenue\s+by\s+(?:segment|geography|region)|chiffre\s+d.affaires\s+par)",
        r"(?:geographic\s+(?:information|distribution)|by\s+geography|by\s+region)",
    ]
    chunks = []
    for pat in patterns:
        matches = list(re.finditer(pat, text, re.I))
        if matches:
            # Take last match (typically in MD&A, not table of contents)
            for m in matches[-3:]:
                start = m.start()
                chunks.append((start, text[start:start + 7000]))
    if not chunks:
        # Fallback to middle of document
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]
    # Dedup overlapping
    chunks.sort(key=lambda x: x[0])
    result_parts = []
    last_end = -3000
    for start, txt in chunks:
        if start - last_end < 2000:
            continue
        result_parts.append(txt)
        last_end = start + len(txt)
    return ("\n\n=== SECTION ===\n\n".join(result_parts))[:CTX_LEN]


def get_pipeline_name(ticker):
    p = V2P / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            return d.get("name") or ticker
        except Exception:
            pass
    return ticker


def write_enrich_repartition(ticker, segments, geographies, is_single_seg, is_single_reg, seg_rationale, reg_rationale):
    """Write extracted repartition into v2-pipeline-enrich/<lower>.json."""
    p = V2_ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
        except Exception:
            d = {}
    else:
        d = {}

    changed = False

    if segments and len(segments) >= 2:
        # Slices must have label + (value with unit OR share_pct)
        clean_slices = []
        total_pct = 0.0
        for s in segments:
            label = s.get("label")
            if not isinstance(label, str) or not label.strip():
                continue
            entry = {"label": label.strip()}
            v = s.get("value")
            if isinstance(v, (int, float)) and v >= 0:
                entry["value"] = float(v)
            pct = s.get("share_pct")
            if isinstance(pct, (int, float)) and 0 <= pct <= 100:
                entry["share_pct"] = float(pct)
                total_pct += float(pct)
            u = s.get("unit")
            if isinstance(u, str) and u.strip():
                entry["unit"] = u.strip()
            if "value" in entry or "share_pct" in entry:
                clean_slices.append(entry)
        if len(clean_slices) >= 2 and 85 <= total_pct <= 115:
            d.setdefault("revenue_by_segment", {})
            d["revenue_by_segment"]["slices"] = clean_slices
            d["revenue_by_segment"]["_source"] = "cerebras_paid_mission_159_phase3"
            d["revenue_by_segment"]["_extracted_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
    elif is_single_seg is True and seg_rationale:
        d.setdefault("revenue_by_segment", {})
        d["revenue_by_segment"]["single_segment"] = True
        d["revenue_by_segment"]["single_segment_rationale"] = seg_rationale
        d["revenue_by_segment"]["_source"] = "cerebras_paid_mission_159_phase3"
        d["revenue_by_segment"]["_extracted_at"] = datetime.now(timezone.utc).isoformat()
        changed = True

    if geographies and len(geographies) >= 2:
        clean_slices = []
        total_pct = 0.0
        for s in geographies:
            label = s.get("label")
            if not isinstance(label, str) or not label.strip():
                continue
            entry = {"label": label.strip()}
            v = s.get("value")
            if isinstance(v, (int, float)) and v >= 0:
                entry["value"] = float(v)
            pct = s.get("share_pct")
            if isinstance(pct, (int, float)) and 0 <= pct <= 100:
                entry["share_pct"] = float(pct)
                total_pct += float(pct)
            u = s.get("unit")
            if isinstance(u, str) and u.strip():
                entry["unit"] = u.strip()
            if "value" in entry or "share_pct" in entry:
                clean_slices.append(entry)
        if len(clean_slices) >= 2 and 85 <= total_pct <= 115:
            d.setdefault("revenue_by_geography", {})
            d["revenue_by_geography"]["slices"] = clean_slices
            d["revenue_by_geography"]["_source"] = "cerebras_paid_mission_159_phase3"
            d["revenue_by_geography"]["_extracted_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
    elif is_single_reg is True and reg_rationale:
        d.setdefault("revenue_by_geography", {})
        d["revenue_by_geography"]["single_region_legitimate"] = True
        d["revenue_by_geography"]["single_region_rationale"] = reg_rationale
        d["revenue_by_geography"]["_source"] = "cerebras_paid_mission_159_phase3"
        d["revenue_by_geography"]["_extracted_at"] = datetime.now(timezone.utc).isoformat()
        changed = True

    if changed:
        d["_repartition_extracted_by_159_at"] = datetime.now(timezone.utc).isoformat()
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    return changed


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL no keys")
        sys.exit(1)
    if not os.environ.get("PAID_MODE"):
        log_line("PAID_MODE not set")
        sys.exit(2)

    key_idx = int(os.environ.get("KEY_INDEX", "2")) % len(keys)
    log_line(f"START phase 3 f_repartition extraction: key_idx={key_idx}")

    audit = json.loads(AUDIT.read_text())
    top307 = json.loads(TOP307_FILE.read_text())[:307]
    sp500 = json.loads(SP500_FILE.read_text())
    scope = set(top307 + sp500)

    rep_ko = [r for r in audit["audits"] if r["ticker"] in scope and "f_repartition" in (r.get("failed_criteria") or [])]
    log_line(f"f_repartition KO in scope: {len(rep_ko)}")

    limit = int(os.environ.get("LIMIT", "0"))
    if limit:
        rep_ko = rep_ko[:limit]

    extracted = 0
    tagged_single = 0
    no_source = 0
    api_fail = 0
    no_data = 0
    results = []
    last_t = 0.0

    for i, r in enumerate(rep_ko):
        ticker = r["ticker"]
        name = get_pipeline_name(ticker)
        path, source_kind = find_source(ticker)
        if not path:
            log_line(f"[{i+1}/{len(rep_ko)}] {ticker}: NO SOURCE")
            no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        text = read_source(path)
        if not text or len(text) < 5000:
            log_line(f"[{i+1}/{len(rep_ko)}] {ticker}: short text")
            no_source += 1
            continue
        excerpt = extract_repartition_section(text)

        elapsed = time.time() - last_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_t = time.time()

        prompt = PROMPT.format(ticker=ticker, name=name, excerpt=excerpt)
        result, err = call_cerebras(prompt, keys[key_idx])
        if not result and err and "429" in err:
            for _ in range(len(keys) - 1):
                key_idx = (key_idx + 1) % len(keys)
                time.sleep(2)
                result, err = call_cerebras(prompt, keys[key_idx])
                if result or (err and "429" not in err):
                    break

        if not result:
            log_line(f"[{i+1}/{len(rep_ko)}] {ticker}: API FAIL {err}")
            api_fail += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        segments = result.get("segments") or []
        geographies = result.get("geographies") or []
        is_single_seg = result.get("is_single_segment")
        is_single_reg = result.get("is_single_region")
        seg_rationale = result.get("single_segment_rationale")
        reg_rationale = result.get("single_region_rationale")

        changed = write_enrich_repartition(
            ticker, segments, geographies, is_single_seg, is_single_reg,
            seg_rationale, reg_rationale
        )
        if changed:
            kind = []
            if segments and len(segments) >= 2:
                kind.append(f"seg×{len(segments)}")
            elif is_single_seg:
                kind.append("single_seg")
            if geographies and len(geographies) >= 2:
                kind.append(f"geo×{len(geographies)}")
            elif is_single_reg:
                kind.append("single_reg")
            log_line(f"[{i+1}/{len(rep_ko)}] {ticker}: OK [{','.join(kind)}] src={source_kind}")
            if any("single" in k for k in kind):
                tagged_single += 1
            else:
                extracted += 1
            results.append({"ticker": ticker, "status": "ok", "kinds": kind, "source": source_kind})
        else:
            log_line(f"[{i+1}/{len(rep_ko)}] {ticker}: NO_DATA (LLM returned empty/invalid)")
            no_data += 1
            results.append({"ticker": ticker, "status": "no_data"})

        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(f"END phase 3: extracted={extracted} tagged_single={tagged_single} no_data={no_data} no_source={no_source} api_fail={api_fail}")

    out_file = RESULTS_DIR / f"mission_159_phase3_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mission": 159,
        "phase": 3,
        "summary": {
            "extracted": extracted,
            "tagged_single": tagged_single,
            "no_data": no_data,
            "no_source": no_source,
            "api_fail": api_fail,
            "total": len(rep_ko),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
