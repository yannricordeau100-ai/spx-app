#!/usr/bin/env python3
"""backfill-v19-seg-geo-cerebras.py — V1.9 quick wins (single criterion).

Backfill revenue_by_segment OR revenue_by_geography for ~221 "quick-win"
stés that miss exactly ONE criterion (= segments_2plus OR geography_2plus
on the new 6/6 strict audit).

Workflow per ticker:
  1. Read v1-9-complete/<T>.json (primary) OR v2-pipeline/<t>.json (fallback).
  2. Source:
     - country == "US" → newest sec-data/cat1-us/10K/<year>/<T>_*.htm.gz
     - country != "US" → newest sec-data/cat3-european/<T>/annual-text/<year>.txt
  3. Extract Item 7 MDA + Segment + Geographic sections, send to Cerebras Qwen.
  4. Write back the MISSING bloc only (don't overwrite if already OK).
  5. Mirror to v2-pipeline/<t>.json so SSR pages pick it up.

3 procs parallèles via KEY_INDEX=0|1|2 (one per Cerebras key).
Sleep 4s between calls. RAM monitor every 30s (throttle if free<50MB).
"""
import gzip
import json
import os
import re
import ssl
import subprocess
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
COMPLETE_DIR = PROJECT_ROOT / "src/data/v1-9-complete"
V2_DIR = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT1 = PROJECT_ROOT / "sec-data/cat1-us/10K"
SEC_CAT3 = PROJECT_ROOT / "sec-data/cat3-european"

PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/v19-quick-wins.json"))
RESULT_FILE = PROJECT_ROOT / f"src/data/v1-9-backfill-seg-geo-results-key{os.environ.get('KEY_INDEX','0')}.json"
LOG = PROJECT_ROOT / f".conv-state/CONV-CONCEPTS-backfill-seg-geo-key{os.environ.get('KEY_INDEX','0')}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BASE = 4.0
CTX_LEN = 22000
RAM_CHECK_EVERY = 30.0  # seconds
RAM_THROTTLE_MULT = 3.0

PROMPT_SEG = """Tu extrais le bloc revenue_by_segment depuis le rapport annuel d'une société.

Société : {name} ({ticker})

Format JSON STRICT (rien d'autre) :

{{
  "revenue_by_segment": {{
    "label": "Répartition du chiffre d'affaires par segment opérationnel",
    "slices": [
      {{"name": "Nom du segment", "value": 12.5, "unit": "Mds $", "pct": 35.0}}
    ]
  }}
}}

RÈGLES STRICTES :
1. Retourne au moins 2 slices (sinon "slices": []).
2. value EN MDS de la devise du rapport (USD/EUR/GBP… mets dans `unit`).
3. pct = part en % du total (calculer si pas explicite).
4. JAMAIS inventer. Si pas chiffré explicitement → "slices": [].
5. Privilégie les segments reportables (Reportable / Operating segments).
6. Si la sté est mono-segment légitime → "slices": [] (l'utilisateur ne pourra pas backfill).

Extrait du rapport annuel :
---
{ctx}
---"""

PROMPT_GEO = """Tu extrais le bloc revenue_by_geography depuis le rapport annuel d'une société.

Société : {name} ({ticker})

Format JSON STRICT (rien d'autre) :

{{
  "revenue_by_geography": {{
    "label": "Répartition du chiffre d'affaires par zone géographique",
    "slices": [
      {{"name": "Amérique du Nord", "value": 8.4, "unit": "Mds $", "pct": 47.0}}
    ]
  }}
}}

RÈGLES STRICTES :
1. Retourne au moins 2 slices (sinon "slices": []).
2. value EN MDS devise (USD/EUR/GBP…) dans `unit`.
3. pct = part en % du total.
4. JAMAIS inventer.
5. Utilise les zones officielles du filing (ex: "United States", "International",
   "Europe", "Asia Pacific", "Greater China"…).
6. Si une seule zone (100% domestique légitime) → "slices": []
   (l'utilisateur ne pourra pas backfill avec 1 seule zone).

Extrait du rapport annuel :
---
{ctx}
---"""

HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&[a-zA-Z]+;")
HTML_ENT_D = re.compile(r"&#\d+;")
WS = re.compile(r"\s+")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}][k{os.environ.get('KEY_INDEX','0')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def strip_html(html: str) -> str:
    text = HTML_TAG.sub(" ", html)
    text = HTML_ENT_N.sub(" ", text)
    text = HTML_ENT_D.sub(" ", text)
    return WS.sub(" ", text).strip()


def find_section_us(text: str, want: str = "both") -> str:
    """Prioritize the section we actually need (seg|geo|both)."""
    def all_pos(pat):
        return [m.start() for m in re.finditer(pat, text, re.I)]

    chunks = []
    if want in ("geo", "both"):
        for p in all_pos(r"(?:revenues?\s+by\s+geograph|geographic\s+(?:information|areas?|revenues?)|disaggregation\s+of\s+revenue)")[-2:]:
            chunks.append(("GEO", p, 6000))
    if want in ("seg", "both"):
        for p in all_pos(r"(?:operating\s+segments?|reportable\s+segments?|segment\s+information|business\s+segment|revenues?\s+by\s+segment)")[-2:]:
            chunks.append(("SEG", p, 6000))
    # MDA fallback (sometimes seg/geo lives inside Item 7 only)
    if not chunks:
        for p in all_pos(r"item\s+7\.?\s+management.{0,30}discussion")[-1:]:
            chunks.append(("MDA", p, 14000))
    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]

    chunks.sort(key=lambda x: x[1])
    parts = []
    for kind, start, budget in chunks:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def find_section_eu(text: str, want: str = "both") -> str:
    """EU annual-text (multilingual). Prioritize asked section."""
    def all_pos(pat):
        return [m.start() for m in re.finditer(pat, text, re.I)]

    chunks = []
    if want in ("geo", "both"):
        for p in all_pos(r"(?:geographic\s+(?:information|areas?|revenues?|breakdown)|revenues?\s+by\s+(?:region|geograph)|r[eé]partition\s+g[eé]ographique|chiffre\s+d.affaires?\s+par\s+(?:zone|r[eé]gion)|umsatz\s+nach\s+regionen|regioni\s+geografiche)")[-2:]:
            chunks.append(("GEO", p, 6000))
    if want in ("seg", "both"):
        for p in all_pos(r"(?:segment\s+(?:information|reporting|results?)|operating\s+segments?|reportable\s+segments?|business\s+segment|segments?\s+op[eé]rationnels?|gesch[aä]ftssegment|segmenti\s+operativi|umsatz\s+nach\s+segment)")[-2:]:
            chunks.append(("SEG", p, 6000))
    if not chunks:
        for p in all_pos(r"(?:management.{0,30}discussion|operating\s+(?:and\s+financial\s+)?review|business\s+review|rapport\s+de\s+gestion|lagebericht)")[-1:]:
            chunks.append(("MDA", p, 14000))
    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]

    chunks.sort(key=lambda x: x[1])
    parts = []
    for kind, start, budget in chunks:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def find_us_10k(ticker):
    """Pick the MOST RECENT 10-K (by year + filename date)."""
    if not SEC_CAT1.exists():
        return None
    cands = []
    for ydir in sorted([d for d in SEC_CAT1.iterdir() if d.is_dir()], reverse=True):
        for f in ydir.glob(f"{ticker}_*.htm.gz"):
            cands.append((ydir.name, f.name, f))
    if not cands:
        return None
    cands.sort(reverse=True)  # newest year + newest date string first
    return cands[0][2]


def find_eu_annual(ticker):
    d = SEC_CAT3 / ticker / "annual-text"
    if not d.exists():
        return None
    cands = list(d.glob("*.txt"))
    if not cands:
        return None
    # Pick the largest (most content) and recent
    return max(cands, key=lambda f: f.stat().st_size)


def read_source(ticker, country):
    if country == "US":
        f = find_us_10k(ticker)
        if not f:
            return None, "no_10k"
        try:
            with gzip.open(f, "rt", errors="ignore") as g:
                html = g.read()
            return strip_html(html), "us"
        except Exception:
            return None, "read_err"
    else:
        f = find_eu_annual(ticker)
        if not f:
            return None, "no_eu_txt"
        try:
            txt = f.read_text(errors="ignore")
            return txt, "eu"
        except Exception:
            return None, "read_err"


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 2500,
        "response_format": {"type": "json_object"},
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "content-type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError:
                        pass
                return None, "json_parse"
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(20)
                continue
            return None, f"http_{e.code}"
        except Exception as ex:
            if attempt < retries:
                time.sleep(5)
                continue
            return None, f"ex_{type(ex).__name__}"
    return None, "exhausted"


