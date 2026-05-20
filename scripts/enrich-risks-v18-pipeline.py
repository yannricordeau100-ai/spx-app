#!/usr/bin/env python3
"""
enrich-risks-v18-pipeline.py — extrait risks (Item 1A / 20-F Item 3.D /
annual-text EU) au format strict V1 Yann.

Différences vs enrich-risks-governance-haiku.py original :
  - ÉCRIT dans `src/data/v2-pipeline/<ticker>.json` (scope CONV-DATA selon
    log SHARED-STATUS 7 mai 17:05) PAS dans v2-pipeline-enrich/.
  - Lit liste pending depuis `/tmp/risks-pending-v18-and-beyond.txt`
    (priorité top 307 V1.8, puis cat2/3 au-delà).
  - Skip si risks complets déjà présents (≥3 entrées + score_rationale).
  - LLM : Haiku 4.5 (qualité éprouvée, $0.005/sté).
  - Sortie format strict V1 :
        category + severity (1-5) + score_rationale (4 critères cités) +
        trend (new|up|stable|down|removed) + title + summary
  - Loggue dans `~/spx-app/.conv-state/CONV-DATA-risks.log`.

Usage : python3 scripts/enrich-risks-v18-pipeline.py [--limit N] [--force]
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
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path("/tmp/risks-pending-v18-and-beyond.txt")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-risks.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")


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


def log_line(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


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
    tu = ticker.upper()
    for base in [SEC / "cat1-us" / form, SEC / "cat2-foreign-adr" / form]:
        if not base.exists():
            continue
        for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:3]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read())
                except Exception:
                    continue
    if form == "10K":
        cat3_dir = SEC / "cat3-european" / tu / "annual-text"
        if cat3_dir.exists():
            try:
                txt_files = sorted(cat3_dir.glob("*.txt"), reverse=True)
                for f in txt_files[:1]:
                    try:
                        return _strip_html(f.read_text(errors="ignore"))
                    except Exception:
                        continue
            except Exception:
                pass
    return None


def extract_risk_factors(text: str, max_chars: int = 18000) -> str:
    if not text:
        return ""
    matches = list(re.finditer(
        r"(?:item\s+1a[\.\,\s]+risk\s+factors|item\s+3[\.\,\s]*d[\.\,\s]+risk\s+factors)",
        text, re.IGNORECASE
    ))
    if not matches:
        all_rf = list(re.finditer(r"risk\s+factors", text, re.IGNORECASE))
        if not all_rf:
            # Fallback EU multi-langue
            for kw in [
                r"facteurs?\s+de\s+risque", r"risikofaktoren", r"fattori\s+di\s+rischio",
                r"riesgos", r"hoofdrisico",
                # UK
                r"principal\s+risks\s+and\s+uncertainties",
                r"principal\s+risks",
                r"key\s+risks",
                # DE additional
                r"wesentliche\s+risiken",
                r"risikomanagement",
                r"risikolage",
                # FR additional
                r"risques\s+principaux",
                r"facteurs\s+et\s+gestion\s+des\s+risques",
                # IT additional
                r"principali\s+rischi",
                r"gestione\s+dei\s+rischi",
                # ES additional
                r"principales\s+riesgos",
                r"gesti[óo]n\s+de\s+riesgos",
                # NL additional
                r"voornaamste\s+risico",
                r"risicofactoren",
                # SE/NO
                r"risker\s+och\s+os[äa]kerheter",
                r"v[ää]sentliga\s+risker",
                # JP (9984.T etc)
                r"リスク要因",
                r"事業等のリスク",
                # PT
                r"fatores\s+de\s+risco",
                # FI
                r"riskitekij[äa]t",
                # General fallback : section "risk" tout court
                r"\brisks?\s+and\s+uncertainties\b",
            ]:
                m = list(re.finditer(kw, text, re.IGNORECASE))
                if m:
                    cutoff = int(len(text) * 0.05)
                    late = [x for x in m if x.start() >= cutoff]
                    if late:
                        return re.sub(r"\s+", " ", text[late[0].start():late[0].start() + max_chars + 2000])[:max_chars]
            return ""
        cutoff = int(len(text) * 0.05)
        late_matches = [m for m in all_rf if m.start() >= cutoff]
        if not late_matches:
            return ""
        start = late_matches[0].start()
    else:
        start = matches[-1].start()
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


RISKS_PROMPT = """Tu es un analyste financier français. Extrais les 5-8 RISQUES principaux de la société {ticker} depuis ces extraits de "Facteurs de risque" (Item 1A 10-K / Item 3.D 20-F / equivalent EU).

