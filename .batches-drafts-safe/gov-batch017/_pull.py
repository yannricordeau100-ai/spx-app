import re, json

def find_window(text, anchor, before=200, after=8000):
    m = re.search(anchor, text, re.I)
    if not m:
        return None
    s = max(0, m.start()-before)
    e = min(len(text), m.end()+after)
    return text[s:e]

CEOS = {
    'CPB': r'(Mick\s+J?\.?\s*Beekhuizen|Beekhuizen)',
    'CPRT': r'(Jeff(?:rey)?\s+Liaw|Liaw)',
    'CPT': r'(Alex(?:ander)?\s+(?:J\.?\s*K\.?\s+)?Jessett|Jessett|Ric\s+Campo|Campo)',
    'CRH': r'(Albert\s+Manifold|Jim\s+Mintern|Mintern)',
    'CRL': r'(Birgit\s+Girshick|Girshick|James\s+Foster)',
    'CRM': r'(Marc\s+R?\.?\s*Benioff|Benioff)',
    'CRWD': r'(George\s+R?\.?\s*Kurtz|Kurtz)',
    'CRWV': r'(Michael\s+(?:N\.?\s*)?Intrator|Intrator)',
    'CSCO': r'(Charles\s+H?\.?\s*Robbins|Chuck\s+Robbins|Robbins)',
}

for t in CEOS:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    # SCT window
    w = find_window(txt, r'Summary Compensation Table', before=0, after=6000)
    if w:
        # print first 3000 chars of SCT
        print('--- SCT excerpt ---')
        print(w[:3500])
