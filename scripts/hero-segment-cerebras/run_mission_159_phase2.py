#!/usr/bin/env python3
"""
Mission #159 Phase 2 — hero company-specific legitimate tagging

For each top307+SP500 sté with a_hero_history KO, decide if the hero KPI
is genuinely company-specific (segment-level KPI, ratio recent, etc.)
and tag _hero_is_company_specific_legitimate via Cerebras paid.

Cap : 10 % du dataset (~80 stés total). Current usage ~20 stés. So we can
tag up to ~60 more max.

Output: writes _hero_is_company_specific_legitimate=true into v2-pipeline-enrich/
along with rationale and category.

Usage:
  PAID_MODE=1 KEY_INDEX=1 python3 scripts/hero-segment-cerebras/run_mission_159_phase2.py
"""
from __future__ import annotations

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
RESULTS_DIR = PROJECT_ROOT / "src/data/hero-segment-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-mission-159-phase2.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 800

# Categories for tagging
CATEGORIES = {
    "segment_revenue": "Revenu segment spécifique reporté par l'entreprise",
    "operational_metric": "Métrique opérationnelle propre (volume, capacité, units)",
    "recent_kpi": "KPI introduit récemment (<5 ans) suite à acquisition ou nouveau reporting",
    "banking_ratio": "Ratio bancaire/assurantiel (CET1, NII, ROTCE, etc.)",
    "real_estate_metric": "Métrique REIT/immobilier (occupancy, same-store)",
    "biotech_pipeline": "Pipeline médicamenteux ou drug-specific",
    "industrial_segment": "Segment industriel (backlog, deliveries)",
    "asset_mgmt_aum": "AUM/Assets under management",
    "retail_store_metric": "Store count, comp sales, retail-specific",
    "subscription_metric": "MAU, ARR, subscribers, autoship %",
    "automotive_deliveries": "Volumes véhicules ou unités vendues",
}

PROMPT = """You are classifying whether a hero KPI is "company-specific legitimate" — meaning the KPI is a segment-level metric, recent product/segment KPI, or industry-specific ratio that the company genuinely reports but doesn't have 5+ years of history available because:
- The KPI was introduced after a recent acquisition or business reorganization
- It's a segment-level KPI not reported in earlier filings
- It's an industry-specific metric (CET1, ROTCE, AUM, Backlog) reported quarterly with limited cross-year reconstruction
- The company reports it but only in last few quarters

DO NOT tag as legitimate if:
- It's a generic KPI (Total Revenue, Net Income, EPS, EBITDA) where 5+ years SHOULD be available
- The data is missing due to extraction failure (data probably exists in older filings)
- It's a basic financial KPI that XBRL companyfacts would have

Hero KPI to classify:
- Ticker: {ticker}
- Hero KPI short: {hero_short}
- Hero name FR: {name_fr}
- Hero name EN: {name_en}
- Current history length: {history_len} ({period})
- Required: {min_required} {period} for normal qualification

Return STRICT JSON only:
{{
  "is_company_specific_legitimate": <bool>,
  "category": "<one of: segment_revenue, operational_metric, recent_kpi, banking_ratio, real_estate_metric, biotech_pipeline, industrial_segment, asset_mgmt_aum, retail_store_metric, subscription_metric, automotive_deliveries>" or null,
  "rationale": "<short FR rationale, 100-200 chars, why this hero is legitimate company-specific OR why it's NOT>"
}}

Be STRICT. Only tag legitimate if the KPI is clearly segment-level, ratio, or recent product metric where 5y reconstruction is unrealistic. If it's just "Total Revenue" or "Net Income", return false."""


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
                        return None, f"JSON parse fail: {e}"
                return None, "no JSON in response"
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


