#!/usr/bin/env python3
"""Detecteur automatique de KPI en double sur une meme fiche (Yann 13 sept 2026).
Deux KPI sont suspects quand leur libelle normalise ET leur famille d unite
concordent. Sortie : .conv-state/kpi-doublons.json (lu par l alerte de mise a jour).
  --apply : dans les paires de MEME frequence, garde la serie la plus longue ;
            dans les paires de frequences differentes, retire l annuelle.
"""
import json,glob,re,unicodedata,collections,sys,datetime
def base(s):
    s=unicodedata.normalize("NFD",str(s or "")).encode("ascii","ignore").decode().lower()
    s=re.sub(r"[^a-z0-9 ]"," ",s)
    return " ".join(sorted(m for m in s.split() if m not in {"de","du","des","d","le","la","les","l","en","the","of","total"}))
def fam(u):
    u=str(u or "").lower()
    if "%" in u: return "pct"
    if any(c in u for c in ["$","eur","€","usd","chf","£"]): return "money"
    return "autre:"+re.sub(r"[^a-z]","",u)[:6]
def freq(k):
    f=str(k.get("period_type") or k.get("frequency") or "year").lower()
    return "quarter" if f.startswith("quarter") else "semester" if f.startswith("semest") else "year"
PEERS={"EQR","AVB","TWN"}
apply="--apply" in sys.argv
memes=[];mixtes=[];suspects=[];modifs=0
for f in sorted(glob.glob(".batches-drafts-safe/kpis-haut/*.json")):
    t=f.split("/")[-1][:-5]
    try:j=json.load(open(f))
    except:continue
    par=collections.defaultdict(list)
    for k in j.get("kpis",[]): par[(base(k.get("name_fr") or k.get("short")),fam(k.get("unit")))].append(k)
    a_retirer=set()
    for (b,fa),g in par.items():
        if len(g)<2: continue
        if len({s.split("_")[0].upper() for s in [x.get("short","") for x in g]} & PEERS)>1: continue
        # Garde-fou : deux valeurs actuelles qui different d un facteur > 3 ne
        # sont pas le meme KPI (ex : cout unitaire / cout total) : signale, jamais retire.
        vals=[abs(float(k.get("value"))) for k in g if isinstance(k.get("value"),(int,float)) and k.get("value")]
        if len(vals)>=2 and max(vals)/min(vals)>3:
            suspects.append({"ticker":t,"cle":b,"kpis":[(k.get("short"),k.get("value")) for k in g]}); continue
        fs={freq(k) for k in g}
        e={"ticker":t,"cle":b,"unite":fa,"kpis":[{"short":k.get("short"),"f":freq(k),"n":len(k.get("history") or []),"v":k.get("value")} for k in g]}
        if len(fs)==1:
            memes.append(e)
            if apply:
                garde=max(g,key=lambda k:len(k.get("history") or []))
                for k in g:
                    if k is not garde: a_retirer.add(k.get("short"))
        else:
            mixtes.append(e)
            if apply and any(freq(k)!="year" for k in g):
                for k in g:
                    if freq(k)=="year": a_retirer.add(k.get("short"))
    if apply and a_retirer:
        avant=len(j["kpis"]); j["kpis"]=[k for k in j["kpis"] if k.get("short") not in a_retirer]
        modifs+=avant-len(j["kpis"]); json.dump(j,open(f,"w"),ensure_ascii=False,indent=2)
rap={"maj":datetime.date.today().isoformat(),"meme_frequence":memes,"frequences_differentes":mixtes,"valeurs_incoherentes":suspects,"regle":"meme libelle normalise + meme famille d unite ; --apply garde la serie la plus longue (meme frequence) ou retire l annuelle (frequences differentes)"}
json.dump(rap,open(".conv-state/kpi-doublons.json","w"),ensure_ascii=False,indent=1)
print(f"doublons meme frequence : {len(memes)} ; frequences differentes : {len(mixtes)} ; valeurs incoherentes (a verifier) : {len(suspects)} ; KPI retires : {modifs}")
