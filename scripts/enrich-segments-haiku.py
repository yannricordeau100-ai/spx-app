#!/usr/bin/env python3
"""
enrich-segments-haiku.py — extrait revenue_by_segment + revenue_by_geography
depuis le dernier 10-K via Anthropic Haiku 4.5.

V1.0 (5 stés) a ces blocs hand-curated. V1.7 (975 stés) doit les avoir
auto-extraits. SEC EDGAR companyfacts ne donne pas la disaggregation, donc
LLM nécessaire. Cerebras / Groq trop instables sur cette tâche → Haiku
direct.

Coût : ~3K input tokens + ~500 output tokens × $1/M input + $5/M output
= $0.0055 / sté. 973 stés = ~$5.4 total. Yann sur Max plan, OK.

Stratégie :
  1. Lire sec-data/cat1-us/10K/<year>/<TICKER>_*.htm.gz (HTML stripped).
  2. Trouver Item 7 + Item 8 + "Segment Information" / "Disaggregation
     of Revenue" sections via regex (max 12K chars contexte).
  3. Demander à Haiku JSON {revenue_by_segment, revenue_by_geography}
     compatible RevenueBreakdown (cf. src/lib/data.ts).
  4. Écrire dans `v2-pipeline-enrich/<ticker>.json` (merge sans écraser).

Usage :
    python3 scripts/enrich-segments-haiku.py [--limit N] [--force]
    python3 scripts/enrich-segments-haiku.py --tickers AAPL,MSFT,NVDA
"""
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
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"


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


def _strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    # Garde les <table> avec un séparateur visible pour pas concaténer les
    # cellules ensemble (utile pour le LLM)
    txt = re.sub(r"</td>", " | ", txt, flags=re.IGNORECASE)
    txt = re.sub(r"</tr>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"&#\d+;|&[a-z]+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    return txt


def find_10k_text(ticker: str) -> str | None:
    tu = ticker.upper()
    candidates = [
        SEC / "cat1-us" / "10K",
        SEC / "cat2-foreign-adr" / "20F",
        SEC / "cat2-foreign-adr" / "10K",
    ]
    for base in candidates:
        if not base.exists():
            continue
        years = sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)
        for year_dir in years[:3]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read())
                except Exception:
                    continue
    return None


SEGMENT_PATTERNS = [
    r"segment\s+information",
    r"reportable\s+segments",
    r"operating\s+segments",
    r"disaggregation\s+of\s+revenue",
    r"revenues?\s+by\s+(segment|category|product)",
    r"net\s+sales\s+by\s+segment",
    r"sales\s+by\s+geographic",
    r"revenues?\s+by\s+geographic",
    r"geographic\s+information",
]
SEGMENT_RE = re.compile("|".join(SEGMENT_PATTERNS), re.IGNORECASE)


def extract_segment_context(text: str, max_chars: int = 12000) -> str:
    """Cherche les sections segment / geographic et concatène le contexte."""
    if not text:
        return ""
    matches = list(SEGMENT_RE.finditer(text))
    if not matches:
        return ""
    windows: list[tuple[int, int]] = []
    BEFORE = 200
    AFTER = 2500
    for m in matches:
        start = max(0, m.start() - BEFORE)
        end = min(len(text), m.end() + AFTER)
        if windows and start <= windows[-1][1]:
            windows[-1] = (windows[-1][0], max(windows[-1][1], end))
        else:
            windows.append((start, end))
    chunks = []
    total = 0
    for s, e in windows:
        chunk = re.sub(r"\s+", " ", text[s:e]).strip()
        chunks.append(chunk)
        total += len(chunk)
        if total >= max_chars:
            break
    return "\n\n---\n\n".join(chunks)[:max_chars]