def get_pipeline_data(ticker):
    p = V2P / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def write_tag(ticker, category, rationale):
    p = V2_ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
        except Exception:
            d = {}
    else:
        d = {}
    d["_hero_is_company_specific_legitimate"] = True
    d["_hero_specific_rationale"] = rationale
    d["_hero_specific_category"] = category
    d["_hero_specific_tagged_at"] = datetime.now(timezone.utc).isoformat()
    d["_hero_specific_source"] = "cerebras_paid_mission_159"
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL no keys")
        sys.exit(1)
    if not os.environ.get("PAID_MODE"):
        log_line("PAID_MODE not set")
        sys.exit(2)

    key_idx = int(os.environ.get("KEY_INDEX", "1")) % len(keys)
    log_line(f"START phase 2 hero company-specific tagging: key_idx={key_idx}")

    audit = json.loads(AUDIT.read_text())
    top307 = json.loads(TOP307_FILE.read_text())[:307]
    sp500 = json.loads(SP500_FILE.read_text())
    scope = set(top307 + sp500)

    hero_ko = [r for r in audit["audits"] if r["ticker"] in scope and "a_hero_history" in (r.get("failed_criteria") or [])]
    log_line(f"hero_ko in scope: {len(hero_ko)}")

    # Limit
    limit = int(os.environ.get("LIMIT", "0"))
    if limit:
        hero_ko = hero_ko[:limit]
        log_line(f"LIMIT={limit}, processing {len(hero_ko)}")

    # Cap budget: respect 10% dataset cap. Total = 807. 10% = 80. Already tagged 20.
    # We can add ~60.
    cap_remaining = int(os.environ.get("CAP_REMAINING", "60"))

    tagged = 0
    skipped_not_legitimate = 0
    skipped_already = 0
    api_fail = 0
    results = []
    last_t = 0.0

    for i, r in enumerate(hero_ko):
        if tagged >= cap_remaining:
            log_line(f"Cap reached at {tagged}, stopping")
            break

        ticker = r["ticker"]
        # Check if already tagged
        enrich_p = V2_ENRICH / f"{ticker.lower()}.json"
        if enrich_p.exists():
            try:
                d = json.loads(enrich_p.read_text())
                if d.get("_hero_is_company_specific_legitimate") is True:
                    skipped_already += 1
                    continue
            except Exception:
                pass

        pipeline = get_pipeline_data(ticker)
        if not pipeline:
            results.append({"ticker": ticker, "status": "no_pipeline"})
            continue
        hero_short = pipeline.get("hero_kpi")
        kpis = pipeline.get("kpis") or []
        hero = next((k for k in kpis if k.get("short") == hero_short), None)
        if not hero:
            results.append({"ticker": ticker, "status": "no_hero"})
            continue
        history_len = len(hero.get("history") or [])
        if history_len < 3:
            # Not enough data even for company-specific exception
            results.append({"ticker": ticker, "status": "too_short_lt3"})
            continue

        period = hero.get("period_type") or "year"
        if period == "quarter":
            min_required = 18
        elif period in ("semester", "half"):
            min_required = 8
        else:
            min_required = 5

        prompt = PROMPT.format(
            ticker=ticker,
            hero_short=hero_short,
            name_fr=hero.get("name_fr") or "",
            name_en=hero.get("name_en") or "",
            history_len=history_len,
            period=period,
            min_required=min_required,
        )

        elapsed = time.time() - last_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_t = time.time()

        result, err = call_cerebras(prompt, keys[key_idx])
        if not result and err and "429" in err:
            for _ in range(len(keys) - 1):
                key_idx = (key_idx + 1) % len(keys)
                time.sleep(2)
                result, err = call_cerebras(prompt, keys[key_idx])
                if result or (err and "429" not in err):
                    break

        if not result:
            log_line(f"[{i+1}/{len(hero_ko)}] {ticker}: API FAIL {err}")
            api_fail += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        is_legit = bool(result.get("is_company_specific_legitimate"))
        cat = result.get("category")
        rationale = result.get("rationale") or ""

        if not is_legit:
            log_line(f"[{i+1}/{len(hero_ko)}] {ticker}: NOT_LEGITIMATE — {rationale[:100]}")
            skipped_not_legitimate += 1
            results.append({"ticker": ticker, "status": "not_legitimate", "rationale": rationale})
            continue

        if cat not in CATEGORIES:
            log_line(f"[{i+1}/{len(hero_ko)}] {ticker}: invalid category {cat!r}")
            results.append({"ticker": ticker, "status": "bad_category", "category": cat})
            continue

        if not rationale or len(rationale) < 20:
            log_line(f"[{i+1}/{len(hero_ko)}] {ticker}: rationale too short")
            results.append({"ticker": ticker, "status": "bad_rationale"})
            continue

        write_tag(ticker, cat, rationale)
        log_line(f"[{i+1}/{len(hero_ko)}] {ticker}: TAGGED cat={cat} hero={hero_short} len={history_len}")
        tagged += 1
        results.append({"ticker": ticker, "status": "tagged", "category": cat, "rationale": rationale})

        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(f"END phase 2: tagged={tagged} not_legit={skipped_not_legitimate} skipped_already={skipped_already} api_fail={api_fail}")
    out_file = RESULTS_DIR / f"mission_159_phase2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mission": 159,
        "phase": 2,
        "summary": {
            "tagged": tagged,
            "not_legitimate": skipped_not_legitimate,
            "skipped_already": skipped_already,
            "api_fail": api_fail,
            "total_candidates": len(hero_ko),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
