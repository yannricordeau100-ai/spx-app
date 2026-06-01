#!/usr/bin/env python3
"""Probe 2: focused on SCT totals and 5% holders."""
import re, sys

def main():
    path = sys.argv[1]
    with open(path) as f:
        t = f.read()

    print(f"\n===== {path} =====")
    # Find Summary Compensation Table region
    print("\n--- SCT REGION (CEO row) ---")
    # Look for "Total" near $ amounts near "Chief Executive Officer"
    for m in re.finditer(r'Summary Compensation Table', t, re.IGNORECASE):
        # Print first 6000 chars after
        s = m.start(); e = min(len(t), m.end()+8000)
        print(t[s:e])
        print('---')
        break

    print("\n--- 5% / Principal holders region ---")
    # Find region with Vanguard / BlackRock / similar
    for kw in ['BlackRock', 'Vanguard', 'State Street', 'principal holders', '5%']:
        for m in re.finditer(kw, t, re.IGNORECASE):
            s = max(0, m.start()-500); e = min(len(t), m.end()+1500)
            print(f"[match {kw}]")
            print(t[s:e])
            print('---')
            break

if __name__ == '__main__':
    main()
