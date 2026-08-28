#!/usr/bin/env python3
"""Regenere src/data/hors-indices-kpis.json depuis les fiches KPI.

Les societes listees dans src/data/hors-indices-tickers.json ne sont plus en
ligne (hors des indices retenus par Yann) mais leurs KPI restent consultables
dans /sandbox/hors-indices. A relancer apres toute mise a jour de leurs fiches.
"""
import json, os
hors=json.load(open('src/data/hors-indices-tickers.json',encoding='utf-8'))['tickers']
out=[]
for t in hors:
    fiche={}
    p=f'src/data/v2-pipeline/{t.lower()}.json'
    if os.path.exists(p):
        try: fiche=json.load(open(p,encoding='utf-8'))
        except Exception: pass
    base=[]
    src=f'.batches-drafts-safe/kpis-haut/{t}.json'
    if os.path.exists(src):
        try: base=json.load(open(src,encoding='utf-8')).get('kpis') or []
        except Exception: pass
    if not base and isinstance(fiche.get('kpis'),list): base=fiche['kpis']
    kpis=[{'nom':k.get('name_fr') or k.get('name_en') or k.get('short'),
           'valeur':k.get('value'),'unite':k.get('unit'),'yoy':k.get('yoy'),
           'categorie':k.get('category') or k.get('type') or 'Autre'}
          for k in base if isinstance(k,dict) and k.get('value') is not None]
    out.append({'ticker':t,'nom':fiche.get('name') or t,
                'secteur':fiche.get('sector') or 'Autre','kpis':kpis})
json.dump({'generation':'scripts/build-hors-indices.py','societes':out},
          open('src/data/hors-indices-kpis.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(out),'societes,',sum(len(x["kpis"]) for x in out),'KPI')
