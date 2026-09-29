#!/usr/bin/env python3
"""Corrections mecaniques des donnees KPI (29 sept 2026). Simulation par defaut, --ecrit pour appliquer.
  K1b : KPI trimestriel sans last_data_date -> date deduite du dernier libelle de periode.
  K14 : last_data_date dans le futur -> date des KPI freres de meme libelle, sinon fin d exercice fiscal connue.
  K5  : nom francais absent ou en anglais -> traduction (table fermee, ecrite a la main).
  K4d : doublon exact (memes 4 derniers points, noms quasi identiques) -> on retire la serie la plus courte.
Les KPI sont localises dans les couches servies : kpis-haut, v2-pipeline, v2-pipeline-enrich, kpi-annuel-fiche."""
import json, glob, re, sys, os, calendar, datetime, unicodedata
from collections import Counter, defaultdict
os.chdir('/Users/yann/spx-app')
ECRIT = '--ecrit' in sys.argv
S = '/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad'
TODAY = datetime.date(2026, 9, 29)
MECA = json.load(open(S + '/detecteurs/mecanique.json'))
FISCAL = json.load(open('src/data/fiscal-audit.json'))
NOMS_FR = json.load(open(S + '/noms-fr.json')) if os.path.exists(S + '/noms-fr.json') else {}

def norm(s): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower())

def fichiers_de(t):
    tl = t.lower()
    return [f for f in [f'.batches-drafts-safe/kpis-haut/{t}.json', f'src/data/v2-pipeline/{tl}.json', f'src/data/v2-pipeline-enrich/{tl}.json', f'src/data/v2-pipeline-specific-kpis/{tl}.json', f'src/data/kpi-annuel-fiche/{t}.json'] if os.path.exists(f)]

cache = {}
def charge(f):
    if f not in cache:
        raw = open(f).read(); cache[f] = {'raw': raw, 'd': json.loads(raw), 'modif': False}
    return cache[f]

def listes_kpi(d):
    """Toutes les listes de KPI d un fichier (kpis, kpis_supplementary, ...)."""
    out = []
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, list) and v and all(isinstance(x, dict) and 'short' in x for x in v): out.append(v)
                else: walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d); return out

def trouve(t, short):
    for f in fichiers_de(t):
        c = charge(f)
        for L in listes_kpi(c['d']):
            for i, k in enumerate(L):
                if str(k.get('short')) == short: return f, L, i, k
    return None

def fin_mois(y, m): return datetime.date(y, m, calendar.monthrange(y, m)[1])

KEYFACTS = {}
def mois_fiscal(t):
    fm = (FISCAL.get(t) or {}).get('fiscalYearEndMonth')
    if fm: return fm
    if t not in KEYFACTS:
        try:
            kf = json.load(open(S + f'/fiches/{t}.json')).get('key_facts') or {}
            e = kf.get('fiscal_year_end')
            KEYFACTS[t] = datetime.datetime.utcfromtimestamp(e).month if isinstance(e, (int, float)) and e > 0 else None
        except Exception: KEYFACTS[t] = None
    return KEYFACTS[t]
