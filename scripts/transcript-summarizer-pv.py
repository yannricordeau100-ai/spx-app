#!/usr/bin/env python3
"""
Résumé IA orienté PV (plus-value investisseur) d'un transcript earnings call.

Template combiné Yann (A+B+C):
- Synthèse 3 lignes (tonalité + 3 KPI clés + guidance Q+1)
- Pulse 5 cards (beat/miss + driver + vigilance + guidance + LT)
- Citations Picks (3-5 verbatim taggées)
- Suivi promesses (si avant-dernier transcript dispo)
- KPI nouveaux pour stories (anti-doublon avec dataset existant)

Modèle: Cerebras Llama 3.3 70B (gratuit, ultra rapide).

Usage:
  python3 scripts/transcript-summarizer-pv.py <ticker>
  python3 scripts/transcript-summarizer-pv.py aapl nvda msft
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
OUT_DIR = ROOT / "src/data/transcript-summaries"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS_DIR = ROOT / "src/data/transcripts"  # FMP latest legacy
V2_PIPELINE = ROOT / "src/data/v2-pipeline"

# On utilise Groq Llama 3.3 70B versatile (128K context, free tier 1000/jour)
KEYS = []
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("GROQ_API_KEY="):
        KEYS.append(line.split("=", 1)[1].strip())
if not KEYS:
    print("[fatal] No GROQ_API_KEY", file=sys.stderr)
    sys.exit(1)

BASE = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"  # 128K context, gratuit, qualité top


def get_existing_kpis(ticker: str) -> list[str]:
    """Charge les KPI déjà existants pour ce ticker (anti-doublon)."""
    f = V2_PIPELINE / f"{ticker.lower()}.json"
    if not f.exists():
        return []
    try:
        d = json.loads(f.read_text())
        kpis = d.get("kpis", [])
        return [k.get("short", "") + " / " + k.get("name_fr", "") for k in kpis if k.get("short")]
    except Exception:
        return []


PROMPT_TEMPLATE = """Tu es analyste financier senior pour investisseur particulier français.

Tu reçois le transcript d'un earnings call (résultats trimestriels). Ton job : produire un résumé 100 % en BULLET POINTS, format identique pour TOUTES les sociétés.

REGLES CRITIQUES :
1. **Format unique** : 6 à 10 bullets max, courts (15-30 mots / bullet), DENSES en plus-value (PV).
2. **Chaque bullet apporte une PV concrète** : chiffre clé + signal + action. Pas de remplissage ("le CEO est content" = NON).
3. **Tu peux citer** verbatim une phrase courte entre guillemets « ... » dans un bullet quand elle est forte. Pas obligatoire.
4. **Chiffres précis OBLIGATOIRES** quand dispo : valeur + unité + delta (vs trim précédent / YoY).
5. **Anti-doublon KPI** : NE PROPOSE PAS de KPI déjà présent dans la liste ci-dessous. Vérifie chaque candidat.
6. **JSON STRICT en sortie**. Pas de texte libre avant/après.
7. **Texte en français**. Citations verbatim EN restent en EN entre guillemets.
8. **Pour chaque bullet**, identifie les abréviations / termes techniques utilisés (ex: YoY, ARR, EBITDA, FCF, G-SIB, CapEx, OpEx, ROIC, NIM, CET1, ROE, ROTE, TAC, ARPP, CAGR, Run Rate, Backlog, etc.). Liste-les dans `terms_used` pour que l'UI affiche un tooltip "i" dessus.

KPI EXISTANTS POUR CETTE STÉ (NE PAS DOUBLONNER) :
{existing_kpis}

TRANSCRIPT BRUT (Q{quarter} {year}) :
\"\"\"
{transcript}
\"\"\"

