#!/usr/bin/env python3
"""Canada TSX 60 Phase 2 — Extraction Cerebras unifiée.

Pour chaque ticker (priorité: stés OK cat-canadian, fallback SEC 40-F).
Génère 3 fichiers en parallèle:
  - src/data/v2-pipeline/<ticker>.json (canonical 30+ champs)
  - src/data/v2-pipeline-enrich/<ticker>.json (events / market_positions)
  - src/data/v2-pipeline-specific-kpis/<TICKER>.json (kpis spec FR/EN)

Cerebras Qwen-3 235B, 3 keys rotation. Sleep 5s entre calls.
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
CANADA_DIR = PROJECT_ROOT / "sec-data/cat-canadian"
SEC_40F = PROJECT_ROOT / "sec-data/cat2-foreign-adr/40F-canadian"
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SPEC_KPIS = PROJECT_ROOT / "src/data/v2-pipeline-specific-kpis"
LOG = PROJECT_ROOT / f".conv-state/canada-tsx60-extract-{os.environ.get('KEY_INDEX','0')}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP = float(os.environ.get("SLEEP_SECS", "12"))
CTX_LEN = 24000

# Mapping TSX -> list of SEC 40-F candidate tickers (try in order)
TSX_TO_SEC = {
    "BAM.TO":["BAM"],"BN.TO":["BN"],"BNS.TO":["BNS"],"BMO.TO":["BMO"],"CAE.TO":["CAE"],"CCO.TO":["CCJ"],
    "CM.TO":["CM"],"EMA.TO":["EMA"],"FM.TO":["FM","FQVLF"],"RY.TO":["RY"],"SLF.TO":["SLF"],"TECK-B.TO":["TECK"],
    "TOU.TO":["TOU","TOUOF"],"TRP.TO":["TRP"],"WN.TO":["WN","WNGRF"],
    "ABX.TO":["ABX","GOLD"],"AEM.TO":["AEM"],"ATD.TO":["ATD","ANCUF"],"BCE.TO":["BCE"],"BIP-UN.TO":["BIP","BIPC"],
    "CCL-B.TO":["CCDBF","CCL"],"CLS.TO":["CLS"],"CNQ.TO":["CNQ"],"CNR.TO":["CNI"],"CP.TO":["CP"],
    "CSU.TO":["CSU","CSUAF"],"CTC-A.TO":["CDNAF","CTC"],"CVE.TO":["CVE"],"DOL.TO":["DLMAF","DOL"],"ENB.TO":["ENB"],
    "FFH.TO":["FRFHF","FFH"],"FNV.TO":["FNV"],"FSV.TO":["FSV"],"FTS.TO":["FTS"],"GIB-A.TO":["GIB"],
    "GIL.TO":["GIL"],"H.TO":["HRNNF","H"],"IFC.TO":["IFCZF","IFC"],"IMO.TO":["IMO"],"K.TO":["KGC","K"],"L.TO":["LBLCF","L"],
    "MFC.TO":["MFC"],"MG.TO":["MGA"],"MRU.TO":["MGDDF","MRU"],"NA.TO":["NTIOF","NA"],"NTR.TO":["NTR"],
    "OTEX.TO":["OTEX"],"POW.TO":["PWCDF","POW"],"PPL.TO":["PBA","PPL"],"QSR.TO":["QSR"],"RCI-B.TO":["RCI"],
    "SAP.TO":["SAPGF","SAP"],"SHOP.TO":["SHOP"],"SU.TO":["SU"],"T.TO":["TU","T","TLOFF"],"TD.TO":["TD"],"TRI.TO":["TRI"],
    "WCN.TO":["WCN"],"WPM.TO":["WPM"],"WSP.TO":["WSPOF","WSP"],
}

HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&[a-zA-Z]+;")
HTML_ENT_D = re.compile(r"&#\d+;")
WS = re.compile(r"\s+")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}][k{os.environ.get('KEY_INDEX','0')}] {msg}"
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


def strip_html(html: str) -> str:
    text = HTML_TAG.sub(" ", html)
    text = HTML_ENT_N.sub(" ", text)
    text = HTML_ENT_D.sub(" ", text)
    return WS.sub(" ", text).strip()


def get_canada_source(ticker: str):
    """Read all text sources from cat-canadian/<TICKER>/."""
    d = CANADA_DIR / ticker
    if not d.exists():
        return None
    chunks = []
    # annual-text (highest priority)
    at = d / "annual-text"
    if at.exists():
        for f in sorted(at.glob("*.txt"), reverse=True)[:3]:
            try:
                chunks.append(f"=== ANNUAL {f.stem} ===\n{f.read_text(errors='ignore')[:9000]}")
            except Exception:
                pass
    # mda
    mda = d / "mda"
    if mda.exists():
        for f in sorted(mda.glob("*.txt"), reverse=True)[:2]:
            try:
                chunks.append(f"=== MDA {f.stem} ===\n{f.read_text(errors='ignore')[:6000]}")
            except Exception:
                pass
    # proxy
    proxy = d / "proxy"
    if proxy.exists():
        for f in sorted(proxy.glob("*.txt"), reverse=True)[:1]:
            try:
                chunks.append(f"=== PROXY {f.stem} ===\n{f.read_text(errors='ignore')[:4000]}")
            except Exception:
                pass
    if not chunks:
        return None
    return "\n\n".join(chunks)[:CTX_LEN]


def get_sec_40f(ticker: str):
    """Read most recent 40-F from cat2-foreign-adr/40F-canadian/."""
    candidates = TSX_TO_SEC.get(ticker, [])
    if isinstance(candidates, str):
        candidates = [candidates]
    if not candidates:
        return None
    for sec_t in candidates:
      for year in ["2025","2024","2023","2022","2021"]:
        ydir = SEC_40F / year
        if not ydir.exists():
            continue
        for f in ydir.iterdir():
            if f.name.startswith(f"{sec_t}_") and f.name.endswith(".htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        html = g.read()
                    text = strip_html(html)
                    # extract business + MDA + risk sections
                    chunks = []
                    for pat, label, budget in [
                        (r"item\s+1\.?\s+(?:identity|business|operations)", "BUSINESS", 8000),
                        (r"item\s+5\.?\s+(?:management|operating|financial)", "MDA", 8000),
                        (r"item\s+3\.?\s+(?:key|risk|legal)", "RISKS", 4000),
                        (r"(?:segment\s+information|operating\s+segments|reportable\s+segments)", "SEG", 3000),
                        (r"(?:geographic\s+(?:information|areas))", "GEO", 2000),
                    ]:
                        m = list(re.finditer(pat, text, re.I))
                        if m:
                            pos = m[-1].start()
                            chunks.append(f"=== {label} ===\n{text[pos:pos+budget]}")
                    if not chunks:
                        # fallback middle
                        mid = len(text) // 2
                        chunks.append(text[max(0,mid-12000):mid+12000])
                    return "\n\n".join(chunks)[:CTX_LEN]
                except Exception as e:
                    log_line(f"  40-F read fail {ticker}: {type(e).__name__}")
                    continue
    return None


PROMPT = """Tu extrais des données financières structurées depuis les filings d'une société canadienne du TSX 60.

