#!/usr/bin/env python3
"""Traduction en francais des citations du bloc Positionnement IA (Yann 24 sept
2026 : exception explicite a la regle « aucune traduction », l original anglais
reste affiche dans le « i »). Moteur gratuit ; controle : memes nombres dans
la version francaise que dans l original, aucun tiret long. Ecrit
`evidence_fr` (meme longueur que `evidence`) dans src/data/v2-pipeline/<t>.json."""
import json, os, re, sys, glob, datetime
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = {"type": "OBJECT", "properties": {"fr": {"type": "ARRAY", "items": {"type": "STRING"}}}, "required": ["fr"]}
PROMPT = """Traduis fidèlement en français chacune de ces citations d'un rapport annuel, dans le même ordre, sans rien ajouter ni résumer, en gardant tous les nombres, noms propres et sigles tels quels, sans tiret long. Réponds en JSON {{"fr": [...]}} avec exactement {n} éléments.
{lignes}"""
def nombres(s): return sorted(re.findall(r'\d+(?:[.,]\d+)?', s.replace(' ', '')))
def deja_fr(s): return bool(re.search(r"\b(le|la|les|des|une|est|sont|dans|pour|avec)\b", s)) and not re.search(r"\b(the|and|of|our|with|for)\b", s)
def traite(p):
    d = json.load(open(p)); ai = d.get('ai_positioning')
    if not isinstance(ai, dict): return 'sans bloc'
    ev = [e if isinstance(e, str) else (e.get('text') or e.get('quote') or '') for e in (ai.get('evidence') or [])]
    ev = [e for e in ev if e.strip()]
    if not ev: return 'sans citation'
    if isinstance(ai.get('evidence_fr'), list) and len(ai['evidence_fr']) == len(ev) and ai.get('_evidence_fr_de') == ev: return 'deja fait'
    if all(deja_fr(e) for e in ev):
        ai['evidence_fr'] = ev; ai['_evidence_fr_de'] = ev; ai['_evidence_fr_note'] = 'citations deja en francais'
        json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2); return 'deja en francais'
    rep, moteur = appelle(PROMPT.format(n=len(ev), lignes="\n".join(f"{i+1}. {e}" for i, e in enumerate(ev))), json_attendu=True, schema=SCHEMA)
    fr = rep.get('fr') if isinstance(rep, dict) else rep
    if not isinstance(fr, list) or len(fr) != len(ev): return f'longueur {len(fr) if isinstance(fr, list) else "?"} au lieu de {len(ev)}'
    fr = [str(x).replace('—', ':').replace('–', '-').strip() for x in fr]
    for o, t in zip(ev, fr):
        if nombres(o) != nombres(t): return f'nombres differents : {nombres(o)} vs {nombres(t)}'
        if not t or len(t) < 0.4 * len(o): return 'traduction trop courte'
    ai['evidence_fr'] = fr; ai['_evidence_fr_de'] = ev; ai['_evidence_fr_moteur'] = moteur; ai['_evidence_fr_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2); return 'ok'
if __name__ == '__main__':
    univers = json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
    cibles = sys.argv[1:] or univers
    bilan = {}
    for t in cibles:
        p = f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json'
        if not os.path.exists(p): continue
        try: r = traite(p)
        except MoteurIndisponible: print('MOTEUR INDISPONIBLE, pause 120 s', flush=True); import time; time.sleep(120); continue
        except Exception as e: r = f'erreur {e}'
        bilan[r.split(' ')[0]] = bilan.get(r.split(' ')[0], 0) + 1
        if r not in ('ok', 'deja fait', 'deja en francais', 'sans bloc', 'sans citation'): print(t, 'REFUSE :', r, flush=True)
    print('BILAN', bilan, flush=True)