def get_api_key():
    idx = int(os.environ.get("KEY_INDEX", "0"))
    keys = [
        os.environ.get("CEREBRAS_API_KEY_0") or os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS_API_KEY_1") or os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS_API_KEY_2") or os.environ.get("CEREBRAS3_API_KEY"),
    ]
    keys = [k for k in keys if k]
    if not keys:
        return None
    return keys[idx % len(keys)]


def ram_free_mb():
    try:
        out = subprocess.check_output(["vm_stat"], text=True, timeout=5)
        m = re.search(r"Pages free:\s+(\d+)", out)
        if not m:
            return None
        return int(m.group(1)) * 16 / 1024  # 16 KB pages
    except Exception:
        return None


def load_quick_wins():
    """Load /tmp/v19-quick-wins.json built by external prep step.
    Format: { "TICKER": "segments_2plus" | "geography_2plus", ... }
    Split by KEY_INDEX modulo num_procs.
    """
    if not PENDING_FILE.exists():
        log_line(f"❌ PENDING_FILE not found: {PENDING_FILE}")
        sys.exit(1)
    data = json.loads(PENDING_FILE.read_text())
    if not isinstance(data, dict):
        log_line("❌ PENDING_FILE must be a dict {ticker: criterion}")
        sys.exit(1)
    idx = int(os.environ.get("KEY_INDEX", "0"))
    nproc = int(os.environ.get("NUM_PROCS", "3"))
    items = sorted(data.items())
    mine = [(t, c) for i, (t, c) in enumerate(items) if i % nproc == idx]
    return mine


def merge_block(target_path: Path, block_name: str, block_value: dict):
    """Merge block into target JSON file, creating if needed."""
    try:
        if target_path.exists():
            data = json.loads(target_path.read_text())
        else:
            return False
    except Exception:
        return False
    data[block_name] = block_value
    data["_seg_geo_backfilled_at"] = datetime.now(timezone.utc).isoformat()
    data["_seg_geo_backfilled_by"] = "CONV-CONCEPTS-cerebras-qwen3-235b"
    try:
        target_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return True
    except Exception:
        return False


def get_block_status(data: dict, block_name: str):
    """Return existing slice count from data[block_name]."""
    b = data.get(block_name) if isinstance(data, dict) else None
    if not isinstance(b, dict):
        return 0
    slices = b.get("slices")
    if isinstance(slices, list):
        return len(slices)
    return 0


