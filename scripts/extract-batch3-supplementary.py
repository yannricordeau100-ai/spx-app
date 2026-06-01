#!/usr/bin/env python3
"""extract-batch3-supplementary.py — extraction KPIs spécifiques supplémentaires batch3.

Pour chaque ticker du batch3, lit 10-K/20-F/annual-text, demande à Cerebras
Qwen-3 235B d'extraire des KPIs SPÉCIFIQUES (non génériques cf
kpi-generic-library.json), AVEC history ≥3 ans, et APPEND au kpis[] du
fichier v2-pipeline-specific-kpis/<TICKER>.json.

Marqueur ajouté : _kpis_supplementary_signed_by="REEXTRACT-29MAY-batch3"
"""
from __future__ import annotations
import argparse
import glob
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

ROOT = Path(__file__).resolve().parent.parent
KPIS_DIR = ROOT / "src/data/v2-pipeline-specific-kpis"
GENERIC_LIB = ROOT / "src/data/kpi-generic-library.json"
CAT1 = ROOT / "sec-data/cat1-us/10K"
CAT2_20F = ROOT / "sec-data/cat2-foreign-adr/20F"
CAT3 = ROOT / "sec-data/cat3-european"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
# Qwen-3-235b plus dispo sur Cerebras free (29 mai 2026). Fallback gpt-oss-120b.
MODEL_ID = os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b")
SLEEP = 6.0
BACKOFF_429 = 30.0
MAX_CTX = 10000  # smaller context = less TPM pressure

MARKER = "REEXTRACT-29MAY-batch3"


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt)
    return txt


def find_source(ticker: str) -> tuple[str, str] | tuple[None, None]:
    """Returns (text, source_label)."""
    # US 10-K (latest year)
    if "." not in ticker and "-" not in ticker:
        if CAT1.exists():
            years = sorted(os.listdir(CAT1), reverse=True)
            for year in years:
                d = CAT1 / year
                if not d.is_dir():
                    continue
                files = list(d.glob(f"{ticker}_*.htm.gz"))
                if files:
                    try:
                        with gzip.open(files[0], "rt", errors="ignore") as g:
                            return strip_html(g.read()), f"10-K {year}"
                    except Exception:
                        continue
        # FPI 20-F
        if CAT2_20F.exists():
            years = sorted(os.listdir(CAT2_20F), reverse=True)
            for year in years:
                d = CAT2_20F / year
                if not d.is_dir():
                    continue
                files = list(d.glob(f"{ticker}_*.htm.gz"))
                if files:
                    try:
                        with gzip.open(files[0], "rt", errors="ignore") as g:
                            return strip_html(g.read()), f"20-F {year}"
                    except Exception:
                        continue
    # EU annual-text
    eu_dir = CAT3 / ticker / "annual-text"
    if eu_dir.exists():
        files = sorted(eu_dir.glob("*.txt"), reverse=True)
        if files:
            try:
                # Take 2 most recent and concatenate for cross-year history
                txts = []
                for f in files[:2]:
                    txts.append(f.read_text(errors="ignore"))
                combined = "\n\n===\n\n".join(txts)
                return combined, f"annual-text ({len(files)} files)"
            except Exception:
                pass
    return None, None


def find_section(text: str) -> str:
    """Slice the text to focus on segment/KPI-rich sections."""
    strong = [
        r"net sales by reportable segment",
        r"revenue by reportable segment",
        r"disaggregation of revenue",
        r"segment information",
        r"operating segments",
        r"net sales by category",
        r"revenue by segment",
        r"by product line",
        r"by business",
        r"key performance indicators",
        r"operating data",
        r"5-year selected financial",
        r"five-year selected",
        r"selected financial data",
    ]
    weak = [
        r"item\s*7\b",
        r"management.{0,30}discussion",
        r"revenues?\s+by",
        r"by\s+segment",
        r"by\s+region",
        r"by\s+product",
        r"geographic\s+information",
        r"chiffre d.affaires",
        r"par segment",
        r"par r.gion",
        r"r.partition",
    ]

    for pat in strong:
        m = list(re.finditer(pat, text, re.IGNORECASE))
        if m:
            start = max(0, m[0].start() - 1200)
            return text[start:start + MAX_CTX]

    best = None
    for pat in weak:
        m = list(re.finditer(pat, text, re.IGNORECASE))
        if m:
            cand = m[-1].start()
            if best is None or cand > best:
                best = cand
    if best is not None:
        start = max(0, best - 1200)
        return text[start:start + MAX_CTX]

    mid = len(text) // 3
    return text[mid:mid + MAX_CTX]


