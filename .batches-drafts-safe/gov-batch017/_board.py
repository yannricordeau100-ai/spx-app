import re

def extract(t, txt):
    print(f'\n========== {t} ==========')
    # Board independence / women / size hints
    for q in [
        r'(?:board\s+(?:of\s+directors?)?[^.]{0,80})?independen(?:t|ce)[^.]{0,200}',
        r'(?:women|female|gender\s+diver)[^.]{0,300}',
        r'(\d+)\s+(?:of\s+\d+|out\s+of\s+\d+)\s+(?:director|board\s+member)',
        r'beneficial\s+ownership[^.]{0,80}',
    ]:
        matches = re.findall(q, txt, re.I)
        for m in matches[:3]:
            s = m if isinstance(m, str) else str(m)
            print(f'  [{q[:30]}] {s[:200]}')

CEOS = ['CPB','CPRT','CPT','CRH','CRL','CRM','CRWD','CRWV','CSCO']
for t in CEOS:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    extract(t, txt)
