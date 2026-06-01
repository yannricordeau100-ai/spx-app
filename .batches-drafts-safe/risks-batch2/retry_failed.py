#!/usr/bin/env python3
"""Retry failed extractions by trying earlier years for EU, and looser regex for FPI."""
import os, re, gzip, html, sys
sys.path.insert(0, "/tmp/risks-batch2")
from extract_text import strip_html, extract_us, extract_fpi, extract_eu, truncate

OUT_DIR = "/tmp/risks-batch2/texts"
BASE = "/Users/yann/spx-app/sec-data"

failed = ["CLNX.MC","CON.DE","DANSKE.CO","DIM.PA","DOC.VI","ENR.DE","FLTR.L","EIPAF"]

# Update sources for EU ones - find best file
def best_eu(ticker):
    d = f"{BASE}/cat3-european/{ticker}/annual-text"
    if not os.path.isdir(d):
        return None, None
    candidates = []
    for fn in os.listdir(d):
        if fn.endswith(".txt"):
            y = fn.replace(".txt","")
            try: yi = int(y)
            except: continue
            p = f"{d}/{fn}"
            sz = os.path.getsize(p)
            with open(p, errors="replace") as fh:
                txt = fh.read(50000)
            score = sum([
                len(re.findall(r'risk|risiko|risico|risque|riesgo|rischio', txt, re.I))
            ])
            candidates.append((score, sz, yi, p))
    if not candidates:
        return None, None
    # prefer high score, then most recent year, then larger
    candidates.sort(key=lambda x: (-x[0], -x[2], -x[1]))
    return candidates[0][3], candidates[0][2]

results = []
for t in failed:
    print(f"--- {t} ---")
    if t in ("EIPAF",):
        # FPI - try looser approach
        # Find file
        path = None
        for y in (2026,2025,2024):
            cand = f"{BASE}/cat2-foreign-adr/20F/{y}"
            if not os.path.isdir(cand): continue
            for fn in os.listdir(cand):
                if fn.startswith(f"{t}_"):
                    path = f"{cand}/{fn}"
                    year = y
                    break
            if path: break
        if not path:
            print("  no file"); continue
        with gzip.open(path, "rt", errors="replace") as fh:
            raw = fh.read()
        txt = strip_html(raw)
        # try harder - any "risk" header
        m = re.search(r'(risk\s+factors|principal\s+risks)', txt, re.I)
        if m:
            sec = txt[m.start():m.start()+60000]
            with open(f"{OUT_DIR}/{t}.txt","w") as f:
                f.write(f"TICKER={t}|YEAR={year}|CAT=fpi|SRC={path}\n")
                f.write(truncate(sec))
            print(f"  OK at offset {m.start()}, year={year}")
        else:
            print(f"  STILL NO MATCH in 20-F (txt len={len(txt)})")
    else:
        # EU - find best year
        path, year = best_eu(t)
        if not path:
            print("  no file"); continue
        with open(path, errors="replace") as fh:
            txt = fh.read()
        # Try harder
        patterns = [
            r'Risk\s*Factors', r'Principal\s*Risks', r'Risk\s*Management',
            r'Risikoberichterstattung', r'Risikofaktoren', r'Risiken',
            r'Risikomanagement', r'Risk\s*Report',
            r'Facteurs\s*de\s*risque', r'Gestion\s*des\s*risques', r'Risques',
            r'Fattori\s*di\s*rischio', r'Gestione\s*dei\s*rischi', r'Rischi',
            r'Factores\s*de\s*riesgo', r'Riesgos',
            r'Risici', r'Risikofaktorer'
        ]
        m = None
        for p in patterns:
            m = re.search(p, txt, re.I)
            if m: break
        if m:
            sec = txt[m.start():m.start()+80000]
            with open(f"{OUT_DIR}/{t}.txt","w") as f:
                f.write(f"TICKER={t}|YEAR={year}|CAT=eu|SRC={path}\n")
                f.write(truncate(sec))
            print(f"  OK pattern={p}, year={year}")
        else:
            # No risk mention - keep the raw
            with open(f"{OUT_DIR}/{t}.txt","w") as f:
                f.write(f"NO_RISK_SECTION|year={year}|cat=eu|path={path}\n")
                f.write(f"---raw_excerpt---\n{txt[:8000]}")
            print(f"  STILL NO MATCH (txt len={len(txt)}, year={year})")
