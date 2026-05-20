#!/usr/bin/env python3
"""reverify-specific-kpis-haiku.py — re-vérification KPIs sub-agents inventés.

CONV-CONCEPTS leader T2 (19 mai 19h35) : 249 fichiers
src/data/v2-pipeline-specific-kpis/<T>.json sont tagués _verification_needed:true
parce que les sub-agents Claude ont admis INVENTER les chiffres au lieu de
lire les 10-K.

Pour chaque fichier :
  1. Lire le 10-K source (cat1-us/10K/<year>/<TICKER>_*.htm.gz)
  2. Re-prompt Haiku 4.5 avec : KPIs actuels + 10-K extract → vérifier
     value / yoy / history ligne par ligne
  3. Supprimer KPIs invalidés, corriger les autres
  4. Set _verification_needed: false + _verified_at: ISO

Output : src/data/v2-pipeline-specific-kpis/<T>.json (in-place update).

Coût : ~$0.008/sté × 249 = ~$2 total. RAM safe (1 proc).

Yann 19 mai 2026 — phase 2 Cat 5 / mission 4.

Usage :
    python3 scripts/reverify-specific-kpis-haiku.py --tickers-file <list>
    python3 scripts/reverify-specific-kpis-haiku.py --all  # tous _verification_needed
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

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP = 3.0
MAX_CTX = 22000


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists(): return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
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
            if not d.is_dir(): continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return strip_html(g.read())
                except Exception:
                    continue
        # FPI 20-F
        for year in sorted(os.listdir(CAT2_20F) if CAT2_20F.exists() else [], reverse=True):
            d = CAT2_20F / year
            if not d.is_dir(): continue
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
    """Try to locate sections matching KPI shorts in the source."""
    # Look for segments / disaggregation / item 7 MD&A
    keywords = (
        r"item\s+7\b|management.{0,30}discussion|disaggregation|segment\s+information|"
        r"geographic\s+information|operating\s+segments|revenues?\s+by|"
        r"by\s+segment|by\s+region|by\s+product|external\s+revenues"
    )
    m = re.search(keywords, text, re.IGNORECASE)
    if m:
        start = max(0, m.start() - 1000)
        return text[start:start + MAX_CTX]
    return text[:MAX_CTX]


PROMPT = """Tu es un vérificateur financier. Tu reçois (1) une liste de KPIs extraits d'un sub-agent qui a peut-être INVENTÉ des chiffres, et (2) un extrait du 10-K source. Vérifie chaque KPI ligne par ligne.

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
      "reason": "<courte explication FR ; cite le passage 10-K si verified/corrected>"
    }},
    ...
  ]
}}

RÈGLES STRICTES :
1. "verified" = la value match exactement (à 1% près) ce qui est dans le 10-K.
2. "corrected" = trouvé dans le 10-K mais valeur différente. Mets la VRAIE valeur.
3. "removed" = KPI non trouvable dans le 10-K, donc inventé. La sortie sera supprimée.
4. NE JAMAIS INVENTER. Si pas certain, mets "removed" plutôt que de garder un truc faux.
5. history : si trouvable dans tableau 5-Year Selected Financial Data ou similaire, l'inclure. Sinon mettre [].
6. Pas d'em-dash (—) dans reason.

