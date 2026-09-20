#!/usr/bin/env python3
"""Verifie les citations d un lot de specs (/tmp/mt_specs_<T>.json), genere les SVG et
insere les findings en attente d approbation. Le plafond par defaut est le
desired_count de la demande existante (3 sinon). Usage : publie_specs.py TICKER [--max 3]"""
import json,re,sys,os,html as H,urllib.request,ssl,time,subprocess
from datetime import date as _date
T=sys.argv[1]
# --max explicite = plafond force. Sinon on prendra le desired_count de la
# demande existante (voir plus bas), et 3 a defaut.
MAX_FORCE=int(sys.argv[sys.argv.index('--max')+1]) if '--max' in sys.argv else None
MAX=MAX_FORCE if MAX_FORCE else 3
titre=sys.argv[sys.argv.index('--titre')+1] if '--titre' in sys.argv else f"Par société : {T} (KPI d industrie)"
# Garde-fou : aucun prenom dans un libelle visible par les lecteurs.
PRENOMS_INTERDITS=('yann','oscar')
_t=re.sub(r'[^a-z]+',' ',titre.lower()).split()
if any(pr in _t for pr in PRENOMS_INTERDITS):
    print(f"REFUS : le titre « {titre} » contient un prenom. La regle interne interdit les prenoms dans les libelles visibles. Choisis un titre neutre.")
    sys.exit(2)
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
UA={'User-Agent':'Mozilla/5.0 (Macintosh) Mettrik contact@mettrik.ai'}; cache={}
def texte(url):
    if url in cache: return cache[url]
    if url.startswith('/tmp/') and os.path.exists(url):
        t=subprocess.run(['pdftotext','-layout',url,'-'],capture_output=True,text=True).stdout if url.lower().endswith('.pdf') else open(url,errors='ignore').read()
        t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>',' ',t))); cache[url]=t; return t
    try:
        raw=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60,context=CTX).read()
        if raw[:4]==b'%PDF':
            open('/tmp/_v.pdf','wb').write(raw); t=subprocess.run(['pdftotext','-layout','/tmp/_v.pdf','-'],capture_output=True,text=True).stdout
        else: t=H.unescape(re.sub(r'<[^>]+>',' ',raw.decode('utf-8','ignore')))
    except Exception: t=''
    t=re.sub(r'\s+',' ',t); cache[url]=t; time.sleep(0.8); return t
def normdate(d):
    if not d: return None
    d=str(d)
    return d+'-01' if len(d)==7 else (d+'-01-01' if len(d)==4 else d)
# Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois
def limite_18_mois():
    t=_date.today(); m=t.month-18; a=t.year+(m-1)//12; m=(m-1)%12+1
    return _date(a,m,min(t.day,28))
def source_trop_vieille(d):
    """(True, motif) si la date de source est absente, illisible ou anterieure a aujourd hui moins 18 mois."""
    n=normdate(d)
    if not n: return True,'source_date absente'
    try: dd=_date.fromisoformat(str(n)[:10])
    except ValueError: return True,f'source_date illisible ({n})'
    return (dd<limite_18_mois()), f'source datee du {n}, limite {limite_18_mois().isoformat()}'
def norm(s): return re.sub(r'[^a-z0-9]+',' ',str(s).lower()).strip()
lot=json.load(open(f'/tmp/mt_specs_{T}.json')); ok_specs=[]
for e in lot:
    sp=e['spec']; cit=e.get('citations') or {}; n=0; ok=0; ko=[]
    valeurs=[v for s in sp['series'] for v in s['valeurs'] if isinstance(v,(int,float))]
    for cle,c in cit.items():
        n+=1; t=norm(texte(c['url'])); mots=norm(c.get('texte','')).split(); frag=' '.join(mots[:7])
        if frag and frag in t: ok+=1
        else: ko.append(cle)
    # valeurs : au moins 60 % des valeurs doivent figurer dans une des pages citees
    pages=' '.join(norm(texte(c['url'])) for c in list(cit.values())[:6])
    vok=sum(1 for v in valeurs if any(norm(f) in pages for f in {str(v),f"{v:,.0f}",f"{v:,.1f}",f"{v:g}"}))
    verdict = n>0 and ((ok>=1 and vok>=0.8*len(valeurs)) or vok==len(valeurs))
    # Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois
    vieille,motif=source_trop_vieille(e.get('source_date'))
    if vieille:
        verdict=False
        print(f"{sp['slug']}: REJET source de plus de 18 mois ({motif})")
    print(f"{sp['slug']}: citations {ok}/{n}, valeurs {vok}/{len(valeurs)} -> {'OK' if verdict else 'REJET'} {ko[:3]}")
    if verdict:
        # Critere de qualite (20 sept 2026), par ordre de poids decroissant :
        #   1. nombre de citations reellement verifiees dans la page source (ok)
        #   2. fraicheur de la source (source_date la plus recente)
        #   3. nombre de points de la serie (un graphique plus dense est plus utile)
        # Les N premiers apres tri sont donc les mieux etayes, pas les premiers du lot.
        e['_qualite']=(ok, str(normdate(e.get('source_date')) or ''), len(valeurs))
        ok_specs.append(e)
