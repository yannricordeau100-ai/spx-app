import sys, re, os
for fn in sorted(os.listdir('/tmp/risks-batch060/extract')):
    if not fn.endswith('.txt'): continue
    t=fn.replace('.txt','')
    if t=='0': continue
    with open(f'/tmp/risks-batch060/extract/{fn}') as f:
        txt=f.read()
    # Heuristic: sentences ending with period that talk about risk
    # Find typical risk subheading patterns: "Risks Related to ..." etc.
    print(f'\n=== {t} ({len(txt)} chars) ===')
    headings=re.findall(r'(Risks?\s+(?:Related to|Relating to|of|from|associated with)[^.]{5,150}\.)', txt, re.IGNORECASE)
    seen=set()
    for h in headings[:30]:
        h2=h.strip()
        if h2 not in seen:
            seen.add(h2)
            print(' -', h2[:200])
