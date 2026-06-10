#!/usr/bin/env python3
"""
sanitize-stories.py — BETON ARME : valide/nettoie les stories de TOUTES les stés
publiées selon les règles Yann. Déterministe, 0 LLM.

RÈGLES (une story est RETIREE si) :
  R1. value 0 / 0,0 / null / "0" / "0%" / "0,0%"  (jamais de story à zéro)
  R2. history contient un 0 ou un null
  R3. générique (§0septies : Revenue/Net Income/EPS/EBITDA/Margins/FCF/Capex/...)
  R4. DOUBLON d'un KPI standard (même short OU même name que dans kpis[])
  R5. DOUBLON du bloc Répartition CA : story = revenu par géographie/segment déjà
      affiché (Americas/Europe/Asia/China/... Revenue, ou un label de
      revenue_by_segment / revenue_by_geography)
  R6. format : value "x,0" / x.0  ->  entier (strip du ,0 inutile) [normalisation]

Aussi : retire des market_positions (TAM, affichées dans le carrousel Stories)
celles à share_pct 0/null ou tam_value 0/null (R1 appliquée aux TAM).

Usage : python3 scripts/sanitize-stories.py [--apply]
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = "--apply" in sys.argv

GEN = re.compile(r'^(total revenue|revenue|revenues|net sales|sales|net revenue|chiffre|revenu|'
                 r'net income|net profit|net margin|operating income|op income|operating profit|ebit|'
                 r'operating margin|op margin|gross margin|gross profit|ebitda|free cash flow|fcf|'
                 r'operating cash flow|eps|earnings per share|total assets|total debt|net debt|leverage|'
                 r'roe|roic|roa|market cap|shares outstanding|tax rate|headcount|effectif|capex|r&d|'
                 r'dividend|dps|payout|cap return|buyback|depreciation|stock comp|amortization)\b', re.I)
GEO = re.compile(r'\b(americas|amerique|north america|amerique du nord|europe|asia|asie|asia.?pacific|'
                 r'asie.?pacifique|apac|emea|china|chine|greater china|japan|japon|rest of|reste|latam|'
                 r'latin|middle east|moyen.?orient|africa|afrique|row|domestic|international|geograph)\b', re.I)

def num(x):
    if isinstance(x, (int, float)): return float(x)
    if isinstance(x, str):
        m = re.search(r'-?\d+[.,]?\d*', x.replace(' ', ''))
        if m:
            try: return float(m.group(0).replace(',', '.'))
            except: return None
    return None

def norm(s): return re.sub(r'[^a-z0-9]', '', str(s or '').lower())

def is_zero(k):
    v = num(k.get('value'))
    if v is None or abs(v) == 0: return True
    # yoy / value affichant 0%
    sv = str(k.get('value', ''))
    if re.fullmatch(r'\s*0([.,]0+)?\s*%?\s*', sv): return True
    return False

def hist_bad(k):
    h = k.get('history')
    if not isinstance(h, list): return False
    for x in h:
        xv = x.get('value') if isinstance(x, dict) else x
        if xv is None: return True
        if isinstance(xv, (int, float)) and xv == 0: return True
    return False

def strip_trailing_zero(v):
    # 410.0 -> 410 (int) ; 12.30 -> 12.3 ; garde les vraies décimales
    if isinstance(v, float) and v == int(v):
        return int(v)
    if isinstance(v, str):
        m = re.fullmatch(r'(-?\d+)[.,]0+', v.strip())
        if m: return m.group(1)
    return v

A = json.load(open(os.path.join(ROOT, "src/data/v1-9-pre-publication-audit.json")))
audits = A.get("audits") if isinstance(A, dict) else A
clean = [e["ticker"] for e in audits if isinstance(e, dict) and e.get("is_clean_all") is True]

rep = {"R1_zero": 0, "R2_hist": 0, "R3_gen": 0, "R4_dup_kpi": 0, "R5_geo_seg": 0,
       "R6_fmt": 0, "TAM_zero": 0}
touched = 0
samples = []
for t in clean:
    p = os.path.join(ROOT, f"src/data/v2-pipeline/{t.lower()}.json")
    if not os.path.exists(p): continue
    raw = open(p).read()
    try: d = json.loads(raw)
    except: continue
    changed = False
    kpi_keys = set()
    for k in (d.get("kpis") or []):
        if isinstance(k, dict):
            kpi_keys.add(norm(k.get("short"))); kpi_keys.add(norm(k.get("name_fr"))); kpi_keys.add(norm(k.get("name_en")))
    seg_labels = set()
    for blk in ("revenue_by_segment", "revenue_by_geography"):
        b = d.get(blk) or {}
        for sl in (b.get("slices") or []):
            if isinstance(sl, dict): seg_labels.add(norm(sl.get("label")))
    sk = d.get("stories_kpis")
    if isinstance(sk, list) and sk:
        keep = []
        for k in sk:
            if not isinstance(k, dict):
                keep.append(k); continue
            sh = str(k.get("short", "")); reason = None
            if is_zero(k): reason = "R1_zero"
            elif hist_bad(k): reason = "R2_hist"
            elif GEN.search(sh) or GEN.search(str(k.get("name_en", ""))): reason = "R3_gen"
            elif norm(sh) in kpi_keys or norm(k.get("name_fr")) in kpi_keys or norm(k.get("name_en")) in kpi_keys: reason = "R4_dup_kpi"
            elif (GEO.search(sh) or GEO.search(str(k.get("name_fr", "")))) and re.search(r'revenu|revenue|\brev\b|sales|vente|\bca\b', sh, re.I): reason = "R5_geo_seg"
            elif norm(sh) in seg_labels or norm(k.get("name_fr")) in seg_labels: reason = "R5_geo_seg"
            if reason:
                rep[reason] += 1; changed = True
                if len(samples) < 25: samples.append((t, sh, reason))
                continue
            # R6 : normaliser value x,0 -> entier
            nv = strip_trailing_zero(k.get("value"))
            if nv != k.get("value"):
                k["value"] = nv; rep["R6_fmt"] += 1; changed = True
            keep.append(k)
        if len(keep) != len(sk) or changed:
            d["stories_kpis"] = keep
    # TAM market_positions à 0 (dans le carrousel Stories)
    mp = d.get("market_positions")
    if isinstance(mp, list) and mp:
        keepmp = [m for m in mp if isinstance(m, dict) and (num(m.get("share_pct")) not in (None, 0) or num(m.get("company_segment_revenue")) not in (None, 0))]
        if len(keepmp) != len(mp):
            rep["TAM_zero"] += len(mp) - len(keepmp); d["market_positions"] = keepmp; changed = True
    if changed:
        touched += 1
        if APPLY:
            pretty = raw[:300].count(chr(10)) > 3
            open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2 if pretty else None))

print(f"{'APPLIED' if APPLY else 'DRY-RUN'} : {touched} stés modifiées")
print("  retraits:", {k: v for k, v in rep.items() if v})
print("  échantillon:")
for t, sh, r in samples: print(f"    {t}: '{sh}' -> {r}")
