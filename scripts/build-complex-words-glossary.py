#!/usr/bin/env python3
"""
Génère un glossaire de mots compliqués (FR) via Cerebras Qwen-3 235B free tier.

Pour chaque terme de la liste hardcodée TERMS ci-dessous, génère une explication
en FR claire compréhensible par un adolescent de 16 ans SANS formation financière.
Max 25 mots par explication.

Output : src/data/complex-words-glossary.json

Usage :
  python3 scripts/build-complex-words-glossary.py
  python3 scripts/build-complex-words-glossary.py --resume   # reprend manquants
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import certifi  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
CTX = ssl.create_default_context(cafile=certifi.where())

# Cerebras keys (rotation)
KEYS: list[str] = []
env = ROOT / ".env.local"
if env.exists():
    for line in env.read_text().splitlines():
        if line.startswith(("CEREBRAS_API_KEY=", "CEREBRAS2_API_KEY=", "CEREBRAS3_API_KEY=")):
            KEYS.append(line.split("=", 1)[1].strip())
if not KEYS:
    print("Aucune clé Cerebras dans .env.local", file=sys.stderr)
    sys.exit(1)

OUT_PATH = ROOT / "src/data/complex-words-glossary.json"

# Liste des termes à expliquer, organisés par catégorie.
# Niveau: basic = vocabulaire utile à connaître, intermediate = jargon, advanced = très technique
TERMS: dict[str, tuple[str, str]] = {
    # Comptable & rentabilité
    "Goodwill": ("comptable", "intermediate"),
    "EBITDA": ("comptable", "intermediate"),
    "EBIT": ("comptable", "intermediate"),
    "FCF": ("comptable", "intermediate"),
    "Free Cash Flow": ("comptable", "intermediate"),
    "OPEX": ("comptable", "intermediate"),
    "CAPEX": ("comptable", "intermediate"),
    "Working Capital": ("comptable", "advanced"),
    "BFR": ("comptable", "advanced"),
    "Amortissement": ("comptable", "basic"),
    "Provisions": ("comptable", "intermediate"),
    "ROIC": ("comptable", "advanced"),
    "ROCE": ("comptable", "advanced"),
    "ROE": ("comptable", "intermediate"),
    "ROA": ("comptable", "intermediate"),
    "EPS": ("comptable", "intermediate"),
    "Dilution": ("comptable", "intermediate"),
    "Op Margin": ("comptable", "intermediate"),
    "Operating Margin": ("comptable", "intermediate"),
    "Gross Margin": ("comptable", "basic"),
    "Net Income": ("comptable", "basic"),
    "Operating Income": ("comptable", "basic"),
    "COGS": ("comptable", "intermediate"),
    "SG&A": ("comptable", "intermediate"),
    "D&A": ("comptable", "advanced"),
    "Cash Flow": ("comptable", "basic"),

    # Marché & croissance
    "CAGR": ("marche", "intermediate"),
    "TAM": ("marche", "intermediate"),
    "SAM": ("marche", "advanced"),
    "SOM": ("marche", "advanced"),
    "Market Share": ("marche", "basic"),
    "Part de marché": ("marche", "basic"),
    "Penetration": ("marche", "intermediate"),
    "Churn": ("marche", "intermediate"),
    "ARPU": ("marche", "intermediate"),
    "ARPP": ("marche", "advanced"),

    # Tech & SaaS
    "MAU": ("tech", "basic"),
    "DAU": ("tech", "basic"),
    "DAP": ("tech", "intermediate"),
    "ARR": ("tech", "intermediate"),
    "MRR": ("tech", "intermediate"),
    "NPS": ("tech", "intermediate"),
    "CAC": ("tech", "intermediate"),
    "LTV": ("tech", "intermediate"),
    "GMV": ("tech", "intermediate"),
    "Run Rate": ("tech", "intermediate"),
    "Backlog": ("tech", "intermediate"),
    "RPO": ("tech", "advanced"),
    "NRR": ("tech", "advanced"),
    "GRR": ("tech", "advanced"),
    "Bookings": ("tech", "intermediate"),

    # Gouvernance
    "Board": ("gouvernance", "basic"),
    "Taille du board": ("gouvernance", "basic"),
    "Hero KPI": ("gouvernance", "basic"),
    "Voting Structure": ("gouvernance", "advanced"),
    "Top Capital": ("gouvernance", "intermediate"),
    "Top Voting": ("gouvernance", "intermediate"),
    "Dual Class": ("gouvernance", "advanced"),
    "CEO Comp": ("gouvernance", "intermediate"),
    "Pay Ratio": ("gouvernance", "intermediate"),
    "Say-on-Pay": ("gouvernance", "advanced"),
    "Approbation de la rémunération": ("gouvernance", "intermediate"),
    "Proxy": ("gouvernance", "advanced"),
    "DEF 14A": ("gouvernance", "advanced"),

    # Finance & valorisation
    "P/E": ("finance", "intermediate"),
    "PER": ("finance", "intermediate"),
    "PEG": ("finance", "advanced"),
    "EV": ("finance", "advanced"),
    "EV/EBITDA": ("finance", "advanced"),
    "Capitalisation boursière": ("finance", "basic"),
    "Market Cap": ("finance", "basic"),
    "Free Float": ("finance", "intermediate"),
    "Buyback": ("finance", "intermediate"),
    "Dividend": ("finance", "basic"),
    "DPS": ("finance", "intermediate"),
    "Payout Ratio": ("finance", "intermediate"),
    "Dividend Aristocrat": ("finance", "intermediate"),
    "DRIP": ("finance", "advanced"),
    "IPO": ("finance", "basic"),
    "Split": ("finance", "intermediate"),
    "Spin-off": ("finance", "advanced"),

    # Risque & réglementaire
    "Item 1A": ("risque", "advanced"),
    "Severity": ("risque", "intermediate"),
    "Sévérité": ("risque", "intermediate"),
    "Profit Warning": ("risque", "intermediate"),
    "Cyber": ("risque", "basic"),
    "Réglementaire": ("risque", "basic"),
    "10-K": ("risque", "intermediate"),
    "10-Q": ("risque", "intermediate"),
    "8-K": ("risque", "advanced"),
    "20-F": ("risque", "advanced"),
    "SEC": ("risque", "intermediate"),
    "ESG": ("risque", "basic"),

    # Banques (vocabulaire qui revient dans gouvernance / risques pour banques)
    "CET1": ("banque", "advanced"),
    "Tier 1": ("banque", "advanced"),
    "NIM": ("banque", "advanced"),
    "NII": ("banque", "advanced"),
    "RWA": ("banque", "advanced"),
    "ROTE": ("banque", "advanced"),
    "AUM": ("banque", "intermediate"),

    # Composites Mettrik
    "Rule of 40": ("composite", "advanced"),
    "Profit Power Index": ("composite", "advanced"),
    "Quality of Compounding": ("composite", "advanced"),
}


def call_cerebras(prompt: str, key_idx: int = 0, retries: int = 4) -> str | None:
    for attempt in range(retries):
        key = KEYS[(key_idx + attempt) % len(KEYS)]
        req = urllib.request.Request(
            "https://api.cerebras.ai/v1/chat/completions",
            method="POST",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "curl/7.79.1",
            },
            data=json.dumps({
                "model": "qwen-3-235b-a22b-instruct-2507",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "max_tokens": 4000,
                "response_format": {"type": "json_object"},
            }).encode(),
        )
        try:
            r = urllib.request.urlopen(req, timeout=60, context=CTX)
            body = json.loads(r.read())
            return body["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"HTTPError {e.code} attempt {attempt}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Erreur tentative {attempt}: {e}", file=sys.stderr)
            time.sleep(1)
    return None


PROMPT_TEMPLATE = """Tu écris pour un adolescent FRANÇAIS de 16 ans qui ne connaît rien à la finance ni à la bourse.

