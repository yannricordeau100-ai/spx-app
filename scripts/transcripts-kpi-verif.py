#!/usr/bin/env python3
"""Controle d une extraction de KPI de conference : chaque citation doit exister
mot pour mot dans le transcript, la valeur doit figurer dans la citation.
Usage : python3 scripts/transcripts-kpi-verif.py <TICKER> [--applique]
Lit /tmp/transcripts-kpi/<T>.<date>.json (sorties des sous agents) et ecrit
src/data/transcripts-kpi/<t>.json avec seulement les lignes verifiees."""
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def norm(s): return re.sub(r'\s+', ' ', (s or '').replace('’', "'").replace('“', '"').replace('”', '"')).strip().lower()
t = sys.argv[1]; doc = json.load(open(f'{ROOT}/src/data/transcripts/{t.lower()}.json'))
calls = {c['date']: c for c in doc.get('calls', [])}
if doc.get('latest', {}).get('date') and doc['latest'].get('content'): calls.setdefault(doc['latest']['date'], doc['latest'])
sortie = {'ticker': t, 'calls': []}; bilan = []
for f in sorted(glob.glob(f'/tmp/transcripts-kpi/{t}.*.json')):
    d = json.load(open(f)); date = d.get('date'); c = calls.get(date)
    if not c: bilan.append((date, 'conference inconnue')); continue
    texte = norm(c['content']); ok = []; rej = 0
    for k in d.get('kpis', []):
        cit = norm(k.get('citation')); val = norm(str(k.get('valeur', '')))
        if not cit or cit not in texte or not val or val not in cit: rej += 1; continue
        ok.append(k)
    sortie['calls'].append({'date': date, 'kpis': ok}); bilan.append((date, f'{len(ok)} verifies, {rej} rejetes'))
for b in bilan: print(t, *b)
if '--applique' in sys.argv:
    os.makedirs(f'{ROOT}/src/data/transcripts-kpi', exist_ok=True)
    json.dump(sortie, open(f'{ROOT}/src/data/transcripts-kpi/{t.lower()}.json', 'w'), ensure_ascii=False, indent=1); print('ecrit')
