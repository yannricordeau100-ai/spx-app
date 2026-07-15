#!/usr/bin/env python3
"""verify-segments-vs-10k.py - verify revenue_by_segment vs latest local 10-K.

Buckets:
  verified_ok   : all stored segment names found in LLM extraction with |pct diff| <= 1
  re_extracted  : LLM found >=2 segments but pct mismatch or missing name -> overwrite slices
  single_segment: LLM finds only 1 segment (or no revenue_by_segment applicable)
  failed        : no json / no 10-K / no LLM result

Stamps verified_ok with _segment_verified_at: 2026-07-13T02:50:00Z
"""
import gzip
import json
import os
import re
import ssl
import sys
import time
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path("/Users/yann/spx-app")
COMPANIES = ROOT / "src/data/companies"
SEC10K = ROOT / "sec-data/cat1-us/10K"
OUT = ROOT / ".conv-state/segment-verify-result.json"
LOG = ROOT / ".conv-state/segment-verify.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

STAMP = "2026-07-13T02:50:00Z"
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b")
CTX_LEN = 30000
TOL = 1.0

TICKERS = "JPM,K,KDP,KEY,KEYS,KHC,KIM,KKR,KLAC,KMB,KMI,KO,KR,KVUE,L,LDOS,LEN,LH,LHX,LII,LIN,LKQ,LLY,LMT,LNT,LOW,LRCX,LULU,LUV,LVS,LYB,LYV,MA,MAA,MAR,MAS,MCD,MCHP,MCK,MCO,MDLZ,MDT,MET,MGM,MHK,MKC,MLM,MMC,MMM,MNST,MO,MOH,MOS,MPC,MPWR,MRK,MRNA,MRSH,MS,MSCI,MSI,MTB,MTCH,MTD,MU,NCLH,NDAQ,NDSN,NEE,NEM,NFLX,NI,NKE,NOC,NOW,NRG,NSC,NTAP,NTRS,NUE,NVR,NVDA,NWS,NWSA,NXPI,O,ODFL,OKE,OMC,ON,ORCL,ORLY,OTIS,OXY,PANW,PARA,PAYC,PAYX,PCAR,PCG,PEG,PEP,PFE,PFG,PG,PGR,PH,PHM,PKG,PLD,PLTR,PM,PNC,PNR,PNW,PODD,POOL,PPG,PPL,PRU,PSA,PSKY,PSX,PTC,PWR,PYPL,Q,QCOM,RCL,REG,REGN,RF,RJF,RL,RMD,ROK,ROL,ROP,ROST,RSG,RTX,RVTY,SATS,SBAC,SBUX,SCHW,SHW,SJM,SLB,SMCI,SNA,SNDK,SNPS,SO,SOLV,SPG,SPGI,SRE,STE,STLD,STT,STX,STZ,SW,SWK,SWKS,SYF,SYK,SYY,T,TAP,TDG,TDY,TECH,TEL,TER,TFC,TGT,TJX,TKO,TMO,TMUS,TPL,TPR,TRGP,TRMB,TROW,TRV,TSCO,TSLA,TSN,TT,TTD,TTWO,TXN,TXT,TYL,UAL,UBER,UDR,UHS,ULTA,UNH,UNP,UPS,URI,USB,V,VEEV,VICI,VLO,VLTO,VMC,VRSK,VRSN,VRT,VRTX,VST,VTR,VTRS,VZ,WAB,WAT,WBD,WDAY,WDC,WEC,WELL,WFC,WM,WMB,WMT,WRB,WSM,WST,WTW,WY,WYNN,XEL,XOM,XYL,XYZ,YUM,ZBH,ZBRA,ZTS".split(",")

HTML_TAG = re.compile(r"<[^>]+>")
HTML_ENT_N = re.compile(r"&[a-zA-Z]+;")
HTML_ENT_D = re.compile(r"&#\d+;")
WS = re.compile(r"\s+")

_lock = threading.Lock()
def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    with _lock:
        print(line, flush=True)
        with open(LOG, "a") as f:
            f.write(line + "\n")

def load_env():
    env = ROOT / ".env.local"
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")