def main():
    load_env()
    api_key = get_api_key()
    if not api_key:
        log_line("❌ NO Cerebras key")
        sys.exit(1)

    targets = load_quick_wins()
    log_line(f"START backfill ({len(targets)} stés) key={os.environ.get('KEY_INDEX','0')}")

    results = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "key_index": int(os.environ.get("KEY_INDEX", "0")),
        "ok_seg": [],
        "ok_geo": [],
        "skip_already_ok": [],
        "fail_no_source": [],
        "fail_llm": [],
        "fail_empty": [],
    }

    last_call = 0.0
    last_ram_check = 0.0
    sleep_mult = 1.0

    for i, (ticker, criterion) in enumerate(targets):
        # RAM monitor every 30s
        now = time.time()
        if now - last_ram_check > RAM_CHECK_EVERY:
            free = ram_free_mb()
            if free is not None:
                if free < 50:
                    sleep_mult = RAM_THROTTLE_MULT
                    log_line(f"  ⚠️ RAM {free:.0f}MB free → throttle ×{RAM_THROTTLE_MULT}")
                elif free < 100 and sleep_mult > 1:
                    sleep_mult = 2.0
                elif free >= 200 and sleep_mult != 1.0:
                    sleep_mult = 1.0
                    log_line(f"  ✓ RAM {free:.0f}MB free → back to normal")
            last_ram_check = now

        sleep_needed = SLEEP_BASE * sleep_mult
        elapsed = time.time() - last_call
        if elapsed < sleep_needed:
            time.sleep(sleep_needed - elapsed)
        last_call = time.time()

        if i and i % 10 == 0:
            log_line(f"  [{i}/{len(targets)}] seg={len(results['ok_seg'])} geo={len(results['ok_geo'])} fail_llm={len(results['fail_llm'])} no_src={len(results['fail_no_source'])}")

        # Load source data
        cp = COMPLETE_DIR / f"{ticker}.json"
        vp = V2_DIR / f"{ticker.lower()}.json"
        data = None
        for p in (cp, vp):
            if p.exists():
                try:
                    data = json.loads(p.read_text())
                    break
                except Exception:
                    pass
        if data is None:
            results["fail_no_source"].append({"ticker": ticker, "reason": "no_dataset"})
            continue

        country = data.get("country") or "US"
        name = data.get("name") or ticker

        # Decide which block(s) we need
        if criterion == "segments_2plus":
            block_name = "revenue_by_segment"
            prompt_tpl = PROMPT_SEG
            result_key = "ok_seg"
        elif criterion == "geography_2plus":
            block_name = "revenue_by_geography"
            prompt_tpl = PROMPT_GEO
            result_key = "ok_geo"
        else:
            continue  # unsupported

        # Skip if already OK (race condition guard)
        if get_block_status(data, block_name) >= 2:
            results["skip_already_ok"].append(ticker)
            continue

        # Read source
        text, src_kind = read_source(ticker, country)
        if not text:
            results["fail_no_source"].append({"ticker": ticker, "country": country, "reason": src_kind})
            continue

        want = "seg" if criterion == "segments_2plus" else "geo"
        if src_kind == "us":
            ctx = find_section_us(text, want=want)
        else:
            ctx = find_section_eu(text, want=want)

        prompt = prompt_tpl.format(name=name, ticker=ticker, ctx=ctx)
        if os.environ.get("DEBUG_PROMPT") == "1":
            log_line(f"  {ticker} prompt-tail: ...{ctx[-400:].strip()[:300]}")
        result, err = call_cerebras(prompt, api_key)
        if os.environ.get("DEBUG_PROMPT") == "1" and result:
            log_line(f"  {ticker} raw-result: {json.dumps(result)[:500]}")
        if not result or not isinstance(result, dict):
            results["fail_llm"].append({"ticker": ticker, "err": err or "no_result"})
            continue

        bloc = result.get(block_name)
        if not isinstance(bloc, dict) or not isinstance(bloc.get("slices"), list):
            log_line(f"  {ticker} bad_struct keys={list(result.keys())[:5]}")
            results["fail_empty"].append({"ticker": ticker, "reason": "bad_struct", "keys": list(result.keys())[:5]})
            continue
        slices = bloc.get("slices", [])
        if len(slices) < 2:
            log_line(f"  {ticker} slices={len(slices)} sample={json.dumps(slices)[:120]}")
            results["fail_empty"].append({"ticker": ticker, "country": country, "slices_count": len(slices)})
            continue

        # Write back to BOTH v1-9-complete and v2-pipeline so audit picks it up
        wrote_complete = merge_block(cp, block_name, bloc) if cp.exists() else False
        wrote_v2 = merge_block(vp, block_name, bloc) if vp.exists() else False
        if not wrote_complete and not wrote_v2:
            results["fail_empty"].append({"ticker": ticker, "reason": "write_fail"})
            continue

        results[result_key].append({
            "ticker": ticker,
            "country": country,
            "slices_count": len(slices),
            "wrote_complete": wrote_complete,
            "wrote_v2": wrote_v2,
        })

        # Save progress incrementally every 5 OK results
        if (len(results["ok_seg"]) + len(results["ok_geo"])) % 5 == 0:
            try:
                RESULT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))
            except Exception:
                pass

    results["ended_at"] = datetime.now(timezone.utc).isoformat()
    RESULT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))

    log_line(f"END key={os.environ.get('KEY_INDEX','0')}: seg={len(results['ok_seg'])} geo={len(results['ok_geo'])} fail_llm={len(results['fail_llm'])} no_src={len(results['fail_no_source'])} empty={len(results['fail_empty'])} skip={len(results['skip_already_ok'])}")


if __name__ == "__main__":
    main()
