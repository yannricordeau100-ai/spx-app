#!/usr/bin/env python3
"""Regenere src/data/home-wow-kpis.json : les 3 KPI wow de chaque societe
populaire aupres des investisseurs francais (src/data/home-popular-fr.json).
A relancer apres toute mise a jour des fiches KPI. Regles : unites physiques
privilegiees, variations suspectes (>95 %) ecartees, valeurs formatees a la
francaise."""
import json,os,re,unicodedata
POP=json.load(open('src/data/home-popular-fr.json',encoding='utf-8'))['tickers']
# 7 sept 2026 (demande du proprietaire) : la grille de l accueil est triee par
# capitalisation boursiere decroissante (src/data/market-cap-order.json, recalcule
# chaque jour par scripts/ranks-univers.py). Une societe sans capitalisation du
# jour garde sa place d origine, apres les autres.
try:
    _ORDRE={t.upper():i for i,t in enumerate(json.load(open('src/data/market-cap-order.json',encoding='utf-8'))['tickers'])}
    POP=sorted(POP,key=lambda t:_ORDRE.get(t.upper(),10**6))
except Exception:
    pass
# Yann 29 aout 2026 : l univers rendu par la home est le triple croisement de
# src/app/sandbox/v1-9-5/page.tsx (loadCleanAllTickers + loadDatasets) : audit
# pre-publication is_clean_all, liste curatee, dataset public. Filtrer sur la
# seule liste curatee annoncait des societes invisibles en ligne.
uni={str(x).upper() for x in json.load(open('src/data/v1-9-5-clean-all-tickers.json',encoding='utf-8'))['tickers']}
# 7 sept 2026 : les deux filtres supplementaires (audit pre-publication et
# v1-7-public) dataient d avant les vagues europeennes et excluaient a tort
# SIE.DE, ALV.DE, P911.DE... alors que leurs pages sont servies. La vraie
# porte de visibilite est la liste clean-all (le chargeur redirige les
# tickers absents de cette liste).
# Yann 29 aout 2026 : les devises ecrites en toutes lettres (USD, EUR...) et
# les unites de ratio financier (pb, x) etaient prises pour des unites
# physiques et bonifiees a tort dans note().
FIN=re.compile(r'[$€¥£]|mds|\bm\b|\bmd\b|%|dollar|euro|\bpb\b|^\s*x\s*$'
 # Codes ISO de devise : « USD_billion », « TWD/action », « CHF m »... Le code
 # peut etre colle a un separateur non alphabetique, d ou les gardes manuelles.
 r'|(?<![a-z])(usd|eur|gbp|jpy|twd|krw|inr|brl|cny|hkd|cad|aud|chf|sek|dkk|nok)(?![a-z])',re.I)
def financier(u): return bool(FIN.search(str(u or ''))) or not u
def ampl(y):
    m=re.search(r'-?\d+(?:[.,]\d+)?',str(y or ''))
    return abs(float(m.group(0).replace(',','.'))) if m else 0
def fr_yoy(y):
    if not y: return None
    return re.sub(r'\s*%',' %',str(y).replace('.',','))
def fmt(v):
    if isinstance(v,(int,float)):
        if isinstance(v,float) and v==int(v): v=int(v)
        if isinstance(v,int) and abs(v)>=1000: return f'{v:,}'.replace(',',' ')
        if isinstance(v,float): return str(v).replace('.',',')
        return str(v)
    return re.sub(r'(\d)\.(\d)',r'\1,\2',str(v))
def slug(n):
    n=unicodedata.normalize('NFD',str(n or '').lower())
    n=''.join(c for c in n if unicodedata.category(c)!='Mn')
    # Un complement de periode ne fait pas un KPI different : « Effectif total
    # au 30 juin » et « au 31 decembre » sont la meme ligne sur la carte.
    n=re.sub(r'\s+au\s+\d.*$','',n)
    n=re.sub(r'\b(trimestriel|semestriel|annuel|mensuel|hebdomadaire)\w*\b','',n)
    return re.sub(r'[^a-z]','',n)
def note(k):
    n=0
    if not financier(k.get('unit')): n+=5
    if k.get('is_wow'): n+=4
    a=ampl(k.get('yoy'))
    if a>95: n-=6
    elif a>=30: n+=3
    elif a>=15: n+=2
    elif a>=8: n+=1
    if isinstance(k.get('history'),list) and len(k['history'])>=5: n+=1
    if k.get('is_generic'): n-=3
    return n

def periode_de(k):
    """Libelle court de la periode du chiffre ("T2 2026", "juin 2026", "2025")."""
    ldd=k.get('last_data_date')
    if isinstance(ldd,str) and len(ldd)>=7:
        try:
            y=int(ldd[:4]); m=int(ldd[5:7])
            return f"T{(m-1)//3+1} {y}"
        except Exception: pass
    sm=k.get('_source_month')
    if isinstance(sm,str) and sm.strip(): return sm.strip()
    return None

