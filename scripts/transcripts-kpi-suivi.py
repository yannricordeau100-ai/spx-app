#!/usr/bin/env python3
"""Rapprochement des KPI entre conferences (mission transcripts-4).
Entree : src/data/transcripts-kpi/<t>.json (lignes verifiees mot pour mot).
Cle de rapprochement : concept() de scripts/catalogue_nomenclature.py (meme
vocabulaire que le catalogue de comparabilite), sinon libelle normalise.
Sortie : src/data/transcripts-kpi/<t>.suivi.json :
  suivi        = cles presentes dans AU MOINS DEUX conferences (pas forcement consecutives)
  cites_une_fois = les autres, gardes a part
Chaque entree porte, par conference : date, valeur, unite, periode, citation."""
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalogue_nomenclature import concept
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9 ]', ' ', s); mots = [m for m in s.split() if m not in ('le', 'la', 'les', 'de', 'des', 'du', 'd', 'l', 'en', 'et', 'a', 'au', 'aux', 'par', 'pour', 'total', 'totale')]
    return '_'.join(mots[:8])
def cle_de(k):
    c, fam = concept(k.get('nom_fr') or '')
    return (c or norm(k.get('nom_fr'))), fam
def traite(t):
    p = f'{ROOT}/src/data/transcripts-kpi/{t.lower()}.json'
    d = json.load(open(p)); groupes = {}
    for call in sorted(d.get('calls', []), key=lambda c: c['date']):
        for k in call.get('kpis', []):
            cle, fam = cle_de(k)
            g = groupes.setdefault(cle, {'cle': cle, 'famille': fam, 'nom_fr': k.get('nom_fr'), 'theme': k.get('theme'), 'points': []})
            if any(x['date'] == call['date'] and x['periode'] == k.get('periode') for x in g['points']): continue
            # Unite deja portee par la valeur (« 8%-9% » + « % », « EUR 17.7 billion » + « EUR ») : on ne la repete pas.
            v = str(k.get('valeur') or '').strip(); u = (k.get('unite') or '').strip() or None
            if u and (u in v or (u == '%' and '%' in v)): u = None
            g['points'].append({'date': call['date'], 'valeur': v, 'unite': u, 'periode': k.get('periode'), 'citation': k.get('citation')})
    suivi = [g for g in groupes.values() if len({x['date'] for x in g['points']}) >= 2]
    une_fois = [g for g in groupes.values() if len({x['date'] for x in g['points']}) == 1]
    # rattachement a la fiche : meme cle que l un des KPI de la fiche
    fiche = f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json'; cles_fiche = set()
    if os.path.exists(fiche):
        for k in json.load(open(fiche)).get('kpis', []) or []:
            c, _ = concept(k.get('name_fr') or k.get('short') or ''); cles_fiche.add(c or norm(k.get('name_fr') or k.get('short')))
    # Rattachement souple : meme cle, ou au moins deux mots significatifs en commun
    # avec le libelle d un indicateur de la fiche (le vocabulaire des conferences
    # differe de celui des rapports).
    mots_fiche = []
    if os.path.exists(fiche):
        for k in json.load(open(fiche)).get('kpis', []) or []:
            m = set(norm(k.get('name_fr') or k.get('short') or '').split('_')); m = {x for x in m if len(x) > 3}
            if m: mots_fiche.append((k.get('short'), m))
    for g in suivi + une_fois:
        mg = {x for x in norm(g.get('nom_fr')).split('_') if len(x) > 3}
        corr = next((short for short, m in mots_fiche if len(m & mg) >= 2 or (len(m) == 1 and m <= mg)), None)
        g['rattache_fiche'] = g['cle'] in cles_fiche or corr is not None
        if corr: g['kpi_fiche'] = corr
    out = {'ticker': t, 'conferences': sorted({c['date'] for c in d.get('calls', [])}), 'suivi': sorted(suivi, key=lambda g: -len(g['points'])), 'cites_une_fois': sorted(une_fois, key=lambda g: g['nom_fr'] or '')}
    json.dump(out, open(f'{ROOT}/src/data/transcripts-kpi/{t.lower()}.suivi.json', 'w'), ensure_ascii=False, indent=1)
    return len(suivi), len(une_fois), sum(1 for g in suivi + une_fois if g['rattache_fiche'])
if __name__ == '__main__':
    for t in sys.argv[1:]:
        s, u, r = traite(t); print(f'{t}: suivi {s}, cites une fois {u}, rattaches a la fiche {r}')
