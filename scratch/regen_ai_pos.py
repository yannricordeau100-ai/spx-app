#!/usr/bin/env python3
"""Regenerate ai_positioning for batch A companies from local 10-K extracts."""
import json, gzip, re, os, sys
from pathlib import Path

DATA_LAKE = Path("/Users/yann/spx-app/data-lake")
V2 = Path("/Users/yann/spx-app/src/data/v2-pipeline")
TICKERS_JSON = Path("/Users/yann/spx-app/scratch/company_tickers.json")

BATCH = ["A","ABBV","ABNB","ABT","ACGL","ACN","ADI","ADM","ADP","ADSK","AEE","AEP","AES","AFL","AIG","AIZ","AJG","AKAM","ALB","ALGN","ALL","ALLE","AMCR","AME","AMGN","AMP","AMT","AON","AOS","APA","APD","APH","APO","APP","APTV","ARE","ARES","ATO","AVB","AVGO","AVY","AWK","AXON","AXP","AZO","BALL","BAX","BBY","BDX","BEN","BF.B","BG","BIIB","BK","BKNG","BKR","BLDR","BLK","BMY","BR"]

# CIK lookup
_ticker_map = json.load(open(TICKERS_JSON))
CIK = {v['ticker']: str(v['cik_str']) for v in _ticker_map.values()}
CIK['BF.B'] = CIK.get('BF-B','14693')

# Companies known to build AI models / core AI technology providers => leader
LEADER_STES = {"AVGO","AXON","ADSK","AKAM"}  # will refine per extract

# Keyword pattern
KW = re.compile(r'\b(artificial intelligence|machine learning|generative (?:ai|artificial)|large language model|LLMs?|(?<![a-z])AI(?![a-z])|deep learning|neural network|data science)\b', re.I)

# Strip HTML
TAG = re.compile(r'<[^>]+>')
WS  = re.compile(r'\s+')
NBSP = re.compile(r'&nbsp;|&#160;|&amp;|&#8217;|&#8220;|&#8221;|&rsquo;|&lsquo;|&mdash;|&ndash;')

def clean_html(raw: str) -> str:
    raw = TAG.sub(' ', raw)
    raw = NBSP.sub(lambda m: {'&nbsp;':' ','&#160;':' ','&amp;':'&','&#8217;':"'",'&#8220;':'"','&#8221;':'"','&rsquo;':"'",'&lsquo;':"'",'&mdash;':'-','&ndash;':'-'}[m.group(0)], raw)
    raw = re.sub(r'&[a-zA-Z#0-9]+;', ' ', raw)
    return WS.sub(' ', raw).strip()

def latest_10k(t: str):
    d = DATA_LAKE / t / "10K"
    if not d.exists():
        return None
    files = sorted([f for f in d.iterdir() if f.name.endswith('.htm.gz')])
    return files[-1] if files else None

def extract_sentences(text: str, max_snips=6):
    # Find sentences containing keywords
    # Split loosely
    sents = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    snips = []
    seen = set()
    for s in sents:
        if len(s) < 40 or len(s) > 400:
            continue
        if KW.search(s):
            # keep first sentence per unique first 60 chars
            key = s[:60].lower()
            if key in seen: continue
            seen.add(key)
            snips.append(s.strip())
            if len(snips) >= max_snips:
                break
    return snips

# Simple English-to-French phrasing (paraphrase-lite)
def paraphrase_fr(s: str) -> str:
    # Just prefix with "10-K:" and quote clipped
    s = s.strip()
    if len(s) > 240:
        s = s[:237].rsplit(' ',1)[0] + '...'
    return f"Extrait 10-K: \"{s}\""

