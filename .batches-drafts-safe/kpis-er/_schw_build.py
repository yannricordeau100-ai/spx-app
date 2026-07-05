import json
kpis=[
{"short":"Total client assets","name_fr":"Actifs clients totaux","name_en":"Total client assets","value":11767.9,"unit":"B USD","yoy":"+19%","pv_score":9,"signal":"Actifs clients records a 11,77 T USD, socle de tous les revenus recurrents.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2021","v":7069.1},{"q":"Q1-2023","v":7580.0},{"q":"Q2-2023","v":8015.8},{"q":"Q3-2023","v":7824.5},{"q":"Q4-2023","v":8516.6},
 {"q":"Q1-2024","v":9118.4},{"q":"Q2-2024","v":9407.5},{"q":"Q3-2024","v":9920.5},{"q":"Q4-2024","v":10101.3},
 {"q":"Q1-2025","v":9929.7},{"q":"Q2-2025","v":10757.3},{"q":"Q3-2025","v":11593.9},{"q":"Q4-2025","v":11903.0},{"q":"Q1-2026","v":11767.9}]},
{"short":"Core net new assets","name_fr":"Nouveaux actifs nets de base","name_en":"Core net new assets","value":140.0,"unit":"B USD","yoy":"+6%","pv_score":9,"signal":"Collecte organique trimestrielle, meilleur indicateur de croissance hors effet marche.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2023","v":150.7},{"q":"Q2-2023","v":72.0},{"q":"Q3-2023","v":48.2},{"q":"Q4-2023","v":66.3},
 {"q":"Q1-2024","v":88.2},{"q":"Q2-2024","v":74.2},{"q":"Q3-2024","v":90.8},{"q":"Q4-2024","v":108.4},
 {"q":"Q1-2025","v":132.4},{"q":"Q2-2025","v":73.6},{"q":"Q3-2025","v":134.4},{"q":"Q4-2025","v":158.2},{"q":"Q1-2026","v":139.9}]},
{"short":"Active brokerage accounts","name_fr":"Comptes de courtage actifs","name_en":"Active brokerage accounts","value":39099,"unit":"K comptes","yoy":"+6%","pv_score":8,"signal":"Base de comptes actifs a 39,1 M, croissance reguliere de la clientele.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2021","v":31902},{"q":"Q1-2024","v":35301},{"q":"Q2-2024","v":35612},{"q":"Q3-2024","v":35982},{"q":"Q4-2024","v":36456},
 {"q":"Q1-2025","v":37011},{"q":"Q2-2025","v":37476},{"q":"Q3-2025","v":37963},{"q":"Q4-2025","v":38506},{"q":"Q1-2026","v":39099}]},
{"short":"New brokerage accounts","name_fr":"Nouveaux comptes de courtage","name_en":"New brokerage accounts","value":1299,"unit":"K comptes","yoy":"+10%","pv_score":7,"signal":"Ouvertures trimestrielles de comptes, moteur d'acquisition client.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":1042},{"q":"Q2-2024","v":960},{"q":"Q3-2024","v":894},{"q":"Q4-2024","v":910},
 {"q":"Q1-2025","v":1183},{"q":"Q2-2025","v":1098},{"q":"Q3-2025","v":1143},{"q":"Q4-2025","v":1268},{"q":"Q1-2026","v":1299}]},
{"short":"Daily average trades","name_fr":"Transactions quotidiennes moyennes","name_en":"Clients' Daily Average Trades (DATs)","value":9899,"unit":"K trades/jour","yoy":"+34%","pv_score":8,"signal":"Volume de trading record a 9,9 M/jour, mesure directe de l'engagement client.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":5958},{"q":"Q2-2024","v":5486},{"q":"Q3-2024","v":5697},{"q":"Q4-2024","v":6312},
 {"q":"Q1-2025","v":7391},{"q":"Q2-2025","v":7571},{"q":"Q3-2025","v":7421},{"q":"Q4-2025","v":8274},{"q":"Q1-2026","v":9899}]},
{"short":"Margin balances","name_fr":"Encours sur marge","name_en":"Margin loans outstanding","value":126.7,"unit":"B USD","yoy":"+52%","pv_score":7,"signal":"Encours de marge en forte hausse, indicateur de conviction et d'engagement des clients.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":68.1},{"q":"Q2-2024","v":71.7},{"q":"Q3-2024","v":73.0},{"q":"Q4-2024","v":83.8},
 {"q":"Q1-2025","v":83.6},{"q":"Q2-2025","v":83.4},{"q":"Q3-2025","v":97.2},{"q":"Q4-2025","v":112.3},{"q":"Q1-2026","v":126.7}]},
{"short":"Bank loans","name_fr":"Prets bancaires nets","name_en":"Bank loans - net","value":60.9,"unit":"B USD","yoy":"+29%","pv_score":7,"signal":"Prets bancaires a 60,9 Md, expansion de la solution de credit adossee aux actifs.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":40.8},{"q":"Q2-2024","v":42.2},{"q":"Q3-2024","v":43.3},{"q":"Q4-2024","v":45.2},
 {"q":"Q1-2025","v":47.1},{"q":"Q2-2025","v":50.4},{"q":"Q3-2025","v":53.6},{"q":"Q4-2025","v":58.0},{"q":"Q1-2026","v":60.9}]},
{"short":"Banking accounts","name_fr":"Comptes bancaires","name_en":"Banking accounts","value":2281,"unit":"K comptes","yoy":"+11%","pv_score":6,"signal":"Comptes bancaires a 2,28 M, approfondissement de la relation client.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":1885},{"q":"Q2-2024","v":1931},{"q":"Q3-2024","v":1954},{"q":"Q4-2024","v":1998},
 {"q":"Q1-2025","v":2050},{"q":"Q2-2025","v":2096},{"q":"Q3-2025","v":2150},{"q":"Q4-2025","v":2214},{"q":"Q1-2026","v":2281}]},
{"short":"Workplace plan participants","name_fr":"Participants plans en entreprise","name_en":"Workplace Plan Participant Accounts","value":5844,"unit":"K comptes","yoy":"+6%","pv_score":6,"signal":"Participants aux plans d'entreprise a 5,84 M, canal d'acquisition retraite.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2024","v":5277},{"q":"Q2-2024","v":5363},{"q":"Q3-2024","v":5388},{"q":"Q4-2024","v":5399},
 {"q":"Q1-2025","v":5495},{"q":"Q2-2025","v":5586},{"q":"Q3-2025","v":5619},{"q":"Q4-2025","v":5740},{"q":"Q1-2026","v":5844}]},
{"short":"Transactional sweep cash","name_fr":"Liquidites de balayage transactionnel","name_en":"Transactional sweep cash","value":461.5,"unit":"B USD","yoy":"+13%","pv_score":6,"signal":"Liquidites clients a 461,5 Md, source de financement cle de la banque.","frequency":"quarterly","first_seen":"Q1-2021","last_seen":"current","discontinued":False,"history":[
 {"q":"Q1-2025","v":407.8},{"q":"Q4-2025","v":453.7},{"q":"Q1-2026","v":461.5}]}
]
data={"ticker":"SCHW","company":"The Charles Schwab Corporation","source":"ER+earnings-calls","kpis":kpis,"_extracted_at":"2026-07-05"}
with open("/Users/yann/spx-app/.batches-drafts-safe/kpis-er/SCHW.json","w") as f:
    json.dump(data,f,indent=2,ensure_ascii=False)
print("KPIs:",len(kpis))
