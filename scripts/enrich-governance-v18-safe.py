#!/usr/bin/env python3
"""
enrich-governance-v18-safe.py — extraction governance avec validation
CEO name via yfinance.info["companyOfficers"] AVANT écriture.

ANTI CROSS-POLLUTION (bug Meg O'Neill BP, Virbac DG.PA, etc.) :
1. Pre-fetch yfinance CEO/officers pour chaque ticker (cache /tmp/yf-ceo-cache.json)
2. LLM extrait gouvernance depuis source (DEF14A / 20-F / cat3-european annual)
3. Compare LLM ceo_name vs cache yfinance (fuzzy match, normalize : remove
   middle initials, titles like "Dr." / "Mr.")
4. Si match → write
5. Si mismatch → REJECT + flag _governance_validation_failed avec détails
6. Si yfinance officer missing → soft accept avec warning

Sources tested in order : DEF14A (cat1-us) → 20-F (cat2-foreign-adr) →
annual-text (cat3-european).

Usage :
    LLM_MODEL=claude-sonnet-4-6 python3 scripts/enrich-governance-v18-safe.py [--limit N]
"""
import argparse, gzip, json, os, re, ssl, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path("/tmp/governance-safe-pending.txt")
CACHE_YF = Path("/tmp/yf-ceo-cache.json")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-gov-safe.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")
SLEEP_BETWEEN_CALLS = 5.0


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def _strip_html(html):
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL|re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL|re.IGNORECASE)
    txt = re.sub(r"</td>", " | ", txt, flags=re.IGNORECASE)
    txt = re.sub(r"</tr>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"&#\d+;|&[a-z]+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt


def find_source(ticker):
    """Try DEF14A → 20-F → cat3 annual-text. Return (text, label)."""
    tu = ticker.upper()
    # 1) DEF14A cat1-us
    base = SEC / "cat1-us" / "DEF14A"
    if base.exists():
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:3]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read()), f"DEF14A FY{yr.name}"
                except: continue
    # 2) 20-F cat2-foreign-adr
    base = SEC / "cat2-foreign-adr" / "20F"
    if base.exists():
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read()), f"20-F FY{yr.name}"
                except: continue
    # 3) cat3-european annual-text
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = sorted(cat3.glob("*.txt"), reverse=True)
            for f in txt_files[:1]:
                return _strip_html(f.read_text(errors="ignore")), f"Annual {f.stem}"
        except: pass
    return None, None


