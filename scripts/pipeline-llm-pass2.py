#!/usr/bin/env python3
"""
Pipeline LLM PASS 2 — enrichissement des datasets v2-pipeline générés en pass 1.

Ajoute aux datasets existants :
  - risks[]            : 5-8 risques scorés depuis Item 1A / 3D Risk Factors
  - governance         : CEO comp, board, voting structure depuis DEF14A (cat 1)
  - ai_positioning     : stance + 3-5 evidences depuis mentions IA dans 10-K

3 passes spécialisées par sté → 3 calls LLM courts (5-8K tokens chacun).

Run :
    python3 scripts/pipeline-llm-pass2.py [--ticker AAPL] [--all]
    python3 scripts/build-v2-pipeline-merged.ts  (à relancer après)
"""

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# Import du pipeline pass 1 (fichier avec - dans le nom)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "pipeline_llm", str(Path(__file__).resolve().parent / "pipeline-llm.py")
)
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = PROJECT_ROOT / "src/data/v2-pipeline"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/pipeline-llm-pass2.log"

# Tickers & cat mapping (ré-utilisé du pass 1)
TICKER_TO_CAT = {**{t: 1 for t in pl.TOP20_CAT1}, **{t: 2 for t in pl.TOP20_CAT2}}


def find_def14a(ticker: str) -> Path | None:
    """Cat 1 only : trouve le dernier DEF14A."""
    return pl.find_latest_filing(ticker, 1, "DEF14A")


def extract_risk_factors_section(text: str, max_chars: int = 18000) -> str:
    """Extrait Item 1A Risk Factors (10-K) ou Item 3D Risk Factors (20-F)."""
    if not text:
        return ""
    # Cherche la dernière occurrence (skip TOC)
    positions = list(
        re.finditer(
            r"(?:item\s+1a\.?\s+risk\s+factors|item\s+3\.?\s*d\s+risk\s+factors)",
            text,
            re.I,
        )
    )
    if not positions:
        return ""
    start = positions[-1].start()
    return text[start : start + max_chars]


def extract_ai_mentions(text: str, max_chars: int = 12000) -> str:
    """Extrait paragraphes contenant 'AI' / 'artificial intelligence' / 'machine learning'."""
    if not text:
        return ""
    paras = re.split(r"(?<=[.!?])\s{2,}|\n\n", text)
    relevant = [p for p in paras if re.search(r"\b(AI|artificial intelligence|machine learning|generative)\b", p, re.I)]
    joined = "\n\n".join(relevant)
    return joined[:max_chars]


def extract_governance_section(text: str, max_chars: int = 14000) -> str:
    """Extrait section governance (DEF14A : compensation + board)."""
    if not text:
        return ""
    # DEF14A : sections clés
    positions = []
    for kw in [
        r"compensation\s+discussion\s+and\s+analysis",
        r"executive\s+compensation",
        r"director\s+compensation",
        r"board\s+of\s+directors",
        r"summary\s+compensation\s+table",
    ]:
        m = re.search(kw, text, re.I)
        if m:
            positions.append(m.start())
    if not positions:
        return text[: max_chars]
    start = min(positions)
    return text[start : start + max_chars]


# ─────────────────────────────────────────────────────────────────────
# Pass 2.1 : RISKS
# ─────────────────────────────────────────────────────────────────────
async def extract_risks(ticker: str, sector: str, risk_text: str, log) -> list:
    if not risk_text or len(risk_text) < 1000:
        return []
    system = """Tu es un analyste financier expert. Extrais les principaux RISQUES d'une société depuis Item 1A Risk Factors.
Retourne UNIQUEMENT un objet JSON {"risks": [...]} avec 5-8 risques. Format de chaque risque :

{
  "title": "<title court FR, max 60 chars>",
  "category": "Macro|Régulation|Cybersécurité|Concurrence|Capital|Crédit|Géopolitique|Technologie|Industriel|Personne-clé|Litige|Reputation",
  "severity": <1-5, 1=mineur 5=existentiel>,
  "score_rationale": "1-2 phrases citant : (1) position dans le 10-K, (2) intensité du langage, (3) contexte vs N-1, (4) pondération catégorie",
  "trend": "new|up|stable|down|removed",
  "summary": "1-2 phrases en français accessible"
}

Ne JAMAIS inventer. Si moins de 5 risques identifiables, retourne moins."""
    user = f"""SOCIÉTÉ : {ticker} ({sector})

═══ EXTRAITS ITEM 1A / RISK FACTORS ═══
{risk_text[:18000]}

Extrais les 5-8 risques les plus importants. Retourne uniquement {{"risks": [...]}}.
"""
    try:
        result = await pl.call_llm_rotated(user, system, log)
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.M)
        data = json.loads(clean)
        return data.get("risks", [])
    except Exception as e:
        log(f"      [RISKS-ERR] {e}")
        return []


