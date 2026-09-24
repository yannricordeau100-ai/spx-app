import json,os,subprocess,sys
ciks=json.load(open('scratchpad/gics-r/cik.json'))
RD=['ResearchAndDevelopmentExpense','ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost']
REV=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','RevenueFromContractWithCustomerIncludingAssessedTax','SalesRevenueNet']
def quarters(facts,names):
    for n in names:
        for ns in ('us-gaap','ifrs-full'):
            node=facts.get('facts',{}).get(ns,{}).get(n)
            if not node: continue
            for unit,arr in node['units'].items():
                if not unit.startswith('USD') and unit!='EUR' and unit!='CAD': continue
                recs={}
                for x in arr:
                    if not x.get('start'): continue
                    recs[(x['start'],x['end'])]=x['val']
                if recs: return recs,n
    return None,None
def toQ(recs):
    # separate ~3mo periods
    from datetime import date
    out={}
    cum={}
    for (s,e),v in recs.items():
        ds=date.fromisoformat(s); de=date.fromisoformat(e); d=(de-ds).days
        if 80<=d<=100: out[e]=v
        else: cum[(s,e)]=(d,v)
    # derive missing quarters from cumulative (Q4 = FY - 9mo)
    for (s,e),(d,v) in sorted(cum.items()):
        if not (350<=d<=380): continue
        # find 9-month with same start
        nine=[(ss,ee,vv) for (ss,ee),(dd,vv) in cum.items() if ss==s and 260<=dd<=290]
        if nine and e not in out:
            out[e]=round(v-nine[0][2],6)
    return out
res={}
for t,c in ciks.items():
    p=f'/tmp/edgarf/{t}.json'
    if not os.path.exists(p):
        subprocess.run(['curl','-s','-H','User-Agent: Mettrik yann@mettrik.ai',
            f'https://data.sec.gov/api/xbrl/companyfacts/CIK{c}.json','-o',p],check=True)
    try: f=json.load(open(p))
    except Exception as ex:
        print(t,'ERR',ex); continue
    rdr,rn=quarters(f,RD); rvr,vn=quarters(f,REV)
    rd=toQ(rdr) if rdr else {}
    rv=toQ(rvr) if rvr else {}
    common=sorted(set(rd)&set(rv))[-22:]
    res[t]={'rd_concept':rn,'rev_concept':vn,'series':[{'end':e,'rd':rd[e],'rev':rv[e]} for e in common]}
    print(t,rn,vn,len(common), common[-1] if common else '-')
json.dump(res,open('scratchpad/gics-r/edgar.json','w'),indent=0)
