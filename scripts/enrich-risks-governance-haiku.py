#!/usr/bin/env python3
"""
enrich-risks-governance-haiku.py — extrait risks (Item 1A) + governance
(DEF14A) pour les stés V1.7 Pass 3 strict qui en manquent. Haiku 4.5
direct (Anthropic), même prompts que pipeline-llm-pass2.py de CONV-DATA
mais écrit dans `v2-pipeline-enrich/<ticker>.json` pour pas écraser le
dataset CONV-DATA.

Pourquoi : CONV-DATA est inactive sur ce périmètre depuis le 5 mai. Yann
veut « tout ce qu'il manque » sur les pages sté. load-company.ts merge
les enrich files automatiquement.

Coût : ~$0.005 / sté (Haiku 4.5). 326 risks + 339 gov = ~665 calls.
Total ~$3.5. Yann sur Max plan, OK.

Usage :
    python3 scripts/enrich-risks-governance-haiku.py [--limit N] [--force]
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
AUDIT = PROJECT_ROOT / "src/data/v1-7-blocks-audit.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"


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


def find_filing(ticker: str, form: str = "10K") -> str | None:
    """form ∈ {'10K', '20F', 'DEF14A'}."""
    tu = ticker.upper()
    bases = [
        SEC / "cat1-us" / form,
        SEC / "cat2-foreign-adr" / form,
    ]
    for base in bases:
        if not base.exists():
            continue
        years = sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)
        for year_dir in years[:3]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read())
                except Exception:
                    continue
    return None


def extract_risk_factors(text: str, max_chars: int = 18000) -> str:
    """Cherche le bloc 'Risk Factors' dans 10-K Item 1A ou 20-F Item 3.D.
    Tolère les séparateurs ',' '.' ' ' entre Item 1A et Risk Factors. Si
    pas trouvé, fallback sur la dernière occurrence brute de 'Risk Factors'.
    """
    if not text:
        return ""
    # Pattern spécifique Item 1A/3D (le plus précis)
    matches = list(re.finditer(
        r"(?:item\s+1a[\.\,\s]+risk\s+factors|item\s+3[\.\,\s]*d[\.\,\s]+risk\s+factors)",
        text, re.IGNORECASE
    ))
    if not matches:
        # Fallback : dernière occurrence brute de "Risk Factors" qui n'est
        # pas dans un TOC (skip les premières occurrences si trop tôt).
        all_rf = list(re.finditer(r"risk\s+factors", text, re.IGNORECASE))
        if not all_rf:
            return ""
        # Skip les TOC : prend la dernière occurrence APRÈS au moins 5 % du
        # document (pour éviter la table des matières)
        cutoff = int(len(text) * 0.05)
        late_matches = [m for m in all_rf if m.start() >= cutoff]
        if not late_matches:
            return ""
        # Prend la première occurrence "tardive" qui est suivie de assez
        # de texte (pas un cross-reference dans le corps).
        start = late_matches[0].start()
    else:
        start = matches[-1].start()
    return re.sub(r"\s+", " ", text[start:start + max_chars + 2000])[:max_chars]


def extract_governance_section(text: str, max_chars: int = 14000) -> str:
    if not text:
        return ""
    keywords = [
        r"executive\s+compensation",
        r"summary\s+compensation\s+table",
        r"compensation\s+discussion\s+and\s+analysis",
        r"director\s+compensation",
        r"beneficial\s+owners",
        r"board\s+of\s+directors",
    ]
    matches = []
    for kw in keywords:
        for m in re.finditer(kw, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches:
        return ""
    matches.sort()
    start = matches[0]
    return re.sub(r"\s+", " ", text[start:start + max_chars + 2000])[:max_chars]


def call_haiku(prompt: str, api_key: str, retries: int = 2) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": 2500,
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
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(15)
                continue
            return None
        except Exception:
            time.sleep(3)
    return None


RISKS_PROMPT = """Tu es un analyste financier. Extrais les 5-8 RISQUES principaux depuis ces extraits Item 1A / Risk Factors du 10-K de {ticker}.

Extraits :
{context}

Retourne UNIQUEMENT un JSON valide :
{{
  "risks": [
    {{
      "title": "Titre court FR (max 60 chars)",
      "category": "Macro|Régulation|Cybersécurité|Concurrence|Capital|Crédit|Géopolitique|Technologie|Industriel|Personne-clé|Litige|Reputation",
      "severity": 3,
      "score_rationale": "1-2 phrases citant (1) position dans le 10-K, (2) intensité langage, (3) tendance vs N-1, (4) pondération catégorie",
      "trend": "new|up|stable|down|removed",
      "summary": "1-2 phrases en français accessible"
    }}
  ]
}}

