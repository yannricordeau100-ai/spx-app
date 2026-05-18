#!/usr/bin/env python3
"""
enrich-governance-v18-pipeline.py — extrait Gouvernance & rémunération depuis
DEF14A pour stés Pass 3 validées. Format strict V1 (9 metrics + voting + top 3).

ÉCRIT dans `src/data/v2-pipeline/<ticker>.json` (scope CONV-DATA selon log
SHARED-STATUS 7 mai 17:05).

Source : DEF14A locale dans `sec-data/cat1-us/DEF14A/<year>/<TICKER>_*.htm.gz`.

LLM : Haiku 4.5 (qualité éprouvée, $0.005/sté).

Logique skip : si governance déjà complète (≥5 metrics + ≥1 top_capital), skip.
Sinon, extrait et écrit (override only champs vides).

Usage : python3 scripts/enrich-governance-v18-pipeline.py [--limit N] [--force]
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
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path("/tmp/governance-pending-v18-and-beyond.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-governance.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

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


def find_def14a(ticker: str) -> Optional[str]:
    tu = ticker.upper()
    base = SEC / "cat1-us" / "DEF14A"
    if not base.exists():
        return None
    for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:3]:
        for f in year_dir.glob(f"{tu}_*.htm.gz"):
            try:
                with gzip.open(f, "rt", errors="ignore") as g:
                    return _strip_html(g.read())
            except Exception:
                continue
    return None


def extract_governance_section(text: str, max_chars: int = 14000) -> str:
    if not text:
        return ""
    keywords = [
        r"executive\s+compensation",
        r"summary\s+compensation\s+table",
        r"compensation\s+discussion\s+and\s+analysis",
        r"director\s+compensation",
        r"beneficial\s+owners",
        r"board\s+of\s+directors",
    ]
    matches = []
    for kw in keywords:
        for m in re.finditer(kw, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches:
        return ""
    matches.sort()
    start = matches[0]
    return re.sub(r"\s+", " ", text[start:start + max_chars + 2000])[:max_chars]


def call_haiku(prompt: str, api_key: str, retries: int = 2) -> Optional[Dict[str, Any]]:
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": 2500,
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
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(15)
                continue
            return None
        except Exception:
            time.sleep(3)
    return None


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
  "voting_structure": "1 phrase explicative (ex : 'Une seule classe d'actions ordinaires, 1 vote par action.' ou 'Actions à droits de vote double pour les fondateurs : 10 votes/action.')",
  "top_capital": [
    {{"name": "Vanguard Group", "type": "institutionnel", "stake_pct": 8.5}},
    {{"name": "BlackRock", "type": "institutionnel", "stake_pct": 7.2}},
    {{"name": "...", "type": "fondateur|insider|particulier|fonds souverain", "stake_pct": ...}}
  ],
  "top_voting": [
    {{"name": "...", "type": "...", "voting_pct": ...}}
  ]
}}

Règles strictes :
- type ∈ {{institutionnel, fondateur, insider, particulier, fonds souverain}}
- Si actions à classes multiples avec droits de vote différents : top_voting peut différer de top_capital (ex Meta, Alphabet, NYT). Sinon, top_voting peut être identique à top_capital ou vide.
- Si une classe d'actions unique : voting_structure = "Une seule classe d'actions ordinaires, 1 vote par action."
- top_capital : 3 entrées minimum si dispo (sinon ce que tu as).
- Omettre les champs absents (NE PAS mettre 0 ou "n/a"). Si vraiment aucune info : retourner {{}}.
- Pas d'em-dash dans le texte FR.

Extraits DEF14A :
{context}
"""


def has_complete_gov(existing: Dict[str, Any]) -> bool:
    """True si governance déjà complète (≥5 metrics + ≥1 top_capital)."""
    g = existing.get("governance")
    if not isinstance(g, dict):
        return False
    fields = ["ceo_total_comp_m", "ceo_pay_ratio", "exec_comp_approval_pct",
              "board_independence_pct", "board_size", "avg_tenure_years",
              "board_women_pct", "ceo_name", "agm_date", "voting_structure"]
    n_metrics = sum(1 for f in fields if g.get(f) not in (None, "", "n/a"))
    n_cap = len(g.get("top_capital") or []) if isinstance(g.get("top_capital"), list) else 0
    return n_metrics >= 5 and n_cap >= 1


def merge_governance(existing_gov: Optional[Dict], new_gov: Dict) -> Dict:
    """Merge : new gagne sur champs vides existing, conserve top_capital/top_voting non-vides."""
    if not isinstance(existing_gov, dict):
        existing_gov = {}
    merged = dict(existing_gov)
    for k, v in new_gov.items():
        if v in (None, "", "n/a", []) or (isinstance(v, list) and not v):
            continue
        # Pour top_capital / top_voting : remplacer si le nouveau a plus d'entrées
        if k in ("top_capital", "top_voting"):
            existing_list = merged.get(k) or []
            if isinstance(existing_list, list) and len(existing_list) >= len(v):
                continue
        merged[k] = v
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
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
    log_line(f"START : {len(pending)} stés (top 307 V1.8 d'abord, puis cat1 beyond)")

    written = 0
    skipped = 0
    no_source = 0
    fails = 0
    last_call = 0.0
    t_start = time.time()

    for i, tk in enumerate(pending):
        elapsed = time.time() - last_call
        if elapsed < 1.3:
            time.sleep(1.3 - elapsed)
        last_call = time.time()

        out_path = PIPELINE / f"{tk.lower()}.json"
        if not out_path.exists():
            continue
        try:
            existing = json.loads(out_path.read_text())
        except Exception:
            continue

        if not args.force and has_complete_gov(existing):
            skipped += 1
            continue

        text = find_def14a(tk)
        ctx = extract_governance_section(text or "")
        if not ctx or len(ctx) < 1500:
            no_source += 1
            log_line(f"  🚫 {tk} : section governance introuvable dans DEF14A")
            continue

        prompt = GOV_PROMPT.format(ticker=tk, context=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
            continue
        if not any(result.get(k) for k in ("ceo_name", "board_size", "agm_date", "top_capital")):
            fails += 1
            log_line(f"  ⚠ {tk} : LLM vide")
            continue

        existing["governance"] = merge_governance(existing.get("governance"), result)
        existing["_governance_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        g = existing["governance"]
        ceo = (g.get("ceo_name") or "?")[:24]
        log_line(f"  ✅ {tk} : board={g.get('board_size', '?')} ceo={ceo:24}  top_cap={len(g.get('top_capital') or [])}")

        if (i + 1) % 25 == 0:
            elapsed_min = (time.time() - t_start) / 60
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta_min = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  📊 [{i+1}/{len(pending)}] written={written} skipped={skipped} no_source={no_source} fails={fails} | rate={rate:.1f}/min ETA={eta_min:.0f}min")

    log_line(f"END : written={written} skipped={skipped} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
