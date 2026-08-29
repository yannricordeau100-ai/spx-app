#!/usr/bin/env python3
"""Audit qualite des 3 KPI wow retenus pour la grille d accueil.

Rejoue la selection de scripts/build-home-wow.py (meme fonction note) et
signale les societes dont les 3 KPI sont purement financiers alors qu un
KPI physique parlant existe dans la fiche.
Usage : python3 scripts/audit-home-wow.py
"""
import json, os

# build-home-wow.py ecrit le JSON a l import : on rejoue son preambule seul.
SRC = open('scripts/build-home-wow.py', encoding='utf-8').read()
ns = {}
exec(SRC.split('out=[]')[0], ns)
financier, note, slug = ns['financier'], ns['note'], ns['slug']

POP = json.load(open('src/data/home-popular-fr.json', encoding='utf-8'))['tickers']
uni = {str(x).upper() for x in json.load(open('src/data/v1-9-5-clean-all-tickers.json', encoding='utf-8'))['tickers']}
uni &= {a['ticker'].upper() for a in json.load(open('src/data/v1-9-pre-publication-audit.json', encoding='utf-8'))['audits'] if a.get('is_clean_all')}
uni &= {str(k).upper() for k in json.load(open('src/data/v1-7-public.json', encoding='utf-8'))}

def fiche(T):
    kpis = []
    p1 = f'.batches-drafts-safe/kpis-haut/{T}.json'
    if os.path.exists(p1):
        try: kpis = json.load(open(p1, encoding='utf-8')).get('kpis') or []
        except Exception: pass
    p2 = f'src/data/v2-pipeline/{T.lower()}.json'
    nom = None
    if os.path.exists(p2):
        try:
            f2 = json.load(open(p2, encoding='utf-8')); nom = f2.get('name')
            vus = {k.get('short') for k in kpis}
            kpis += [k for k in (f2.get('kpis') or []) if k.get('short') not in vus]
        except Exception: pass
    kpis = [k for k in kpis if isinstance(k, dict) and k.get('value') is not None
            and (k.get('name_fr') or k.get('name_en'))]
    return nom, kpis

alertes, lignes, n = [], [], 0
for t in POP:
    T = t.upper()
    if T not in uni: continue
    n += 1
    nom, kpis = fiche(T)
    if not kpis: continue
    tri = []
    for k in sorted(kpis, key=note, reverse=True):
        sl = slug(k.get('name_fr') or k.get('name_en'))
        if any(sl == m or sl in m or m in sl for m in
               map(slug, (x.get('name_fr') or x.get('name_en') for x in tri))):
            continue
        tri.append(k)
        if len(tri) == 3: break
    phys_dispo = [k for k in kpis if not financier(k.get('unit'))]
    phys_retenus = [k for k in tri if not financier(k.get('unit'))]
    lignes.append({
        'ticker': T, 'nom': nom or T,
        'retenus': [{'nom': k.get('name_fr') or k.get('name_en'), 'unite': k.get('unit'),
                     'yoy': k.get('yoy'), 'note': note(k), 'phys': not financier(k.get('unit'))}
                    for k in tri],
        'physiques_dispo': len(phys_dispo),
    })
    if not phys_retenus and phys_dispo:
        alertes.append({
            'ticker': T, 'nom': nom or T,
            'candidats': [{'nom': k.get('name_fr') or k.get('name_en'), 'unite': k.get('unit'),
                           'yoy': k.get('yoy'), 'note': note(k)} for k in
                          sorted(phys_dispo, key=note, reverse=True)[:4]],
        })
    if n >= 40: break

for l in lignes:
    marque = ''.join('P' if k['phys'] else 'f' for k in l['retenus'])
    print(f"{l['ticker']:<10} [{marque}] phys_dispo={l['physiques_dispo']:<3} " +
          ' | '.join(f"{k['nom']} ({k['unite']}) n={k['note']}" for k in l['retenus']))
print()
print(f"--- {len(alertes)} societe(s) 100 % financieres avec un physique disponible ---")
for a in alertes:
    print(f"\n{a['ticker']} {a['nom']}")
    for c in a['candidats']:
        print(f"   physique ignore : {c['nom']} ({c['unite']}) yoy={c['yoy']} note={c['note']}")
json.dump({'lignes': lignes, 'alertes': alertes},
          open('.conv-state/audit-home-wow.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
