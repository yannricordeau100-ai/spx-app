#!/usr/bin/env python3
"""Multi-pattern finder for one ticker."""
import re, sys

def find_sct(t, ceo_lastname_options):
    """Find SCT row total for CEO."""
    out = []
    for m in re.finditer(r'(?:Summary Compensation Table|Name and Principal Position)', t, re.IGNORECASE):
        e = min(len(t), m.end()+3500)
        chunk = t[m.start():e]
        if '$' in chunk and 'Total' in chunk and ('Salary' in chunk or 'Stock Awards' in chunk):
            out.append(chunk[:3000])
    return '\n---\n'.join(out[:2])

def find_5pct(t):
    """Find 5% holders block."""
    candidates = []
    for kw in ['Vanguard', 'BlackRock', 'State Street', 'Berkshire', 'Capital Group']:
        for m in re.finditer(kw, t):
            s = max(0, m.start()-500); e = min(len(t), m.end()+2500)
            chunk = t[s:e]
            # must contain % and at least 2 institution names
            insts = sum(1 for x in ['Vanguard','BlackRock','State Street','FMR','Berkshire','Capital','T. Rowe','Wellington'] if x in chunk)
            if '%' in chunk and insts >= 2:
                candidates.append((insts, chunk[:2500]))
    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1] if candidates else ''

def find_board(t):
    """Find board size / independence / women indicators."""
    out = []
    for pat in [r'(\d+)\s+(?:director|nominee)s?[^.]{0,100}(?:independent|board)',
                r'(?:board\s+consist|consists of|currently\s+(?:has|consists)|presently\s+consists)[^.]{0,200}\d+',
                r'(\d+)\s+(?:of\s+(?:our|the)\s+)?(?:\d+\s+)?(?:director|nominee)s?[^.]{0,100}(?:are\s+independent|independent)',
                r'(?:women|female)[^.]{0,200}(?:director|board|nominee)',
                r'(?:director|board|nominee)[^.]{0,200}(?:women|female)',
                r'gender\s+(?:diverse|identity|composition)',
                r'(?:identify\s+as\s+women|are\s+women)',
                ]:
        for m in re.finditer(pat, t, re.IGNORECASE):
            s = max(0, m.start()-100); e = min(len(t), m.end()+300)
            out.append(t[s:e])
    return '\n---\n'.join(out[:30])

if __name__ == '__main__':
    ticker = sys.argv[1]
    t = open(f'{ticker}.txt').read()
    print(f"========== {ticker} ==========")
    print("\n### SCT ###")
    print(find_sct(t, []))
    print("\n### 5% ###")
    print(find_5pct(t))
    print("\n### BOARD ###")
    print(find_board(t))