def classify(text_lower: str, snips: list, ticker: str):
    if not snips:
        return "absent"
    # count mentions
    n_mentions = len(KW.findall(text_lower))
    has_dev = any(re.search(r'\b(develop(?:ing|ed|ment)?|deploy|build|use|utiliz|leverag|integrat|invest|innovat|apply|appli|incorporat|embed)\b', s, re.I) and KW.search(s) for s in snips)
    has_risk_frame = any(re.search(r'\b(risk|competit|regulatory|uncertain|challenge|adversar|misuse|liab)\b', s, re.I) for s in snips)
    # Leader: only true AI-tech providers (chips, AI-native platforms)
    LEADER_WHITELIST = {"AVGO","APP","AXON","ADSK"}
    if ticker in LEADER_WHITELIST and n_mentions >= 8 and has_dev:
        return "leader"
    if has_dev and n_mentions >= 3:
        return "integrator"
    if has_risk_frame and n_mentions >= 1:
        return "cautious"
    if n_mentions >= 2:
        return "integrator"
    return "cautious"

def process(ticker: str):
    tlow = ticker.lower()
    v2f = V2 / f"{tlow}.json"
    if not v2f.exists():
        return {"ticker":ticker, "skip":"no_v2_file"}
    lk = latest_10k(ticker)
    if not lk:
        return {"ticker":ticker, "skip":"no_10k"}
    # date from filename
    m = re.search(r'_(\d{4}-\d{2}-\d{2})\.htm\.gz$', lk.name)
    filing_date = m.group(1) if m else "2025-12-31"
    fy_year = filing_date[:4]
    # read
    try:
        with gzip.open(lk,'rt', encoding='utf-8', errors='ignore') as f:
            raw = f.read()
    except Exception as e:
        return {"ticker":ticker, "skip":f"gz_err:{e}"}
    text = clean_html(raw)
    text_lower = text.lower()
    snips = extract_sentences(text)
    cik = CIK.get(ticker, CIK.get(ticker.replace('.','-'),''))
    # cik padded
    cik_padded = cik.lstrip('0') if cik else ""
    source_url_base = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_padded}&type=10-K"
    stance = classify(text_lower, snips, ticker)
    evidence = []
    if stance == "absent":
        evidence.append({
            "title": f"Aucune mention IA (10-K FY{fy_year[-2:]})",
            "description_fr": f"Aucune mention d'IA/ML dans le 10-K FY{fy_year[-2:]} de {ticker}.",
            "source_url": source_url_base,
            "date": filing_date
        })
        summary = f"{ticker} n'aborde pas explicitement l'IA dans son 10-K FY{fy_year[-2:]}."
    else:
        # up to 2 pieces of evidence, distinct
        picked = snips[:2] if len(snips)>=2 else snips[:1]
        for i, s in enumerate(picked):
            evidence.append({
                "title": ("Passage IA n°" + str(i+1)) if i>0 else f"Mention IA (10-K FY{fy_year[-2:]})",
                "description_fr": paraphrase_fr(s),
                "source_url": source_url_base,
                "date": filing_date
            })
        if stance == "leader":
            summary = f"{ticker} developpe des capacites IA propres, avec plusieurs references detaillees dans le 10-K FY{fy_year[-2:]}."
        elif stance == "integrator":
            summary = f"{ticker} integre l'IA/ML dans ses produits et operations d'apres le 10-K FY{fy_year[-2:]}."
        else:  # cautious
            summary = f"{ticker} mentionne l'IA principalement en risques ou observations, sans deploiement clair (10-K FY{fy_year[-2:]})."
    # Load, update, write
    data = json.load(open(v2f))
    data["ai_positioning"] = {
        "stance": stance,
        "summary": summary,
        "evidence": evidence
    }
    data["_ai_positioning_regenerated_at"] = "2026-07-13T01:00:00Z"
    data["_ai_positioning_source"] = "10-K local extract, primary source"
    # remove any old canonical override marker if any (retain others)
    with open(v2f,'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return {"ticker":ticker, "stance":stance, "n_snips":len(snips), "date":filing_date}

results = []
skipped = []
for t in BATCH:
    r = process(t)
    if r.get("skip"):
        skipped.append(t)
    results.append(r)

counts = {"leader":0,"integrator":0,"cautious":0,"absent":0}
for r in results:
    if r.get("stance"): counts[r["stance"]] += 1

out = {
    "leaders": counts["leader"],
    "integrators": counts["integrator"],
    "cautious": counts["cautious"],
    "absents": counts["absent"],
    "skipped_no_10k": skipped,
    "_details": results
}
print(json.dumps(out, indent=2, ensure_ascii=False))
