import json,datetime
def load(tag):
    d=json.load(open(f'sec-concepts/{tag}.json'))
    # pick USD or USD/shares unit
    for k in ['USD','USD/shares']:
        if k in d['units']: return d['units'][k]
    return list(d['units'].values())[0]
def months(s,e):
    a=datetime.date.fromisoformat(s); b=datetime.date.fromisoformat(e)
    return round((b-a).days/30.4)
def discrete_quarters(tag):
    arr=load(tag)
    arr=[e for e in arr if e['form'] in ('10-K','10-Q')]
    # build map: (fy, end) with best duration
    # collect YTD per fiscal year: dict fy-> {end: val} for cumulative from Jan1
    # Also collect discrete 3-month facts
    disc={}  # end_date -> val (3 month)
    ytd={}   # (year,end)-> val where start = Jan1
    for e in arr:
        s,en,v=e['start'],e['end'],e['val']
        m=months(s,en)
        yr=en[:4]
        if m==3:
            disc[en]=v
        if s[5:]=='01-01':
            ytd[(yr,en)]=v
    # derive discrete from ytd where not present
    # order ytd by year
    result={}  # 'YYYY-Qn' -> (val, derived?)
    # quarter end months
    qmap={'03-31':1,'06-30':2,'09-30':3,'12-31':4}
    for (yr,en),v in ytd.items():
        pass
    # For each year build cumulative points
    from collections import defaultdict
    byyear=defaultdict(dict)
    for (yr,en),v in ytd.items():
        mm=en[5:]
        if mm in qmap: byyear[yr][qmap[mm]]=v
    for yr,qs in byyear.items():
        prev=0
        for qn in [1,2,3,4]:
            end=f"{yr}-{['','03-31','06-30','09-30','12-31'][qn]}"
            if qn in qs:
                dv=qs[qn]-prev
                result[f"{yr}-Q{qn}"]=(round(dv/1e6,1),'derived' if qn>1 else 'ytd=q')
                prev=qs[qn]
            else:
                # try discrete
                if end in disc:
                    result[f"{yr}-Q{qn}"]=(round(disc[end]/1e6,1),'disc')
    # overlay discrete facts directly (more reliable)
    for en,v in disc.items():
        mm=en[5:]; yr=en[:4]
        if mm in qmap:
            result[f"{yr}-Q{qmap[mm]}"]=(round(v/1e6,1),'disc')
    return dict(sorted(result.items()))
for tag in ['RevenueFromContractWithCustomerExcludingAssessedTax','NetCashProvidedByUsedInOperatingActivities','PaymentsToAcquirePropertyPlantAndEquipment','PaymentsOfDividendsCommonStock','PaymentsForRepurchaseOfCommonStock']:
    print('####',tag)
    r=discrete_quarters(tag)
    for k,v in r.items():
        if k>='2016': print(k,v)
