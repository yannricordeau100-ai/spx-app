#!/usr/bin/env python3
"""extend-cat1-hero-history.py — Hero history extraction depuis 10-K cat1-us
pour les stés US flag hero_history_too_short via Haiku Pass 3.

Adapté de extend-stoxx-hero-history.py mais source = cat1-us/10K/<year>/<TICKER>_*.htm.gz
au lieu de cat3-european/<TICKER>/annual-text/*.txt.

1 proc, sleep 4s, ETA ~35 min pour 492 stés.
Coût ~$2.46 Anthropic Haiku.
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT1 = PROJECT_ROOT / "sec-data/cat1-us/10K"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/hero-cat1-pending.txt"))
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-cat1-hero-history.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP_BETWEEN_CALLS = 4.0
MAX_TOKENS = 800
CTX_LEN = 18000

PROMPT = """Tu extrais l'historique annuel d'un KPI spécifique depuis un 10-K SEC d'une société américaine.

Société : {name} (ticker {ticker})
KPI cherché : "{kpi_short}" — {kpi_name}
Unité : {unit}
Période recherchée : 5-8 dernières années disponibles dans le filing.

RÈGLES STRICTES :
1. Cherche dans le texte les valeurs ANNUELLES explicites de ce KPI pour les années récentes.
2. Si tu trouves les valeurs pour 4 années ou plus consécutives → retourne le tableau {{ "history": [v1, v2, ..., vN], "years": [y1, y2, ..., yN] }} (N>=4).
3. Si tu trouves moins de 4 valeurs OU si tu hésites sur l'unité/le périmètre → retourne {{ "history": null, "reason": "explication courte" }}.
4. JAMAIS extrapoler, interpoler ou inventer. Si pas chiffré explicitement → null.
5. Si le KPI est dans une autre unité dans le filing (ex : found in $M but target unit Mds $), convertir et le mentionner dans "reason".

Format de sortie : JSON pur, rien d'autre.

Extrait du 10-K :
---
{ctx}
---"""

HTML_TAG_RE = re.compile(r"<[^>]+>")
HTML_ENTITY_NAMED_RE = re.compile(r"&[a-zA-Z]+;")
HTML_ENTITY_NUM_RE = re.compile(r"&#\d+;")
WHITESPACE_RE = re.compile(r"\s+")


def strip_html(html: str) -> str:
    text = HTML_TAG_RE.sub(" ", html)
    text = HTML_ENTITY_NAMED_RE.sub(" ", text)
    text = HTML_ENTITY_NUM_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def find_last_match(text: str, pattern: str):
    positions = [m.start() for m in re.finditer(pattern, text, re.I)]
    return positions[-1] if positions else None


def extract_key_sections_10k(text: str) -> str:
    """Renvoie Item 7 MD&A + Item 8 Financials du 10-K, en skippant XBRL header.

    Mimics pipeline-llm.py extract_key_sections() approach.
    Budget: 18K chars total (MD&A 12K + Financials 6K).
    """
    if not text or len(text) < 5000:
        return text

    chunks = []
    # Item 7 MD&A (priorité haute, 12K)
    pos = find_last_match(text, r"item\s+7\.?\s+(?:management.{0,30}discussion|md\s*&\s*a)")
    if pos is not None:
        chunks.append(("MDA", pos, 12000))

    # Item 8 Financial Statements (8K)
    pos = find_last_match(text, r"item\s+8\.?\s+(?:financial\s+statements|consolidated\s+financial)")
    if pos is not None:
        chunks.append(("FINANCIALS", pos, 6000))

    if not chunks:
        # Fallback : milieu du doc (souvent MD&A est milieu)
        mid = len(text) // 2
        return text[max(0, mid - 9000): mid + 9000]

    chunks.sort(key=lambda x: x[1])
    parts = []
    for kind, start, budget in chunks:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)


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


def call_haiku(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
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


def find_cat1_source(ticker):
    """Find latest 10-K for ticker, strip HTML, extract Item 7+8 sections."""
    if not SEC_CAT1.exists():
        return None
    candidates = []
    for year_dir in sorted([d for d in SEC_CAT1.iterdir() if d.is_dir()], reverse=True):
        for f in year_dir.glob(f"{ticker}_*.htm.gz"):
            candidates.append(f)
    if not candidates:
        return None
    largest = max(candidates, key=lambda f: f.stat().st_size)
    try:
        with gzip.open(largest, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    text = strip_html(html)
    return extract_key_sections_10k(text)


def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ NO ANTHROPIC_API_KEY")
        sys.exit(1)

    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    log_line(f"START cat1-hero-history: {len(pending)} stés, model={MODEL_ID}")

    updated = 0
    flagged = 0
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
        hero = data.get("hero_kpi") or ""
        if not hero:
            no_source += 1
            continue
        kpis = data.get("kpis", [])
        h_idx = next((i for i, k in enumerate(kpis) if k.get("short") == hero), None)
        if h_idx is None:
            no_source += 1
            continue
        h_kpi = kpis[h_idx]
        if h_kpi.get("_hero_history_unverified"):
            no_source += 1
            continue

        # Find latest hero_history that's good - if >=4 already, skip
        hist_existing = h_kpi.get("history") or []
        if isinstance(hist_existing, list) and len(hist_existing) >= 4:
            no_source += 1
            continue

        txt = find_cat1_source(tk)
        if not txt:
            log_line(f"  🚫 {tk}: pas de cat1 10-K")
            no_source += 1
            continue

        ctx = txt[:CTX_LEN]
        prompt = PROMPT.format(
            name=data.get("name", tk),
            ticker=tk,
            kpi_short=hero,
            kpi_name=h_kpi.get("name_fr") or h_kpi.get("name_en") or hero,
            unit=h_kpi.get("unit") or "",
            ctx=ctx,
        )
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  ❌ {tk}: LLM fail")
            fails += 1
            continue

        hist = result.get("history")
        if isinstance(hist, list) and len(hist) >= 4 and all(isinstance(x, (int, float)) for x in hist):
            kpis[h_idx]["history"] = hist
            years = result.get("years")
            if isinstance(years, list) and len(years) == len(hist):
                kpis[h_idx]["_hero_history_years"] = years
            kpis[h_idx]["_hero_history_source"] = "cat1-us 10-K (Haiku Pass 3)"
            kpis[h_idx]["_hero_history_extracted_at"] = datetime.now(timezone.utc).isoformat()
            kpis[h_idx].pop("_hero_history_unverified", None)
            kpis[h_idx].pop("_hero_history_unverified_reason", None)
            data["kpis"] = kpis
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            updated += 1
            log_line(f"  ✅ {tk}: history {len(hist)} points")
        else:
            reason = result.get("reason", "no history extractable")
            kpis[h_idx]["_hero_history_unverified"] = True
            kpis[h_idx]["_hero_history_unverified_reason"] = reason[:140]
            data["kpis"] = kpis
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            flagged += 1
            log_line(f"  ⚪ {tk}: flagged unverified ({reason[:60]})")

    log_line(
        f"END: updated={updated} flagged={flagged} no_source={no_source} fails={fails}"
    )

if __name__ == "__main__":
    main()
