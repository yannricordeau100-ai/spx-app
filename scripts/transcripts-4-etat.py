#!/usr/bin/env python3
"""Etat de la mission transcripts-4 : par societe, conferences collectees,
syntheses anciennes, extraction Fable (lignes verifiees), suivi. Sortie : tableau
et liste des prochaines societes a extraire (4 conferences presentes, pas de
fichier transcripts-kpi)."""
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
u = json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
n = {'collectees': 0, 'syntheses': 0, 'extraites': 0, 'suivi': 0}; prochaines = []
for t in u:
    l = t.lower(); tr = f'{ROOT}/src/data/transcripts/{l}.json'
    try: calls = json.load(open(tr)).get('calls') or []
    except Exception: calls = []
    if len(calls) >= 4: n['collectees'] += 1
    if os.path.exists(f'{ROOT}/src/data/transcript-summaries/{l}.calls.json'): n['syntheses'] += 1
    ex = os.path.exists(f'{ROOT}/src/data/transcripts-kpi/{l}.json')
    if ex: n['extraites'] += 1
    if os.path.exists(f'{ROOT}/src/data/transcripts-kpi/{l}.suivi.json'): n['suivi'] += 1
    if len(calls) >= 4 and not ex: prochaines.append(t)
print(f"univers {len(u)} | 4 conferences collectees {n['collectees']} | syntheses anciennes {n['syntheses']} | extractions Fable {n['extraites']} | suivis {n['suivi']}")
print('prochaines a extraire :', ' '.join(prochaines[:15]), f'(+{max(0, len(prochaines)-15)})')
