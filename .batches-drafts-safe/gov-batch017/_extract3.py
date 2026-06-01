import re

# Broader, search for any "X independent" and "women"
for t in ['CPRT','CPT','CRH','CRL','CRWD','CRWV','CSCO']:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    print('-- INDEP context --')
    # All "independent" within 50 chars of a number
    for m in re.finditer(r'[\d]+(?:\s*\(\s*\d+%\s*\))?(?:%|\s+out\s+of|\s+of\s+\d+)[^.]{0,200}?independ', txt, re.I):
        ctx = re.sub(r'\s+',' ', txt[max(0,m.start()-100):m.end()+100])
        print(f'  {ctx[:300]}')
    for m in re.finditer(r'independ[^.]{0,200}?[\d]+(?:%|\s+of\s+\d+)', txt, re.I):
        ctx = re.sub(r'\s+',' ', txt[max(0,m.start()-100):m.end()+100])
        print(f'  ?{ctx[:300]}')
    print('-- WOMEN/GENDER --')
    for m in re.finditer(r'(\d+)\s*(?:%|of\s+\d+|out\s+of\s+\d+)[^.]{0,100}wom[ae]n', txt, re.I):
        ctx = re.sub(r'\s+',' ', txt[max(0,m.start()-100):m.end()+100])
        print(f'  {ctx[:300]}')
    for m in re.finditer(r'wom[ae]n[^.]{0,150}?\d+', txt, re.I):
        ctx = re.sub(r'\s+',' ', txt[max(0,m.start()-30):m.end()+100])
        print(f'  ?{ctx[:300]}')
