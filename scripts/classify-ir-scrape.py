#!/usr/bin/env python3
"""Classe par CONTENU (1eres pages) les PDF/htm opaques d'ir-scrape et les
range dans ~/Mettrik/docs/<TICKER>/<TYPE>/. Parallele, sans LLM."""
import os, glob, re, subprocess, json
from multiprocessing import Pool
from collections import defaultdict

HOME = os.path.expanduser('~')
SEC = f'{HOME}/Mettrik/sec-data'
OUT = f'{HOME}/Mettrik/docs'
PDFTOTEXT = '/opt/homebrew/bin/pdftotext'

def first_text(f):
    try:
        if f.lower().endswith('.pdf'):
            r = subprocess.run([PDFTOTEXT, '-l', '2', '-q', f, '-'], capture_output=True, timeout=25)
            return r.stdout.decode('utf-8', 'ignore')[:8000]
        return open(f, 'r', errors='ignore').read()[:8000]
    except Exception:
        return ''

def classify(t):
    tl = t.lower()
    if re.search(r'form\s*10-q|quarterly report pursuant', tl): return '10-Q'
    if re.search(r'form\s*10-k|annual report pursuant to section 13', tl): return '10-K'
    if re.search(r'form\s*8-k|current report pursuant', tl): return '8-K'
    if re.search(r'form\s*20-f', tl): return '20-F'
    if re.search(r'def(initive)?\s*14a|proxy statement|notice of\b.{0,40}annual meeting', tl): return 'DEF14A'
    if re.search(r'(earnings|results|quarterly).{0,30}(presentation|slides|deck)|investor presentation|earnings call presentation', tl): return 'ES'
    if re.search(r'(earnings|financial results).{0,30}(press release|release)|reports? (first|second|third|fourth|q[1-4]).{0,20}quarter|announces.{0,30}(results|earnings)', tl): return 'ER'
    if re.search(r'(earnings call|conference call).{0,20}transcript|prepared remarks', tl): return 'transcript'
    if re.search(r'sustainability report|esg report|environmental,? social', tl): return 'ESG'
    if re.search(r'investor day|capital markets day|analyst day', tl): return 'investor-day'
    if re.search(r'(financial )?supplement(al)?\b', tl): return 'supplement'
    if re.search(r'10-?q', tl): return '10-Q'
    if re.search(r'10-?k', tl): return '10-K'
    return 'autre'

def work(args):
    tk, f = args
    return tk, f, classify(first_text(f))

if __name__ == '__main__':
    tasks = []
    for d in glob.glob(f'{SEC}/ir-scrape/*/'):
        tk = os.path.basename(d.rstrip('/')).upper()
        for f in glob.glob(d + '**/*', recursive=True):
            if os.path.isfile(f) and f.lower().endswith(('.pdf', '.htm', '.html')):
                tasks.append((tk, f))
    print('a classer :', len(tasks), flush=True)
    res = []
    with Pool(4) as p:
        for i, r in enumerate(p.imap_unordered(work, tasks, chunksize=25)):
            res.append(r)
            if i % 3000 == 0:
                print(i, '/', len(tasks), flush=True)
    cnt = defaultdict(int); man = defaultdict(lambda: defaultdict(int))
    for tk, f, ty in res:
        cnt[ty] += 1; man[tk][ty] += 1
        sd = f'{OUT}/{tk}/{ty}'; os.makedirs(sd, exist_ok=True)
        ln = f'{sd}/{os.path.basename(f)}'
        if not os.path.lexists(ln):
            try: os.symlink(f, ln)
            except Exception: pass
    json.dump({tk: dict(tys) for tk, tys in man.items()},
              open(f'{OUT}/ir-scrape-classified.json', 'w'), indent=1, ensure_ascii=False, sort_keys=True)
    # combien de stes ont au moins 1 ER / ES apres classification
    es_stes = sum(1 for tys in man.values() if tys.get('ES'))
    er_stes = sum(1 for tys in man.values() if tys.get('ER'))
    print('=== classes par type ===', flush=True)
    for ty, n in sorted(cnt.items(), key=lambda x: -x[1]):
        print(f'  {ty:14} {n}', flush=True)
    print(f'=== stes ir-scrape avec >=1 ER : {er_stes} | avec >=1 ES : {es_stes} ===', flush=True)
