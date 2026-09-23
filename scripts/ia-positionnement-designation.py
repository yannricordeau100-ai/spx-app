#!/usr/bin/env python3
"""Positionnement IA par designation de phrases (Yann 24 sept 2026).

Le moteur gratuit ne redige AUCUNE citation : il DESIGNE par numero les phrases
du rapport qui portent le positionnement, choisit la categorie et ecrit un
resume court en francais. Le script garde les phrases d origine comme preuves
et refuse tout resume contenant un nombre absent des phrases designees.

Entree : /tmp/ia_phrases/<T>.json (phrases extraites mecaniquement).
Sortie : /tmp/ia_out/<T>.json, puis injection par --injecte.
"""
import json, os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible

CATS = ("leader", "integrator", "cautious", "peu_documente")
PROMPT = """Tu analyses le positionnement d'une société cotée sur l'intelligence artificielle, à partir de phrases extraites de son dernier rapport annuel. Société : {nom} ({ticker}). Document : {doc}. Nombre total de mentions de l'IA dans le document : {n}.

Phrases numérotées :
{phrases}

Réponds UNIQUEMENT en JSON avec ces clés :
- "categorie" : "leader" (l'IA est au coeur de la stratégie et des produits), "integrator" (l'IA est intégrée de façon significative aux opérations ou à l'offre), "cautious" (la société dit explicitement limiter, encadrer ou surveiller son usage de l'IA, ou décrit l'IA comme une menace concrète pour son activité), "peu_documente" (mentions anecdotiques ou de pure forme : formation, compétence recherchée, paragraphe générique de facteurs de risque, sans montant, objectif ni indicateur). Règle : des phrases de facteurs de risque génériques ne suffisent JAMAIS pour "cautious", elles conduisent à "peu_documente".
- "preuves" : liste de 2 à 4 numéros de phrases qui justifient la catégorie, les plus concrètes d'abord.
- "resume" : 2 à 3 phrases en français, sans aucun chiffre qui ne figure pas dans les phrases désignées, sans anglicisme, sans le mot « jalon », qui disent ce que la société fait ou ne fait pas avec l'IA et ce qui manque (montant, objectif, indicateur) s'il y a lieu.
Pas de texte hors du JSON."""

def nombres(s):
    s = re.sub(r'(?<=\d)[\s\u202f\u00a0](?=\d{3}\b)', '', s)
    s = re.sub(r'(?<=\d),(?=\d{3}\b)', '', s).replace(',', '.')
    return set(re.findall(r'\d+(?:\.\d+)?', s))

def traite(t, nom):
    src = json.load(open(f'/tmp/ia_phrases/{t}.json'))
    ph = src['phrases']
    liste = "\n".join(f"{i+1}. {p}" for i, p in enumerate(ph))
    rep, moteur = appelle(PROMPT.format(nom=nom, ticker=t, doc=src['document'], n=src['total_mentions'], phrases=liste), json_attendu=True)
    cat = rep.get('categorie'); idx = rep.get('preuves') or []; res = (rep.get('resume') or '').strip()
    if cat not in CATS: return None, f"categorie invalide {cat}"
    preuves = [ph[i-1] for i in idx if isinstance(i, int) and 1 <= i <= len(ph)]
    if len(preuves) < 2: return None, "moins de deux preuves designees"
    if not res or '—' in res or 'jalon' in res.lower(): return None, "resume vide ou interdit"
    manq = [x for x in nombres(res) if not any(x in nombres(p) for p in preuves)]
    if manq: return None, f"nombre non etaye dans le resume : {manq}"
    return {'stance': cat, 'summary': res, 'evidence': preuves, 'source': src['document'], '_moteur': moteur, '_mentions': src['total_mentions']}, None

if __name__ == "__main__":
    os.makedirs('/tmp/ia_out', exist_ok=True)
    noms = json.load(open('src/data/compare-index.json')).get('names', {})
    cibles = sys.argv[1:] or [f[:-5] for f in sorted(os.listdir('/tmp/ia_phrases'))]
    ok = 0
    for t in cibles:
        if t.startswith('--'): continue
        try: out, err = traite(t, noms.get(t, t))
        except MoteurIndisponible as e: print(t, 'MOTEUR INDISPONIBLE'); break
        except Exception as e: out, err = None, f"erreur {e}"
        if out: json.dump(out, open(f'/tmp/ia_out/{t}.json', 'w'), ensure_ascii=False, indent=1); ok += 1; print(f"{t:9s} {out['stance']:14s} preuves={len(out['evidence'])} moteur={out['_moteur']}")
        else: print(f"{t:9s} REFUSE : {err}")
    print(f"\n{ok}/{len(cibles)} produits")
