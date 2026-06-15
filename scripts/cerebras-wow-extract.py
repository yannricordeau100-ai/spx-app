#!/usr/bin/env python3
"""KPI wow + stories depuis les ER via Cerebras (free, 3 cles rotation).
4 workers (basse RAM ~500 Mo), pdftotext borne. Lit data-lake/_us-ready.json."""
import json, os, re, time, ssl, subprocess, threading, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

CTX = ssl._create_unverified_context()
DOCS = os.path.expanduser("~/Mettrik/docs"); DL = "data-lake"
env = {}
for l in open(".env.local"):
    l = l.strip()
    if l.startswith("export "): l = l[7:]
    if "=" in l and not l.startswith("#"):
        k, v = l.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")
KEYS = [env[k] for k in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY") if env.get(k)]
MODEL = "gpt-oss-120b"
todo = json.load(open(f"{DL}/_us-ready.json"))
LOG = open("/tmp/cerebras-wow.log", "w")
ki = [0]; klock = threading.Lock()

def cerebras(prompt):
    for attempt in range(3):
        with klock:
            key = KEYS[ki[0] % len(KEYS)]; ki[0] += 1
        body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 3500}).encode()
        req = urllib.request.Request("https://api.cerebras.ai/v1/chat/completions", data=body,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "curl/8.4.0"})
        try:
            with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
                return json.loads(r.read())["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(4); continue
            time.sleep(2)
        except Exception:
            time.sleep(2)
    return None

def read_er(t):
    d = f"{DOCS}/{t.upper()}/ER"
    if not os.path.isdir(d): return ""
    files = sorted([f for f in os.listdir(d) if not f.startswith(".")], reverse=True)[:6]
    chunks = []
    for f in files:
        p = f"{d}/{f}"
        try:
            if f.lower().endswith((".htm", ".html")):
                txt = re.sub(r"<[^>]+>", " ", open(p, encoding="utf-8", errors="ignore").read())
            else:
                txt = subprocess.run(["/opt/homebrew/bin/pdftotext", "-l", "5", "-q", p, "-"],
                                     capture_output=True, timeout=30).stdout.decode("utf-8", "ignore")
            chunks.append(f"=== {f} ===\n" + re.sub(r"\s+", " ", txt)[:2500])
        except Exception:
            pass
    return "\n".join(chunks)[:15000]

PROMPT = """Analyste financier. Communiques de resultats (ER) trimestriels de {ticker}.
Extrais en JSON STRICT (rien d'autre) :
"kpis": KPI HAUT DE GAMME specifiques a la societe (JAMAIS CA total/benefice/EPS/marge/EBITDA/FCF/CapEx), trimestre par trimestre, format: {{"short","name_fr","name_en","unit","grade":"haut","period_type":"quarter","periods":[{{"label":"Q1 2025","period_end":"2025-03-31","value":<nombre entre 1 et 999>,"source":"ER","quote":"<verbatim court>"}}]}}
"stories": 3-5 faits marquants des 2 derniers ER, format: {{"short","story_fr","story_en","signal","category","source":"ER","quote":"<verbatim>"}}
VERBATIM, magnitudes 1-999, zero invention. Reponds UNIQUEMENT le JSON: {{"kpis":[...],"stories":[...]}}

ER:
{text}"""

def parse_json(s):
    if not s: return None
    s = re.sub(r"```(json)?", "", s).strip()
    m = re.search(r"\{.*\}", s, re.S)
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception: return None

cnt = {"done": 0, "ok": 0}; clock = threading.Lock()

def process(t):
    try:
        text = read_er(t)
        if len(text) >= 200:
            data = parse_json(cerebras(PROMPT.format(ticker=t.upper(), text=text)))
            if data and (data.get("kpis") or data.get("stories")):
                l = t.lower()
                if data.get("kpis"):
                    os.makedirs(f"{DL}/{l}/kpis_wow", exist_ok=True)
                    json.dump({"ticker": t.upper(), "extracted_at": "2026-06-14", "source": "ER (Cerebras)", "kpis": data["kpis"]},
                              open(f"{DL}/{l}/kpis_wow/extracted.json", "w"), ensure_ascii=False, indent=1)
                if data.get("stories"):
                    os.makedirs(f"{DL}/{l}/stories", exist_ok=True)
                    json.dump({"ticker": t.upper(), "stories": data["stories"]},
                              open(f"{DL}/{l}/stories/extracted.json", "w"), ensure_ascii=False, indent=1)
                with clock: cnt["ok"] += 1
    except Exception:
        pass
    with clock:
        cnt["done"] += 1
        if cnt["done"] % 5 == 0:
            print(f"{cnt['done']}/{len(todo)} ok={cnt['ok']}", file=LOG, flush=True)

with ThreadPoolExecutor(max_workers=2) as ex:
    list(ex.map(process, todo))
print(f"DONE {cnt['done']}/{len(todo)} ok={cnt['ok']}", file=LOG, flush=True)
print(f"DONE {cnt['done']}/{len(todo)} ok={cnt['ok']}")
