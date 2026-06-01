#!/usr/bin/env python3
import os, sys

BASE = "/Users/yann/spx-app/sec-data"
IDX = "/tmp/risks-batch2"

def load(p):
    try:
        with open(p) as f:
            return [l.strip() for l in f if l.strip()]
    except: return []

us = {}
for y in (2026, 2025, 2024):
    for fn in load(f"{IDX}/us{y}.idx"):
        # fn like AAPL_2026-02-23.htm.gz
        t = fn.split("_")[0]
        key = (t, y)
        if key not in us:
            us[key] = fn

fpi = {}
for y in (2026, 2025, 2024):
    for fn in load(f"{IDX}/fpi{y}.idx"):
        t = fn.split("_")[0]
        key = (t, y)
        if key not in fpi:
            fpi[key] = fn

eu_dirs = set(load(f"{IDX}/eu.idx"))

tickers = load(f"{IDX}/tickers.txt")

out_src = []
out_none = []

for t in tickers:
    found = None
    # us
    for y in (2026, 2025, 2024):
        if (t, y) in us:
            found = (f"{BASE}/cat1-us/10K/{y}/{us[(t,y)]}", y, "us")
            break
    if not found:
        for y in (2026, 2025, 2024):
            if (t, y) in fpi:
                found = (f"{BASE}/cat2-foreign-adr/20F/{y}/{fpi[(t,y)]}", y, "fpi")
                break
    if not found:
        # EU - dir matches uppercase ticker as-is or with case
        cands = [t, t.upper()]
        for c in cands:
            if c in eu_dirs:
                for y in range(2026, 2010, -1):
                    p = f"{BASE}/cat3-european/{c}/annual-text/{y}.txt"
                    if os.path.isfile(p):
                        found = (p, y, "eu")
                        break
                if found: break
    if found:
        out_src.append(f"{t}\t{found[0]}\t{found[1]}\t{found[2]}")
    else:
        out_none.append(t)

with open(f"{IDX}/sources.tsv","w") as f:
    f.write("\n".join(out_src)+"\n")
with open(f"{IDX}/no_source.txt","w") as f:
    f.write("\n".join(out_none)+"\n")

print(f"WITH_SOURCE: {len(out_src)}")
print(f"NO_SOURCE: {len(out_none)}")
print("NO_SOURCE list:")
for t in out_none: print(" ", t)
