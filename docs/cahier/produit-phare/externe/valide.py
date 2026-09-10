#!/usr/bin/env python3
"""Valide un p2-out/<T>.json : >=5 points, pas d estimation en bout, sources par annee, controle present, pas de tiret long."""
import json,sys,glob,os
S=os.path.dirname(os.path.abspath(__file__))
def valide(p):
    d=json.load(open(p)); pb=[]
    a={k:v for k,v in (d.get('annees') or {}).items() if v is not None}
    ans=sorted(a)
    if len(ans)<5: pb.append(f'{len(ans)} points')
    if any(not isinstance(a[x],(int,float)) for x in ans): pb.append('valeur non numerique')
    est=set(d.get('estime') or [])
    if ans and (ans[0] in est or ans[-1] in est): pb.append('estimation en bout de serie')
    for e in sorted(est):
        if str(int(e)+1) in est: pb.append('deux estimations consecutives')
    src=d.get('sources') or {}
    for x in ans:
        if x not in est and not (src.get(x) or {}).get('url'): pb.append(f'source manquante {x}')
    if not d.get('controle'): pb.append('pas de controle')
    if '—' in json.dumps(d,ensure_ascii=False): pb.append('tiret long')
    k=d.get('kpi') or {}
    for c in ('short','name_fr','name_en','unit'):
        if not k.get(c): pb.append(f'kpi.{c} manquant')
    return d.get('statut'),len(ans),pb
if __name__=='__main__':
    for p in (sys.argv[1:] or sorted(glob.glob(S+'/p2-out/*.json'))):
        try: s,n,pb=valide(p); print(os.path.basename(p),s,n,'OK' if not pb else pb)
        except Exception as e: print(os.path.basename(p),'ERREUR',e)
