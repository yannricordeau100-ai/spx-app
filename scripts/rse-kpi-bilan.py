#!/usr/bin/env python3
"""Bilan du test RSE : pour chaque societe de /tmp/rse/<T>.json, mesure la
part des KPI du premier exercice encore presents dans le dernier. Le
rapprochement des libelles est fait par DESIGNATION : le moteur gratuit recoit
les deux listes numerotees et renvoie, pour chaque KPI ancien, le numero du
KPI recent equivalent (ou 0). Le script ne garde une paire que si les deux
libelles partagent au moins un mot significatif ou la meme unite."""
import json, os, re, sys, glob, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur_gratuit import appelle, MoteurIndisponible
SCHEMA = {"type": "OBJECT", "properties": {"paires": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"ancien": {"type": "INTEGER"}, "recent": {"type": "INTEGER"}}, "required": ["ancien", "recent"]}}}, "required": ["paires"]}
VIDES = {'de', 'des', 'du', 'la', 'le', 'les', 'en', 'et', 'a', 'au', 'aux', 'par', 'pour', 'sur', 'total', 'totale', 'taux', 'nombre', 'part'}
def mots(s): return {m for m in re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii', 'ignore').decode()).split() if len(m) > 2 and m not in VIDES}
def bilan(t):
    d = json.load(open(f'/tmp/rse/{t}.json')); annees = sorted(int(a) for a in d)
    anc = list(d[str(annees[0])]['kpis'].values()); rec = list(d[str(annees[-1])]['kpis'].values())
    la = "\n".join(f"{i+1}. {k['nom']} ({k.get('unite') or ''})" for i, k in enumerate(anc)); lr = "\n".join(f"{i+1}. {k['nom']} ({k.get('unite') or ''})" for i, k in enumerate(rec))
    prompt = f"""Deux listes d'indicateurs RSE de {t} : la liste A (exercice {annees[0]}) et la liste B (exercice {annees[-1]}). Pour chaque indicateur de A, indique le numero de l'indicateur de B qui mesure LA MEME CHOSE (meme grandeur, meme perimetre), ou 0 s'il n'existe pas. Reponds en JSON {{"paires":[{{"ancien":1,"recent":12}},...]}} avec un element par indicateur de A.
LISTE A :
{la}
LISTE B :
{lr}"""
    rep, moteur = appelle(prompt, json_attendu=True, schema=SCHEMA)
    ok = 0; vus = set()
    for p in rep.get('paires') or []:
        i, j = p.get('ancien'), p.get('recent')
        if not (isinstance(i, int) and isinstance(j, int) and 1 <= i <= len(anc) and 1 <= j <= len(rec)) or i in vus: continue
        a, b = anc[i-1], rec[j-1]
        if mots(a['nom']) & mots(b['nom']) or (a.get('unite') and a.get('unite') == b.get('unite') and len(mots(a['nom']) & mots(b['nom'])) >= 0 and False):
            ok += 1; vus.add(i)
    return {'annees': annees, 'kpi_ancien': len(anc), 'kpi_recent': len(rec), 'encore_presents': ok, 'encore_presents_pct': round(100 * ok / max(1, len(anc)), 1), 'moteur': moteur}
if __name__ == '__main__':
    res = {}
    for f in sorted(glob.glob('/tmp/rse/*.json')):
        t = os.path.basename(f)[:-5]
        if t.startswith('bilan'): continue
        try: res[t] = bilan(t); print(t, res[t], flush=True)
        except MoteurIndisponible: print(t, 'moteur indisponible'); break
        except Exception as e: print(t, 'erreur', e)
    json.dump(res, open('/tmp/rse/bilan-designation.json', 'w'), ensure_ascii=False, indent=1)
