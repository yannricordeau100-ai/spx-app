#!/usr/bin/env python3
"""Heuristic auto-extract for all tickers — dumps targeted regions to txt for human review."""
import re, sys, os

def extract(path, ticker):
    with open(path) as f:
        t = f.read()
    out = []
    out.append(f"========== {ticker} ==========")

    # 1) SCT (Summary Compensation Table) — find a CEO row with $ amounts
    out.append("\n### SCT REGION ###")
    sct_matches = list(re.finditer(r'Summary Compensation Table', t, re.IGNORECASE))
    for m in sct_matches[:3]:
        e = min(len(t), m.end()+6000)
        chunk = t[m.start():e]
        # only keep chunks with $ amount patterns
        if '$' in chunk:
            out.append(chunk[:5500])
            out.append("---END SCT---")

    # 2) Beneficial owners > 5%
    out.append("\n### 5% HOLDERS REGION ###")
    for kw in ['5%', 'principal holders', 'principal stockholders', 'principal shareholders', 'beneficial owners of more than 5']:
        for m in re.finditer(kw, t, re.IGNORECASE):
            chunk = t[m.start():min(len(t), m.end()+3000)]
            if any(x in chunk for x in ['Vanguard', 'BlackRock', 'State Street', 'Berkshire', 'Capital']):
                out.append(f"[kw={kw}]")
                out.append(chunk[:3000])
                out.append("---END HOLDERS---")
                break
        else:
            continue
        break

    # 3) Board independence / diversity statements
    out.append("\n### BOARD COMPOSITION ###")
    for pat in [r'(\d+)\s+(?:of\s+)?(?:our|the)?\s*(\d+)\s+(?:director|nominee)', r'(?:identify as women|are women|women directors|female directors)', r'independent\s+(?:director|nominee)', r'(\d+)\s+independent']:
        for m in re.finditer(pat, t, re.IGNORECASE):
            s = max(0, m.start()-300); e = min(len(t), m.end()+300)
            chunk = t[s:e]
            if 'board' in chunk.lower() or 'director' in chunk.lower():
                out.append(f"[pat]: ...{chunk}...")
                if len(out) > 200: break

    return '\n'.join(out)

if __name__ == '__main__':
    path = sys.argv[1]
    ticker = sys.argv[2]
    print(extract(path, ticker))
