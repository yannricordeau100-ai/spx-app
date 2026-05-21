#!/usr/bin/env python3
"""Run PASS B sequentially, key rotation, very slow rate.

Targets only EU stés still needing top_voting/top_capital >=3.
Uses keys 0+1 rotation, 8s sleep between calls.
"""
import importlib.util
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("e", "scripts/enrich-top-voting-capital.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.load_env()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
pub = json.load(open(PROJECT_ROOT / "src/data/v1-9-publishable.json"))
tickers = pub["tickers"]

# Find remaining
targets = []
for t in tickers:
    d = m.load_pipeline(t)
    g = (d or {}).get("governance") or {}
    if g.get("top_disclosure") in ("unavailable_adr", "unavailable_eu_no_yf", "partial_eu_no_yf"):
        # Even if previously tagged unavailable, retry if we can
        pass
    tv, tc, _ = m.get_gov_status(d)
    if tv < 3 or tc < 3:
        targets.append(t)

print(f"Targets: {len(targets)}", flush=True)
ok, fail_llm, fail_src, partial = [], [], [], []
key_idx = 0

for i, ticker in enumerate(targets):
    text, kind = m.read_source(ticker)
    if not text:
        fail_src.append(ticker)
        continue
    ctx = m.find_section_eu(text) if kind == "eu" else m.find_section_us_def14a(text)

    # Rotate key 0 / 1
    key = m.get_api_key(key_idx % 2)
    key_idx += 1

    data = m.load_pipeline(ticker)
    name = data.get("name") or ticker
    prompt = m.PROMPT_TOP.format(name=name, ticker=ticker, ctx=ctx)
    result, err = m.call_cerebras(prompt, key, retries=2)

    if not result:
        fail_llm.append((ticker, err))
        print(f"  [{i+1}/{len(targets)}] {ticker}: FAIL {err}", flush=True)
        time.sleep(8)
        continue

    tv = m.sanitize_holders(result.get("top_voting"))
    tc = m.sanitize_holders(result.get("top_capital"))
    note = result.get("voting_structure_note") or ""
    if not isinstance(note, str):
        note = ""
    if tv and not tc: tc = list(tv)
    if tc and not tv: tv = list(tc)

    if not tv and not tc:
        fail_llm.append((ticker, "empty_holders"))
        print(f"  [{i+1}/{len(targets)}] {ticker}: empty", flush=True)
    else:
        m.merge_enrich(ticker, {
            "governance": {
                "top_voting": tv,
                "top_capital": tc,
                "voting_structure_note": note or "OK 1-share-1-vote",
                "_top_source": f"cerebras_{kind}",
                "_top_enriched_at": datetime.now(timezone.utc).isoformat(),
            }
        })
        if len(tv) >= 3 and len(tc) >= 3:
            ok.append(ticker)
            print(f"  [{i+1}/{len(targets)}] {ticker}: OK tv={len(tv)} tc={len(tc)}", flush=True)
        else:
            partial.append((ticker, len(tv), len(tc)))
            print(f"  [{i+1}/{len(targets)}] {ticker}: partial tv={len(tv)} tc={len(tc)}", flush=True)
    time.sleep(8)

print(f"\nDONE: ok={len(ok)} partial={len(partial)} fail_llm={len(fail_llm)} fail_src={len(fail_src)}", flush=True)
