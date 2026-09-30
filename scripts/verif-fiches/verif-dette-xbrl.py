#!/usr/bin/env python3
"""Controle de chaque serie « dette_annuelle » (kpi-annuel-fiche) contre le XBRL SEC (companyfacts).
Dette totale = LongTermDebt (ou LongTermDebtNoncurrent + LongTermDebtCurrent) + ShortTermBorrowings/CommercialPaper
selon disponibilite, par exercice (fp=FY). Ecart > 15 % sur un des 3 derniers exercices => signale.
Sortie : docs/cahier/_lots/verif-30sept/detecteurs/dette-xbrl.json"""
import json, glob, os, time, urllib.request, ssl, certifi
from collections import Counter
os.chdir('/Users/yann/spx-app')
S = '/Users/yann/spx-app/docs/cahier/_lots/verif-30sept'
os.makedirs(S + '/detecteurs', exist_ok=True)
ctx = ssl.create_default_context(cafile=certifi.where())
UA = 'Mettrik research yannricordeau100@gmail.com'
ciks = {}
for t, v in json.load(open('src/data/fiscal-audit.json')).items():
    if v.get('cik'): ciks[t] = str(v['cik']).zfill(10)
try:
    ct = json.load(urllib.request.urlopen(urllib.request.Request('https://www.sec.gov/files/company_tickers.json', headers={'User-Agent': UA}), context=ctx))
    for x in ct.values(): ciks.setdefault(x['ticker'].replace('.', '-'), str(x['cik_str']).zfill(10))
except Exception as e: print('company_tickers', e)
TAGS_LT = ['LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations', 'DebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities']
TAGS_NC = ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligationsNoncurrent']
TAGS_CUR = ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'DebtCurrent']
TAGS_ST = ['ShortTermBorrowings', 'CommercialPaper']
def fy_vals(facts, tag):
    out = {}
    for u in facts.get('us-gaap', {}).get(tag, {}).get('units', {}).get('USD', []):
        if u.get('fp') == 'FY' and u.get('form') in ('10-K', '10-K/A', '20-F') and u.get('frame', '').startswith('CY') and 'Q' not in u.get('frame', ''):
            out[int(u['frame'][2:6])] = u['val']
    if not out:
        for u in facts.get('us-gaap', {}).get(tag, {}).get('units', {}).get('USD', []):
            if u.get('fp') == 'FY' and u.get('form') in ('10-K', '10-K/A'): out[int(u['fy'])] = u['val']
    return out
res = {}
files = sorted(glob.glob('src/data/kpi-annuel-fiche/*.json'))
for i, f in enumerate(files):
    t = os.path.basename(f)[:-5]
    d = json.load(open(f))
    k = next((x for x in d.get('kpis', []) if x.get('short') == 'dette_annuelle'), None)
    if not k: continue
    cik = ciks.get(t) or ciks.get(t.replace('.', '-'))
    if not cik: res[t] = {'statut': 'sans_cik'}; continue
    try:
        facts = json.load(urllib.request.urlopen(urllib.request.Request(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json', headers={'User-Agent': UA}), context=ctx)).get('facts', {})
    except Exception as e:
        res[t] = {'statut': 'erreur', 'detail': str(e)[:80]}; time.sleep(0.2); continue
    time.sleep(0.12)
    lt = {}
    for tag in TAGS_LT:
        lt = fy_vals(facts, tag)
        if lt: break
    if not lt:
        nc = {}
        for tag in TAGS_NC:
            nc = fy_vals(facts, tag)
            if nc: break
        cur = {}
        for tag in TAGS_CUR:
            cur = fy_vals(facts, tag)
            if cur: break
        lt = {y: nc.get(y, 0) + cur.get(y, 0) for y in set(nc) | set(cur)} if nc else {}
    st = {}
    for tag in TAGS_ST:
        for y, x in fy_vals(facts, tag).items(): st[y] = st.get(y, 0) + x
    xbrl = {y: (lt.get(y, 0) + st.get(y, 0)) / 1e9 for y in lt}
    per = [str(x) for x in (k.get('history_periods') or [])]; vals = k.get('history') or []
    comp = []; ecart_max = 0
    for p, v in list(zip(per, vals))[-3:]:
        y = int(p[:4]) if p[:4].isdigit() else None
        if y is None or y not in xbrl or not isinstance(v, (int, float)): continue
        x = xbrl[y]
        e = abs(v - x) / max(abs(x), 0.05)
        ecart_max = max(ecart_max, e); comp.append((y, round(v, 3), round(x, 3), round(e * 100, 1)))
    res[t] = {'statut': 'ok' if comp and ecart_max <= 0.15 else ('ecart' if comp else 'sans_xbrl'), 'ecart_max_pct': round(ecart_max * 100, 1), 'comparaison': comp}
    if i % 50 == 0: print(i, t, res[t]['statut'], flush=True)
json.dump(res, open(S + '/detecteurs/dette-xbrl.json', 'w'), indent=1)
print(Counter(v['statut'] for v in res.values()))
