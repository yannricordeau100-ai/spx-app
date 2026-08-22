"""Verification d'un lot apres passage agent : diff avant/apres par fiche,
controles mecaniques (JSON valide, tirets cadratins, chiffres nouveaux presents
dans les sources data-lake), sortie JSON compacte."""
import json, sys, os, re, glob, gzip, subprocess
lot = sys.argv[1]            # ex res-lot1.json ou id-lot3.json
mode = 'res' if lot.startswith('res') else 'id'
d = json.load(open(f'.conv-state/att-lots/{lot}'))
out = {}
def load_src_text(T):
    """Concatene les textes du data-lake (txt, json, txt.gz) en memoire, borne a 40 Mo."""
    buf = []; size = 0
    for p in glob.glob(f'data-lake/{T}/**/*', recursive=True):
        if size > 40_000_000: break
        try:
            if p.endswith('.gz'):
                with gzip.open(p, 'rt', encoding='utf-8', errors='ignore') as f: s = f.read(3_000_000)
            elif p.endswith(('.txt', '.json', '.htm', '.html', '.md')):
                s = open(p, encoding='utf-8', errors='ignore').read(3_000_000)
            else: continue
        except Exception: continue
        s = re.sub(r'<[^>]+>', ' ', s)
        buf.append(s); size += len(s)
    return ' '.join(buf)
for t in d:
    T = t.upper()
    r = {}
    after_p = f'src/data/att/{t}.json'; before_p = f'.conv-state/att-lots/before/{t}.json'
    try:
        after = json.load(open(after_p)); r['json'] = 'ok'
    except Exception as e:
        out[t] = {'json': f'INVALIDE {e}'}; continue
    before = json.load(open(before_p)) if os.path.exists(before_p) else {}
    a_txt = json.dumps(after, ensure_ascii=False); b_txt = json.dumps(before, ensure_ascii=False)
    r['change'] = a_txt != b_txt
    r['tirets'] = a_txt.count('—') + a_txt.count('–')
    # chiffres presents apres et absents avant -> a sonder dans les sources
    nums_a = set(re.findall(r'\d[\d\s ,.]*\d', a_txt)); nums_b = set(re.findall(r'\d[\d\s ,.]*\d', b_txt))
    new_nums = [n for n in (nums_a - nums_b) if len(re.sub(r'\D', '', n)) >= 3]
    r['chiffres_nouveaux'] = len(new_nums)
    if new_nums and mode == 'res':
        src = load_src_text(T)
        def norm(x): return re.sub(r'[\s ]', '', x)
        src_n = re.sub(r'[\s ]', '', src)
        miss = [n for n in new_nums if norm(n) not in src_n and norm(n).replace(',', '.') not in src_n and norm(n).replace('.', ',') not in src_n]
        r['chiffres_non_sources'] = miss[:8]
    if mode == 'id':
        codes = [c for e in d[t] for c in e.get('codes', [])]
        r['codes_restants'] = [c for c in codes if re.search(r'(?<![A-Za-z0-9_])' + re.escape(c) + r'(?![A-Za-z0-9_])', a_txt)]
        # les chiffres ne doivent PAS changer en mode identifiants
        r['chiffres_perdus'] = len([n for n in nums_b if len(re.sub(r'\D','',n))>=3 and n not in nums_a])
    out[t] = r
print(json.dumps(out, ensure_ascii=False))
