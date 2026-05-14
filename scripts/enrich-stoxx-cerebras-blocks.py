#!/usr/bin/env python3
"""enrich-stoxx-cerebras-blocks.py — extrait segment + geography + customer_type
+ company_description en 1 appel Cerebras free pour chaque sté Stoxx 600.

Source : sec-data/cat3-european/<TICKER>/annual-text/<YEAR>.txt (le plus gros).
LLM : Cerebras Qwen-3 235B free tier (3 clés en rotation).

1 proc, sleep 3s entre calls, ETA ~30 min pour 375 stés (~5s/call).

Output : update v2-pipeline/<ticker>.json (additif).
"""
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT3 = PROJECT_ROOT / "sec-data/cat3-european"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/stoxx-no_segment.txt"))
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-stoxx-blocks.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 3.0
CTX_LEN = 22000  # chars

PROMPT = """Tu extrais 4 blocs de données depuis le rapport annuel d'une société européenne.

Société : {name} (ticker {ticker})

Format de sortie JSON STRICT (rien d'autre, rien avant ni après) :

{{
  "revenue_by_segment": {{
    "label": "Répartition du chiffre d'affaires par segment opérationnel",
    "slices": [
      {{"name": "Nom du segment", "value": 12.5, "unit": "Mds €", "pct": 35.0}},
      ...
    ]
  }},
  "revenue_by_geography": {{
    "label": "Répartition du chiffre d'affaires par zone géographique",
    "slices": [
      {{"name": "Europe", "value": 8.4, "unit": "Mds €", "pct": 47.0}},
      ...
    ]
  }},
  "customer_type": {{
    "label": "Type de clientèle",
    "breakdown": [
      {{"name": "B2B (entreprises)", "pct": 80}},
      {{"name": "B2C (particuliers)", "pct": 20}}
    ]
  }},
  "company_description": "1-2 phrases en français, max 280 caractères, décrit clairement l'activité principale et le positionnement"
}}

RÈGLES STRICTES :
1. Si une section n'est PAS extractible (pas dans le texte) → renvoie null pour ce bloc (ex: "revenue_by_segment": null)
2. JAMAIS inventer. Valeurs uniquement si chiffrées explicitement dans le texte.
3. revenue_by_segment et revenue_by_geography doivent avoir 2+ slices (sinon null).
4. customer_type peut être B2B/B2C/Mixte/Government/Wholesale/Retail.
5. company_description en FRANÇAIS, jamais en anglais.

Extrait du rapport annuel :
---
{ctx}
---"""


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


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


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 2500,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
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
                time.sleep(15)
                continue
            log_line(f"  HTTP {e.code}")
            return None
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}")
            time.sleep(3)
    return None


def find_source_text(ticker):
    src_dir = SEC_CAT3 / ticker / "annual-text"
    if not src_dir.exists():
        return None
    txts = sorted(src_dir.glob("*.txt"), key=lambda x: x.stat().st_size, reverse=True)
    if not txts:
        return None
    largest = txts[0]
    if largest.stat().st_size < 50000:
        return None
    try:
        return largest.read_text(encoding="utf-8", errors="ignore")[:CTX_LEN * 2]
    except Exception:
        return None


def get_api_key():
    # Rotation via env var KEY_INDEX (set par wrapper)
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


def main():
    load_env()
    api_key = get_api_key()
    if not api_key:
        log_line("❌ NO CEREBRAS_API_KEY")
        sys.exit(1)

    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    log_line(f"START stoxx-blocks (key idx={os.environ.get('KEY_INDEX', '0')}): {len(pending)} stés")

    updated_seg = 0
    updated_geo = 0
    updated_cust = 0
    updated_desc = 0
    no_source = 0
    fails = 0
    last_call = 0.0

    for tk in pending:
        elapsed = time.time() - last_call
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_call = time.time()

        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            no_source += 1
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            no_source += 1
            continue

        txt = find_source_text(tk)
        if not txt:
            no_source += 1
            continue

        ctx = txt[:CTX_LEN]
        prompt = PROMPT.format(
            name=data.get("name", tk),
            ticker=tk,
            ctx=ctx,
        )
        result = call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  ❌ {tk}: LLM fail")
            fails += 1
            continue

        changed = False
        seg = result.get("revenue_by_segment")
        if seg and isinstance(seg, dict) and isinstance(seg.get("slices"), list) and len(seg["slices"]) >= 2:
            if not data.get("revenue_by_segment", {}).get("slices"):
                data["revenue_by_segment"] = seg
                updated_seg += 1
                changed = True

        geo = result.get("revenue_by_geography")
        if geo and isinstance(geo, dict) and isinstance(geo.get("slices"), list) and len(geo["slices"]) >= 2:
            if not data.get("revenue_by_geography", {}).get("slices"):
                data["revenue_by_geography"] = geo
                updated_geo += 1
                changed = True

        cust = result.get("customer_type")
        if cust and isinstance(cust, dict):
            if not data.get("customer_type"):
                data["customer_type"] = cust
                updated_cust += 1
                changed = True

        desc = result.get("company_description")
        if desc and isinstance(desc, str) and len(desc) > 40:
            if not data.get("company_description"):
                data["company_description"] = desc[:1200]
                updated_desc += 1
                changed = True

        if changed:
            data["_stoxx_blocks_extracted_at"] = datetime.now(timezone.utc).isoformat()
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            log_line(f"  ✅ {tk}: seg={bool(seg)} geo={bool(geo)} cust={bool(cust)} desc={bool(desc)}")
        else:
            log_line(f"  ⚪ {tk}: rien d'extractible")

    log_line(
        f"END: seg={updated_seg} geo={updated_geo} cust={updated_cust} desc={updated_desc} no_source={no_source} fails={fails}"
    )


if __name__ == "__main__":
    main()
