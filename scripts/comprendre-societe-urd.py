#!/usr/bin/env python3
"""Bloc « Comprendre la societe » pour les societes europeennes sans description
(Yann 24 sept 2026). Meme schema que gen-mettrik-descriptions.py (simple et
advanced, quatre sections chacun), mais la matiere vient du rapport annuel
(URD ou RFS) du lac, pas de yfinance. Moteur gratuit, jamais Claude.

Garde-fous : tout nombre du texte produit doit exister dans la matiere fournie
(rapport, repartition du chiffre d affaires) ; aucun tiret long ; francais.
Sortie : src/data/v2-pipeline-enrich/<t>.mettrik-description.json
"""
import json, os, re, sys, glob, gzip, time
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPT = """Tu rédiges, pour Mettrik AI (plateforme d'indicateurs pour investisseurs), le bloc « Comprendre la société » de {name} ({ticker}), secteur {sector}, sous-secteur {subsector}.

MATIÈRE (extrait du rapport annuel {doc}, et répartition du chiffre d'affaires si connue) :
{matiere}

MISSION : deux blocs en français, JSON strict.
Bloc "simple" (lecteur débutant, phrases courtes, 110 à 150 mots) : "activity" (ce que fait la société, verbe concret), "products" (produits ou services principaux, 2 à 4 exemples), "customers" (qui achète), "edge" (sa force principale).
Bloc "advanced" (investisseur informé, 150 à 200 mots) : "positioning" (place dans la chaîne de valeur, ce qui fait varier les résultats : cycle, devises, matières), "tech_products" (activités ou produits clés et leur poids si connu), "moat" (avantages durables), "risks" (risques structurels documentés propres à la société).
Cas particuliers : holding = parler des participations et des dividendes remontés ; banque = produit net bancaire, intérêts contre commissions, coût du risque ; assureur = primes vie et non vie, ratio combiné ; société en perte = chemin vers la rentabilité sans parler de marge.
RÈGLES : français uniquement ; écrire « chiffre d'affaires » en toutes lettres, jamais « CA » ; un nom de programme ou de marque en anglais reste entre guillemets et est expliqué en français ; aucun tiret long ; aucun mot anglais non traduit ; aucun chiffre qui ne figure pas dans la matière ; aucun nom de dirigeant ; ton factuel, jamais promotionnel ; phrases complètes.
FORMAT : {{"simple":{{"fr":{{"activity":"...","products":"...","customers":"...","edge":"..."}}}},"advanced":{{"fr":{{"positioning":"...","tech_products":"...","moat":"...","risks":"..."}}}}}}"""

def nombres(s):
    # Normalisation : virgule decimale francaise, espaces fines ou insecables
    # entre groupes de chiffres (« 75 000 »), pour comparer a la matiere anglaise.
    s = re.sub(r'(?<=\d)[\s\u202f\u00a0](?=\d{3}\b)', '', s)   # 75 000 -> 75000
    s = re.sub(r'(?<=\d),(?=\d{3}\b)', '', s)                    # 75,000 -> 75000
    s = s.replace(',', '.')                                       # 24,2 -> 24.2
    trouves = set(re.findall(r'\d+(?:\.\d+)*', s))
    # Milliers a l allemande (21.622) : on ajoute aussi la forme sans points.
    for x in list(trouves):
        if re.fullmatch(r'\d{1,3}(?:\.\d{3})+', x): trouves.add(x.replace('.', ''))
        if '.' in x: trouves.add(x.split('.')[0])
    return trouves

def matiere(t, d):
    u = [x for x in sorted(glob.glob(f'{ROOT}/data-lake/{t}/ir/URD/*.txt.gz') + glob.glob(f'{ROOT}/data-lake/{t}/ir/RFS/*.txt.gz')) if 'remuneration' not in x.lower()]
    if not u: return None, None
    txt = re.sub(r'\s+', ' ', gzip.open(u[-1], 'rt', errors='replace').read())
    # Le debut du rapport porte la presentation du groupe : on prend 28 000 caracteres
    # apres avoir saute la table des matieres (premier tiers souvent numerique).
    debut = 0
    m = re.search(r'(?i)(business model|our business|group profile|profile|at a glance|who we are|overview of the group|geschäftsmodell|activit(é|e)s du groupe)', txt[:400000])
    if m: debut = max(0, m.start() - 500)
    parts = [txt[debut:debut + 28000]]
    for k in ('revenue_by_segment', 'revenue_by_geography'):
        if d.get(k): parts.append(f"\n{k} : " + json.dumps(d[k], ensure_ascii=False)[:3000])
    return "\n".join(parts), os.path.basename(u[-1])

def traite(t):
    p = f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json'
    d = json.load(open(p))
    mat, doc = matiere(t, d)
    if not mat: return None, 'pas de rapport annuel dans le lac'
    rep, moteur = appelle(PROMPT.format(name=d.get('name', t), ticker=t, sector=d.get('sector', ''), subsector=d.get('subsector', ''), doc=doc, matiere=mat), json_attendu=True, temperature=0.3)
    try:
        s = rep['simple']['fr']; a = rep['advanced']['fr']
        assert all(k in s and s[k].strip() for k in ('activity', 'products', 'customers', 'edge'))
        assert all(k in a and a[k].strip() for k in ('positioning', 'tech_products', 'moat', 'risks'))
    except Exception: return None, 'structure invalide'
    for bloc in (s, a):
        for k in bloc: bloc[k] = bloc[k].replace(' — ', ' : ').replace('—', ':').replace(' – ', ' : ').replace('–', '-')
    tout = " ".join(list(s.values()) + list(a.values()))
    manq = [n for n in nombres(tout) if n not in nombres(mat)]
    if manq: return None, f'chiffres non etayes {manq[:5]}'
    return {'ticker': t, 'mettrik_description': {'simple': rep['simple'], 'advanced': rep['advanced']},
            '_generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), '_source_kind': 'rapport_annuel_lac', '_source_doc': doc, '_moteur': moteur}, None

if __name__ == '__main__':
    cibles = [a for a in sys.argv[1:] if not a.startswith('--')]
    ecrit = '--ecrit' in sys.argv
    os.makedirs('/tmp/comprendre_out', exist_ok=True)
    for t in cibles:
        try: out, err = traite(t)
        except MoteurIndisponible: print('MOTEUR INDISPONIBLE'); break
        except Exception as e: out, err = None, f'erreur {e}'
        if not out: print(f'{t:9s} REFUSE : {err}'); continue
        json.dump(out, open(f'/tmp/comprendre_out/{t}.json', 'w'), ensure_ascii=False, indent=2)
        if ecrit: json.dump(out, open(f'{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.mettrik-description.json', 'w'), ensure_ascii=False, indent=2)
        print(f"{t:9s} OK ({out['_moteur']}) : {out['mettrik_description']['simple']['fr']['activity'][:90]}")
