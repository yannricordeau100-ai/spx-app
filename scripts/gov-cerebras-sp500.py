#!/usr/bin/env python3
"""gov-cerebras-sp500.py — extraction gouvernance SP500 via Cerebras gpt-oss-120b.
Même logique que enrich-governance-v18-pipeline.py mais sans Anthropic API.
Cible : tickers SP500 avec gouvernance rouge dans extraction-status.json + DEF14A local.
"""
import argparse, gzip, json, os, re, ssl, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
SEC = ROOT / "sec-data"
LOG = ROOT / ".conv-state/gov-cerebras-sp500.log"
LOG.parent.mkdir(parents=True, exist_ok=True)
PENDING_FILE = Path("/tmp/gov-cerebras-sp500-pending.txt")

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "gpt-oss-120b"

def load_env():
    env = ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")

def log_line(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def find_def14a(ticker: str) -> str:
    up = ticker.upper()
    candidates = []
    for year_dir in sorted((SEC / "cat1-us/DEF14A").iterdir(), reverse=True):
        if not year_dir.is_dir(): continue
        for f in year_dir.glob(f"{up}_*.htm.gz"):
            candidates.append(f)
    if not candidates:
        return ""
    # Prend le plus récent
    f = candidates[0]
    try:
        with gzip.open(f, "rt", errors="ignore") as g:
            return g.read()
    except Exception:
        return ""

def extract_section(text: str, max_chars: int = 16000) -> str:
    lower = text.lower()
    markers = ["compensation", "executive", "director", "board of directors",
               "voting", "beneficial ownership", "pay ratio", "say on pay"]
    best_pos = len(text)
    for m in markers:
        p = lower.find(m)
        if 0 < p < best_pos:
            best_pos = p
    if best_pos == len(text):
        best_pos = 0
    snippet = text[max(0, best_pos - 500): best_pos + max_chars]
    return re.sub(r"[ \t]{3,}", "  ", re.sub(r"\n{3,}", "\n\n", snippet))

GOV_PROMPT = """Tu es analyste corporate governance français. Extrais la GOUVERNANCE et la RÉMUNÉRATION du DEF14A de {ticker}.

Retourne UNIQUEMENT un JSON strict :
{{
  "agm_date": "YYYY-MM-DD",
  "fiscal_year": 2024,
  "ceo_name": "Prénom Nom",
  "ceo_total_comp_m": 12.5,
  "ceo_pay_ratio": 250,
  "exec_comp_approval_pct": 95.2,
  "board_independence_pct": 80.0,
  "board_size": 12,
  "avg_tenure_years": 6.5,
  "board_women_pct": 33.3,
  "voting_structure": "1 phrase explicative",
  "top_capital": [
    {{"name": "Vanguard Group", "type": "institutionnel", "stake_pct": 8.5}},
    {{"name": "BlackRock", "type": "institutionnel", "stake_pct": 7.2}}
  ],
  "top_voting": []
}}

Règles : type ∈ {{institutionnel, fondateur, insider, particulier, fonds souverain}}.
Omettre les champs absents. Si aucune info : retourner {{}}.

DEF14A :
{context}
"""

def call_cerebras(prompt: str, api_key: str, retries: int = 2) -> Optional[Dict]:
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 2500,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "curl/7.88.1"}
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            msg = resp.get("choices", [{}])[0].get("message", {})
            content = msg.get("content") or msg.get("reasoning", "")
            log_line(f"    DEBUG raw content (500c): {repr(content[:500])}")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            # Try non-greedy first to avoid matching prose before JSON
            m = re.search(r"\{[^{}]*\}", content, re.DOTALL)
            if not m:
                m = re.search(r"\{.*\}", content, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    # Try to find the last { that opens a complete object
                    pass
            try:
                return json.loads(content)
            except Exception:
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(20)
                continue
            log_line(f"    HTTP {e.code}")
            return None
        except Exception as ex:
            time.sleep(3)
    return None

def has_complete_gov(existing: Dict) -> bool:
    g = existing.get("governance")
    if not isinstance(g, dict): return False
    fields = ["ceo_total_comp_m","ceo_pay_ratio","exec_comp_approval_pct",
              "board_independence_pct","board_size","avg_tenure_years",
              "board_women_pct","ceo_name","agm_date","voting_structure"]
    n_metrics = sum(1 for f in fields if g.get(f) not in (None, "", "n/a"))
    n_cap = len(g.get("top_capital") or [])
    return n_metrics >= 5 and n_cap >= 1

def merge_gov(existing_gov: Optional[Dict], new_gov: Dict) -> Dict:
    if not isinstance(existing_gov, dict): existing_gov = {}
    merged = dict(existing_gov)
    for k, v in new_gov.items():
        if v in (None, "", "n/a", []): continue
        if isinstance(v, list) and not v: continue
        if k in ("top_capital", "top_voting"):
            existing_list = merged.get(k) or []
            if isinstance(existing_list, list) and len(existing_list) >= len(v): continue
        merged[k] = v
    return merged

def build_pending() -> list:
    with open(ROOT / "src/data/extraction-status.json") as f:
        d = json.load(f)
    rouge = [t for t, v in d["tickers"].items() if v.get("gouvernance", {}).get("f", 0) == 0]
    def14a_dir = SEC / "cat1-us/DEF14A"
    ok = [t for t in rouge if any(def14a_dir.glob(f"**/{t.upper()}_*.htm.gz"))]
    PENDING_FILE.write_text("\n".join(ok))
    log_line(f"Pending: {len(ok)} tickers SP500 avec DEF14A ({len(rouge)} rouge total)")
    return ok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("CEREBRAS_API_KEY")
    if not api_key:
        log_line("❌ CEREBRAS_API_KEY introuvable")
        sys.exit(1)

    pending = build_pending()
    if args.limit:
        pending = pending[:args.limit]

    log_line(f"START gov-cerebras-sp500 : {len(pending)} tickers | model={MODEL}")
    written = skipped = no_source = fails = 0
    start = time.time()

    for i, tk in enumerate(pending):
        elapsed_min = (time.time() - start) / 60
        last_call = time.time()

        # Load existing
        pipeline_file = PIPELINE / f"{tk.lower()}.json"
        existing = {}
        if pipeline_file.exists():
            try:
                existing = json.loads(pipeline_file.read_text())
            except Exception:
                pass

        if not args.force and has_complete_gov(existing):
            skipped += 1
            continue

        # Load DEF14A
        raw = find_def14a(tk)
        if not raw:
            no_source += 1
            continue

        ctx = extract_section(raw)
        if len(ctx) < 200:
            no_source += 1
            continue

        prompt = GOV_PROMPT.format(ticker=tk, context=ctx)
        result = call_cerebras(prompt, api_key)

        if not result or not isinstance(result, dict) or len(result) < 2:
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
        else:
            merged = merge_gov(existing.get("governance"), result)
            existing["governance"] = merged
            pipeline_file.parent.mkdir(parents=True, exist_ok=True)
            pipeline_file.write_text(json.dumps(existing, ensure_ascii=False, indent=2))
            written += 1

        # Rate limiting
        elapsed = time.time() - last_call
        if elapsed < 5.0:
            time.sleep(5.0 - elapsed)

        if (i + 1) % 10 == 0:
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  [{i+1}/{len(pending)}] written={written} skip={skipped} no_src={no_source} fail={fails} | {rate:.1f}/min ETA={eta:.0f}min")

    log_line(f"END : written={written} skipped={skipped} no_source={no_source} fails={fails}")

if __name__ == "__main__":
    main()
