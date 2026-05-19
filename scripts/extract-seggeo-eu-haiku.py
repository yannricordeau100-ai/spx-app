#!/usr/bin/env python3
"""extract-seggeo-eu-haiku.py — Haiku 4.5 segments+geo pour 52 stés EU.

CONV-CONCEPTS leader T2 m'a confié les 52 stés EU (avec . dans ticker)
manquantes en segments dans top 307. Source = cat3-european/<TICKER>/
annual-text/<latest_year>.txt (ou .pdf si pas de .txt).

Output : merge dans src/data/v2-pipeline/<ticker>.json (scope CONV-DATA).

Coût : ~$0.006/sté × 52 = ~$0.31. RAM safe (1 proc séquentiel).

Yann 19 mai 2026 — phase 2 Cat 5.

Usage :
    python3 scripts/extract-seggeo-eu-haiku.py --tickers-file /tmp/conv-data-runs/seg-eu-batch.txt
"""
from __future__ import annotations
import argparse
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

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
CAT3 = ROOT / "sec-data/cat3-european"

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP = 3.0
MAX_CTX = 20000


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists(): return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


PROMPT = """Tu lis un extrait du rapport annuel d'une société européenne pour extraire la répartition par SEGMENT et par GÉOGRAPHIE du chiffre d'affaires.

Société : {name} (ticker {ticker})
Source : {source}

Extrait du rapport annuel ({n_chars} chars):
{ctx}

RETOURNE UNIQUEMENT du JSON, pas de markdown, pas de texte autour :

{{
  "revenue_by_segment": {{
    "unit": "<unité, ex Mds €, M €, etc.>",
    "source_date": "<YYYY-MM-DD du fiscal year end>",
    "source": "Annual Report {fy_year}",
    "slices": [
      {{"label": "<label divisionnel, en anglais ou langue d'origine>", "value": <number>, "share_pct": <number ou null>}}
    ]
  }},
  "revenue_by_geography": {{
    "unit": "<unité>",
    "source_date": "<YYYY-MM-DD>",
    "source": "Annual Report {fy_year}",
    "slices": [
      {{"label": "<label en FRANÇAIS (États-Unis, Europe, Asie, etc.)>", "value": <number>, "share_pct": <number ou null>}}
    ]
  }}
}}

RÈGLES STRICTES :
1. Pour revenue_by_segment : labels = noms officiels des divisions (Electrification, Process Automation, Health Care, etc.). PAS en français.
2. Pour revenue_by_geography : labels = noms en FRANÇAIS (États-Unis, Europe, Asie-Pacifique, Royaume-Uni, Allemagne, etc.).
3. Min 2 slices par bloc.
4. Si la sté est mono-segment OU mono-géo : `{{ "single_segment": true }}` ou `{{ "single_region": true }}`.
5. Si l'extrait ne contient PAS de chiffres exploitables pour un bloc, retourne `null` pour ce bloc.
6. NE JAMAIS INVENTER de chiffres. Si pas sûr, value: null.
7. Pas d'em-dash (—) dans les labels.
8. Si le rapport est en allemand/français/italien : traduis les labels géo en français, garde les labels segmentaires en VO."""


