#!/usr/bin/env python3
"""Mesure du cadrage des logos dans la tuile d en-tete (60/64 px, contain, fond #0a0a0a ou blanc).
Usage: logos-cadrage-mesure.py [dossier_logos] -> JSON dans le dossier temporaire passe en 2e arg."""
import json, sys, os
import numpy as np
from PIL import Image
R = '/Users/yann/spx-app'
LOGOS = sys.argv[1] if len(sys.argv) > 1 else R + '/public/logos'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/logos-mesure.json'
F = 256  # tuile simulee (4x 64 px)
light = set(t.upper() for t in json.load(open(R + '/src/data/light-bg-tickers.json')))
u = json.load(open(R + '/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
r = json.load(open(R + '/src/data/univers-sp5001000.json'))['tickers']
tick = {}
for t in u: tick[t] = 'main'
for t in r: tick.setdefault(t, 'r1000')

def fname(t): return t.upper().replace('.', '-')

def mesure(t):
    p = f'{LOGOS}/{fname(t)}.png'
    if not os.path.exists(p): return {'ticker': t, 'absent': True}
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    s = min(F / w, F / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    im2 = im.resize((nw, nh), Image.LANCZOS)
    ox, oy = (F - nw) // 2, (F - nh) // 2
    lb = fname(t) in light or t.upper() in light
    bg = np.array([255, 255, 255] if lb else [10, 10, 10], float)
    a = np.array(im2).astype(float)
    alpha = a[..., 3] / 255
    rgb = a[..., :3]
    # fond propre du logo : coins opaques et proches -> c est lui le fond
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    own = None
    if (corners[:, 3] > 240).all() and corners[:, :3].std(axis=0).max() < 12:
        own = corners[:, :3].mean(axis=0)
    ref = own if own is not None else bg
    diff = np.abs(rgb - ref).max(axis=2)
    transp = alpha.min() < 0.9
    mask = (alpha > 0.15) if (own is None and transp) else ((alpha > 0.15) & (diff > 40))
    full = np.zeros((F, F), bool)
    full[oy:oy + nh, ox:ox + nw] = mask
    n = full.sum()
    if n < 5: return {'ticker': t, 'vide': True, 'fond_propre': own is not None}
    ys, xs = np.where(full)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    marg = min(x0, y0, F - 1 - x1, F - 1 - y1) / F
    yy, xx = np.mgrid[0:F, 0:F]
    Rr = 48  # rounded-xl = 12 px sur 64 -> 48 sur 256
    cx0 = np.clip(xx, Rr, F - 1 - Rr); cy0 = np.clip(yy, Rr, F - 1 - Rr)
    dehors = (xx - cx0) ** 2 + (yy - cy0) ** 2 > (Rr - 2) ** 2
    cut = int((full & dehors).sum() + full[:2, :].sum() + full[-2:, :].sum() + full[:, :2].sum() + full[:, -2:].sum())
    area = max(x1 - x0 + 1, y1 - y0 + 1) / F  # plus grande dimension / cadre
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    off = max(abs(cx - F / 2), abs(cy - F / 2)) / F
    # contenu invisible : luminance du contenu proche du fond de la tuile (seulement si fond propre absent)
    lum = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
    L = lum(rgb)[mask[:] ]
    # luminance rendue (compose sur la tuile)
    comp = rgb * alpha[..., None] + bg * (1 - alpha[..., None])
    Lr = lum(comp)[mask]
    invis = own is None and abs(float(np.median(Lr)) - float(lum(bg))) < 70
    # bandes : fond propre different de la tuile et image non carree
    bande = own is not None and (nw != nh) and abs(float(lum(own)) - float(lum(bg))) > 60
    return {'ticker': t, 'univers': tick[t], 'size': [w, h], 'marge': round(marg, 3),
            'coupe': cut, 'aire': round(area, 3), 'decal': round(off, 3), 'invisible': bool(invis),
            'bandes': bool(bande), 'fond_propre': own is not None, 'lightbg': lb}

res = [mesure(t) for t in sorted(tick)]
json.dump(res, open(OUT, 'w'))
ok = [x for x in res if 'marge' in x]
print(len(res), 'absents', sum(1 for x in res if x.get('absent')), 'vides', sum(1 for x in res if x.get('vide')))
def susp(x): return x['marge'] < 0.03 or x['coupe'] > 0 or x['aire'] < 0.45 or x['aire'] > 0.82 or x['decal'] > 0.10 or x['invisible'] or x['bandes']
print('suspects', sum(1 for x in ok if susp(x)))
for k, f in [('marge<3%', lambda x: x['marge'] < .03), ('coupe', lambda x: x['coupe'] > 0), ('trop petit<45%', lambda x: x['aire'] < .45), ('trop grand>82%', lambda x: x['aire'] > .82), ('decal>10%', lambda x: x['decal'] > .1), ('invisible', lambda x: x['invisible']), ('bandes', lambda x: x['bandes'])]:
    print(k, sum(1 for x in ok if f(x)))
print([x for x in res if x['ticker'] == 'ASML'])
