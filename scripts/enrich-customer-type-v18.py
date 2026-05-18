#!/usr/bin/env python3
"""
enrich-customer-type-v18.py — répartition revenus par TYPE DE CLIENT (Pro / Particulier).

Source : 10-K Item 1 (Business overview) + Item 7 (MD&A) + segments breakdown.
LLM déduit le mix B2B/B2C basé sur la description des clients/produits.

Format ÉCRIT dans `src/data/v2-pipeline-enrich/<ticker>.json` champ
`revenue_by_customer_type` :
{
  "unit": "%",
  "source_date": "YYYY-MM-DD",
  "source": "10-K FY2025 Item 1 — analyse mix client",
  "ai_relevance": "high|medium|low|none",
  "ai_product_examples": ["Falcon IA", "Einstein", ...] (si ai_relevance >= medium),
  "slices": [
    {"label": "Professionnel (B2B)", "value": 88},
    {"label": "Particulier (B2C)", "value": 12}
  ],
  "rationale": "1-2 phrases expliquant la déduction du mix"
}

1 proc, sleep 5s entre calls (RAM safe).

Usage : python3 scripts/enrich-customer-type-v18.py [--limit N]
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
from typing import Optional, Dict, Any

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path("/tmp/customer-type-pending.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-customer-type.log"
LOG.parent.mkdir(parents=True, exist_ok=True)
ENRICH.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP_BETWEEN_CALLS = 5.0


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log_line(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def _strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"</td>", " | ", txt, flags=re.IGNORECASE)
    txt = re.sub(r"</tr>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"&#\d+;|&[a-z]+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt


def find_filing_with_source(ticker: str) -> tuple[Optional[str], Optional[str]]:
    tu = ticker.upper()
    for form, label in [("10K", "10-K"), ("20F", "20-F")]:
        base = SEC / ("cat1-us" if form == "10K" else "cat2-foreign-adr") / form
        if not base.exists(): continue
        for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read()), f"{label} FY{year_dir.name}"
                except Exception:
                    continue
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = sorted(cat3.glob("*.txt"), reverse=True)
            for f in txt_files[:1]:
                return _strip_html(f.read_text(errors="ignore")), f"Annual report {f.stem}"
        except Exception:
            pass
    return None, None


def extract_business_section(text: str, max_chars: int = 12000) -> str:
    """Extrait Item 1 (Business) + Item 7 (MD&A) condensé."""
    if not text:
        return ""
    # Cherche Item 1 (Business)
    item1 = list(re.finditer(r"item\s+1[\.\s\,]*\s*business\b", text, re.IGNORECASE))
    item7 = list(re.finditer(r"item\s+7[\.\s\,]*\s*management.?s?\s+discussion", text, re.IGNORECASE))
    segments_pat = list(re.finditer(r"(?:operating|reportable)\s+segments?", text, re.IGNORECASE))

    chunks = []
    if item1:
        start = item1[0].start()
        chunks.append(text[start:start + 5000])
    if item7:
        start = item7[0].start()
        chunks.append(text[start:start + 4000])
    if segments_pat:
        start = segments_pat[-1].start()
        chunks.append(text[start:start + 3000])

    if not chunks:
        # Fallback : début du document (souvent description business)
        chunks.append(text[:5000])

    combined = " | ".join(chunks)
    return re.sub(r"\s+", " ", combined)[:max_chars]


def call_haiku(prompt: str, api_key: str, retries: int = 2) -> Optional[Dict[str, Any]]:
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            content = resp.get("content", [{}])[0].get("text", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(15)
                continue
            return None
        except Exception:
            time.sleep(3)
    return None


CUSTOMER_TYPE_PROMPT = """Tu analyses le mix client (Professionnel B2B vs Particulier B2C) de {ticker} depuis ces extraits de 10-K / 20-F / rapport annuel.

