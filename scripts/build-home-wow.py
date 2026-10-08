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
_AGR_BASE=r"(chiffre d affaires|revenus?|revenu net|ventes nettes|ventes|resultat net|benefice net|bpa|eps|marge brute|marge operationnelle|marge nette|marge d ebitda|flux de tresorerie|flux de tresorerie operationnels?|flux de tresorerie disponible|free cash flow|cash flow|ebitda|ebit|resultat operationnel|resultat d exploitation|dette nette|tresorerie nette|net income|net revenue|total revenue|revenue|operating income|gross margin|operating margin)"
_AGR_QUAL=r"(trimestriels?|trimestrielle|semestriels?|semestrielle|annuels?|annuelle|ajuste|ajustee|ajustes|part du groupe|dilue|total|totale|du groupe|groupe|consolide|consolidee|publie|publiee|usd|eur|operationnels?|disponible|courant|courante|adjusted|diluted|fcf)"
_AGR=re.compile(rf"^{_AGR_BASE}( {_AGR_QUAL})*$")
def agregat_financier(nom):
    n=unicodedata.normalize('NFD',str(nom or ''));n=''.join(c for c in n if unicodedata.category(c)!='Mn').lower()
    n=re.sub(r"\(.*?\)"," ",n);n=re.sub(r"[^a-z0-9 ]+"," ",n);n=re.sub(r"\s+"," ",n).strip()
    return bool(_AGR.match(n))

try:
    _IND=json.load(open('src/data/kpi-industrie-par-societe.json',encoding='utf-8'))['societes']
except Exception:
    _IND={}
def _noms_ind(T):
    r=set()
    for i in (_IND.get(T) or {}).get('indicateurs',[]):
        if i.get('sur_fiche'):
            for c in (i.get('nom_sur_fiche_fr'),i.get('nom_sur_fiche_en'),i.get('code_sur_fiche')):
                if c: r.add(c)
    return r
def note(k):
    n=0
    if k.get('_ind'): n+=6
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


import subprocess,sys,datetime
# Export des KPI servis par la fiche (regenere a chaque execution).
os.makedirs('.cache',exist_ok=True)
_EXP='.cache/kpis-servis.json'
if '--no-export' not in sys.argv:
    subprocess.run(['npx','tsx','--env-file=.env.local','scripts/export-kpis-servis.ts',_EXP],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
SERVIS=json.load(open(_EXP,encoding='utf-8'))
AUJ=datetime.date.today()
def dernier_point(k):
    """Date du dernier point du KPI : last_data_date, sinon dernier libelle de periode."""
    d=k.get('last_data_date')
    if isinstance(d,str) and re.match(r'\d{4}-\d{2}',d):
        try: return datetime.date(int(d[:4]),int(d[5:7]),1)
        except Exception: pass
    hp=k.get('history_periods')
    if isinstance(hp,list) and hp:
        l=str(hp[-1])
        m=re.search(r'Q([1-4])\D*(\d{4})',l) or None
        if m: return datetime.date(int(m.group(2)),int(m.group(1))*3,1)
        m=re.search(r'(?:H|S)([12])\D*(\d{4})',l)
        if m: return datetime.date(int(m.group(2)),int(m.group(1))*6,1)
        m=re.search(r'(\d{4})',l)
        if m: return datetime.date(int(m.group(1)),12,1)
    return None
def recent(k):
    d=dernier_point(k)
    if not d: return False
    return (AUJ-d).days<=18*30+31

def fiche_wow(T):
    """Selection des 3 KPI wow d une societe, regles communes a la grille
    d accueil et a la carte des pays (Yann 07 sept 2026 : memes filtres)."""
    # 8 oct 2026 : SEULS les KPI reellement servis sur la fiche (meme chargeur
    # que la page, scripts/export-kpis-servis.ts) sont eligibles, avec le meme
    # nom, la meme valeur et la meme periode. Plus de lecture des brouillons.
    f=SERVIS.get(T)
    if not f: return None
    nom=f.get('name'); kpis=f.get('kpis') or []
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
    # Periode recente : dernier point dans les 18 derniers mois.
    kpis=[k for k in kpis if recent(k)]
    ind=_noms_ind(T)
    for k in kpis: k['_ind']=bool({k.get('name_fr'),k.get('name_en'),k.get('short')}&ind)
    # Yann 25 sept 2026 (cas Broadcom, flux de tresorerie disponible) : la home
    # ne montre JAMAIS un agregat financier de la societe (CA, resultat, BPA,
    # marges, flux de tresorerie, EBITDA, dette nette), marque generique ou non.
    kpis=[k for k in kpis if not k.get('is_generic') and not k.get('generique') and not agregat_financier(k.get('name_fr') or k.get('name_en'))]
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
