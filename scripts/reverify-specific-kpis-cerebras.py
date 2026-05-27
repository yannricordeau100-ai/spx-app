#!/usr/bin/env python3
"""reverify-specific-kpis-cerebras.py — re-vérification KPIs via Cerebras Qwen-3 235B free tier.

Variante du script reverify-specific-kpis-haiku.py mais utilise Cerebras
(gratuit, free tier 3 keys rotation) au lieu d'Anthropic Haiku (payant).

Modèle : qwen-3-235b-a22b-instruct-2507 (Cerebras inference).
Rotation 3 clés via env KEY_INDEX=0|1|2 (CEREBRAS_API_KEY / CEREBRAS2_API_KEY / CEREBRAS3_API_KEY).

Pour chaque fichier src/data/v2-pipeline-specific-kpis/<T>.json :
  1. Lire le 10-K source (cat1-us/10K, cat2-foreign-adr/20F, cat3-european annual-text)
  2. Re-prompt Cerebras avec : KPIs actuels + 10-K extract → vérifier
     value / yoy / history ligne par ligne
  3. Supprimer KPIs invalidés, corriger les autres
  4. Set _verification_needed: false + _verified_at: ISO

Output : src/data/v2-pipeline-specific-kpis/<T>.json (in-place update).

Usage :
    python3 scripts/reverify-specific-kpis-cerebras.py --tickers-file <list> --force
    KEY_INDEX=1 python3 scripts/reverify-specific-kpis-cerebras.py --tickers-file <list> --force
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
CAT1 = ROOT / "sec-data/cat1-us/10K"
CAT2_20F = ROOT / "sec-data/cat2-foreign-adr/20F"
CAT3 = ROOT / "sec-data/cat3-european"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP = 1.0  # 1s entre calls (par clé)
BACKOFF_429 = 8.0  # 8s backoff sur HTTP 429
MAX_CTX = 22000


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


def find_10k_source(ticker: str) -> str | None:
    """Find latest 10-K / 20-F / annual-text for ticker."""
    # US 10-K
    if "." not in ticker:
        for year in sorted(os.listdir(CAT1) if CAT1.exists() else [], reverse=True):
            d = CAT1 / year
            if not d.is_dir():
                continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return strip_html(g.read())
                except Exception:
                    continue
        # FPI 20-F
        for year in sorted(os.listdir(CAT2_20F) if CAT2_20F.exists() else [], reverse=True):
            d = CAT2_20F / year
            if not d.is_dir():
                continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return strip_html(g.read())
                except Exception:
                    continue
    # EU annual-text
    eu_dir = CAT3 / ticker / "annual-text"
    if eu_dir.exists():
        files = sorted(eu_dir.glob("*.txt"), reverse=True)
        if files:
            try:
                return files[0].read_text(errors="ignore")
            except Exception:
                pass
    return None


def find_section(text: str, kpi_shorts: list[str]) -> str:
    """Try to locate sections matching KPI shorts in the source.

    Strategy:
    1. Prefer the LAST occurrence of strong segment/disaggregation keywords
       (TOC entries appear first; the real section appears deeper).
    2. If still nothing, fall back to text[max_len // 3 : max_len // 3 + MAX_CTX]
       (skip the cover/TOC, target the middle/MD&A area).
    """
    strong_keywords = [
        r"net sales by reportable segment",
        r"net sales by category",
        r"revenue by segment",
        r"revenue by reportable segment",
        r"disaggregation of revenue",
        r"segment information",
        r"operating segments",
    ]
    weak_keywords = [
        r"management.{0,30}discussion",
        r"item\s+7\b",
        r"geographic\s+information",
        r"revenues?\s+by",
        r"by\s+segment",
        r"by\s+region",
        r"by\s+product",
        r"external\s+revenues",
    ]

    # Try strong keywords first (anywhere in doc)
    for pat in strong_keywords:
        matches = list(re.finditer(pat, text, re.IGNORECASE))
        if matches:
            m = matches[0]
            start = max(0, m.start() - 1500)
            return text[start:start + MAX_CTX]

    # Fall back: LAST occurrence of weak keywords (skip TOC)
    best_offset = None
    for pat in weak_keywords:
        matches = list(re.finditer(pat, text, re.IGNORECASE))
        if matches:
            cand = matches[-1].start()
            if best_offset is None or cand > best_offset:
                best_offset = cand
    if best_offset is not None:
        start = max(0, best_offset - 1500)
        return text[start:start + MAX_CTX]

    # Last resort: middle of the doc (skip cover/TOC at start)
    mid = len(text) // 3
    return text[mid:mid + MAX_CTX]


PROMPT = """Tu es un vérificateur financier strict. Tu reçois (1) une liste de KPIs extraits d'un sub-agent qui a peut-être INVENTÉ des chiffres, et (2) un extrait du 10-K source. Vérifie chaque KPI ligne par ligne. RÈGLE ABSOLUE ANTI-HALLUCINATION : si tu ne vois pas EXPLICITEMENT le chiffre dans le texte source, status="removed". JAMAIS deviner.

Société : {name} (ticker {ticker})

KPIs prétendument extraits :
{kpis_json}

EXTRAIT 10-K (source) :
{source_excerpt}

POUR CHAQUE KPI dans la liste ci-dessus, retourne un objet JSON :

{{
  "verified_kpis": [
    {{
      "short": "<short du KPI>",
      "status": "verified" | "corrected" | "removed",
      "value": <valeur réelle si verified ou corrected, sinon null>,
      "unit": "<unit si applicable>",
      "yoy": "<yoy si vérifiable>",
      "history": [<valeurs history si vérifiable>],
      "evidence": "<extrait EXACT du 10-K (≤200 chars) si verified/corrected, sinon raison du removed>"
    }}
  ]
}}

RÈGLES STRICTES :
1. "verified" = la value match exactement (à 1% près) ce qui est dans le 10-K. Cite l'extrait dans evidence.
2. "corrected" = trouvé dans le 10-K mais valeur différente. Mets la VRAIE valeur. Cite l'extrait dans evidence.
3. "removed" = KPI non trouvable dans le 10-K (inventé par sub-agent). evidence = raison courte.
4. NE JAMAIS INVENTER. Si pas certain, mets "removed" plutôt que de garder un truc faux.
5. history : si trouvable dans tableau 5-Year Selected Financial Data ou similaire, l'inclure. Sinon mettre [].
6. Pas d'em-dash (—) dans evidence.

RETOURNE UNIQUEMENT le JSON, pas de markdown, pas de texte autour."""


def call_cerebras(prompt: str, api_key: str, retries: int = 3) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 3000,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
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
                time.sleep(BACKOFF_429)
                continue
            return None
        except Exception:
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


def reverify_one(ticker: str, api_key: str, force: bool = False) -> dict:
    p = KPIS_DIR / f"{ticker}.json"
    if not p.exists():
        return {"status": "no_file"}
    try:
        data = json.loads(p.read_text())
    except Exception:
        return {"status": "parse_error"}

    # _verified_at déjà posé et pas --force → skip
    if data.get("_verified_at") and not force:
        return {"status": "skip_already_verified"}

    kpis = data.get("kpis", [])
    if not kpis:
        data["_verified_at"] = datetime.now(timezone.utc).isoformat()
        data["_verifier"] = "cerebras-reverify-v1"
        data["_verify_note"] = "empty kpis, no verification needed"
        if "_verification_needed" in data:
            data["_verification_needed"] = False
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "empty_kpis"}

    source = find_10k_source(ticker)
    if not source:
        data["_verified_at"] = datetime.now(timezone.utc).isoformat()
        data["_verifier"] = "cerebras-reverify-v1"
        data["_verify_note"] = "no source found in sec-data/, kpis kept as-is but flagged"
        data["_verify_status"] = "no_source"
        if "_verification_needed" in data:
            data["_verification_needed"] = False
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "no_source"}

    excerpt = find_section(source, [k.get("short") for k in kpis])

    kpis_minimal = [
        {
            "short": k.get("short"),
            "value": k.get("value"),
            "unit": k.get("unit"),
            "yoy": k.get("yoy"),
            "history": k.get("history", [])[:5] if isinstance(k.get("history"), list) else [],
        }
        for k in kpis
    ]
    prompt = PROMPT.format(
        name=data.get("name", ticker),
        ticker=ticker,
        kpis_json=json.dumps(kpis_minimal, ensure_ascii=False),
        source_excerpt=excerpt,
    )
    result = call_cerebras(prompt, api_key)
    if not result or "verified_kpis" not in result:
        return {"status": "llm_fail"}

    verified_list = result["verified_kpis"]
    verified_by_short = {v.get("short"): v for v in verified_list}

    new_kpis = []
    n_verified = 0
    n_corrected = 0
    n_removed = 0
    evidences = {}
    for orig in kpis:
        sh = orig.get("short")
        v = verified_by_short.get(sh)
        if not v or v.get("status") == "removed":
            n_removed += 1
            continue
        if v.get("status") == "verified":
            n_verified += 1
            patched = dict(orig)
            if v.get("evidence"):
                patched["_verified_evidence"] = (v.get("evidence") or "")[:200]
                evidences[sh] = patched["_verified_evidence"]
            new_kpis.append(patched)
        elif v.get("status") == "corrected":
            n_corrected += 1
            patched = dict(orig)
            if v.get("value") is not None:
                patched["value"] = v["value"]
            if v.get("unit"):
                patched["unit"] = v["unit"]
            if v.get("yoy"):
                patched["yoy"] = v["yoy"]
            if v.get("history") and isinstance(v.get("history"), list) and v.get("history"):
                patched["history"] = v["history"]
            if v.get("evidence"):
                patched["_verified_evidence"] = (v.get("evidence") or "")[:200]
                evidences[sh] = patched["_verified_evidence"]
            new_kpis.append(patched)

    data["kpis"] = new_kpis
    data["_verified_at"] = datetime.now(timezone.utc).isoformat()
    data["_verifier"] = "cerebras-reverify-v1"
    data["_verify_stats"] = {"verified": n_verified, "corrected": n_corrected, "removed": n_removed}
    if "_verification_needed" in data:
        data["_verification_needed"] = False
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return {"status": "ok", "v": n_verified, "c": n_corrected, "r": n_removed}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", type=str)
    ap.add_argument("--tickers", type=str)
    ap.add_argument("--force", action="store_true", help="Ignore _verified_at flag")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    load_env()
    api_key = get_api_key()
    if not api_key:
        print("❌ NO Cerebras key (CEREBRAS_API_KEY / CEREBRAS2_API_KEY / CEREBRAS3_API_KEY)")
        sys.exit(1)
    idx = os.environ.get("KEY_INDEX", "0")
    print(f"Using Cerebras key index {idx}", flush=True)

    tickers = []
    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    elif args.tickers_file:
        tickers = [l.strip() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    else:
        print("--tickers-file or --tickers required")
        sys.exit(1)

    if args.limit > 0:
        tickers = tickers[:args.limit]

    print(f"Tickers à re-vérifier : {len(tickers)}", flush=True)

    stats = {"ok": 0, "no_file": 0, "skip": 0, "no_source": 0, "llm_fail": 0, "empty": 0, "parse_error": 0}
    total_v = 0
    total_c = 0
    total_r = 0
    last_call = 0.0

    for i, tk in enumerate(tickers):
        if i and i % 10 == 0:
            print(f"  [{i}/{len(tickers)}] v={total_v} c={total_c} r={total_r} fails={stats['llm_fail']} no_src={stats['no_source']} skip={stats['skip']}", flush=True)

        elapsed = time.time() - last_call
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)
        last_call = time.time()

        try:
            res = reverify_one(tk, api_key, force=args.force)
        except Exception as e:
            print(f"  {tk}: EXC {e}", flush=True)
            stats["llm_fail"] += 1
            continue

        s = res.get("status", "?")
        if s == "ok":
            stats["ok"] += 1
            total_v += res.get("v", 0)
            total_c += res.get("c", 0)
            total_r += res.get("r", 0)
        elif s == "no_file":
            stats["no_file"] += 1
        elif s == "skip_already_verified":
            stats["skip"] += 1
        elif s == "no_source":
            stats["no_source"] += 1
        elif s == "llm_fail":
            stats["llm_fail"] += 1
        elif s == "empty_kpis":
            stats["empty"] += 1
        elif s == "parse_error":
            stats["parse_error"] += 1

    print(f"\nDONE: verified={total_v} corrected={total_c} removed={total_r} stats={stats}", flush=True)


if __name__ == "__main__":
    main()
