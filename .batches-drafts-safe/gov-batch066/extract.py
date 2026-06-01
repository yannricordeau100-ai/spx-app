#!/usr/bin/env python3
"""Extract DEF14A HTML -> plain text for batch066."""
import gzip, sys, os, re
from bs4 import BeautifulSoup

FILES = {
    'WMT': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WMT_2026-04-23.htm.gz',
    'WRB': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WRB_2026-04-22.htm.gz',
    'WSM': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2025/WSM_2025-04-29.htm.gz',
    'WST': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WST_2026-03-12.htm.gz',
    'WTW': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WTW_2026-03-27.htm.gz',
    'WWD': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2025/WWD_2025-12-12.htm.gz',
    'WY':  '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WY_2026-04-01.htm.gz',
    'WYNN':'/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/WYNN_2026-03-25.htm.gz',
    'XEL': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/XEL_2026-04-07.htm.gz',
    'XOM': '/Users/yann/Mettrik/sec-data/cat1-us/DEF14A/2026/XOM_2026-04-08.htm.gz',
}
OUT='/tmp/gov-batch066/extracted'
os.makedirs(OUT, exist_ok=True)

for tk,path in FILES.items():
    with gzip.open(path,'rb') as f:
        html=f.read().decode('utf-8','ignore')
    soup=BeautifulSoup(html,'html.parser')
    txt=soup.get_text(' ',strip=True)
    txt=re.sub(r'\s+',' ',txt)
    with open(f'{OUT}/{tk}.txt','w') as g:
        g.write(txt)
    print(f'{tk}: {len(txt)} chars')