Pour chaque risque, fournis :
- title : titre court FR (40-60 chars), pas anglicisme
- category : Macro|Régulation|Cybersécurité|Concurrence|Capital|Crédit|Géopolitique|Technologie|Industriel|Personne-clé|Litige|Réputation|Environnement
- severity : entier 1-5 (1=mineur, 5=existentiel)
- score_rationale : 1-2 phrases citant explicitement les 4 critères : (1) position dans le rapport (1er, milieu, fin), (2) intensité du langage ("could materially harm" vs "may affect"), (3) tendance vs N-1 (nouveau, accru, stable, atténué), (4) pondération catégorie (cyber/régulatoire = poids fort)
- trend : new|up|stable|down|removed
- summary : 1-2 phrases en français accessible (16 ans non-tech)
- citation : citation verbatim courte (max 200 chars) de l'extrait source, prouvant l'identification

Extraits :
{context}

Retourne UNIQUEMENT un JSON valide :
{{
  "risks": [
    {{
      "title": "...",
      "category": "...",
      "severity": 3,
      "score_rationale": "...",
      "trend": "stable",
      "summary": "...",
      "citation": "..."
    }}
  ]
}}

5 à 8 risques max. Ne JAMAIS inventer. Si vraiment moins de 5 identifiables, retourne moins. Pas d'em-dash dans le texte FR.

**ANTI-POLLUTION CROSS-TICKER** : extraire UNIQUEMENT les risques PROPRES à {ticker}. Si l'extrait mentionne des risques de filiales, partenaires, concurrents (deals, JV, owners, etc.), les IGNORER. Les risques rapportés doivent être des risques que SUBIT {ticker} elle-même.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ ANTHROPIC_API_KEY introuvable")
        sys.exit(1)

    if not PENDING.exists():
        log_line(f"❌ {PENDING} introuvable")
        sys.exit(1)
    pending = [l.strip() for l in PENDING.read_text().splitlines() if l.strip()]
    if args.limit:
        pending = pending[: args.limit]
    log_line(f"START : {len(pending)} stés (top 307 V1.8 d'abord, puis cat2/3)")

    written = 0
    no_source = 0
    skipped = 0
    fails = 0

    last_call = 0.0
    t_start = time.time()
    for i, tk in enumerate(pending):
        elapsed = time.time() - last_call
        if elapsed < 1.3:
            time.sleep(1.3 - elapsed)
        last_call = time.time()

        out_path = PIPELINE / f"{tk.lower()}.json"
        if not out_path.exists():
            log_line(f"  ⚠ {tk} : pas dans v2-pipeline (skip)")
            continue
        try:
            existing = json.loads(out_path.read_text())
        except Exception:
            log_line(f"  ⚠ {tk} : JSON corrompu (skip)")
            continue

        # Skip si déjà risks complets + score_rationale (sauf --force)
        if not args.force:
            r_ex = existing.get("risks", [])
            if isinstance(r_ex, list) and len(r_ex) >= 3 and any(isinstance(x, dict) and x.get("score_rationale") for x in r_ex):
                skipped += 1
                continue

        # Source 10-K → 20-F → cat3 EU
        text = find_filing(tk, "10K") or find_filing(tk, "20F")
        ctx = extract_risk_factors(text or "")
        if not ctx or len(ctx) < 1500:
            no_source += 1
            log_line(f"  🚫 {tk} : section Risk Factors introuvable")
            continue

        prompt = RISKS_PROMPT.format(ticker=tk, context=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result.get("risks"), list) or not result["risks"]:
            fails += 1
            log_line(f"  ❌ {tk} : LLM fail")
            continue

        risks = result["risks"][:8]
        existing["risks"] = risks
        existing["_risks_fetched_at"] = datetime.now(timezone.utc).isoformat()
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk} : {len(risks)} risks ({risks[0].get('category', '?')[:12]}…, severity {risks[0].get('severity', '?')})")

        if (i + 1) % 25 == 0:
            elapsed_min = (time.time() - t_start) / 60
            rate = (i + 1) / elapsed_min if elapsed_min > 0 else 0
            eta_min = (len(pending) - i - 1) / rate if rate > 0 else 0
            log_line(f"  📊 [{i+1}/{len(pending)}] written={written} skipped={skipped} no_source={no_source} fails={fails} | rate={rate:.1f}/min ETA={eta_min:.0f}min")

    log_line(f"END : written={written} skipped={skipped} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