def strip_html(html):
    text = HTML_TAG.sub(" ", html)
    text = HTML_ENT_N.sub(" ", text)
    text = HTML_ENT_D.sub(" ", text)
    return WS.sub(" ", text).strip()

def find_section(text):
    """Locate densest segment-note area. Returns concat of best chunks."""
    # Pattern set that covers most segment-note markers
    seg_pat = re.compile(
        r"(?:reportable\s+(?:business\s+)?segments?|"
        r"operating\s+(?:business\s+)?segments?|"
        r"business\s+segments?\s+results|"
        r"segment\s+information|"
        r"note\s+\d+\s*[\.:\-]?\s*(?:business\s+)?segment|"
        r"disaggregation\s+of\s+revenue|"
        r"revenue\s+from\s+contracts?\s+with\s+customers|"
        r"segment\s+results)",
        re.I,
    )
    positions = [m.start() for m in seg_pat.finditer(text)]
    chunks = []
    if positions:
        # Cluster positions into windows; pick densest by count.
        window = 20000
        best_start = None
        best_count = 0
        for p in positions:
            end = p + window
            cnt = sum(1 for q in positions if p <= q <= end)
            if cnt > best_count:
                best_count = cnt; best_start = p
        # Also include last occurrence chunk
        last_p = positions[-1]
        for label, start, size in [
            ("DENSE", best_start, 14000),
            ("LAST", last_p, 8000),
        ]:
            if start is None: continue
            chunks.append((label, max(0, start - 1000), size))
    # Item 8 as backup
    m8 = list(re.finditer(r"item\s+8\.?\s+financial\s+statements", text, re.I))
    if m8:
        chunks.append(("FIN", m8[-1].start(), 6000))
    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 11000): mid + 11000]
    # Dedupe overlapping
    chunks.sort(key=lambda x: x[1])
    parts = []
    last_end = -1
    for label, start, size in chunks:
        if start < last_end: continue
        end = start + size
        parts.append(f"=== {label} ===\n{text[start:end]}")
        last_end = end
    return "\n\n".join(parts)[:CTX_LEN]

def find_10k(ticker):
    if not SEC10K.exists(): return None
    cands = []
    for ydir in sorted([d for d in SEC10K.iterdir() if d.is_dir()], reverse=True):
        for f in ydir.glob(f"{ticker}_*.htm.gz"):
            cands.append(f)
        if cands: break
    if not cands: return None
    return max(cands, key=lambda f: f.stat().st_size)

PROMPT = """Extract revenue_by_segment from this SEC 10-K excerpt of {name} ({ticker}).

JSON STRICT output only:
{{
  "slices": [
    {{"name": "Segment name as in filing", "pct": 42.0}}
  ]
}}

RULES:
1. pct = share of TOTAL revenue in %, computed if not explicit.
2. If company reports only 1 reportable segment => slices: [] (empty).
3. NEVER invent. If pct not derivable => null for that slice.
4. Return segments by TOTAL REVENUE (net revenues / net sales), not operating income.
5. Use most recent full fiscal year.

10-K excerpt:
---
{ctx}
---"""

def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }).encode()
    headers = {"Authorization": f"Bearer {api_key}", "content-type": "application/json", "User-Agent": "curl/7.79.1"}
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try: return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(10); continue
            return None
        except Exception:
            if attempt < retries:
                time.sleep(4); continue
            return None
    return None

def normalize(s):
    s = re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())
    return re.sub(r"\s+", " ", s).strip()

def match_slices(stored, llm):
    """Return (all_match, mismatches). stored/llm = list of {name,pct}."""
    stored_pairs = [(normalize(x.get("name","")), x.get("pct")) for x in stored]
    llm_pairs = [(normalize(x.get("name","")), x.get("pct")) for x in llm]
    if not stored_pairs or not llm_pairs: return False, ["empty"]
    mismatches = []
    for sn, sp in stored_pairs:
        found = None
        for ln, lp in llm_pairs:
            if not sn or not ln: continue
            if sn == ln or sn in ln or ln in sn:
                found = (ln, lp); break
        if not found:
            mismatches.append(f"missing:{sn}"); continue
        ln, lp = found
        if sp is None or lp is None:
            mismatches.append(f"nullpct:{sn}"); continue
        if abs(float(sp) - float(lp)) > TOL:
            mismatches.append(f"pctdiff:{sn}:{sp}vs{lp}"); continue
    return len(mismatches) == 0, mismatches

