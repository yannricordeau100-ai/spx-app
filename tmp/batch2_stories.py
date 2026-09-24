"""Batch 2 story categorization. Adds story_category (and is_short_history) to existing KPI entries.
Zero invention: only reuses existing KPI records verbatim; changes classification.
Reports {ticker: {before_cat, after_cat, added_shorts}}
"""
import json, os

# Picks: ticker -> list of (short_substring_lower, category, signal_optional)
PICKS = {
 "NOC": [
   ("adjusted free cash flow", "Capital", "Cash-flow libre ajusté 3,3 Md$ soutient les rachats et dividendes."),
   ("iraD invested", "Innovation", "2,1 Md$ investis en IRAD sur 2 ans : effort R&D interne."),
   ("total employees", "Capacité", "95 000 employés : base humaine soutenant les programmes."),
   ("aeronautics systems", "Segments", "Segment Aeronautics Systems 13,0 Md$."),
   ("space systems", "Segments", "Segment Space Systems 10,8 Md$."),
 ],
 "NOW": [
   ("non-gaap free cash flow margin", "Capital", "Marge FCF non-GAAP 35% (année pleine)."),
   ("accelerated share repurchase", "Capital", "Rachat accéléré de 2,0 Md USD."),
   ("issued patents", "Innovation", "2 000 brevets émis : couche IP défensive."),
   ("full-time employees", "Capacité", "29 187 employés à plein temps."),
   ("subscription", "Segments", "Segment abonnements 12,9 Md$."),
 ],
 "NRG": [
   ("vivint smart home customer count", "Adoption", "2,37 M clients Vivint Smart Home."),
   ("power generation capacity", "Capacité", "25 GW de capacité de production."),
   ("home", "Segments", "Segment Home 7,2 Md$."),
   ("business", "Segments", "Segment Business 3,7 Md$."),
   ("ls power natural gas fleet acquired", "Capacité", "13 GW de flotte gaz acquise via LS Power."),
 ],
 "NSC": [
   ("annual free cash flow", "Capital", "Cash-flow libre annuel 2,2 Md USD."),
   ("2026 capital expenditure budget", "Capital", "Capex 2026 prévu à 1,9 Md USD."),
   ("productivity (gtms vs headcount)", "Capacité", "+7% de productivité effectifs vs GTMs."),
   ("gross ton-miles yoy", "Capacité", "+3% de GTMs YoY : montée en volume."),
 ],
 "NTAP": [
   ("cloud services dollar-based net retention", "Adoption", "Dollar-based net retention 207% : rétention exceptionnelle."),
   ("all-flash array annualized net revenue run rate", "Segments", "ARR All-Flash 4,2 Md$."),
   ("public cloud annualized revenue run rate", "Segments", "ARR Public Cloud 630 M$."),
   ("all-flash penetration of installed base", "Adoption", "48% de la base installée en All-Flash."),
 ],
 "NTRS": [
   ("new share repurchase program", "Capital", "Programme de rachat 2,5 Md$ autorisé."),
   ("assets under custody/administration", "Capacité", "AUC/A 18,55 T$ : plateforme mondiale."),
   ("assets under management", "Capacité", "AUM 1,78 T$."),
   ("investment management", "Segments", "Segment Investment Management 0,64 Md$."),
   ("custody and fund administration", "Segments", "Segment Custody & Fund Admin 1,90 Md$."),
 ],
 "NUE": [
   ("capital deployed since 2020", "Capital", "20 Md USD de capex + M&A depuis 2020."),
   ("capital returned to shareholders", "Capital", "14 Md USD retournés aux actionnaires depuis 2020."),
   ("steel mill utilization rate", "Capacité", "Taux d'utilisation aciéries 83%."),
   ("west virginia sheet mill annual production capacity", "Capacité", "3 M tonnes/an de capacité WV."),
   ("djj ferrous scrap shredding capacity", "Capacité", "6,8 M tonnes/an de capacité DJJ."),
 ],
 "NWS": [
   ("wall street journal digital-only subscriptions", "Adoption", "4,3 M abonnés WSJ digital."),
   ("realtor.com average monthly unique users", "Adoption", "66 M utilisateurs uniques/mois Realtor.com."),
   ("consumer", "Segments", "Segment Consumer 2,05 Md$."),
   ("real estate", "Segments", "Segment Real Estate 1,41 Md$."),
   ("2025 stock repurchase program authorization", "Capital", "Autorisation de rachat 1 Md$."),
 ],
 "NWSA": [
   ("wsj digital-only subscriptions", "Adoption", "4,3 M abonnés WSJ digital."),
   ("realtor.com average monthly unique users", "Adoption", "66 M utilisateurs uniques/mois Realtor.com."),
   ("consumer", "Segments", "Segment Consumer 2,05 Md$."),
   ("real estate", "Segments", "Segment Real Estate 1,41 Md$."),
   ("new $1 billion stock repurchase program", "Capital", "Nouveau programme de rachat 1 Md$."),
 ],
 "NXPI": [
   ("non-gaap free cash flow", "Capital", "FCF non-GAAP 714 M$."),
   ("10-year capital returned to shareholders", "Capital", "23 Md$ retournés aux actionnaires (10 ans)."),
   ("automotive revenue", "Segments", "Segment Automotive 1,78 Md$."),
   ("industrial & iot revenue", "Segments", "Segment Industrial & IoT 628 M$."),
   ("vsmc foundry capacity commitment", "Capacité", "Engagement capacité foundry VSMC 1,2 Md$."),
 ],
 "O": [
   ("common stock repurchase authorization", "Capital", "Autorisation rachat 2,0 Md$."),
   ("affo payout ratio", "Capital", "Payout AFFO 71,7%."),
   ("properties owned or held interests in", "Capacité", "15 571 propriétés détenues."),
   ("number of clients/tenants", "Adoption", "1 786 locataires actifs."),
   ("retail", "Segments", "Segment Retail 3 515 M$."),
 ],
 "OKE": [
   ("share repurchase program authorized", "Capital", "Programme rachat 2,0 Md$ autorisé."),
   ("ngl raw feed throughput", "Capacité", "1 493 MBbl/j de débit NGL brut."),
   ("natural gas processed", "Capacité", "5 490 MMcf/j de gaz traité."),
   ("liquids commodity sales", "Segments", "Segment Liquids commodity 4,37 Md$."),
   ("data center projects under discussion", "Adoption", "30 projets data center en discussion."),
 ],
 "OMC": [
   ("share repurchase authorization", "Capital", "Autorisation rachat 5,0 Mrd$."),
   ("ipg debt exchange completed", "Capital", "Échange dette IPG 2,76 Mrd$ finalisé."),
   ("advertising & media organic growth", "Segments", "Segment Advertising & Media +9,1% organique."),
   ("precision marketing organic growth", "Segments", "Segment Precision Marketing +0,8% organique."),
   ("targeted run-rate cost synergies", "Capacité", "Synergies visées 1,5 Mrd$ en run-rate."),
 ],
 "ON": [
   ("cumulative share repurchases since feb 2023", "Capital", "Rachats cumulés 2,1 Md$ depuis fév. 2023."),
   ("fy2025 share repurchases", "Capital", "Rachats FY2025 1 375 M$."),
   ("manufacturing utilization rate", "Capacité", "Utilisation manufacture 74%."),
   ("psg", "Segments", "Segment PSG 0,83 Md$."),
   ("asg", "Segments", "Segment ASG 0,62 Md$."),
 ],
 "ORCL": [
   ("at-the-market equity offering program", "Capital", "Programme ATM equity 20 G$."),
   ("senior notes issued in fiscal 2026", "Capital", "Notes seniors émises FY26 : 43 G$."),
   ("data center capacity delivered", "Capacité", "1,2 GW de capacité datacenter livrée."),
   ("power and data capacity secured", "Capacité", "10 GW de capacité sécurisée."),
   ("cloud services and license support", "Segments", "Segment Cloud services & license support 44,0 Md$."),
 ],
 "ORLY": [
   ("cumulative share repurchases since program inception", "Capital", "Rachats cumulés 27,8 Md$ depuis lancement."),
   ("quarterly share repurchases", "Capital", "Rachats trimestriels 923 M$."),
   ("total store count", "Capacité", "5 811 magasins."),
   ("total team members", "Capacité", "93 000 collaborateurs."),
   ("sales to do-it-yourself customers", "Segments", "Segment DIY 8,77 Md$."),
 ],
 "OXY": [
   ("debt repaid since crownrock closing", "Capital", "7,5 Md$ de dette remboursée depuis clôture CrownRock."),
   ("principal debt", "Capital", "Dette principale 13,3 Md$."),
   ("total company production", "Capacité", "1 426 Mboed de production totale."),
   ("permian production", "Capacité", "787 Mboed produits au Permian."),
   ("total oil and gas resources", "Capacité", "16,5 Md BOE de ressources totales."),
 ],
 "PANW": [
   ("cyberark acquisition equity value", "Capital", "Acquisition CyberArk 25 Md$ en equity value."),
   ("chronosphere acquisition", "Capital", "Acquisition Chronosphere 3,0 Md$."),
   ("total customers", "Adoption", "70 000 clients."),
   ("prisma airs customers", "Adoption", "300 clients Prisma AIRS."),
   ("subscription and support", "Segments", "Segment Subscription & Support 7,42 Md$."),
 ],
 "PAYC": [
   ("total debt", "Capital", "Dette totale 90 M€."),
   ("cash & equivalents", "Capital", "Trésorerie 370 M€."),
   ("total revenue", "Marché", "Chiffre d'affaires 2,05 Md€."),
   ("operating income", "Segments", "Résultat opérationnel 570 M€."),
 ],
 "PAYX": [
   ("new $1.0b share repurchase authorization", "Capital", "Nouvelle autorisation de rachat 1,0 Md$."),
   ("corporate bonds issued to finance paycor", "Capital", "Obligations corporate 4,2 Md$ pour financer Paycor."),
   ("total payroll clients served", "Adoption", "800 000 clients paie servis."),
   ("total worksite employees paid on platform", "Adoption", "2 M salariés payés sur plateforme."),
   ("management solutions", "Segments", "Segment Management Solutions 4,07 Md$."),
 ],
 "PCAR": [
   ("pfs medium-term notes issued during 2025", "Capital", "Notes moyen terme émises 3,12 G$ en 2025."),
   ("combined capital and r&d investments over the past deca", "Innovation", "9,2 G USD de capex + R&D cumulés (10 ans)."),
   ("paccar financial services portfolio of trucks and trail", "Capacité", "Portefeuille PFS 221 000 véhicules."),
   ("paccar parts global parts distribution centers", "Capacité", "21 centres de distribution parts."),
   ("kenworth+peterbilt us/canada class 8 retail market shar", "Segments", "Part de marché Class 8 US/Canada 30%."),
 ],
 "PCG": [
   ("data center interconnection pipeline", "Adoption", "Pipeline data centers 9,5 GW."),
   ("interconnected private solar customers", "Adoption", "950 000 clients solaire privé raccordés."),
   ("electric vehicles in service area", "Adoption", "820 000 véhicules électriques sur le réseau."),
   ("underground powerlines completed", "Capacité", "31 miles enfouis dans le trimestre."),
   ("residential", "Segments", "Segment Residential 6,98 Md$."),
 ],
 "PEG": [
   ("regulated capital investment program", "Capital", "Programme d'investissement régulé 28 Md$ (5 ans)."),
   ("indicated annual dividend rate", "Capital", "Dividende annuel indicatif 2,68 $/action."),
   ("nuclear generation capacity", "Capacité", "3 758 MW de capacité nucléaire."),
   ("nuclear fleet output", "Capacité", "30,9 TWh produits par la flotte nucléaire."),
   ("electric distribution", "Segments", "Segment Electric Distribution 4,86 Md$."),
 ],
 "PFE": [
   ("total net cost savings targeted by 2026", "Capital", "Économies nettes visées 7,2 Md$ d'ici 2026."),
   ("metsera acquisition", "Capital", "Acquisition Metsera 6,9 Md$."),
   ("key pivotal study starts", "Innovation", "11 études pivots lancées."),
   ("business innovation", "Innovation", "Segment Business Innovation 0,30 Md$."),
   ("biopharma", "Segments", "Segment Biopharma 61,2 Md$."),
 ],
 "PFG": [
   ("$1.5b share repurchase program completed", "Capital", "Programme rachat 1,5 Md$ complété."),
   ("total company managed aum", "Capacité", "AUM géré total 770 Md$."),
   ("total assets under administration", "Capacité", "AUA total 1 814,6 Md$."),
   ("global customer base", "Adoption", "82 M personnes servies."),
   ("premiums and other considerations", "Segments", "Segment Primes 6,78 Md$."),
 ],
 "PGR": [
   ("statutory surplus", "Capital", "Surplus statutaire 28,4 Md$."),
   ("total policies in force", "Adoption", "39,6 M polices en vigueur."),
   ("direct auto policies in force", "Adoption", "16,6 M polices auto direct."),
   ("commercial lines policies in force", "Segments", "Segment Commercial Lines : 1,2 M polices."),
   ("agency auto policies in force", "Segments", "Segment Agency Auto : 11,1 M polices."),
 ],
 "PH": [
   ("70 years of annual dividend increases", "Capital", "70 années consécutives de hausses de dividende."),
   ("filtration group acquisition", "Capital", "Acquisition Filtration Group 9,25 Md$."),
   ("total company backlog", "Capacité", "Carnet total 12,5 Md$."),
   ("aerospace systems", "Segments", "Segment Aerospace Systems 1,71 Md$."),
   ("diversified industrial", "Segments", "Segment Diversified Industrial 3,47 Md$."),
 ],
 "PKG": [
   ("free cash flow", "Capital", "FCF 164 M$."),
   ("greif containerboard business acquisition", "Capital", "Acquisition Greif containerboard 1,80 Md$."),
   ("containerboard production", "Capacité", "1,4 M tonnes de containerboard produites."),
   ("corrugated products plants", "Capacité", "91 usines de produits ondulés."),
   ("packaging", "Segments", "Segment Packaging 2,13 Md$."),
 ],
 "PLD": [
   ("dividend / core ffo payout ratio", "Capital", "Payout dividende/Core FFO 69,5%."),
   ("solar and storage installed capacity", "Capacité", "1,3 GW solaire + stockage installé."),
   ("data center power pipeline", "Capacité", "Pipeline data center 5,6 GW."),
   ("customers in o&m portfolio", "Adoption", "6 500 clients dans le portefeuille."),
   ("rental", "Segments", "Segment Rental 8,16 Md$."),
 ],
 "PLTR": [
   ("us commercial customer count", "Adoption", "295 clients US commercial."),
   ("total customer count growth year-over-year", "Adoption", "+34% de croissance clients YoY."),
   ("us commercial revenue", "Segments", "Segment US Commercial 595 M$."),
   ("government revenue", "Segments", "Segment Government 2,40 Md$."),
 ],
 "PM": [
   ("cumulative gross cost savings since 2024", "Capital", "1,5 Md USD d'économies cumulées depuis 2024."),
   ("estimated adult consumers of smoke-free products", "Adoption", "43 M consommateurs adultes de produits sans fumée."),
   ("markets where zyn is available", "Adoption", "58 marchés ZYN disponibles."),
   ("heated tobacco units (htu) shipment volume", "Capacité", "41,3 Md unités HTU livrées."),
   ("markets where smoke-free products are available", "Segments", "108 marchés sans fumée."),
 ],
 "PNR": [
   ("record annual free cash flow", "Capital", "FCF annuel record 748 M$."),
   ("share repurchases in quarter", "Capital", "Rachats trimestriels 200 M$."),
   ("hydra-stop acquisition", "Capital", "Acquisition Hydra-Stop 292 M$."),
   ("transformation savings", "Capacité", "Économies de transformation 70 M$."),
   ("return on invested capital", "Capital", "ROIC 16,6%."),
 ],
 "PNW": [
   ("retail customer growth", "Adoption", "+2,2% de clients retail."),
   ("retail electricity customers served", "Adoption", "1,4 M clients électricité servis."),
   ("transmission capex growth over five years", "Capital", "Capex transmission 6 Md$ sur 5 ans."),
   ("all-time peak demand", "Capacité", "Pic historique 8 631 MW."),
   ("desert sun generation site capacity", "Capacité", "Capacité Desert Sun 2 000 MW."),
 ],
 "PODD": [
   ("estimated active global omnipod customers", "Adoption", "600 000 clients Omnipod actifs."),
   ("global customers using omnipod 5", "Adoption", "365 000 clients Omnipod 5."),
   ("third manufacturing plant in costa rica", "Capacité", "3ᵉ usine au Costa Rica."),
   ("senior unsecured notes due 2033 issued", "Capital", "Notes seniors 450 M$ émises."),
   ("u.s. omnipod revenue", "Segments", "Segment US Omnipod 497 M$."),
 ],
 "POOL": [
   ("share repurchase program authorization", "Capital", "Autorisation rachat 600 M$."),
   ("open market share repurchases", "Capital", "Rachats open market 349 M$."),
   ("consecutive annual dividend increases", "Capital", "20 hausses annuelles consécutives de dividende."),
   ("sales centers", "Capacité", "456 sales centers."),
   ("wholesale customers served", "Adoption", "125 000 clients wholesale."),
 ],
 "PPL": [
   ("equity units offering", "Capital", "Offre d'unités equity 1,15 Md$."),
   ("customers served", "Adoption", "3,6 M clients servis."),
   ("new generation capacity in build", "Capacité", "1 900 MW en construction."),
   ("kentucky pumped storage hydro project", "Capacité", "266 MW de STEP Kentucky."),
   ("annual infrastructure investment", "Capital", "Investissement infrastructure annuel 4,4 Md$."),
 ],
 "PRU": [
   ("2026 share repurchase authorization", "Capital", "Autorisation rachat 2026 : 1,0 Md USD."),
   ("dividends declared per share", "Capital", "Dividende déclaré 5,40 $/action."),
   ("total assets under management", "Capacité", "AUM total 1 576 Md$."),
   ("pgim assets under management", "Capacité", "PGIM AUM 1 433 Md$."),
   ("institutional retirement strategies", "Segments", "Segment Institutional Retirement Strategies 16,66 Md$."),
 ],
 "PSA": [
   ("dividend / core ffo payout ratio", "Capital", "Payout dividende/Core FFO 71,1%."),
   ("us self-storage facilities owned/operated", "Capacité", "3 546 installations self-storage US."),
   ("us portfolio net rentable square feet", "Capacité", "259 M sq ft louables."),
   ("third-party managed facilities", "Adoption", "441 installations gérées pour tiers."),
   ("rental income", "Segments", "Segment Rental income 3 636 M$."),
 ],
 "PSKY": [
   ("debt financing commitment for wbd", "Capital", "Engagement dette WBD 57,5 Md$."),
   ("equity commitment for wbd", "Capital", "Engagement equity WBD 46,6 Md$."),
   ("paramount+ global subscribers", "Adoption", "78,9 M abonnés Paramount+."),
   ("paramount+ paid subscribers", "Adoption", "79,6 M abonnés Paramount+ payants."),
   ("direct-to-consumer revenue", "Segments", "Segment DTC 8 584 M$."),
 ],
}

