#!/usr/bin/env python3
"""Cerebras: KPIs wow + stories depuis data-lake/<t>/_srctext.txt (texte ER/ES
pré-extrait, capé). 2 workers, 3 clés Cerebras rotation. Bas-RAM (~116Mo/worker)."""
import json, os, re, time, ssl, threading, urllib.request, urllib.error, glob
from concurrent.futures import ThreadPoolExecutor

CTX = ssl._create_unverified_context()
DL = "data-lake"
env = {}
for l in open(".env.local"):
    l = l.strip()
    if l.startswith("export "): l = l[7:]
    if "=" in l and not l.startswith("#"):
        k, v = l.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")
KEYS = [env[k] for k in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY") if env.get(k)]
MODEL = "gpt-oss-120b"

todo = []
for f in glob.glob(f"{DL}/*/_srctext.txt"):
    t = f.split("/")[1]
    if not os.path.exists(f"{DL}/{t}/kpis_wow/extracted.json"):
        todo.append(t)

LOG = open("/tmp/cerebras-srctext.log", "w")
print(f"todo={len(todo)} keys={len(KEYS)}", file=LOG, flush=True)
ki = [0]; klock = threading.Lock()

def cerebras(prompt):
    for attempt in range(3):
        with klock:
            key = KEYS[ki[0] % len(KEYS)]; ki[0] += 1
        body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": prompt}],
                           "temperature": 0.1, "max_tokens": 3500}).encode()
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

PROMPT = """Analyste financier. Communiques de resultats (ER) / slides (ES) de {ticker}.
Extrais en JSON STRICT (rien d'autre):
"kpis": KPI HAUT DE GAMME specifiques a la societe ou au sous-secteur (JAMAIS CA total/benefice net/EPS/marge/EBITDA/FCF/CapEx/dette/dividende/headcount), trimestre par trimestre, format: {{"short","name_fr","name_en","unit","grade":"haut","period_type":"quarter","periods":[{{"label":"Q1 2025","period_end":"2025-03-31","value":<nombre entre 1 et 999>,"source":"ER","quote":"<verbatim court>"}}]}}
"stories": 3-5 faits marquants des 2 derniers ER, format: {{"short","story_fr","story_en","signal","category","source":"ER","quote":"<verbatim>"}}
VERBATIM, magnitudes 1-999, zero invention, francais sans tiret cadratin. Reponds UNIQUEMENT le JSON: {{"kpis":[...],"stories":[...]}}

TEXTE:
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
        text = open(f"{DL}/{t}/_srctext.txt").read()
        if len(text) >= 200:
            data = parse_json(cerebras(PROMPT.format(ticker=t.upper(), text=text[:15000])))
            if data and (data.get("kpis") or data.get("stories")):
                if data.get("kpis"):
                    os.makedirs(f"{DL}/{t}/kpis_wow", exist_ok=True)
                    json.dump({"ticker": t.upper(), "extracted_at": "2026-06-14", "source": "ER/ES (Cerebras)", "kpis": data["kpis"]},
                              open(f"{DL}/{t}/kpis_wow/extracted.json", "w"), ensure_ascii=False, indent=1)
                if data.get("stories"):
                    os.makedirs(f"{DL}/{t}/stories", exist_ok=True)
                    json.dump({"ticker": t.upper(), "stories": data["stories"]},
                              open(f"{DL}/{t}/stories/extracted.json", "w"), ensure_ascii=False, indent=1)
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
