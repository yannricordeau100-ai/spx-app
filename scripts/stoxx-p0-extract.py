#!/usr/bin/env python3
"""Stoxx 600 P0 — Extraction Cerebras Qwen-3 235B sur 10 stés.

Cible : PUM.DE FER AKE.PA ALO.PA AMBU-B.CO FNTN.DE FME.DE GN.CO HSX.L NOVO-B.CO.
Sources : sec-data/cat3-european/<TICKER>/annual-text/<year>.txt (3-5 fichiers).

Output :
  - src/data/v2-pipeline/<t>.json
  - src/data/v2-pipeline-enrich/<t>.json
  - src/data/v2-pipeline-specific-kpis/<TICKER>.json

Cerebras free tier 3 keys rotation. Sleep 12s entre calls. Pilot d'abord.
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
EU_DIR = PROJECT_ROOT / "sec-data/cat3-european"
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SPEC_KPIS = PROJECT_ROOT / "src/data/v2-pipeline-specific-kpis"
LOG = PROJECT_ROOT / ".conv-state/stoxx-p0-extract.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
USE_GROQ = os.environ.get("USE_GROQ", "0") == "1"
SLEEP = float(os.environ.get("SLEEP_SECS", "6" if USE_GROQ else "12"))
CTX_LEN = 18000 if USE_GROQ else 22000  # Groq 12k TPM, plus conservateur

TARGETS = ["PUM.DE", "FER", "AKE.PA", "ALO.PA", "AMBU-B.CO", "FNTN.DE",
           "FME.DE", "GN.CO", "HSX.L", "NOVO-B.CO"]

NAMES = {
    "PUM.DE": "Puma SE",
    "FER": "Ferrovial SE",
    "AKE.PA": "Arkema SA",
    "ALO.PA": "Alstom SA",
    "AMBU-B.CO": "Ambu A/S",
    "FNTN.DE": "freenet AG",
    "FME.DE": "Fresenius Medical Care AG",
    "GN.CO": "GN Store Nord A/S",
    "HSX.L": "Hiscox Ltd",
    "NOVO-B.CO": "Novo Nordisk A/S",
}

COUNTRY = {
    "PUM.DE": "DE", "FER": "ES", "AKE.PA": "FR", "ALO.PA": "FR",
    "AMBU-B.CO": "DK", "FNTN.DE": "DE", "FME.DE": "DE", "GN.CO": "DK",
    "HSX.L": "GB", "NOVO-B.CO": "DK",
}


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
    return [k for k in [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ] if k]


def get_source(ticker: str):
    d = EU_DIR / ticker / "annual-text"
    if not d.exists():
        return None
    chunks = []
    files = sorted(d.glob("*.txt"), reverse=True)[:5]
    if not files:
        return None
    # Budget per file
    budget_per_file = CTX_LEN // max(len(files), 1)
    for f in files:
        try:
            txt = f.read_text(errors="ignore")
            # Take first chunk (usually most useful narrative + key figures)
            chunks.append(f"=== ANNUAL {f.stem} ===\n{txt[:budget_per_file]}")
        except Exception:
            pass
    if not chunks:
        return None
    return "\n\n".join(chunks)[:CTX_LEN]


PROMPT = """Tu extrais des données financières structurées depuis les filings d'une société européenne du Stoxx 600.

Société : {name} ({ticker})