Règles : 5 à 8 risques max. Ne JAMAIS inventer. Si vraiment moins de 5 identifiables, retourne moins. severity entier 1-5 (1=mineur, 5=existentiel).
"""

GOV_PROMPT = """Extrais la GOUVERNANCE depuis le DEF14A de {ticker}. Retourne UNIQUEMENT JSON :

Extraits :
{context}

Format strict :
{{
  "agm_date": "YYYY-MM-DD",
  "fiscal_year": 2024,
  "ceo_name": "...",
  "ceo_total_comp_m": 12.5,
  "ceo_pay_ratio": 250,
  "exec_comp_approval_pct": 95,
  "board_independence_pct": 80,
  "board_size": 12,
  "avg_tenure_years": 6.5,
  "board_women_pct": 33,
  "voting_structure": "1 phrase",
  "top_capital": [
    {{"name": "...", "type": "institutionnel|fondateur|insider|particulier|fonds souverain", "stake_pct": 8.5}}
  ],
  "top_voting": []
}}

Ne JAMAIS inventer. Omet les champs absents (ne mets pas 0 ou "n/a"). Si aucun champ identifiable, retourne {{}}.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", choices=["risks", "governance"], default=None)
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY introuvable", file=sys.stderr)
        sys.exit(1)

    if not AUDIT.exists():
        print(f"❌ {AUDIT} introuvable", file=sys.stderr)
        sys.exit(1)
    audit = json.loads(AUDIT.read_text())

    do_risks = args.only != "governance"
    do_gov = args.only != "risks"

    pending_risks = [t for t, flags in audit.items() if "MISSING_RISKS" in flags] if do_risks else []
    pending_gov = [t for t, flags in audit.items() if "MISSING_GOVERNANCE" in flags] if do_gov else []

    # Combine, dédup, prioriser stés cat 1 US (sec-data)
    pending = list(dict.fromkeys(pending_risks + pending_gov))
    pending = [t for t in pending if "." not in t]  # cat 1 only (sec-data principalement)

    if args.limit:
        pending = pending[: args.limit]
    print(f"📊 Risks + Governance Haiku 4.5 : {len(pending)} stés (risks={len(pending_risks)}, gov={len(pending_gov)})", flush=True)

    risks_written = 0
    gov_written = 0
    no_text = 0

    last_call = 0.0
    for i, t in enumerate(pending):
        elapsed = time.time() - last_call
        if elapsed < 1.3:
            time.sleep(1.3 - elapsed)
        last_call = time.time()

        out_path = ENR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        changed = False

        # RISKS
        if do_risks and t in pending_risks and (args.force or not existing.get("risks")):
            text = find_filing(t, "10K")
            if not text:
                text = find_filing(t, "20F")
            ctx = extract_risk_factors(text or "")
            if ctx:
                prompt = RISKS_PROMPT.format(ticker=t, context=ctx)
                result = call_haiku(prompt, api_key)
                if result and isinstance(result.get("risks"), list) and result["risks"]:
                    existing["risks"] = result["risks"][:8]
                    risks_written += 1
                    changed = True
            else:
                no_text += 1

        # GOVERNANCE
        if do_gov and t in pending_gov and (args.force or not existing.get("governance")):
            text = find_filing(t, "DEF14A")
            ctx = extract_governance_section(text or "")
            if ctx and len(ctx) > 1500:
                prompt = GOV_PROMPT.format(ticker=t, context=ctx)
                result = call_haiku(prompt, api_key)
                if result and isinstance(result, dict) and any(result.get(k) for k in ("ceo_name", "board_size", "agm_date")):
                    existing["governance"] = result
                    gov_written += 1
                    changed = True

        if changed:
            existing["_risks_gov_fetched_at"] = datetime.now(timezone.utc).isoformat()
            out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

        if (i + 1) % 25 == 0:
            print(f"  …{i+1}/{len(pending)} (risks={risks_written}, gov={gov_written}, no_text={no_text})", flush=True)

    print(f"\n✅ Risks : {risks_written} stés enrichies. Governance : {gov_written} stés. Sans 10-K/DEF14A : {no_text}.", flush=True)


if __name__ == "__main__":
    main()
