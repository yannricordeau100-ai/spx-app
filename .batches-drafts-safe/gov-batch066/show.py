#!/usr/bin/env python3
import re, sys
t = open(f'/tmp/gov-batch066/extracted/{sys.argv[1]}.txt').read()
kw = sys.argv[2]
ctx = int(sys.argv[3]) if len(sys.argv)>3 else 1200
for m in re.finditer(re.escape(kw), t, re.IGNORECASE):
    i=m.start()
    print(f'=== @{i} ===')
    print(t[max(0,i-150):i+ctx])
    print()
