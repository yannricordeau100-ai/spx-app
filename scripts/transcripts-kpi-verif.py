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
for f in sorted(g for g in glob.glob(f'/tmp/transcripts-kpi/{t}.*.json') if re.match(re.escape(t) + r'\.\d{4}-\d{2}-\d{2}\.json$', os.path.basename(g))):  # 24 sept : EL ne ramasse plus EL.PA
    d = json.load(open(f)); date = d.get('date'); c = calls.get(date)
    if not c: bilan.append((date, 'conference inconnue')); continue
    texte = norm(c['content']); ok = []; rej = 0
    for k in d.get('kpis', []):
        cit = norm(k.get('citation')); val = norm(str(k.get('valeur', '')))
        if not cit or cit not in texte or not val or val not in cit: rej += 1; continue
        ok.append(k)
    sortie['calls'].append({'date': date, 'kpis': ok}); bilan.append((date, f'{len(ok)} verifies, {rej} rejetes'))
# Controle mecanique de la societe : nombre de mentions du nom (ou du code) par conference.
try:
    import unicodedata
    nom = json.load(open(f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json')).get('name', '')
    mots = [m for m in re.findall(r'[a-z]{4,}', unicodedata.normalize('NFKD', nom.lower()).encode('ascii', 'ignore').decode()) if m not in ('inc', 'corp', 'company', 'group', 'holdings', 'international', 'limited', 'plc', 'corporation')][:2]
    for c in sortie['calls']:
        txt = norm(calls[c['date']]['content']); n = sum(txt.count(m) for m in mots) + txt.count(t.split('.')[0].lower() + ' ')
        c['_mentions_societe'] = n
        if n < 3: print(t, c['date'], f'ATTENTION : societe peu mentionnee ({n}), verifier la source')
except Exception: pass
for b in bilan: print(t, *b)
if '--applique' in sys.argv:
    os.makedirs(f'{ROOT}/src/data/transcripts-kpi', exist_ok=True)
    json.dump(sortie, open(f'{ROOT}/src/data/transcripts-kpi/{t.lower()}.json', 'w'), ensure_ascii=False, indent=1); print('ecrit')
