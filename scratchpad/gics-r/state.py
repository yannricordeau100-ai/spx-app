# -*- coding: utf-8 -*-
import json
P='src/data/kpi-industries-etat.json'
st=json.load(open(P))
TODAY='2026-09-14'
T1="ADBE ADSK CDNS CRM CRWD DDOG DSY.PA FICO FTNT GEN INTU MSFT MSTR NOW ORCL PANW PLTR PTC SAP.DE SHOP SNPS TRMB TYL WDAY".split()
T2="APH CDW COHR FLEX GLW JBL KEYS ROP TDY TEL ZBRA".split()

ARR_OK=['ADBE','ADSK','CRM','CRWD','DDOG','DSY.PA','FICO','FTNT','PANW','PTC','SHOP','TRMB','TYL','WDAY']
ARR_NO={'CDNS':"carnet RPO, pas d'ARR",'GEN':"commandes publiées, pas d'ARR",'INTU':"aucun ARR publié",
 'MSFT':"aucun ARR publié",'MSTR':"aucun ARR publié",'NOW':"pilotage par le cRPO",'ORCL':"aucun ARR publié",
 'PLTR':"aucun ARR publié",'SAP.DE':"carnet cloud, pas d'ARR",'SNPS':"aucun ARR publié"}

M={}
M["Revenu récurrent annuel"]=(ARR_OK,ARR_NO)
M["Croissance de l’ARR"]=(ARR_OK,ARR_NO)
M["Nouvel ARR net"]=(['CRWD'],{t:("aucun ARR publié" if t in ARR_NO else "ARR net trimestriel non publié") for t in T1 if t!='CRWD'})
NRR=['ADSK','CRWD','DDOG','FICO','PANW','PLTR','TRMB']
M["Taux de rétention nette des revenus"]=(NRR,{t:"rétention nette non publiée" for t in T1 if t not in NRR})
M["Taux de rétention brute"]=([],{t:"rétention brute non publiée" for t in T1})
CH=['CRM','GEN','PTC','TYL']
M["Taux de churn clients"]=(CH,{t:"taux d'attrition non publié" for t in T1 if t not in CH})
CC=['CRWD','DDOG','DSY.PA','GEN','INTU','MSFT','PANW','PLTR','SAP.DE','TYL','WDAY']
CCNO={'ADBE':"utilisateurs actifs, pas clients",'ADSK':"abonnements comptés, pas clients",'CDNS':"nombre de clients non publié",
 'CRM':"nombre de clients non publié",'FICO':"nombre de clients non publié",'FTNT':"nombre de clients non publié",
 'MSTR':"nombre de clients non publié",'NOW':"seuls les grands comptes chiffrés",'ORCL':"nombre de clients non publié",
 'PTC':"nombre de clients non publié",'SHOP':"nombre de marchands non publié",'SNPS':"nombre de clients non publié",
 'TRMB':"nombre de clients non publié"}