Format JSON STRICT (rien d'autre, rien avant ni après) :

{{
  "company_description": "description FR 100-300 chars de l'activité",
  "hero_kpi_short": "Nom court du KPI vedette (ex 'Net Sales', 'Adj EBITDA', 'Volume')",
  "hero_kpi_unit": "Mds €" | "Mds DKK" | "Mds £" | "M €" | "%" | etc.,
  "hero_kpi_history": [{{"label": "2024", "value": 32.5}}, ...] (au moins 5 points si dispo),
  "kpis_specifiques": [
    {{
      "short": "Nom court",
      "name_fr": "Nom FR complet",
      "name_en": "English name",
      "explanation_fr": "1 phrase explicative",
      "value": 32.5,
      "unit": "Mds €",
      "yoy": "+8.2%",
      "history": [25.0, 27.5, 28.1, 30.2, 32.5]
    }}
  ] (8+ KPIs spécifiques à la sté, pas génériques),
  "stories_kpis": [
    {{
      "short": "...",
      "name_fr": "...",
      "value": ...,
      "unit": "...",
      "story_category": "Innovation" | "Marché" | "Adoption" | "Capacité",
      "description": "explication FR plus value investisseur"
    }}
  ] (5-8 stories),
  "revenue_by_segment": {{
    "label": "Répartition du chiffre d'affaires par segment",
    "slices": [{{"name": "Footwear", "value": 5.2, "unit": "Mds €", "pct": 65.0}}]
  }} | null (au moins 2 slices),
  "revenue_by_geography": {{
    "label": "Répartition du CA par zone géographique",
    "slices": [{{"name": "Europe", "value": 3.2, "unit": "Mds €", "pct": 40.0}}]
  }} | null (au moins 2 slices),
  "risks": [
    {{
      "category": "Réglementaire" | "Marché" | "Cyber" | "Opérationnel" | "Macro" | "ESG",
      "description": "1-2 phrases FR sur le risque concret",
      "severity": 1-5,
      "score_rationale": "Justification 4 critères : position rapport annuel, intensité langage, tendance N-1, poids catégorie"
    }}
  ] (3-5 risques),
  "profit_warning": {{
    "score": 1-5,
    "label": "Faible" | "Modéré" | "Élevé",
    "rationale": "1 phrase FR"
  }} | null,
  "governance": {{
    "ceo_name": "Nom complet",
    "ceo_compensation_total_musd": 12.5,
    "board_size": 12,
    "voting_structure": "1 action = 1 voix" | "actions à droit de vote multiple",
    "top3_capital": [{{"name": "BlackRock", "pct": 7.2}}, ...],
    "top3_voting": [...] (si dual class sinon copie top3_capital)
  }} | null,
  "ai_positioning": {{
    "stance": "leader" | "integrator" | "cautious" | "absent",
    "evidence": ["evidence 1 FR concrète", "evidence 2", "evidence 3"],
    "summary": "1 phrase FR"
  }} | null,
  "events": [
    {{"date": "2025-03-15", "title": "FR title", "description": "FR 1 phrase"}}
  ] (4+ events des 12 derniers mois),
  "interpretation": {{
    "lead": "1 phrase FR conclusion principale",
    "moteur": "1 phrase FR : moteur de croissance",
    "vigilance": "1 phrase FR : point de vigilance",
    "surveillance": "1 phrase FR : à surveiller prochain trim"
  }}
}}

RÈGLES :
1. JAMAIS inventer. Si non chiffré explicitement dans la source -> null ou skip.
2. KPIs en devise native (EUR pour FR/DE/ES/IT, DKK pour DK, GBP pour UK).
3. Tous textes FR uniquement (sauf name_en).
4. Si segment/geo single, return null (pas de slice à 100% seul).
5. history : year-over-year, 5+ points si dispo.

Source filings ({ticker}) :
---
{ctx}
---"""


def call_llm(prompt, api_key, retries=1, use_groq=False):
    if use_groq:
        url = GROQ_URL
        model = GROQ_MODEL
    else:
        url = CEREBRAS_URL
        model = CEREBRAS_MODEL
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "content-type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError:
                        pass
                return None, "JSON parse fail"
        except urllib.error.HTTPError as e:
            code = e.code
            body_text = ""
            try:
                body_text = e.read().decode("utf-8", errors="ignore")[:200]
            except Exception:
                pass
            if code == 429 and attempt < retries:
                log_line(f"    429 rate-limit, sleep 30s")
                time.sleep(30)
                continue
            return None, f"HTTP {code} {body_text}"
        except Exception as ex:
            return None, f"Ex {type(ex).__name__}: {ex}"
    return None, "retries exhausted"


def call_haiku(prompt, api_key):
    body = json.dumps({
        "model": "claude-haiku-4-5",
        "max_tokens": 6000,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body, headers=headers
    )
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as resp:
            data = json.loads(resp.read())
        raw = data["content"][0]["text"]
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        try:
            return json.loads(raw), None
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0)), None
                except json.JSONDecodeError:
                    pass
            return None, "JSON parse fail"
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as ex:
        return None, f"Ex {type(ex).__name__}: {ex}"


def build_pipeline_doc(ticker, name, result):
    now = datetime.now(timezone.utc).isoformat()
    hero_history = result.get("hero_kpi_history") or []
    history_vals = [h.get("value") for h in hero_history if isinstance(h, dict) and h.get("value") is not None]

    kpis = []
    for k in (result.get("kpis_specifiques") or []):
        if not isinstance(k, dict):
            continue
        kpis.append({
            "short": k.get("short"),
            "name_fr": k.get("name_fr"),
            "name_en": k.get("name_en"),
            "explanation": k.get("explanation_fr"),
            "value": k.get("value"),
            "unit": k.get("unit"),
            "yoy": k.get("yoy"),
            "history": k.get("history") or [],
            "is_wow": True,
            "period_type": "year",
        })

    stories = []
    for s in (result.get("stories_kpis") or []):
        if not isinstance(s, dict):
            continue
        stories.append({
            "short": s.get("short"),
            "name_fr": s.get("name_fr"),
            "value": s.get("value"),
            "unit": s.get("unit"),
            "description": s.get("description"),
            "story_category": s.get("story_category"),
            "is_short_history": True,
        })

    doc = {
        "ticker": ticker,
        "name": name,
        "country": COUNTRY.get(ticker, "EU"),
        "hero_kpi": result.get("hero_kpi_short"),
        "hero_kpi_unit": result.get("hero_kpi_unit"),
        "company_description": result.get("company_description"),
        "kpis": kpis,
        "stories_kpis": stories,
        "revenue_by_segment": result.get("revenue_by_segment"),
        "revenue_by_geography": result.get("revenue_by_geography"),
        "risks": result.get("risks") or [],
        "profit_warning": result.get("profit_warning"),
        "governance": result.get("governance"),
        "ai_positioning": result.get("ai_positioning"),
        "events": result.get("events") or [],
        "_stoxx_p0_extracted_at": now,
        "_stoxx_p0_source": "cat3-european",
        "_validation": {"pass3_strict": False, "source": "stoxx-p0-cerebras"},
    }

    interp = result.get("interpretation")
    if interp and isinstance(interp, dict):
        doc["interpretation"] = interp

    if history_vals and doc.get("hero_kpi"):
        for k in doc["kpis"]:
            if k.get("short") == doc["hero_kpi"] and not k.get("history"):
                k["history"] = history_vals

    return doc


def build_spec_kpis_doc(ticker, result):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "ticker": ticker,
        "extracted_at": now,
        "extracted_by": "Cerebras Qwen-3 235B (stoxx-p0)",
        "sources_used": ["cat3-european"],
        "kpis": result.get("kpis_specifiques") or [],
        "kpis_story": result.get("stories_kpis") or [],
        "_notes": "Extracted from Stoxx 600 annual reports, requires verification",
        "_verification_needed": False,
    }


def build_enrich_doc(ticker, result):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "ticker": ticker,
        "_stoxx_p0_at": now,
        "events": result.get("events") or [],
        "ai_positioning": result.get("ai_positioning"),
        "profit_warning": result.get("profit_warning"),
        "governance": result.get("governance"),
        "interpretation": result.get("interpretation"),
        "company_description": result.get("company_description"),
    }


def count_blocs(result):
    n = 0
    if result.get("company_description") and len(result["company_description"]) >= 100: n += 1
    if result.get("hero_kpi_short"): n += 1
    if (result.get("kpis_specifiques") or []) and len(result["kpis_specifiques"]) >= 5: n += 1
    if (result.get("stories_kpis") or []) and len(result["stories_kpis"]) >= 3: n += 1
    seg = result.get("revenue_by_segment")
    if seg and isinstance(seg, dict) and len(seg.get("slices") or []) >= 2: n += 1
    geo = result.get("revenue_by_geography")
    if geo and isinstance(geo, dict) and len(geo.get("slices") or []) >= 2: n += 1
    if (result.get("risks") or []) and len(result["risks"]) >= 3: n += 1
    if result.get("governance"): n += 1
    if result.get("ai_positioning"): n += 1
    if (result.get("events") or []) and len(result["events"]) >= 3: n += 1
    if result.get("interpretation"): n += 1
    return n


def main():
    load_env()
    if USE_GROQ:
        groq_key = os.environ.get("GROQ_API_KEY")
        if not groq_key:
            log_line("NO Groq key")
            sys.exit(1)
        keys = [groq_key]
    else:
        keys = get_keys()
        if not keys:
            log_line("NO Cerebras keys")
            sys.exit(1)

    pilot_only = "--pilot" in sys.argv
    tickers = TARGETS[:1] if pilot_only else TARGETS

    backend = "GROQ Llama 3.3 70B" if USE_GROQ else "CEREBRAS Qwen-3 235B"
    log_line(f"START stoxx-p0 ({len(tickers)} stés, {len(keys)} keys, {backend})")

    ok, partial, fails, no_src = 0, 0, 0, 0
    key_idx = 0
    results_summary = []

    for i, tk in enumerate(tickers):
        if i > 0:
            time.sleep(SLEEP)

        ctx = get_source(tk)
        if not ctx or len(ctx) < 2000:
            no_src += 1
            log_line(f"  {tk}: NO_SOURCE")
            results_summary.append((tk, "NO_SOURCE", 0))
            continue

        name = NAMES.get(tk, tk)
        prompt = PROMPT.format(name=name, ticker=tk, ctx=ctx)

        # Try keys in rotation
        result = None
        last_err = None
        for k_try in range(len(keys)):
            api_key = keys[(key_idx + k_try) % len(keys)]
            log_line(f"  {tk}: try key{(key_idx + k_try) % len(keys)}")
            result, err = call_llm(prompt, api_key, use_groq=USE_GROQ)
            if result:
                key_idx = (key_idx + k_try + 1) % len(keys)
                break
            last_err = err
            log_line(f"    fail: {err[:80] if err else 'unknown'}")
            time.sleep(5)

        # Haiku fallback if Cerebras/Groq exhausted
        if not result:
            haiku_key = os.environ.get("ANTHROPIC_API_KEY")
            if haiku_key:
                log_line(f"  {tk}: Haiku fallback")
                result, last_err = call_haiku(prompt, haiku_key)

        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  {tk}: LLM_FAIL ({last_err[:80] if last_err else 'unknown'})")
            results_summary.append((tk, f"FAIL:{last_err[:50] if last_err else ''}", 0))
            continue

        n_blocs = count_blocs(result)

        # Write outputs
        tk_lower = tk.lower()
        try:
            (PIPELINE / f"{tk_lower}.json").write_text(
                json.dumps(build_pipeline_doc(tk, name, result), indent=2, ensure_ascii=False)
            )
            (ENRICH / f"{tk_lower}.json").write_text(
                json.dumps(build_enrich_doc(tk, result), indent=2, ensure_ascii=False)
            )
            (SPEC_KPIS / f"{tk}.json").write_text(
                json.dumps(build_spec_kpis_doc(tk, result), indent=2, ensure_ascii=False)
            )
        except Exception as e:
            log_line(f"  {tk}: WRITE_FAIL {e}")
            fails += 1
            results_summary.append((tk, "WRITE_FAIL", 0))
            continue

        if n_blocs >= 8:
            ok += 1
            log_line(f"  {tk}: OK blocs={n_blocs}")
            results_summary.append((tk, "OK", n_blocs))
        else:
            partial += 1
            log_line(f"  {tk}: PARTIAL blocs={n_blocs}")
            results_summary.append((tk, "PARTIAL", n_blocs))

    log_line(f"END: ok={ok} partial={partial} no_src={no_src} fails={fails}")
    log_line(f"SUMMARY: {results_summary}")

    # Print summary JSON for caller parsing
    summary = {"ok": ok, "partial": partial, "fails": fails, "no_src": no_src,
               "results": [{"ticker": t, "status": s, "blocs": b} for t, s, b in results_summary]}
    print("\n===SUMMARY===")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
