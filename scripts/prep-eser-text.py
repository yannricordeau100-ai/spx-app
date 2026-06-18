#!/usr/bin/env python3
"""prep-eser-text.py — pré-extrait le texte des ER/ES de chaque sté restante
vers data-lake/<t>/_srctext.txt (strip HTML / pdftotext, capé ~15K chars).
Bas-RAM (1 doc à la fois). Évite le thrash de contexte des agents Claude."""
import os, re, glob, subprocess, sys
DOCS = os.path.expanduser("~/Mettrik/docs")

if len(sys.argv) > 1:
    tickers = [l.strip() for l in open(sys.argv[1]) if l.strip()]
else:
    tickers = []
    for f in sorted(glob.glob("data-lake/eser_chunks/chunk_*.txt")):
        tickers += [l.strip() for l in open(f) if l.strip()]

def strip_doc(p):
    try:
        if p.lower().endswith((".htm", ".html")):
            txt = open(p, encoding="utf-8", errors="ignore").read()
            txt = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", txt)
            txt = re.sub(r"<[^>]+>", " ", txt)
            txt = re.sub(r"&[a-z#0-9]+;", " ", txt)
        else:
            txt = subprocess.run(["/opt/homebrew/bin/pdftotext", "-l", "12", "-q", p, "-"],
                                 capture_output=True, timeout=25).stdout.decode("utf-8", "ignore")
        return re.sub(r"\s+", " ", txt).strip()
    except Exception:
        return ""

def doc_score(fname):
    # plus haut = plus récent / préféré. edgar_* (Ex99.1 trimestriel fiable) priorisés.
    m = re.match(r"edgar_\d+-(\d{2})-(\d+)", fname)
    if m:
        return (2, int(m.group(1)), int(m.group(2)))
    yrs = re.findall(r"20(\d{2})", fname)
    return (1, max((int(y) for y in yrs), default=0), 0)

def collect(t):
    chunks = []
    for kind, lim in (("ER", 20), ("ES", 2)):
        d = f"{DOCS}/{t}/{kind}"
        if not os.path.isdir(d):
            continue
        files = sorted([f for f in os.listdir(d) if not f.startswith(".")], key=doc_score, reverse=True)[:lim]
        for f in files:
            s = strip_doc(f"{d}/{f}")
            if len(s) > 200:
                chunks.append(f"=== [{kind}] {f} ===\n" + s[:6500])
    return "\n\n".join(chunks)[:110000]

n = 0
for i, t in enumerate(tickers):
    txt = collect(t)
    if len(txt) < 200:
        continue
    tl = t.lower()
    os.makedirs(f"data-lake/{tl}", exist_ok=True)
    open(f"data-lake/{tl}/_srctext.txt", "w").write(txt)
    n += 1
    if (i + 1) % 20 == 0:
        print(f"  {i+1}/{len(tickers)} traités", flush=True)
print(f"pré-extrait: {n}/{len(tickers)} stés -> _srctext.txt")