Pour CHACUN des termes ci-dessous, donne une explication en français en UNE SEULE phrase de 15 à 25 mots, claire et compréhensible immédiatement.

Règles strictes :
- Pas d'em-dash (—). Utiliser ":" ou couper en deux phrases si besoin.
- Pas de jargon. Si un autre acronyme apparaît dans ton explication, traduis-le dans la phrase.
- Ton vocabulaire = simple, concret. Donner un exemple court si utile.
- Vocabulaire français strict (pas "value-add", pas "leverage" : dire "plus-value", "effet de levier").
- Format de sortie OBLIGATOIRE : JSON object {"term1": "explication", "term2": "explication", ...} avec exactement les mêmes clés que demandé.

Termes à expliquer (renvoie le JSON avec toutes ces clés) :
{terms_json}
"""


def build_glossary(resume: bool = False) -> None:
    existing: dict = {}
    if resume and OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text())
    pending: list[str] = []
    for term in TERMS:
        if resume and term in existing and existing[term].get("explanation_fr"):
            continue
        pending.append(term)

    if not pending:
        print("Tous les termes déjà générés. Rien à faire.")
        return

    print(f"À générer : {len(pending)} termes (resume={resume})")

    # Batch par 20 termes pour rester sous max_tokens
    BATCH = 20
    explanations: dict[str, str] = {}
    for i in range(0, len(pending), BATCH):
        chunk = pending[i:i + BATCH]
        prompt = PROMPT_TEMPLATE.replace("{terms_json}", json.dumps(chunk, ensure_ascii=False))
        print(f"  Batch {i // BATCH + 1} ({len(chunk)} termes)...", flush=True)
        raw = call_cerebras(prompt, key_idx=(i // BATCH) % len(KEYS))
        if not raw:
            print(f"    !! échec batch", file=sys.stderr)
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"    !! JSON invalide : {e}", file=sys.stderr)
            continue
        for term, expl in parsed.items():
            if isinstance(expl, str) and expl.strip():
                explanations[term] = expl.strip().replace("—", " : ")
        time.sleep(0.5)

    # Merger résultat
    final: dict[str, dict] = dict(existing)
    for term, (category, level) in TERMS.items():
        entry = final.get(term, {})
        if term in explanations:
            entry["explanation_fr"] = explanations[term]
            entry["_pending_explanation"] = False
        elif "explanation_fr" not in entry:
            entry["explanation_fr"] = ""
            entry["_pending_explanation"] = True
        entry["category"] = category
        entry["level"] = level
        final[term] = entry

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n")
    n_ok = sum(1 for v in final.values() if not v.get("_pending_explanation") and v.get("explanation_fr"))
    n_pending = sum(1 for v in final.values() if v.get("_pending_explanation"))
    print(f"Glossaire écrit : {OUT_PATH}")
    print(f"  Termes total       : {len(final)}")
    print(f"  Explications OK    : {n_ok}")
    print(f"  En attente (pending): {n_pending}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--resume", action="store_true", help="Reprend seulement les termes manquants")
    args = ap.parse_args()
    build_glossary(resume=args.resume)


if __name__ == "__main__":
    main()
