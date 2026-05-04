#!/usr/bin/env python3
"""
translate-v17-kpis-to-de.py

Traduit le contenu textuel des KPIs des sociétés V1.7 (Pass 3 validées) en
ALLEMAND via l'API Cerebras (qwen-3-235b ou équivalent).

Champs traduits par KPI :
  - name_fr  -> name_de
  - explanation -> explanation_de
  - description -> description_de
  - signal -> signal_de

Champs hors KPIs :
  - tagline -> tagline_de
  - hero_kpi_rationale -> hero_kpi_rationale_de
  - risks[].title + description + score_rationale -> *_de
  - governance.notes -> notes_de
  - ai_positioning.summary -> summary_de
  - ai_positioning.evidence -> evidence_de

Output (SÉPARÉ des fichiers individuels CONV-DATA pour ne pas être écrasé) :
  src/data/v2-pipeline-i18n/<ticker>.de.json

Format :
  {
    "ticker": "AAPL",
    "locale": "de",
    "tagline": "...",
    "hero_kpi_rationale": "...",
    "kpis": [{ "short": "Services Revenue", "name": "...", "explanation": "...",
               "description": "...", "signal": "..." }, ...],
    "risks": [{ "title": "...", "description": "...", "score_rationale": "..." }, ...],
    "governance": { "notes": "..." },
    "ai_positioning": { "summary": "...", "evidence": [...] }
  }

Ces fichiers sont mergés au runtime par le composant CompanyView quand
locale = 'de'. La 2.0 migrera vers la table Supabase companies_v2_i18n.

Coût estimé : 421 stés × ~30 chaînes × ~0.0001$/chaîne via Cerebras = ~$1.30.

Usage :
  export CEREBRAS_API_KEY=csk-xxx
  python3 scripts/translate-v17-kpis-to-de.py [--limit N] [--ticker AAPL]

Acronymes préservés : KPI, EPS, FCF, TTM, ARPP, CAGR, IPO, EBITDA, ROIC, ROE,
P/E, GMV, MAU, DAU, ARPU, LTV, CAC, MRR, COGS, OPEX, CAPEX, SaaS, AI, ESG.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore
except ImportError:
    print("[fatal] pip install requests", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).parent.parent
MERGED_PATH = ROOT / "src/data/v2-pipeline/_merged.json"
OUT_DIR = ROOT / "src/data/v2-pipeline-i18n"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "qwen-3-235b-a22b-instruct-2507"

ACRONYMS = {
    "KPI", "EPS", "FCF", "TTM", "ARPP", "CAGR", "IPO", "EBITDA", "ROIC",
    "ROE", "ROA", "P/E", "FCFF", "FCFE", "NPV", "GMV", "MAU", "DAU", "ARPU",
    "LTV", "CAC", "MRR", "COGS", "OPEX", "CAPEX", "SaaS", "AI", "ESG", "GICS",
    "TAM", "TAC", "ABF", "DAP", "ARR",
}

SYSTEM_PROMPT = """Tu es un traducteur financier professionnel français/anglais → allemand.

RÈGLES STRICTES :
1. Traduis UNIQUEMENT en allemand naturel et précis (Hochdeutsch business).
2. Préserve les acronymes financiers (KPI, EPS, FCF, TTM, EBITDA, etc.) verbatim.
3. Préserve les noms propres (sociétés, personnes, produits) verbatim.
4. Préserve les chiffres et symboles monétaires ($, €, £, %).
5. Le ton est investisseur clair, jamais marketing inflated.
6. Pas d'em-dash. Utiliser deux-points ou virgule à la place.

