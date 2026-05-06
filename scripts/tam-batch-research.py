#!/usr/bin/env python3
"""
tam-batch-research.py — recherche TAM en batch pour les stés V1.7 dont
le secteur est "TAM-likely" (forte probabilité de disclosure company).

Stratégie :
  1. Liste les stés V1.7 (Pass 3 ready) dont le secteur est dans la
     whitelist TAM-likely.
  2. Pour chaque sté, skip si `src/data/v2-pipeline-enrich/<ticker>.tam.json`
     existe déjà.
  3. Sinon, appelle Claude API (claude-sonnet-4) avec un prompt strict :
     - Lit le 10-K / 20-F local extrait dans ~/spx-app/sec-data/
     - Extrait TAM si company-disclosed
     - Output JSON conforme à market_positions Mettrik
     - STRICT honesty rule : aucune source tierce (Gartner/IDC), pas de
       verbatim >15 mots
  4. Écrit dans `src/data/v2-pipeline-enrich/<ticker>.tam.json`.
  5. Sleep 1s entre chaque sté pour respecter rate limit Anthropic.

Usage :
    python3 scripts/tam-batch-research.py [--limit N] [--dry-run]
    nohup python3 scripts/tam-batch-research.py > /tmp/tam-batch.log 2>&1 &

Sectors TAM-likely :
  - Information Technology (319 stés V1.7)
  - Health Care / Healthcare (68 stés)
  - Communication Services (incluse souvent dans "Consumer Discretionary")
  - Consumer Discretionary partiel (auto/tech consumer)
  - Energy partiel (renouvelables, pas oil pur)
  - Industrials partiel (industrial software, defense, semi-cap)

Plan Yann 5 mai 2026 : utiliser quota Anthropic Max pour eviter $.
"""

import argparse
import json
import os
import sys
import time
import gzip
import re
from pathlib import Path
from anthropic import Anthropic

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MERGED = PROJECT_ROOT / "src/data/v2-pipeline/_merged.json"
ENRICH_DIR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC_DATA = PROJECT_ROOT / "sec-data"
LOG_FILE = Path("/tmp/tam-batch.log")

ENRICH_DIR.mkdir(parents=True, exist_ok=True)

# Charge .env.local
env_path = PROJECT_ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text("utf-8").splitlines():
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line)
        if m:
            # setdefault skip si var deja set (meme vide). Force avec direct assign
            # car certaines vars peuvent etre dans l'env shell mais vides.
            v = m.group(2).strip('"').strip("'")
            if v:
                os.environ[m.group(1)] = v

if not os.environ.get("ANTHROPIC_API_KEY"):
    print("❌ ANTHROPIC_API_KEY manquante dans .env.local")
    sys.exit(1)

# Sectors où TAM est typiquement disclosed par les sociétés (whitelist).
# Stés hors whitelist = skip pour économiser temps + tokens.
TAM_LIKELY_SECTORS = {
    "Information Technology",
    "Health Care",
    "Healthcare",
    "Santé",
    "Communication Services",
    "Services de communication",
    "Consumer Discretionary",  # partiel : tech consumer (TSLA, AMZN), retail moins
    "Consommation cyclique",
    "Consumer Cyclical",
    "Energy",                  # partiel : renouvelables
    "Énergie",
    "Industrials",             # partiel : industrial software, defense
    "Industrie",
    "Industriels",
    # Skip : Financials, Real Estate, Utilities, Materials, Consumer Staples
    # = secteurs où TAM rarement publié (banques mature, REITs, utilities régulés)
}


def is_tam_likely(entry: dict) -> bool:
    sec = entry.get("sector", "")
    return any(t in sec for t in TAM_LIKELY_SECTORS) if sec else False


def is_pass3(entry: dict) -> bool:
    return bool(entry.get("_validation") or entry.get("_validation_global"))


def find_filing_text(ticker: str) -> str | None:
    """Cherche le 10-K / 20-F le plus récent localement et retourne son texte."""
    candidates = []
    for kind in ("10K", "20F"):
        # Format observé : sec-data/cat1-us/10K/2025/AAPL_2024-11-01.htm.gz
        for cat_dir in SEC_DATA.glob(f"cat*/{kind}/*"):
            for f in cat_dir.glob(f"{ticker.upper()}_*.htm.gz"):
                candidates.append(f)
            for f in cat_dir.glob(f"{ticker.upper()}_*.htm"):
                candidates.append(f)
    if not candidates:
        return None
    # Prends le plus récent par date dans le nom de fichier
    candidates.sort(reverse=True)
    p = candidates[0]
    try:
        if p.suffix == ".gz":
            raw = gzip.decompress(p.read_bytes())
        else:
            raw = p.read_bytes()
        text = raw.decode("utf-8", errors="ignore")
        # Strip HTML tags rough
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text[:50000]  # cap 50K chars pour rester sous le context
    except Exception:
        return None


