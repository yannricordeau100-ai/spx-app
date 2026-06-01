import re

for t in ['CPT','CRL','CRWD']:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    # Find "Beneficial Owners" section
    found = False
    for kw in ['Persons Owning More Than 5%', 'Beneficial Owners of More Than', 
               '5% Stockholders','five percent','principal shareholders','Principal Shareholders',
               'Beneficial Ownership of Securities','PRINCIPAL SHAREHOLDERS','PRINCIPAL STOCKHOLDERS',
               'Principal Beneficial Owners','holder of more than 5%','beneficial owners of more than 5%',
               'Greater Than 5%','greater than 5%']:
        for m in re.finditer(re.escape(kw), txt, re.I):
            pos = m.start()
            block = txt[pos:pos+6000]
            block = re.sub(r'\s+',' ', block)
            if re.search(r'(BlackRock|Vanguard|FMR|State Street|Fidelity|Capital Group|Magnetar)[^.]{0,200}\d+\.\d+\s*%', block, re.I):
                print(f'[{kw}] @{pos}: {block[:3000]}')
                print('---')
                found=True
                break
        if found: break
