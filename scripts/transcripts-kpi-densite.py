#!/usr/bin/env python3
"""Densite des extractions brutes /tmp/transcripts-kpi/<T>.<date>.json : KPI pour 10 000
caracteres de transcript. Sous 3 = extraction incomplete (mediane observee 9,4). Code 1 si faible."""
import json, sys, os, glob
t = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tr = {c['date']: len(c['content']) for c in json.load(open(f'{ROOT}/src/data/transcripts/{t.lower()}.json'))['calls']}
faible = False
for d, L in sorted(tr.items()):
    p = f'/tmp/transcripts-kpi/{t}.{d}.json'
    n = len(json.load(open(p)).get('kpis', [])) if os.path.exists(p) else 0
    x = n * 10000 / L; faible |= x < 3
    print(f'{t} {d} {n} KPI / {L} car = {x:.1f}' + ('  FAIBLE' if x < 3 else ''))
sys.exit(1 if faible else 0)