def call_haiku(prompt: str, api_key: str, retries: int = 2):
    body = {
        "model": MODEL_ID,
        "max_tokens": 1500,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}],
    }
    data = json.dumps(body).encode()
    headers = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": api_key,
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=data, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            txt = (resp.get("content") or [{}])[0].get("text", "")
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt.strip(), flags=re.MULTILINE)
            try: return json.loads(txt)
            except:
                m = re.search(r"\{.*\}", txt, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(30); continue
            return None
        except Exception:
            time.sleep(3)
    return None


SEGMENT_KEYWORDS_RE = re.compile(
    r"(?i)\b(segment|geographic|division|business area|operating segment|disaggregation|by region|revenue by|sales by|net sales by|external revenues)",
)


def find_section(text: str, max_chars: int = MAX_CTX) -> tuple[str, int]:
    """Find the section with segment/geographic keywords + extract context window."""
    matches = list(SEGMENT_KEYWORDS_RE.finditer(text))
    if not matches:
        # No specific section, take middle of doc
        mid = len(text) // 2
        start = max(0, mid - max_chars // 2)
        return text[start:start + max_chars], 0
    # Take first match + 18K chars after
    best = matches[0]
    start = max(0, best.start() - 2000)
    return text[start:start + max_chars], len(matches)


def read_annual_text(ticker: str) -> tuple[str | None, str]:
    """Read latest annual-text file for ticker."""
    d = CAT3 / ticker / "annual-text"
    if not d.exists():
        return None, ""
    files = sorted(d.glob("*.txt"), reverse=True)
    if not files:
        return None, ""
    latest = files[0]
    try:
        txt = latest.read_text(errors="ignore")
        return txt, latest.name.replace(".txt", "")
    except Exception:
        return None, ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", type=str)
    ap.add_argument("--tickers", type=str)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ NO ANTHROPIC_API_KEY"); sys.exit(1)

    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",")]
    elif args.tickers_file:
        tickers = [l.strip() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    else:
        print("--tickers or --tickers-file required"); sys.exit(1)
    if args.limit > 0:
        tickers = tickers[:args.limit]

    print(f"Tickers EU à traiter : {len(tickers)}", flush=True)

    updated_seg = 0; updated_geo = 0; single_seg = 0; single_geo = 0
    no_source = 0; no_pipeline = 0; fails = 0; skipped = 0
    last_call = 0.0

    for i, tk in enumerate(tickers):
        if i and i % 10 == 0:
            print(f"  [{i}/{len(tickers)}] seg+{updated_seg} geo+{updated_geo} single_s={single_seg} single_g={single_geo} fail={fails} no_src={no_source}", flush=True)

        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            no_pipeline += 1; continue
        data = json.loads(p.read_text())
        seg_ok = (isinstance(data.get("revenue_by_segment"), dict) and (
            (isinstance(data["revenue_by_segment"].get("slices"), list) and len(data["revenue_by_segment"]["slices"]) >= 2)
            or data["revenue_by_segment"].get("single_segment") is True
        ))
        geo_ok = (isinstance(data.get("revenue_by_geography"), dict) and (
            (isinstance(data["revenue_by_geography"].get("slices"), list) and len(data["revenue_by_geography"]["slices"]) >= 2)
            or data["revenue_by_geography"].get("single_region") is True
        ))
        if seg_ok and geo_ok and not args.force:
            skipped += 1; continue

        text, year_str = read_annual_text(tk)
        if not text:
            print(f"{tk}: no source", flush=True)
            no_source += 1; continue

        ctx, _ = find_section(text)

        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()

        prompt = PROMPT.format(
            name=data.get("name", tk),
            ticker=tk,
            source=f"cat3-european/{tk}/annual-text/{year_str}.txt",
            n_chars=len(ctx),
            ctx=ctx,
            fy_year=year_str or "2024",
        )
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1; continue

        changed = False
        new_seg = result.get("revenue_by_segment")
        if not seg_ok and isinstance(new_seg, dict):
            if new_seg.get("single_segment") is True:
                data["revenue_by_segment"] = {"single_segment": True, "source": new_seg.get("source", "Annual Report")}
                single_seg += 1; changed = True
            elif isinstance(new_seg.get("slices"), list) and len(new_seg["slices"]) >= 2:
                data["revenue_by_segment"] = new_seg
                updated_seg += 1; changed = True

        new_geo = result.get("revenue_by_geography")
        if not geo_ok and isinstance(new_geo, dict):
            if new_geo.get("single_region") is True:
                data["revenue_by_geography"] = {"single_region": True, "source": new_geo.get("source", "Annual Report")}
                single_geo += 1; changed = True
            elif isinstance(new_geo.get("slices"), list) and len(new_geo["slices"]) >= 2:
                data["revenue_by_geography"] = new_geo
                updated_geo += 1; changed = True

        if changed:
            data["_seggeo_extracted_at"] = datetime.now(timezone.utc).isoformat()
            data["_seggeo_source"] = "haiku-eu-annual-text-v1"
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            fails += 1

    print(f"DONE: seg+{updated_seg} geo+{updated_geo} single_s={single_seg} single_g={single_geo} skipped={skipped} no_src={no_source} no_pl={no_pipeline} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
