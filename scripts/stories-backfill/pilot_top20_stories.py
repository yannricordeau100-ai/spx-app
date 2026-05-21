#!/usr/bin/env python3
"""
Pilot stories backfill — top 20 majors V1.9.

Lecture v2-pipeline/<t>.json + v2-pipeline-enrich/<t>.json pour contexte,
appel Cerebras Qwen-3 235B pour générer 8 stories KPI HIGH PV,
écriture dans v2-pipeline-enrich/<t>.json champ stories_kpis (merger).

Séquentiel, throttle 4s. Aucune parallélisation (mission pilot).
"""

import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path("/Users/yann/spx-app")
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

TARGET_STORIES = 8

TICKERS = [
    "nvda", "googl", "msft", "aapl", "amzn", "meta", "avgo", "tsla", "lly", "jpm",
    "v", "ma", "wmt", "unh", "hd", "mc.pa", "asml", "tsm", "nesn.sw", "rog.sw",
]


def load_env():
    env_path = ROOT / ".env.local"
    env = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
CEREBRAS_KEYS = [
    ENV.get("CEREBRAS_API_KEY"),
    ENV.get("CEREBRAS2_API_KEY"),
    ENV.get("CEREBRAS3_API_KEY"),
]
CEREBRAS_KEYS = [k for k in CEREBRAS_KEYS if k]
GROQ_KEY = ENV.get("GROQ_API_KEY")

if not CEREBRAS_KEYS:
    print("ERROR: no Cerebras keys found", file=sys.stderr)
    sys.exit(1)


def cerebras_call(prompt: str, key_idx: int = 0) -> str:
    """Call Cerebras Qwen-3 235B. Rotate keys on 429."""
    body = {
        "model": "qwen-3-235b-a22b-instruct-2507",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
        "temperature": 0.3,
    }
    data = json.dumps(body).encode("utf-8")
    last_err = None
    for attempt, key in enumerate(CEREBRAS_KEYS[key_idx:] + CEREBRAS_KEYS[:key_idx]):
        req = urllib.request.Request(
            "https://api.cerebras.ai/v1/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90, context=SSL_CTX) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                return payload["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:200]}"
            if e.code in (429, 500, 502, 503, 504):
                print(f"  retry key #{attempt+1} ({last_err[:80]})", flush=True)
                time.sleep(3)
                continue
            raise RuntimeError(last_err)
        except Exception as e:
            last_err = str(e)
            print(f"  retry key #{attempt+1} ({last_err[:80]})", flush=True)
            time.sleep(3)
            continue
    raise RuntimeError(f"all keys failed: {last_err}")


def load_context(ticker: str) -> dict:
    pipe = json.load(open(PIPELINE / f"{ticker}.json"))
    try:
        enrich = json.load(open(ENRICH / f"{ticker}.json"))
    except FileNotFoundError:
        enrich = {}
    return {"pipeline": pipe, "enrich": enrich}


