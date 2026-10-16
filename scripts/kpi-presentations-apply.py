#!/usr/bin/env python3
"""kpi-presentations-apply.py : KPI reperes dans les presentations de resultats (chaine post-resultats).

Utilise le 16 oct 2026 (rapport docs/rapports-session-2026-10/kpi-presentations-16oct.md).
Entree : un JSON par societe dans le dossier passe en argument (format ci-dessous), produit par
les agents d extraction avec le PROMPT ci-dessous. Sortie : KPI IC dans src/data/v2-pipeline/<t>.json
(prefixe pres_), stories dans stories_kpis de src/data/v2-pipeline-enrich/<t>.json.

  python3 scripts/kpi-presentations-apply.py <dossier_json>            # simulation
  python3 scripts/kpi-presentations-apply.py <dossier_json> --apply

REGLE DE CLASSEMENT (Yann, 16 oct 2026), valable pour la presentation libre de la societe ET pour
le communique et les slides normalises deposes a la SEC (societe US) ; une societe europeenne
(ex. ASML, 6-K a graphiques en images) a ses propres formats : s adapter (transcription du graphique).
  1) Le KPI figurait deja dans le document de resultats precedent :
     - historique suffisant pour un KPI IC (4 trimestres contigus ou plus) : prolonger la serie en KPI IC ;
     - sinon : KPI story avec un mini graphique valeur precedente -> nouvelle valeur.
  2) Le KPI ne figurait pas dans le document precedent : KPI story simple.
Avant de classer, chercher les valeurs des trimestres precedents dans les presentations precedentes
(data-lake/<T>/EP, ES, ER, 8K, 6K, ou site investisseurs). Chaque valeur doit etre retrouvee telle
quelle dans sa source (citation litterale controlee par ce script).
"""
PROMPT = """Tu lis la presentation de resultats de {ticker} (et le communique / les slides SEC si societe US).
Releve les KPI chiffres absents de la fiche (jamais une definition voisine d un KPI deja present).
Pour chaque KPI, cherche aussi sa valeur dans les documents de resultats des trimestres precedents
(data-lake/{ticker}/EP|ES|ER|8K|6K, sinon site investisseurs) : au moins 4 trimestres contigus si possible.
Chaque point = {{"periode":"T3 2026","valeur":54.0,"citation":"texte litteral contenant le nombre","source":"chemin du document"}}.
Ne jamais deduire une valeur d une variation, ne jamais estimer.
Classement propose : "IC" si la serie est publiee chaque trimestre, "story" sinon, "refuse" avec raison.
Le script applique ensuite la regle : IC si 4 points contigus ou plus ; sinon story avec mini graphique
si la valeur du trimestre precedent existe ; sinon story simple."""
import json,re,glob,gzip,sys,subprocess,os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/"; S=os.path.join(os.path.abspath(sys.argv[1]),"") if len(sys.argv)>1 and not sys.argv[1].startswith("--") else sys.exit(__doc__)
IC_MIN=4
APPLY="--apply" in sys.argv
def norm(s): return re.sub(r"\s+"," ",(s or "").replace("&nbsp;"," ").replace(" "," ").replace("​"," "))
def text_of(j):
    out=""
    for p in [j.get("texte"),j.get("presentation")]+j.get("autres_textes",[])+[q.get("source") for k in j.get("kpis",[]) for q in k.get("points") or []]:
        if not p: continue
        fp=p if p.startswith("/") else R+p
        try:
            if fp.endswith(".pdf"): out+=subprocess.run(["/opt/homebrew/bin/pdftotext","-layout",fp,"-"],capture_output=True,text=True).stdout
            elif fp.endswith(".gz"): out+=gzip.open(fp,"rt",errors="ignore").read()
            else: out+=re.sub(r"<[^>]+>"," ",open(fp,errors="ignore").read())
        except Exception: pass
    return norm(out)
def num_forms(v):
    f=set()
    for d in range(0,4):
        s=f"{v:,.{d}f}"
        if abs(float(s.replace(",",""))-v)<1e-9: f.add(s); f.add(s.replace(",",""))
    return f
def per_key(p):
    m=re.match(r"T([1-4]) (FY)?(\d{4})",p); return int(m.group(3))*4+int(m.group(1)) if m else None
