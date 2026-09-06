#!/usr/bin/env python3
"""Etat des lots TAM. Usage : _prochains.py [--prochains N]"""
import json,glob,os,sys
D=os.path.dirname(os.path.abspath(__file__)); L=os.path.join(D,'..','donnees','_lots')
ordre=['45','20','40','35','25','30','15','55','60','50','10','99']
lots=sorted(glob.glob(os.path.join(L,'*.json')),key=lambda f:(ordre.index(os.path.basename(f)[:2]) if os.path.basename(f)[:2] in ordre else 99,f))
n=int(sys.argv[sys.argv.index('--prochains')+1]) if '--prochains' in sys.argv else 6
faits=0;tot=0;restes=[]
for f in lots:
    t=[x['ticker'] for x in json.load(open(f))]; tot+=len(t)
    r=[x for x in t if not os.path.exists(os.path.join(D,f'{x}.json'))]
    faits+=len(t)-len(r)
    if r: restes.append((os.path.basename(f)[:-5],r))
print(f'TAM : societes faites {faits} / {tot} | lots restants {len(restes)}')
for name,r in restes[:n]: print('LOT',name,'restants',r)
