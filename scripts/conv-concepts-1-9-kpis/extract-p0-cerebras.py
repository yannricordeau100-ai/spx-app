#!/usr/bin/env python3
"""
CONV-CONCEPTS — Extension KPIs spécifiques P0 (MC>100B, KPI spec <8)
====================================================================

Pour chaque sté P0 listée dans `p0-targets.json` :
  1. Lit la source (10-K / 20-F / cat3-european annual-text)
  2. Appelle Cerebras Qwen-3 235B (free tier, 3 keys rotation)
  3. Extrait des KPIs spécifiques (skip Revenue/EBITDA/Net Income/EPS générique)
  4. Merge dans src/data/v2-pipeline-specific-kpis/<TICKER>.json (NE PAS ÉCRASER)

Cible : remonter à 8+ KPIs spec par sté.
Multi-procs : KEY_INDEX 0/1/2 pour paralléliser sur 3 clés Cerebras.
"""
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

ROOT = Path("/Users/yann/spx-app")
DATA = ROOT / "src" / "data"
SPEC_DIR = DATA / "v2-pipeline-specific-kpis"
LOG = ROOT / f".conv-state/CONV-CONCEPTS-p0-kpis-{os.environ.get('KEY_INDEX','0')}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP = 4.5
CTX_LEN = 22000

HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&#\d+;")
HTML_ENT_D = re.compile(r"&[a-zA-Z]+;")
WS = re.compile(r"\s+")


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


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def strip_html(html):
    text = HTML_TAG.sub(" ", html)
    text = HTML_ENT_N.sub(" ", text)
    text = HTML_ENT_D.sub(" ", text)
    return WS.sub(" ", text).strip()


def find_section(text):
    """Extract Item 7 MD&A + Item 8 Financial Statements + segments."""
    def last_pos(pat):
        positions = [m.start() for m in re.finditer(pat, text, re.I)]
        return positions[-1] if positions else None

    chunks = []
    pos = last_pos(r"item\s+7\.?\s+management.{0,30}discussion")
    if pos:
        chunks.append(("MDA", pos, 10000))
    pos = last_pos(r"item\s+8\.?\s+financial\s+statements")
    if pos:
        chunks.append(("FIN", pos, 5000))
    pos = last_pos(r"(?:operating\s+segments?|reportable\s+segments?|segment\s+(?:information|results))")
    if pos:
        chunks.append(("SEG", pos, 4000))
    pos = last_pos(r"(?:item\s+1\.?\s+business|business\s+overview|our\s+business)")
    if pos:
        chunks.append(("BUS", pos, 4000))

    if not chunks:
        # fallback : middle of doc
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]

    chunks.sort(key=lambda x: x[1])
    parts = []
    seen = set()
    for kind, start, budget in chunks:
        if kind in seen:
            continue
        seen.add(kind)
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


PROMPT = """Tu extrais les indicateurs clés (KPIs) SPÉCIFIQUES à une société depuis un extrait de son rapport annuel.

Société : {name} (ticker {ticker})

OBJECTIF : extraire 8 à 12 KPIs **SPÉCIFIQUES au business model** de cette société.

INTERDIT (génériques bannis) :
- Revenue / Total Revenue / Net Sales (global)
- Net Income / Earnings / EPS
- EBITDA / Operating Income (sauf si margin spécifique segment)
- Free Cash Flow / Operating Cash Flow (sauf si décomposé)
- R&D total / Capex total

REQUIS (KPIs spécifiques) :
- Revenu par segment business identifié (ex pour AAPL : Services, iPhone, Mac, Wearables ; pour META : Family of Apps Revenue, Reality Labs Revenue)
- Métriques opérationnelles uniques (ex DAU/MAU, ARPU, subscribers, gross merchandise volume, capacity, throughput, backlog, bookings)
- KPIs sectoriels propres (ex pour pharma : top drug sales, R&D pipeline count ; pour banques : NIM, CET1, RoTE ; pour énergie : production volume, reserves)
- Marges par segment si disclosed

Format JSON STRICT (aucun texte avant/après) :

{{
  "kpis": [
    {{
      "short": "Services Revenue",
      "name_fr": "Revenu Services",
      "name_en": "Services Revenue",
      "value": 96.2,
      "unit": "Mds $",
      "yoy": "+13%",
      "history": [53.8, 68.4, 78.1, 85.2, 96.2],
      "period_type": "year",
      "description_fr": "Revenu segment services (App Store, AppleCare, iCloud, Music, TV+, Pay). Pilier marges, croissance double-digit.",
      "description_en": "Services revenue segment (App Store, AppleCare, iCloud, Music, TV+, Pay). Key margin lever.",
      "signal": "Croissance soutenue",
      "story_category": "Revenue mix",
      "is_specific": true,
      "source_filing": "10-K FY{year}"
    }}
  ]
}}

Règles :
- TOUTES les valeurs DOIVENT être chiffrées et présentes dans l'extrait (pas d'invention)
- `value` = dernière valeur connue (la plus récente, généralement FY{year})
- `history` = 4-5 valeurs annuelles consécutives si extrait le permet, sinon SKIP le history (renvoie history: [])
- `unit` en FR : "Mds $", "M $", "%", "Mds €", etc.
- `yoy` calculé depuis history si possible, format "+12%" ou "-3.5%"
- 8 KPIs minimum, 12 maximum
- Pas d'em-dash (—) dans les descriptions

Extrait du rapport :
---
{ctx}
---

Retourne UNIQUEMENT le JSON, rien d'autre."""


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 4500,
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
            body_txt = ""
            try:
                body_txt = e.read().decode()[:200]
            except Exception:
                pass
            if e.code == 429 and attempt < retries:
                log_line(f"  429 retry in 25s")
                time.sleep(25)
                continue
            log_line(f"  HTTP {e.code} {body_txt[:80]}")
            return None
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {str(ex)[:80]}")
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


