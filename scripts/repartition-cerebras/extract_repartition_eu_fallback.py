#!/usr/bin/env python3
"""EU repartition fallback extraction — mission #172.

Pour les stés EU dont les regex SEGMENT_KEYWORDS / GEO_KEYWORDS du script
extract_repartition_paid.py ne matchent pas (filings EU au format
non-anglo-saxon), on prend les premiers 22000 chars du filing directement
et on laisse le LLM trouver les sections.

Réutilise les helpers du script principal.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
sys.path.insert(0, str(ROOT / "scripts/repartition-cerebras"))

# Import the heavy lifters from the paid script
from extract_repartition_paid import (  # type: ignore
    ACTIVE_KEYS,
    build_prompt,
    cerebras_call,
    load_company_name,
    parse_json_strict,
    read_filing,
    validate_block,
    write_enrich,
)


def get_excerpt_fallback(text: str, max_chars: int = 22000) -> str:
    """For EU stés where regex anchors fail, take first slab of text.

    EU annual reports often start with strategic summary listing
    revenue by segment + geography in opening pages.
    """
    if len(text) <= max_chars:
        return text
    # Skip cover page (often first 800 chars), grab next 22000
    return text[800 : 800 + max_chars]


def process_ticker(target: dict, primary_idx: int, state: dict) -> dict:
    ticker = target["ticker"]
    filing = target["filing"]
    text = read_filing(filing)
    if not text or len(text) < 5000:
        return {"ticker": ticker, "ok": False, "reason": "filing_unreadable", "filing": filing}

    excerpt = get_excerpt_fallback(text, max_chars=22000)
    if len(excerpt) < 500:
        return {"ticker": ticker, "ok": False, "reason": "too_short"}

    name = load_company_name(ticker)
    prompt = build_prompt(ticker, name, excerpt)

    try:
        resp, source = cerebras_call(prompt, primary_idx, state)
    except Exception as e:
        return {"ticker": ticker, "ok": False, "reason": f"api_fail:{str(e)[:160]}"}

    parsed = parse_json_strict(resp)
    if not parsed:
        return {"ticker": ticker, "ok": False, "reason": "json_parse_fail"}

    seg = parsed.get("revenue_by_segment")
    geo = parsed.get("revenue_by_geography")
    seg_ok, seg_reason = validate_block(seg, "segment") if seg else (False, "null")
    geo_ok, geo_reason = validate_block(geo, "geography") if geo else (False, "null")

    if not seg_ok and not geo_ok:
        return {"ticker": ticker, "ok": False, "reason": f"both_invalid seg={seg_reason} geo={geo_reason}"}

    write_enrich(ticker, seg if seg_ok else None, geo if geo_ok else None, source + "_eu_fallback")
    return {
        "ticker": ticker,
        "ok": True,
        "seg_slices": len(seg.get("slices") or []) if seg_ok and isinstance(seg, dict) else 0,
        "geo_slices": len(geo.get("slices") or []) if geo_ok and isinstance(geo, dict) else 0,
        "source": source,
    }


def main():
    targets_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/repartition-eu-fallback.json")
    if not targets_file.exists():
        print(f"missing {targets_file}", file=sys.stderr)
        sys.exit(1)
    targets = json.load(open(targets_file))
    print(f"[EU FALLBACK] {len(targets)} tickers | {len(ACTIVE_KEYS)} keys", flush=True)
    state: dict = {}
    primary = 2
    ok = 0
    results = []
    for i, t in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {t['ticker']} ...", flush=True)
        r = process_ticker(t, primary, state)
        results.append(r)
        if r.get("ok"):
            ok += 1
            print(f"  OK seg={r.get('seg_slices')} geo={r.get('geo_slices')} src={r.get('source')}")
        else:
            print(f"  SKIP {r.get('reason')}")
        time.sleep(0.8)
    print(f"\nDONE: {ok}/{len(targets)} OK")
    out = Path("/tmp/repartition-eu-fallback-results.json")
    out.write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