Réponse : SEULEMENT le JSON traduit, sans markdown, sans commentaire."""


def is_pass3(entry: dict[str, Any]) -> bool:
    return bool(entry.get("_validation") or entry.get("_validation_global"))


def build_translation_payload(entry: dict[str, Any]) -> dict[str, Any]:
    """Extrait les champs textuels à traduire dans une structure compacte."""
    out: dict[str, Any] = {
        "tagline": entry.get("tagline", ""),
        "hero_kpi_rationale": entry.get("hero_kpi_rationale", ""),
    }
    kpis = entry.get("kpis") or []
    out["kpis"] = [
        {
            "short": k.get("short", ""),  # NOT translated, used as ID
            "name": k.get("name_fr", "") or k.get("name", ""),
            "explanation": k.get("explanation", ""),
            "description": k.get("description", ""),
            "signal": k.get("signal", ""),
        }
        for k in kpis
    ]
    risks = entry.get("risks") or []
    out["risks"] = [
        {
            "title": r.get("title", ""),
            "description": r.get("description", ""),
            "score_rationale": r.get("score_rationale", ""),
        }
        for r in risks
    ]
    gov = entry.get("governance") or {}
    out["governance"] = {"notes": gov.get("notes", "") or ""}
    ai = entry.get("ai_positioning") or {}
    out["ai_positioning"] = {
        "summary": ai.get("summary", "") or "",
        "evidence": ai.get("evidence", []) or [],
    }
    return out


def translate_payload(payload: dict[str, Any], ticker: str) -> dict[str, Any] | None:
    user_prompt = (
        f"Traduis ce JSON de la société {ticker} en allemand. "
        f"Préserve la structure exacte (mêmes clés). Préserve les `short` "
        f"des KPIs verbatim (ce sont des identifiants). Préserve aussi les "
        f"acronymes financiers : {', '.join(sorted(ACRONYMS))}.\n\n"
        f"JSON source :\n{json.dumps(payload, ensure_ascii=False)}"
    )
    headers = {
        "Authorization": f"Bearer {CEREBRAS_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
    }
    try:
        r = requests.post(CEREBRAS_URL, headers=headers, json=body, timeout=120)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        return json.loads(text)
    except Exception as e:
        print(f"[err] {ticker}: {e}")
        return None


def main():
    if not CEREBRAS_API_KEY:
        print("[fatal] CEREBRAS_API_KEY missing", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Translate only N stés (0 = all)")
    parser.add_argument("--ticker", type=str, default="", help="Translate only this ticker")
    parser.add_argument("--skip-existing", action="store_true", help="Skip stés already translated")
    args = parser.parse_args()

    merged = json.loads(MERGED_PATH.read_text())
    pass3 = {t: e for t, e in merged.items() if isinstance(e, dict) and is_pass3(e)}
    if args.ticker:
        pass3 = {args.ticker.upper(): pass3.get(args.ticker.upper())} if args.ticker.upper() in pass3 else {}

    items = list(pass3.items())
    if args.limit > 0:
        items = items[: args.limit]

    print(f"[start] {len(items)} stés Pass 3 à traduire en DE")
    done = 0
    skipped = 0
    failed = 0
    t0 = time.time()
    for ticker, entry in items:
        out_path = OUT_DIR / f"{ticker.lower()}.de.json"
        if args.skip_existing and out_path.exists():
            skipped += 1
            continue
        payload = build_translation_payload(entry)
        translated = translate_payload(payload, ticker)
        if translated is None:
            failed += 1
            continue
        translated["ticker"] = ticker
        translated["locale"] = "de"
        out_path.write_text(json.dumps(translated, ensure_ascii=False, separators=(",", ":")))
        done += 1
        if done % 10 == 0:
            elapsed = time.time() - t0
            rate = done / elapsed if elapsed else 0
            eta = (len(items) - done - skipped) / rate if rate else 0
            print(f"[progress] {done} done · {skipped} skipped · {failed} failed · ETA {eta/60:.1f} min")
        time.sleep(0.2)  # Cerebras rate limit gentle

    print(f"[end] {done} translated · {skipped} skipped · {failed} failed · {(time.time()-t0)/60:.1f} min")


if __name__ == "__main__":
    main()
