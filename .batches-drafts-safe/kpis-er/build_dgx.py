import json

# Per-quarter YoY % changes extracted from ER DIS revenue tables (first value = current-quarter YoY)
# Requisition volume, Organic requisition volume, Revenue per requisition
reqvol = {
 "Q1-2016":None,"Q2-2016":None,"Q3-2016":None,  # not in table form these quarters
 "Q1-2017":None,"Q2-2017":1.8,"Q1-2018":None,"Q2-2018":2.5,"Q3-2018":2.0,
 "Q1-2019":None,"Q2-2019":4.4,"Q3-2019":5.1,
 "Q1-2020":None,"Q2-2020":-17.7,"Q3-2020":19.7,"Q4-2020":26.8,
 "Q1-2021":25.6,"Q2-2021":45.2,"Q3-2021":5.3,"Q4-2021":1.3,
 "Q1-2022":1.3,"Q2-2022":-1.4,"Q3-2022":-6.2,"Q4-2022":-11.2,
 "Q1-2023":-3.8,"Q2-2023":0.2,"Q3-2023":-0.5,"Q4-2023":1.9,
 "Q1-2024":1.6,"Q2-2024":1.1,"Q3-2024":5.5,"Q4-2024":13.9,
 "Q1-2025":12.4,"Q2-2025":16.3,"Q3-2025":12.5,"Q4-2025":8.5,
 "Q1-2026":10.9,
}
orgvol = {
 "Q3-2018":None,"Q1-2019":2.4,"Q2-2019":2.9,"Q3-2019":3.7,
 "Q1-2020":None,"Q2-2020":-18.2,"Q3-2020":16.6,"Q4-2020":22.3,
 "Q1-2021":21.6,"Q2-2021":40.1,"Q3-2021":3.2,"Q4-2021":0.2,
 "Q1-2022":0.0,"Q2-2022":-2.4,"Q3-2022":-6.4,"Q4-2022":-11.4,
 "Q1-2023":None,"Q2-2023":-0.3,"Q3-2023":-1.0,"Q4-2023":1.4,
 "Q1-2024":1.0,"Q2-2024":0.7,"Q3-2024":0.5,"Q4-2024":0.6,
 "Q1-2025":-0.9,"Q2-2025":2.1,"Q3-2025":3.9,"Q4-2025":7.9,
 "Q1-2026":10.8,
}
revperreq = {
 "Q1-2016":1.1,"Q2-2016":0.2,"Q3-2016":0.0,
 "Q1-2017":-0.2,"Q2-2017":0.7,"Q1-2018":1.6,"Q2-2018":0.2,"Q3-2018":-0.8,
 "Q1-2019":-3.0,"Q2-2019":-2.3,"Q3-2019":-1.2,
 "Q1-2020":-1.2,"Q2-2020":15.3,"Q3-2020":20.9,"Q4-2020":25.2,
 "Q1-2021":20.5,"Q2-2021":-3.6,"Q3-2021":-5.4,"Q4-2021":-9.8,
 "Q1-2022":-5.2,"Q2-2022":-2.6,"Q3-2022":-5.1,"Q4-2022":-5.1,
 "Q1-2023":-7.7,"Q2-2023":-4.9,"Q3-2023":-7.2,"Q4-2023":-3.5,
 "Q1-2024":0.1,"Q2-2024":1.6,"Q3-2024":3.3,"Q4-2024":0.2,
 "Q1-2025":0.3,"Q2-2025":-0.4,"Q3-2025":0.8,"Q4-2025":-0.1,
 "Q1-2026":-1.3,
}

def order(q):
    p,y=q.split("-"); return (int(y),int(p[1]))

def hist(d):
    return [{"q":k,"v":v} for k,v in sorted(d.items(),key=lambda x:order(x[0])) if v is not None]

kpis=[
 {"short":"Requisition volume growth","name_fr":"Croissance du volume de requetes","name_en":"Requisition volume growth (YoY)",
  "value":10.9,"unit":"%","yoy":None,"pv_score":8,
  "signal":"Volume total d'analyses realisees, moteur principal de la croissance organique et des acquisitions.",
  "frequency":"quarterly","first_seen":"Q2-2017","last_seen":"current","discontinued":False,"history":hist(reqvol)},
 {"short":"Organic requisition volume growth","name_fr":"Croissance organique du volume de requetes","name_en":"Organic requisition volume growth (YoY)",
  "value":10.8,"unit":"%","yoy":None,"pv_score":9,
  "signal":"Volume d'analyses hors acquisitions, mesure la vraie sante du coeur de business.",
  "frequency":"quarterly","first_seen":"Q1-2019","last_seen":"current","discontinued":False,"history":hist(orgvol)},
 {"short":"Revenue per requisition","name_fr":"Revenu par requete","name_en":"Revenue per requisition (YoY)",
  "value":-1.3,"unit":"%","yoy":None,"pv_score":7,
  "signal":"Evolution du prix/mix moyen par analyse, indicateur de pricing et de mix produit.",
  "frequency":"quarterly","first_seen":"Q1-2016","last_seen":"current","discontinued":False,"history":hist(revperreq)},
]

out={"ticker":"DGX","company":"Quest Diagnostics Incorporated","source":"ER+earnings-calls","kpis":kpis,"_extracted_at":"2026-07-05"}
with open("/Users/yann/spx-app/.batches-drafts-safe/kpis-er/DGX.json","w") as f:
    json.dump(out,f,indent=2,ensure_ascii=False)
print("KPIs:",len(kpis))
for k in kpis: print(k["short"],"->",len(k["history"]),"pts")
