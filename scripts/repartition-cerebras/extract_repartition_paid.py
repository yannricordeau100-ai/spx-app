#!/usr/bin/env python3
"""
f_repartition Cerebras paid extraction — sub-agent #122.

Mission: extract revenue_by_segment + revenue_by_geography for ~99 US tickers
(top 307 + SP500) flagged f_repartition KO by audit, using Cerebras paid tier
qwen-3-235b. Builds on #117 (regex failed) and #121 (proven Cerebras pattern).

Input  : /tmp/repartition-cerebras-targets.json (list of {ticker, mc, filing})
Output : src/data/v2-pipeline-enrich/<lowercase>.json (revenue_by_segment +
         revenue_by_geography blocks)
Log    : logs/repartition-cerebras/extract_<keyidx>.log
Results: src/data/repartition-cerebras/results.json

Keys: rotation 3 Cerebras paid keys, cooldown 429 = 8s, throttle 0.5s.
Coordination: #121 also using these keys → throttle is shared (no parallel run).

Honesty rule (HARD): JSON parse OK + share_pct sum 90-110% + ≥2 slices for
segment OR ≥2 slices for geography. Otherwise skip with reason.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
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

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

ROOT = Path("/Users/yann/spx-app")
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
TARGETS_FILE = Path("/tmp/repartition-cerebras-targets.json")
RESULTS_DIR = ROOT / "src/data/repartition-cerebras"
RESULTS_DIR.mkdir(exist_ok=True)
LOG_DIR = ROOT / "logs/repartition-cerebras"
LOG_DIR.mkdir(parents=True, exist_ok=True)


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

MODEL = "qwen-3-235b-a22b-instruct-2507"


def html_to_text(html: str) -> str:
    if BeautifulSoup is not None:
        try:
            return BeautifulSoup(html, "html.parser").get_text(separator="\n", strip=True)
        except Exception:
            pass
    s = re.sub(r"<[^>]+>", "\n", html)
    s = re.sub(r"&nbsp;|&#160;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    return re.sub(r"\n\s*\n+", "\n", s)


def read_filing(path: str) -> str:
    p = Path(path)
    try:
        if p.suffix == ".gz":
            with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as f:
                raw = f.read()
        else:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                raw = f.read()
    except Exception as e:
        print(f"  read err {p}: {e}", file=sys.stderr)
        return ""
    if p.suffix in (".htm", ".html", ".gz") or "<html" in raw[:5000].lower():
        return html_to_text(raw)
    return raw


# Section anchors — pull text windows around each
# Multi-language (EN/FR/DE/IT/ES/PT/NL/SV/DA/NO) for EU annual reports.
SEGMENT_KEYWORDS = [
    # EN
    r"Segment\s+(?:information|reporting|results|revenues?)",
    r"Reportable\s+segments?",
    r"Operating\s+segments?",
    r"Disaggregation\s+of\s+revenue",
    r"Revenues?\s+by\s+segment",
    r"Net\s+(?:sales|revenues?)\s+by\s+segment",
    r"Business\s+(?:segments?|divisions?|areas?|units?)",
    r"Sales\s+by\s+(?:business|division|product|category)",
    r"Net\s+sales\s+by\s+product",
    # FR
    r"Chiffre\s+d['e]?affaires\s+par\s+(?:segment|secteur|activit|division|m[ée]tier|branche|p[ôo]le)",
    r"R[ée]partition\s+(?:du\s+)?CA\s+par\s+(?:segment|secteur|activit|division|m[ée]tier)",
    r"Information\s+(?:sectorielle|par\s+segment)",
    # DE
    r"Umsatzerl[öo]se\s+nach\s+(?:Segment|Gesch[äa]ftsbereich|Produkt|Division)",
    r"Segmentbericht(?:erstattung)?",
    r"Gesch[äa]ftssegmente",
    # IT
    r"Ricavi\s+per\s+(?:settore|segmento|divisione|area\s+di\s+business)",
    r"Informativa\s+(?:di\s+settore|per\s+segmento)",
    # ES
    r"Ingresos\s+por\s+(?:segmento|divisi[óo]n|negocio)",
    # NL
    r"Omzet\s+per\s+(?:segment|divisie|activiteit)",
    r"Segmentrapportage",
    # SV/DA/NO
    r"Net\s?omsetning\s+per",
    r"Inntekter\s+per\s+segment",
    r"Forretningsomr[åa]de",
]

GEO_KEYWORDS = [
    # EN
    r"Revenues?\s+by\s+geograph",
    r"Net\s+(?:sales|revenues?)\s+by\s+geograph",
    r"Sales\s+by\s+geograph",
    r"Geographic\s+(?:area|region|market|information|breakdown|split)",
    r"Revenues?\s+(?:by|from)\s+countr",
    r"Revenues?\s+by\s+(?:region|market)",
    r"Net\s+sales\s+by\s+region",
    # FR
    r"Chiffre\s+d['e]?affaires\s+par\s+(?:zone\s+g[ée]ographique|r[ée]gion|pays|march[ée]\s+g[ée]ographique)",
    r"R[ée]partition\s+g[ée]ographique",
    r"Ventes\s+par\s+zone\s+g[ée]ographique",
    # DE
    r"Umsatzerl[öo]se\s+nach\s+(?:Region|L[äa]ndern|geografisch)",
    r"Geografische\s+Aufgliederung",
    # IT
    r"Ricavi\s+per\s+(?:area\s+geografica|paese|regione)",
    # ES
    r"Ingresos\s+por\s+(?:zona\s+geogr[áa]fica|pa[íi]s|regi[óo]n)",
    # NL
    r"Omzet\s+per\s+(?:regio|geografisch)",
    # SV/NO
    r"Net\s?omsetning\s+per\s+(?:region|geografi)",
    r"Inntekter\s+per\s+(?:region|geografi)",
]


def extract_excerpts(text: str, max_chars: int = 24000) -> str:
    """Find segment + geography sections, return concatenated excerpt."""
    excerpts: list[str] = []
    seen_starts: set[int] = set()

    for kw_list, label in [(SEGMENT_KEYWORDS, "SEGMENT"), (GEO_KEYWORDS, "GEOGRAPHY")]:
        for kw in kw_list:
            for m in re.finditer(kw, text, flags=re.IGNORECASE):
                start = max(0, m.start() - 200)
                # dedupe by rough region
                bucket = start // 2000
                if bucket in seen_starts:
                    continue
                seen_starts.add(bucket)
                end = min(len(text), m.start() + 4000)
                excerpts.append(f"\n=== {label}: {kw} ===\n" + text[start:end])
                if sum(len(e) for e in excerpts) > max_chars:
                    break
            if sum(len(e) for e in excerpts) > max_chars:
                break

    # If found nothing, include Item 1 + Item 7 first-pass (US 10-K).
    if not excerpts:
        m1 = re.search(r"\bItem\s*1[\.\s]*Business\b", text, flags=re.IGNORECASE)
        m7 = re.search(r"\bItem\s*7[\.\s]*Management", text, flags=re.IGNORECASE)
        if m1:
            excerpts.append("=== ITEM 1 ===\n" + text[m1.start():m1.start() + 12000])
        if m7:
            excerpts.append("\n=== ITEM 7 ===\n" + text[m7.start():m7.start() + 8000])

    # EU annual reports / capital markets decks / half-year reports often have
    # the segment+geography tables in early pages without identifiable English
    # section headers. Fallback : feed the first 22KB of text directly to the
    # LLM. This works well for short investor presentations (<40KB).
    if not excerpts and len(text) > 1000:
        excerpts.append("=== DOC START (no anchor matched) ===\n" + text[:max_chars])

    combined = "\n".join(excerpts)
    if len(combined) > max_chars:
        combined = combined[:max_chars]
    return combined


def cerebras_call(prompt: str, primary_idx: int, state: dict) -> tuple[str, str]:
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 3000,
        "temperature": 0.1,
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
                    last_err = f"empty choices key={kidx}"
                    continue
                content = choices[0].get("message", {}).get("content", "")
                if not content:
                    last_err = f"empty content key={kidx}"
                    continue
                return content, f"cerebras_paid_k{kidx}"
        except urllib.error.HTTPError as e:
            code = e.code
            body_b = b""
            try:
                body_b = e.read()
            except Exception:
                pass
            last_err = f"http{code} key={kidx} {body_b[:200]!r}"
            if code == 429:
                cool_s = state.get("_cooldown_429_s", 8)
                state[f"cool_{kidx}"] = time.time() + cool_s
            elif code in (500, 502, 503):
                state[f"cool_{kidx}"] = time.time() + 4
            else:
                # 401/403 = key bad → cool long
                state[f"cool_{kidx}"] = time.time() + 60
        except Exception as e:
            last_err = f"exc key={kidx} {e}"
            state[f"cool_{kidx}"] = time.time() + 4
    raise RuntimeError(f"all_keys_failed: {last_err}")


def parse_json_strict(raw: str) -> dict | None:
    """Extract first top-level JSON object from response."""
    if not raw:
        return None
    # Strip code fences
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*\n", "", s)
        s = re.sub(r"\n```\s*$", "", s)
    # Find first { and last } at depth 0
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    end = -1
    in_str = False
    esc = False
    for i in range(start, len(s)):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        return None
    try:
        return json.loads(s[start:end])
    except Exception:
        return None


def validate_block(block: dict | None, kind: str) -> tuple[bool, str]:
    """Validate one block (segment or geography). Returns (ok, reason).

    kind = 'segment' or 'geography'. Accepts mono flags as legitimate.
    """
    if not block or not isinstance(block, dict):
        return False, "no_block"
    # Mono-segment / mono-region legitimate flags
    if kind == "segment" and block.get("single_segment") is True:
        return True, "mono_segment_legit"
    if kind == "geography" and block.get("single_region_legitimate") is True:
        return True, "mono_region_legit"
    slices = block.get("slices")
    if not isinstance(slices, list):
        return False, "no_slices_list"
    valid_slices = [s for s in slices if isinstance(s, dict) and s.get("label") and s.get("share_pct") is not None]
    if len(valid_slices) < 2:
        return False, f"only_{len(valid_slices)}_valid_slices"
    try:
        total = sum(float(s.get("share_pct") or 0) for s in valid_slices)
    except Exception:
        return False, "share_pct_not_numeric"
    if total < 85 or total > 115:
        return False, f"share_pct_sum_{total:.1f}_out_of_range"
    # All labels non-empty
    for s in valid_slices:
        if not isinstance(s.get("label"), str) or len(s["label"]) < 1:
            return False, "empty_label"
    return True, "ok"


def normalize_slice(s: dict) -> dict:
    """Ensure required fields, defaults."""
    out = {
        "label": str(s.get("label", "")).strip(),
        "share_pct": float(s.get("share_pct") or 0),
    }
    if s.get("label_fr"):
        out["label_fr"] = str(s["label_fr"]).strip()
    if s.get("label_en"):
        out["label_en"] = str(s["label_en"]).strip()
    if s.get("value") is not None:
        try:
            out["value"] = float(s["value"])
        except Exception:
            pass
    if s.get("unit"):
        out["unit"] = str(s["unit"])
    return out


def build_prompt(ticker: str, name: str, excerpt: str) -> str:
    return f"""Extract revenue breakdown for {name} ({ticker}) from this 10-K excerpt.

