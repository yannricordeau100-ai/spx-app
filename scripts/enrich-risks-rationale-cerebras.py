#!/usr/bin/env python3
"""enrich-risks-rationale-cerebras.py — génère un score_rationale 4-critères
pour les risks avec rationale faible identifiés par v1-9-risks-audit.json.

Pour chaque sté ayant des `weak_rationales` (391 stés au 21 mai 2026), parcourt
ses risks et identifie ceux dont rationale fait <2 keywords sur 4 OU <120 chars.
Pour chacun, appelle Cerebras Qwen-3 235B free pour générer un nouveau rationale
français citant les 4 critères : position 10-K, intensité langage, trend N-1,
weight catégorie.

Output : src/data/v2-pipeline-enrich/<t>.json, merge sur risks[] par title+category.
N'écrase JAMAIS v2-pipeline/<t>.json (scope CONV-DATA strict).

Rotation 3 keys Cerebras free, throttle 429, sleep 4s entre calls.
RAM ultra-light : 1 proc, pas de 10-K source.
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
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
AUDIT_FILE = PROJECT_ROOT / "src/data/v1-9-risks-audit.json"
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-rationale.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 4.0
SLEEP_THROTTLE_429 = 12.0

# Keywords pour détecter chaque critère (mêmes que l'audit sub-agent #23)
CRIT_POSITION = ['position', 'item 1a', 'top', 'premier', 'début', 'place', '#', 'sur ', 'risque n']
CRIT_INTENSITY = ['langage', 'materially', 'could', 'may affect', 'intensité', 'intensif', 'fort', 'sévère', 'élevé']
CRIT_TREND = ['trend', 'n-1', 'nouveau', 'aggravé', 'stable', 'atténué', 'tendance', 'précédent', 'évolu', 'croissant', 'décroissant']
CRIT_CATEGORY = ['catégorie', 'cyber', 'réglementaire', 'opérationnel', 'weight', 'poids', 'pondér', 'haut', 'moyen']

PROMPT = """Tu es un analyste risque financier. Génère un `score_rationale` en français pour un risk de société cotée.

Le rationale DOIT explicitement citer les 4 critères suivants :
(1) Position dans le 10-K (ex "Item 1A risk #N sur N total" - top = plus important)
(2) Intensité du langage ("could materially harm" = haut, "may affect" = moyen, "could potentially" = faible)
(3) Trend vs N-1 (nouveau, aggravé, stable, atténué)
(4) Weight de la catégorie (cyber/réglementaire = haut, opérationnel = moyen, autres = bas)

Format strict : 150-250 caractères, en français, sans em-dash (—), sans tirets longs.
Cite chaque critère explicitement avec son label entre parenthèses ou intégré naturellement.

DONNÉES DU RISK :
- Société : {company} ({ticker})
- Title : {title}
- Category : {category}
- Score : {score}/5
- Position : risk #{position} sur {total} dans Item 1A
- Quote (extrait 10-K) : {quote}

Réponds UNIQUEMENT par un JSON :
{{"score_rationale": "<texte 150-250 chars FR sans em-dash citant les 4 critères>"}}
"""


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


def get_keys():
    return [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 500,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content), 200
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), 200
                    except json.JSONDecodeError:
                        pass
                return None, 0  # bad JSON
        except urllib.error.HTTPError as e:
            if e.code == 429:
                return None, 429
            return None, e.code
        except Exception as ex:
            time.sleep(2)
    return None, 0


def is_weak(rationale):
    """Same heuristic as sub-agent #23 audit."""
    if not rationale or not isinstance(rationale, str):
        return True
    rat = rationale.lower()
    crits = 0
    if any(k in rat for k in CRIT_POSITION):
        crits += 1
    if any(k in rat for k in CRIT_INTENSITY):
        crits += 1
    if any(k in rat for k in CRIT_TREND):
        crits += 1
    if any(k in rat for k in CRIT_CATEGORY):
        crits += 1
    return crits < 2 or len(rationale) < 120