SYSTEM_PROMPT = """You are a TAM research assistant for Mettrik AI, a KPI Intelligence app for investors.

STRICT RULES:
1. Only report a TAM if the company itself disclosed it in 10-K, 10-Q, 8-K, 20-F, investor day deck, capital markets day, or earnings call. Cite the exact source.
2. NEVER use external analyst data (Gartner, IDC, Statista, eMarketer, TrendForce, BCG, etc.). If the company didn't publish a TAM, output `no_tam_disclosed: true`.
3. Do not reproduce filing excerpts verbatim >15 words. Summarize.
4. Output STRICT JSON, no markdown fences, no commentary.
5. If you find no TAM, output: {"ticker": "X", "no_tam_disclosed": true, "reason": "..."}
6. If you find one or more TAMs, output: {"ticker": "X", "researched_at": "2026-05-05", "market_positions": [{...}]}

market_positions item structure:
{
  "segment_name": "string",
  "segment_revenue": number | null,
  "segment_unit": "$B" | "€B" | "$M" | "M patients" | "GW" | "%",
  "tam": number | null,
  "tam_unit": "string matching segment_unit",
  "tam_range": [min, max] | null,
  "source": "exact source name",
  "source_url": "if known else null",
  "source_note": "method + exact wording the company used (NOT >15 words verbatim, summarize)",
  "market_cagr": number | null,
  "is_company_disclosed": true
}
"""


def research_tam(ticker: str, name: str, sector: str, filing_text: str | None) -> dict:
    """Call Claude API with the 10-K text, extract TAM, return JSON dict."""
    client = Anthropic()
    user_msg = f"""Research TAM for {name} ({ticker}), sector {sector}.

Filing text excerpt (10-K or 20-F most recent, may be truncated to 50K chars):

{filing_text or "[No local filing available]"}

Extract any TAM the company itself discloses. Apply STRICT rules from system prompt.
Return JSON only."""

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        content = resp.content[0].text.strip()
        # Strip markdown fences if any
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
        return json.loads(content)
    except json.JSONDecodeError as e:
        return {"ticker": ticker, "error": f"JSON parse failed: {e}", "raw": content[:500]}
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Stop after N stés.")
    parser.add_argument("--dry-run", action="store_true", help="List candidates, no API call.")
    parser.add_argument("--sleep", type=float, default=1.0, help="Sleep between calls (sec).")
    args = parser.parse_args()

    merged = json.loads(MERGED.read_text("utf-8"))
    candidates = []
    for ticker, entry in merged.items():
        if not isinstance(entry, dict):
            continue
        if not is_pass3(entry):
            continue
        if not is_tam_likely(entry):
            continue
        # Skip si déjà fait (idempotent)
        out_path = ENRICH_DIR / f"{ticker.lower().replace('.', '-')}.tam.json"
        if out_path.exists():
            continue
        candidates.append((ticker, entry.get("name", "?"), entry.get("sector", "?")))

    if args.limit:
        candidates = candidates[:args.limit]

    print(f"📊 {len(candidates)} stés TAM-likely à rechercher (Pass 3 ready, secteurs whitelist, pas déjà fait)")
    by_sec = {}
    for _, _, s in candidates:
        by_sec[s] = by_sec.get(s, 0) + 1
    for s, n in sorted(by_sec.items(), key=lambda x: -x[1])[:10]:
        print(f"   {n:4d}  {s}")

    if args.dry_run:
        return

    success, skipped, errors = 0, 0, 0
    for i, (ticker, name, sector) in enumerate(candidates):
        print(f"[{i+1}/{len(candidates)}] {ticker} ({name[:40]}) ...", flush=True)
        text = find_filing_text(ticker)
        if not text:
            print(f"   ⏭ skip (no local filing found)")
            skipped += 1
            continue
        result = research_tam(ticker, name, sector, text)
        out_path = ENRICH_DIR / f"{ticker.lower().replace('.', '-')}.tam.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), "utf-8")
        if "error" in result:
            print(f"   ⚠ error: {result['error'][:100]}")
            errors += 1
        elif result.get("no_tam_disclosed"):
            print(f"   ✅ no_tam_disclosed (honesty rule)")
            success += 1
        else:
            n_pos = len(result.get("market_positions", []))
            print(f"   ✅ {n_pos} position(s) found")
            success += 1
        time.sleep(args.sleep)

    print(f"\n✅ Terminé : {success} OK, {skipped} skipped, {errors} errors / {len(candidates)} total.")


if __name__ == "__main__":
    main()
