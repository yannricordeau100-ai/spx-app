#!/usr/bin/env python3
"""Repartition du chiffre d affaires (geographique ou par activite) depuis le
rapport annuel du lac, pour les fiches qui n en ont pas (Yann 24 sept 2026).

Le moteur gratuit lit les passages du rapport qui parlent de repartition et
renvoie les tranches. Le script REFUSE toute tranche dont la valeur n existe
pas dans le texte, toute somme de parts hors de 95 a 105, et toute tranche
sans nom. Si la societe ne publie pas cette repartition, le moteur le dit et
le script note la raison sans rien ecrire dans la fiche.
Usage : python3 scripts/repartition-ca-designation.py geo|segment T1 T2 ... [--ecrit]
"""
import json, os, re, sys, glob, gzip, html, datetime
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTS = {'geo': re.compile(r'(?i)by (geograph|region|country|market)|geographic(al)? (area|region|breakdown|split|information)|by destination|par zone|par r[ée]gion|nach Regionen|region'),
        'segment': re.compile(r'(?i)by (segment|division|business|activity|product)|segment (information|reporting|revenue)|operating segments|par (activit|secteur|division|m[ée]tier)|Segment')}
PROMPT = """Tu extrais la répartition du chiffre d'affaires {quoi} de {name} ({ticker}) pour le dernier exercice clos, à partir de passages de son rapport annuel ({doc}). Devise et unité telles qu'écrites dans le rapport.

PASSAGES :
{passages}

Réponds UNIQUEMENT en JSON :
- si la répartition est publiée : {{"publiee": true, "exercice": "2025", "unite": "Mds €" ou "M €" ou "Mds $" (unité des valeurs que tu recopies), "tranches": [{{"nom_fr": "...", "nom_en": "...", "valeur": nombre recopié tel quel du texte, "part_pct": nombre ou null}}]}} avec 2 à 8 tranches couvrant le total (« Autres » admis) ;
- sinon : {{"publiee": false, "raison": "une phrase en français", "tranches": [], "unite": "", "exercice": ""}}.
Règles : aucune valeur qui ne figure pas mot pour mot dans les passages ; ne convertis pas les unités ; pas de tiret long."""
def norm(s):
    s = re.sub(r'(?<=\d)[\s  ](?=\d{3}\b)', '', s); s = re.sub(r'(?<=\d),(?=\d{3}\b)', '', s); return s.replace(',', '.')
def texte(t):
    if not t.endswith(('.PA', '.DE', '.AS', '.SW', '.L')):
        d = [x for x in sorted(glob.glob(f'{ROOT}/data-lake/{t}/10K/*.htm.gz') + glob.glob(f'{ROOT}/data-lake/{t}/20F/*.htm.gz')) if '_ER_' not in x and 'ex99' not in x.lower()]
        if len(d) >= 2: d = [max(d[-2:], key=os.path.getsize)]
        if d: return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', gzip.open(d[-1], 'rt', errors='replace').read()))), os.path.basename(d[-1])
    u = [x for x in sorted(glob.glob(f'{ROOT}/data-lake/{t}/ir/URD/*.txt.gz') + glob.glob(f'{ROOT}/data-lake/{t}/ir/RFS/*.txt.gz')) if 'remuneration' not in x.lower() and 'SFCR' not in x]
    if u: return re.sub(r'\s+', ' ', gzip.open(u[-1], 'rt', errors='replace').read()), os.path.basename(u[-1])
    return None, None
def passages(txt, quoi, max_car=30000):
    """Fenetres autour des notes de segmentation, classees par densite de
    chiffres et presence d un total : c est la que vivent les tableaux."""
    cands = []
    for m in MOTS[quoi].finditer(txt):
        a = max(0, m.start() - 600); b = min(len(txt), m.end() + 3200)
        seg = txt[a:b]
        chiffres = len(re.findall(r'\d[\d.,]{2,}', seg))
        if chiffres < 20: continue
        score = chiffres + (40 if re.search(r'(?i)\btotal\b', seg) else 0) + (30 if re.search(r'(?i)revenue|chiffre d.affaires|umsatz|sales|net turnover', seg) else 0)
        cands.append((score, a, b))
    if quoi == 'geo':
        ZONES = re.compile(r'(?i)\b(Europe|Am[ée]rique|America|Asi[ae]|Afri[cq]|France|Germany|Allemagne|Deutschland|DACH|Rest of (the )?World|Reste du monde|North America|Middle East|Pacific|China|Chine|Netherlands|Pays-Bas|Switzerland|Suisse|United States|[ÉE]tats-Unis|Latin)')
        pos = 0
        while pos < len(txt):
            seg = txt[pos:pos + 2500]
            zones = len(set(z.lower() for z in ZONES.findall(seg) if isinstance(z, str)))
            chiffres = len(re.findall(r'\d[\d.,]{2,}', seg))
            if zones >= 3 and chiffres >= 20 and re.search(r'(?i)revenue|chiffre d.affaires|umsatz|sales|turnover|omzet', seg):
                cands.append((chiffres + 10 * zones + (40 if re.search(r'(?i)\btotal\b', seg) else 0), pos, pos + 2500))
            pos += 1250
    cands.sort(reverse=True); pris = []
    for sc, a, b in cands:
        if any(not (b < x or a > y) for x, y in pris): continue
        pris.append((a, b))
        if len(pris) >= 7: break
    pris.sort()
    return "\n---\n".join(txt[a:b] for a, b in pris)[:max_car]
