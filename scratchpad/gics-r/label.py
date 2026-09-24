import json,re
e=json.load(open('scratchpad/gics-r/edgar.json'))
RDK={'ADBE':('RND',1e9),'ADSK':('RD_EXP',1e6),'CDNS':('rd_spend',1e6),'CRM':('rd_expense',1e9),
'CRWD':('R&D',1e6),'DDOG':('rd_expense',1e6),'FICO':('rd_q',1e6),'FTNT':('rd_expense',1e6),
'GEN':('rd_expense',1e6),'INTU':('RD_EXPENSE_Q',1e6),'MSFT':('rd_expense',1e9),'NOW':('rd_expense',1e6),
'ORCL':('rd',1e9),'PANW':('RD',1e6),'PLTR':('RD_EXPENSE',1e6),'PTC':('Dépenses de R&D',1e6),
'SHOP':('R&D',1e6),'SNPS':(None,1e6),'TRMB':('RD_EXPENSE',1e6),'TYL':('R&D',1e6),'WDAY':('RD_EXP',1e6),
'MSTR':(None,1e6),'COHR':(None,1e6),'JBL':(None,1e6),'KEYS':(None,1e6),'TDY':(None,1e6),'ZBRA':(None,1e6)}
def nextlab(lab):
    m=re.match(r'Q(\d)-(FY)?(\d{4})$',lab)
    if not m: return None
    q=int(m.group(1)); fy=m.group(2) or ''; y=int(m.group(3))
    q+=1
    if q==5: q=1; y+=1
    return f'Q{q}-{fy}{y}'
out={}
for t,(short,sc) in RDK.items():
    if t not in e or not e[t]['series']: continue
    labels={}
    if short:
        d=json.load(open(f'.batches-drafts-safe/kpis-haut/{t}.json'))
        m={k['short']:k for k in d['kpis']}
        hist=m.get(short,{}).get('history') or []
        for s in e[t]['series']:
            v=s['rd']/sc
            for h in hist:
                if h.get('v') and abs(h['v']-v)<=max(0.006*abs(v),0.0006):
                    labels[s['end']]=h['q']; break
    out[t]={'labels':labels,'n':len(labels),'tot':len(e[t]['series'])}
    print(t,len(labels),'/',len(e[t]['series']), list(labels.items())[-2:])
json.dump(out,open('scratchpad/gics-r/labels.json','w'),ensure_ascii=False)