report={}
for tk, picks in PICKS.items():
    p=f'/Users/yann/spx-app/src/data/v2-pipeline/{tk.lower()}.json'
    d=json.load(open(p))
    before=set()
    for k in d.get('kpis',[]):
        if 'story_category' in k: before.add(k['story_category'])
    added=[]
    # For each pick, find first KPI whose short lower contains substring and lacks non-Marché category
    for sub, cat, signal in picks:
        for k in d['kpis']:
            s=k.get('short','').lower()
            if sub in s:
                # skip if already tagged with a different non-Marché category (avoid overwriting Marché fine details)
                cur=k.get('story_category')
                if cur==cat: continue
                # override: even if Marché, retag to more specific category
                k['story_category']=cat
                k['is_short_history']=True
                if signal and not k.get('signal'):
                    k['signal']=signal
                if not k.get('_source'):
                    k['_source']='batch2-retag'
                added.append(k.get('short'))
                break
    after=set()
    for k in d['kpis']:
        if 'story_category' in k: after.add(k['story_category'])
    report[tk]={'before_cat':len(before),'after_cat':len(after),'added_shorts':added,'cats':sorted(after)}
    with open(p,'w') as f:
        json.dump(d,f,ensure_ascii=False,indent=1)

print(json.dumps(report,ensure_ascii=False))
