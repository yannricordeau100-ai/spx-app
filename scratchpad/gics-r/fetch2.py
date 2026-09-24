import json
from datetime import date
ciks=json.load(open('scratchpad/gics-r/cik.json'))
RD=['ResearchAndDevelopmentExpense','ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost','ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost']
REV=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','RevenueFromContractWithCustomerIncludingAssessedTax','SalesRevenueNet']
def collect(f,names):
    recs={}
    used=[]
    for n in names:
        node=f['facts'].get('us-gaap',{}).get(n)
        if not node: continue
        for unit,arr in node['units'].items():
            if not unit.startswith('USD'): continue
            for x in arr:
                if not x.get('start') or x.get('form') not in ('10-Q','10-K'): continue
                recs.setdefault((x['start'],x['end']),x['val'])
        used.append(n)
    return recs,'+'.join(used)
def toQ(recs):
    out={};cum={}
    for (s,e),v in recs.items():
        d=(date.fromisoformat(e)-date.fromisoformat(s)).days
        if 80<=d<=100: out[e]=v
        else: cum[(s,e)]=(d,v)
    for (s,e),(d,v) in sorted(cum.items()):
        if not (345<=d<=385) or e in out: continue
        nine=[vv for (ss,ee),(dd,vv) in cum.items() if ss==s and 255<=dd<=290]
        if nine: out[e]=round(v-nine[0],6)
    return out
res={}
for t,c in ciks.items():
    f=json.load(open(f'/tmp/edgarf/{t}.json'))
    rdr,rn=collect(f,RD); rvr,vn=collect(f,REV)
    rd=toQ(rdr); rv=toQ(rvr)
    common=sorted(set(rd)&set(rv))[-22:]
    res[t]={'rd_concept':rn,'rev_concept':vn,'series':[{'end':e,'rd':rd[e],'rev':rv[e],'pct':round(100*rd[e]/rv[e],2)} for e in common]}
    print(t,len(common),common[-1] if common else '-', res[t]['series'][-1]['pct'] if common else '')
json.dump(res,open('scratchpad/gics-r/edgar.json','w'),indent=0)
