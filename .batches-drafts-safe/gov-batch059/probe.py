#!/usr/bin/env python3
"""Probe extracted text for governance signals."""
import re, sys

def main():
    path = sys.argv[1]
    with open(path) as f:
        t = f.read()

    print(f"\n===== {path} =====")
    # CEO
    print("\n--- CEO mentions ---")
    for m in re.finditer(r'(Chief Executive Officer|Chairman[,\s]+(?:President\s+)?(?:and\s+)?Chief Executive|CEO)', t):
        s = max(0, m.start()-200); e = min(len(t), m.end()+200)
        snippet = t[s:e].strip()
        if any(x in snippet for x in ['since', 'appointed', 'biograph', 'Director Since', 'Age']):
            print(repr(snippet[:400]))
            print('---')

    # Summary Compensation Table
    print("\n--- SCT ---")
    for m in re.finditer(r'Summary Compensation Table', t, re.IGNORECASE):
        s = m.start(); e = min(len(t), m.end()+3000)
        print(repr(t[s:e][:2500]))
        print('---SCT END---')
        break

    # Board independence
    print("\n--- Board indep/size ---")
    for m in re.finditer(r'(independent\s+director|board\s+(?:of\s+directors|composition)|director\s+independence)', t, re.IGNORECASE):
        s = max(0, m.start()-150); e = min(len(t), m.end()+300)
        print(repr(t[s:e][:500]))
        print('---')
        if m.start() > 80000: break

    # Beneficial ownership
    print("\n--- Beneficial ownership ---")
    for m in re.finditer(r'(beneficial\s+ownership|principal\s+(?:stockholders|shareholders)|5%\s+(?:beneficial|holders))', t, re.IGNORECASE):
        s = m.start(); e = min(len(t), m.end()+4000)
        print(repr(t[s:e][:3500]))
        print('---OWN END---')
        break

if __name__ == '__main__':
    main()
