#!/usr/bin/env python3
"""Search source text for a keyword pattern and show position + surrounding context."""
import sys, re
src=open(sys.argv[1]).read()
pattern=sys.argv[2]
total=len(src)
for m in re.finditer(pattern, src, re.IGNORECASE):
    pos=m.start()
    third = 'early' if pos<total/3 else ('mid' if pos<2*total/3 else 'late')
    start=max(0,pos-40)
    end=min(len(src),pos+250)
    print(f"[{pos}/{total} {third}] ...{src[start:end]}...")
    print("---")