PROMPT = """Lis ces extraits du 10-K de {ticker} ({company_name}) et extrais la répartition du chiffre d'affaires par segment opérationnel ET par zone géographique pour la dernière année fiscale disponible.

Extraits :
{context}

Renvoie UNIQUEMENT un JSON valide, pas d'autre texte. Format strict :
{{
  "revenue_by_segment": {{
    "unit": "$B",
    "source_date": "2024-12-31",
    "source": "10-K {fy_year}",
    "slices": [
      {{"label": "iPhone", "value": 200.6}},
      {{"label": "Services", "value": 96.2}}
    ]
  }},
  "revenue_by_geography": {{
    "unit": "$B",
    "source_date": "2024-12-31",
    "source": "10-K {fy_year}",
    "slices": [
      {{"label": "Americas", "value": 167.0}},
      {{"label": "Europe", "value": 101.3}}
    ]
  }}
}}

Règles strictes :
- Valeurs en milliards USD ($B). Si la sté reporte en autre devise, convertis approximativement (1 USD = 1 EUR pour simplifier ; les chiffres sont des ordres de grandeur).
- Si pas de breakdown segment dans les extraits → revenue_by_segment: null.
- Si pas de breakdown geography → revenue_by_geography: null.
- Au moins 2 slices par breakdown si présent.
- Pas plus de 6 slices (top 5 + "Other" si nécessaire).
- Labels en anglais (langue d'origine du 10-K).
- Pas d'invention. Si pas certain, mets null.
"""


def call_anthropic(prompt: str, api_key: str, retries: int = 2) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as r:
                resp = json.loads(r.read())
            content = resp.get("content", [{}])[0].get("text", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(10)
                continue
            return None
        except Exception:
            time.sleep(2)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--tickers", type=str, default=None, help="Comma-separated subset")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY introuvable", file=sys.stderr)
        sys.exit(1)

    v17 = json.loads(V17.read_text())
    if args.tickers:
        wanted = {t.strip().upper() for t in args.tickers.split(",")}
        tickers = [t for t in v17 if t.upper() in wanted]
    else:
        # Cat 1 US only (sec-data couvre principalement)
        tickers = [t for t in v17 if "." not in t]

    pending = []
    for t in tickers:
        out = ENR / f"{t.lower()}.json"
        if out.exists() and not args.force:
            try:
                existing = json.loads(out.read_text())
                if existing.get("revenue_by_segment") is not None or existing.get("revenue_by_geography") is not None:
                    continue
            except Exception:
                pass
        pending.append(t)

    if args.limit:
        pending = pending[: args.limit]
    print(f"📊 Segments + geography Haiku 4.5 : {len(pending)} stés (sur {len(tickers)} cat 1 US)")

    written = 0
    no_ctx = 0
    no_resp = 0
    last_call = 0.0

    for i, t in enumerate(pending):
        # 50 req/min cap Anthropic free tier (sécurité 1.3s entre appels)
        elapsed = time.time() - last_call
        if elapsed < 1.3:
            time.sleep(1.3 - elapsed)
        last_call = time.time()

        text = find_10k_text(t)
        ctx = extract_segment_context(text or "")
        if not ctx:
            no_ctx += 1
            continue

        company_name = v17.get(t, {}).get("name", t)
        fy_year = "2024"
        prompt = PROMPT.format(ticker=t, company_name=company_name, context=ctx, fy_year=fy_year)
        result = call_anthropic(prompt, api_key)
        if not result:
            no_resp += 1
            continue

        out_path = ENR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        if result.get("revenue_by_segment") is not None:
            existing["revenue_by_segment"] = result["revenue_by_segment"]
        if result.get("revenue_by_geography") is not None:
            existing["revenue_by_geography"] = result["revenue_by_geography"]
        existing["_segments_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1

        if (i + 1) % 25 == 0:
            print(f"  …{i+1}/{len(pending)} (ok={written}, no_ctx={no_ctx}, no_resp={no_resp})", flush=True)

    print(f"\n✅ {written} stés enrichies (segments + geography), {no_ctx} sans 10-K, {no_resp} sans réponse Haiku")


if __name__ == "__main__":
    main()