def load_generic_shorts() -> set[str]:
    try:
        data = json.loads(GENERIC_LIB.read_text())
        return {x["short"].lower() for x in data}
    except Exception:
        return set()


PROMPT_TEMPLATE = """Tu es un extracteur financier rigoureux. Extrais 4 à 7 KPI SPÉCIFIQUES (jamais génériques) d'une société à partir de son document annuel.

Ticker : {ticker}
Source : {source}

EXTRAIT du filing :
{excerpt}

KPI GÉNÉRIQUES STRICTEMENT INTERDITS (= ne PAS proposer) :
{generic_list}

OBJECTIF : Au moins 4 KPI SPÉCIFIQUES avec history ≥3 ans (valeurs RÉELLES sourcées dans le texte ci-dessus).
- "Spécifique" = propre à la sté ou son sous-secteur (ex: pour banque = Tier 1 Ratio, Net Interest Margin, Loan Book ; pour pharma = Top Drug Sales ; pour énergie = Production Mboe/d).
- AUCUN générique parmi : Revenue, EBITDA, Op Margin, EPS, FCF, Headcount, R&D, Capex, etc.
- history : 3 valeurs minimum sourcées explicitement dans l'extrait (5 si possible).
- Si moins de 4 KPI vraiment trouvables avec history ≥3 ans dans le texte → renvoie ce que tu trouves.

RETOURNE STRICTEMENT ce JSON :
{{
  "kpis": [
    {{
      "short": "Concise_Snake_Case_Name",
      "name_fr": "Nom français court",
      "name_en": "English short name",
      "value": <number>,
      "unit": "<%, M $, Mds $, M €, Mds €, units, etc>",
      "yoy": "<+X% ou -X% si calculable, sinon null>",
      "history": [<3 à 5 valeurs réelles, du plus récent au plus ancien>],
      "period_type": "annual",
      "description": "<courte description FR, sans em-dash>",
      "signal": "<ce que la valeur signifie, sans em-dash>",
      "quality": "Bon",
      "explanation": "<extrait EXACT du filing ≤250 chars où la valeur apparaît>"
    }}
  ]
}}

RÈGLES STRICTES :
1. JAMAIS inventer une valeur. Si pas explicite dans le texte → ne pas inclure ce KPI.
2. history ≥ 3 valeurs RÉELLES sourcées.
3. Pas d'em-dash (—) dans aucun champ. Utilise ":" ou phrases courtes.
4. Vocabulaire FR strict (pas d'anglicismes).
5. Sortir UNIQUEMENT le JSON (pas de markdown).
"""


