# -*- coding: utf-8 -*-
import json, os, re
E=json.load(open('scratchpad/gics-r/edgar.json'))
L=json.load(open('scratchpad/gics-r/labels.json'))
D=json.load(open('scratchpad/gics-r/defrev.json'))
F=json.load(open('scratchpad/gics-r/filed.json'))
HD='.batches-drafts-safe/kpis-haut'
TODAY='2026-09-14'

def fr(x, d=1):
    return ('%.*f' % (d, x)).replace('.', ',')

# ---------- SAP quarterly R&D (releases IR SAP, tableaux IFRS) ----------
SAP_RD={'Q1-2021':1171,'Q2-2021':1306,'Q3-2021':1300,'Q4-2021':1412,
'Q1-2022':1425,'Q2-2022':1545,'Q3-2022':1574,'Q4-2022':1621,
'Q1-2023':1573,'Q2-2023':1565,'Q3-2023':1515,'Q4-2023':1669,
'Q1-2024':1665,'Q2-2024':1605,'Q3-2024':1568,'Q4-2024':1675,
'Q1-2025':1673,'Q2-2025':1618,'Q3-2025':1644,'Q4-2025':1698,
'Q1-2026':1701,'Q2-2026':1844}
DSY_ANN={'FY2023':(1228.3,5951.4),'FY2024':(1286.2,6213.6),'FY2025':(1323.3,6235.8)}

def load(t):
    return json.load(open(f'{HD}/{t}.json'))
def save(t,d):
    json.dump(d,open(f'{HD}/{t}.json','w'),ensure_ascii=False,indent=1)

def build_rdpct(t):
    d=load(t)
    shorts={k.get('short') for k in d['kpis']}
    if 'RD_PCT_REV' in shorts: return None
    hist=[]
    if t=='SAP.DE':
        m={k['short']:k for k in d['kpis']}
        rev={h['q']:h['v'] for h in m['TOTAL_REV']['history']}
        for q,v in SAP_RD.items():
            if q in rev: hist.append({'q':q,'v':round(100*v/rev[q],1)})
        hist.sort(key=lambda h:(int(h['q'].split('-')[1]),int(h['q'][1])))
        freq='quarterly'; src={'document':"Communiqués trimestriels SAP (états de résultat IFRS, ligne Research and development et chiffre d'affaires total), publications du T3 2021 au T2 2026",'date':'2026-07-28'}
    elif t=='DSY.PA':
        for q,(rd,rv) in DSY_ANN.items():
            hist.append({'q':q,'v':round(100*rd/rv,1)})
        freq='annual'; src={'document':"Communiqués de résultats annuels Dassault Systèmes des exercices 2024 et 2025 (états de résultat IFRS consolidés : R&D 1 323,3 M€ pour un chiffre d'affaires de 6 235,8 M€ en 2025)",'date':'2026-02-11'}
    else:
        labs=L[t]['labels']
        for s in E[t]['series']:
            q=labs.get(s['end'])
            if q: hist.append({'q':q,'v':round(100*s['rd']/s['rev'],1)})
        freq='quarterly'; src={'document':f"Données XBRL des rapports {F[t]['form']} déposés à la SEC (postes Research and development expense et chiffre d'affaires), 22 trimestres jusqu'au dernier dépôt",'date':F[t]['filed']}
    if len(hist)<3: return None
    val=hist[-1]['v']
    prev=hist[-5]['v'] if len(hist)>=5 and freq=='quarterly' else (hist[-2]['v'] if len(hist)>=2 else None)
    yoy=None
    if prev is not None:
        diff=round(val-prev,1)
        yoy=('+' if diff>=0 else '-')+fr(abs(diff))+' pts'
    per=hist[-1]['q']
    sens='en hausse' if (prev is not None and val>prev) else ('en repli' if prev is not None else 'stable')
    sig=f"R&D à {fr(val)} % du chiffre d'affaires au {per}, {sens} sur un an : mesure de l'effort d'innovation rapporté aux ventes."
    if len(sig)>150: sig=f"R&D à {fr(val)} % du chiffre d'affaires au {per}, {sens} sur un an : effort d'innovation rapporté aux ventes."
    k={'short':'RD_PCT_REV','name_fr':"Dépenses de R&D en % du chiffre d'affaires",
       'name_en':'R&D Expense as % of Revenue','unit':'%','value':val,'yoy':yoy,
       'history':hist,'frequency':freq,'pv_score':7,
       'signal':sig,
       'description_fr':"Dépenses de recherche et développement rapportées au chiffre d'affaires total de la période, les deux postes étant repris tels quels du compte de résultat publié. Ce ratio mesure l'intensité de l'effort d'innovation d'un éditeur de logiciels et son évolution quand la croissance des ventes accélère ou ralentit.",
       '_source':src,'_referentiel_gics':'451030'}
    if freq=='annual':
        k['_gap_note']="Dassault Systèmes ne publie le détail de ses charges de R&D que dans ses comptes annuels repris au data-lake : la série est annuelle."
    d['kpis'].append(k); save(t,d)
    return (len(hist),freq,val)

