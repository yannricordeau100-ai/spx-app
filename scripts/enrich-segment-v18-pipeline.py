#!/usr/bin/env python3
"""
enrich-segment-v18-pipeline.py — extrait revenue_by_segment au format strict.

Source : section "Geographic Information" / "Net sales by geographic region"
du 10-K Item 7 (US) ou Item 5 (20-F) ou annual-text (EU pures).

Format strict (consommé par RepartitionBlock côté UI) :
{
  "revenue_by_segment": {
    "unit": "B$" | "M$" | "M€" | etc.,
    "source_date": "YYYY-MM-DD",
    "source": "10-K FY2025 Item 7 — Geographic Information",
    "slices": [
      {"label": "Americas", "value": 167.0},
      {"label": "Europe", "value": 96.7},
      ...
    ]
  }
}

ÉCRIT dans `src/data/v2-pipeline-enrich/<ticker>.json` (load-company merge).

1 proc, sleep 5s entre calls (RAM safe).

Usage : python3 scripts/enrich-segment-v18-pipeline.py [--limit N]
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
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path("/tmp/segment-pending.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-segment.log"
LOG.parent.mkdir(parents=True, exist_ok=True)
ENRICH.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")
SLEEP_BETWEEN_CALLS = 5.0


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


def find_filing(ticker: str) -> tuple[Optional[str], Optional[str]]:
    """Retourne (text, source_label)."""
    tu = ticker.upper()
    for form, label in [("10K", "10-K"), ("20F", "20-F")]:
        base = SEC / ("cat1-us" if form == "10K" else "cat2-foreign-adr") / form
        if not base.exists(): continue
        for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read()), f"{label} FY{year_dir.name}"
                except Exception:
                    continue
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = sorted(cat3.glob("*.txt"), reverse=True)
            for f in txt_files[:1]:
                return _strip_html(f.read_text(errors="ignore")), f"Annual report {f.stem}"
        except Exception:
            pass
    return None, None


def extract_geo_section(text: str, max_chars: int = 12000) -> str:
    """En réalité extrait section SEGMENTS (le nom de fonction est legacy de geo)."""
    if not text:
        return ""
    patterns = [
        # Sections segments / business divisions
        r"reportable\s+segments?",
        r"operating\s+segments?",
        r"business\s+segments?",
        r"segment\s+information",
        r"segment\s+reporting",
        r"revenue\s+by\s+segment",
        r"revenue\s+by\s+product",
        r"revenue\s+by\s+business",
        r"net\s+sales\s+by\s+(?:product|category|segment)",
        r"revenue\s+disaggregated\s+by\s+(?:product|service|category)",
        r"sales\s+by\s+category",
        r"product\s+categories",
        r"disaggregation\s+of\s+revenue",
        # FR/DE/IT/ES
        r"r[ée]partition\s+(?:du\s+)?chiffre\s+d.affaires\s+par\s+(?:segment|activit[ée]|m[ée]tier)",
        r"chiffre\s+d.affaires\s+par\s+(?:segment|activit[ée]|m[ée]tier|business)",
        r"umsatz\s+nach\s+(?:segment|gesch[äa]ftsbereich|produkt)",
        r"umsatzerl[öo]se\s+nach\s+segment",
        r"ricavi\s+per\s+segment",
        r"ricavi\s+per\s+(?:settore|attivit[àa])",
        r"ingresos\s+por\s+segmento",
    ]
    matches = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches:
        return ""
    matches.sort()
    # Choisir le meilleur contexte : on score chaque match par la densité
    # de chiffres ($, %, millions) dans les 4000 chars suivants. Le glossaire
    # / index est pauvre en chiffres → score faible. MD&A / Notes financières
    # = riche en chiffres → score élevé.
    def score(pos):
        window = text[pos:pos + 4000]
        dollar_signs = window.count("$")
        pct_signs = window.count("%")
        mil_bil = len(re.findall(r"\b(million|billion|millions|billions|Mds|M\$|B\$)\b", window, re.IGNORECASE))
        digits = len(re.findall(r"\d{3,}", window))
        return dollar_signs * 2 + pct_signs + mil_bil * 3 + digits

    scored = [(score(p), p) for p in matches]
    scored.sort(reverse=True)
    start = scored[0][1]
    return re.sub(r"\s+", " ", text[start:start + max_chars + 2000])[:max_chars]


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


GEO_PROMPT = """Tu extrais la RÉPARTITION DU CHIFFRE D'AFFAIRES PAR SEGMENT D'ACTIVITÉ (produits, services, business units) de {ticker} depuis ces extraits.

Retourne UNIQUEMENT un JSON strict :
{{
  "unit": "B$" | "M$" | "M€" | "Mds €" | etc.,
  "source_date": "YYYY-MM-DD",
  "source": "10-K Item 7 — Reportable Segments" ou équivalent,
  "slices": [
    {{"label": "iPhone", "value": 202.7}},
    {{"label": "Services", "value": 96.2}},
    {{"label": "Wearables, Home and Accessories", "value": 37.0}},
    {{"label": "Mac", "value": 33.7}},
    {{"label": "iPad", "value": 26.7}}
  ]
}}

Règles STRICTES :
- value = CHIFFRES NUMÉRIQUES uniquement (pas null, pas "n/a")
- Si un segment n'a pas de valeur chiffrée → NE PAS l'inclure
- slices minimum 2 segments valides, sinon retourner {{}}
- unit unique pour toutes les slices
- Labels = nom du segment / produit / service (PAS région géographique)
- NE PAS extraire de répartition géographique (Americas/Europe/Asia) — c'est un autre champ
- Pas d'em-dash dans les labels
- source_date au format ISO YYYY-MM-DD
- **ANTI-POLLUTION CROSS-TICKER** : extraire UNIQUEMENT les segments propres
  à {ticker}. Si l'extrait mentionne des données de comparaison de filiales,
  concurrents, partenaires, ou autres sociétés citées (deals, JV, owners,
  etc.), les IGNORER. Seul {ticker} compte.

Extraits :
{context}
"""


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
    log_line(f"START : {len(pending)} stés segment (sleep {SLEEP_BETWEEN_CALLS}s, 1 proc)")

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

        text, source_label = find_filing(tk)
        ctx = extract_geo_section(text or "")
        if not ctx or len(ctx) < 800:
            no_source += 1
            log_line(f"  🚫 {tk} : section Geographic introuvable")
            continue

        prompt = GEO_PROMPT.format(ticker=tk, context=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
            continue
        slices = result.get("slices") or []
        valid = [s for s in slices if isinstance(s, dict) and isinstance(s.get("value"), (int, float))]
        if len(valid) < 2:
            fails += 1
            log_line(f"  ⚠ {tk} : <2 slices valides")
            continue

        out_path = ENRICH / f"{tk.lower()}.json"
        existing = {}
        if out_path.exists():
            try: existing = json.loads(out_path.read_text())
            except: existing = {}
        existing["ticker"] = tk.upper()
        existing["revenue_by_segment"] = {
            "unit": result.get("unit", "$"),
            "source_date": result.get("source_date") or "",
            "source": result.get("source") or source_label or "10-K",
            "slices": valid[:8],
        }
        existing["_segment_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk} : {len(valid)} segments ({valid[0].get('label')[:15]}…)")

        if (i + 1) % 25 == 0:
            elapsed_min = (time.time() - t_start) / 60
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta_min = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  📊 [{i+1}/{len(pending)}] written={written} no_src={no_source} fails={fails} | rate={rate:.1f}/min ETA={eta_min:.0f}min")

    log_line(f"END : written={written} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
