#!/usr/bin/env python3
"""
Stories backfill RESIDUEL — sub-agent #121.

Clone de scaleup_309_dstories_ko.py mais avec input list dynamique.
Cible : ~143 stés d_stories KO résiduelles (hors scaleup_309 set),
identifiées par sub-agent #121 (audit post-#113 vs #118 coverage).

Input list : /tmp/residual-dstories-targets.json (généré par #121).
Output    : src/data/stories-backfill-residuel/results.json
Enrich    : src/data/v2-pipeline-enrich/<lowercase>.json (champ stories_kpis array)

Mode : Cerebras paid (3 keys rotation, cooldown 429 = 8s, throttle 0.5s).
Model : qwen-3-235b-a22b-instruct-2507, max_tokens 4000.

Usage:
  python3 scripts/stories-backfill/scaleup_residuel_dstories.py --paid-mode --throttle 0.5
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
TARGETS_FILE = Path("/tmp/residual-dstories-targets.json")
RESULTS_DIR = ROOT / "src/data/stories-backfill-residuel"
RESULTS_DIR.mkdir(exist_ok=True)
LOG_DIR = ROOT / "logs/stories-residuel"
LOG_DIR.mkdir(parents=True, exist_ok=True)

TARGET_LARGE = 8
TARGET_MID = 5


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
ACTIVE_KEYS = [
    ENV.get("CEREBRAS_API_KEY"),
    ENV.get("CEREBRAS2_API_KEY"),
    ENV.get("CEREBRAS3_API_KEY"),
]
ACTIVE_KEYS = [k for k in ACTIVE_KEYS if k]
GROQ_KEY = ENV.get("GROQ_API_KEY")


def cerebras_call(prompt, primary_idx, state):
    body = json.dumps({
        "model": "qwen-3-235b-a22b-instruct-2507",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4000,
        "temperature": 0.3,
    }).encode("utf-8")

    order = [primary_idx] + [i for i in range(len(ACTIVE_KEYS)) if i != primary_idx]
    last_err = None
    for kidx in order:
        cool = state.get(f"cool_{kidx}", 0)
        if time.time() < cool:
            continue
        req = urllib.request.Request(
            "https://api.cerebras.ai/v1/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {ACTIVE_KEYS[kidx]}",
                "Content-Type": "application/json",
                "User-Agent": "curl/8",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                choices = payload.get("choices") if isinstance(payload, dict) else None
                if not isinstance(choices, list) or not choices:
                    last_err = f"key#{kidx} no choices"
                    continue
                msg = choices[0].get("message") if isinstance(choices[0], dict) else None
                content = msg.get("content") if isinstance(msg, dict) else None
                if content:
                    return content, f"cerebras_key{kidx}"
                last_err = f"key#{kidx} no content"
                continue
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore")[:200]
            last_err = f"HTTP {e.code} key#{kidx}: {body_text}"
            if e.code == 429:
                cooldown_s = state.get("_cooldown_429_s", 60)
                state[f"cool_{kidx}"] = time.time() + cooldown_s
                continue
            if e.code == 402:
                state[f"cool_{kidx}"] = time.time() + 3600
                continue
            time.sleep(2)
            continue
        except Exception as e:
            last_err = f"key#{kidx}: {e}"
            time.sleep(2)
            continue

    raise RuntimeError(f"all_failed: {last_err}")


def parse_json_array(text):
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
        raise ValueError(f"no JSON array: {text[:150]}")
    return json.loads(text[i:j + 1])


def normalize_story(s):
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


def load_context(ticker):
    pipe_f = PIPELINE / f"{ticker.lower()}.json"
    if not pipe_f.exists():
        return None
    pipe = json.load(open(pipe_f))
    enr_f = ENRICH / f"{ticker.lower()}.json"
    enrich = json.load(open(enr_f)) if enr_f.exists() else {}
    return {"pipeline": pipe, "enrich": enrich}


def existing_stories(pipe, enrich):
    pipe_s = pipe.get("stories_kpis") or []
    enr_s = enrich.get("stories_kpis") or []
    kpis = pipe.get("kpis") or []
    short_kpis = [k for k in kpis if k.get("is_short_history")]
    mp = pipe.get("market_positions") or []
    seen = set()
    out = []
    for s in pipe_s + enr_s + short_kpis:
        key = (s.get("short") or s.get("name_fr") or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(s)
    return out, len(mp)


def build_prompt(ticker, ctx, existing, n_needed):
    pipe = ctx["pipeline"]
    enrich = ctx["enrich"]
    name = pipe.get("name", ticker.upper())
    sector = pipe.get("sector", "")
    subsector = pipe.get("subsector", "")
    tagline = pipe.get("tagline", "")
    ai_pos = enrich.get("ai_positioning") or {}
    ai_evidence = ai_pos.get("evidence", [])[:5] if isinstance(ai_pos, dict) else []
    descr = enrich.get("company_description") or pipe.get("description") or ""
    if isinstance(descr, dict):
        descr = descr.get("long") or descr.get("short") or ""
    descr = str(descr)[:1200]
    existing_shorts = [s.get("short") for s in existing if s.get("short")][:20]
    kpi_shorts = [k.get("short") for k in pipe.get("kpis", []) if k.get("short")][:20]

    return f"""You are extracting HIGH-PV "story" KPIs for retail investors on {name} ({ticker.upper()}).

