import json
from datetime import date,timedelta
ciks=json.load(open('scratchpad/gics-r/cik.json'))
T=['CRM','DDOG','INTU','MSFT','MSTR','NOW','PLTR','SHOP','SNPS']
CUR=['ContractWithCustomerLiabilityCurrent','DeferredRevenueCurrent']
NON=['ContractWithCustomerLiabilityNoncurrent','DeferredRevenueNoncurrent']
res={}
for t in T:
    f=json.load(open(f'/tmp/edgarf/{t}.json'))
    def inst(names):
        out={}; used=None
        for n in names:
            node=f['facts']['us-gaap'].get(n)
            if not node: continue
            for unit,arr in node['units'].items():
                if not unit.startswith('USD'): continue
                for x in arr:
                    if x.get('start') or x.get('form') not in ('10-Q','10-K'): continue
                    out.setdefault(x['end'],x['val'])
            if out: used=n; break
        return out,used
    c,cn=inst(CUR); n2,nn=inst(NON)
    ds=sorted(c)[-22:]
    res[t]={'concept':cn,'nc':nn,'series':[{'end':d,'cur':c[d],'nc':n2.get(d)} for d in ds]}
    print(t,cn,nn,len(ds),ds[-1] if ds else '-', c[ds[-1]]/1e6 if ds else '')
json.dump(res,open('scratchpad/gics-r/defrev.json','w'))
