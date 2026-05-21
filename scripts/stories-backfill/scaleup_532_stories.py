#!/usr/bin/env python3
"""
Scale-up stories backfill — 532 V1.9 publishable restantes (après pilot 20).

Multi-procs 3 procs Python parallèles, chacun avec 1 clé Cerebras dédiée.
Throttle 4s par clé. Switch 60s + 2 keys si une key 429. Break si toutes 3 keys 429.

Cibles dynamiques :
  - MC > 10 Mds USD  -> 8 stories
  - MC <= 10 Mds USD -> 5 stories
  - MC absente       -> 5 stories (par défaut)

Output : src/data/v2-pipeline-enrich/<ticker>.json champ stories_kpis (merger).
Tag _stories_backfill_at + _stories_backfill_source.

Usage:
  python3 scripts/stories-backfill/scaleup_532_stories.py --shard 0 --total-shards 3 --key-idx 0
  python3 scripts/stories-backfill/scaleup_532_stories.py --shard 1 --total-shards 3 --key-idx 1
  python3 scripts/stories-backfill/scaleup_532_stories.py --shard 2 --total-shards 3 --key-idx 2

Ou lancer les 3 en parallèle via launch_scaleup.sh.
"""

import argparse
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
PUBLISHABLE = ROOT / "src/data/v1-9-publishable.json"
RESULTS_DIR = ROOT / "src/data/stories-backfill-scaleup"
RESULTS_DIR.mkdir(exist_ok=True)

MC_THRESHOLD_USD = 10e9  # 10 Mds USD
TARGET_LARGE = 8
TARGET_MID = 5

PILOT_TICKERS = {
    "nvda", "googl", "msft", "aapl", "amzn", "meta", "avgo", "tsla", "lly", "jpm",
    "v", "ma", "wmt", "unh", "hd", "mc.pa", "asml", "tsm", "nesn.sw", "rog.sw",
}


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
ALL_KEYS = [
    ENV.get("CEREBRAS_API_KEY"),
    ENV.get("CEREBRAS2_API_KEY"),
    ENV.get("CEREBRAS3_API_KEY"),
]
ALL_KEYS = [k for k in ALL_KEYS if k]
GROQ_KEY = ENV.get("GROQ_API_KEY")  # Free fallback when all Cerebras keys 429/402
if len(ALL_KEYS) < 3:
    print(f"WARN: only {len(ALL_KEYS)} Cerebras keys found (expected 3)", file=sys.stderr)


GROQ_COOLDOWN_UNTIL = 0


def groq_call(prompt: str, max_retries: int = 2) -> str:
    """Groq Llama 3.3 70B free fallback. Retries on 429 with backoff."""
    global GROQ_COOLDOWN_UNTIL
    if not GROQ_KEY:
        raise RuntimeError("no GROQ_API_KEY")
    if time.time() < GROQ_COOLDOWN_UNTIL:
        raise RuntimeError(f"groq cooldown for {int(GROQ_COOLDOWN_UNTIL-time.time())}s")
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
        "temperature": 0.3,
    }
    data = json.dumps(body).encode("utf-8")
    last_err = None
    for attempt in range(max_retries + 1):
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "curl/8",
            },
            method="POST",
        )
        try:
            return _groq_parse(req)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")[:300]
            last_err = f"groq HTTP {e.code}: {err_body}"
            if e.code == 429:
                # Parse retry-after if available, else 30s backoff
                wait = 30
                # Set global cooldown to deflect concurrent procs
                GROQ_COOLDOWN_UNTIL = time.time() + 30
                if attempt < max_retries:
                    time.sleep(wait)
                    continue
                raise RuntimeError(last_err)
            raise RuntimeError(last_err)
        except Exception as e:
            last_err = f"groq {e}"
            if attempt < max_retries:
                time.sleep(3)
                continue
            raise
    raise RuntimeError(last_err or "groq unknown")


def _groq_parse(req: urllib.request.Request) -> str:
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        raw = resp.read().decode("utf-8")
        try:
            payload = json.loads(raw)
        except Exception as je:
            raise RuntimeError(f"groq json parse fail: {je} body={raw[:200]}")
        choices = payload.get("choices") if isinstance(payload, dict) else None
        if not choices or not isinstance(choices, list):
            raise RuntimeError(f"groq bad payload: {str(payload)[:200]}")
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = msg.get("content") if isinstance(msg, dict) else None
        if not content:
            raise RuntimeError(f"groq no content: {str(payload)[:200]}")
        return content


