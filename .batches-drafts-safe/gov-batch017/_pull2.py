import re, json

# Find the SCT table by locating "Total" pattern with $ amounts near CEO name
def find_sct_total(txt, ceo_pattern):
    # SCT typically has rows like: CEO Name | year | salary | bonus | stock | options | non-equity | pension | other | total
    # Look for a fragment with the CEO + a sequence of numeric values culminating in a Total
    # First find all occurrences of CEO
    matches = list(re.finditer(ceo_pattern, txt, re.I))
    candidates = []
    for m in matches:
        s = max(0, m.start()-50)
        e = min(len(txt), m.end()+1200)
        window = txt[s:e]
        # extract numbers (look for $ values or large numbers with commas)
        nums = re.findall(r'\$?\s*([\d,]{5,15})(?:\s|$)', window)
        # filter to plausible salary/comp range
        plausible = [n for n in nums if ',' in n or (len(n) >= 5)]
        if len(plausible) >= 4:
            candidates.append((m.start(), window, plausible))
    return candidates

CEOS = {
    'CPB': r'Beekhuizen',
    'CPRT': r'Liaw',
    'CPT': r'(?:Campo|Jessett)',
    'CRH': r'Mintern',
    'CRL': r'Girshick',
    'CRM': r'Benioff',
    'CRWD': r'Kurtz',
    'CRWV': r'Intrator',
    'CSCO': r'Robbins',
}

for t, pat in CEOS.items():
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    cands = find_sct_total(txt, pat)
    print(f'\n========== {t} - {len(cands)} candidates ==========')
    for pos, w, nums in cands[:3]:
        print(f'@{pos}: numbers={nums[:12]}')
        print(f'  snippet: ...{w[:400]}...')
        print()
