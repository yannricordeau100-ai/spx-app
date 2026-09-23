#!/usr/bin/env python3
"""Avantage concurrentiel (moat) par designation de phrases, pour les fiches sans
entree dans src/data/moat-univers.json (Yann 24 sept 2026). Le moteur gratuit
designe les phrases du dernier rapport annuel qui decrivent l avantage, choisit
le niveau et la tendance parmi les valeurs admises, et redige un texte court
sans aucun nombre absent des phrases designees."""
import json, os, re, sys, glob, gzip, html, datetime
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOT = re.compile(r'(?i)competitive (advantage|strength|position)|barrier|switching cost|network effect|brand|scale|market leader|leading position|intellectual property|proprietary|moat|differentiat')
NIV = ('Aucun', 'Moyen', 'Important'); TEND = ('stable', 'hausse', 'baisse'); CONF = ('faible', 'moyenne', 'haute')
PROMPT = """Tu évalues l'avantage concurrentiel durable (« moat ») de {name} ({ticker}) à partir de phrases extraites de son dernier rapport annuel ({doc}).
Phrases numérotées :
{phrases}
Réponds UNIQUEMENT en JSON : {{"niveau": "Aucun|Moyen|Important", "tendance": "stable|hausse|baisse", "preuves": [numéros de 2 à 4 phrases], "texte": "une à deux phrases en français, 45 mots maximum, qui nomment la nature de l'avantage (marque, échelle, coûts de transfert, réseau, brevets, réglementation) sans aucun chiffre absent des phrases désignées, sans anglicisme, sans tiret long", "justification": "une phrase en français sur ce qui soutient ou fragilise cet avantage, d'après les phrases", "confiance": "faible|moyenne|haute"}}
Règle : « Important » exige un avantage nommé et étayé par au moins deux phrases concrètes ; « Aucun » si les phrases ne décrivent qu'un discours général."""
def nombres(s):
    s = re.sub(r'(?<=\d)[\s  ](?=\d{3}\b)', '', s); s = re.sub(r'(?<=\d),(?=\d{3}\b)', '', s).replace(',', '.')
    return set(re.findall(r'\d+(?:\.\d+)?', s))
def texte(t):
    if not t.endswith(('.PA', '.DE', '.AS', '.SW')):
        d = [x for x in sorted(glob.glob(f'{ROOT}/data-lake/{t}/10K/*.htm.gz')) if '_ER_' not in x and 'ex99' not in x.lower()]
        # Le dossier 10K melange parfois un 10-K/A ou un autre depot plus recent
        # mais bien plus court : on garde le plus gros des deux derniers fichiers.
        if len(d) >= 2: d = [max(d[-2:], key=os.path.getsize)]
        if d: return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', gzip.open(d[-1], 'rt', errors='replace').read()))), os.path.basename(d[-1])
    u = [x for x in sorted(glob.glob(f'{ROOT}/data-lake/{t}/ir/URD/*.txt.gz')) if 'remuneration' not in x.lower()]
    if u: return re.sub(r'\s+', ' ', gzip.open(u[-1], 'rt', errors='replace').read()), os.path.basename(u[-1])
    return None, None
# La confiance n est jamais « haute » sur une premiere passe automatique.
if __name__ == '__main__':
    noms = json.load(open(f'{ROOT}/src/data/compare-index.json')).get('names', {})
    moat = json.load(open(f'{ROOT}/src/data/moat-univers.json'))
    for t in [a for a in sys.argv[1:] if not a.startswith('--')]:
        txt, doc = texte(t)
        if not txt: print(t, 'aucun document'); continue
        ph = []; vu = set()
        for m in re.finditer(r'(?<=[.!?]\s)[A-Z][^.!?]{40,400}[.!?]', ' ' + txt):
            p = m.group(0).strip()
            if MOT.search(p) and '•' not in p and p[:80] not in vu and not re.search(r'\b[a-z]{2,} (Our|We|The|In)\b', p): vu.add(p[:80]); ph.append(p)
        ph = ph[:40]
        if len(ph) < 2: print(t, 'trop peu de phrases'); continue
        liste = "\n".join(f"{i+1}. {p}" for i, p in enumerate(ph))
        try: rep, moteur = appelle(PROMPT.format(name=noms.get(t, t), ticker=t, doc=doc, phrases=liste), json_attendu=True)
        except MoteurIndisponible: print('MOTEUR INDISPONIBLE'); break
        pr = [ph[i-1] for i in (rep.get('preuves') or []) if isinstance(i, int) and 1 <= i <= len(ph)]
        tx = (rep.get('texte') or '').replace('—', ':').replace('–', ':').strip(); ju = (rep.get('justification') or '').replace('—', ':').strip()
        if rep.get('niveau') not in NIV or rep.get('tendance') not in TEND or rep.get('confiance') not in CONF or len(pr) < 2 or not tx: print(t, 'REFUSE structure'); continue
        manq = [x for x in nombres(tx + ' ' + ju) if not any(x in nombres(p) for p in pr)]
        if manq: print(t, 'REFUSE nombres', manq); continue
        iso = re.search(r'(\d{4}-\d{2}-\d{2})', doc); depuis = iso.group(1) if iso else datetime.date.today().isoformat()
        moat[t] = {'niveau': rep['niveau'], 'tendance': rep['tendance'], 'depuis': depuis, 'texte': tx, 'tendance_mettrik': rep['tendance'], 'justification_mettrik': ju, 'confiance_mettrik': 'faible' if rep['confiance']=='faible' else 'moyenne', '_preuves': pr[:3], '_source_doc': doc}
        print(t, rep['niveau'], rep['tendance'], rep['confiance'], '|', tx[:140])
        if '--ecrit' in sys.argv: json.dump(moat, open(f'{ROOT}/src/data/moat-univers.json', 'w'), ensure_ascii=False, indent=1)