def cerebras_call(prompt: str, primary_key_idx: int, throttle_state: dict) -> str:
    """Call Cerebras with primary key, switch to others on 429.

    throttle_state tracks per-key cooldown.
    """
    body = {
        "model": "qwen-3-235b-a22b-instruct-2507",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
        "temperature": 0.3,
    }
    data = json.dumps(body).encode("utf-8")

    # Try keys in order: primary first, then others
    order = [primary_key_idx] + [i for i in range(len(ALL_KEYS)) if i != primary_key_idx]
    last_err = None
    consecutive_429 = 0

    for attempt_idx, kidx in enumerate(order):
        # Respect cooldown
        now = time.time()
        cooldown_until = throttle_state.get(f"cool_{kidx}", 0)
        if now < cooldown_until:
            continue

        key = ALL_KEYS[kidx]
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
            with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
                raw = resp.read().decode("utf-8")
                try:
                    payload = json.loads(raw)
                except Exception as je:
                    last_err = f"key#{kidx} json parse fail: {je} body={raw[:200]}"
                    continue
                choices = payload.get("choices") if isinstance(payload, dict) else None
                if not choices or not isinstance(choices, list):
                    last_err = f"key#{kidx} bad payload: {str(payload)[:200]}"
                    continue
                msg = choices[0].get("message") if isinstance(choices[0], dict) else None
                content = msg.get("content") if isinstance(msg, dict) else None
                if not content:
                    last_err = f"key#{kidx} no content: {str(payload)[:200]}"
                    continue
                # Track key usage success
                throttle_state[f"ok_{kidx}"] = throttle_state.get(f"ok_{kidx}", 0) + 1
                return content
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore")[:200]
            last_err = f"HTTP {e.code} key#{kidx}: {body_text}"
            throttle_state[f"err_{kidx}"] = throttle_state.get(f"err_{kidx}", 0) + 1
            if e.code == 429:
                consecutive_429 += 1
                # Mark this key in cooldown 60s
                throttle_state[f"cool_{kidx}"] = time.time() + 60
                print(f"  429 on key#{kidx}, cooldown 60s, trying next", flush=True)
                continue
            if e.code == 402:
                # Quota exhausted on this key (paid tier required). Long cooldown.
                throttle_state[f"cool_{kidx}"] = time.time() + 3600
                print(f"  402 on key#{kidx} (quota exhausted), parking 1h", flush=True)
                continue
            if e.code in (500, 502, 503, 504):
                time.sleep(3)
                continue
            # Other HTTP errors: skip key, try next
            print(f"  HTTP {e.code} key#{kidx}, trying next", flush=True)
            continue
        except Exception as e:
            last_err = f"key#{kidx}: {e}"
            throttle_state[f"err_{kidx}"] = throttle_state.get(f"err_{kidx}", 0) + 1
            time.sleep(2)
            continue

    # All Cerebras keys failed (or in cooldown) — try Groq fallback (free)
    err_snippet = (last_err or "all_keys_in_cooldown")[:80]
    if GROQ_KEY:
        try:
            print(f"  cerebras KO ({err_snippet}), fallback Groq", flush=True)
            return groq_call(prompt)
        except Exception as ge:
            last_err = f"cerebras={last_err or 'cooldown'} | groq={ge}"
    # All providers failed
    if consecutive_429 >= len(ALL_KEYS):
        raise RuntimeError(f"ALL_429: {last_err}")
    raise RuntimeError(f"all keys failed: {last_err}")


def load_context(ticker: str) -> dict:
    pipe_f = PIPELINE / f"{ticker.lower()}.json"
    if not pipe_f.exists():
        return None
    pipe = json.load(open(pipe_f))
    enr_f = ENRICH / f"{ticker.lower()}.json"
    enrich = json.load(open(enr_f)) if enr_f.exists() else {}
    ranks_f = ENRICH / f"{ticker.lower()}.ranks.json"
    ranks_data = json.load(open(ranks_f)) if ranks_f.exists() else {}
    return {"pipeline": pipe, "enrich": enrich, "ranks": ranks_data}


def get_target_stories(ranks_data: dict) -> int:
    mc = ranks_data.get("market_cap_usd")
    if mc and mc > MC_THRESHOLD_USD:
        return TARGET_LARGE
    return TARGET_MID


def existing_stories(pipe: dict, enrich: dict) -> list:
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
    i = text.find("[")
    j = text.rfind("]")
    if i == -1 or j == -1:
        raise ValueError(f"no JSON array found: {text[:200]}")
    return json.loads(text[i : j + 1])


def normalize_story(s: dict) -> dict:
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


