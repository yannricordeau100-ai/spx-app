#!/usr/bin/env python3
"""Show context around keyword."""
import re, sys

t = open(f'/tmp/gov-batch067/extracted/{sys.argv[1]}.txt').read()
kw = sys.argv[2]
ctx = int(sys.argv[3]) if len(sys.argv)>3 else 1500
for m in re.finditer(re.escape(kw), t, re.IGNORECASE):
    i = m.start()
    print(f'=== {kw} at {i} ===')
    print(t[max(0,i-200):i+ctx])
    print()
