import re

# search for table rows containing institutional names with %
def find_holdings_table(txt, name='unknown'):
    # The pattern: large named entity followed by share count and percent
    holders = ['BlackRock','Vanguard','FMR','State Street','Capital Group','Fidelity','Dimensional','T. Rowe','Wellington','Pzena','Magnetar','Nvidia','NVIDIA','JPMorgan','Morgan Stanley']
    results = []
    # Find blocks of 1000-2000 chars containing 2+ of these
    chunks = []
    for i in range(0, len(txt), 3000):
        block = txt[i:i+4000]
        cnt = sum(1 for h in holders if h.lower() in block.lower())
        if cnt >= 2:
            chunks.append((i, cnt, block))
    chunks.sort(key=lambda x: -x[1])
    return chunks[:3]

for t in ['CPB','CPRT','CPT','CRL','CRM','CRWD','CRWV','CSCO']:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    print(f'\n========== {t} ==========')
    for pos, cnt, block in find_holdings_table(txt, t):
        # Print only if it looks like an ownership table
        block = re.sub(r'\s+', ' ', block)
        if re.search(r'(\d{1,3}(?:,\d{3}){2,5})\s+\d+\.\d+', block):
            print(f'@{pos} matches={cnt}: {block[:2500]}')
            print('---')
            break