def call_cerebras(prompt: str, keys: list[str], retries: int = 4) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 8000,
        "response_format": {"type": "json_object"},
    }).encode()
    for attempt in range(retries + 1):
        api_key = keys[attempt % len(keys)]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "content-type": "application/json",
            "User-Agent": "curl/7.79.1",
        }
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            msg = resp["choices"][0]["message"]
            content = msg.get("content") or ""
            if not content.strip():
                content = msg.get("reasoning") or ""
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{[\s\S]*\}", content)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except json.JSONDecodeError:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = BACKOFF_429 + 2 * attempt
                print(f"  HTTP 429 attempt {attempt+1}/{retries+1}, switching key, sleep {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            print(f"  HTTP {e.code}: {e.reason}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  exc({attempt}): {e}", file=sys.stderr)
            time.sleep(5)
    return None


def get_api_keys() -> list[str]:
    # Prioritise CEREBRAS3 first (least rate-limited at run start 29 May 2026)
    order = os.environ.get("CEREBRAS_KEY_ORDER", "3,1,2")
    name_map = {"1": "CEREBRAS_API_KEY", "2": "CEREBRAS2_API_KEY", "3": "CEREBRAS3_API_KEY"}
    keys = []
    for n in order.split(","):
        n = n.strip()
        env = name_map.get(n)
        if env:
            v = os.environ.get(env)
            if v:
                keys.append(v)
    return keys


def sanitize_kpis(kpis: list, generic_shorts: set[str]) -> list:
    """Drop KPIs that are generic or have history <3, or em-dashes."""
    cleaned = []
    seen = set()
    for k in kpis:
        if not isinstance(k, dict):
            continue
        short = k.get("short")
        if not short or not isinstance(short, str):
            continue
        if short.lower() in generic_shorts:
            continue
        # Also check name_en/name_fr against generic
        name_en = (k.get("name_en") or "").lower()
        name_fr = (k.get("name_fr") or "").lower()
        if any(g in name_en or g in name_fr for g in ("total revenue", "net income", "ebitda margin", "free cash flow", "operating margin", "operating income", "headcount")):
            continue
        hist = k.get("history") or []
        if not isinstance(hist, list) or len(hist) < 3:
            continue
        # Drop em-dashes
        for fld in ("description", "signal", "explanation", "name_fr", "name_en"):
            v = k.get(fld)
            if isinstance(v, str) and "—" in v:
                k[fld] = v.replace("—", ":")
        if short in seen:
            continue
        seen.add(short)
        cleaned.append(k)
    return cleaned


def process_ticker(ticker: str, needed: int, key_idx: int, keys: list[str], force: bool = False) -> str:
    fpath = KPIS_DIR / f"{ticker}.json"
    if not fpath.exists():
        # Create file
        fpath.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "ticker": ticker,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "extracted_by": MARKER,
            "kpis": [],
        }
    else:
        try:
            data = json.loads(fpath.read_text())
        except Exception:
            return "parse_error"

    # Skip if already signed (idempotence)
    if data.get("_kpis_supplementary_signed_by") == MARKER and not force:
        return "skip_signed"

    existing_kpis = data.get("kpis") or []
    existing_shorts = {k.get("short") for k in existing_kpis if isinstance(k, dict)}

    # Load source
    text, source_label = find_source(ticker)
    if not text or len(text) < 5000:
        return "no_source"

    excerpt = find_section(text)
    if len(excerpt) < 1000:
        return "no_section"

    # Build prompt
    generic_shorts = load_generic_shorts()
    generic_list = ", ".join(sorted(generic_shorts))[:1200]
    prompt = PROMPT_TEMPLATE.format(
        ticker=ticker,
        source=source_label,
        excerpt=excerpt[:MAX_CTX],
        generic_list=generic_list,
    )

    # Call LLM (rotation handled internally)
    result = call_cerebras(prompt, keys)
    if not result:
        return "llm_fail"

    new_kpis_raw = result.get("kpis") or []
    new_kpis = sanitize_kpis(new_kpis_raw, generic_shorts)
    if not new_kpis:
        return "no_valid_kpis"

    # Merge: skip duplicates on short
    appended = 0
    for k in new_kpis:
        if k["short"] not in existing_shorts:
            existing_kpis.append(k)
            existing_shorts.add(k["short"])
            appended += 1

    data["kpis"] = existing_kpis
    data["_kpis_supplementary_signed_by"] = MARKER
    data["_kpis_supplementary_at"] = datetime.now(timezone.utc).isoformat()
    data["_kpis_supplementary_source"] = source_label
    data["_kpis_supplementary_appended"] = appended

    fpath.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return f"ok+{appended}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", default="/tmp/reextract-batches-v2/batch3.json")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    keys = get_api_keys()
    if not keys:
        print("No CEREBRAS keys.", file=sys.stderr)
        sys.exit(1)
    print(f"Loaded {len(keys)} Cerebras key(s).")

    batch = json.loads(Path(args.batch).read_text())
    if args.limit:
        batch = batch[args.start:args.start + args.limit]
    elif args.start:
        batch = batch[args.start:]

    print(f"Processing {len(batch)} tickers.")
    results = {}
    for i, entry in enumerate(batch):
        ticker = entry["ticker"]
        needed = entry.get("needed", 4)
        print(f"[{i+1}/{len(batch)}] {ticker:12} (needed {needed}) ", end="", flush=True)
        status = process_ticker(ticker, needed, i, keys, force=args.force)
        results[ticker] = status
        print(f"-> {status}")
        if not status.startswith("skip"):
            time.sleep(SLEEP)
    # Summary
    print("\n=== SUMMARY ===")
    from collections import Counter
    c = Counter()
    for s in results.values():
        kind = s.split("+")[0] if s.startswith("ok") else s
        c[kind] += 1
    for k, v in c.most_common():
        print(f"  {k}: {v}")
    # Dump results
    out_path = Path("/tmp") / "batch3-extract-results.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults dumped: {out_path}")


if __name__ == "__main__":
    main()
