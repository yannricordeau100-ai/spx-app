#!/usr/bin/env python3
"""ca-pipeline-autonome.py — extraction autonome du bloc "chiffre d'affaire"
(revenue_by_segment + revenue_by_geography) pour l'univers V195, depuis les
filings locaux, via LLM GRATUITS en rotation (Cerebras Qwen-235B x3 cles ->
Groq Llama-70B -> Gemini Flash). Validation DETERMINISTE anti-contamination.
Tourne en background plusieurs jours sans babysitting (reprise via checkpoint).

- Cible : stes V195 dont segment OU geo manque (slices < 2) OU est contamine.
- Source : cat1-us/10K (US), cat2-foreign-adr/20F (ADR), cat3-european (EU).
- Sortie : ecrit le bloc au format CANONIQUE dans src/data/v2-pipeline/<t>.json
  (slices: [{label, value, share_pct, unit, label_en}]).
- Validation : >=2 slices ; valeurs > 0 ; pas toutes identiques ; aucune slice
  ~ CA total (contamination) ; somme ~ coherente. Sinon rejet (rien ecrit).
- Anti-Mac-overload : 1 seul process, sleep entre appels, monitor RAM.

Usage : python3 scripts/ca-pipeline-autonome.py   (run_in_background recommande)
Env : .env.local (CEREBRAS_API_KEY, CEREBRAS2_API_KEY, CEREBRAS3_API_KEY,
      GROQ_API_KEY, GEMINI_API_KEY)
"""
import gzip, json, os, re, ssl, subprocess, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
CAT1 = ROOT / "sec-data/cat1-us/10K"
CAT2 = ROOT / "sec-data/cat2-foreign-adr/20F"
CAT3 = ROOT / "sec-data/cat3-european"
UNIV = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
CKPT = Path("/tmp/ca-pipeline-checkpoint.json")
LOG = ROOT / ".conv-state/ca-pipeline-autonome.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CTX_LEN = 22000
SLEEP_BASE = 4.0
TOTAL_REV = {"total revenue", "revenue", "revenues", "net sales", "total revenues",
             "total net sales", "operating revenue", "net revenue", "chiffre d'affaires", "ca"}

PROMPT = """Tu extrais le bloc {block_human} depuis le rapport annuel d'une societe, pour une app d'investisseurs.

Societe : {name} ({ticker})

Reponds UNIQUEMENT ce JSON (rien d'autre) :
{{"slices":[{{"label":"<nom FR>","label_en":"<nom EN>","value":<nombre en Mds de la devise>,"share_pct":<part % du total>,"unit":"<Mds $ / Mds € / Mds £ / Mds CHF>"}}]}}

REGLES STRICTES :
1. Au moins 2 slices, sinon "slices":[].
2. value en MILLIARDS de la devise du rapport ; mets la devise dans unit ("Mds $", "Mds €"...).
3. share_pct = part en % du total (calcule si absent). La somme des share_pct doit faire ~100.
4. JAMAIS inventer. Si pas chiffre explicitement -> "slices":[].
5. {block_rule}
6. N'inclus JAMAIS une ligne "Total" / "Consolide" / "Group total" comme slice.
7. label en francais, label_en en anglais. Zero tiret cadratin.

Extrait du rapport :
---
{ctx}
---"""

RULE_SEG = "Privilegie les segments reportables (Reportable / Operating segments). Si mono-segment legitime -> []."
RULE_GEO = 'Utilise les zones du filing (ex "Etats-Unis", "International", "Europe", "Asie-Pacifique", "Grande Chine"). Si 100% domestique -> [].'

HTML_TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def logl(msg):
    line = f"[{datetime.now().strftime('%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_env():
    f = ROOT / ".env.local"
    if not f.exists():
        return
    for line in f.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        if k and not os.environ.get(k):
            os.environ[k] = v.strip().strip('"').strip("'")


def strip_html(h):
    return WS.sub(" ", HTML_TAG.sub(" ", h)).strip()


