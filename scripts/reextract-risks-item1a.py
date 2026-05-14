#!/usr/bin/env python3
"""
reextract-risks-item1a.py — extract Item 1A "Risk Factors" sécifiques sté
depuis 10-K (US) / 20-F (FPI) / cat3-european annual report.

Yann (14 mai) : 102 stés top 307 V1.8 avaient risks GÉNÉRIQUES treasury
(Item 7A "Quantitative Disclosures") au lieu de Item 1A spécifiques business.
Ex : NVDA avait "Risque de taux d'intérêt portefeuille" au lieu de
"Compétition AMD / Cloud TPUs", "Dépendance hyperscalers", "Export controls
China", "TSMC supply concentration", etc.

Pipeline :
1. Locate filing (DEF14A non utile pour risks — 10-K/20-F/cat3 only)
2. Extract Item 1A section via patterns multilingues
3. Cerebras Llama 70B prompt strict : 5-8 risks NVDA-specific (pas treasury)
4. Format strict : title, category, severity, score_rationale, trend, summary

Multi-key support : CEREBRAS_API_KEY, CEREBRAS2_API_KEY, CEREBRAS3_API_KEY
selon env CHUNK_NUM (1/2/3).

Free tier : ~50 req/min Cerebras. 102 stés × 1 call = ~3 min/key, parallèle 3 = ~3 min total + LLM overhead.
"""
import argparse, gzip, json, os, re, ssl, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC = PROJECT_ROOT / "sec-data"
PENDING = Path(os.environ.get("PENDING_FILE","/tmp/risks-rextract-pending.txt"))
CHUNK = os.environ.get("CHUNK_NUM","1")
LOG = PROJECT_ROOT / f".conv-state/CONV-DATA-risks-{CHUNK}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

PROVIDER = os.environ.get("PROVIDER", "anthropic")
if PROVIDER == "anthropic":
    API_URL = "https://api.anthropic.com/v1/messages"
    KEY_ENV = "ANTHROPIC_API_KEY"
    MODEL = "claude-sonnet-4-6"
    SLEEP = 3.0
elif PROVIDER == "groq":
    API_URL = "https://api.groq.com/openai/v1/chat/completions"
    KEY_ENV = "GROQ_API_KEY"
    MODEL = "llama-3.3-70b-versatile"
    SLEEP = 2.0
else:
    API_URL = "https://api.cerebras.ai/v1/chat/completions"
    KEY_ENV = f"CEREBRAS{('' if CHUNK=='1' else CHUNK)}_API_KEY"
    MODEL = "llama-3.3-70b"
    SLEEP = 1.5

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
    line = f"[{ts}][{CHUNK}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f: f.write(line + "\n")

def _strip(html):
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

def find_filing(ticker):
    tu = ticker.upper()
    # 1) 10-K cat1-us
    base = SEC / "cat1-us" / "10K"
    if base.exists():
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip(g.read()), f"10-K FY{yr.name}"
                except: continue
    # 2) 20-F cat2-foreign-adr
    base = SEC / "cat2-foreign-adr" / "20F"
    if base.exists():
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip(g.read()), f"20-F FY{yr.name}"
                except: continue
    # 3) cat3-european annual-text — take LARGEST file (most content),
    # not latest year (Yann 14 mai : BARC.L 2025.txt=118KB vs 2024.txt=2.6MB)
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = list(cat3.glob("*.txt"))
            if txt_files:
                largest = max(txt_files, key=lambda f: f.stat().st_size)
                return _strip(largest.read_text(errors="ignore")), f"Annual {largest.stem}"
        except: pass
    return None, None

def extract_item1a(text, max_chars=25000):
    """Locate Item 1A or equivalent risk section."""
    if not text: return ""
    patterns = [
        # US 10-K standard
        r"item\s*1\s*a\.?\s*risk\s+factors",
        r"item\s*3\.?\s*d?\.?\s*risk\s+factors",  # 20-F Item 3.D
        r"risk\s+factors\b",
        # EU UK / multilang
        r"key\s+risks?\b",
        r"principal\s+risks?\b",
        r"main\s+risks?\b",
        r"material\s+risks?\b",
        r"risk\s+management\b",
        # FR
        r"facteurs\s+de\s+risques?",
        r"principaux\s+risques?",
        r"description\s+des\s+risques?",
        r"cartographie\s+des\s+risques?",
        # DE
        r"hauptrisiken|risikofaktoren|wesentliche\s+risiken|risikoinventar",
        # IT
        r"fattori\s+di\s+rischio|principali\s+rischi",
        # ES
        r"factores\s+de\s+riesgo|principales\s+riesgos",
        # NL/SV/DA
        r"belangrijkste\s+risico|risicofactor|huvudsaklig.{0,5}risk",
    ]
    matches = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches:
        # Fallback : cherche dense région "risk" (5+ occurrences en 3000 chars)
        risk_positions = [m.start() for m in re.finditer(r"\brisks?\b", text, re.IGNORECASE)]
        if len(risk_positions) >= 10:
            # Density-based : sliding window
            best_pos = 0
            best_count = 0
            for i in range(len(risk_positions)):
                end_pos = risk_positions[i] + 3000
                count = sum(1 for p in risk_positions[i:] if p < end_pos)
                if count > best_count:
                    best_count = count
                    best_pos = risk_positions[i]
            if best_count >= 5:
                return re.sub(r"\s+", " ", text[best_pos:best_pos+max_chars])[:max_chars]
        return ""
    matches.sort()
    start = matches[0]
    return re.sub(r"\s+", " ", text[start:start+max_chars])[:max_chars]

