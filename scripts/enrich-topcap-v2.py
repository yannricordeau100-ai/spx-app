#!/usr/bin/env python3
"""
enrich-topcap-v2.py — 2e pass ciblée Top 3 actionnaires + droits de vote.

Lit DEF14A locale et extrait la section "Security Ownership of Certain
Beneficial Owners and Management" (= section régulée 5% holders). Le LLM
extrait Top 3 capital + Top 3 voting (si actions à classes différentes).

ÉCRIT en MERGE dans `src/data/v2-pipeline/<ticker>.json` champ
`governance.top_capital` et `governance.top_voting` (sans toucher les
autres champs governance).

RAM safe : 1 proc, sleep 3s entre calls. Yann a déjà eu navigateurs forcés
à fermer = pression mémoire critique.

Usage : python3 scripts/enrich-topcap-v2.py [--limit N]
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
PENDING = Path("/tmp/topcap-pending.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-topcap.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP_BETWEEN_CALLS = 5.0  # RAM safe


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


def find_def14a(ticker: str) -> Optional[str]:
    tu = ticker.upper()
    base = SEC / "cat1-us" / "DEF14A"
    if not base.exists(): return None
    for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:3]:
        for f in year_dir.glob(f"{tu}_*.htm.gz"):
            try:
                with gzip.open(f, "rt", errors="ignore") as g:
                    return _strip_html(g.read())
            except Exception:
                continue
    return None


def extract_ownership_section(text: str, max_chars: int = 12000) -> str:
    """Cherche la section 'Security Ownership of Certain Beneficial Owners'.
    Plus précis que extract_governance_section qui prend la 1ère keyword.
    """
    if not text:
        return ""
    patterns = [
        r"security\s+ownership\s+of\s+certain\s+beneficial\s+owners",
        r"beneficial\s+owners\s+of\s+more\s+than\s+5",
        r"principal\s+stockholders",
        r"principal\s+shareholders",
        r"5\s*%\s+(?:beneficial\s+)?(?:owners|holders|stockholders)",
        r"stock\s+ownership\s+of\s+directors\s+and\s+executive",
    ]
    for pat in patterns:
        m = list(re.finditer(pat, text, re.IGNORECASE))
        if m:
            start = m[0].start()
            return re.sub(r"\s+", " ", text[start:start + max_chars + 2000])[:max_chars]
    return ""


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


TOPCAP_PROMPT = """Tu extrais UNIQUEMENT les Top 3 actionnaires (capital) et Top 3 droits de vote depuis cette section "Security Ownership of Certain Beneficial Owners and Management" du DEF14A de {ticker}.

Retourne UNIQUEMENT un JSON strict :
{{
  "top_capital": [
    {{"name": "Vanguard Group", "type": "institutionnel", "stake_pct": 8.5}},
    {{"name": "BlackRock", "type": "institutionnel", "stake_pct": 7.2}},
    {{"name": "State Street", "type": "institutionnel", "stake_pct": 5.1}}
  ],
  "top_voting": [
    {{"name": "...", "type": "...", "voting_pct": ...}}
  ],
  "voting_structure": "1 phrase ex : 'Une seule classe d'actions ordinaires, 1 vote par action.' OU 'Actions de classe B des fondateurs : 10 votes/action vs 1 vote/action classe A.'"
}}

Règles :
- type ∈ {{institutionnel, fondateur, insider, particulier, fonds souverain, employé}}
- top_capital : 3 entrées minimum (Vanguard/BlackRock/State Street sont les plus fréquents).
- top_voting : seulement si actions à classes multiples avec voting différent (ex Meta, Alphabet, NYT). Sinon vide ou identique à top_capital.
- voting_structure : phrase obligatoire 1 phrase.
- stake_pct en pourcentage (8.5 = 8.5%), pas en chiffres absolus.
- Omettre les champs sans donnée (NE PAS inventer).
- Pas d'em-dash. FR strict.

Extraits :
{context}
"""


def merge_governance(existing_gov: Optional[Dict], new_data: Dict) -> Dict:
    """Merge top_capital / top_voting / voting_structure dans governance existant."""
    if not isinstance(existing_gov, dict):
        existing_gov = {}
    merged = dict(existing_gov)
    for k in ("top_capital", "top_voting"):
        new_v = new_data.get(k) or []
        if isinstance(new_v, list) and len(new_v) >= 1:
            existing_v = merged.get(k) or []
            if not isinstance(existing_v, list) or len(existing_v) < len(new_v):
                merged[k] = new_v
    vs = new_data.get("voting_structure")
    if vs and not merged.get("voting_structure"):
        merged["voting_structure"] = vs
    return merged


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
    log_line(f"START : {len(pending)} stés (sleep {SLEEP_BETWEEN_CALLS}s, 1 proc RAM safe)")

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

        out_path = PIPELINE / f"{tk.lower()}.json"
        if not out_path.exists():
            continue
        try:
            existing = json.loads(out_path.read_text())
        except Exception:
            continue

        text = find_def14a(tk)
        ctx = extract_ownership_section(text or "")
        if not ctx or len(ctx) < 800:
            no_source += 1
            log_line(f"  🚫 {tk} : ownership section introuvable DEF14A")
            continue

        prompt = TOPCAP_PROMPT.format(ticker=tk, context=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
            continue
        tc = result.get("top_capital") or []
        if not isinstance(tc, list) or len(tc) < 1:
            fails += 1
            log_line(f"  ⚠ {tk} : top_capital vide LLM")
            continue

        existing["governance"] = merge_governance(existing.get("governance"), result)
        existing["_topcap_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        top1 = tc[0]
        log_line(f"  ✅ {tk} : top_cap={len(tc)} (top1={top1.get('name', '?')[:20]:20} {top1.get('stake_pct', '?')}%)")

        if (i + 1) % 25 == 0:
            elapsed_min = (time.time() - t_start) / 60
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta_min = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  📊 [{i+1}/{len(pending)}] written={written} no_src={no_source} fails={fails} | rate={rate:.1f}/min ETA={eta_min:.0f}min")

    log_line(f"END : written={written} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