def build_defrev(t):
    d=load(t)
    shorts={k.get('short') for k in d['kpis']}
    if 'DEFERRED_REV' in shorts: return None
    labs=L[t]['labels']
    hist=[]
    big = max(x['cur'] for x in D[t]['series'])>2e10
    sc=1e9 if big else 1e6
    unit='Mds $' if big else 'M $'
    for s in D[t]['series']:
        q=labs.get(s['end'])
        if not q: continue
        tot=s['cur']+(s['nc'] or 0)
        hist.append({'q':q,'v':round(tot/sc,(2 if big else 1))})
    if len(hist)<4: return None
    val=hist[-1]['v']; per=hist[-1]['q']
    prev=hist[-5]['v'] if len(hist)>=5 else None
    yoy=None
    if prev: 
        p=round(100*(val-prev)/prev,1); yoy=('+' if p>=0 else '')+fr(p)+'%'
    sig=f"Revenus différés de {fr(val, 2 if big else 1)} {unit} au {per} : facturations encaissées restant à reconnaître en chiffre d'affaires."
    k={'short':'DEFERRED_REV','name_fr':'Revenus différés','name_en':'Deferred Revenue',
       'unit':unit,'value':val,'yoy':yoy,'history':hist,'frequency':'quarterly','pv_score':7,
       'signal':sig[:150],
       'description_fr':"Passif de contrat inscrit au bilan (parts courante et non courante), c'est-à-dire les montants déjà facturés aux clients mais non encore reconnus en chiffre d'affaires. Chez un éditeur vendant par abonnement, il donne une lecture avancée des facturations et de la visibilité sur les revenus à venir.",
       '_source':{'document':f"Données XBRL des rapports {F[t]['form']} déposés à la SEC (bilan, passifs de contrat courants et non courants), 22 trimestres jusqu'au dernier dépôt",'date':F[t]['filed']},
       '_referentiel_gics':'451030'}
    d['kpis'].append(k); save(t,d)
    return (len(hist),val,unit)

RD_T=['ADBE','CDNS','CRM','CRWD','DDOG','FICO','FTNT','GEN','INTU','MSFT','MSTR','NOW','ORCL','PANW','PLTR','PTC','SHOP','TRMB','TYL','WDAY','SAP.DE','DSY.PA']
DR_T=['CRM','DDOG','INTU','MSFT','MSTR','NOW','PLTR','SHOP','SNPS']
res={'rd':{},'dr':{}}
for t in RD_T:
    r=build_rdpct(t); res['rd'][t]=r; print('RD',t,r)
for t in DR_T:
    r=build_defrev(t); res['dr'][t]=r; print('DR',t,r)
json.dump(res,open('scratchpad/gics-r/added.json','w'),ensure_ascii=False)