RETOURNE UNIQUEMENT le JSON, pas de markdown, pas de texte autour."""


def call_haiku(prompt: str, api_key: str, retries: int = 2):
    body = {
        "model": MODEL_ID,
        "max_tokens": 3000,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
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


def reverify_one(ticker: str, api_key: str, force: bool = False) -> dict:
    p = KPIS_DIR / f"{ticker}.json"
    if not p.exists():
        return {"status": "no_file"}
    data = json.loads(p.read_text())
    if not data.get("_verification_needed") and not force:
        return {"status": "skip_already_verified"}

    kpis = data.get("kpis", [])
    if not kpis:
        # Empty kpis : just clear flag
        data["_verification_needed"] = False
        data["_verified_at"] = datetime.now(timezone.utc).isoformat()
        data["_verifier"] = "haiku-reverify-v1"
        data["_verify_note"] = "empty kpis, no verification needed"
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "empty_kpis"}

    source = find_10k_source(ticker)
    if not source:
        # No source : mark as cannot_verify
        data["_verification_needed"] = False
        data["_verified_at"] = datetime.now(timezone.utc).isoformat()
        data["_verifier"] = "haiku-reverify-v1"
        data["_verify_note"] = "no source found in sec-data/, kpis kept as-is but flagged"
        data["_verify_status"] = "no_source"
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "no_source"}

    excerpt = find_section(source, [k.get("short") for k in kpis])

    kpis_minimal = [
        {"short": k.get("short"), "value": k.get("value"), "unit": k.get("unit"),
         "yoy": k.get("yoy"), "history": k.get("history", [])[:5]}
        for k in kpis
    ]
    prompt = PROMPT.format(
        name=data.get("name", ticker),
        ticker=ticker,
        kpis_json=json.dumps(kpis_minimal, ensure_ascii=False),
        source_excerpt=excerpt,
    )
    result = call_haiku(prompt, api_key)
    if not result or "verified_kpis" not in result:
        return {"status": "llm_fail"}

    verified_list = result["verified_kpis"]
    verified_by_short = {v.get("short"): v for v in verified_list}

    new_kpis = []
    n_verified = 0; n_corrected = 0; n_removed = 0
    for orig in kpis:
        sh = orig.get("short")
        v = verified_by_short.get(sh)
        if not v or v.get("status") == "removed":
            n_removed += 1
            continue
        if v.get("status") == "verified":
            n_verified += 1
            new_kpis.append(orig)
        elif v.get("status") == "corrected":
            n_corrected += 1
            patched = dict(orig)
            if v.get("value") is not None: patched["value"] = v["value"]
            if v.get("unit"): patched["unit"] = v["unit"]
            if v.get("yoy"): patched["yoy"] = v["yoy"]
            if v.get("history"): patched["history"] = v["history"]
            patched["_verify_reason"] = (v.get("reason") or "")[:200]
            new_kpis.append(patched)

    data["kpis"] = new_kpis
    data["_verification_needed"] = False
    data["_verified_at"] = datetime.now(timezone.utc).isoformat()
    data["_verifier"] = "haiku-reverify-v1"
    data["_verify_stats"] = {"verified": n_verified, "corrected": n_corrected, "removed": n_removed}
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return {"status": "ok", "v": n_verified, "c": n_corrected, "r": n_removed}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", type=str)
    ap.add_argument("--tickers", type=str)
    ap.add_argument("--force", action="store_true", help="Ignore _verification_needed flag")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ NO ANTHROPIC_API_KEY"); sys.exit(1)

    tickers = []
    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",")]
    elif args.tickers_file:
        tickers = [l.strip() for l in Path(args.tickers_file).read_text().splitlines() if l.strip()]
    elif args.all:
        for p in glob.glob(str(KPIS_DIR / "*.json")):
            try:
                d = json.load(open(p))
                if d.get("_verification_needed"):
                    tickers.append(d.get("ticker", os.path.basename(p).replace(".json", "")))
            except: pass
        tickers = sorted(set(tickers))
    else:
        print("--tickers-file, --tickers or --all required"); sys.exit(1)

    if args.limit > 0:
        tickers = tickers[:args.limit]

    print(f"Tickers à re-vérifier : {len(tickers)}", flush=True)

    stats = {"ok": 0, "no_file": 0, "skip": 0, "no_source": 0, "llm_fail": 0, "empty": 0}
    total_v = 0; total_c = 0; total_r = 0
    last_call = 0.0

    for i, tk in enumerate(tickers):
        if i and i % 10 == 0:
            print(f"  [{i}/{len(tickers)}] v={total_v} c={total_c} r={total_r} fails={stats['llm_fail']} no_src={stats['no_source']}", flush=True)

        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
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
            total_v += res.get("v", 0); total_c += res.get("c", 0); total_r += res.get("r", 0)
        elif s == "no_file": stats["no_file"] += 1
        elif s == "skip_already_verified": stats["skip"] += 1
        elif s == "no_source": stats["no_source"] += 1
        elif s == "llm_fail": stats["llm_fail"] += 1
        elif s == "empty_kpis": stats["empty"] += 1

    print(f"DONE: verified={total_v} corrected={total_c} removed={total_r} stats={stats}", flush=True)


if __name__ == "__main__":
    main()