def find_section(text, want):
    def pos(pat):
        return [m.start() for m in re.finditer(pat, text, re.I)]
    chunks = []
    if want == "geo":
        pat = r"(?:revenues?\s+by\s+geograph|geographic\s+(?:information|areas?|revenues?|breakdown)|net\s+sales\s+by\s+(?:geograph|region|country)|r[eé]partition\s+g[eé]ographique|umsatz\s+nach\s+regionen)"
    else:
        pat = r"(?:operating\s+segments?|reportable\s+segments?|segment\s+information|business\s+segment|revenues?\s+by\s+segment|net\s+sales\s+by\s+(?:business|product\s+(?:line|categor))|segments?\s+op[eé]rationnels?|gesch[aä]ftssegment)"
    for p in pos(pat)[-2:]:
        chunks.append((p, 6500))
    if not chunks:
        for p in pos(r"item\s+7\.?\s+management.{0,30}discussion|management.{0,30}discussion|rapport\s+de\s+gestion")[-1:]:
            chunks.append((p, 14000))
    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000):mid + 11000]
    chunks.sort()
    return "\n\n".join(text[s:s + b] for s, b in chunks)[:CTX_LEN]


def find_source(ticker):
    """(text, kind) depuis cat1/cat2/cat3, le plus recent."""
    up = ticker.upper()
    # cat1-us 10K
    if CAT1.exists():
        cands = []
        for yd in sorted([d for d in CAT1.iterdir() if d.is_dir()], reverse=True):
            for f in yd.glob(f"{up}_*.htm.gz"):
                cands.append((yd.name, f.name, f))
        if cands:
            cands.sort(reverse=True)
            try:
                with gzip.open(cands[0][2], "rt", errors="ignore") as g:
                    return strip_html(g.read()), "us"
            except Exception:
                pass
    # cat2 ADR 20F
    if CAT2.exists():
        cands = []
        for yd in sorted([d for d in CAT2.iterdir() if d.is_dir()], reverse=True):
            for f in yd.glob(f"{up}_*.htm.gz"):
                cands.append((yd.name, f.name, f))
        if cands:
            cands.sort(reverse=True)
            try:
                with gzip.open(cands[0][2], "rt", errors="ignore") as g:
                    return strip_html(g.read()), "adr"
            except Exception:
                pass
    # cat3 EU annual-text
    d = CAT3 / up / "annual-text"
    if d.exists():
        cands = list(d.glob("*.txt"))
        if cands:
            f = max(cands, key=lambda x: x.stat().st_size)
            try:
                return f.read_text(errors="ignore"), "eu"
            except Exception:
                pass
    return None, "no_source"


# ---- LLM providers (rotation + fallback) ----
_CB_KEYS = []
_CB_DEAD = set()


def cb_keys():
    global _CB_KEYS
    if not _CB_KEYS:
        for k in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY"):
            v = os.environ.get(k)
            if v:
                _CB_KEYS.append((k, v))
    return _CB_KEYS


def _post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
        return json.loads(r.read())


def _parse_json(content):
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", content, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _try_gemini(prompt):
    gem = os.environ.get("GEMINI_API_KEY")
    if not gem:
        return None
    for model in ("gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"):
        for attempt in range(2):
            try:
                resp = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gem}",
                             {"contents": [{"parts": [{"text": prompt}]}],
                              "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"}},
                             {"content-type": "application/json"})
                txt = resp["candidates"][0]["content"]["parts"][0]["text"]
                d = _parse_json(txt)
                if d is not None:
                    return d, f"gemini:{model}"
                break
            except urllib.error.HTTPError as e:
                if e.code in (500, 503) and attempt == 0:
                    time.sleep(4)
                    continue
                if e.code == 404:
                    break
                if e.code == 429:
                    return None
                if e.code not in (500, 503):
                    logl(f"  gemini http_{e.code}")
                break
            except Exception as ex:
                logl(f"  gemini ex_{type(ex).__name__}")
                break
    return None


def _try_cerebras(prompt):
    for name, key in cb_keys():
        if name in _CB_DEAD:
            continue
        try:
            resp = _post("https://api.cerebras.ai/v1/chat/completions",
                         {"model": "gpt-oss-120b",
                          "messages": [{"role": "user", "content": prompt}],
                          "temperature": 0.0, "max_tokens": 2400},
                         {"Authorization": f"Bearer {key}", "content-type": "application/json", "User-Agent": "curl/7.79.1"})
            msg = resp["choices"][0]["message"]
            d = _parse_json(msg.get("content") or "")
            if d is not None:
                return d, f"cerebras:{name}"
        except urllib.error.HTTPError as e:
            if e.code in (429, 402):
                _CB_DEAD.add(name)
            else:
                logl(f"  cerebras {name} http_{e.code}")
        except Exception:
            pass
    return None


