import re, os, json, html

def html_to_text(s):
    # remove scripts/styles
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S|re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'\s+', ' ', s)
    return s

for t in ['CPB','CPRT','CPT','CRH','CRL','CRM','CRWD','CRWV','CSCO']:
    path = f'/tmp/gov-batch017/raw/{t}.htm'
    with open(path, encoding='utf-8', errors='ignore') as f:
        raw = f.read()
    txt = html_to_text(raw)
    out = f'/tmp/gov-batch017/raw/{t}.txt'
    open(out,'w').write(txt)
    print(f'{t}: {len(txt)} chars')
