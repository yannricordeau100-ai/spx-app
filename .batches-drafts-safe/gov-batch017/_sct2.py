import re

# Looser search: Find any window after SCT mention that contains "Stock Awards" + "Total" + ceo name
def find_better_sct(txt, ceo_pat):
    starts = [m.start() for m in re.finditer(r'Summary Compensation Table', txt, re.I)]
    candidates = []
    for s in starts:
        end = min(len(txt), s + 80000)
        window = txt[s:end]
        # look for CEO row with numbers
        m = re.search(rf'{ceo_pat}.{{0,2000}}', window, re.I)
        if not m: continue
        seg = m.group(0)
        nums = re.findall(r'[\d]{1,3}(?:,\d{3}){2,5}', seg)
        if len(nums) >= 4:
            candidates.append((s, m.start(), seg[:1800]))
    return candidates

for t, pat in [('CPT', r'Campo|Jessett'), ('CRL', r'Girshick|Foster'), ('CRWD', r'Kurtz')]:
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    cands = find_better_sct(txt, pat)
    print(f'\n========== {t} -- {len(cands)} candidates ==========')
    for sct_s, off, seg in cands[:5]:
        seg = re.sub(r'\s+',' ', seg)
        print(f'SCT@{sct_s}+{off}: {seg[:1500]}')
        print('---')