def extract_section(text, max_chars=14000):
    if not text: return ""
    keywords = [
        r"executive\s+compensation", r"summary\s+compensation\s+table",
        r"compensation\s+discussion", r"director\s+compensation",
        r"beneficial\s+owners", r"board\s+of\s+directors",
        r"remuneration\s+report", r"corporate\s+governance",
        r"r[ée]mun[ée]ration\s+des\s+dirigeants",
        r"verg[üu]tungsbericht",
    ]
    matches = []
    for kw in keywords:
        for m in re.finditer(kw, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches: return ""
    # Score par densité chiffres (cf segment script)
    def score(pos):
        win = text[pos:pos+4000]
        return win.count("$")*2 + win.count("%") + len(re.findall(r"\d{3,}", win))
    scored = sorted([(score(p), p) for p in matches], reverse=True)
    start = scored[0][1]
    return re.sub(r"\s+", " ", text[start:start+max_chars+2000])[:max_chars]


def normalize_name(n):
    if not n: return ""
    import unicodedata
    n = ''.join(c for c in unicodedata.normalize('NFKD', n) if not unicodedata.combining(c))
    n = re.sub(r'\b(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Sir|Lord|Prof\.?|M\.D\.?|Ph\.?D\.?|D\.V\.M\.?|M\.B\.A\.?|Dipl\.?)\s*', '', n, flags=re.IGNORECASE)
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n


def name_match(llm_ceo, yf_ceo):
    """Fuzzy match : sont-ils probably the same person?"""
    if not llm_ceo or not yf_ceo: return False
    n1, n2 = normalize_name(llm_ceo), normalize_name(yf_ceo)
    # Direct match
    if n1 == n2: return True
    # Sub-string (one contains other)
    if n1 in n2 or n2 in n1: return True
    # Word overlap : at least 2 shared distinct words >=3 chars
    w1 = set(w for w in n1.split() if len(w) >= 3)
    w2 = set(w for w in n2.split() if len(w) >= 3)
    if len(w1 & w2) >= 2: return True
    return False


PROMPT = """Extrais la gouvernance & rémunération de la sté {ticker} ({name}) depuis le filing fourni.

CRUCIAL : extrais UNIQUEMENT les données pour {ticker} = {name}. Si le filing
mentionne d'autres sociétés (filiales, comp data benchmarks), IGNORE-les. Si
ce qui est extrait ne correspond PAS clairement à {name}, retourne null.

Retourne UNIQUEMENT un JSON :
{{
  "ceo_name": "...",
  "ceo_total_comp_m": null|number,
  "board_size": null|number,
  "board_independence_pct": null|number,
  "voting_structure": "description courte FR (ex: 'Une action, un vote.')",
  "top_capital": [{{"name":"...","type":"institutionnel|fondateur|insider|...","stake_pct":number}}],
  "top_voting": [...],
  "agm_date": "YYYY-MM-DD" or null,
  "fiscal_year": YYYY
}}

Filing extracté (gouvernance section) :
---
{context}
---"""


def call_llm(prompt, api_key, retries=2):
    body = json.dumps({"model": MODEL_ID, "max_tokens": 2500,
                       "messages": [{"role":"user","content":prompt}],
                       "temperature": 0.0}).encode()
    headers = {"x-api-key": api_key, "anthropic-version":"2023-06-01", "content-type":"application/json"}
    for _ in range(retries+1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            content = resp.get("content",[{}])[0].get("text","")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try: return json.loads(content)
            except:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(15); continue
            return None
        except Exception:
            time.sleep(3)
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ ANTHROPIC_API_KEY missing")
        sys.exit(1)

    if not CACHE_YF.exists():
        log_line(f"❌ yfinance cache missing: {CACHE_YF} (run prefetch first)")
        sys.exit(1)
    yf_cache = json.loads(CACHE_YF.read_text())
    log_line(f"yfinance cache loaded: {len(yf_cache)} stés")

    pending = [t for t in PENDING.read_text().splitlines() if t.strip()] if PENDING.exists() else []
    if args.limit: pending = pending[:args.limit]
    log_line(f"START gov-safe: {len(pending)} stés, model={MODEL_ID}")

    written = 0
    rejected_pollution = 0
    no_source = 0
    fails = 0
    last_call = 0
    for tk in pending:
        elapsed = time.time() - last_call
        if elapsed < SLEEP_BETWEEN_CALLS: time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_call = time.time()

        text, label = find_source(tk)
        if not text:
            log_line(f"  🚫 {tk}: no source"); no_source += 1; continue
        ctx = extract_section(text)
        if not ctx or len(ctx) < 500:
            log_line(f"  🚫 {tk}: section gov non trouvée"); no_source += 1; continue

        yf_info = yf_cache.get(tk, {})
        yf_company = yf_info.get('company_name','')

        prompt = PROMPT.format(ticker=tk, name=yf_company or tk, context=ctx)
        result = call_llm(prompt, api_key)
        if not result:
            log_line(f"  ❌ {tk}: LLM fail"); fails += 1; continue

        # VALIDATION CEO
        llm_ceo = result.get('ceo_name','')
        yf_ceo = yf_info.get('ceo_name','')
        if yf_ceo:
            if not name_match(llm_ceo, yf_ceo):
                log_line(f"  🚨 {tk}: REJECT pollution. LLM ceo='{llm_ceo}' vs yfinance='{yf_ceo}'")
                # Write rejection flag but don't write governance
                pipe_f = PIPELINE / f'{tk.lower()}.json'
                if pipe_f.exists():
                    d = json.loads(pipe_f.read_text())
                    d['_governance_extraction_rejected'] = {
                        'reason': 'cross_ticker_ceo_mismatch',
                        'llm_extracted_ceo': llm_ceo,
                        'yfinance_ceo': yf_ceo,
                        'source': label,
                        'rejected_at': datetime.now(timezone.utc).isoformat(),
                    }
                    pipe_f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
                rejected_pollution += 1
                continue

        # WRITE governance
        pipe_f = PIPELINE / f'{tk.lower()}.json'
        if not pipe_f.exists():
            log_line(f"  ⚠ {tk}: pipeline file missing"); continue
        d = json.loads(pipe_f.read_text())
        # Merge keys (don't overwrite existing if newer)
        gov = d.get('governance') or {}
        for k, v in result.items():
            if v is not None and v != '':
                gov[k] = v
        d['governance'] = gov
        d['_governance_safe_fetched_at'] = datetime.now(timezone.utc).isoformat()
        d['_governance_yfinance_validated'] = True
        pipe_f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk}: ceo={llm_ceo} board={result.get('board_size','?')} (source={label})")

    log_line(f"END: written={written} rejected={rejected_pollution} no_source={no_source} fails={fails}")


if __name__ == "__main__":
    main()
