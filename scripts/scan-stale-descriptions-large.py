"""Descriptions perimees, version elargie.

La premiere version exigeait que la description cite le chiffre avec l unite
exacte du KPI. Elle laissait donc passer le cas type signale le 27 aout : NVDA
porte une value de 59 688 $M et une description qui parle encore de
120,1 Mds$. Ici on normalise toutes les sommes citees en millions, quelle que
soit la facon de les ecrire, et on les compare a la value normalisee de la
meme facon. Suspect = aucune somme citee n approche la value.
"""
import json, os, re
from collections import Counter

ONLINE = set(json.load(open(os.environ.get('ONLINE_JSON', '/tmp/online.json')))['tickers'])
D = 'src/data/v2-pipeline-enrich'

# facteur de passage vers le million, par famille d unite
# "billion" ecrit en toutes lettres dans un texte francais vaut mille
# milliards, alors que "bn" est l abreviation anglaise du milliard. Les
# confondre faisait passer les AUM de BlackRock pour une description perimee.
ECHELLES = [
    (r'billions?$', 1_000_000.0),
    (r'(?:mds?|milliards?|bn|bln|b)$', 1000.0),
    (r'(?:m(?:io)?|millions?|mm)$', 1.0),
    (r'(?:k|milliers?|thousands?)$', 0.001),
]
DEVISES = r'(?:\$|€|£|¥|usd|eur|gbp|chf|sek|nok|dkk|jpy|dollars?|euros?)'
NOMBRE = r'(\d[\d    ]*(?:[,\.]\d+)?)'


def clean(s):
    return s.replace(' ', ' ').replace('\xa0', ' ')


def tofloat(s):
    s = s.replace(' ', '').replace('\xa0', '').replace(' ', '')
    # 1 234,5 -> 1234.5 ; 1,234.5 -> 1234.5
    if ',' in s and '.' in s:
        s = s.replace(',', '') if s.rfind('.') > s.rfind(',') else s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def unite_en_millions(unit):
    """Facteur pour ramener la value du KPI en millions. None si l unite n est
    pas une somme d argent."""
    u = (unit or '').lower()
    if not re.search(DEVISES, u):
        return None
    # Motifs non ancres : l unite d un KPI s ecrit "Mds $", "$M", "M €"...
    # Du plus specifique au moins, sinon "Mds" serait pris pour un "M".
    for motif, f in ((r'\bmds?\b|\bmilliards?\b|\bbn\b', 1000.0),
                     (r'\bm(?:io|ln)?\b|\bmillions?\b', 1.0),
                     (r'\bk\b|\bmilliers?\b', 0.001)):
        if re.search(motif, u):
            return f
    return 1.0  # unite monetaire sans prefixe : deja en unites, traitee en M


def sommes_citees(desc):
    """Toutes les sommes de la description, ramenees en millions."""
    out = []
    txt = clean(desc)
    # nombre + echelle + devise, dans les deux ordres courants
    motifs = [
        NOMBRE + r'\s*(mds?|milliards?|bn|billions?|m(?:io)?|millions?|k|milliers?)\s*(?:de\s*)?' + DEVISES,
        NOMBRE + r'\s*' + DEVISES + r'\s*(mds?|milliards?|bn|billions?|m(?:io)?|millions?|k|milliers?)\b',
    ]
    for motif in motifs:
        for m in re.finditer(motif, txt, re.I):
            n = tofloat(m.group(1))
            if n is None:
                continue
            ech = m.group(2).lower()
            f = 1.0
            for mo, ff in ECHELLES:
                if re.fullmatch(mo.rstrip('$'), ech, re.I):
                    f = ff
                    break
            out.append((n * f, m.group(0).strip()))
            # "1,643M$" : la virgule peut etre un separateur de milliers a
            # l anglaise. On garde les deux lectures et on ne conclut au
            # perime que si aucune des deux ne colle.
            brut = m.group(1)
            if re.fullmatch(r'\d{1,3},\d{3}', brut.replace(' ', '')):
                autre = float(brut.replace(' ', '').replace(',', ''))
                out.append((autre * f, m.group(0).strip() + ' (lu a l anglaise)'))
    return out


rows = []
for t in sorted(ONLINE):
    p = os.path.join(D, t.lower() + '.json')
    if not os.path.exists(p):
        continue
    try:
        d = json.load(open(p))
    except Exception:
        continue
    for k in (d.get('kpis') or []):
        if not isinstance(k, dict):
            continue
        desc, val, unit = k.get('description'), k.get('value'), k.get('unit')
        if not (isinstance(desc, str) and isinstance(val, (int, float))):
            continue
        f = unite_en_millions(unit)
        if f is None:
            continue
        cible = abs(float(val)) * f
        if cible == 0:
            continue
        citees = sommes_citees(desc)
        if not citees:
            continue
        if any(0.85 <= n / cible <= 1.15 for n, _ in citees if n):
            continue
        rows.append({'ticker': t, 'short': k.get('short'), 'value': val, 'unit': unit,
                     'value_M': round(cible, 2), 'period': k.get('period_type'),
                     'cited': [c for _, c in citees],
                     'cited_M': [round(n, 2) for n, _ in citees],
                     'desc': desc[:300]})

print('SUSPECTS (sommes normalisees en millions):', len(rows))
json.dump(rows, open('/tmp/desc-suspects-large.json', 'w'), ensure_ascii=False, indent=1)
print(Counter(r['ticker'] for r in rows).most_common(20))
