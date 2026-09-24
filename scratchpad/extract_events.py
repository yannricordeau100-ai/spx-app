import os, re, gzip, json, html, glob, sys
from collections import defaultdict

TICKERS = "ABNB APD ATO AVB AVGO AVY AWK AXON AXP AZO BA BALL BAX BBY BDX BG BIIB BK BKNG BKR BLDR BMY BR BRO BXP".split()
DL = "/Users/yann/spx-app/data-lake"

# Item code → (category, FR title base, FR description base)
ITEM_MAP = {
    "1.01": ("financier", "Accord materiel signe", "Signature d'un accord materiel significatif."),
    "1.02": ("financier", "Fin d'un accord materiel", "Resiliation d'un accord materiel."),
    "2.01": ("acquisition", "Acquisition ou cession finalisee", "Finalisation d'une operation d'acquisition ou de cession d'actifs."),
    "2.03": ("financier", "Nouvelle obligation financiere", "Souscription d'une obligation financiere directe hors bilan."),
    "2.05": ("financier", "Plan de restructuration", "Engagement dans un plan de restructuration ou de sortie d'activite."),
    "3.02": ("financier", "Emission d'actions non enregistrees", "Vente de titres non enregistres."),
    "3.03": ("financier", "Modification des droits des porteurs", "Modification materielle des droits des porteurs de titres."),
    "5.02": ("dirigeant", "Changement de dirigeant", "Depart ou nomination d'un dirigeant ou administrateur."),
    "5.03": ("reglementaire", "Modification des statuts", "Amendement des statuts constitutifs ou reglement interieur."),
    "5.07": ("reglementaire", "Vote des actionnaires", "Resultats du vote lors d'une assemblee des actionnaires."),
    "8.01": ("financier", "Communique important", "Autre evenement materiel divulgue par la societe."),
}

TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')
ITEM = re.compile(r'Item\s+([1-9]\.\d\d)[\.\s]{0,3}([^.]{0,300})', re.I)

def parse_8k(path):
    try:
        with gzip.open(path,'rt',errors='ignore') as f:
            t = f.read()
    except:
        return []
    t = TAG.sub(' ', t)
    t = html.unescape(t)
    t = WS.sub(' ', t)
    items = []
    seen = set()
    for m in ITEM.finditer(t):
        code = m.group(1)
        desc = m.group(2).strip()
        if code in ITEM_MAP and code not in seen:
            seen.add(code)
            items.append((code, desc))
    return items

def priority(code):
    # Higher = more important
    p = {"2.01":10, "1.01":9, "5.02":8, "1.02":7, "2.05":6, "8.01":3, "3.02":4, "2.03":4, "3.03":3, "5.03":2, "5.07":1}
    return p.get(code, 0)

results = {}
for tk in TICKERS:
    d = f"{DL}/{tk}/8K"
    if not os.path.isdir(d):
        results[tk] = []
        continue
    files = sorted(glob.glob(f"{d}/{tk}_*.htm.gz"))
    events = []
    for fp in files:
        base = os.path.basename(fp)
        m = re.match(rf"{tk}_(\d{{4}}-\d{{2}}-\d{{2}})_(\S+)\.htm\.gz", base)
        if not m: continue
        date = m.group(1)
        acc = m.group(2)
        year = int(date[:4])
        if year < 2021: continue
        items = parse_8k(fp)
        if not items: continue
        # For each file, keep top item by priority
        items.sort(key=lambda x: -priority(x[0]))
        code, desc = items[0]
        if priority(code) < 2: continue  # skip trivial like 5.07 alone / no key items
        events.append({
            "date": date, "acc": acc, "code": code, "desc_raw": desc[:200]
        })
    results[tk] = events

out = "/Users/yann/spx-app/scratchpad/raw_events.json"
json.dump(results, open(out,'w'), indent=1)
for tk,e in results.items():
    print(f"{tk}: {len(e)} candidate 8-Ks")
