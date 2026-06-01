import re

def search(txt, patterns, ctx=300):
    for p in patterns:
        for m in re.finditer(p, txt, re.I):
            s = max(0, m.start()-ctx)
            e = min(len(txt), m.end()+ctx)
            yield (p, m.group(0), re.sub(r'\s+',' ', txt[s:e])[:600])

# Per ticker, look for specific governance facts
for t in ['CPB','CPRT','CPT','CRH','CRL','CRM','CRWD','CRWV','CSCO']:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    # Patterns - "X of N directors are independent" / women / board composition
    for kind, pats in [
        ('INDEP', [
            r'all\s+(?:our\s+)?(?:directors?|trustees?|members?)\s+(?:are|except)[^.]{0,200}independent',
            r'(\d+)\s+of\s+(?:our\s+)?(\d+)\s+(?:director|trustee|board member)[^.]{0,100}independent',
            r'(\d+)%[^.]{0,100}(?:director|trustee|board member|board)[^.]{0,30}independent',
        ]),
        ('WOMEN', [
            r'(\d+)\s+(?:of|out\s+of)\s+(?:our\s+)?(\d+)\s+(?:director|trustee|nominee|board)[^.]{0,100}(?:are\s+women|female)',
            r'(\d+)%[^.]{0,80}women',
            r'(\d+)\s+(?:of\s+\d+|of\s+our)\s*women',
        ]),
    ]:
        print(f'  ---{kind}---')
        seen = set()
        cnt = 0
        for p, hit, ctx in search(txt, pats, ctx=150):
            key = hit[:60]
            if key in seen: continue
            seen.add(key)
            print(f'    [{hit[:80]}] {ctx[:400]}')
            cnt += 1
            if cnt >= 4: break
