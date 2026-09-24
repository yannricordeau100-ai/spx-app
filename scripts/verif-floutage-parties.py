#!/usr/bin/env python3
"""Controle statique : chaque partie declaree dans PARTIES_PAR_BLOC doit etre
emise (data-blur-part="...") au moins une fois dans src/components ou src/app."""
import re,glob,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(f'{ROOT}/src/lib/floutage.ts').read(); bloc=src[src.index('PARTIES_PAR_BLOC'):]
decl={m.group(1):[x.strip().strip('"') for x in m.group(2).split(',') if x.strip()] for m in re.finditer(r'^\s*"?([a-z_]+)"?: \[([^\]]*)\]',bloc,re.M)}
emis=set()
for f in glob.glob(f'{ROOT}/src/components/**/*.tsx',recursive=True)+glob.glob(f'{ROOT}/src/app/**/*.tsx',recursive=True):
    emis|=set(re.findall(r'data-blur-part="([a-z-]+)"',open(f).read()))
mortes=[(b,p) for b,ps in decl.items() for p in ps if p!='tout' and p not in emis]
print('parties declarees :',sum(len(v)-1 for v in decl.values()),'| emises quelque part :',len(emis))
print('parties JAMAIS emises :',mortes if mortes else 'aucune')
