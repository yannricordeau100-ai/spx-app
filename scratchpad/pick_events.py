import os, re, gzip, json, html, glob
from collections import defaultdict

TICKERS = "ABNB APD ATO AVB AVGO AVY AWK AXON AXP AZO BA BALL BAX BBY BDX BG BIIB BK BKNG BKR BLDR BMY BR BRO BXP".split()
DL = "/Users/yann/spx-app/data-lake"

TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')
ITEM = re.compile(r'Item\s+([1-9]\.\d\d)[\.\s]{0,3}([^.\n]{0,200})', re.I)

ITEM_META = {
    "1.01": ("financier", "Accord materiel signe"),
    "1.02": ("financier", "Resiliation d'un accord materiel"),
    "2.01": ("acquisition", "Acquisition ou cession finalisee"),
    "2.03": ("financier", "Nouvelle obligation financiere"),
    "2.05": ("financier", "Plan de restructuration engage"),
    "3.02": ("financier", "Emission d'actions non enregistrees"),
    "3.03": ("financier", "Modification des droits des porteurs"),
    "5.02": ("dirigeant", "Changement de dirigeant"),
    "5.03": ("reglementaire", "Modification des statuts"),
    "5.07": ("reglementaire", "Vote des actionnaires"),
    "8.01": ("financier", "Autre communique important"),
}

def priority(code):
    p = {"2.01":10, "1.01":9, "5.02":8, "1.02":7, "2.05":6, "3.02":4, "2.03":4, "3.03":3, "8.01":3, "5.03":2, "5.07":1}
    return p.get(code, 0)

def extract_item_context(text, code):
    # Find first occurrence of "Item <code>" then take next ~400 chars for context
    idx = re.search(rf'Item\s+{re.escape(code)}[\.\s]', text, re.I)
    if not idx: return ""
    start = idx.end()
    chunk = text[start:start+500]
    # Truncate at "Item X.XX" or "Signature" or "SIGNATURES"
    stop = re.search(r'Item\s+\d\.\d\d|SIGNATURES|Pursuant to', chunk)
    if stop: chunk = chunk[:stop.start()]
    return chunk.strip()

def parse_file(path):
    try:
        with gzip.open(path,'rt',errors='ignore') as f:
            t = f.read()
    except:
        return None, []
    txt = TAG.sub(' ', t)
    txt = html.unescape(txt)
    txt = WS.sub(' ', txt)
    items = []
    seen = set()
    for m in ITEM.finditer(txt):
        code = m.group(1)
        if code in ITEM_META and code not in seen:
            seen.add(code)
            items.append(code)
    return txt, items

def build_desc_1_01(context):
    # Look for keywords: acquisition, merger, credit agreement, indenture, purchase agreement
    kws = {
        "credit agreement": "Signature d'un nouvel accord de credit.",
        "merger agreement": "Signature d'un accord de fusion.",
        "purchase agreement": "Signature d'un accord d'achat d'actifs ou de titres.",
        "indenture": "Emission d'obligations dans le cadre d'un indenture.",
        "underwriting agreement": "Signature d'un accord de placement de titres.",
        "settlement agreement": "Signature d'un accord de reglement.",
        "supply agreement": "Signature d'un accord d'approvisionnement.",
    }
    lc = context.lower()
    for k,v in kws.items():
        if k in lc: return v
    return "Signature d'un accord materiel significatif divulgue par la societe."

def build_desc_2_01(context):
    lc = context.lower()
    if "acquisition" in lc or "acquired" in lc:
        return "Finalisation d'une acquisition strategique."
    if "disposition" in lc or "divestiture" in lc or "sold" in lc:
        return "Finalisation d'une cession d'actifs."
    return "Finalisation d'une operation d'acquisition ou de cession."

def build_desc_5_02(context):
    lc = context.lower()
    if "chief executive officer" in lc or "ceo" in lc:
        if "retire" in lc or "resign" in lc or "step down" in lc:
            return "Depart annonce du directeur general (CEO)."
        if "appoint" in lc or "elected" in lc or "named" in lc:
            return "Nomination d'un nouveau directeur general (CEO)."
        return "Changement dans la direction generale."
    if "chief financial officer" in lc or "cfo" in lc:
        return "Changement au poste de directeur financier (CFO)."
    if "director" in lc and ("resign" in lc or "retire" in lc or "elected" in lc or "appoint" in lc):
        return "Changement au sein du conseil d'administration."
    return "Changement au sein de la direction ou du conseil d'administration."