def traite(t, quoi):
    p = f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json'; d = json.load(open(p))
    txt, doc = texte(t)
    if not txt: return None, 'aucun document'
    pas = passages(txt, quoi)
    if len(pas) < 500: return None, 'aucun passage chiffre trouve'
    SCHEMA = {"type": "OBJECT", "properties": {"publiee": {"type": "BOOLEAN"}, "raison": {"type": "STRING"}, "exercice": {"type": "STRING"}, "unite": {"type": "STRING"},
              "tranches": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"nom_fr": {"type": "STRING"}, "nom_en": {"type": "STRING"}, "valeur": {"type": "NUMBER"}, "part_pct": {"type": "NUMBER", "nullable": True}}, "required": ["nom_fr", "valeur"]}}}, "required": ["publiee", "tranches", "unite", "exercice"]}
    rep, moteur = appelle(schema=SCHEMA, prompt=PROMPT.format(quoi='par zone géographique' if quoi == 'geo' else 'par activité (segments)', name=d.get('name', t), ticker=t, doc=doc, passages=pas), json_attendu=True)
    if not rep.get('publiee'):
        return None, 'NON PUBLIEE : ' + str(rep.get('raison'))[:160]
    ntxt = norm(txt); tranches = []
    for tr in rep.get('tranches') or []:
        v = tr.get('valeur'); nom = (tr.get('nom_fr') or '').strip()
        if re.search(r'(?i)[ée]limin|intra[- ]?group|inter[- ]?segment|total', nom) or (isinstance(v, (int, float)) and v < 0): continue
        if not nom or not isinstance(v, (int, float)): return None, f'tranche invalide {tr}'
        vs = norm(str(abs(v))); vs2 = vs[:-2] if vs.endswith('.0') else vs
        if not re.search(r'(?<![\d.])' + re.escape(vs2) + r'(?![\d])', ntxt): return None, f'valeur {v} absente du texte ({nom})'
        tranches.append({'name': nom, 'label': nom, 'label_en': tr.get('nom_en') or nom, 'value': float(v), 'unit': rep.get('unite') or ''})
    if len(tranches) < 2: return None, 'moins de deux tranches'
    total = sum(x['value'] for x in tranches)
    if total <= 0: return None, 'total nul'
    for x in tranches: x['pct'] = round(100 * x['value'] / total, 1); x['share_pct'] = x['pct']
    parts = [tr.get('part_pct') for tr in rep['tranches'] if isinstance(tr.get('part_pct'), (int, float))]
    if parts and not 95 <= sum(parts) <= 105: return None, f'somme des parts {sum(parts)}'
    label = ("Répartition du chiffre d'affaires par zone géographique" if quoi == 'geo' else "Répartition du chiffre d'affaires par activité") + (f" (exercice {rep.get('exercice')})" if rep.get('exercice') else '')
    return {'label': label, 'slices': tranches, '_source_doc': doc, '_moteur': moteur, '_methode': 'designation, valeurs verifiees dans le texte'}, None
if __name__ == '__main__':
    quoi = sys.argv[1]; cle = 'revenue_by_geography' if quoi == 'geo' else 'revenue_by_segment'
    os.makedirs('/tmp/repartition_out', exist_ok=True)
    for t in [a for a in sys.argv[2:] if not a.startswith('--')]:
        try: out, err = traite(t, quoi)
        except MoteurIndisponible: print('MOTEUR INDISPONIBLE'); break
        except Exception as e: out, err = None, f'erreur {e}'
        if not out: print(f'{t:9s} REFUSE : {err}'); continue
        json.dump(out, open(f'/tmp/repartition_out/{t}.{quoi}.json', 'w'), ensure_ascii=False, indent=1)
        print(f"{t:9s} OK {len(out['slices'])} tranches : " + ", ".join(f"{s['name']} {s['pct']}%" for s in out['slices']))
        if '--ecrit' in sys.argv:
            p = f'{ROOT}/src/data/v2-pipeline/{t.lower()}.json'; d = json.load(open(p)); d[cle] = {k: v for k, v in out.items() if not k.startswith('_')}
            d[f'_maj_{cle}'] = datetime.datetime.now(datetime.timezone.utc).isoformat(); d[f'_{cle}_source'] = out['_source_doc']
            json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