def _try_groq(prompt):
    gk = os.environ.get("GROQ_API_KEY")
    if not gk:
        return None
    try:
        resp = _post("https://api.groq.com/openai/v1/chat/completions",
                     {"model": "llama-3.3-70b-versatile",
                      "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.0, "max_tokens": 2200,
                      "response_format": {"type": "json_object"}},
                     {"Authorization": f"Bearer {gk}", "content-type": "application/json", "User-Agent": "curl/7.79.1"})
        d = _parse_json(resp["choices"][0]["message"]["content"])
        if d is not None:
            return d, "groq"
    except urllib.error.HTTPError as e:
        if e.code != 429:
            logl(f"  groq http_{e.code}")
    except Exception:
        pass
    return None


def call_llm(prompt):
    """Gemini (fiable, 1500/j) -> Cerebras gpt-oss -> Groq. -> (dict, provider) | (None, 'all_failed')."""
    for fn in (_try_gemini, _try_cerebras, _try_groq):
        r = fn(prompt)
        if r:
            return r
    return None, "all_failed"


# ---- validation deterministe ----
def total_revenue_mds(data):
    for k in data.get("kpis", []) or []:
        if str(k.get("short", "")).strip().lower() in TOTAL_REV:
            v = k.get("value")
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return None


def validate(slices, total_mds, kind):
    if not isinstance(slices, list) or len(slices) < 2:
        return False, "slices<2"
    vals = []
    for s in slices:
        if not isinstance(s, dict):
            return False, "slice_not_dict"
        lab = str(s.get("label", "")).strip().lower()
        if lab in ("total", "consolidated", "group", "consolide", "total group", "groupe"):
            return False, "slice_total_contam"
        try:
            v = float(s.get("value"))
        except (TypeError, ValueError):
            v = None
        if v is not None:
            vals.append(v)
    if len(vals) < 2:
        return False, "values<2"
    if any(v <= 0 for v in vals):
        return False, "value<=0"
    if len(set(round(v, 4) for v in vals)) == 1:
        return False, "flat_identical"
    # Validation robuste via share_pct (independante de l'unite) : les parts
    # somment ~100 (= le tout, anti CA-total) et aucune ne domine ~tout
    # (mono-segment ou contamination = une slice = CA total).
    pcts = [float(s["share_pct"]) for s in slices if isinstance(s.get("share_pct"), (int, float))]
    if len(pcts) >= 2:
        if not (80 <= sum(pcts) <= 120):
            return False, "pct_sum_off"
        if max(pcts) >= 94:
            return False, "one_slice_dominates"
    else:
        ssum = sum(vals)
        if max(vals) >= 0.94 * ssum:
            return False, "one_slice_is_whole"
    return True, "ok"


def block_valid_in_data(data, block_name):
    b = data.get(block_name)
    if not isinstance(b, dict):
        return False
    sl = b.get("slices")
    return isinstance(sl, list) and len(sl) >= 2


def write_block(slug, block_name, slices, src_kind):
    bpath = V2 / f"{slug}.json"
    if not bpath.exists():
        return False
    try:
        data = json.loads(bpath.read_text())
    except Exception:
        return False
    unit = next((s.get("unit") for s in slices if s.get("unit")), "Mds $")
    data[block_name] = {
        "unit": unit,
        "source": f"filing {src_kind} (pipeline CA autonome, LLM gratuit verbatim)",
        "source_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "slices": [
            {"label": s.get("label"), "value": s.get("value"),
             "share_pct": s.get("share_pct"), "unit": s.get("unit", unit),
             "label_en": s.get("label_en") or s.get("label")}
            for s in slices
        ],
    }
    data["_ca_pipeline_at"] = datetime.now(timezone.utc).isoformat()
    bpath.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return True


def ram_free_mb():
    try:
        out = subprocess.check_output(["vm_stat"], text=True, timeout=5)
        m = re.search(r"Pages free:\s+(\d+)", out)
        return int(m.group(1)) * 16 / 1024 if m else None
    except Exception:
        return None