def process_ticker(ticker: str, primary_key_idx: int, throttle_state: dict) -> dict:
    ctx = load_context(ticker)
    if ctx is None:
        return {"ticker": ticker, "skipped": True, "reason": "no_pipeline_file"}

    target = get_target_stories(ctx["ranks"])
    existing = existing_stories(ctx["pipeline"], ctx["enrich"])
    before = len(existing)
    needed = max(0, target - before)
    if needed == 0:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "target": target, "skipped": True}

    prompt = build_prompt(ticker, ctx, existing, needed)
    resp = cerebras_call(prompt, primary_key_idx, throttle_state)
    try:
        new_stories = parse_json_array(resp)
    except Exception as e:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "target": target, "error": f"parse:{e}"[:200]}

    new_stories = [normalize_story(s) for s in new_stories if isinstance(s, dict) and s.get("short")]
    existing_keys = {(s.get("short") or "").strip().lower() for s in existing}
    new_stories = [s for s in new_stories if s.get("short", "").strip().lower() not in existing_keys]

    enrich_path = ENRICH / f"{ticker.lower()}.json"
    if enrich_path.exists():
        enrich_data = json.load(open(enrich_path))
    else:
        enrich_data = {"ticker": ticker.upper()}

    enrich_existing = enrich_data.get("stories_kpis") or []
    merged = enrich_existing + new_stories
    enrich_data["stories_kpis"] = merged
    enrich_data["_stories_backfill_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    enrich_data["_stories_backfill_source"] = "cerebras_qwen3_235b_scaleup_532"

    tmp = enrich_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(enrich_data, ensure_ascii=False, indent=2))
    tmp.replace(enrich_path)

    return {
        "ticker": ticker,
        "before": before,
        "added": len(new_stories),
        "after": before + len(new_stories),
        "target": target,
        "new_shorts": [s.get("short") for s in new_stories],
    }


def load_targets(shard: int, total_shards: int) -> list:
    pub = json.load(open(PUBLISHABLE))["tickers"]
    remaining = [t for t in pub if t.lower() not in PILOT_TICKERS]
    # Shard by index modulo
    targets = [t for i, t in enumerate(remaining) if i % total_shards == shard]
    return targets


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shard", type=int, required=True, help="Shard index 0..total-1")
    parser.add_argument("--total-shards", type=int, default=3)
    parser.add_argument("--key-idx", type=int, required=True, help="Primary Cerebras key index 0..2")
    parser.add_argument("--throttle", type=float, default=4.0, help="Sleep seconds between calls")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for testing")
    args = parser.parse_args()

    if args.key_idx >= len(ALL_KEYS):
        print(f"ERROR: key-idx {args.key_idx} but only {len(ALL_KEYS)} keys available", file=sys.stderr)
        sys.exit(1)

    targets = load_targets(args.shard, args.total_shards)
    if args.limit:
        targets = targets[: args.limit]
    print(f"Shard {args.shard}/{args.total_shards} primary key#{args.key_idx} | {len(targets)} tickers", flush=True)

    results = []
    throttle_state = {}
    out_file = RESULTS_DIR / f"results-shard{args.shard}.json"

    all_429_count = 0
    for i, t in enumerate(targets):
        print(f"[shard{args.shard} {i+1}/{len(targets)}] {t} ...", flush=True)
        try:
            r = process_ticker(t, args.key_idx, throttle_state)
            if r.get("skipped"):
                print(f"  SKIP ({r.get('reason','target_met')})", flush=True)
            elif r.get("error"):
                print(f"  ERR {r['error'][:120]}", flush=True)
            else:
                print(f"  before={r['before']} added={r['added']} after={r['after']} target={r['target']}", flush=True)
            results.append(r)
            all_429_count = 0
        except RuntimeError as e:
            err = str(e)
            print(f"  ERROR {err[:200]}", flush=True)
            results.append({"ticker": t, "error": err[:300]})
            if "ALL_429" in err:
                all_429_count += 1
                if all_429_count >= 3:
                    print(f"  ALL 3 KEYS 429 x3, saving progress and BREAKING", flush=True)
                    break
                print(f"  sleep 60s after ALL_429", flush=True)
                time.sleep(60)
        except Exception as e:
            print(f"  FATAL {e}", flush=True)
            results.append({"ticker": t, "error": f"fatal:{e}"[:300]})

        # Save progress every 10 tickers
        if (i + 1) % 10 == 0:
            out_file.write_text(json.dumps(results, ensure_ascii=False, indent=2))

        if i < len(targets) - 1:
            time.sleep(args.throttle)

    out_file.write_text(json.dumps({
        "shard": args.shard,
        "key_idx": args.key_idx,
        "total": len(targets),
        "processed": len(results),
        "throttle_state": throttle_state,
        "results": results,
    }, ensure_ascii=False, indent=2))
    total_added = sum(r.get("added", 0) for r in results)
    n_enriched = sum(1 for r in results if r.get("added", 0) > 0)
    print(f"\nShard {args.shard} DONE — enriched: {n_enriched}/{len(targets)} | added: {total_added}", flush=True)


if __name__ == "__main__":
    main()
