import re, json

# Strategy: find a window after "Summary Compensation Table" header (not the prose mention),
# then locate CEO row totals.
def find_sct_section(txt):
    # Find the table header pattern (multiple columns)
    # Looking for "Stock Awards" and "Total" near each other after the SCT mention
    starts = [m.start() for m in re.finditer(r'Summary Compensation Table', txt, re.I)]
    # The actual table is usually the last/penultimate occurrence
    best = None
    for s in starts:
        end = min(len(txt), s + 60000)
        window = txt[s:end]
        # check if the window contains "Salary" "Bonus" "Stock Awards" "Total" headers within ~3000 chars
        if re.search(r'Salary.{0,500}Bonus.{0,500}Stock Awards.{0,1500}Total', window, re.I):
            best = (s, window)
    return best

CEOS = {
    'CPB': r'Beekhuizen',
    'CPRT': r'Liaw',
    'CPT': r'(Campo)',  # Co-Chair, but Jessett is now CEO
    'CRH': r'Mintern',
    'CRL': r'Girshick',
    'CRM': r'Benioff',
    'CRWD': r'Kurtz',
    'CRWV': r'Intrator',
    'CSCO': r'Robbins',
}

for t, pat in CEOS.items():
    txt = open(f'/tmp/gov-batch017/raw/{t}.txt').read()
    sct = find_sct_section(txt)
    print(f'\n========== {t} ==========')
    if not sct:
        print('No SCT section found')
        continue
    s, window = sct
    print(f'SCT starts at @{s}')
    # Find CEO row in window
    m = re.search(pat, window)
    if m:
        # take 2000 chars around CEO row
        start = max(0, m.start()-100)
        end = min(len(window), m.end()+2500)
        snippet = window[start:end]
        # Compress whitespace and print
        snippet = re.sub(r'\s+', ' ', snippet)
        print(snippet[:2200])
