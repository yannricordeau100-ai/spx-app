#!/usr/bin/env python3
"""
enrich-ai-positioning-v2.py — Process complet pour générer un AI positioning
de qualité PV (plus-value investisseur) sur les V1.8 stés.

Yann le 8 mai 2026 :
  "Apple AI positioning 'AUCUN POSITIONNEMENT' = grotesque pour Apple en 2026.
   Le script v1 ne lisait QUE le 10-K (qui minimise par convention) et ratait
   les keynotes WWDC, earnings calls, product launches."

Process (cf. docs `/sandbox/data-status` tooltip "i", interne, JAMAIS prod) :

  1. CATÉGORISATION GICS sub-industry → AI relevance bucket :
       HIGH    = AI-natif (Software, Semiconductors, IT Services, Internet…)
       MEDIUM  = AI-integrator probable (Banks, Insurance, Pharma, Auto, Defense…)
       LOW     = AI marginal (Capital Goods, Materials, Energy)
       NONE    = AI non-pertinent (REIT, Utilities, Tobacco, Food, Beverages…)

  2. SOURCES MULTIPLES (au-delà du seul 10-K) :
       - 10-K full text (sec-data/cat1-us, cat3-european)
       - Earnings call transcripts (src/data/transcripts/<TICKER>.json)
       - 8-K les plus récents (cat1-us/8K)
       - V2.0 (futur) : Brave Search API → articles 2026 sur le positionnement IA

  3. EXTRACTION via Cerebras Llama 3.3 70B (gratuit, 30 req/min) avec
     prompt qui DEMANDE de combiner sources + reformuler (no copy/paste).

  4. POUR LES "NONE" : texte template "patience V2.0" qui reste
     transparent et factuel ("le secteur n'est pas significativement
     transformé par l'IA aujourd'hui ; analyse approfondie en V2.0").

  5. OUTPUT : src/data/v2-pipeline-enrich/<ticker>.ai-pos.json
     Format AIPositioning compatible (stance + evidence + summary FR).

  6. DEPLOY : merge automatique via load-company.ts.

Usage :
    python3 scripts/enrich-ai-positioning-v2.py [--limit N] [--top-priority]
                                                [--bucket HIGH|MEDIUM|LOW|NONE]
                                                [--tickers AAPL,MSFT,...]
                                                [--force]

Modes typiques :
    # Phase 1 : top 20 AI-natifs prioritaires (résultats vendables vite)
    python3 scripts/enrich-ai-positioning-v2.py --top-priority

    # Phase 2 : tout le top 308 hors China, par bucket
    python3 scripts/enrich-ai-positioning-v2.py --bucket HIGH
    python3 scripts/enrich-ai-positioning-v2.py --bucket MEDIUM
    python3 scripts/enrich-ai-positioning-v2.py --bucket LOW

    # Phase 3 : NONE = template patience (instantané)
    python3 scripts/enrich-ai-positioning-v2.py --bucket NONE
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

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
TRANSCRIPTS = PROJECT_ROOT / "src/data/transcripts"
SEC = PROJECT_ROOT / "sec-data"
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "llama-3.3-70b"

# Anthropic Haiku 4.5 fallback / primary (gratuit ~$0.005/sté, fiable).
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

# ─── PRIORITÉ : TOP 20 AI-NATIFS (Phase 1) ────────────────────────────
# Stés avec lesquelles un investisseur exigeant attend ABSOLUMENT un
# positionnement IA détaillé. Toutes ont une stratégie IA explicite + des
# annonces 2026.
TOP_AI_NATIVE = [
    "MSFT", "GOOGL", "META", "AAPL", "NVDA", "AMZN", "AMD", "NFLX",
    "ORCL", "PLTR", "CRM", "ADBE", "IBM", "SNOW", "CRWD", "DDOG",
    "NOW", "INTU", "ASML", "TSM", "AVGO", "MU", "ARM", "DELL",
]

# ─── CATEGORISATION GICS sub-industry → AI bucket ──────────────────────
# HIGH = AI-natif. Les sés DOIVENT avoir un positionnement IA visible.
# MEDIUM = AI-integrator. Probablement présent comme outil ou partenariat.
# LOW = marginal. Mention possible mais pas central.
# NONE = non-applicable. Template patience.
SUBINDUSTRY_BUCKET: dict[str, str] = {
    # ─── HIGH ────────────────────────────────────────────────
    "Application Software": "HIGH",
    "Systems Software": "HIGH",
    "Internet Services & Infrastructure": "HIGH",
    "IT Consulting & Other Services": "HIGH",
    "Data Processing & Outsourced Services": "HIGH",
    "Semiconductors": "HIGH",
    "Semiconductor Materials & Equipment": "HIGH",
    "Communications Equipment": "HIGH",
    "Technology Hardware, Storage & Peripherals": "HIGH",
    "Interactive Media & Services": "HIGH",
    "Movies & Entertainment": "HIGH",  # Netflix/Disney IA recommendation
    "Streaming Entertainment": "HIGH",  # NFLX
    "Internet & Direct Marketing Retail": "HIGH",  # Amazon/Shopify

    # ─── MEDIUM ──────────────────────────────────────────────
    "Diversified Banks": "MEDIUM",
    "Regional Banks": "MEDIUM",
    "Investment Banking & Brokerage": "MEDIUM",
    "Asset Management & Custody Banks": "MEDIUM",
    "Insurance Brokers": "MEDIUM",
    "Multi-line Insurance": "MEDIUM",
    "Property & Casualty Insurance": "MEDIUM",
    "Life & Health Insurance": "MEDIUM",
    "Reinsurance": "MEDIUM",
    "Financial Exchanges & Data": "MEDIUM",
    "Pharmaceuticals": "MEDIUM",
    "Biotechnology": "MEDIUM",
    "Health Care Equipment": "MEDIUM",
    "Health Care Technology": "MEDIUM",
    "Health Care Services": "MEDIUM",
    "Aerospace & Defense": "MEDIUM",
    "Automobile Manufacturers": "MEDIUM",
    "Automotive Parts & Equipment": "MEDIUM",
    "Auto Components": "MEDIUM",
    "Industrial Conglomerates": "MEDIUM",
    "Specialty Retail": "MEDIUM",
    "Hotels, Resorts & Cruise Lines": "MEDIUM",
    "Restaurants": "MEDIUM",
    "Apparel, Accessories & Luxury Goods": "MEDIUM",
    "Education Services": "MEDIUM",
    "Advertising": "MEDIUM",
    "Publishing & Broadcasting": "MEDIUM",
    "Cable & Satellite": "MEDIUM",
    "Integrated Telecommunication Services": "MEDIUM",
    "Wireless Telecommunication Services": "MEDIUM",
    "Air Freight & Logistics": "MEDIUM",
    "Trading Companies & Distributors": "MEDIUM",
    "Diversified Support Services": "MEDIUM",

    # ─── LOW ─────────────────────────────────────────────────
    "Construction Machinery & Heavy Trucks": "LOW",
    "Industrial Machinery": "LOW",
    "Electrical Components & Equipment": "LOW",
    "Specialty Chemicals": "LOW",
    "Diversified Chemicals": "LOW",
    "Construction Materials": "LOW",
    "Steel": "LOW",
    "Metal & Glass Containers": "LOW",
    "Paper Packaging": "LOW",
    "Oil & Gas Exploration & Production": "LOW",
    "Oil & Gas Refining & Marketing": "LOW",
    "Oil & Gas Storage & Transportation": "LOW",
    "Integrated Oil & Gas": "LOW",
    "Gold": "LOW",
    "Diversified Metals & Mining": "LOW",
    "Aluminum": "LOW",
    "Copper": "LOW",
    "Marine": "LOW",
    "Railroads": "LOW",
    "Trucking": "LOW",

    # ─── NONE ────────────────────────────────────────────────
    "Multi-Utilities": "NONE",
    "Electric Utilities": "NONE",
    "Gas Utilities": "NONE",
    "Water Utilities": "NONE",
    "Independent Power Producers & Energy Traders": "NONE",
    "Renewable Electricity": "NONE",
    "Tobacco": "NONE",
    "Brewers": "NONE",
    "Distillers & Vintners": "NONE",
    "Soft Drinks": "NONE",
    "Packaged Foods & Meats": "NONE",
    "Agricultural Products": "NONE",
    "Household Products": "NONE",
    "Personal Products": "NONE",
    "Real Estate Investment Trusts": "NONE",
    "Office REITs": "NONE",
    "Residential REITs": "NONE",
    "Industrial REITs": "NONE",
    "Health Care REITs": "NONE",
    "Hotel & Resort REITs": "NONE",
    "Diversified REITs": "NONE",
    "Specialized REITs": "NONE",
    "Retail REITs": "NONE",
    "Real Estate Operating Companies": "NONE",
    "Real Estate Services": "NONE",
    "Real Estate Development": "NONE",
}


def load_env() -> None:
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


def bucket_for(subsector: str) -> str:
    """Catégorise un sub-sector GICS en HIGH/MEDIUM/LOW/NONE."""
    if not subsector:
        return "MEDIUM"  # default raisonnable
    # Match direct
    if subsector in SUBINDUSTRY_BUCKET:
        return SUBINDUSTRY_BUCKET[subsector]
    # Match fuzzy : "Software" dans subsector → HIGH
    sl = subsector.lower()
    if any(k in sl for k in ["software", "semiconductor", "internet", "data", "cloud", "ai"]):
        return "HIGH"
    if any(k in sl for k in ["bank", "insurance", "pharma", "biotech", "health", "auto", "defense"]):
        return "MEDIUM"
    if any(k in sl for k in ["reit", "utility", "tobacco", "food", "beverage", "real estate"]):
        return "NONE"
    return "MEDIUM"  # default


# ─── SOURCES TEXT GATHERING ────────────────────────────────────────────


def _strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt)
    return txt


def find_10k_text(ticker: str) -> str:
    """Cherche 10-K / 20-F / annual-text local. Vide si rien."""
    tu = ticker.upper()
    # cat 1 + cat 2 HTML compressé
    for sub in ["cat1-us/10K", "cat2-foreign-adr/20F", "cat2-foreign-adr/10K"]:
        base = SEC / sub
        if not base.exists():
            continue
        years = sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)
        for year_dir in years[:2]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read())[:80_000]
                except Exception:
                    continue
    # cat 3 EU annual-text
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.is_dir():
        try:
            for f in sorted(cat3.glob("*.txt"), reverse=True)[:1]:
                return f.read_text(errors="ignore")[:80_000]
        except Exception:
            pass
    return ""


def find_transcript_text(ticker: str) -> str:
    """Cherche le dernier earning call transcript local."""
    for cand in [TRANSCRIPTS / f"{ticker.upper()}.json", TRANSCRIPTS / f"{ticker.lower()}.json"]:
        if cand.exists():
            try:
                d = json.loads(cand.read_text())
                content = d.get("latest", {}).get("content", "")
                if isinstance(content, str):
                    return content[:40_000]
            except Exception:
                continue
    return ""


def extract_ai_relevant_passages(text: str, max_chars: int = 14_000) -> str:
    """Extrait les passages mentionnant IA / ML / data / digital."""
    if not text:
        return ""
    patterns = [
        r"artificial intelligence",
        r"\bAI\b",
        r"machine learning",
        r"\bML\b",
        r"deep learning",
        r"neural network",
        r"large language model|\bLLM\b",
        r"generative AI|gen AI|GenAI",
        r"copilot|chatgpt|claude|gemini|copilot",
        r"foundation model",
        r"intelligence augment",
        r"predictive analytics",
        r"data scien",
        r"model training",
        r"inference",
        r"\bGPU\b|\bTPU\b|\bNPU\b",
        r"automation",
        r"recommendation engine",
        r"natural language",
        r"computer vision",
    ]
    rx = re.compile("|".join(patterns), re.IGNORECASE)
    matches = list(rx.finditer(text))
    if not matches:
        return ""
    windows: list[tuple[int, int]] = []
    BEFORE = 250
    AFTER = 1200
    for m in matches:
        start = max(0, m.start() - BEFORE)
        end = min(len(text), m.end() + AFTER)
        if windows and start <= windows[-1][1]:
            windows[-1] = (windows[-1][0], max(windows[-1][1], end))
        else:
            windows.append((start, end))
    chunks = []
    total = 0
    for s, e in windows:
        c = re.sub(r"\s+", " ", text[s:e]).strip()
        chunks.append(c)
        total += len(c)
        if total >= max_chars:
            break
    return "\n\n---\n\n".join(chunks)[:max_chars]


# ─── LLM PROMPT ────────────────────────────────────────────────────────


def prompt_for_high_medium(ticker: str, name: str, subsector: str, ai_text: str) -> str:
    return f"""Tu rédiges un bloc "Positionnement IA" pour {name} ({ticker}, sous-industrie : {subsector}) sur Mettrik AI, app KPI Intelligence pour investisseurs sérieux.

