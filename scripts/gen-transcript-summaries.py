#!/usr/bin/env python3
"""Generate transcript-summaries via Groq (gratuit Llama 3.3 70B).

Pour chaque sté top 307 avec transcript brut mais SANS summary, génère
le format nouveau (bullets PV-driven) attendu par TranscriptBulletsBlock.

Input : src/data/transcripts/<ticker>.json (latest.content)
Output : src/data/transcript-summaries/<ticker>.json
"""
import json, os, re, ssl, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRANS = PROJECT_ROOT / "src/data/transcripts"
SUMM = PROJECT_ROOT / "src/data/transcript-summaries"
SUMM.mkdir(parents=True, exist_ok=True)
PENDING = Path(os.environ.get("PENDING_FILE","/tmp/transcript-summaries-pending.txt"))
CHUNK = os.environ.get("CHUNK_NUM","1")
LOG = PROJECT_ROOT / f".conv-state/CONV-DATA-transcript-summ-{CHUNK}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"
SLEEP = 2.0

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

def call_groq(prompt, key, retries=2):
    body = json.dumps({"model": MODEL, "messages":[{"role":"user","content":prompt}],
                       "temperature": 0.0, "max_tokens": 3500,
                       "response_format":{"type":"json_object"}}).encode()
    headers = {"Authorization": f"Bearer {key}", "content-type":"application/json","User-Agent":"curl/7.79.1"}
    for _ in range(retries+1):
        try:
            req = urllib.request.Request(GROQ_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            try: return json.loads(content)
            except:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(15); continue
            log_line(f"HTTP {e.code}")
            return None
        except Exception as ex:
            log_line(f"Ex: {type(ex).__name__}")
            time.sleep(3)
    return None

PROMPT = """Tu génères une synthèse PV-driven du dernier earning call de {ticker} ({name}) pour des investisseurs particuliers français.

Format JSON :
{{
  "tonalite_management": "1 phrase sur le ton/confiance management (max 150c)",
  "sentiment": "bullish|neutral|cautious",
  "bullets": [
    {{"text": "1 phrase dense : chiffre + signal + action (max 130c)", "type": "synthesis|tonalite|driver|vigilance|guidance|strategy|citation", "terms_used": []}},
    ... 6-10 bullets
  ]
}}

Types :
- synthesis = chiffre + tendance globale (revenue, EPS, marge)
- driver = source spécifique de croissance (segment, produit)
- vigilance = risque, pression, déclin
- guidance = objectif futur annoncé (Q+1, FY)
- strategy = annonce stratégique (acquisition, expansion, M&A)
- tonalite = ton management explicite (confiance, prudence)
- citation = quote remarquable du CEO/CFO

Style FR concis. Chaque bullet doit avoir un chiffre ou fait précis (pas générique).

Transcript (extraits) :
---
{ctx}
---"""

def main():
    load_env()
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        log_line("❌ NO GROQ_API_KEY"); sys.exit(1)
    
    pending = [t for t in PENDING.read_text().splitlines() if t.strip()]
    log_line(f"START transcript-summaries: {len(pending)} stés, model={MODEL}")
    
    written = 0
    no_source = 0
    fails = 0
    last_call = 0.0
    for tk in pending:
        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()
        
        trans_f = TRANS / f'{tk.lower()}.json'
        if not trans_f.exists(): no_source += 1; continue
        try: d = json.loads(trans_f.read_text())
        except: no_source += 1; continue
        latest = d.get('latest') or {}
        content = latest.get('content','') or ''
        if len(content) < 1500: no_source += 1; continue
        # Take first 20k chars (intro + first part)
        ctx = content[:20000]
        
        # Find sté name from pipeline
        try:
            p = json.loads((PROJECT_ROOT/'src/data/v2-pipeline'/f'{tk.lower()}.json').read_text())
            name = p.get('name', tk)
        except: name = tk
        
        prompt = PROMPT.format(ticker=tk, name=name, ctx=ctx)
        result = call_groq(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  ❌ {tk}: LLM fail"); fails += 1; continue
        bullets = result.get('bullets') or []
        if not isinstance(bullets, list) or len(bullets) < 3:
            log_line(f"  ❌ {tk}: <3 bullets"); fails += 1; continue
        
        # Build summary file
        quarter = latest.get('quarter')
        year = latest.get('year')
        quarter_str = f"{year}Q{quarter}" if year and quarter else None
        
        summary_data = {
            "ticker": tk,
            "quarter": quarter_str,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "fmp_transcript_latest",
            "model": MODEL,
            "summary": {
                "tonalite_management": result.get('tonalite_management',''),
                "sentiment": result.get('sentiment','neutral'),
                "bullets": bullets,
            }
        }
        out_f = SUMM / f'{tk.lower()}.json'
        out_f.write_text(json.dumps(summary_data, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk}: {len(bullets)} bullets ({quarter_str})")
    
    log_line(f"END: written={written} no_source={no_source} fails={fails}")

if __name__ == "__main__": main()
