#!/usr/bin/env python3
"""Controle des fichiers docs/cahier/tam/<T>.json. Usage : _valide.py [TICKERS] (sans argument : tous)."""
import json,sys,glob,re,os
D=os.path.dirname(os.path.abspath(__file__))
FIAB={"haute","moyenne","faible"}
def check(p):
    pb=[]
    try: d=json.load(open(p))
    except Exception as e: return [f"json illisible : {e}"]
    t=os.path.basename(p)[:-5]
    if d.get("ticker")!=t: pb.append("ticker different du nom de fichier")
    if not isinstance(d.get("activites_principales"),list) or not d["activites_principales"]: pb.append("activites_principales vide")
    cands=d.get("candidats")
    if not isinstance(cands,list): pb.append("candidats absent"); cands=[]
    if not cands and not (d.get("commentaire") or "").strip(): pb.append("aucun candidat et commentaire vide")
    ids=set()
    for c in cands:
        cid=c.get("id")
        if not cid or cid in ids: pb.append("id de candidat absent ou doublon")
        ids.add(cid)
        for k in ("segment","tam_intitule","segment_unite","tam_unite","tam_annee","segment_exercice","fiabilite"):
            if not c.get(k): pb.append(f"{cid} : {k} manquant")
        for k in ("segment_revenu","tam"):
            if not isinstance(c.get(k),(int,float)) or c[k]<=0: pb.append(f"{cid} : {k} doit etre un nombre positif")
        if c.get("segment_unite")!=c.get("tam_unite"): pb.append(f"{cid} : unites revenu / TAM differentes")
        if isinstance(c.get("segment_revenu"),(int,float)) and isinstance(c.get("tam"),(int,float)) and c["segment_revenu"]>c["tam"]: pb.append(f"{cid} : revenu du segment superieur au TAM")
        for s in ("segment_source","tam_source"):
            src=c.get(s) or {}
            if not (isinstance(src,dict) and str(src.get("url","")).startswith("http")): pb.append(f"{cid} : {s} sans URL")
        if c.get("fiabilite") not in FIAB: pb.append(f"{cid} : fiabilite invalide")
    txt=json.dumps(d,ensure_ascii=False)
    if "—" in txt: pb.append("tiret long interdit")
    if re.search(r"\bYann\b",txt): pb.append("prenom interdit")
    return pb
args=sys.argv[1:]
files=[os.path.join(D,f"{a}.json") for a in args] if args else sorted(f for f in glob.glob(os.path.join(D,"*.json")) if not os.path.basename(f).startswith("_"))
ok=0;n=0
for f in files:
    if not os.path.exists(f): print(os.path.basename(f)[:-5],"ABSENT"); n+=1; continue
    pb=check(f)
    if pb: n+=1; print(os.path.basename(f)[:-5],"PROBLEMES:",*pb,sep="\n  ")
    else: ok+=1
print(f"OK {ok}  problemes {n}")