Tu disposes d'extraits du 10-K + transcripts d'earnings call les plus récents qui mentionnent IA / ML / GenAI / automation :

{ai_text}

Renvoie UNIQUEMENT un JSON, pas d'autre texte. Format :

{{
  "stance": "leader" | "integrator" | "cautious" | "absent",
  "summary": "Phrase d'amorce 1 à 2 lignes en français : qui est cette sté côté IA en 2026 ?",
  "evidence": [
    "Phrase factuelle 1 (15-30 mots) avec un fait précis sur le positionnement IA. Pas verbatim, reformulation à valeur ajoutée. Si chiffre du 10-K ou earnings call, le citer.",
    "Phrase 2 (idem)",
    "Phrase 3 (idem)",
    "Phrase 4 facultatif",
    "Phrase 5 facultatif"
  ],
  "source_note": "Mentionner brièvement les sources utilisées (ex : 10-K FY2025, transcript Q1 2026)"
}}

RÈGLES STRICTES :
- "stance" :
    leader = la sté investit massivement dans l'IA, produits IA centraux, R&D > 10 % CA, mention CEO récurrente
    integrator = la sté utilise l'IA comme outil interne ou partenariat, pas un produit central
    cautious = mentions limitées, posture prudente, IA présente mais peu mise en avant
    absent = aucun positionnement IA significatif (rare pour les sociétés HIGH/MEDIUM)