def sanitize_rationale(text):
    """Remove em-dash and force FR."""
    if not text:
        return text
    # Remove em-dash variants
    text = text.replace("—", " : ").replace("–", " : ").replace("—", " : ").replace("–", " : ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_weak_tickers():
    """Return list of tickers with weak_rationales from audit."""
    if not AUDIT_FILE.exists():
        log_line(f"❌ audit file not found: {AUDIT_FILE}")
        return []
    data = json.loads(AUDIT_FILE.read_text())
    flags = data.get("flags", [])
    out = []
    for f in flags:
        if "rationale_weak" in (f.get("problems") or []):
            out.append(f["ticker"])
    return out


def load_enrich(ticker):
    """Load enrich file if exists, else empty dict."""
    p = ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return {}
    return {}


def save_enrich(ticker, data):
    p = ENRICH / f"{ticker.lower()}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def merge_rationale_into_enrich(enrich_data, risk_title, risk_category, new_rationale):
    """Merge a new rationale into the enrich's risks_rationale_overrides list.
    Structure: enrich['risks_rationale_overrides'] = [{title, category, score_rationale}, ...]
    Used by load-company.ts merge SSR to replace matching risk's rationale.
    """
    if "risks_rationale_overrides" not in enrich_data:
        enrich_data["risks_rationale_overrides"] = []
    # Remove existing same-key entry
    enrich_data["risks_rationale_overrides"] = [
        x for x in enrich_data["risks_rationale_overrides"]
        if not (x.get("title") == risk_title and x.get("category") == risk_category)
    ]
    enrich_data["risks_rationale_overrides"].append({
        "title": risk_title,
        "category": risk_category,
        "score_rationale": new_rationale,
        "_enriched_at": datetime.now(timezone.utc).isoformat(),
        "_enriched_by": "CONV-CONCEPTS sub-agent #24 Cerebras Qwen-3 235B",
    })
    return enrich_data


def main():
    load_env()
    keys = [k for k in get_keys() if k]
    if not keys:
        log_line("❌ NO CEREBRAS KEYS")
        sys.exit(1)
    log_line(f"START rationale enrichment, {len(keys)} keys available")

    tickers = get_weak_tickers()
    log_line(f"Target: {len(tickers)} stés with weak_rationales")

    # Stats
    n_ok = 0
    n_skip_no_pipeline = 0
    n_skip_no_risks = 0
    n_skip_no_weak = 0
    n_429 = 0
    n_fail = 0
    n_processed_risks = 0
    n_enriched_risks = 0

    key_idx = 0
    last_call = 0.0
    start_ts = time.time()

    for i, ticker in enumerate(tickers):
        p = PIPELINE / f"{ticker.lower()}.json"
        if not p.exists():
            n_skip_no_pipeline += 1
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            n_skip_no_pipeline += 1
            continue
        risks = data.get("risks") or []
        if not risks:
            n_skip_no_risks += 1
            continue

        weak_risks = []
        for ridx, r in enumerate(risks):
            rat = r.get("score_rationale", "")
            if is_weak(rat):
                weak_risks.append((ridx, r))

        if not weak_risks:
            n_skip_no_weak += 1
            continue

        enrich_data = load_enrich(ticker)
        changed = False

        for ridx, r in weak_risks:
            # Rate-limit between calls
            elapsed = time.time() - last_call
            if elapsed < SLEEP_BETWEEN_CALLS:
                time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
            last_call = time.time()

            n_processed_risks += 1
            api_key = keys[key_idx % len(keys)]

            quote = (r.get("quote") or r.get("summary") or r.get("description") or "")[:400]
            prompt = PROMPT.format(
                company=data.get("name", ticker),
                ticker=ticker,
                title=(r.get("title") or "Risk")[:80],
                category=(r.get("category") or "Autre")[:50],
                score=r.get("score") or 3,
                position=ridx + 1,
                total=len(risks),
                quote=quote,
            )

            result, status = call_cerebras(prompt, api_key)

            if status == 429:
                n_429 += 1
                log_line(f"  {ticker}#{ridx} 429, switch key + throttle")
                key_idx += 1
                time.sleep(SLEEP_THROTTLE_429)
                # Retry once with new key
                api_key = keys[key_idx % len(keys)]
                result, status = call_cerebras(prompt, api_key)

            if not result or "score_rationale" not in result:
                n_fail += 1
                continue

            new_rat = sanitize_rationale(result["score_rationale"])
            if not new_rat or len(new_rat) < 80:
                n_fail += 1
                continue

            # Save into enrich (merge)
            enrich_data = merge_rationale_into_enrich(
                enrich_data,
                r.get("title") or "",
                r.get("category") or "",
                new_rat,
            )
            changed = True
            n_enriched_risks += 1

            # Rotate keys every call to balance load
            key_idx += 1

        if changed:
            save_enrich(ticker, enrich_data)
            n_ok += 1

        # Progress log every 10 stés
        if (i + 1) % 10 == 0:
            elapsed = time.time() - start_ts
            log_line(
                f"PROGRESS {i+1}/{len(tickers)} | enriched={n_enriched_risks} risks "
                f"on {n_ok} stés | fails={n_fail} 429={n_429} "
                f"| elapsed={elapsed/60:.1f}min"
            )

    elapsed = time.time() - start_ts
    log_line("=" * 60)
    log_line(f"DONE in {elapsed/60:.1f} min")
    log_line(f"  Stés OK: {n_ok}")
    log_line(f"  Risks enriched: {n_enriched_risks}")
    log_line(f"  Risks processed: {n_processed_risks}")
    log_line(f"  Skip (no pipeline): {n_skip_no_pipeline}")
    log_line(f"  Skip (no risks): {n_skip_no_risks}")
    log_line(f"  Skip (no weak): {n_skip_no_weak}")
    log_line(f"  Fails (LLM): {n_fail}")
    log_line(f"  429: {n_429}")
    log_line(f"  Success rate: {100*n_enriched_risks/max(1,n_processed_risks):.1f}%")


if __name__ == "__main__":
    main()
