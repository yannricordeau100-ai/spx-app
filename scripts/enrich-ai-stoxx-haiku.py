#!/usr/bin/env python3
"""AI positioning fill via Haiku Pass 3 pour 38 stés Stoxx 600 cat3 KO."""
import json, os, re, ssl, sys, time, urllib.request, urllib.error, gzip
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPE = PROJECT_ROOT / "src/data/v2-pipeline"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-ai-stoxx.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5"
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
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)
    with open(LOG, "a") as f: f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}\n")

def _strip(html):
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL|re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL|re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt)
    return txt

def find_filing_text(ticker):
    tu = ticker.upper()
    for cat, form in [("cat1-us","10K"),("cat2-foreign-adr","20F")]:
        base = SEC / cat / form
        if not base.exists(): continue
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip(g.read()), f"{form} FY{yr.name}"
                except: continue
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = list(cat3.glob("*.txt"))
            if txt_files:
                largest = max(txt_files, key=lambda f: f.stat().st_size)
                return _strip(largest.read_text(errors="ignore")), f"Annual {largest.stem}"
        except: pass
    return None, None

def extract_ai_context(text, max_chars=10000):
    if not text: return ""
    patterns = [r"artificial\s+intelligence", r"machine\s+learning", r"\bAI\b",
                r"intelligence\s+artificielle", r"IA\b", r"künstliche\s+intelligenz",
                r"data\s+science", r"large\s+language\s+models?", r"\bllm\b",
                r"automation", r"generative\s+ai"]
    matches = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches: return ""
    matches.sort()
    # density
    def score(pos):
        w = text[pos:pos+3000]
        return sum(1 for p in patterns for _ in re.finditer(p, w, re.IGNORECASE))
    scored = sorted([(score(p),p) for p in matches], reverse=True)
    start = scored[0][1]
    return text[start:start+max_chars]

PROMPT = """Tu détermines le positionnement IA de {ticker} ({name}) depuis ce filing.

Format JSON :
{{
  "stance": "leader|integrator|cautious|absent",
  "summary": "1 phrase synthèse position IA",
  "evidence": [
    {{"text": "1 phrase factuelle (chiffre ou produit)", "source": "10-K"|"20-F"|"Annual report"}},
    ... 3-5 evidences
  ],
  "source": "{label}"
}}

Stance :
- leader = la sté CRÉE de l'IA (produits/services IA core)
- integrator = la sté UTILISE l'IA dans ses processus opérationnels
- cautious = expérimentations en cours, pas encore d'impact massif
- absent = pas de mention IA significative dans le filing

Si pas de mention IA → "absent" + summary="Pas de positionnement IA mentionné dans le filing récent" + evidence=[]

Filing extracté :
---
{ctx}
---"""

def call_haiku(prompt, key):
    body = json.dumps({"model": MODEL, "max_tokens": 2000,
                       "messages":[{"role":"user","content":prompt}],
                       "temperature": 0.0}).encode()
    headers = {"x-api-key": key, "anthropic-version":"2023-06-01", "content-type":"application/json"}
    for _ in range(3):
        try:
            req = urllib.request.Request(API_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as r:
                resp = json.loads(r.read())
            content = resp.get("content",[{}])[0].get("text","")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try: return json.loads(content)
            except:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(15); continue
            return None
        except: time.sleep(2)
    return None

def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key: sys.exit(1)
    targets = [t for t in open('/tmp/ai-pending.txt').read().splitlines() if t.strip()]
    log_line(f'START ai-stoxx Haiku : {len(targets)} stés')
    written = 0; fails = 0; no_src = 0
    last_call = 0.0
    for tk in targets:
        if time.time() - last_call < SLEEP:
            time.sleep(SLEEP - (time.time() - last_call))
        last_call = time.time()
        text, label = find_filing_text(tk)
        if not text:
            log_line(f"  🚫 {tk}: no filing"); no_src += 1; continue
        ctx = extract_ai_context(text)
        if not ctx or len(ctx) < 500:
            # Use partial text instead
            ctx = text[:8000]
        prompt = PROMPT.format(ticker=tk, name=tk, label=label, ctx=ctx)
        result = call_haiku(prompt, api_key)
        if not result or not isinstance(result, dict):
            log_line(f"  ❌ {tk}: LLM fail"); fails += 1; continue
        stance = result.get('stance')
        if stance not in ('leader','integrator','cautious','absent'):
            log_line(f"  ❌ {tk}: invalid stance"); fails += 1; continue
        # Write to enrich (additive, no overwrite v2-pipeline)
        enr_f = ENR / f'{tk.lower()}.json'
        if enr_f.exists():
            d = json.loads(enr_f.read_text())
        else:
            d = {'ticker': tk}
        d['ai_positioning'] = result
        d['_ai_positioning_fetched_at'] = datetime.now(timezone.utc).isoformat()
        enr_f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk}: stance={stance} ev={len(result.get('evidence',[]))}")
    log_line(f"END: written={written} fails={fails} no_src={no_src}")

if __name__ == "__main__": main()
