#!/usr/bin/env python3
"""
Rebranche les series trimestrielles verifiees (lot Q4 du 2 sept 2026) sur les
KPI reellement affiches (Yann 3 sept 2026, option B).

Probleme : les fichiers src/data/v2-pipeline-enrich/<t>.quarterly-history.json
utilisent des identifiants techniques (sales_without_fuel) alors que la fiche
utilise des libelles (Identical sales without fuel) : le chargeur ne fusionne
jamais. Ici, on relie une serie enrich a un KPI de la fiche UNIQUEMENT quand
leurs valeurs coincident (>= 4 valeurs communes consecutives, tolerance 0,5 %) :
memes chiffres = meme indicateur. Aucun rapprochement par le nom seul.
Puis le fichier recoit method="llm-filing-crosschecked" (accepte par le
chargeur) et un `_rebranche_2026_09_03` tracable. Sauvegarde avant ecriture.
"""
import json, shutil, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
LOT = ["AFL","ADBE","AMP","APD","CHTR","CME","CPRT","CSCO","CSX","DAL","DD","EXC","INTU","JKHY","KLAC","MU","RKLB","ROL","SJM","STX","TEL","WFC","KR"]
BK = ROOT / ".conv-state" / "backup-rebranche-2026-09-03"; BK.mkdir(parents=True, exist_ok=True)

def proche(a, b):
    if not isinstance(a,(int,float)) or not isinstance(b,(int,float)): return False
    if a == b: return True
    return abs(a-b) <= 0.005*max(abs(a),abs(b),1e-9)

def chevauchement(serie_a, serie_b, mini=4):
    """Plus longue suite de valeurs consecutives communes (dans l ordre)."""
    best=0
    for i in range(len(serie_a)):
        for j in range(len(serie_b)):
            k=0
            while i+k<len(serie_a) and j+k<len(serie_b) and proche(serie_a[i+k],serie_b[j+k]): k+=1
            best=max(best,k)
    return best if best>=mini else 0

rapport=[]
for t in LOT:
    fe = ROOT/"src/data/v2-pipeline-enrich"/f"{t.lower()}.quarterly-history.json"
    ff = ROOT/"src/data/v2-pipeline"/f"{t.lower()}.json"
    fh = ROOT/".batches-drafts-safe/kpis-haut"/f"{t}.json"
    if not fe.exists() or not ff.exists(): continue
    ext=json.load(open(fe)); fiche=json.load(open(ff))
    candidats=[k for k in fiche.get("kpis",[]) if isinstance(k.get("history"),list)]
    if fh.exists():
        try:
            for k in json.load(open(fh)).get("kpis",[]):
                h=k.get("history")
                if isinstance(h,list) and h and isinstance(h[0],dict): k=dict(k,history=[p.get("v") for p in h])
                if isinstance(k.get("history"),list): candidats.append(k)
        except Exception: pass
    modifs=[]
    for e in ext.get("kpis",[]):
        h=e.get("history"); hp=e.get("history_periods")
        if not isinstance(h,list) or not isinstance(hp,list) or len(h)!=len(hp): continue
        matches=[]
        for c in candidats:
            s=chevauchement(h, c["history"])
            if s: matches.append((s, c.get("short")))
        shorts={m[1] for m in matches}
        if len(shorts)==1 and shorts != {e.get("short")}:
            nouveau=shorts.pop(); modifs.append((e.get("short"), nouveau, max(m[0] for m in matches)))
            e["_short_technique"]=e.get("short"); e["short"]=nouveau
        elif len(shorts)>1:
            rapport.append((t, e.get("short"), "AMBIGU", sorted(shorts)))
    if modifs:
        shutil.copy(fe, BK/fe.name)
        ext["method"]="llm-filing-crosschecked"
        ext["_rebranche_2026_09_03"]=[{"de":a,"vers":b,"valeurs_communes":n} for a,b,n in modifs]
        json.dump(ext, open(fe,"w"), ensure_ascii=False, indent=2)
        for a,b,n in modifs: rapport.append((t,a,"->",b,f"{n} valeurs communes"))
    else:
        rapport.append((t,"-","aucune correspondance par valeurs",""))
for r in rapport: print(*r)
