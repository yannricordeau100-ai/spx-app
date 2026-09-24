import json,re
from datetime import date
e=json.load(open('scratchpad/gics-r/edgar.json'))
ciks=json.load(open('scratchpad/gics-r/cik.json'))
FICHE_RD={'ADBE':'RND','ADSK':'RD_EXP','CDNS':'rd_spend','CRM':'rd_expense','CRWD':'R&D','DDOG':'rd_expense',
'FICO':'rd_q','FTNT':'rd_expense','GEN':'rd_expense','INTU':'RD_EXPENSE_Q','MSFT':'rd_expense','NOW':'rd_expense',
'ORCL':'rd','PANW':'RD','PLTR':'RD_EXPENSE','PTC':'Dépenses de R&D','SHOP':'R&D','SNPS':'REVENUE','TRMB':'RD_EXPENSE',
'TYL':'R&D','WDAY':'RD_EXP','MSTR':'REVENUE','COHR':None,'JBL':None,'KEYS':None,'TDY':None,'ZBRA':None}
def fye(t):
    f=json.load(open(f'/tmp/edgarf/{t}.json'))
    # find an annual duration fact
    best=None
    for ns in ('us-gaap',):
        for n,node in f['facts'][ns].items():
            for unit,arr in node['units'].items():
                for x in arr:
                    if x.get('form')=='10-K' and x.get('fp')=='FY' and x.get('start'):
                        d=(date.fromisoformat(x['end'])-date.fromisoformat(x['start'])).days
                        if 345<=d<=385:
                            dd=date.fromisoformat(x['end'])
                            if best is None or dd>best: best=dd
            if best: break
        if best: break
    return best
out={}
for t in FICHE_RD:
    if t not in e or not e[t]['series']: continue
    fy_end=fye(t); fm=fy_end.month
    pat='FY'
    sh=FICHE_RD[t]
    if sh:
        d=json.load(open(f'.batches-drafts-safe/kpis-haut/{t}.json'))
        m={k['short']:k for k in d['kpis']}
        hs=(m.get(sh) or {}).get('history') or []
        labs=[h['q'] for h in hs if isinstance(h.get('q'),str)]
        pat='FY' if any('FY' in l for l in labs) else ''
    labels={}
    for s in e[t]['series']:
        dt=date.fromisoformat(s['end'])
        # months since fiscal year start
        delta=(dt.year*12+dt.month)-(fy_end.year*12+fm)
        q=((delta-1)%12)//3+1
        # fiscal year
        fyv=dt.year + (1 if (dt.month>fm or (dt.month==fm and dt.day>fy_end.day+20)) else 0)
        if fm==12: fyv=dt.year
        labels[s['end']]=f'Q{q}-{pat}{fyv}'
    out[t]={'fye':str(fy_end),'pat':pat,'labels':labels}
    print(t,fy_end,pat,list(labels.items())[-3:])
json.dump(out,open('scratchpad/gics-r/labels.json','w'),ensure_ascii=False)
