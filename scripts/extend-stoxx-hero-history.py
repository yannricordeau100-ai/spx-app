#!/usr/bin/env python3
"""extend-stoxx-hero-history.py — Étend hero_history pour les stés EU
(Stoxx 600 hors top 307) avec hero_kpi mais history <4 points.

Source : sec-data/cat3-european/<TICKER>/annual-text/<YEAR>.txt (le plus gros).
LLM : Anthropic Haiku 4.5 (Pass 3 exception autorisée par Yann pendant Lourd).
Prompt strict : "si la valeur n'est pas chiffrée explicitement dans le texte
pour chacune des années, retourner null. JAMAIS extrapoler ni interpoler."

1 proc, sleep 4s, ETA ~12 min pour 148 stés.

Update v2-pipeline/<ticker>.json :
- Si Haiku retourne array valide >= 4 points → update history
- Si Haiku retourne null/insuffisant → flag _hero_history_unverified:true
  (history reste inchangée, mais on évite de re-tenter à chaque run)
"""
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
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/stoxx-hero-history-pending.txt"))
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-stoxx-hero-history.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP_BETWEEN_CALLS = 4.0
MAX_TOKENS = 800
CTX_LEN = 18000  # chars from filing text

PROMPT = """Tu extrais l'historique annuel d'un KPI spécifique depuis le rapport annuel d'une société européenne.

Société : {name} (ticker {ticker})
KPI cherché : "{kpi_short}" — {kpi_name}
Unité : {unit}
Période recherchée : 5-8 dernières années disponibles dans le filing.

RÈGLES STRICTES :
1. Cherche dans le texte les valeurs ANNUELLES explicites de ce KPI pour les années récentes.
2. Si tu trouves les valeurs pour 4 années ou plus consécutives → retourne le tableau {{ "history": [v1, v2, ..., vN], "years": [y1, y2, ..., yN] }} (N>=4).
3. Si tu trouves moins de 4 valeurs OU si tu hésites sur l'unité/le périmètre → retourne {{ "history": null, "reason": "explication courte" }}.
4. JAMAIS extrapoler, interpoler ou inventer. Si pas chiffré explicitement → null.
5. Si le KPI est exprimé dans une autre unité dans le filing (ex : trouvé en € millions alors qu'unité cible = € milliards), convertir et le mentionner dans "reason".

Format de sortie : JSON pur, rien d'autre.

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
            log_line(f"  HTTP {e.code} after {attempt+1} tries")
            return None
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__} after {attempt+1} tries")
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
        return largest.read_text(encoding="utf-8", errors="ignore")[:CTX_LEN * 3]
    except Exception:
        return None

def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ NO ANTHROPIC_API_KEY")
        sys.exit(1)

    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    log_line(f"START stoxx-hero-history: {len(pending)} stés, model={MODEL_ID}")

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

        pipeline_f = PIPELINE / f"{tk.lower()}.json"
        if not pipeline_f.exists():
            no_source += 1
            continue
        try:
            data = json.loads(pipeline_f.read_text())
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
        # Skip if already flagged unverified (don't retry)
        if h_kpi.get("_hero_history_unverified"):
            no_source += 1
            continue

        txt = find_source_text(tk)
        if not txt:
            log_line(f"  🚫 {tk}: pas de source cat3 >50KB")
            no_source += 1
            continue

        # Take a useful chunk: prefer end of doc where financial summaries are
        # often located, but include start for context.
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
            kpis[h_idx]["_hero_history_source"] = "cat3-european annual-text (Haiku Pass 3)"
            kpis[h_idx]["_hero_history_extracted_at"] = datetime.now(timezone.utc).isoformat()
            data["kpis"] = kpis
            pipeline_f.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            updated += 1
            log_line(f"  ✅ {tk}: history {len(hist)} points")
        else:
            reason = result.get("reason", "no history extractable")
            kpis[h_idx]["_hero_history_unverified"] = True
            kpis[h_idx]["_hero_history_unverified_reason"] = reason[:140]
            data["kpis"] = kpis
            pipeline_f.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            flagged += 1
            log_line(f"  ⚪ {tk}: flagged unverified ({reason[:60]})")

    log_line(
        f"END: updated={updated} flagged={flagged} no_source={no_source} fails={fails}"
    )

if __name__ == "__main__":
    main()
