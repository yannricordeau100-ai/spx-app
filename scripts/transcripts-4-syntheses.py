#!/usr/bin/env python3
"""Syntheses des conferences anterieures (mission transcripts-4). Meme format
que src/data/transcript-summaries/<t>.json (bullets PV) mais pour chacune des
conferences de `calls`, ecrites dans src/data/transcript-summaries/<t>.calls.json
sous la forme {"<date>": {"quarter": "2026Q2", "summary": {...}}}. Moteur
gratuit ; controle : chaque bullet doit porter un nombre present dans le
transcript, sinon la bullet est retiree ; moins de 3 bullets = conference sautee."""
import json, os, re, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur_gratuit import appelle, MoteurIndisponible
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = {"type": "OBJECT", "properties": {"tonalite_management": {"type": "STRING"}, "sentiment": {"type": "STRING"}, "bullets": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"text": {"type": "STRING"}, "type": {"type": "STRING"}}, "required": ["text", "type"]}}}, "required": ["tonalite_management", "sentiment", "bullets"]}
PROMPT = """Tu generes une synthese pour investisseurs particuliers de la conference de resultats de {name} ({ticker}) du {date}.
Format JSON : {{"tonalite_management": "une phrase sur le ton du management (150 caracteres max)", "sentiment": "bullish|neutral|cautious", "bullets": [{{"text": "une phrase dense en francais : chiffre + signal + action (130 caracteres max)", "type": "synthesis|driver|vigilance|guidance|strategy|tonalite|citation"}}, ... 6 a 10 bullets]}}
Chaque bullet porte un chiffre recopie tel quel du transcript. Aucun tiret long. Francais.
Transcript :
---
{ctx}
---"""
def nombres(s): return set(re.findall(r'\d+(?:[.,]\d+)?', s.replace(' ', '').replace(' ', '')))
def contexte(content, limite=60000):
    if len(content) <= limite: return content
    # debut (remarques preparees) et fin (questions) : les deux moities
    return content[:limite // 2] + "\n[...]\n" + content[-limite // 2:]
def traite(t):
    p = f'{ROOT}/src/data/transcripts/{t.lower()}.json'; d = json.load(open(p))
    calls = d.get('calls') or []
    if not calls: return 'sans conferences'
    outp = f'{ROOT}/src/data/transcript-summaries/{t.lower()}.calls.json'
    out = json.load(open(outp)) if os.path.exists(outp) else {}
    name = json.load(open(f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json')).get('name', t) if os.path.exists(f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json') else t
    faits = 0
    for c in calls:
        date = c.get('date')
        if not date or date in out: continue
        rep, moteur = appelle(PROMPT.format(name=name, ticker=t, date=date, ctx=contexte(c['content'])), json_attendu=True, schema=SCHEMA)
        nt = nombres(c['content']); bullets = []
        for b in rep.get('bullets') or []:
            txt = (b.get('text') or '').replace('—', ':').replace('–', '-').strip()
            nb = nombres(txt)
            if not txt or not nb or not nb <= nt: continue
            bullets.append({'text': txt, 'type': b.get('type') or 'synthesis'})
        if len(bullets) < 3: continue
        q = f"{c.get('year')}Q{c.get('quarter')}" if c.get('year') and c.get('quarter') else None
        out[date] = {'quarter': q, 'date': date, 'source': d.get('_calls_source'), 'moteur': moteur, 'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'summary': {'tonalite_management': (rep.get('tonalite_management') or '').replace('—', ':'), 'sentiment': rep.get('sentiment') if rep.get('sentiment') in ('bullish', 'neutral', 'cautious') else 'neutral', 'bullets': bullets}}
        faits += 1
    json.dump(out, open(outp, 'w'), ensure_ascii=False, indent=1)
    return f'{faits} syntheses ecrites, {len(out)} au total'
if __name__ == '__main__':
    for t in sys.argv[1:]:
        try: print(t, traite(t), flush=True)
        except MoteurIndisponible: print(t, 'MOTEUR INDISPONIBLE', flush=True); break
        except Exception as e: print(t, 'erreur', e, flush=True)
