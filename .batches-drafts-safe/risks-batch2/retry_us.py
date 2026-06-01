#!/usr/bin/env python3
"""Retry US tickers that failed by trying earlier year filings (e.g. 2024)."""
import os, re, gzip, sys
sys.path.insert(0, "/tmp/risks-batch2")
from extract_text import strip_html, extract_us, truncate

OUT_DIR = "/tmp/risks-batch2/texts"
BASE = "/Users/yann/spx-app/sec-data"

failed = ["CLX","ED","EIX","EMR"]

for t in failed:
    print(f"--- {t} ---")
    chosen_path = None; chosen_year = None; chosen_sec = None
    for y in (2024, 2023):
        cand = f"{BASE}/cat1-us/10K/{y}"
        if not os.path.isdir(cand): continue
        files = [fn for fn in os.listdir(cand) if fn.startswith(f"{t}_")]
        if not files: continue
        p = f"{cand}/{sorted(files)[-1]}"
        with gzip.open(p, "rt", errors="replace") as fh:
            raw = fh.read()
        txt = strip_html(raw)
        sec = extract_us(txt)
        if sec and len(sec) > 5000:
            chosen_path, chosen_year, chosen_sec = p, y, sec
            break
    if chosen_sec:
        with open(f"{OUT_DIR}/{t}.txt","w") as f:
            f.write(f"TICKER={t}|YEAR={chosen_year}|CAT=us|SRC={chosen_path}\n")
            f.write(truncate(chosen_sec))
        print(f"  OK year={chosen_year}, sec_len={len(chosen_sec)}")
    else:
        print(f"  STILL FAILED")
