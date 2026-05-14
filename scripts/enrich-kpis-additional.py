#!/usr/bin/env python3
"""
enrich-kpis-additional.py — Pour les 23 stés top 307 avec <5 KPIs valid,
re-extract additional KPIs depuis 10-K filing via Sonnet 4.6.

Strict requirements :
- Garder KPIs existants intacts
- Ajouter UNIQUEMENT des KPIs avec shorts différents
- Format strict CLAUDE.md : short, name_fr, name_en, value, unit, yoy, history,
  type, nature, comparable, signal, description, last_data_date
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
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-kpis-add.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = os.environ.get("LLM_MODEL", "claude-sonnet-4-6")
SLEEP = 5.0

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
    for form, label in [("10K","10-K"),("20F","20-F")]:
        base = SEC / ("cat1-us" if form=="10K" else "cat2-foreign-adr") / form
        if not base.exists(): continue
        for yr in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in yr.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip(g.read()), f"{label} FY{yr.name}"
                except: continue
    return None, None

def call_sonnet(prompt, api_key, retries=2):
    body = json.dumps({"model": MODEL_ID, "max_tokens": 4000,
                       "messages": [{"role":"user","content":prompt}], "temperature": 0.0}).encode()
    headers = {"x-api-key": api_key, "anthropic-version":"2023-06-01", "content-type":"application/json"}
    for _ in range(retries+1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp.get("content",[{}])[0].get("text","")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try: return json.loads(content)
            except:
                m = re.search(r"\[.*\]", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(15); continue
            log_line(f"HTTP {e.code}")
            return None
        except Exception as e:
            log_line(f"Exception: {type(e).__name__}")
            time.sleep(3)
    return None

PROMPT = """Tu extrais des KPIs financiers complémentaires pour {ticker} ({name}) depuis ce filing.

KPIs DÉJÀ existants (NE PAS dupliquer) : {existing_shorts}

Extrait 3-5 KPIs financiers/opérationnels **NOUVEAUX et distincts** (different short).
Chaque KPI doit avoir des valeurs RÉELLES dans le filing (jamais inventer).

Format JSON array strict :
[{{
  "short": "abréviation 1-25 chars",
  "name_fr": "nom français < 50 chars",
  "name_en": "nom anglais",
  "explanation": "1 phrase explicative pour tooltip",
  "value": numeric_value,
  "unit": "Mds $" | "M $" | "%" | "K" | etc.,
  "yoy": "+X.X%" | "-X.X%" | null,
  "history": [v_n-4, v_n-3, v_n-2, v_n-1, v_n],
  "type": "Revenue|Margin|Cash|Investment|Capital|Profitability|Demand|Risk|User|...",
  "nature": "Structurel|Conjoncturel|Cyclique",
  "comparable": "Comparable|Non-comparable",
  "signal": "1-5 mots tendance",
  "description": "1-2 phrases description",
  "last_data_date": "YYYY-MM-DD",
  "is_generic": true|false,
  "is_wow": true|false
}}]

Si filing ne permet pas extraire 3+ NOUVEAUX KPIs distinct → retourne [] (vide).
Jamais inventer.

Filing :
---
{context}
---"""

def find_context(text, max_chars=15000):
    if not text: return ""
    # Take MD&A section (most KPI-rich)
    patterns = [r"management.s\s+discussion\s+and\s+analysis", r"results\s+of\s+operations",
                r"segment\s+results", r"financial\s+highlights"]
    matches = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            matches.append(m.start())
    if not matches: return text[:max_chars]
    def score(pos):
        w = text[pos:pos+5000]
        return w.count("$")*2 + w.count("%") + len(re.findall(r"\d{3,}", w))
    scored = sorted([(score(p), p) for p in matches], reverse=True)
    start = scored[0][1]
    return re.sub(r"\s+", " ", text[start:start+max_chars])[:max_chars]

def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key: log_line("❌ NO API KEY"); sys.exit(1)
    
    pending = [t for t in Path("/tmp/kpis-pending.txt").read_text().splitlines() if t.strip()]
    log_line(f"START kpis-add: {len(pending)} stés, model={MODEL_ID}")
    
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
        p = json.load(pipe_f.open())
        text, label = find_filing(tk)
        if not text: log_line(f"  🚫 {tk}: no filing"); no_source += 1; continue
        ctx = find_context(text)
        if len(ctx) < 1000: log_line(f"  🚫 {tk}: ctx too short"); no_source += 1; continue
        
        existing_shorts = ', '.join(k.get('short','') for k in p.get('kpis',[]) if k.get('short'))
        prompt = PROMPT.format(ticker=tk, name=p.get('name',tk),
                              existing_shorts=existing_shorts, context=ctx)
        result = call_sonnet(prompt, api_key)
        if not result or not isinstance(result, list):
            log_line(f"  ❌ {tk}: LLM fail"); fails += 1; continue
        
        added = 0
        existing_set = {k.get('short','').lower() for k in p.get('kpis',[]) if k.get('short')}
        for new_kpi in result:
            if not isinstance(new_kpi, dict): continue
            sh = new_kpi.get('short','')
            if not sh or sh.lower() in existing_set: continue
            # Validate required fields
            if not isinstance(new_kpi.get('value'), (int, float)): continue
            p['kpis'].append(new_kpi)
            existing_set.add(sh.lower())
            added += 1
            if added >= 5: break  # safety
        
        if added > 0:
            p['_kpis_additional_added'] = {'count': added, 'source': label,
                                            'at': datetime.now(timezone.utc).isoformat()}
            pipe_f.write_text(json.dumps(p, indent=2, ensure_ascii=False))
            written += added
            log_line(f"  ✅ {tk}: +{added} KPIs (source={label})")
        else:
            log_line(f"  ⚪ {tk}: LLM retourne aucun nouveau KPI distinct")

    log_line(f"END: {written} new KPIs added, no_source={no_source}, fails={fails}")

if __name__ == "__main__": main()