# ─────────────────────────────────────────────────────────────────────
# Pass 2.2 : GOVERNANCE (cat 1 only — DEF14A)
# ─────────────────────────────────────────────────────────────────────
async def extract_governance(ticker: str, gov_text: str, log) -> dict | None:
    if not gov_text or len(gov_text) < 1000:
        return None
    system = """Extrais la GOUVERNANCE d'une société depuis son DEF14A. Retourne UNIQUEMENT JSON :

{
  "agm_date": "YYYY-MM-DD",
  "fiscal_year": <int>,
  "ceo_name": "...",
  "ceo_total_comp_m": <millions $>,
  "ceo_pay_ratio": <int, ratio CEO/median employee>,
  "exec_comp_approval_pct": <%, vote say-on-pay>,
  "board_independence_pct": <%>,
  "board_size": <int>,
  "avg_tenure_years": <number>,
  "board_women_pct": <%>,
  "voting_structure": "1 phrase",
  "top_capital": [
    {"name": "...", "type": "institutionnel|fondateur|insider|particulier|fonds souverain", "stake_pct": <number>}
  ],
  "top_voting": [...]
}

Ne JAMAIS inventer. Omet les champs absents (ne mets pas 0)."""
    user = f"""SOCIÉTÉ : {ticker}

═══ EXTRAITS DEF14A (governance + compensation) ═══
{gov_text[:14000]}

Retourne uniquement le JSON gouvernance."""
    try:
        result = await pl.call_llm_rotated(user, system, log)
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.M)
        return json.loads(clean)
    except Exception as e:
        log(f"      [GOV-ERR] {e}")
        return None


# ─────────────────────────────────────────────────────────────────────
# Pass 2.3 : AI POSITIONING
# ─────────────────────────────────────────────────────────────────────
async def extract_ai_positioning(ticker: str, ai_text: str, log) -> dict | None:
    if not ai_text or len(ai_text) < 500:
        return None
    system = """Analyse la position d'une société sur l'IA depuis ses mentions dans le 10-K/20-F.

Retourne UNIQUEMENT JSON :
{
  "stance": "leader|integrator|cautious|absent",
  "summary": "2-3 phrases sur la position IA en français accessible",
  "evidence": ["evidence 1", "evidence 2", "evidence 3", ...],
  "source": ""
}

leader = la société pousse l'IA, vend des produits IA
integrator = utilise l'IA en interne ou intégrée à ses produits
cautious = mention défensive (risque concurrence, cyber, etc.)
absent = pas de mention significative

Ne JAMAIS inventer. Cite que ce qui est dans le texte."""
    user = f"""SOCIÉTÉ : {ticker}

═══ EXTRAITS MENTIONS IA / artificial intelligence / machine learning ═══
{ai_text[:12000]}

Retourne uniquement le JSON ai_positioning."""
    try:
        result = await pl.call_llm_rotated(user, system, log)
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.M)
        return json.loads(clean)
    except Exception as e:
        log(f"      [AI-ERR] {e}")
        return None