rapport=[]; ajout={}
for f in sorted(x for x in glob.glob(S+"*.json") if not os.path.basename(x).startswith("_")):
    j=json.load(open(f)); t=j["ticker"]; txt=text_of(j)
    for k in j.get("kpis",[]):
        cl=k["classement"]; pts=k.get("points") or []
        motif=k.get("raison","")
        if cl in("IC","story"):
            bad=[p for p in pts if norm(p.get("citation")) not in txt or not any(x in norm(p.get("citation")) for x in num_forms(float(p["valeur"])))]
            if bad or not pts:
                rapport.append((t,k.get("name_fr"),cl,"refusé à la vérification : valeur non retrouvée telle quelle ("+(bad[0]["periode"] if bad else "aucun point")+")",pts[-1]["valeur"] if pts else "",pts[-1]["periode"] if pts else "")); continue
            pts=sorted(pts,key=lambda p:per_key(p["periode"]) or 0)
            ks=[per_key(p["periode"]) for p in pts]
            if cl=="IC" and None in ks:
                rapport.append((t,k.get("name_fr"),cl,"refusé : période illisible",pts[-1]["valeur"],pts[-1]["periode"])); continue
            if cl=="IC":
                i=len(pts)-1
                while i>0 and ks[i]-ks[i-1]==1: i-=1
                if i>0: motif=(motif+" ; " if motif else "")+f"historique limité aux trimestres contigus ({len(pts)-i} sur {len(pts)})"
                pts=pts[i:]
                if len(pts)<IC_MIN:
                    # Regle du 16 oct 2026 : moins de 4 trimestres contigus -> story,
                    # avec mini graphique si la valeur du trimestre precedent existe.
                    cl="story"; motif=(motif+" ; " if motif else "")+(f"{len(pts)} trimestres seulement : story avec mini graphique" if len(pts)>=2 else "nouveau KPI : story simple")
                    pts=pts[-2:]
                    k=dict(k,story_fr=k.get("story_fr") or f'{k["name_fr"]} : {pts[-1]["valeur"]} {k.get("unit","")} au {pts[-1]["periode"]}.')
            ajout.setdefault(t,[]).append((k,pts,cl))
        rapport.append((t,k.get("name_fr"),cl,motif,pts[-1]["valeur"] if pts else "",pts[-1]["periode"] if pts else ""))
        if cl in("IC","story") and ajout.get(t) and ajout[t][-1][0].get("short")==k.get("short"): ajout[t][-1]=(k,pts,cl)
def fin(p):
    m=re.match(r"T([1-4]) (\d{4})$",p); return f"{m.group(2)}-{['03-31','06-30','09-30','12-31'][int(m.group(1))-1]}" if m else None
n_ic=n_st=0; par={}
for t,lst in ajout.items():
    vp=R+f"src/data/v2-pipeline/{t.lower()}.json"; ep=R+f"src/data/v2-pipeline-enrich/{t.lower()}.json"
    raw=open(vp).read(); m=re.match(r"\{\s*\n( +)\"",raw[:200]); ind=len(m.group(1)) if m else None; v=json.loads(raw)
    try:
        eraw=open(ep).read(); m2=re.match(r"\{\s*\n( +)\"",eraw[:200]); eind=len(m2.group(1)) if m2 else None; e=json.loads(eraw)
    except FileNotFoundError: eraw=None; e={"ticker":t}; eind=2
    exist={x.get("short") for x in v.get("kpis",[])}|{x.get("short") for x in e.get("stories_kpis",[]) or []}
    for k,pts,cl in lst:
        sh="pres_"+k["short"]
        if sh in exist: continue
        last=pts[-1]; val=float(last["valeur"]); val=int(val) if val.is_integer() else val
        src=j_src=k.get("source") or ""
        base={"short":sh,"name_fr":k["name_fr"],"name_en":k.get("name_en"),"unit":k.get("unit"),"value":val,
              "last_data_date":fin(last["periode"]),"_source":"kpi-star","_source_detail":"Présentation de résultats de la société (pièce du 8-K / 6-K), relevé du 16/10/2026","_maj_le":"2026-10-16","is_wow":True,"is_generic":False}
        if cl=="IC":
            hist=[float(p["valeur"]) for p in pts]; hp=[p["periode"] for p in pts]
            base.update(history=hist,history_periods=hp,period_type="quarter",is_short_history=len(hist)<5)
            if len(hist)>=5:
                a,b=hist[-5],hist[-1]
                base["yoy"]=(f"{b-a:+.1f} pt" if k.get("unit","").strip()=="%" else f"{(b/a-1)*100:+.1f}%").replace(".",",") if a else None
            base["signal"]=f'{last["periode"]} : {str(val).replace(".",",")} {k.get("unit","")}'.strip()+(f' ({base["yoy"]} sur un an)' if base.get("yoy") else "")
            v.setdefault("kpis",[]).append(base); n_ic+=1; par.setdefault(t,[0,0])[0]+=1
        else:
            if len(pts)>=2: base["history"]=[{"q":"Q%s-%s"%(p["periode"][1],p["periode"][-4:]),"v":float(p["valeur"])} for p in pts[-2:]]  # mini graphique
            else: base.update(history=[float(pts[-1]["valeur"])],history_periods=[pts[-1]["periode"]])
            base.update(story_fr=k.get("story_fr"),signal=k.get("story_fr"),is_short_history=True,story_category="Résultats")
            e.setdefault("stories_kpis",[]).append(base); n_st+=1; par.setdefault(t,[0,0])[1]+=1
    if APPLY:
        open(vp,"w").write(json.dumps(v,ensure_ascii=False,indent=ind)+("\n" if raw.endswith("\n") else ""))
        if par.get(t,[0,0])[1]: open(ep,"w").write(json.dumps(e,ensure_ascii=False,indent=eind)+("\n" if (eraw or "\n").endswith("\n") else ""))
json.dump({"rapport":rapport,"par":par},open(os.path.join(S,"_resultat.json"),"w"),ensure_ascii=False,indent=1)
print("IC",n_ic,"stories",n_st,par)
print([r for r in rapport if r[3].startswith("refusé à") or r[3].startswith("refusé :")])