def fiche_wow(T):
    """Selection des 3 KPI wow d une societe, regles communes a la grille
    d accueil et a la carte des pays (Yann 07 sept 2026 : memes filtres)."""
    kpis=[];nom=None
    p1=f'.batches-drafts-safe/kpis-haut/{T}.json'
    if os.path.exists(p1):
        try: kpis=json.load(open(p1,encoding='utf-8')).get('kpis') or []
        except Exception: pass
    p2=f'src/data/v2-pipeline/{T.lower()}.json'
    if os.path.exists(p2):
        try:
            f2=json.load(open(p2,encoding='utf-8')); nom=f2.get('name')
            vus={k.get('short') for k in kpis}
            kpis+=[k for k in (f2.get('kpis') or []) if k.get('short') not in vus]
        except Exception: pass
    kpis=[k for k in kpis if isinstance(k,dict) and k.get('value') is not None and (k.get('name_fr') or k.get('name_en'))]
    # Yann 29 aout 2026 (cas AMZN capacite electrique, 1 point) : la home ne met
    # en avant que des KPI reellement AFFICHES sur la page ste. Memes seuils que
    # le tableau des indicateurs cles : 4 points en trimestriel, 2 en semestriel,
    # 3 sinon.
    def affichable(k):
        h=k.get('history') or []
        # une story (story_category, serie courte) est affichee dans le bloc
        # Story de la page : elle est donc eligible a l accueil (regle Yann)
        if k.get('story_category') and len(h)<=2: return True
        if k.get('is_short_history'): return True
        pt=k.get('period_type') or ('quarter' if (k.get('frequency')=='quarterly') else 'year')
        seuil=4 if pt=='quarter' else 2 if pt=='semester' else 3
        return isinstance(h,list) and len(h)>=seuil
    kpis=[k for k in kpis if affichable(k)]
    # Yann 29 aout 2026 : deux KPI dont le libelle en recouvre un autre
    # (« Cout du risque » / « Cout du risque trimestriel ») faisaient doublon
    # sur la carte. On garde le mieux note des deux.
    tri=[]
    for k in sorted(kpis,key=note,reverse=True):
        n=slug(k.get('name_fr') or k.get('name_en'))
        if any(n==m or n in m or m in n for m in map(slug,(x.get('name_fr') or x.get('name_en') for x in tri))):
            continue
        tri.append(k)
        if len(tri)==3: break
    if not tri: return None
    return {'ticker':T,'nom':nom or T,'kpis':[
        {'nom':k.get('name_fr') or k.get('name_en'),'valeur':fmt(k.get('value')),
         'unite':fmt(k['unit']) if k.get('unit') else None,'yoy':(lambda v: v and __import__('re').sub(r'\\s*(pp|pts?)\\b',' %',v))(fr_yoy(k.get('yoy'))),
         # Yann 30 aout 2026 : dater chaque chiffre de la vitrine (une IA externe
         # a lu des KPI de mars 2026 sans aucune indication de date).
         'periode':periode_de(k)} for k in tri]}

out=[]
for t in POP:
    T=t.upper()
    if T not in uni: continue
    f=fiche_wow(T)
    if not f: continue
    out.append(f)
    if len(out)>=40: break
json.dump({'generation':'scripts/build-home-wow.py','societes':out},
 open('src/data/home-wow-kpis.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out),'societes home')

# Carte des pays (Yann 07 sept 2026) : par zone, les plus grandes
# capitalisations du pays (market-cap-order.json), 20 au plus, avec les memes
# cartes 3-KPI que la grille d accueil.
SUFFIXES={'en':'','fr':'.PA','en-GB':'.L','de':'.DE','nl':'.AS','de-CH':'.SW'}
try:
    ordre=[t.upper() for t in json.load(open('src/data/market-cap-order.json',encoding='utf-8'))['tickers']]
except Exception:
    ordre=[]
def zone_de(T):
    for z,suf in SUFFIXES.items():
        if suf and T.endswith(suf): return z
    return None if '.' in T else 'en'
zones={z:[] for z in ['world']+list(SUFFIXES)}
cache={}
for T in ordre:
    if T not in uni: continue
    z=zone_de(T)
    cibles=[k for k in (['world']+([z] if z else [])) if len(zones[k])<20]
    if not cibles: continue
    if T not in cache: cache[T]=fiche_wow(T)
    f=cache[T]
    if not f: continue
    for k in cibles: zones[k].append(f)
json.dump({'generation':'scripts/build-home-wow.py','zones':zones},
 open('src/data/carte-pays-kpis.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print({z:len(l) for z,l in zones.items()},'carte des pays')