# ─────────────────────────────────────────────────────────────────────
# Main : enrichit chaque dataset existant
# ─────────────────────────────────────────────────────────────────────
async def enrich_ticker(ticker: str, cat: int, log):
    out_path = PIPELINE_DIR / f"{ticker.lower()}.json"
    if not out_path.exists():
        log(f"   [SKIP] {ticker} : pas de dataset pass 1")
        return

    with open(out_path) as f:
        dataset = json.load(f)

    log(f"\n=== {ticker} (pass 2) ===")

    # Lecture des docs
    docs = pl.gather_docs(ticker, cat)
    annual_text_full = pl.extract_text_from_htm_gz(docs.get("annual_path")) if docs.get("annual_path") else ""

    # 2.1 Risks
    risk_text = extract_risk_factors_section(annual_text_full)
    if risk_text and "risks" not in dataset:
        log(f"   → extracting risks ({len(risk_text)} chars)")
        risks = await extract_risks(ticker, dataset.get("sector", ""), risk_text, log)
        if risks:
            dataset["risks"] = risks
            log(f"   ✅ {len(risks)} risks")

    # 2.2 Governance (cat 1 only)
    if cat == 1:
        gov_path = find_def14a(ticker)
        if gov_path:
            gov_text = extract_governance_section(pl.extract_text_from_htm_gz(gov_path))
            if gov_text and not dataset.get("governance"):
                log(f"   → extracting governance ({len(gov_text)} chars)")
                gov = await extract_governance(ticker, gov_text, log)
                if gov:
                    dataset["governance"] = gov
                    log(f"   ✅ governance ok")

    # 2.3 AI Positioning (raffinement)
    ai_text = extract_ai_mentions(annual_text_full)
    if ai_text and len(ai_text) > 500:
        log(f"   → extracting AI positioning ({len(ai_text)} chars)")
        ai = await extract_ai_positioning(ticker, ai_text, log)
        if ai:
            dataset["ai_positioning"] = ai
            log(f"   ✅ AI positioning ({ai.get('stance')})")

    # Save
    with open(out_path, "w") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    log(f"   💾 {ticker} enrichi → {out_path.name}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="ex: AAPL,MSFT")
    parser.add_argument("--all", action="store_true", help="tous les datasets v2-pipeline existants")
    args = parser.parse_args()

    pl.load_env()

    # Configure providers
    def is_real_key(k):
        if not k or len(k) < 20:
            return False
        return not any(x in k.lower() for x in ["xxx", "placeholder", "todo"])

    # Cerebras3 paid en provider #1 (vitesse max), Gemini en filet
    if is_real_key(pl.os.environ.get("CEREBRAS3_API_KEY")):
        pl.PROVIDERS.append({"name": "Cerebras3", "call": pl.call_cerebras3})
    if is_real_key(pl.os.environ.get("GEMINI_API_KEY")):
        pl.PROVIDERS.append({"name": "Gemini", "call": pl.call_gemini})
    if is_real_key(pl.os.environ.get("SAMBANOVA_API_KEY")):
        pl.PROVIDERS.append({"name": "SambaNova", "call": pl.call_sambanova})
    if is_real_key(pl.os.environ.get("FIREWORKS_AI")):
        pl.PROVIDERS.append({"name": "Fireworks", "call": pl.call_fireworks})
    if is_real_key(pl.os.environ.get("NVIDIA_API_KEY")):
        pl.PROVIDERS.append({"name": "NVIDIA", "call": pl.call_nvidia})
    if is_real_key(pl.os.environ.get("NVIDIA2_API_KEY")):
        pl.PROVIDERS.append({"name": "NVIDIA2", "call": pl.call_nvidia2})
    # Désactivés (HS / quotas) :
    # if is_real_key(pl.os.environ.get("GROQ_API_KEY")):
    #     pl.PROVIDERS.append({"name": "Groq", "call": pl.call_groq})
    # if is_real_key(pl.os.environ.get("CEREBRAS_API_KEY")):
    #     pl.PROVIDERS.append({"name": "Cerebras", "call": pl.call_cerebras})
    # if is_real_key(pl.os.environ.get("OPENROUTER_API_KEY")):
    #     pl.PROVIDERS.append({"name": "OpenRouter", "call": pl.call_openrouter})

    if not pl.PROVIDERS:
        print("ERREUR : aucune clé API")
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    log(f"PASS 2 démarré. Providers : {[p['name'] for p in pl.PROVIDERS]}")

    # Determine list
    tickers = []
    if args.all:
        for f in PIPELINE_DIR.glob("*.json"):
            if f.name.startswith("_"):
                continue
            t = f.stem.upper()
            cat = TICKER_TO_CAT.get(t, 1)
            tickers.append((t, cat))
    elif args.ticker:
        for t in args.ticker.split(","):
            t = t.strip().upper()
            cat = TICKER_TO_CAT.get(t, 1)
            tickers.append((t, cat))

    log(f"Total : {len(tickers)} stés à enrichir")
    for t, cat in tickers:
        try:
            await enrich_ticker(t, cat, log)
        except Exception as e:
            log(f"[ERR] {t}: {e}")
        await asyncio.sleep(0.5)

    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
