#!/usr/bin/env python3
"""enrich-seg-geo-cerebras-sp500.py — Extract revenue_by_segment +
revenue_by_geography from cat1-us 10-K via Cerebras Qwen-3 235B (free).

Pour chaque sté SP500 sans segment OR sans geo dans pipeline,
1. Find latest 10-K in sec-data/cat1-us/10K/<year>/<TICKER>_*.htm.gz
2. Strip HTML, locate Item 7 MD&A + Item 8 Financial Statements +
   "Geographic Information" / "Segment Information" sections
3. LLM extract structured slices for both blocks
4. Update v2-pipeline/<ticker>.json (only if missing in pipeline)

3 procs parallèles via KEY_INDEX env (0/1/2). Sleep 4s between calls.
ETA ~10-15 min for ~250 stés × 3 procs.
"""
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT1 = PROJECT_ROOT / "sec-data/cat1-us/10K"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", ""))
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-seg-geo-sp500.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP = 4.0
CTX_LEN = 22000

PROMPT = """Tu extrais 2 blocs depuis le 10-K SEC d'une société américaine.

Société : {name} ({ticker})

Format JSON STRICT (rien d'autre) :

{{
  "revenue_by_segment": {{
    "label": "Répartition du chiffre d'affaires par segment opérationnel",
    "slices": [
      {{"name": "Nom du segment", "value": 12.5, "unit": "Mds $", "pct": 35.0}}
    ]
  }},
  "revenue_by_geography": {{
    "label": "Répartition du chiffre d'affaires par zone géographique",
    "slices": [
      {{"name": "Amérique du Nord", "value": 8.4, "unit": "Mds $", "pct": 47.0}}
    ]
  }}
}}

RÈGLES STRICTES :
1. Pour segment ET geography, retourne au moins 2 slices (sinon null pour ce bloc).
2. value EN MDS $ (convertir si nécessaire depuis M$/B$).
3. pct = part en % du total (calculer si pas explicite).
4. JAMAIS inventer. Si pas chiffré explicitement → null.
5. Pour geography : utilise les zones officielles utilisées dans le filing
   (ex: "North America", "U.S.", "International", "Europe", "Asia Pacific").
6. Si une seule zone géographique mentionnée explicitement (100% US) →
   retourne slices: [{{"name":"États-Unis","value":TOTAL,"unit":"Mds $","pct":100}}].

Extrait du 10-K :
---
{ctx}
---"""


HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&[a-zA-Z]+;")
HTML_ENT_D = re.compile(r"&#\d+;")
WS = re.compile(r"\s+")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}][{os.environ.get('KEY_INDEX','0')}] {msg}"
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


def find_section(text: str) -> str:
    """Locate Item 7 MD&A + Item 8 Financials + Segment + Geographic chunks.
    Return concatenated extract ~22K chars max.
    """
    def last_pos(pat):
        positions = [m.start() for m in re.finditer(pat, text, re.I)]
        return positions[-1] if positions else None

    chunks = []
    pos = last_pos(r"item\s+7\.?\s+management.{0,30}discussion")
    if pos:
        chunks.append(("MDA", pos, 10000))
    pos = last_pos(r"item\s+8\.?\s+financial\s+statements")
    if pos:
        chunks.append(("FIN", pos, 6000))
    # Geographic section
    pos = last_pos(r"(?:geographic\s+(?:information|areas?|revenues?)|disaggregation\s+of\s+revenue)")
    if pos:
        chunks.append(("GEO", pos, 4000))
    # Segment section
    pos = last_pos(r"(?:operating\s+segments?|reportable\s+segments?|segment\s+information)")
    if pos:
        chunks.append(("SEG", pos, 4000))

    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]

    chunks.sort(key=lambda x: x[1])
    parts = []
    seen = set()
    for kind, start, budget in chunks:
        if kind in seen:
            continue
        seen.add(kind)
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def find_10k(ticker):
    if not SEC_CAT1.exists():
        return None
    cands = []
    for ydir in sorted([d for d in SEC_CAT1.iterdir() if d.is_dir()], reverse=True):
        for f in ydir.glob(f"{ticker}_*.htm.gz"):
            cands.append(f)
    if not cands:
        return None
    return max(cands, key=lambda f: f.stat().st_size)


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
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except json.JSONDecodeError:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(15)
                continue
            log_line(f"  HTTP {e.code}")
            return None
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}")
            time.sleep(3)
    return None


def get_api_key():
    idx = int(os.environ.get("KEY_INDEX", "0"))
    keys = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    keys = [k for k in keys if k]
    if not keys:
        return None
    return keys[idx % len(keys)]


def main():
    load_env()
    api_key = get_api_key()
    if not api_key:
        log_line("❌ NO Cerebras key")
        sys.exit(1)

    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    log_line(f"START seg-geo-sp500 ({len(pending)} stés)")

    updated_seg = 0
    updated_geo = 0
    no_source = 0
    fails = 0
    last_call = 0.0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            log_line(f"  [{i}/{len(pending)}] seg={updated_seg} geo={updated_geo} no_src={no_source} fail={fails}")
        elapsed = time.time() - last_call
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)
        last_call = time.time()

        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue

        # Skip if both already present
        seg_ok = (isinstance((data.get("revenue_by_segment") or {}).get("slices"), list)
                  and len((data["revenue_by_segment"]["slices"])) >= 2)
        geo_ok = (isinstance((data.get("revenue_by_geography") or {}).get("slices"), list)
                  and len((data["revenue_by_geography"]["slices"])) >= 2)
        if seg_ok and geo_ok:
            continue

        f10k = find_10k(tk)
        if not f10k:
            no_source += 1
            continue
        try:
            with gzip.open(f10k, "rt", errors="ignore") as g:
                html = g.read()
        except Exception:
            no_source += 1
            continue

        text = strip_html(html)
        ctx = find_section(text)
        prompt = PROMPT.format(name=data.get("name", tk), ticker=tk, ctx=ctx)
        result = call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            continue

        changed = False
        seg = result.get("revenue_by_segment")
        if not seg_ok and seg and isinstance(seg, dict) and isinstance(seg.get("slices"), list) and len(seg["slices"]) >= 2:
            data["revenue_by_segment"] = seg
            updated_seg += 1
            changed = True
        geo = result.get("revenue_by_geography")
        if not geo_ok and geo and isinstance(geo, dict) and isinstance(geo.get("slices"), list) and len(geo["slices"]) >= 2:
            data["revenue_by_geography"] = geo
            updated_geo += 1
            changed = True

        if changed:
            data["_seg_geo_extracted_at"] = datetime.now(timezone.utc).isoformat()
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception:
                fails += 1

    log_line(f"END: seg={updated_seg} geo={updated_geo} no_src={no_source} fails={fails}")


if __name__ == "__main__":
    main()
