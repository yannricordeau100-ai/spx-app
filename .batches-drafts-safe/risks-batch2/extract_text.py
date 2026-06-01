#!/usr/bin/env python3
"""
Extract Risk Factors section text from each source file.
Writes to /tmp/risks-batch2/texts/<ticker>.txt (max ~40 KB per file).
"""
import os, sys, re, gzip, html

SRC_TSV = "/tmp/risks-batch2/sources.tsv"
OUT_DIR = "/tmp/risks-batch2/texts"
os.makedirs(OUT_DIR, exist_ok=True)

def strip_html(html_text):
    # Remove script/style
    html_text = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html_text, flags=re.S|re.I)
    # Replace tags with space
    html_text = re.sub(r'<[^>]+>', ' ', html_text)
    # Unescape entities
    html_text = html.unescape(html_text)
    # Collapse whitespace
    html_text = re.sub(r'[\xa0  ]', ' ', html_text)
    html_text = re.sub(r'\s+', ' ', html_text)
    return html_text.strip()

def extract_us(text):
    """Find Item 1A. Risk Factors body.
    Strategy: find ALL matches of 'Item 1A...Risk Factors'. The BODY match is the
    one where the next 5000 chars do NOT reference 'Item 1A' again, AND has many risk words.
    """
    # Be lenient with whitespace - some 10-Ks have "I TEM 1A" with space
    matches = list(re.finditer(r'I\s*T\s*E\s*M\s*1\s*A[\.\s]*R\s*I\s*S\s*K\s*F\s*A\s*C\s*T\s*O\s*R\s*S', text, re.I))
    if not matches:
        matches = list(re.finditer(r'Item\s*1A[\.\s,:\-—–]*Risk\s*Factors', text, re.I))
    if not matches:
        # Some 10-Ks (utilities) just say "RISK FACTORS" all caps as section heading
        matches = list(re.finditer(r'(?<![A-Za-z])RISK\s+FACTORS(?![A-Za-z])', text))
    if not matches:
        return None
    # Score each match: count of "may", "risk", "could" in next 8000 chars, minus penalty if "Item 1A" appears again soon
    best = None; best_score = -1e9
    for m in matches:
        nxt = text[m.start()+50:m.start()+10000]
        # TOC matches usually have short distance to next Item 1B
        # Look for Item 1B in next 800 chars - if found, this IS toc
        toc_match = re.search(r'Item\s*1B', text[m.start()+50:m.start()+800], re.I)
        toc_penalty = 200 if toc_match else 0
        score = (len(re.findall(r'\b(may|could|risk|adverse|fail|loss)\b', nxt, re.I))
                 - toc_penalty)
        if score > best_score:
            best_score = score; best = m
    if best is None:
        best = matches[-1]
    start = best.start()
    end = len(text)
    for ep in [r'Item\s*1B[\.\s]*Unresolved\s*Staff', r'Item\s*1B[\.\s]+Unresolved',
               r'Unresolved\s*Staff\s*Comments', r'Item\s*2[\.\s]*Properties']:
        em = re.search(ep, text[start+1000:], re.I)
        if em:
            end = min(end, start+1000+em.start())
    section = text[start:end]
    return section

def extract_fpi(text):
    """20-F: Item 3.D Risk Factors - pick BODY match (high risk-word density)."""
    matches = list(re.finditer(r'Item\s*3[\.\s]*D[\.\s]*Risk\s*Factors', text, re.I))
    if not matches:
        matches = list(re.finditer(r'(?<![A-Za-z])Risk\s*Factors(?![A-Za-z])', text, re.I))
    if not matches:
        return None
    best=None; best_score=-1
    for m in matches:
        nxt = text[m.start()+50:m.start()+10000]
        score = (len(re.findall(r'\b(may|could|risk|adverse|fail|loss)\b', nxt, re.I))
                 - 50*len(re.findall(r'Risk\s*Factors', nxt, re.I)))
        if score > best_score:
            best_score=score; best=m
    start = best.start()
    end = len(text)
    for ep in [r'Item\s*4[\.\s]*Information\s*on\s*the\s*Company', r'Item\s*4[A-Z]?[\.\s]+', r'Item\s*3[\.\s]*E[\.\s]*']:
        em = re.search(ep, text[start+1000:], re.I)
        if em:
            end = min(end, start+1000+em.start())
    return text[start:end]

def extract_eu(text):
    """EU annual report - look for Risk Factors / Risikofaktoren / Facteurs de risque / Fattori di rischio"""
    patterns = [
        r'Risk\s*Factors',
        r'Principal\s*Risks',
        r'Risk\s*Management',
        r'Risikofaktoren',
        r'Risiken',
        r'Facteurs\s*de\s*risque',
        r'Gestion\s*des\s*risques',
        r'Fattori\s*di\s*rischio',
        r'Gestione\s*dei\s*rischi',
        r'Factores\s*de\s*riesgo',
    ]
    best = None
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            best = m
            break
    if not best:
        return None
    start = best.start()
    # End: next major section heading after ~40 KB
    section = text[start:start+80000]
    return section

def truncate(s, maxlen=45000):
    if len(s) <= maxlen:
        return s
    return s[:maxlen] + "\n[...TRUNCATED...]"

with open(SRC_TSV) as f:
    rows = [l.rstrip("\n").split("\t") for l in f if l.strip()]

ok = 0; nofound = 0
for row in rows:
    t, path, year, cat = row
    safe_t = t.replace("/", "_")
    out_path = f"{OUT_DIR}/{safe_t}.txt"
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        ok += 1
        continue
    try:
        if path.endswith(".gz"):
            with gzip.open(path, "rt", errors="replace") as fh:
                raw = fh.read()
            txt = strip_html(raw)
        else:
            with open(path, "r", errors="replace") as fh:
                txt = fh.read()
        if cat == "us":
            sec = extract_us(txt)
        elif cat == "fpi":
            sec = extract_fpi(txt)
        else:
            sec = extract_eu(txt)
        if sec is None or len(sec) < 500:
            with open(out_path, "w") as fh:
                fh.write(f"NO_RISK_SECTION|year={year}|cat={cat}|path={path}\n")
                fh.write(f"---raw_excerpt---\n{txt[:5000]}")
            nofound += 1
        else:
            with open(out_path, "w") as fh:
                fh.write(f"TICKER={t}|YEAR={year}|CAT={cat}|SRC={path}\n")
                fh.write(truncate(sec))
            ok += 1
    except Exception as e:
        with open(out_path, "w") as fh:
            fh.write(f"ERROR: {e}\n")
        nofound += 1
    if (ok+nofound) % 25 == 0:
        print(f"Progress: {ok+nofound}/{len(rows)}", flush=True)

print(f"OK={ok} NO_SECTION={nofound}")