Société : {name} ({ticker})

Format JSON STRICT (rien d'autre, rien avant ni après) :

{{
  "company_description": "description FR 100-300 chars de l'activité",
  "hero_kpi_short": "Nom court du KPI vedette (ex 'Net Sales', 'Adj EBITDA', 'AUM', 'Production')",
  "hero_kpi_unit": "Mds CAD" | "Mds USD" | "kboe/d" | "%" | etc.,
  "hero_kpi_history": [{{"label": "2024", "value": 32.5}}, ...] (au moins 5 points si dispo),
  "kpis_specifiques": [
    {{
      "short": "Nom court",
      "name_fr": "Nom FR complet",
      "name_en": "English name",
      "explanation_fr": "1 phrase explicative",
      "value": 32.5,
      "unit": "Mds CAD",
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
    "slices": [{{"name": "Personal Banking", "value": 18.5, "unit": "Mds CAD", "pct": 35.0}}]
  }} | null (au moins 2 slices),
  "revenue_by_geography": {{
    "label": "Répartition du CA par zone géographique",
    "slices": [{{"name": "Canada", "value": 32.0, "unit": "Mds CAD", "pct": 65.0}}]
  }} | null (au moins 2 slices),
  "risks": [
    {{
      "category": "Réglementaire" | "Marché" | "Cyber" | "Opérationnel" | "Macro" | "ESG",
      "description": "1-2 phrases FR sur le risque concret",
      "severity": 1-5,
      "score_rationale": "Justification 4 critères : position 10-K, intensité langage, tendance N-1, poids catégorie"
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
    "voting_structure": "1 share = 1 vote" | "dual class",
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
1. JAMAIS inventer. Si non chiffré explicitement dans la source → null ou skip.
2. KPIs : tous EN MDS de devise native (CAD pour banques canadiennes / utilities, USD pour mines/oil avec disclosure USD).
3. Tous textes FR uniquement (sauf name_en).
4. Si segment/geo single, return null (pas de slice à 100% seul).
5. history : year-over-year, 5+ points si dispo, sinon ce que tu trouves.

Source filings ({ticker}) :
---
{ctx}
---"""


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
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
            if e.code == 429 and attempt < retries:
                log_line(f"  429 rate-limit, sleep 30s")
                time.sleep(30)
                continue
            log_line(f"  HTTP {e.code}")
            return None
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {ex}")
            time.sleep(5)
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


# Company name + sector mapping (from v1-9-universe.json)
COMPANY_NAMES = {}


def load_universe():
    global COMPANY_NAMES
    uni = PROJECT_ROOT / "src/data/v1-9-universe.json"
    if not uni.exists():
        return
    try:
        d = json.loads(uni.read_text())
        for entry in d:
            if isinstance(entry, dict) and entry.get("ticker"):
                COMPANY_NAMES[entry["ticker"]] = entry.get("name", entry["ticker"])
    except Exception:
        pass


def build_pipeline_doc(ticker: str, name: str, result: dict) -> dict:
    """Build v2-pipeline canonical doc from LLM result."""
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
        "sector": "Finance" if ticker in {"RY.TO","TD.TO","BNS.TO","BMO.TO","CM.TO","NA.TO","MFC.TO","SLF.TO","IFC.TO","FFH.TO","POW.TO"} else None,
        "country": "CA",
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
        "_canada_phase2_extracted_at": now,
        "_canada_phase2_source": "cat-canadian" if (CANADA_DIR / ticker / "annual-text").exists() else "sec-40f",
        "_validation": {"pass3_strict": False, "source": "canada-tsx60-cerebras-phase2"},
    }

    # add interpretation
    interp = result.get("interpretation")
    if interp and isinstance(interp, dict):
        doc["interpretation"] = interp

    # add hero history
    if history_vals and doc.get("hero_kpi"):
        # also write into kpis array if hero matches
        for k in doc["kpis"]:
            if k.get("short") == doc["hero_kpi"]:
                if not k.get("history"):
                    k["history"] = history_vals

    return doc


def build_spec_kpis_doc(ticker: str, result: dict) -> dict:
    """Build v2-pipeline-specific-kpis doc."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "ticker": ticker,
        "extracted_at": now,
        "extracted_by": "Cerebras Qwen-3 235B (canada-tsx60-phase2)",
        "sources_used": ["cat-canadian" if (CANADA_DIR / ticker / "annual-text").exists() else "sec-40f-canadian"],
        "kpis": result.get("kpis_specifiques") or [],
        "kpis_story": result.get("stories_kpis") or [],
        "_notes": "Extracted from filings, requires verification",
        "_verification_needed": False,
    }


def build_enrich_doc(ticker: str, result: dict) -> dict:
    """Build v2-pipeline-enrich doc."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "ticker": ticker,
        "_canada_phase2_at": now,
        "events": result.get("events") or [],
        "ai_positioning": result.get("ai_positioning"),
        "profit_warning": result.get("profit_warning"),
        "governance": result.get("governance"),
        "interpretation": result.get("interpretation"),
        "company_description": result.get("company_description"),
    }


def main():
    load_env()
    load_universe()
    api_key = get_api_key()
    if not api_key:
        log_line("❌ NO Cerebras key")
        sys.exit(1)

    pending_file = os.environ.get("PENDING_FILE")
    if not pending_file or not Path(pending_file).exists():
        log_line(f"❌ PENDING_FILE missing: {pending_file}")
        sys.exit(1)

    pending = [t.strip() for t in Path(pending_file).read_text().splitlines() if t.strip()]
    log_line(f"START canada-tsx60-phase2 ({len(pending)} stés, key={os.environ.get('KEY_INDEX','0')})")

    ok = 0
    partial = 0
    no_source = 0
    fails = 0
    last_call = 0.0

    for i, tk in enumerate(pending):
        if i and i % 5 == 0:
            log_line(f"  [{i}/{len(pending)}] ok={ok} partial={partial} no_src={no_source} fail={fails}")

        # rate limit
        elapsed = time.time() - last_call
        if elapsed < SLEEP:
            time.sleep(SLEEP - elapsed)

        # source
        ctx = get_canada_source(tk)
        if not ctx:
            ctx = get_sec_40f(tk)
        if not ctx or len(ctx) < 2000:
            no_source += 1
            log_line(f"  {tk}: NO_SOURCE (ctx={len(ctx) if ctx else 0})")
            continue

        name = COMPANY_NAMES.get(tk, tk)
        prompt = PROMPT.format(name=name, ticker=tk, ctx=ctx)
        last_call = time.time()
        result = call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict):
            fails += 1
            log_line(f"  {tk}: LLM_FAIL")
            continue

        # Count blocs livrés
        n_blocs = 0
        if result.get("company_description"): n_blocs += 1
        if result.get("hero_kpi_short"): n_blocs += 1
        if (result.get("kpis_specifiques") or []) and len(result["kpis_specifiques"]) >= 5: n_blocs += 1
        if (result.get("stories_kpis") or []) and len(result["stories_kpis"]) >= 3: n_blocs += 1
        if result.get("revenue_by_segment") and len((result["revenue_by_segment"] or {}).get("slices") or []) >= 2: n_blocs += 1
        if result.get("revenue_by_geography") and len((result["revenue_by_geography"] or {}).get("slices") or []) >= 2: n_blocs += 1
        if (result.get("risks") or []) and len(result["risks"]) >= 3: n_blocs += 1
        if result.get("governance"): n_blocs += 1
        if result.get("ai_positioning"): n_blocs += 1
        if (result.get("events") or []) and len(result["events"]) >= 3: n_blocs += 1
        if result.get("interpretation"): n_blocs += 1

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
            continue

        if n_blocs >= 8:
            ok += 1
            log_line(f"  {tk}: OK blocs={n_blocs}")
        else:
            partial += 1
            log_line(f"  {tk}: PARTIAL blocs={n_blocs}")

    log_line(f"END: ok={ok} partial={partial} no_src={no_source} fails={fails}")


if __name__ == "__main__":
    main()