def build_title_desc(code, ctx):
    cat, base_title = ITEM_META[code]
    if code == "1.01":
        return base_title, build_desc_1_01(ctx), cat
    if code == "2.01":
        return "Acquisition ou cession finalisee", build_desc_2_01(ctx), cat
    if code == "5.02":
        return "Changement de dirigeant", build_desc_5_02(ctx), cat
    if code == "1.02":
        return "Resiliation d'un accord materiel", "Fin d'un accord materiel important pour la societe.", cat
    if code == "2.05":
        return "Plan de restructuration", "Engagement dans un plan de restructuration ou de sortie d'activite.", cat
    if code == "3.02":
        return "Emission d'actions", "Emission d'actions non enregistrees (private placement ou similar).", cat
    if code == "2.03":
        return "Nouvelle obligation financiere", "Souscription d'une nouvelle obligation financiere materielle.", cat
    if code == "3.03":
        return "Droits des porteurs modifies", "Modification materielle des droits des porteurs de titres.", cat
    if code == "8.01":
        return "Communique materiel", "Autre evenement materiel divulgue par la societe.", cat
    if code == "5.03":
        return "Modification des statuts", "Amendement des statuts constitutifs de la societe.", cat
    return base_title, "Evenement materiel divulgue.", cat

def build_url(ticker, date):
    # SEC EDGAR filings page filtered by 8-K
    dnum = date.replace("-","")
    return f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=8-K&dateb={dnum}&owner=include&count=10"

def build_source_url_specific(ticker, date, acc):
    # SEC EDGAR full-text search for accession
    return f"https://efts.sec.gov/LATEST/search-index?q=%22{acc}%22&forms=8-K"

results = {}
for tk in TICKERS:
    d = f"{DL}/{tk}/8K"
    events = []
    used_years = set()
    if not os.path.isdir(d):
        results[tk] = []
        continue
    files = sorted(glob.glob(f"{d}/{tk}_*.htm.gz"))
    # Score each file
    scored = []
    for fp in files:
        base = os.path.basename(fp)
        m = re.match(rf"{tk}_(\d{{4}}-\d{{2}}-\d{{2}})_(\S+)\.htm\.gz", base)
        if not m: continue
        date = m.group(1); acc = m.group(2)
        if int(date[:4]) < 2021: continue
        txt, items = parse_file(fp)
        if not txt or not items: continue
        top = max(items, key=priority)
        pr = priority(top)
        if pr < 3: continue
        ctx = extract_item_context(txt, top)
        scored.append((pr, date, acc, top, ctx, fp))
    # Sort by priority desc, then by date desc
    scored.sort(key=lambda x: (-x[0], x[1]), reverse=False)
    scored.sort(key=lambda x: (-x[0], x[1]))
    # Pick diverse: 1 per year+code, up to 5, max 2 per year
    by_year = defaultdict(int)
    codes_used = set()
    picked = []
    # First pass: pick 1 per unique code, high priority first
    for pr, date, acc, code, ctx, fp in scored:
        y = date[:4]
        if code in codes_used and by_year[y] >= 1: continue
        if by_year[y] >= 2: continue
        picked.append((pr, date, acc, code, ctx))
        codes_used.add(code)
        by_year[y] += 1
        if len(picked) >= 5: break
    # Second pass if <4: fill with best remaining, ignoring year cap
    if len(picked) < 4:
        for pr, date, acc, code, ctx, fp in scored:
            already = any(p[1]==date and p[3]==code for p in picked)
            if already: continue
            picked.append((pr, date, acc, code, ctx))
            by_year[date[:4]] += 1
            if len(picked) >= 5: break
    # Third pass: absolute minimum 3, allow ANY items
    if len(picked) < 3:
        for fp in files:
            base = os.path.basename(fp)
            m = re.match(rf"{tk}_(\d{{4}}-\d{{2}}-\d{{2}})_(\S+)\.htm\.gz", base)
            if not m: continue
            date = m.group(1); acc = m.group(2)
            if int(date[:4]) < 2021: continue
            txt, items = parse_file(fp)
            if not txt or not items: continue
            for code in items:
                already = any(p[1]==date and p[3]==code for p in picked)
                if already: continue
                ctx = extract_item_context(txt, code)
                picked.append((priority(code), date, acc, code, ctx))
                if len(picked) >= 3: break
            if len(picked) >= 3: break
    # Build final event objects, sort by date desc (recent first)
    picked.sort(key=lambda x: x[1], reverse=True)
    ev = []
    for pr, date, acc, code, ctx in picked:
        title, desc, cat = build_title_desc(code, ctx)
        y = int(date[:4]); mo = int(date[5:7])
        ev.append({
            "year": y,
            "month": mo,
            "date": date,
            "title": title,
            "body": desc,
            "category": cat,
            "source": f"SEC 8-K Item {code}",
            "url": build_source_url_specific(tk, date, acc),
        })
    results[tk] = ev

json.dump(results, open("/Users/yann/spx-app/scratchpad/picked_events.json",'w'), indent=1, ensure_ascii=False)
for tk,e in results.items():
    print(f"{tk}: {len(e)} events -- codes: {[x['source'].split()[-1] for x in e]}")