- evidence : 3 à 5 phrases. Chaque phrase = un fait concret avec valeur ajoutée pour l'investisseur (chiffre, produit, partenariat, stratégie). Pas de verbatim long (>15 mots du 10-K). Reformulation obligatoire.

- summary : 1-2 lignes courtes, ton confiant investisseur, sans em-dash.

- Pas de blabla générique du type "la société utilise l'IA pour optimiser ses opérations". Toujours un fait précis.

- Si les extraits sont creux (peu de mentions concrètes), choisis "cautious" et écris evidence factuelle limitée à ce qui est dit, sans inventer.

- FR strict : pas d'em-dash, "Mds" pas "B", vocabulaire investisseur Mettrik.
"""


def prompt_for_low(ticker: str, name: str, subsector: str, ai_text: str) -> str:
    """Pour les LOW (mentions IA marginales) : extraction prudente."""
    return prompt_for_high_medium(ticker, name, subsector, ai_text or "(aucune mention significative trouvée dans les sources locales)")


# ─── TEMPLATE PATIENCE V2.0 (NONE bucket) ─────────────────────────────


def template_for_none(ticker: str, name: str, subsector: str) -> dict:
    """Pour les sés où l'IA n'est pas un facteur direct (REIT, Utility,
    Tobacco, Food, etc.). Texte transparent : valeur ne vient pas de l'IA,
    analyse approfondie en V2.0."""
    return {
        "stance": "absent",
        "summary": f"Le secteur {subsector} n'est pas significativement transformé par l'IA aujourd'hui : la valeur de {name} s'évalue principalement sur les fondamentaux propres au secteur (positionnement, marges, cycle, génération de cash). Une analyse fine de l'usage interne de l'IA (optimisation de processus, gestion d'actifs, automation) sera ajoutée en V2.0.",
        "evidence": [
            f"{name} opère dans un sous-secteur ({subsector}) où l'IA reste à ce jour un outil interne plutôt qu'un facteur de différenciation produit.",
            "Les KPIs de la fiche (revenus, marges, ranks sectoriels) restent les meilleurs indicateurs de la qualité d'investissement.",
            "Mettrik AI tracera en V2.0 les usages internes IA quand la sté commencera à les mentionner explicitement dans ses rapports.",
        ],
        "source_note": "Analyse Mettrik AI (sub-industry classification GICS, en attente de divulgations IA explicites par la sté)",
        "_bucket": "NONE",
        "_generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── CEREBRAS CALL ────────────────────────────────────────────────────


def call_anthropic(prompt: str, api_key: str, retries: int = 2) -> dict | None:
    """Anthropic Haiku 4.5 — primary. ~$0.005/sté, fiable."""
    body = json.dumps({
        "model": ANTHROPIC_MODEL,
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }).encode()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as r:
                resp = json.loads(r.read())
                content = resp.get("content", [{}])[0].get("text", "")
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    return json.loads(m.group(0))
                return None
        except urllib.error.HTTPError as e:
            if e.code in (429, 529) and attempt < retries:
                time.sleep(3 + attempt * 3)
                continue
            return None
        except Exception:
            if attempt < retries:
                time.sleep(2)
                continue
            return None
    return None


def call_cerebras(prompt: str, api_key: str, retries: int = 2) -> dict | None:
    """Fallback Cerebras (gratuit) si Anthropic down ou crédit épuisé."""
    body = json.dumps({
        "model": CEREBRAS_MODEL,
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as r:
                resp = json.loads(r.read())
                content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    return json.loads(m.group(0))
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(2 + attempt * 2)
                continue
            return None
        except Exception:
            if attempt < retries:
                time.sleep(2)
                continue
            return None
    return None


def call_llm(prompt: str) -> dict | None:
    """Anthropic primary (fiable), Cerebras fallback (gratuit)."""
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    cerebras_key = os.environ.get("CEREBRAS_API_KEY", "")
    if anthropic_key:
        r = call_anthropic(prompt, anthropic_key)
        if r:
            return r
    if cerebras_key:
        return call_cerebras(prompt, cerebras_key)
    return None


# ─── MERGE OUTPUT ─────────────────────────────────────────────────────


def write_output(ticker: str, payload: dict) -> None:
    ENR.mkdir(parents=True, exist_ok=True)
    out = ENR / f"{ticker.lower()}.ai-pos.json"
    payload.setdefault("_generated_at", datetime.now(timezone.utc).isoformat())
    payload["ticker"] = ticker.upper()
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


# ─── MAIN ─────────────────────────────────────────────────────────────


def gather_targets(args) -> list[tuple[str, dict]]:
    """Renvoie [(ticker, dataset)] selon les args."""
    pub = json.loads(V17.read_text())
    if args.tickers:
        ts = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        return [(t, pub.get(t, {})) for t in ts if t in pub]
    if args.top_priority:
        return [(t, pub[t]) for t in TOP_AI_NATIVE if t in pub]
    out: list[tuple[str, dict]] = []
    for t, d in pub.items():
        sub = d.get("subsector", "")
        b = bucket_for(sub)
        if args.bucket and b != args.bucket:
            continue
        out.append((t, d))
    if args.limit:
        out = out[: args.limit]
    return out


def needs_processing(ticker: str, force: bool) -> bool:
    if force:
        return True
    out = ENR / f"{ticker.lower()}.ai-pos.json"
    return not out.exists()


def main():
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--top-priority", action="store_true")
    ap.add_argument("--bucket", choices=["HIGH", "MEDIUM", "LOW", "NONE"])
    ap.add_argument("--tickers", type=str, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CEREBRAS_API_KEY")):
        print("⚠️ Aucune clé LLM (ANTHROPIC_API_KEY ou CEREBRAS_API_KEY)")
        sys.exit(1)
    print(f"🤖 Provider primary : {'Anthropic Haiku 4.5' if os.environ.get('ANTHROPIC_API_KEY') else 'Cerebras Llama'}")

    targets = gather_targets(args)
    print(f"📊 AI positioning v2 — {len(targets)} stés à traiter")

    ok = 0
    skipped = 0
    template = 0
    no_resp = 0

    for i, (ticker, ds) in enumerate(targets, 1):
        if not needs_processing(ticker, args.force):
            skipped += 1
            continue

        name = ds.get("name", ticker)
        subsector = ds.get("subsector", "")
        b = bucket_for(subsector)

        # NONE → template patience instantané, pas de LLM
        if b == "NONE":
            payload = template_for_none(ticker, name, subsector)
            write_output(ticker, payload)
            template += 1
            print(f"[{i}/{len(targets)}] {ticker} ({b}) → template patience")
            continue

        # HIGH/MEDIUM/LOW → gather sources + Cerebras
        text_10k = find_10k_text(ticker)
        text_tr = find_transcript_text(ticker)
        combined = (text_10k + "\n\n=== TRANSCRIPT ===\n\n" + text_tr).strip()
        ai_passages = extract_ai_relevant_passages(combined)
        if not ai_passages and b != "HIGH":
            # LOW/MEDIUM sans aucune mention IA → template "cautious"
            payload = {
                "stance": "cautious",
                "summary": f"{name} mentionne peu l'IA dans ses communications officielles ({subsector}).",
                "evidence": [
                    f"Aucune mention significative d'IA dans le 10-K ou les earnings calls les plus récents disponibles localement.",
                    f"Le secteur {subsector} commence à intégrer l'IA mais {name} ne met pas le sujet en avant à ce jour.",
                    "Mettrik AI réévaluera le positionnement IA à chaque nouvelle publication.",
                ],
                "source_note": "Sources locales (10-K, transcripts) sans mentions IA significatives",
                "_bucket": b,
                "_no_ai_passages": True,
            }
            write_output(ticker, payload)
            template += 1
            print(f"[{i}/{len(targets)}] {ticker} ({b}) → template cautious (no IA mentions)")
            continue

        prompt = prompt_for_high_medium(ticker, name, subsector, ai_passages or "(extraits limités)")
        result = call_llm(prompt)
        if not result:
            no_resp += 1
            print(f"[{i}/{len(targets)}] {ticker} ({b}) → ❌ no LLM response")
            continue

        result["_bucket"] = b
        result["_subsector"] = subsector
        result["_sources_used"] = {
            "has_10k": bool(text_10k),
            "has_transcript": bool(text_tr),
            "ai_passages_chars": len(ai_passages),
        }
        write_output(ticker, result)
        ok += 1
        print(f"[{i}/{len(targets)}] {ticker} ({b}) → ✅ stance={result.get('stance')}, evidence={len(result.get('evidence',[]))}")

        # Rate-limit Cerebras (30 req/min) → sleep ~2.5s between calls
        time.sleep(2.5)

    print(f"\n✅ {ok} stés via Cerebras, {template} via template, {skipped} skipped, {no_resp} no_resp / {len(targets)} total")


if __name__ == "__main__":
    main()
