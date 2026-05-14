#!/usr/bin/env python3
"""enrich-sp500-haiku-seggeo.py — Haiku Pass 3 sur SP500 stés sans seg+geo
pour passer du ceiling Cerebras (~50%) vers 75-85%.

Coût estimé : ~$0.005/sté × N stés.
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
    import certifi; SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT1 = PROJECT_ROOT / "sec-data/cat1-us/10K"

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP = 4.0

PROMPT = """Extract from this 10-K SEC filing the revenue breakdown by SEGMENT and by GEOGRAPHY.

Company: {name} ({ticker})

Return JSON ONLY, nothing else:

{{
  "revenue_by_segment": {{
    "label": "Répartition du chiffre d'affaires par segment opérationnel",
    "slices": [
      {{"name": "Segment name", "value": 12.5, "unit": "Mds $", "pct": 35.0}}
    ]
  }} | null,
  "revenue_by_geography": {{
    "label": "Répartition du chiffre d'affaires par zone géographique",
    "slices": [
      {{"name": "North America", "value": 8.4, "unit": "Mds $", "pct": 47.0}}
    ]
  }} | null
}}

RULES:
1. Each block needs >=2 slices, otherwise return null for that block.
2. value in Mds $ (convert from M$ / B$).
3. pct = % of total revenue.
4. NEVER fabricate. Skip with null if not explicitly disclosed.
5. Geography names can be: "North America", "U.S.", "International", "Europe",
   "Asia Pacific", "EMEA", etc. — use what's in the filing.

10-K excerpts (Item 7 MD&A + Item 8 Financials + Segment/Geographic sections):
---
{ctx}
---"""


HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&[a-zA-Z]+;")
HTML_ENT_D = re.compile(r"&#\d+;")
WS = re.compile(r"\s+")


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def strip_html(html):
    text = HTML_TAG.sub(" ", html)
    text = HTML_ENT_N.sub(" ", text)
    text = HTML_ENT_D.sub(" ", text)
    return WS.sub(" ", text).strip()


def find_section(text):
    def last_pos(pat):
        ps = [m.start() for m in re.finditer(pat, text, re.I)]
        return ps[-1] if ps else None
    chunks = []
    p = last_pos(r"item\s+7\.?\s+management.{0,30}discussion")
    if p: chunks.append(("MDA", p, 8000))
    p = last_pos(r"item\s+8\.?\s+financial\s+statements")
    if p: chunks.append(("FIN", p, 5000))
    p = last_pos(r"(?:geographic\s+(?:information|areas?|revenues?)|disaggregation\s+of\s+revenue)")
    if p: chunks.append(("GEO", p, 4000))
    p = last_pos(r"(?:operating\s+segments?|reportable\s+segments?|segment\s+information)")
    if p: chunks.append(("SEG", p, 4000))
    if not chunks:
        mid = len(text)//2; return text[max(0,mid-10000):mid+10000]
    chunks.sort(key=lambda x: x[1])
    parts = []; seen = set()
    for kind, start, budget in chunks:
        if kind in seen: continue
        seen.add(kind)
        parts.append(f"=== {kind} ===\n{text[start:start+budget]}")
    return "\n\n".join(parts)[:22000]


def find_10k(ticker):
    if not SEC_CAT1.exists(): return None
    cands = []
    for ydir in sorted([d for d in SEC_CAT1.iterdir() if d.is_dir()], reverse=True):
        for f in ydir.glob(f"{ticker}_*.htm.gz"):
            cands.append(f)
    return max(cands, key=lambda f: f.stat().st_size) if cands else None


def call_haiku(prompt, key, retries=2):
    body = json.dumps({"model": MODEL_ID, "max_tokens": 2000, "messages":[{"role":"user","content":prompt}], "temperature": 0.0}).encode()
    headers = {"x-api-key": key, "anthropic-version":"2023-06-01", "content-type":"application/json", "User-Agent":"curl/7.79.1"}
    for attempt in range(retries+1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp.get("content",[{}])[0].get("text","")
            content = re.sub(r"^```(?:json)?\s*|\s*```$","",content.strip())
            try: return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries: time.sleep(15); continue
            print(f"  HTTP {e.code}", flush=True); return None
        except Exception as ex:
            print(f"  Ex {type(ex).__name__}", flush=True); time.sleep(3)
    return None


def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ NO ANTHROPIC_API_KEY"); sys.exit(1)

    # Build pending : SP500 missing seg OR geo
    sp500 = sorted(set(open("/tmp/sp500-tickers.txt").read().splitlines()) - {""})
    pending = []
    for tk in sp500:
        if "." in tk: continue
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists(): continue
        d = json.loads(p.read_text())
        seg_ok = isinstance((d.get("revenue_by_segment") or {}).get("slices"), list) and len((d.get("revenue_by_segment") or {})["slices"]) >= 2
        geo_ok = isinstance((d.get("revenue_by_geography") or {}).get("slices"), list) and len((d.get("revenue_by_geography") or {})["slices"]) >= 2
        if not (seg_ok and geo_ok):
            pending.append(tk)
    print(f"Pending SP500 seg/geo: {len(pending)}", flush=True)

    updated_seg = 0; updated_geo = 0; no_src = 0; fails = 0
    last_call = 0.0
    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(pending)}] seg+{updated_seg} geo+{updated_geo} no_src={no_src} fail={fails}", flush=True)
        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()

        p = PIPELINE / f"{tk.lower()}.json"
        data = json.loads(p.read_text())
        seg_ok = isinstance((data.get("revenue_by_segment") or {}).get("slices"), list) and len((data.get("revenue_by_segment") or {})["slices"]) >= 2
        geo_ok = isinstance((data.get("revenue_by_geography") or {}).get("slices"), list) and len((data.get("revenue_by_geography") or {})["slices"]) >= 2
        if seg_ok and geo_ok: continue

        f10k = find_10k(tk)
        if not f10k: no_src += 1; continue
        try:
            with gzip.open(f10k, "rt", errors="ignore") as g: html = g.read()
        except: no_src += 1; continue
        text = strip_html(html)
        ctx = find_section(text)
        prompt = PROMPT.format(name=data.get("name", tk), ticker=tk, ctx=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict): fails += 1; continue

        changed = False
        seg = result.get("revenue_by_segment")
        if not seg_ok and seg and isinstance(seg, dict) and isinstance(seg.get("slices"), list) and len(seg["slices"]) >= 2:
            data["revenue_by_segment"] = seg; updated_seg += 1; changed = True
        geo = result.get("revenue_by_geography")
        if not geo_ok and geo and isinstance(geo, dict) and isinstance(geo.get("slices"), list) and len(geo["slices"]) >= 2:
            data["revenue_by_geography"] = geo; updated_geo += 1; changed = True
        if changed:
            data["_haiku_seggeo_at"] = datetime.now(timezone.utc).isoformat()
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(f"DONE: seg+{updated_seg} geo+{updated_geo} no_src={no_src} fails={fails}", flush=True)


if __name__ == "__main__": main()
