import json
from datetime import date, timedelta
e=json.load(open('scratchpad/gics-r/edgar.json'))
FICHE_RD={'ADBE':'RND','ADSK':'RD_EXP','CDNS':'rd_spend','CRM':'rd_expense','CRWD':'R&D','DDOG':'rd_expense',
'FICO':'rd_q','FTNT':'rd_expense','GEN':'rd_expense','INTU':'RD_EXPENSE_Q','MSFT':'rd_expense','NOW':'rd_expense',
'ORCL':'rd','PANW':'RD','PLTR':'RD_EXPENSE','PTC':'Dépenses de R&D','SHOP':'R&D','SNPS':'REVENUE','TRMB':'RD_EXPENSE',
'TYL':'R&D','WDAY':'RD_EXP','MSTR':'REVENUE','COHR':None,'JBL':None,'KEYS':None,'TDY':None,'ZBRA':None}
def norm(d):
    # 52/53-week calendars: snap to nearest month end
    if d.day<=7: d=d.replace(day=1)-timedelta(days=1)
    return d
def fye(t):
    f=json.load(open(f'/tmp/edgarf/{t}.json')); best=None
    for n,node in f['facts']['us-gaap'].items():
        for unit,arr in node['units'].items():
            for x in arr:
                if x.get('form')=='10-K' and x.get('fp')=='FY' and x.get('start'):
                    dd=date.fromisoformat(x['end'])
                    if 345<=(dd-date.fromisoformat(x['start'])).days<=385:
                        if best is None or dd>best: best=dd
    return norm(best)
out={}
for t in FICHE_RD:
    if t not in e or not e[t]['series']: continue
    am=fye(t).month
    pat='FY'; sh=FICHE_RD[t]
    if sh:
        d=json.load(open(f'.batches-drafts-safe/kpis-haut/{t}.json'))
        m={k['short']:k for k in d['kpis']}
        labs=[h['q'] for h in ((m.get(sh) or {}).get('history') or []) if isinstance(h.get('q'),str)]
        pat='FY' if any('FY' in l for l in labs) else ''
    labels={}
    for s in e[t]['series']:
        dt=norm(date.fromisoformat(s['end']))
        q=((dt.month-am-1)%12)//3+1
        fyv=dt.year if dt.month<=am else dt.year+1
        labels[s['end']]=f'Q{q}-{pat}{fyv}'
    out[t]={'fye_month':am,'pat':pat,'labels':labels}
    print(t,am,pat,list(labels.items())[-3:])
json.dump(out,open('scratchpad/gics-r/labels.json','w'),ensure_ascii=False)