def process(ticker, api_key):
    jp = COMPANIES / f"{ticker.lower()}.json"
    if not jp.exists():
        return ticker, "failed", "no_json"
    try:
        data = json.loads(jp.read_text())
    except Exception as e:
        return ticker, "failed", f"json_parse:{e}"
    rbs = data.get("revenue_by_segment") or {}
    stored_slices = rbs.get("slices") or []

    tenk = find_10k(ticker)
    if not tenk:
        return ticker, "failed", "no_10k"
    try:
        with gzip.open(tenk, "rt", encoding="utf-8", errors="ignore") as f:
            html = f.read()
    except Exception as e:
        return ticker, "failed", f"gunzip:{e}"
    text = strip_html(html)
    ctx = find_section(text)
    name = data.get("name", ticker)
    prompt = PROMPT.format(name=name, ticker=ticker, ctx=ctx)
    llm = call_cerebras(prompt, api_key)
    if llm is None:
        return ticker, "failed", "llm_none"
    llm_slices = llm.get("slices") or []

    # Single-segment company
    if len(llm_slices) <= 1:
        return ticker, "single_segment", {"llm_slices": llm_slices}

    if not stored_slices:
        # No stored data but 10-K has segments -> re-extract
        new_rbs = {
            "label": rbs.get("label") or "Répartition du chiffre d'affaires par segment opérationnel",
            "slices": [{"name": s.get("name"), "value": None, "unit": "Mds $", "pct": s.get("pct")} for s in llm_slices],
        }
        data["revenue_by_segment"] = new_rbs
        data["_segment_reextracted_at"] = STAMP
        data["_segment_reextracted_source"] = tenk.name
        jp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return ticker, "re_extracted", {"reason": "was_empty", "new": llm_slices}

    ok, mism = match_slices(stored_slices, llm_slices)
    if ok:
        data["_segment_verified_at"] = STAMP
        data["_segment_verified_source"] = tenk.name
        jp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return ticker, "verified_ok", tenk.name
    # Mismatch -> re-extract (preserve values, overwrite pct/names from LLM)
    new_rbs = {
        "label": rbs.get("label") or "Répartition du chiffre d'affaires par segment opérationnel",
        "slices": [{"name": s.get("name"), "value": None, "unit": "Mds $", "pct": s.get("pct")} for s in llm_slices],
    }
    data["revenue_by_segment"] = new_rbs
    data["_segment_reextracted_at"] = STAMP
    data["_segment_reextracted_source"] = tenk.name
    data["_segment_reextracted_reason"] = mism[:5]
    jp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return ticker, "re_extracted", {"mismatches": mism[:5]}

def main():
    load_env()
    keys = [os.environ.get("CEREBRAS_API_KEY"), os.environ.get("CEREBRAS2_API_KEY"), os.environ.get("CEREBRAS3_API_KEY")]
    keys = [k for k in keys if k]
    if not keys:
        print("No Cerebras keys"); sys.exit(1)
    result = {"verified_ok": [], "re_extracted": [], "single_segment": [], "failed": []}
    details = {}
    counter = {"n": 0}
    total = len(TICKERS)

    def worker(ticker, idx):
        key = keys[idx % len(keys)]
        try:
            t, bucket, info = process(ticker, key)
        except Exception as e:
            t, bucket, info = ticker, "failed", f"exc:{e}"
        with _lock:
            counter["n"] += 1
            log(f"[{counter['n']}/{total}] {t}: {bucket}")
        return t, bucket, info

    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(worker, tk, i) for i, tk in enumerate(TICKERS)]
        for fut in as_completed(futs):
            t, bucket, info = fut.result()
            result[bucket].append(t)
            details[t] = info

    result["_stamp"] = STAMP
    result["_total"] = total
    result["_counts"] = {k: len(v) for k, v in result.items() if isinstance(v, list)}
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    (ROOT / ".conv-state/segment-verify-details.json").write_text(json.dumps(details, indent=2, ensure_ascii=False, default=str))
    log(f"DONE. counts={result['_counts']}")

if __name__ == "__main__":
    main()