# Tri qualite decroissant AVANT la coupe, pour que le plafond garde les meilleurs.
ok_specs.sort(key=lambda x: x['_qualite'], reverse=True)

# Connexion Supabase (necessaire pour lire le desired_count de la demande).
env=None
try:
    env=dict(l.strip().split('=',1) for l in open('.env.local') if '=' in l and not l.startswith('#'))
except OSError:
    pass
if env is None:
    if MAX_FORCE is None: print('.env.local illisible : plafond par defaut 3')
    ok_specs=ok_specs[:MAX]; print('retenus',len(ok_specs)); sys.exit(0)
u=env['NEXT_PUBLIC_SUPABASE_URL'].strip('"');k=env['SUPABASE_SERVICE_ROLE_KEY'].strip('"')
HH={'apikey':k,'Authorization':'Bearer '+k,'Content-Type':'application/json','Prefer':'return=representation'}
def req(path,method='GET',data=None):
    r=urllib.request.Request(u+'/rest/v1/'+path,method=method,headers=HH,data=json.dumps(data).encode() if data is not None else None)
    try: return json.loads(urllib.request.urlopen(r,context=CTX).read() or b'[]')
    except urllib.error.HTTPError as e: print('HTTP',e.code,e.read()[:300].decode(),'|',json.dumps(data,ensure_ascii=False)[:200] if data else ''); return []
ex=req(f"desk_image_findings_requests?title=eq.{urllib.request.quote(titre)}&select=id,desired_count")
if not ex: ex=req(f"desk_image_findings_requests?title=eq.{urllib.request.quote(titre)}&select=id")
# Plafond : --max explicite sinon le desired_count de la demande existante (3 a defaut).
if MAX_FORCE is None and ex and isinstance(ex[0].get('desired_count'),int) and ex[0]['desired_count']>0:
    MAX=ex[0]['desired_count']; print('plafond lu sur la demande existante :',MAX)
ok_specs=ok_specs[:MAX]; print('retenus',len(ok_specs))
if '--publie' not in sys.argv: sys.exit(0)
if ex: rid=ex[0]['id']
else:
    # Numero de demande : max existant + 1, pour que le badge « # » ne soit jamais vide.
    _mx=req('desk_image_findings_requests?select=display_number&order=display_number.desc.nullslast&limit=1')
    _num=(_mx[0].get('display_number') or 0)+1 if _mx else 1
    _corps={'display_number':_num,'title':titre,'query':f'KPI d industrie non couverts de {T}, graphiques reconstruits depuis des sources externes','target_tickers':[T],'languages':['fr'],'desired_count':MAX,'status':'pending_review'}
    _cree=req('desk_image_findings_requests','POST',_corps)
    if not _cree:
        # Repli si la migration desired_count n est pas encore appliquee en base.
        _corps.pop('desired_count',None); _cree=req('desk_image_findings_requests','POST',_corps)
    rid=_cree[0]['id']
# Yann 20 sept 2026 : nom lisible du KPI d industrie couvert (referentiel
# docs/cahier/donnees), ecrit sur le finding pour l affichage en gras.
NOMS_KPI={}
import glob as _glob
for _f in _glob.glob('docs/cahier/donnees/*.json'):
    try: _d=json.load(open(_f))
    except Exception: continue
    for _k in _d.get('kpis',[]):
        if _k.get('nom_fr') and _k.get('short') and _k['short'] not in NOMS_KPI: NOMS_KPI[_k['short']]=_k['nom_fr']
os.makedirs('scripts/specs-findings/societes',exist_ok=True)
for e in ok_specs:
    sp=e['spec']; sp['dossier']=f"public/findings/societes/{T.lower()}"; p=f"scripts/specs-findings/societes/{sp['slug']}.json"; json.dump(sp,open(p,'w'),ensure_ascii=False,indent=1)
    subprocess.run(['python3','scripts/finding-svg.py',p],capture_output=True)
    loc=f"/findings/societes/{T.lower()}/{sp['slug']}-dark.svg"
    if req(f"desk_image_findings?image_local_path=eq.{urllib.request.quote(loc)}&select=id"): print('deja en base',sp['slug']); continue
    if not os.path.exists('public'+loc): print('SVG manquant',loc); continue
    # Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois
    vieille,motif=source_trop_vieille(e.get('source_date'))
    if vieille: print(f"REJET source de plus de 18 mois : {sp['slug']} ({motif})"); continue
    d=req('desk_image_findings','POST',{'request_id':rid,'target_tickers':[T],'languages':['fr'],'source_url':e.get('source_url'),'source_author':None,'source_platform':e.get('source_platform'),'source_date':normdate(e.get('source_date')),'image_url':e.get('source_url'),'image_local_path':loc,'industry_kpi':NOMS_KPI.get(e.get('kpi_short') or ''),'title':sp['titre'],'caption':sp.get('sous_titre'),'summary':e.get('summary_fr'),'approved':False,'rejected':False,'show_summary':True})
    print('insere',sp['slug'],d[0]['id'][:8] if d else d)
req(f"desk_image_findings_requests?id=eq.{rid}",'PATCH',{'findings_count':len(ok_specs),'status':'pending_review'})
