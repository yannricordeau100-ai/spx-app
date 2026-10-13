#!/usr/bin/env python3
"""Planches contact (30 rendus de tuile par planche, 1600 px). Usage: planches.py liste.json dossier_sortie prefixe [dossier_logos]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
R='/Users/yann/spx-app'
lst=json.load(open(sys.argv[1])); out=sys.argv[2]; pre=sys.argv[3]; LOGOS=sys.argv[4] if len(sys.argv)>4 else R+'/public/logos'
light=set(t.upper() for t in json.load(open(R+'/src/data/light-bg-tickers.json')))
os.makedirs(out,exist_ok=True)
T=200; CW=266; CH=T+34; COLS=6
font=ImageFont.load_default(size=16)
def tile(t):
    p=f"{LOGOS}/{t.upper().replace('.','-')}.png"
    lb=t.upper().replace('.','-') in light or t.upper() in light
    lb = lb or os.environ.get('FORCE_LIGHT')=='1'
    bg=(255,255,255) if lb else (10,10,10)
    im=Image.new('RGB',(T,T),bg)
    try:
        g=Image.open(p).convert('RGBA'); s=min(T/g.width,T/g.height)
        g=g.resize((max(1,round(g.width*s)),max(1,round(g.height*s))),Image.LANCZOS)
        im.paste(g,((T-g.width)//2,(T-g.height)//2),g)
    except Exception: pass
    m=Image.new('L',(T,T),0); ImageDraw.Draw(m).rounded_rectangle((0,0,T-1,T-1),radius=int(T*12/64),fill=255)
    base=Image.new('RGB',(T,T),(60,60,60)); base.paste(im,(0,0),m); return base
n=0
for i in range(0,len(lst),30):
    chunk=lst[i:i+30]; rows=(len(chunk)+COLS-1)//COLS
    sh=Image.new('RGB',(COLS*CW,rows*CH),(40,40,40)); d=ImageDraw.Draw(sh)
    for j,it in enumerate(chunk):
        t=it if isinstance(it,str) else it['ticker']; x=(j%COLS)*CW+33; y=(j//COLS)*CH+4
        sh.paste(tile(t),(x,y)); d.text((x,y+T+4),t,fill=(255,255,255),font=font)
    sh=sh.resize((1600,round(sh.height*1600/sh.width)),Image.LANCZOS) if sh.width>1600 else sh
    f=f'{out}/{pre}{n+1:02d}.png'; sh.save(f,optimize=True); n+=1
print(n,'planches')
