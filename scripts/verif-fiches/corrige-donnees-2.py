#!/usr/bin/env python3
"""30 sept 2026, decisions A de Yann : (1) doublon annuel retire quand le trimestriel de meme nom couvre 5 ans ;
(3) signaux dates (citant une annee anterieure de 2 ans ou plus a la serie) regeneres depuis la serie."""
import json, re, os, sys, unicodedata
from collections import defaultdict, Counter
os.chdir('/Users/yann/spx-app')
S = '/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad'
ECRIT = '--ecrit' in sys.argv
exec(open(S + '/corrige-donnees.py').read().split('rapport = defaultdict(list)')[0].replace("ECRIT = '--ecrit' in sys.argv", "ECRIT = ECRIT").replace("MECA = json.load(open(S + '/detecteurs/mecanique.json'))", "MECA = json.load(open(S + '/detecteurs/mecanique-fiches2.json'))"))
stats = Counter(); rapport = defaultdict(list)

def fmt(v, unit):
    u = (unit or '').strip()
    if u == '%': return f"{v:,.1f}".replace(',', ' ').replace('.', ',') + ' %'
    dec = 0 if abs(v) >= 100 else (1 if abs(v) >= 10 else 2)
    s = f"{v:,.{dec}f}".replace(',', ' ').replace('.', ',')
    return s + (' ' + u if u else '')

def periode_fr(lab):
    if not lab: return ''
    s = str(lab).strip()
    m = re.match(r'^Q([1-4])[-\s]?(?:FY)?(\d{4})$', s, re.I)
    if m: return f"au T{m.group(1)} {m.group(2)}"
    m = re.match(r'^[HS]([12])[-\s]?(?:FY)?(\d{4})$', s, re.I)
    if m: return f"au S{m.group(1)} {m.group(2)}"
    m = re.match(r'^(?:FY)?(\d{4})$', s, re.I)
    if m: return f"en {m.group(1)}"
    return ''

# ---- (1) doublons annuel / trimestriel ----
for t, l in MECA.items():
    fiche = None
    for f in l:
        if f['code'] != 'K4d' or 'meme nom' not in f['detail']: continue
        import ast
        try: shorts = ast.literal_eval(f['detail'].split(': ', 1)[1])
        except Exception: stats['detail_illisible'] += 1; continue
        if len(shorts) != 2: rapport['doublon_autre'].append((t, shorts)); continue
        if fiche is None: fiche = json.load(open(S + f'/fiches2/{t}.json'))
        ks = {str(k.get('short')): k for k in fiche.get('kpis') or []}
        a, b = ks.get(shorts[0]), ks.get(shorts[1])
        if not a or not b: continue
        def est_annuel(k): return (k.get('period_type') or k.get('frequency') or '') in ('year', 'annual')
        def est_trim(k): return (k.get('period_type') or k.get('frequency') or '') in ('quarter', 'quarterly', 'semester', 'semiannual')
        ann = a if est_annuel(a) and est_trim(b) else (b if est_annuel(b) and est_trim(a) else None)
        if not ann: rapport['doublon_autre'].append((t, shorts)); continue
        trim = b if ann is a else a
        n = len([x for x in (trim.get('history') or []) if (x.get('v') if isinstance(x, dict) else x) is not None])
        par_an = 4 if (trim.get('period_type') or trim.get('frequency')) in ('quarter', 'quarterly') else 2
        if n < 5 * par_an: rapport['doublon_garde_trim_court'].append((t, ann.get('short'), trim.get('short'), n)); continue
        r = trouve(t, str(ann.get('short')))
        if not r: stats['introuvable'] += 1; continue
        fich, L, i, k = r
        rapport['doublon_annuel_retire'].append((t, ann.get('short'), ann.get('name_fr'), 'garde ' + str(trim.get('short'))))
        if ECRIT: L.pop(i); charge(fich)['modif'] = True
        stats['doublon_annuel_retire'] += 1

# ---- (3) signaux dates ----
for t, l in MECA.items():
    for f in l:
        if f['code'] != 'T8': continue
        short = f['champ'].split(' ', 1)[1].rsplit('.', 1)[0]
        r = trouve(t, short)
        if not r: stats['signal_introuvable'] += 1; continue
        fich, L, i, k = r
        h = k.get('history') or []
        vals = [(x.get('v') if isinstance(x, dict) else x) for x in h]
        labs = [x.get('q') if isinstance(x, dict) else None for x in h]
        hp = k.get('history_periods')
        if hp and len(hp) == len(vals): labs = [str(x) for x in hp]
        nums = [(v, lb) for v, lb in zip(vals, labs) if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if not nums: continue
        v, lb = nums[-1]
        anc = str(k.get('signal') or '')
        # seulement les signaux qui decrivent un etat perime (pas une narration « depuis 2018 »), et une periode connue
        if re.search(r"\b(depuis|apr[èe]s|[àa] partir de|entre|de \d{4} [àa]|jusqu|cumul|record|historique|plus haut|plus bas|pic|creux)\b", anc, re.I): rapport['signal_garde_narratif'].append((t, short)); continue
        if not periode_fr(lb): rapport['signal_garde_sans_periode'].append((t, short)); continue
        unit = k.get('unit') or ''
        pt = k.get('period_type') or k.get('frequency') or ''
        par_an = 4 if pt in ('quarter', 'quarterly') else (2 if pt in ('semester', 'semiannual') else 1)
        var = ''
        if len(nums) > par_an:
            p = nums[-1 - par_an][0]
            if unit.strip() == '%': var = f", {v - p:+.1f} pt sur un an".replace('.', ',')
            elif p and p > 0 and v > 0: var = f", {(v / p - 1) * 100:+.1f} % sur un an".replace('.', ',')
        signal = f"{fmt(v, unit)} {periode_fr(lb)}{var}.".replace('  ', ' ').strip()
        if not periode_fr(lb):
            ld = str(k.get('last_data_date') or '')[:4]
            signal = f"{fmt(v, unit)}" + (f" en {ld}" if ld else '') + f"{var}."
        rapport['signal_regenere'].append((t, short, (k.get('signal') or '')[:70], signal))
        if ECRIT: k['signal'] = signal; k['_signal_regenere_le'] = '2026-09-30'; charge(fich)['modif'] = True
        stats['signal_regenere'] += 1

if ECRIT:
    for f, c in cache.items():
        if not c['modif']: continue
        raw = c['raw']; ind = 2 if raw.startswith('{\n  "') else (1 if raw.startswith('{\n "') else None)
        open(f, 'w').write(json.dumps(c['d'], ensure_ascii=False, indent=ind) + ('\n' if raw.endswith('\n') else ''))
print(dict(stats), {k: len(v) for k, v in rapport.items()})
json.dump(rapport, open(S + '/detecteurs/corrections-donnees-2.json', 'w'), ensure_ascii=False, indent=1)
import random; random.seed(2)
for cat in rapport:
    print('==', cat)
    for x in random.sample(rapport[cat], min(8, len(rapport[cat]))): print('  ', x)
