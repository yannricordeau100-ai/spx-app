#!/usr/bin/env python3
"""Similarite perceptuelle (0 a 1) entre deux logos, rendus sur fond blanc, recadres sur le contenu."""
import sys
from PIL import Image, ImageChops
import imagehash
def prep(p):
    im = Image.open(p).convert("RGBA"); bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); im = Image.alpha_composite(bg, im).convert("RGB")
    diff = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))); box = diff.getbbox()
    return im.crop(box) if box else im
a, b = prep(sys.argv[1]), prep(sys.argv[2])
h = [imagehash.phash(a, 16), imagehash.phash(b, 16)]; c = [imagehash.colorhash(a), imagehash.colorhash(b)]
s1 = 1 - (h[0] - h[1]) / 256; s2 = 1 - (c[0] - c[1]) / 42
print(round(min(s1, s2), 3))