def call_llm(prompt, key, retries=2):
    if PROVIDER == "anthropic":
        body = json.dumps({"model": MODEL, "max_tokens": 4000,
                           "messages":[{"role":"user","content":prompt}],
                           "temperature": 0.0}).encode()
        headers = {"x-api-key": key, "anthropic-version":"2023-06-01", "content-type":"application/json"}
    else:
        body = json.dumps({"model": MODEL,
                           "messages":[{"role":"user","content":prompt}],
                           "temperature": 0.0, "max_tokens": 3500,
                           "response_format":{"type":"json_object"}}).encode()
        headers = {"Authorization": f"Bearer {key}", "content-type":"application/json"}
    for _ in range(retries+1):
        try:
            req = urllib.request.Request(API_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            if PROVIDER == "anthropic":
                content = resp.get("content",[{}])[0].get("text","")
            else:
                content = resp["choices"][0]["message"]["content"]
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
            log_line(f"HTTP {e.code}: {e.read()[:200]}")
            return None
        except Exception as ex:
            log_line(f"Ex: {type(ex).__name__}")
            time.sleep(3)
    return None

PROMPT = """Tu extrais les facteurs de risque MÉTIER de {ticker} ({name}) depuis l'Item 1A (ou équivalent) du filing.

RÈGLE IMPÉRATIVE : ne PAS extraire les risques génériques de trésorerie (taux, change, liquidité, valuation portefeuille). Extrais les risques SPÉCIFIQUES à l'activité de {name} (compétition, dépendance fournisseur, régulation sectorielle, cybersécurité, IP, etc.).

Format JSON :
{{
  "risks": [{{
    "title": "court titre 5-12 mots (FR)",
    "category": "Macro|Régulation|Cybersécurité|Concurrence|Capital|Crédit|Géopolitique|Technologie|Industriel|Personne-clé|Litige|Réputation|Environnement",
    "severity": 1-5,
    "score_rationale": "1-2 phrases citant les 4 critères (position dans 10-K, intensité langage, tendance, poids catégorie)",
    "trend": "new|up|stable|down|removed",
    "summary": "1-2 phrases décrivant le risque, EN FRANÇAIS, avec exemples concrets"
  }}, ...]
}}

Cible 5-8 risques MÉTIER spécifiques à {name}. Pas de generic treasury.

Extrait Item 1A :
---
{ctx}
---"""

def main():
    load_env()
    api_key = os.environ.get(KEY_ENV)
    if not api_key:
        log_line(f"❌ Missing {KEY_ENV}")
        sys.exit(1)

    pending = [t for t in PENDING.read_text().splitlines() if t.strip()]
    log_line(f"START risks-item1a: {len(pending)} stés, key={KEY_ENV}")

    written = 0
    no_source = 0
    fails = 0
    last_call = 0.0
    for tk in pending:
        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()

        pipe_f = PIPELINE / f'{tk.lower()}.json'
        if not pipe_f.exists(): no_source += 1; continue
        d = json.load(pipe_f.open())
        text, label = find_filing(tk)
        if not text: log_line(f"  🚫 {tk}: no filing"); no_source += 1; continue
        ctx = extract_item1a(text)
        if len(ctx) < 1500: log_line(f"  🚫 {tk}: ctx too short (no Item 1A?)"); no_source += 1; continue

        prompt = PROMPT.format(ticker=tk, name=d.get('name',tk), ctx=ctx)
        result = call_llm(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  ❌ {tk}: LLM fail"); fails += 1; continue
        risks = result.get('risks') or result.get('Risks') or []
        if not isinstance(risks, list) or len(risks) < 2:
            log_line(f"  ❌ {tk}: <2 risks extracted"); fails += 1; continue

        # Validate each risk has title + category + severity
        valid = [r for r in risks if isinstance(r, dict) and r.get('title') and r.get('category')]
        if len(valid) < 2:
            log_line(f"  ❌ {tk}: <2 valid risks"); fails += 1; continue

        # Write : remplace les risks existants (les anciens étaient mauvais)
        d['risks'] = valid
        d['_risks_reextracted_at'] = datetime.now(timezone.utc).isoformat()
        d['_risks_source'] = label
        pipe_f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk}: {len(valid)} risks ({label})")

    log_line(f"END: written={written} no_source={no_source} fails={fails}")

if __name__ == "__main__": main()
