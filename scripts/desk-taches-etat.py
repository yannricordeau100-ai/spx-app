#!/usr/bin/env python3
"""Etat des grandes taches pour l onglet « Grandes taches » du desk (24 sept 2026).
Ecrit src/data/desk-taches.json : taches restantes (ETA, modele, reglages) et
societes completement faites / partiellement / pas du tout pour la mission
transcripts-4. A relancer avant chaque mise en ligne."""
import json, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
u = json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
noms = {}
try:
    for i in json.load(open(f'{ROOT}/src/data/indices-composition.json'))['indices'].values():
        for m in i['membres']: noms.setdefault(m['ticker'], m['nom'])
except Exception: pass
comp, part, aucune = [], [], []
for t in u:
    l = t.lower()
    try: calls = json.load(open(f'{ROOT}/src/data/transcripts/{l}.json')).get('calls') or []
    except Exception: calls = []
    ex = os.path.exists(f'{ROOT}/src/data/transcripts-kpi/{l}.json')
    su = os.path.exists(f'{ROOT}/src/data/transcripts-kpi/{l}.suivi.json')
    n = {'t': t, 'nom': noms.get(t, '')}
    if t == 'EA':
        aucune.append({**n, 'raison': 'société rachetée le 4 août 2026, plus cotée'})
    elif len(calls) >= 4 and ex and su: comp.append(n)
    elif not calls: aucune.append({**n, 'raison': 'aucune conférence trouvée'})
    elif len(calls) < 4: part.append({**n, 'raison': f'{len(calls)} conférence(s) sur 4 disponibles'})
    else: part.append({**n, 'raison': '4 conférences collectées, extraction des KPI en attente'})
fait, total = len(comp), len(u)
reste = sum(1 for p in part if p['raison'].startswith('4 conf'))
cadence = 34  # societes par heure mesurees le 24 sept (4 en parallele)
h = round(reste / cadence, 1)
taches = [
 {'titre': 'Conférences de résultats : extraction des KPI (4 dernières par société)',
  'etat': f'{fait} sociétés complètes sur {total}, {reste} en attente d extraction',
  'eta': f'ARRÊTÉE sur demande le 24 sept à 19 h 25 (les 4 sociétés en cours ont été terminées). Reste {h} h de calcul ({cadence} sociétés/h) à la reprise',
  'modele': 'Fable 5.1 (claude-fable-5-1), repli automatique Opus 5.5 (claude-opus-5-5)',
  'reglages': 'claude -p en mode non interactif, une session neuve par société, 4 sociétés en parallèle, effort par défaut, prompt figé docs/cahier/PROMPT-TRANSCRIPT-KPI.md, vérification mot pour mot puis suivi, commit local',
  'commande': 'bash scripts/transcripts-4-extraction-lot.sh <liste.json> 4'},
 {'titre': 'Conférences de résultats : 9 sociétés sans 4 conférences',
  'etat': '4 sans aucune conférence, 5 avec une seule (scissions, introductions récentes) ; EA retirée du site (rachetée)',
  'eta': '1 h 30 (recherche d autres sources)',
  'modele': 'Aucun modèle Claude pour la collecte (MarketBeat, StockAnalysis) ; Fable 5.1 pour l extraction',
  'reglages': 'scripts/transcripts-4-collecte.py puis même chaîne que ci-dessus'},
 {'titre': 'Conférences de résultats : mise en production',
  'etat': 'préversion à jour pour les sociétés complètes ; production seulement sur « go n0 »',
  'eta': '30 min par mise en ligne (préversion), 20 min pour go n0',
  'modele': 'Aucun (scripts de déploiement)',
  'reglages': 'bash scripts/deploy-niveau2.sh puis, sur ordre, bash scripts/go-n0.sh'},
 {'titre': 'Mises à jour automatiques hors Claude (Cerebras, repli Groq)',
  'etat': '4 scripts appellent encore Claude ; tâche nocturne earnings-refresh coupée depuis le 23 sept en attendant',
  'eta': '2 h (autre compte), puis réactivation de la tâche nocturne',
  'modele': 'Cerebras (gpt-oss-120b), repli Groq Llama 3.3 70B ; aucun modèle Claude',
  'reglages': 'docs/cahier/MISSION-CRONS-HORS-CLAUDE.md ; réactiver ~/Library/LaunchAgents/ai.mettrik.earnings-refresh.plist.disabled-claude-23sept'},
 {'titre': 'Sociétés disparues (rachat, faillite, retrait de la cote)',
  'etat': 'FAIT le 24 sept : EA et JDEP.AS retirées du site (univers 662) ; ACLS, QRVO, WBD gardées tant que le rachat n est pas finalisé et que l action est cotée',
  'eta': 'À refaire chaque mois : 30 min (retirer une société dès que son rachat est finalisé)',
  'modele': 'Sonnet 5 pour la vérification web une par une, effort bas',
  'reglages': 'python3 scripts/indices-wikipedia.py puis contrôle des cotations et vérification web de chaque cas suspect'},
]
out = {'maj': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'total': total, 'taches': taches,
       'societes': {'completes': comp, 'partielles': part, 'aucune': aucune}}
p = f'{ROOT}/src/data/desk-taches.json'
try: out['disparues'] = json.load(open(p)).get('disparues', [])
except Exception: out['disparues'] = []
json.dump(out, open(p, 'w'), ensure_ascii=False, indent=1)
print(f'complètes {fait} | partielles {len(part)} | aucune {len(aucune)} | reste extraction {reste}')