FORMAT JSON DE SORTIE (respecte EXACTEMENT cette structure) :
{{
  "tonalite_management": "1 phrase courte (ex: 'Confiance affichée sur Services, prudence sur iPhone Chine')",
  "sentiment": "bullish | neutral | cautious",
  "bullets": [
    {{"text": "Revenue total $111.2B (+17 % YoY), beat consensus +1.2 %", "type": "synthesis", "terms_used": ["YoY"]}},
    {{"text": "Services revenue $31B (+16 % YoY) : record historique, plancher récurrent qui compense cyclicité iPhone", "type": "driver", "terms_used": ["YoY"]}},
    {{"text": "iPhone $57B (+22 % YoY) malgré supply constraints", "type": "synthesis", "terms_used": ["YoY"]}},
    {{"text": "Vigilance : « despite supply constraints » (Tim Cook), risque livraisons Q3", "type": "vigilance", "terms_used": []}},
    {{"text": "Pas de guidance Q+1 chiffrée (politique Apple)", "type": "guidance", "terms_used": []}},
    {{"text": "Stratégie LT : innovation hardware + écosystème Services pour leadership IA", "type": "strategy", "terms_used": []}}
  ],
  "new_kpis_for_stories": [
    {{
      "short": "G-SIB",
      "name_fr": "Surcharge G-SIB",
      "name_en": "G-SIB Capital Surcharge",
      "value": 5.2,
      "unit": "%",
      "yoy": "+70 bp",
      "type": "Risque",
      "nature": "réglementaire",
      "description": "Surcharge de capital imposée aux banques systémiquement importantes (G-SIB) par les régulateurs internationaux.",
      "is_wow": true,
      "is_short_history": true,
      "story_category": "Réglementation",
      "source": "earnings_call_q{quarter}_{year}",
      "pv_score": 9
    }}
  ]
}}

Types autorisés pour `bullets[].type` :
- "synthesis" : chiffre/fait clé du trimestre
- "tonalite" : positionnement management
- "driver" : moteur de croissance / opportunité
- "vigilance" : risque / point faible
- "guidance" : prévisions Q+1 / année / FY
- "strategy" : stratégie long terme
- "citation" : citation forte verbatim

Réponds UNIQUEMENT le JSON, rien d'autre.
"""


def summarize(ticker: str, transcript_text: str, quarter: int, year: int, existing_kpis: list[str]) -> dict:
    """Appel Cerebras pour résumé PV-driven."""
    existing_str = "\n".join([f"  - {k}" for k in existing_kpis]) if existing_kpis else "(aucun)"
    prompt = PROMPT_TEMPLATE.format(
        existing_kpis=existing_str,
        transcript=transcript_text[:25000],  # ~6250 tokens, safe Groq 12K TPM
        quarter=quarter,
        year=year,
    )
    key = KEYS[0]
    r = requests.post(
        BASE,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 4000,
            "response_format": {"type": "json_object"},
        },
        timeout=120,
    )
    if r.status_code != 200:
        return {"error": f"HTTP {r.status_code}: {r.text[:300]}"}
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except Exception as e:
        return {"error": f"JSON parse: {e}", "raw": content[:500]}


def process(ticker: str):
    ticker = ticker.upper()
    print(f"\n=== {ticker} ===")
    src = TRANSCRIPTS_DIR / f"{ticker.lower()}.json"
    if not src.exists():
        print(f"  ❌ No transcript file: {src}")
        return None
    d = json.loads(src.read_text())
    latest = d.get("latest", {})
    content = latest.get("content", "")
    if not content or len(content) < 5000:
        print(f"  ❌ Transcript too short ({len(content)} chars)")
        return None
    quarter = latest.get("quarter")
    year = latest.get("year")
    print(f"  Transcript Q{quarter} {year}, {len(content)} chars")

    existing = get_existing_kpis(ticker)
    print(f"  Existing KPIs (anti-doublon): {len(existing)}")
    for k in existing[:5]:
        print(f"    - {k}")

    t0 = time.time()
    result = summarize(ticker, content, quarter, year, existing)
    elapsed = time.time() - t0

    if "error" in result:
        print(f"  ❌ ERROR: {result['error']}")
        return None

    new_kpis = result.get("new_kpis_for_stories", [])
    citations = result.get("citations_picks", [])
    print(f"  ✅ Generated in {elapsed:.1f}s")
    print(f"     Tonalité: {result.get('tonalite_management', '')[:120]}")
    print(f"     3 KPI clés: {len(result.get('synthese_3_kpi_cles', []))}")
    print(f"     Citations picks: {len(citations)}")
    print(f"     New KPIs for stories: {len(new_kpis)}")
    for k in new_kpis:
        print(f"       + {k.get('short')}: {k.get('name_fr')} ({k.get('story_category')}, PV={k.get('pv_score')})")

    payload = {
        "ticker": ticker,
        "quarter": f"{year}Q{quarter}",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "fmp_transcript_latest",
        "model": MODEL,
        "summary": result,
        "n_existing_kpis": len(existing),
    }
    out = OUT_DIR / f"{ticker.lower()}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"  💾 {out}")
    return payload


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/transcript-summarizer-pv.py <ticker> [ticker...]")
        sys.exit(1)
    for tk in sys.argv[1:]:
        process(tk)


if __name__ == "__main__":
    main()
