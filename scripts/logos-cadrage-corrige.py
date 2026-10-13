#!/usr/bin/env python3
"""Recadre les logos mal cadres : contenu centre, plus grande dimension = CIBLE du carre.
Sauvegarde l original dans data-lake/_logos-sauvegarde-13oct/ avant toute ecriture.
Usage: logos-cadrage-corrige.py mesure.json [--apply]"""
import json, sys, os, shutil
import numpy as np
from PIL import Image
R='/Users/yann/spx-app'; L=R+'/public/logos'; SAV=R+'/data-lake/_logos-sauvegarde-13oct'
CIBLE=0.76
res=json.load(open(sys.argv[1])); apply='--apply' in sys.argv
os.makedirs(SAV,exist_ok=True)
done=[];skip=[]
for x in res:
    if 'marge' not in x: continue
    flag = x['coupe']>0 or x['marge']<.03 or x['aire']<.45 or x['aire']>.84 or x['decal']>.1 or x['bandes']
    if not flag: continue
    f=x['ticker'].upper().replace('.','-')+'.png'; p=f'{L}/{f}'
    im=Image.open(p).convert('RGBA'); a=np.array(im).astype(float)
    c=np.array([a[0,0],a[0,-1],a[-1,0],a[-1,-1]])
    own=None
    if (c[:,3]>240).all() and c[:,:3].std(axis=0).max()<12: own=c[:,:3].mean(axis=0)
    if own is None and a[...,3].min()>=230:
        skip.append((x['ticker'],'fond degrade plein cadre')); continue
    if own is None: mask=a[...,3]>38
    else: mask=(np.abs(a[...,:3]-own).max(axis=2)>40)&(a[...,3]>38)
    if mask.sum()<5: skip.append((x['ticker'],'vide')); continue
    ys,xs=np.where(mask); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
    bw,bh=x1-x0+1,y1-y0+1; m=max(bw,bh)
    S=int(round(m/CIBLE)); sc=1.0
    if S>512: sc=512/S; S=512
    cx,cy=(x0+x1+1)/2,(y0+y1+1)/2
    fill=(tuple(int(round(v)) for v in own)+(255,)) if own is not None else (0,0,0,0)
    # recadrage a l echelle d origine puis reduction eventuelle
    So=int(round(m/CIBLE))
    can=Image.new('RGBA',(So,So),fill)
    can.paste(im,(int(round(So/2-cx)),int(round(So/2-cy))))
    if own is not None:
        # remplir aussi les zones hors image par la couleur propre (deja fait), ok
        pass
    if sc<1: can=can.resize((S,S),Image.LANCZOS)
    done.append(x['ticker'])
    if apply:
        if not os.path.exists(f'{SAV}/{f}'): shutil.copy2(p,f'{SAV}/{f}')
        can.save(p,optimize=True)
print(len(done),'recadres',len(skip),'ignores'); print(skip)
json.dump(done,open('/tmp/logos-corriges.json','w')); json.dump(skip,open('/tmp/logos-ignores.json','w'))