M["Nombre de clients"]=(CC,CCNO)
LC=['DDOG','NOW']
M["Nombre de grands clients"]=(LC,{t:"aucun seuil de grands comptes" for t in T1 if t not in LC})
RPO_NO={'GEN':"aucun RPO publié",'INTU':"aucun RPO publié",'SHOP':"aucun RPO publié"}
M["Obligations de performance restantes"]=([t for t in T1 if t not in RPO_NO],RPO_NO)
CRPO=['ADBE','ADSK','CDNS','CRM','DSY.PA','MSTR','NOW','ORCL','PLTR','PTC','SAP.DE','SNPS','TRMB','TYL','WDAY']
M["Obligations de performance restantes à court terme"]=(CRPO,{t:("aucun RPO publié" if t in RPO_NO else "part à douze mois non publiée") for t in T1 if t not in CRPO})
BK=['DDOG','FICO','GEN','PANW','TRMB','TYL']
M["Bookings"]=(BK,{t:"prises de commandes non publiées" for t in T1 if t not in BK})
BI=['ADSK','DDOG','FTNT','INTU','MSTR','PANW']
M["Facturations"]=(BI,{t:"facturations non publiées" for t in T1 if t not in BI})
DR_NO={'DSY.PA':"publié au bilan annuel seulement"}
M["Revenus différés"]=([t for t in T1 if t not in DR_NO],DR_NO)
ACV=['CRM','FICO','NOW','PLTR','TRMB','TYL']
M["Valeur moyenne des contrats"]=(ACV,{t:"valeur des contrats non publiée" for t in T1 if t not in ACV})
SE=['ADBE','ADSK','DSY.PA','MSFT','PANW','SAP.DE','WDAY']
M["Nombre de sièges/licences"]=(SE,{t:"sièges et licences non comptés" for t in T1 if t not in SE})
US=['FICO','INTU','NOW','PLTR','SHOP','TRMB','TYL','WDAY']
M["Volume d’usage/consommation"]=(US,{t:"aucun volume d'usage publié" for t in T1 if t not in US})
M["Taux de renouvellement"]=(['NOW'],{t:"taux de renouvellement non publié" for t in T1 if t!='NOW'})
EX=['CRWD','GEN','TRMB']
M["Taux d’expansion"]=(EX,{t:"taux d'expansion non publié" for t in T1 if t not in EX})
M["Dépenses de R&D en % du chiffre d'affaires"]=(T1,{})

M2={}
O=['APH','KEYS','TEL']
M2["Commandes"]=(O,{t:"prises de commandes non publiées" for t in T2 if t not in O})
B=['APH','KEYS','ROP','TDY','TEL','ZBRA']
M2["Carnet de commandes"]=(B,{t:"aucun carnet de commandes publié" for t in T2 if t not in B})
BT=['APH','COHR','KEYS','TDY','TEL']
M2["Ratio commandes/facturation"]=(BT,{t:"aucune commande, ratio impossible" for t in T2 if t not in BT})
M2["Unités expédiées"]=([],{t:"volumes unitaires jamais publiés" for t in T2})
M2["Prix moyen de vente"]=([],{t:"prix moyen jamais publié" for t in T2})
M2["Taux d’utilisation des capacités"]=(['JBL'],{t:"taux d'utilisation non chiffré" for t in T2 if t!='JBL'})
M2["Base installée"]=([],{t:"base installée jamais chiffrée" for t in T2})
SV=['CDW','KEYS','ROP','ZBRA']
M2["Part des services/après-vente"]=(SV,{t:"services non isolés du chiffre" for t in T2 if t not in SV})

ADDED={'451030':{"Dépenses de R&D en % du chiffre d'affaires":['ADBE','CDNS','CRM','CRWD','DDOG','FICO','FTNT','GEN','INTU','MSFT','MSTR','NOW','ORCL','PANW','PLTR','PTC','SHOP','TRMB','TYL','WDAY','SAP.DE','DSY.PA'],
 "Revenus différés":['CRM','DDOG','INTU','MSFT','MSTR','NOW','PLTR','SHOP','SNPS','SAP.DE']}}

for ind in st['industries']:
    if ind['code'] not in ('451030','452030'): continue
    MM = M if ind['code']=='451030' else M2
    for k in ind['kpis']:
        key=k['fr']
        if key not in MM:
            print('!! KPI non mappé', ind['code'], key); continue
        ok,no=MM[key]
        k['stes_avec']=sorted(ok)
        if no: k['stes_sans']=dict(sorted(no.items()))
        else: k.pop('stes_sans',None)
        if key in ADDED.get(ind['code'],{}):
            k['complete_le']=TODAY
        else:
            k.pop('complete_le',None)
    print(ind['code'],'ok')

st['deja_presents']=sum(1 for i in st['industries'] for k in i['kpis'] if k.get('stes_avec'))
st['maj']=TODAY
json.dump(st,open(P,'w'),ensure_ascii=False,indent=2)
print('deja_presents',st['deja_presents'],'total',st['total_kpi'])