Retourne UNIQUEMENT un JSON strict :
{{
  "unit": "%",
  "source_date": "YYYY-MM-DD",
  "ai_relevance": "high" | "medium" | "low" | "none",
  "ai_product_examples": ["NVIDIA H100", "AI Enterprise", "..."] (si ai_relevance >= medium, max 4 exemples),
  "slices": [
    {{"label": "Professionnel (B2B)", "value": 88}},
    {{"label": "Particulier (B2C)", "value": 12}}
  ],
  "rationale": "1 ou 2 phrases expliquant le mix. Exemple : 'Data Center 88% des revenus (clients hyperscalers/entreprises), Gaming 10% (consumer), Auto 2% (constructeurs).'"
}}

Règles :
- slices : 2 entrées EXACTEMENT, total = 100
- Si 100% pro → [{{"Professionnel (B2B)", 100}}, {{"Particulier (B2C)", 0}}]
- ai_relevance :
  - "high" : sté vend produits/services IA explicites (NVDA chips IA, PLTR plateforme IA, AI=C3.ai, CRWD Falcon IA, NOW workflow IA, MSFT Copilot)
  - "medium" : IA présente dans le mix mais pas activité principale (GOOGL avec Gemini, AAPL avec Apple Intelligence)
  - "low" : IA mentionnée mais marginale (CRM Einstein parmi nombreuses fonctions)
  - "none" : pas d'IA significative (banques, retail traditionnel, pharma classique)
- ai_product_examples : citer des produits IA spécifiques de la sté (pas génériques)
- rationale en français accessible, pas de jargon
- Pas d'em-dash, FR strict

Extraits :
{context}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ ANTHROPIC_API_KEY introuvable")
        sys.exit(1)

    if not PENDING.exists():
        log_line(f"❌ {PENDING} introuvable")
        sys.exit(1)
    pending = [l.strip() for l in PENDING.read_text().splitlines() if l.strip()]
    if args.limit:
        pending = pending[: args.limit]
    log_line(f"START : {len(pending)} stés customer-type (sleep {SLEEP_BETWEEN_CALLS}s)")

    written = 0
    no_source = 0
    fails = 0
    last_call = 0.0
    t_start = time.time()

    for i, tk in enumerate(pending):
        elapsed = time.time() - last_call
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_call = time.time()

        out_path = ENRICH / f"{tk.lower()}.json"
        existing = {}
        if out_path.exists():
            try: existing = json.loads(out_path.read_text())
            except: existing = {}

        # Skip si déjà fait
        if existing.get("revenue_by_customer_type"):
            continue

        text, source_label = find_filing_with_source(tk)
        ctx = extract_business_section(text or "")
        if not ctx or len(ctx) < 1500:
            no_source += 1
            log_line(f"  🚫 {tk} : source insuffisante")
            continue

        prompt = CUSTOMER_TYPE_PROMPT.format(ticker=tk, context=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
            continue
        slices = result.get("slices") or []
        if len(slices) != 2 or not all(isinstance(s.get("value"), (int, float)) for s in slices):
            fails += 1
            log_line(f"  ⚠ {tk} : slices format invalide")
            continue

        existing["ticker"] = tk.upper()
        existing["revenue_by_customer_type"] = {
            "unit": "%",
            "source_date": result.get("source_date") or "",
            "source": f"{source_label} — analyse mix client",
            "ai_relevance": result.get("ai_relevance", "none"),
            "ai_product_examples": result.get("ai_product_examples") or [],
            "slices": slices,
            "rationale": result.get("rationale", ""),
        }
        existing["_customer_type_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        pro_pct = next((s.get("value") for s in slices if "Pro" in s.get("label", "") or "B2B" in s.get("label", "")), "?")
        ai = result.get("ai_relevance", "none")
        log_line(f"  ✅ {tk} : Pro={pro_pct}% AI={ai}")

        if (i + 1) % 25 == 0:
            elapsed_min = (time.time() - t_start) / 60
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta_min = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  📊 [{i+1}/{len(pending)}] written={written} no_src={no_source} fails={fails} | rate={rate:.1f}/min ETA={eta_min:.0f}min")

    log_line(f"END : written={written} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
