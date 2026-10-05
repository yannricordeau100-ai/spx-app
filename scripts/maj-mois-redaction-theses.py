#!/usr/bin/env python3
"""Fixe redigee_le de chaque these (src/data/these/*.json) entre le mois des
donnees (donnees_arretees_au) et octobre 2026. Deterministe (sha256 du ticker).
Regles : jamais avant le mois des donnees ni apres 2026-10 ; octobre reserve a
~12 % des theses dont les donnees sont de septembre ou octobre 2026 ;
sinon 1 a 2 mois apres les donnees, plafonne a septembre 2026.
Edition textuelle (mise en forme du JSON preservee). Usage : python3 scripts/maj-mois-redaction-theses.py [--dry]"""
import glob, hashlib, re, sys, collections, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DRY = "--dry" in sys.argv
def h(t, salt): return int(hashlib.sha256((salt + t).encode()).hexdigest(), 16) % 100
def idx(m): y, mo = map(int, m.split("-")); return y * 12 + mo - 1
def fmt(i): return f"{i // 12}-{i % 12 + 1:02d}"
OCT, SEP = idx("2026-10"), idx("2026-09")
cnt = collections.Counter(); changed = 0
for f in sorted(glob.glob(os.path.join(ROOT, "src/data/these/*.json"))):
    if os.path.basename(f) == "wkl.as.json": continue
    s = open(f, encoding="utf-8").read()
    mm = re.search(r'"redigee_le":\s*"(\d{4}-\d{2})"', s)
    md = re.search(r'"donnees_arretees_au":\s*"(\d{4}-\d{2})', s)
    if not mm or not md: continue
    t = os.path.basename(f)[:-5]; d = idx(md.group(1))
    if d >= SEP:
        r = OCT if h(t, "oct") < 12 else d + (0 if d == SEP else 0)
        r = max(min(r, OCT), d)
    else:
        r = min(d + 1 + (h(t, "off") < 45), SEP)
    new = fmt(r)
    cnt[new] += 1
    if new != mm.group(1):
        changed += 1
        if not DRY:
            s = s[:mm.start(1)] + new + s[mm.end(1):]
            open(f, "w", encoding="utf-8").write(s)
print("changees", changed, "repartition", dict(sorted(cnt.items())))
