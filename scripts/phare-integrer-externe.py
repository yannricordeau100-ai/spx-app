#!/usr/bin/env python3
"""Integration des series « produit phare » produites par une IA externe (ChatGPT,
mission externe/MISSION.md), 13 sept 2026. Regles Yann : ajouter des KPI aux
fiches, jamais de doublon ; meme produit deja present -> garder le plus complet ;
candidat nomme sans serie -> combler ; produit different -> 3e candidat.
  python3 scripts/phare-integrer-externe.py [--apply]
"""
import json,glob,os,re,sys,unicodedata,collections,datetime
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT=os.path.join(ROOT,"docs/cahier/produit-phare/externe/sorties/_zip/docs/cahier/produit-phare/externe/sorties")
if "--dossier" in sys.argv: EXT=os.path.join(ROOT,sys.argv[sys.argv.index("--dossier")+1])
SOURCE="externe (ChatGPT, mission produit phare, 13 sept 2026)" if "--source" not in sys.argv else sys.argv[sys.argv.index("--source")+1]
apply="--apply" in sys.argv
LE=sys.argv[sys.argv.index("--le")+1] if "--le" in sys.argv else "2026-09-13"  # 14 sept 2026 : date d integration, mise en evidence sur la page
def norm(s):
    s=unicodedata.normalize("NFD",str(s or "")).encode("ascii","ignore").decode().lower()
    return {m for m in re.sub(r"[^a-z0-9 ]"," ",s).split() if len(m)>2 and m not in {"des","les","the","and","pour","dans","par","sur","avec","chiffre","affaires","ventes","annuel","annuelles","nombre","total","unites","produits"}}
def proche(a,b,seuil=0.5,mini=2):
    A,B=norm(a),norm(b)
    return bool(A and B) and len(A&B)>=mini and len(A&B)/min(len(A),len(B))>=seuil