def derniere_fin(t, pas, marge_jours):
    """Derniere fin de periode fiscale (pas = 12 annuel, 3 trimestriel, 6 semestriel) au plus tard a TODAY - marge."""
    fm = mois_fiscal(t) or 12
    lim = TODAY - datetime.timedelta(days=marge_jours)
    mois = sorted(set(((fm - 1 - k * pas) % 12) + 1 for k in range(12 // pas)))
    cands = [fin_mois(y, m) for y in (lim.year, lim.year - 1) for m in mois]
    cands = [c for c in cands if c <= lim]
    return max(cands) if cands else None
def date_depuis_label(t, label):
    """'Q2-2026', 'Q2-FY2026', 'FY2026', '2026', 'H1-2026', 'S1 2026' -> date de fin de periode (calendaire ou fiscale)."""
    fm = mois_fiscal(t)
    s = str(label).strip().upper().replace(' ', '-')
    m = re.match(r'^Q([1-4])-?(?:FY)?(\d{4})$', s)
    if m:
        q, y = int(m.group(1)), int(m.group(2))
        if 'FY' in s or (fm and fm != 12):
            if not fm: return None
            mois = (fm - 12 + 3 * q) % 12 or 12
            yy = y if mois <= fm else y - 1
            return fin_mois(yy, mois)
        return fin_mois(y, 3 * q)
    m = re.match(r'^(?:FY)?(\d{4})$', s)
    if m:
        y = int(m.group(1))
        if fm and fm != 12: return fin_mois(y, fm)
        return fin_mois(y, 12)
    m = re.match(r'^[HS]([12])-?(?:FY)?(\d{4})$', s)
    if m:
        h, y = int(m.group(1)), int(m.group(2))
        if fm and fm != 12: return None
        return fin_mois(y, 6 * h)
    return None

rapport = defaultdict(list)
stats = Counter()

# ---- K1b ----
for t, l in MECA.items():
    for f in l:
        if f['code'] != 'K1b': continue
        short = f['champ'].split(' ', 1)[1]
        r = trouve(t, short)
        if not r: stats['K1b_introuvable'] += 1; continue
        fich, L, i, k = r
        h = k.get('history') or []
        lab = h[-1].get('q') if h and isinstance(h[-1], dict) else ((k.get('history_periods') or [None])[-1])
        d = date_depuis_label(t, lab) if lab else None
        if not d or d > TODAY: stats['K1b_sans_date'] += 1; rapport['K1b_non_corrige'].append((t, short, lab)); continue
        rapport['K1b'].append((t, short, lab, d.isoformat()))
        if ECRIT: k['last_data_date'] = d.isoformat(); charge(fich)['modif'] = True
        stats['K1b'] += 1

# ---- K14 ----
for t, l in MECA.items():
    futurs = [f for f in l if f['code'] == 'K14']
    if not futurs: continue
    fiche = json.load(open(S + f'/fiches/{t}.json'))
    # dates saines des KPI freres, par libelle de derniere periode
    saines = defaultdict(Counter)
    for k in fiche.get('kpis') or []:
        ld = str(k.get('last_data_date') or '')[:10]
        h = k.get('history') or []
        lab = h[-1].get('q') if h and isinstance(h[-1], dict) else ((k.get('history_periods') or [None])[-1])
        if lab and re.match(r'\d{4}-\d{2}-\d{2}$', ld) and ld <= TODAY.isoformat(): saines[str(lab).upper()][ld] += 1
    for f in futurs:
        short = f['champ'].split(' ', 1)[1]
        r = trouve(t, short)
        if not r: stats['K14_introuvable'] += 1; continue
        fich, L, i, k = r
        h = k.get('history') or []
        lab = h[-1].get('q') if h and isinstance(h[-1], dict) else ((k.get('history_periods') or [None])[-1])
        d = None
        if lab and saines.get(str(lab).upper()): d = saines[str(lab).upper()].most_common(1)[0][0]
        if not d and lab:
            dd = date_depuis_label(t, lab)
            if dd and dd <= TODAY: d = dd.isoformat()
        inferee = False
        if not d and not lab:
            pt = k.get('period_type') or k.get('frequency')
            pas = 3 if pt in ('quarter', 'quarterly') else (6 if pt in ('semester', 'semiannual') else 12)
            dd = derniere_fin(t, pas, 45 if pas == 3 else 30)
            if dd: d = dd.isoformat(); inferee = True
        if not d: stats['K14_non_corrige'] += 1; rapport['K14_non_corrige'].append((t, short, lab, k.get('last_data_date'))); continue
        rapport['K14_inferee' if inferee else 'K14'].append((t, short, lab, k.get('last_data_date'), d))
        if ECRIT:
            k['last_data_date'] = d; charge(fich)['modif'] = True
            if inferee: k['_date_inferee'] = '2026-09-29'
        stats['K14_inferee' if inferee else 'K14'] += 1

# ---- K5 ----
for t, l in MECA.items():
    for f in l:
        if f['code'] != 'K5': continue
        short = f['champ'].split(' ', 1)[1]
        r = trouve(t, short)
        if not r: stats['K5_introuvable'] += 1; continue
        fich, L, i, k = r
        nf = str(k.get('name_fr') or '')
        cle = f'{t}|{short}'
        if cle in NOMS_FR:
            rapport['K5'].append((t, short, nf, NOMS_FR[cle]))
            if ECRIT: k['name_fr'] = NOMS_FR[cle]; charge(fich)['modif'] = True
            stats['K5'] += 1
        else:
            rapport['K5_a_traduire'].append((t, short, nf, k.get('name_en'), k.get('unit')))

# ---- K5 : KPI codes sans unite (SOON.SW, LI.PA) a retirer ----
for t, short in [('SOON.SW', 'MS_Gain_H2'), ('SOON.SW', 'CEO_Transition'), ('SOON.SW', 'Product_Launch'), ('SOON.SW', 'H1_Growth'), ('SOON.SW', 'Org_Changes'), ('LI.PA', 'market_share_gains'), ('LI.PA', 'accretive_acquisitions')]:
    r = trouve(t, short)
    if not r: continue
    fich, L, i, k = r
    rapport['K5_retires'].append((t, short, k.get('name_fr'), k.get('unit'), len(k.get('history') or [])))
    if ECRIT: L.pop(i); charge(fich)['modif'] = True
    stats['K5_retires'] += 1

# ---- K4d exact ----
def similaires(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb: return False
    if na == nb or na in nb or nb in na: return True
    # distance simple : memes 6 premiers caracteres et longueur proche
    return na[:6] == nb[:6] and abs(len(na) - len(nb)) <= 3
for t, l in MECA.items():
    fiche = None
    for f in l:
        if f['code'] != 'K4d' or 'memes 4 derniers points' not in f['detail']: continue
        shorts = json.loads(f['detail'].split(': ', 1)[1].replace("'", '"'))
        if fiche is None: fiche = json.load(open(S + f'/fiches/{t}.json'))
        ks = {str(k.get('short')): k for k in fiche.get('kpis') or []}
        a, b = ks.get(shorts[0]), ks.get(shorts[1])
        if not a or not b: continue
        if not similaires(a.get('name_fr'), b.get('name_fr')) and not similaires(a.get('name_en'), b.get('name_en')) and not similaires(a.get('name_fr'), b.get('name_en')):
            rapport['K4d_a_trancher'].append((t, shorts, a.get('name_fr'), b.get('name_fr'))); continue
        la, lb = len(a.get('history') or []), len(b.get('history') or [])
        perdant = a if la < lb else (b if lb < la else (b if str(b.get('short', '')).isupper() or '_' in str(b.get('short', '')) else a))
        r = trouve(t, str(perdant.get('short')))
        if not r: stats['K4d_introuvable'] += 1; continue
        fich, L, i, k = r
        rapport['K4d'].append((t, perdant.get('short'), 'garde ' + str((a if perdant is b else b).get('short')), perdant.get('name_fr')))
        if ECRIT: L.pop(i); charge(fich)['modif'] = True; cache.pop  # index change : une seule suppression par fichier suffit ici
        stats['K4d'] += 1

if ECRIT:
    for f, c in cache.items():
        if not c['modif']: continue
        raw = c['raw']
        ind = 2 if raw.startswith('{\n  "') else (1 if raw.startswith('{\n "') else None)
        open(f, 'w').write(json.dumps(c['d'], ensure_ascii=False, indent=ind) + ('\n' if raw.endswith('\n') else ''))
print(dict(stats))
json.dump(rapport, open(S + '/detecteurs/corrections-donnees.json', 'w'), ensure_ascii=False, indent=1)
for cat in ('K1b', 'K1b_non_corrige', 'K14', 'K14_inferee', 'K14_non_corrige', 'K5', 'K5_a_traduire', 'K5_retires', 'K4d', 'K4d_a_trancher'):
    l = rapport.get(cat, []); print(f'\n== {cat} ({len(l)})')
    for x in l[:12]: print('  ', x)