def build_targets():
    """Liste de (ticker, block) a traiter : V195 dont seg/geo manque/invalide, non deja fait."""
    u = json.loads(UNIV.read_text())
    arr = u.get("tickers", u) if isinstance(u, dict) else u
    tickers = [x if isinstance(x, str) else x.get("ticker") for x in arr]
    done = set()
    if CKPT.exists():
        try:
            done = set(tuple(x) for x in json.loads(CKPT.read_text()).get("done", []))
        except Exception:
            pass
    targets = []
    for t in tickers:
        if not t:
            continue
        slug = t.lower()
        bpath = V2 / f"{slug}.json"
        if not bpath.exists():
            continue
        try:
            data = json.loads(bpath.read_text())
        except Exception:
            continue
        for block in ("revenue_by_segment", "revenue_by_geography"):
            if (t, block) in done:
                continue
            if not block_valid_in_data(data, block):
                targets.append((t, block))
    return targets


def save_ckpt(done):
    try:
        CKPT.write_text(json.dumps({"done": [list(x) for x in done],
                                    "updated": datetime.now(timezone.utc).isoformat()}, indent=2))
    except Exception:
        pass


def main():
    load_env()
    if not cb_keys() and not os.environ.get("GROQ_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        logl("AUCUNE cle LLM gratuite -> abort")
        sys.exit(1)
    targets = build_targets()
    logl(f"START CA pipeline : {len(targets)} (ticker,block) a traiter | cerebras={len(cb_keys())} groq={bool(os.environ.get('GROQ_API_KEY'))} gemini={bool(os.environ.get('GEMINI_API_KEY'))}")
    done = set()
    if CKPT.exists():
        try:
            done = set(tuple(x) for x in json.loads(CKPT.read_text()).get("done", []))
        except Exception:
            pass
    stats = {"ok": 0, "reject": 0, "no_source": 0, "llm_fail": 0}
    last_call = 0.0
    sleep_mult = 1.0
    last_ram = 0.0

    for i, (ticker, block) in enumerate(targets):
        now = time.time()
        if now - last_ram > 30:
            fr = ram_free_mb()
            if fr is not None:
                sleep_mult = 3.0 if fr < 60 else (2.0 if fr < 120 else 1.0)
            last_ram = now
        wait = SLEEP_BASE * sleep_mult - (time.time() - last_call)
        if wait > 0:
            time.sleep(wait)
        last_call = time.time()

        if i and i % 15 == 0:
            logl(f"  [{i}/{len(targets)}] ok={stats['ok']} reject={stats['reject']} no_src={stats['no_source']} llm_fail={stats['llm_fail']}")
            save_ckpt(done)

        slug = ticker.lower()
        bpath = V2 / f"{slug}.json"
        try:
            data = json.loads(bpath.read_text())
        except Exception:
            continue
        if block_valid_in_data(data, block):  # rempli entre-temps
            done.add((ticker, block))
            continue
        text, kind = find_source(ticker)
        if not text:
            stats["no_source"] += 1
            done.add((ticker, block))  # pas de source -> on ne reessaiera pas
            continue
        want = "geo" if "geography" in block else "seg"
        ctx = find_section(text, want)
        prompt = PROMPT.format(
            block_human="repartition du chiffre d'affaire par zone geographique" if want == "geo" else "repartition du chiffre d'affaire par segment operationnel",
            name=data.get("name") or ticker, ticker=ticker, ctx=ctx,
            block_rule=RULE_GEO if want == "geo" else RULE_SEG)
        result, provider = call_llm(prompt)
        if not isinstance(result, dict):
            stats["llm_fail"] += 1
            continue  # on reessaiera (pas dans done)
        slices = result.get("slices") if isinstance(result.get("slices"), list) else []
        ok, why = validate(slices, total_revenue_mds(data), want)
        if not ok:
            stats["reject"] += 1
            done.add((ticker, block))  # rejet deterministe -> ne pas boucler
            if stats["reject"] % 10 == 0:
                logl(f"  reject {ticker}/{block}: {why} ({provider})")
            continue
        if write_block(slug, block, slices, kind):
            stats["ok"] += 1
            done.add((ticker, block))
            logl(f"  OK {ticker}/{block} {len(slices)} slices [{provider}]")
        else:
            stats["llm_fail"] += 1

    save_ckpt(done)
    logl(f"END CA pipeline : ok={stats['ok']} reject={stats['reject']} no_source={stats['no_source']} llm_fail={stats['llm_fail']}")


if __name__ == "__main__":
    main()