UNITES={"md $":"Mds $","mds $":"Mds $","milliards de dollars":"Mds $","m $":"M $","millions de dollars":"M $","millions usd":"M $","m usd":"M $","m €":"M €","millions d’euros":"M €","millions d'euros":"M €","m eur":"M €","md €":"Mds €","milliards d’euros":"Mds €","milliards d'euros":"Mds €","vehicules":"véhicules","unites":"unités"}
def unite(u): return UNITES.get(str(u or "").strip().lower(),str(u or "").strip())
uni=set(json.load(open(os.path.join(ROOT,"src/data/v1-9-5-clean-all-tickers.json")))["tickers"])
regp=os.path.join(ROOT,"src/data/produit-phare.json"); reg=json.load(open(regp))
stes=reg["stes"]
raisons=json.load(open(os.path.join(EXT,"RAISONS_INDISPONIBILITE.json"))) if os.path.exists(os.path.join(EXT,"RAISONS_INDISPONIBILITE.json")) else {}
bilan=collections.Counter(); journal=[]; integres=[]
for f in sorted(glob.glob(os.path.join(EXT,"P2/*.json"))):
    j=json.load(open(f)); t=j["ticker"]
    if j.get("statut")!="ok": bilan["echec_externe"]+=1; continue
    if t not in uni: bilan["hors_univers"]+=1; continue
    annees={a:v for a,v in (j.get("annees") or {}).items() if isinstance(v,(int,float))}
    if len(annees)<5: bilan["moins_de_5_points"]+=1; continue
    k=j["kpi"]; produit=j["produit"]
    hp=os.path.join(ROOT,".batches-drafts-safe/kpis-haut",t+".json")
    haut=json.load(open(hp)) if os.path.exists(hp) else {"ticker":t,"kpis":[]}
    e=stes.setdefault(t,{"exception":None,"hero_precedent":None,"hero":None,"nom":None})
    # 1. meme produit deja candidat ?
    cible=None; action=None
    for c in ("candidat_A","candidat_B","candidat_C"):
        cand=e.get(c)
        if cand and proche(cand.get("produit"),produit):
            if cand.get("points",0)>=len(annees): action=("garde_existant",c); break
            cible=c; action=("remplace" if cand.get("points") else "comble",c); break
    # 2. meme KPI deja dans les indicateurs de la fiche (hors registre) ?
    if action is None:
        for x in haut["kpis"]:
            if proche(x.get("name_fr"),k.get("name_fr"),0.6,2) or proche(x.get("name_fr"),produit,0.6,2):
                nb=len(x.get("history") or [])
                if nb>=len(annees): action=("deja_dans_fiche",x.get("short")); break
                # meme KPI mais serie externe plus longue : on allonge la serie existante (jamais un 2e KPI)
                if apply:
                    ordre=sorted(annees); x["history"]=[{"q":f"FY{a}","v":annees[a]} for a in ordre]; x["frequency"]="annual"; x["period_type"]="year"
                    x["value"]=annees[ordre[-1]]; x["last_data_date"]=f"{ordre[-1]}-12-31"; x["_estime"]=[f"FY{a}" for a in (j.get("estime") or [])]; x["_source_allonge"]="externe (ChatGPT, 13 sept 2026)"
                    json.dump(haut,open(hp,"w"),ensure_ascii=False,indent=2)
                action=("allonge_fiche",x.get("short")); break
    if action is None:
        cible=next((c for c in ("candidat_A","candidat_B","candidat_C") if not e.get(c)),None)
        action=("ajoute",cible) if cible else ("plus_de_place",None)
    bilan[action[0]]+=1; journal.append((t,action[0],action[1],produit[:50],len(annees)))
    if action[0] in ("garde_existant","deja_dans_fiche","plus_de_place","allonge_fiche") or not apply: continue
    short=(e.get(cible) or {}).get("short") or k.get("short") or f"PHARE_{t.replace('.','_')}"
    short=re.sub(r"[^A-Za-z0-9_]","_",short)[:40]
    ordre=sorted(annees); hist=[{"q":f"FY{a}","v":annees[a]} for a in ordre]
    last=annees[ordre[-1]]; prev=annees.get(str(int(ordre[-1])-1))
    yoy=f"{(last-prev)/abs(prev)*100:+.1f}%".replace(".",",") if prev else None
    kpi={"short":short,"name_fr":k.get("name_fr") or produit,"name_en":k.get("name_en"),"unit":unite(k.get("unit")),"value":last,"yoy":yoy,"period_type":"year","frequency":"annual","type":"Revenue" if str(k.get("type","")).lower().startswith("rev") else "Volume","pv_score":8,"signal":f"Produit phare : {produit}","description_fr":(j.get("note") or "")[:300],"history":hist,"last_data_date":f"{ordre[-1]}-12-31","is_short_history":len(hist)<5,"_estime":[f"FY{a}" for a in (j.get("estime") or [])],"_source":SOURCE,"_produit_phare":produit,"_approximatif":j.get("fiabilite")=="approximatif","_sources_urls":j.get("sources_urls") or []}
    haut["kpis"]=[x for x in haut["kpis"] if x.get("short")!=short]+[kpi]
    json.dump(haut,open(hp,"w"),ensure_ascii=False,indent=2)
    e[cible]={"produit":produit,"short":short,"points":len(hist),"statut":"ok" if len(hist)>=8 else "court","source":"externe" if "ChatGPT" in SOURCE else "claude"}
    tp=os.path.join(ROOT,"docs/cahier/produit-phare",t.replace(".","-")+("~"+cible[-1] if cible!="candidat_A" else "")+"~ext.json")
    j["_integration"]={"le":LE,"candidat":cible,"short":short,"action":action[0]}
    json.dump(j,open(tp,"w"),ensure_ascii=False,indent=1)
    integres.append({"ticker":t,"candidat":cible,"produit":produit,"short":short,"points":len(hist),"integre_le":LE,"fiabilite":j.get("fiabilite") or "officiel"})
if raisons: reg["indisponibles_externe"]={t:{"type":v.get("type"),"produit":v.get("produit"),"raison":(v.get("raison") or "")[:400]} for t,v in raisons.items() if t in uni}
reg["integres_externe"]=(reg.get("integres_externe",[])+integres) if apply else reg.get("integres_externe",[])
if apply: json.dump(reg,open(regp,"w"),ensure_ascii=False,indent=1)
print(dict(bilan)); print("indisponibles retenus :",len(reg["indisponibles_externe"]))
for l in journal[:12]: print(" ",l)
json.dump(journal,open(os.path.join(ROOT,".conv-state/phare-externe-journal.json"),"w"),ensure_ascii=False)