def existing_stories(pipe: dict, enrich: dict) -> list:
    """Combine stories de pipeline + enrich (déjà placées)."""
    pipe_s = pipe.get("stories_kpis") or []
    enr_s = enrich.get("stories_kpis") or []
    seen = set()
    out = []
    for s in pipe_s + enr_s:
        key = (s.get("short") or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(s)
    return out


def build_prompt(ticker: str, ctx: dict, existing: list, n_needed: int) -> str:
    pipe = ctx["pipeline"]
    enrich = ctx["enrich"]
    name = pipe.get("name", ticker.upper())
    sector = pipe.get("sector", "")
    subsector = pipe.get("subsector", "")
    tagline = pipe.get("tagline", "")
    ai_pos = enrich.get("ai_positioning") or {}
    ai_evidence = ai_pos.get("evidence", [])[:5] if isinstance(ai_pos, dict) else []
    descr = enrich.get("company_description") or ""
    if isinstance(descr, dict):
        descr = descr.get("long") or descr.get("short") or ""
    descr = str(descr)[:1200]
    existing_shorts = [s.get("short") for s in existing if s.get("short")]
    kpi_shorts = [k.get("short") for k in pipe.get("kpis", []) if k.get("short")]

    return f"""You are extracting HIGH-PV "story" KPIs for retail investors on {name} ({ticker.upper()}).

Sector: {sector} / {subsector}
Tagline: {tagline}
Company description: {descr}
AI positioning evidence: {json.dumps(ai_evidence, ensure_ascii=False)[:600]}

Existing story KPIs ({len(existing)}): {json.dumps(existing_shorts, ensure_ascii=False)}
Existing regular KPIs (for reference, do NOT duplicate): {json.dumps(kpi_shorts[:20], ensure_ascii=False)}

TASK: Generate exactly {n_needed} NEW "story" KPIs that are HIGH perceived value for retail investors. SKIP generic Revenue/EBITDA/Net Income/Margin. Each story must be a specific, story-worthy metric falling into ONE of these categories:
- Innovation: new products, AI bookings, R&D pipeline, design wins
- Marché: market share, new geographies, TAM disclosures, segment leadership
- Adoption: MAU/DAU spikes, customer wins, retention, attach rate
- Capacité: capacity adds, factory builds, fleet expansion, supply

OUTPUT FORMAT: JSON array of exactly {n_needed} objects. Each object must have these exact fields:
- short: short English label (2-5 words)
- name_fr: French name
- name_en: English name
- explanation: 1 short sentence French explaining what the KPI is
- value: numeric string (e.g. "12.5") OR "n/a"
- unit: e.g. "Mds $", "%", "M unités", "TWh", "GW", "stores"
- yoy: e.g. "+12%" or "n/a"
- type: e.g. "Revenue", "User", "Capacity", "Pipeline", "Share"
- nature: "Structurel" or "Conjoncturel" or "Cyclique"
- comparable: "Comparable" or "Non comparable"
- signal: 1 phrase French capturing why this matters now
- description: 2 short sentences French
- history: array of 3-5 recent numeric values (most recent last) — use realistic disclosed figures, or [value] if only latest known
- last_data_date: "YYYY-MM-DD" estimated
- is_wow: false
- is_generic: false
- is_short_history: true
- story_category: one of "Innovation", "Marché", "Adoption", "Capacité"

CRITICAL:
- Output ONLY the JSON array, no prose, no markdown fences.
- Use realistic data based on public disclosures up to early 2026.
- No duplication with existing shorts above.
- French in name_fr/explanation/signal/description (no em-dash, vocabulaire FR strict)."""


def parse_json_array(text: str) -> list:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    text = text.strip()
    # find first [ and last ]
    i = text.find("[")
    j = text.rfind("]")
    if i == -1 or j == -1:
        raise ValueError(f"no JSON array found in response: {text[:200]}")
    return json.loads(text[i : j + 1])


def normalize_story(s: dict) -> dict:
    """Ensure required defaults + types."""
    s.setdefault("is_wow", False)
    s.setdefault("is_generic", False)
    s.setdefault("is_short_history", True)
    s.setdefault("yoy", "n/a")
    s.setdefault("nature", "Structurel")
    s.setdefault("comparable", "Non comparable")
    s.setdefault("type", "Story")
    h = s.get("history")
    if not isinstance(h, list):
        try:
            v = float(str(s.get("value", "0")).replace(",", "."))
            s["history"] = [v]
        except Exception:
            s["history"] = []
    return s


def process_ticker(ticker: str) -> dict:
    ctx = load_context(ticker)
    existing = existing_stories(ctx["pipeline"], ctx["enrich"])
    before = len(existing)
    needed = max(0, TARGET_STORIES - before)
    if needed == 0:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "skipped": True}

    prompt = build_prompt(ticker, ctx, existing, needed)
    resp = cerebras_call(prompt)
    try:
        new_stories = parse_json_array(resp)
    except Exception as e:
        print(f"  PARSE ERR {ticker}: {e}", flush=True)
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "error": str(e)[:200]}

    new_stories = [normalize_story(s) for s in new_stories if isinstance(s, dict) and s.get("short")]
    # filter duplicates vs existing
    existing_keys = {(s.get("short") or "").strip().lower() for s in existing}
    new_stories = [s for s in new_stories if s.get("short", "").strip().lower() not in existing_keys]

    enrich_path = ENRICH / f"{ticker}.json"
    if enrich_path.exists():
        enrich_data = json.load(open(enrich_path))
    else:
        enrich_data = {"ticker": ticker.upper()}

    enrich_existing = enrich_data.get("stories_kpis") or []
    merged = enrich_existing + new_stories
    enrich_data["stories_kpis"] = merged
    enrich_data["_stories_backfill_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    enrich_data["_stories_backfill_source"] = "cerebras_qwen3_235b_pilot_top20"

    tmp = enrich_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(enrich_data, ensure_ascii=False, indent=2))
    tmp.replace(enrich_path)

    return {
        "ticker": ticker,
        "before": before,
        "added": len(new_stories),
        "after": before + len(new_stories),
        "new_shorts": [s.get("short") for s in new_stories],
    }


def main():
    results = []
    for i, t in enumerate(TICKERS):
        print(f"[{i+1}/{len(TICKERS)}] {t.upper()} ...", flush=True)
        try:
            r = process_ticker(t)
            print(f"  before={r['before']} added={r['added']} after={r['after']}", flush=True)
            results.append(r)
        except Exception as e:
            print(f"  ERROR {t}: {e}", flush=True)
            results.append({"ticker": t, "error": str(e)[:300]})
        if i < len(TICKERS) - 1:
            time.sleep(4)

    out = ROOT / "src/data/stories-backfill-pilot-top20-results.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\nDONE — results: {out}")
    total_added = sum(r.get("added", 0) for r in results)
    n_enriched = sum(1 for r in results if r.get("added", 0) > 0)
    print(f"Tickers enriched: {n_enriched}/{len(TICKERS)} | Total stories added: {total_added}")


if __name__ == "__main__":
    main()
