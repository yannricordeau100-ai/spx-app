#!/usr/bin/env python3
"""prep-risks-gov.py — pré-extrait, EN LOCAL (zéro API), les sources des 2
catégories que l'extraction ES/ER ne couvre pas :
  - risques : Item 1A (Risk Factors) du dernier 10-K (US) ou 20-F (FPI)
  - gouvernance : dernier DEF 14A (proxy, US)
Sortie : data-lake/<t>/_risks_src.txt + _gov_src.txt (verbatim, pour qu'un
agent Opus en tire ensuite la version FR). Bas-RAM : 1 fichier gz à la fois."""
import os, re, glob, gzip, sys

SEC = os.path.expanduser("~/Mettrik/sec-data")
tickers = [l.strip() for l in open(sys.argv[1]) if l.strip()]

def read_gz(p):
    try:
        with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        try:
            return open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            return ""

def strip_html(t):
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&[a-z#0-9]+;", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def latest(base, t):
    fs = glob.glob(f"{SEC}/{base}/*/{t}_*")
    if not fs:
        return None
    def d(p):
        m = re.search(r"_(\d{4}-\d{2}-\d{2})", os.path.basename(p))
        return m.group(1) if m else ""
    return sorted(fs, key=d)[-1]

def item1a(txt):
    """Plus longue tranche entre 'item 1a' et 'item 1b'/'item 2' (= vrai
    Risk Factors, pas la table des matières)."""
    low = txt.lower()
    best = ""
    for m in re.finditer(r"item\s*1a", low):
        s = m.start()
        e = re.search(r"item\s*1b|item\s*2\b|unresolved staff", low[s + 12:])
        end = s + 12 + e.start() if e else min(s + 110000, len(txt))
        chunk = txt[s:end]
        if len(chunk) > len(best):
            best = chunk
    return best[:95000]

n_r = n_g = 0
for i, t in enumerate(tickers):
    tl = t.lower()
    d = f"data-lake/{tl}"
    os.makedirs(d, exist_ok=True)
    f10 = latest("cat1-us/10K", t) or latest("cat2-foreign-adr/20F", t)
    if f10:
        s = strip_html(read_gz(f10))
        r = item1a(s)
        if len(r) < 1500:           # Item 1A introuvable -> garde un extrait brut
            r = s[:95000]
        if len(r) > 800:
            open(f"{d}/_risks_src.txt", "w").write(f"=== {os.path.basename(f10)} ===\n" + r)
            n_r += 1
    fdef = latest("cat1-us/DEF14A", t)
    if fdef:
        g = strip_html(read_gz(fdef))[:115000]
        if len(g) > 800:
            open(f"{d}/_gov_src.txt", "w").write(f"=== {os.path.basename(fdef)} ===\n" + g)
            n_g += 1
    if (i + 1) % 25 == 0:
        print(f"  {i+1}/{len(tickers)} | risks {n_r} gov {n_g}", flush=True)
print(f"DONE {len(tickers)} stés | risks_src {n_r} | gov_src {n_g}")
