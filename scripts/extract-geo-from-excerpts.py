#!/usr/bin/env python3
"""extract-geo-from-excerpts.py — Haiku 4.5 sur excerpts pré-parsés.

CONV-CONCEPTS leader T2 (19 mai 20h30) a pré-extrait 134 excerpts dans
/tmp/geo-extract/excerpts/<ticker.lower()>.txt contenant les sections
geographic info des 10-K / annual reports. Bypass full filing parsing.

Output : merge dans src/data/v2-pipeline/<ticker>.json (scope CONV-DATA).
Format :
  revenue_by_geography = {
    "unit": "B$" | "M$" | "M€" | etc.,
    "source_date": "YYYY-MM-DD",
    "source": "10-K FY2024 Item 7",
    "slices": [{"label": "États-Unis", "value": ..., "share_pct": ...}, ...]
  }

Labels en FRANÇAIS obligatoires (cf brief CONV-CONCEPTS).

Coût : ~2K input × 0.001/K + ~300 output × 0.005/K = $0.0035/sté.
134 stés × $0.0035 = ~$0.47 total. Haiku Max plan OK.

Usage : python3 scripts/extract-geo-from-excerpts.py [--limit N] [--force]
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
EXCERPTS_DIR = Path("/tmp/geo-extract/excerpts")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP = 2.0  # 30 req/min (Haiku 4.5 standard rate limit)
MAX_CTX = 18000


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists(): return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


PROMPT = """Tu lis un extrait de rapport annuel d'une société cotée pour extraire la répartition géographique du chiffre d'affaires.

Société : {name} (ticker {ticker})

Extrait :
{ctx}

RETOURNE UNIQUEMENT du JSON, pas de markdown, pas de texte autour :

{{
  "revenue_by_geography": {{
    "unit": "<unité, ex Mds $, M $, M €, etc.>",
    "source_date": "<YYYY-MM-DD du fiscal year end ou de publication>",
    "source": "<10-K FY2024 Item 7 — ou source précise>",
    "slices": [
      {{"label": "<label en FRANÇAIS>", "value": <number>, "share_pct": <number ou null>}},
      ...
    ]
  }}
}}

RÈGLES STRICTES :
1. Labels en FRANÇAIS (États-Unis, Amériques, Europe, Asie, Asie-Pacifique, Reste du monde, etc.).
2. Si la sté est mono-géographique (zone unique 95%+), retourne {{ "revenue_by_geography": {{ "single_region": true, "source": "..." }} }}.
3. Si l'extrait NE CONTIENT PAS de chiffres géographiques exploitables, retourne {{ "revenue_by_geography": null }}.
4. NE JAMAIS INVENTER de chiffres. Si pas sûr, mets value: null.
5. Min 2 slices si plusieurs régions présentes. Sinon single_region: true.
6. Pas d'em-dash (—) dans les labels."""


def call_haiku(prompt: str, api_key: str, retries: int = 2):
    body = {
        "model": MODEL_ID,
        "max_tokens": 800,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
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
                time.sleep(20); continue
            return None
        except Exception:
            time.sleep(3)
    return None


def read_excerpt(ticker: str) -> str | None:
    p = EXCERPTS_DIR / f"{ticker.lower()}.txt"
    if not p.exists(): return None
    txt = p.read_text(errors="ignore")
    if len(txt) < 500: return None
    # Trim to MAX_CTX chars
    if len(txt) > MAX_CTX:
        txt = txt[:MAX_CTX]
    return txt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true", help="Re-process même si geo déjà présent")
    ap.add_argument("--tickers", type=str, help="Comma-separated")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ NO ANTHROPIC_API_KEY"); sys.exit(1)

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",")]
    else:
        tickers = sorted([p.stem.upper() for p in EXCERPTS_DIR.glob("*.txt")])
    if args.limit > 0:
        tickers = tickers[:args.limit]

    print(f"Tickers à traiter : {len(tickers)}", flush=True)

    updated = 0; no_excerpt = 0; no_pipeline = 0; fails = 0; skipped = 0; single = 0
    last_call = 0.0

    for i, tk in enumerate(tickers):
        if i and i % 20 == 0:
            print(f"  [{i}/{len(tickers)}] updated={updated} single={single} fails={fails} no_src={no_excerpt+no_pipeline}", flush=True)

        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            no_pipeline += 1; continue
        data = json.loads(p.read_text())
        geo = data.get("revenue_by_geography")
        geo_ok = (isinstance(geo, dict) and (
            (isinstance(geo.get("slices"), list) and len(geo["slices"]) >= 2)
            or geo.get("single_region") is True
        ))
        if geo_ok and not args.force:
            skipped += 1; continue

        excerpt = read_excerpt(tk)
        if not excerpt:
            no_excerpt += 1; continue

        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()

        prompt = PROMPT.format(name=data.get("name", tk), ticker=tk, ctx=excerpt)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1; continue

        new_geo = result.get("revenue_by_geography")
        if new_geo is None:
            fails += 1; continue
        if isinstance(new_geo, dict) and new_geo.get("single_region") is True:
            data["revenue_by_geography"] = {"single_region": True, "source": new_geo.get("source", "10-K extract")}
            data["_geo_extracted_at"] = datetime.now(timezone.utc).isoformat()
            data["_geo_source"] = "haiku-excerpts-v1"
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            single += 1; continue
        if isinstance(new_geo, dict) and isinstance(new_geo.get("slices"), list) and len(new_geo["slices"]) >= 2:
            data["revenue_by_geography"] = new_geo
            data["_geo_extracted_at"] = datetime.now(timezone.utc).isoformat()
            data["_geo_source"] = "haiku-excerpts-v1"
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            updated += 1; continue
        fails += 1

    print(f"DONE: updated={updated} single={single} skipped={skipped} no_excerpt={no_excerpt} no_pipeline={no_pipeline} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
