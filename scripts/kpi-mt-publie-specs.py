#!/usr/bin/env python3
"""Verifie les citations d un lot de specs (/tmp/mt_specs_<T>.json), genere les SVG et
insere les findings en attente d approbation (max 9 par societe). Usage : publie_specs.py TICKER [--max 9]"""
import json,re,sys,os,html as H,urllib.request,ssl,time,subprocess
T=sys.argv[1]; MAX=int(sys.argv[sys.argv.index('--max')+1]) if '--max' in sys.argv else 9
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
    print(f"{sp['slug']}: citations {ok}/{n}, valeurs {vok}/{len(valeurs)} -> {'OK' if verdict else 'REJET'} {ko[:3]}")
    if verdict: ok_specs.append(e)
ok_specs=ok_specs[:MAX]; print('retenus',len(ok_specs))
if '--publie' not in sys.argv: sys.exit(0)
env=dict(l.strip().split('=',1) for l in open('.env.local') if '=' in l and not l.startswith('#'))
u=env['NEXT_PUBLIC_SUPABASE_URL'].strip('"');k=env['SUPABASE_SERVICE_ROLE_KEY'].strip('"')
HH={'apikey':k,'Authorization':'Bearer '+k,'Content-Type':'application/json','Prefer':'return=representation'}
def req(path,method='GET',data=None):
    r=urllib.request.Request(u+'/rest/v1/'+path,method=method,headers=HH,data=json.dumps(data).encode() if data is not None else None)
    try: return json.loads(urllib.request.urlopen(r,context=CTX).read() or b'[]')
    except urllib.error.HTTPError as e: print('HTTP',e.code,e.read()[:300].decode(),'|',json.dumps(data,ensure_ascii=False)[:200] if data else ''); return []
titre=f"Par société : {T} (KPI d industrie)"
ex=req(f"desk_image_findings_requests?title=eq.{urllib.request.quote(titre)}&select=id")
if ex: rid=ex[0]['id']
else: rid=req('desk_image_findings_requests','POST',{'title':titre,'query':f'KPI d industrie non couverts de {T}, graphiques reconstruits depuis des sources externes','target_tickers':[T],'languages':['fr'],'status':'pending_review'})[0]['id']
os.makedirs('scripts/specs-findings/societes',exist_ok=True)
for e in ok_specs:
    sp=e['spec']; sp['dossier']=f"public/findings/societes/{T.lower()}"; p=f"scripts/specs-findings/societes/{sp['slug']}.json"; json.dump(sp,open(p,'w'),ensure_ascii=False,indent=1)
    subprocess.run(['python3','scripts/finding-svg.py',p],capture_output=True)
    loc=f"/findings/societes/{T.lower()}/{sp['slug']}-dark.svg"
    if req(f"desk_image_findings?image_local_path=eq.{urllib.request.quote(loc)}&select=id"): print('deja en base',sp['slug']); continue
    if not os.path.exists('public'+loc): print('SVG manquant',loc); continue
    d=req('desk_image_findings','POST',{'request_id':rid,'target_tickers':[T],'languages':['fr'],'source_url':e.get('source_url'),'source_author':None,'source_platform':e.get('source_platform'),'source_date':normdate(e.get('source_date')),'image_url':e.get('source_url'),'image_local_path':loc,'title':sp['titre'],'caption':sp.get('sous_titre'),'summary':e.get('summary_fr'),'approved':False,'rejected':False,'show_summary':True})
    print('insere',sp['slug'],d[0]['id'][:8] if d else d)
req(f"desk_image_findings_requests?id=eq.{rid}",'PATCH',{'findings_count':len(ok_specs),'status':'pending_review'})