Sector: {sector} / {subsector}
Tagline: {tagline}
Company description: {descr}
AI positioning evidence: {json.dumps(ai_evidence, ensure_ascii=False)[:600]}

Existing story KPIs ({len(existing)}): {json.dumps(existing_shorts, ensure_ascii=False)}
Existing regular KPIs (do NOT duplicate): {json.dumps(kpi_shorts, ensure_ascii=False)}

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
- history: array of 3-5 recent numeric values (most recent last)
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


def process_ticker(target_info, primary_idx, state):
    ticker = target_info["ticker"]
    target = target_info.get("required") or TARGET_MID
    count_now = target_info.get("count") or 0
    needed = max(0, target - count_now)

    ctx = load_context(ticker)
    if ctx is None:
        return {"ticker": ticker, "skipped": True, "reason": "no_pipeline_file"}

    existing, _mp = existing_stories(ctx["pipeline"], ctx["enrich"])
    before = count_now
    if needed == 0:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "target": target, "skipped": True}

    prompt = build_prompt(ticker, ctx, existing, needed)
    try:
        resp, source = cerebras_call(prompt, primary_idx, state)
    except Exception as e:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "target": target, "error": str(e)[:200]}

    try:
        new_stories = parse_json_array(resp)
    except Exception as e:
        return {"ticker": ticker, "before": before, "added": 0, "after": before, "target": target, "error": f"parse:{e}"[:200], "source": source}

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
    enrich_data["_stories_backfill_source"] = f"scaleup_residuel_{source}"

    tmp = enrich_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(enrich_data, ensure_ascii=False, indent=2))
    tmp.replace(enrich_path)

    return {
        "ticker": ticker,
        "before": before,
        "added": len(new_stories),
        "after": before + len(new_stories),
        "target": target,
        "source": source,
        "new_shorts": [s.get("short") for s in new_stories],
    }


def load_targets(limit=0):
    data = json.load(open(TARGETS_FILE))
    # Already sorted by MC desc from #121
    data.sort(key=lambda x: (x.get("mc_b") or 0), reverse=True)
    if limit:
        data = data[:limit]
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-idx", type=int, default=0)
    parser.add_argument("--throttle", type=float, default=0.5)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--paid-mode", action="store_true")
    args = parser.parse_args()

    if args.key_idx >= len(ACTIVE_KEYS):
        print(f"ERROR: key-idx {args.key_idx} but only {len(ACTIVE_KEYS)} active keys", file=sys.stderr)
        sys.exit(1)

    targets = load_targets(limit=args.limit)
    mode = "PAID" if args.paid_mode else "FREE"
    print(f"[{mode} RESIDUEL] key#{args.key_idx} | {len(targets)} tickers | {len(ACTIVE_KEYS)} keys", flush=True)

    results = []
    state = {}
    if args.paid_mode:
        state["_cooldown_429_s"] = 8
    out_file = RESULTS_DIR / "results.json"

    for i, target_info in enumerate(targets):
        t = target_info["ticker"]
        mc = target_info.get("mc_b")
        mc_str = f"{mc:.1f}B" if mc else "?"
        print(f"[{i+1}/{len(targets)}] {t} (MC={mc_str}) ...", flush=True)
        try:
            r = process_ticker(target_info, args.key_idx, state)
            if r.get("skipped"):
                print(f"  SKIP ({r.get('reason','target_met')})", flush=True)
            elif r.get("error"):
                print(f"  ERR {r['error'][:120]}", flush=True)
            else:
                print(f"  before={r['before']} added={r['added']} after={r['after']} target={r['target']} src={r.get('source')}", flush=True)
            results.append(r)
        except RuntimeError as e:
            err = str(e)
            print(f"  ERROR {err[:150]}", flush=True)
            results.append({"ticker": t, "error": err[:300]})
        except Exception as e:
            print(f"  FATAL {e}", flush=True)
            results.append({"ticker": t, "error": f"fatal:{e}"[:300]})

        if (i + 1) % 10 == 0:
            out_file.write_text(json.dumps({
                "key_idx": args.key_idx,
                "total": len(targets),
                "processed": len(results),
                "state": {k: v for k, v in state.items() if not k.startswith("cool_")},
                "results": results,
            }, ensure_ascii=False, indent=2))

        if i < len(targets) - 1:
            time.sleep(args.throttle)

    out_file.write_text(json.dumps({
        "key_idx": args.key_idx,
        "total": len(targets),
        "processed": len(results),
        "state": {k: v for k, v in state.items() if not k.startswith("cool_")},
        "results": results,
    }, ensure_ascii=False, indent=2))
    total_added = sum(r.get("added", 0) for r in results)
    n_enriched = sum(1 for r in results if r.get("added", 0) > 0)
    print(f"\nRESIDUEL DONE — enriched: {n_enriched}/{len(targets)} | added: {total_added}", flush=True)


if __name__ == "__main__":
    main()
