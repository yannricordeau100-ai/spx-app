#!/usr/bin/env python3
"""Etat des lots d allongement (A01 a A47) : KPI `existe` des secteurs 45, 20, 40
dont le commentaire ne mentionne pas encore l allongement (marqueur : « Allonge le »
ou « Allongement non realise »). Usage : _allongement.py [--prochains N] [A24]"""
import json, glob, sys, re
D = 'docs/cahier/donnees'
lots = {}
for f in sorted(glob.glob(f'{D}/_lots/*.json')):
    n = f.split('/')[-1][:-5]
    lots[n] = [x if isinstance(x, str) else x.get('ticker') for x in json.load(open(f))]
seq = []
for sec in ['45', '20', '40']:
    for n in sorted(k for k in lots if k.startswith(sec + '-')):
        seq += lots[n]
MARQ = re.compile(r'allong', re.I)
cand, reste = [], {}
for t in seq:
    try: d = json.load(open(f'{D}/{t}.json'))
    except FileNotFoundError: continue
    ex = [k for k in d['kpis'] if k['statut'] == 'existe']
    if not ex: continue
    cand.append(t)
    reste[t] = [k['short'] for k in ex if not MARQ.search(k.get('commentaire', ''))]
lotsA = {f'A{i//5+1:02d}': cand[i:i+5] for i in range(0, len(cand), 5)}
if len(sys.argv) > 1 and sys.argv[1].startswith('A'):
    print(json.dumps(lotsA[sys.argv[1]])); sys.exit()
n = int(sys.argv[2]) if len(sys.argv) > 2 else 99
faits = sum(1 for t in cand if not reste[t])
print(f'allongement : societes traitees {faits} / {len(cand)} | lots {len(lotsA)}')
k = 0
for name, l in lotsA.items():
    r = {t: reste[t] for t in l if reste[t]}
    if r and k < n:
        print(f'LOT {name} restants', json.dumps(r)); k += 1