def read_source(cat, path):
    if not path:
        return None
    try:
        if path.endswith(".gz"):
            with gzip.open(path, "rt", errors="ignore") as g:
                return g.read()
        else:
            return Path(path).read_text(errors="ignore")
    except Exception as e:
        log_line(f"  read_source fail: {e}")
        return None


def merge_into_specific(ticker, new_kpis, source_filing, name):
    spec_path = SPEC_DIR / f"{ticker}.json"
    if spec_path.exists():
        try:
            doc = json.loads(spec_path.read_text())
        except Exception:
            doc = {}
    else:
        doc = {}

    doc.setdefault("ticker", ticker)
    doc["last_extended_at"] = datetime.now(timezone.utc).isoformat()
    doc["last_extended_by"] = "CONV-CONCEPTS p0-kpis-cerebras"
    doc.setdefault("kpis", [])
    doc.setdefault("kpis_story", [])

    existing_shorts = {(k.get("short") or "").lower().strip() for k in doc["kpis"]}
    existing_shorts |= {(k.get("short") or "").lower().strip() for k in doc.get("kpis_story", [])}

    added = 0
    for k in new_kpis:
        short = (k.get("short") or "").lower().strip()
        if not short:
            continue
        if short in existing_shorts:
            continue
        # tag origin
        k["_extracted_by"] = "cerebras-qwen-3-235b"
        k["_extracted_at"] = datetime.now(timezone.utc).isoformat()
        if source_filing:
            k.setdefault("source_filing", source_filing)
        doc["kpis"].append(k)
        existing_shorts.add(short)
        added += 1

    if added:
        spec_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
    return added


def main():
    load_env()
    api_key = get_api_key()
    if not api_key:
        log_line("ERR: no Cerebras key")
        sys.exit(1)

    targets_path = Path(__file__).parent / "p0-targets.json"
    targets = json.loads(targets_path.read_text())

    key_idx = int(os.environ.get("KEY_INDEX", "0"))
    n_keys = int(os.environ.get("N_KEYS", "3"))
    # Round-robin shard
    my_targets = [t for i, t in enumerate(targets) if i % n_keys == key_idx]

    log_line(f"START p0-kpis KEY_INDEX={key_idx} N={len(my_targets)}/{len(targets)}")

    pubs_meta = json.loads((DATA / "v1-9-publishable-details.json").read_text())
    name_by_t = {}
    for scope, arr in pubs_meta["scopes"].items():
        for e in arr:
            name_by_t.setdefault(e["ticker"], e.get("name") or e["ticker"])

    ok = fail = skip = 0
    last_call = 0.0
    for i, t in enumerate(my_targets):
        ticker = t["ticker"]
        current = t["current_spec"]
        if current >= 8:
            log_line(f"[{i+1}/{len(my_targets)}] {ticker} already >=8 ({current}), skip")
            skip += 1
            continue

        src_path = t.get("src")
        if not src_path:
            log_line(f"[{i+1}/{len(my_targets)}] {ticker} no source, skip")
            skip += 1
            continue

        elapsed = time.time() - last_call
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)
        last_call = time.time()

        log_line(f"[{i+1}/{len(my_targets)}] {ticker} mc={t['mc_b']}B spec={current}/8 cat={t['cat']}")

        raw = read_source(t["cat"], src_path)
        if not raw:
            fail += 1
            continue

        if src_path.endswith(".gz") or "<" in raw[:200]:
            text = strip_html(raw)
        else:
            text = raw

        ctx = find_section(text)
        if len(ctx) < 1000:
            log_line(f"  ctx too short ({len(ctx)}), skip")
            fail += 1
            continue

        year_match = re.search(r"_(\d{4})-", src_path)
        year = year_match.group(1) if year_match else "2024"
        name = name_by_t.get(ticker, ticker)

        prompt = PROMPT.format(name=name, ticker=ticker, ctx=ctx, year=year)
        result = call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  LLM null/invalid")
            fail += 1
            continue

        kpis = result.get("kpis") or []
        if not isinstance(kpis, list) or len(kpis) < 3:
            log_line(f"  too few KPIs ({len(kpis) if isinstance(kpis,list) else 'NaN'})")
            fail += 1
            continue

        source_filing = f"{t['cat']} {year}"
        added = merge_into_specific(ticker, kpis, source_filing, name)
        log_line(f"  +{added} KPIs (extracted {len(kpis)}, merged {added})")
        ok += 1

    log_line(f"END ok={ok} fail={fail} skip={skip}")


if __name__ == "__main__":
    main()