Return STRICT JSON only (no markdown, no prose), in this exact format:
{{
  "revenue_by_segment": {{
    "slices": [
      {{"label": "Segment A", "label_fr": "Segment A en FR", "label_en": "Segment A", "value": 12.3, "share_pct": 45.5, "unit": "Mds $"}}
    ],
    "year": 2024,
    "currency": "USD",
    "total": 27.0,
    "single_segment": false
  }},
  "revenue_by_geography": {{
    "slices": [
      {{"label": "United States", "label_fr": "États-Unis", "label_en": "United States", "value": 20.0, "share_pct": 74.0, "unit": "Mds $"}}
    ],
    "year": 2024,
    "currency": "USD",
    "total": 27.0,
    "single_region_legitimate": false
  }}
}}

Source text:
{excerpt}

Rules:
- value in same unit as source (Mds $ for billions, M $ for millions). If unit unclear use "M $".
- share_pct = % of total revenue, sum across slices must be 95-105.
- Need ≥2 segment slices AND ≥2 geography slices when disclosed.
- Mono-segment legitimate: if filing explicitly states "single reportable segment" or "one operating segment", set "revenue_by_segment": {{"single_segment": true, "_reason": "<exact phrase from filing>"}} (no slices needed).
- Mono-region legitimate: if filing shows US-only or domestic-only operations (utilities, REITs, regional banks, US-focused retailers), set "revenue_by_geography": {{"single_region_legitimate": true, "_reason": "<short justification>"}}.
- Use EXACT labels from filing (don't invent categories or aggregate differently than the filing).
- label_fr: French translation (no em-dash, vocabulaire FR strict).
- year: fiscal year of the data (most recent FY in the excerpt).
- If data not present in excerpt and not legitimately mono: return null for that block, never invent.
- Output ONLY the JSON object, no surrounding text."""


def load_company_name(ticker: str) -> str:
    pipe_f = PIPELINE / f"{ticker.lower()}.json"
    if not pipe_f.exists():
        return ticker
    try:
        pipe = json.load(open(pipe_f))
        return pipe.get("name", ticker)
    except Exception:
        return ticker


def write_enrich(ticker: str, segment: dict | None, geography: dict | None, source: str) -> None:
    enrich_path = ENRICH / f"{ticker.lower()}.json"
    if enrich_path.exists():
        data = json.load(open(enrich_path))
    else:
        data = {"ticker": ticker.upper()}

    if segment:
        if segment.get("single_segment") is True:
            clean = {"single_segment": True}
            if segment.get("_reason"):
                clean["_reason"] = segment["_reason"]
        else:
            slices = [normalize_slice(s) for s in segment.get("slices", []) if isinstance(s, dict)]
            clean = {"slices": slices}
            for k in ("year", "currency", "total"):
                if segment.get(k) is not None:
                    clean[k] = segment[k]
        data["revenue_by_segment"] = clean
    if geography:
        if geography.get("single_region_legitimate") is True:
            clean = {"single_region_legitimate": True}
            if geography.get("_reason"):
                clean["_reason"] = geography["_reason"]
        else:
            slices = [normalize_slice(s) for s in geography.get("slices", []) if isinstance(s, dict)]
            clean = {"slices": slices}
            for k in ("year", "currency", "total"):
                if geography.get(k) is not None:
                    clean[k] = geography[k]
        data["revenue_by_geography"] = clean

    data["_repartition_backfill_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    data["_repartition_backfill_source"] = source

    tmp = enrich_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(enrich_path)


def process_ticker(target: dict, primary_idx: int, state: dict) -> dict:
    ticker = target["ticker"]
    filing = target["filing"]
    text = read_filing(filing)
    if not text or len(text) < 5000:
        return {"ticker": ticker, "ok": False, "reason": "filing_unreadable", "filing": filing}

    excerpt = extract_excerpts(text, max_chars=22000)
    if len(excerpt) < 500:
        return {"ticker": ticker, "ok": False, "reason": "no_segment_or_geo_section_found"}

    name = load_company_name(ticker)
    prompt = build_prompt(ticker, name, excerpt)

    try:
        resp, source = cerebras_call(prompt, primary_idx, state)
    except Exception as e:
        return {"ticker": ticker, "ok": False, "reason": f"api_fail:{str(e)[:160]}"}

    parsed = parse_json_strict(resp)
    if not parsed:
        return {"ticker": ticker, "ok": False, "reason": "json_parse_fail", "raw_preview": resp[:200]}

    seg = parsed.get("revenue_by_segment")
    geo = parsed.get("revenue_by_geography")

    seg_ok, seg_reason = validate_block(seg, "segment") if seg else (False, "null")
    geo_ok, geo_reason = validate_block(geo, "geography") if geo else (False, "null")

    # Audit requires BOTH segment and geography to pass (or each is legitimately mono).
    # Accept and write if at least one is valid; partial writes are still useful because
    # the missing side may already be marked legitimate in legacy enrich.
    if not seg_ok and not geo_ok:
        return {
            "ticker": ticker,
            "ok": False,
            "reason": f"both_invalid seg={seg_reason} geo={geo_reason}",
        }

    write_enrich(
        ticker,
        seg if seg_ok else None,
        geo if geo_ok else None,
        source,
    )
    seg_slices = 0
    geo_slices = 0
    if seg_ok and isinstance(seg, dict):
        seg_slices = len(seg.get("slices") or [])
    if geo_ok and isinstance(geo, dict):
        geo_slices = len(geo.get("slices") or [])
    return {
        "ticker": ticker,
        "ok": True,
        "segment_ok": seg_ok,
        "segment_reason": seg_reason,
        "segment_slices": seg_slices,
        "geography_ok": geo_ok,
        "geography_reason": geo_reason,
        "geography_slices": geo_slices,
        "source": source,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-idx", type=int, default=0)
    parser.add_argument("--throttle", type=float, default=0.6)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--only", type=str, default="", help="comma-list tickers to restrict to")
    parser.add_argument("--targets-file", type=str, default="", help="override TARGETS_FILE path")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.key_idx >= len(ACTIVE_KEYS):
        print(f"ERROR: key-idx {args.key_idx} but only {len(ACTIVE_KEYS)} active keys", file=sys.stderr)
        sys.exit(1)

    targets_path = Path(args.targets_file) if args.targets_file else TARGETS_FILE
    targets = json.load(open(targets_path))
    if args.only:
        only = {t.strip().upper() for t in args.only.split(",") if t.strip()}
        targets = [t for t in targets if t["ticker"].upper() in only]
    if args.offset:
        targets = targets[args.offset:]
    if args.limit:
        targets = targets[:args.limit]

    print(f"[REPARTITION CEREBRAS PAID] key#{args.key_idx} | {len(targets)} tickers | {len(ACTIVE_KEYS)} keys", flush=True)
    if args.dry_run:
        for t in targets[:5]:
            print(f"  DRY {t['ticker']} mc={t['mc']:.0f} filing={t['filing']}")
        return

    state = {"_cooldown_429_s": 8}
    results = []
    out_file = RESULTS_DIR / f"results_k{args.key_idx}.json"

    t_start = time.time()
    for i, target in enumerate(targets):
        ticker = target["ticker"]
        print(f"[{i+1}/{len(targets)}] {ticker} ...", flush=True)
        try:
            r = process_ticker(target, args.key_idx, state)
        except Exception as e:
            r = {"ticker": ticker, "ok": False, "reason": f"top_exc:{str(e)[:160]}"}
        if r.get("ok"):
            print(f"  OK seg_slices={r.get('segment_slices')} geo_slices={r.get('geography_slices')} src={r.get('source')}", flush=True)
        else:
            print(f"  SKIP {r.get('reason','?')[:120]}", flush=True)
        results.append(r)

        # incremental save
        with open(out_file, "w") as f:
            json.dump({
                "key_idx": args.key_idx,
                "total": len(targets),
                "processed": i + 1,
                "elapsed_s": round(time.time() - t_start, 1),
                "results": results,
            }, f, indent=2)

        time.sleep(args.throttle)

    elapsed = time.time() - t_start
    ok_count = sum(1 for r in results if r.get("ok"))
    print(f"\nDONE key#{args.key_idx}: {ok_count}/{len(results)} OK in {elapsed:.0f}s", flush=True)


if __name__ == "__main__":
    main()
