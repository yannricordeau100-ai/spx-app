import re

# Find 5% owners table per ticker
def get_owners(txt):
    # Look for "Security Ownership" or "Beneficial Owners" table
    for kw in [r'Security Ownership[^.]{0,80}Certain Beneficial Owners', 
               r'Persons Owning More Than',
               r'5% or More',
               r'5%\s+Stockholders',
               r'Principal Stockholders',
               r'Principal Shareholders',
               r'Major Shareholders',
               r'5%\s+Beneficial Owners']:
        m = re.search(kw, txt, re.I)
        if m:
            yield (kw, m.start())

for t in ['CPB','CPRT','CPT','CRH','CRL','CRM','CRWD','CRWV','CSCO']:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    for kw, pos in get_owners(txt):
        snippet = txt[pos:pos+5000]
        snippet = re.sub(r'\s+',' ', snippet)
        # Look for known big shareholders
        if re.search(r'(BlackRock|Vanguard|FMR|State Street|Capital|Trust|Inc\.|LLC|Magnetar|NVIDIA)', snippet):
            print(f'  [{kw}] @{pos}: {snippet[:3500]}')
            print('---')
            break
