#!/usr/bin/env python3
"""Controle des fichiers docs/cahier/kpi/<code>.json : structure, nombres, interdits."""
import json, re, sys, glob, os
R = os.path.dirname(os.path.abspath(__file__))
en = dict(re.findall(r'"(\d{8})":\s*"([^"]+)"', open(os.path.join(R, "../../../src/lib/desk/gics-en.ts")).read()))
ann = json.load(open(os.path.join(R, "../societes-gics.json")))["societes"]
par = {}
for t, c in ann.items(): par.setdefault(c, set()).add(t)
INTERDITS = re.compile(r"\bYann\b|—|10-K|10-Q|10K|10Q|rapport annuel de|annual report of", re.I)
pb = []; ok = []
for code in sorted(en):
    f = os.path.join(R, f"{code}.json")
    if not os.path.exists(f): pb.append((code, "fichier absent")); continue
    try: d = json.load(open(f))
    except Exception as e: pb.append((code, f"JSON invalide : {e}")); continue
    err = []
    if str(d.get("code")) != code: err.append("code different")
    k = d.get("kpis") or []
    org = [x for x in k if (x.get("type") or "organique") == "organique"]
    comp = [x for x in k if x.get("type") == "complementaire"]
    if not (3 <= len(org) <= 6): err.append(f"{len(org)} organiques (attendu 3-5, 6 max)")
    if len(comp) > 3: err.append(f"{len(comp)} complementaires (max 3)")
    shorts = [x.get("short") for x in k]
    if len(set(shorts)) != len(shorts): err.append("shorts en double")
    for x in k:
        for champ in ("short", "nom_fr", "nom_en", "type", "definition", "unite", "frequence", "source_habituelle", "reference_standard", "statut"):
            if not x.get(champ): err.append(f"{x.get('short','?')} : champ {champ} vide")
        if x.get("statut") != "a_verifier": err.append(f"{x.get('short')} : statut {x.get('statut')}")
        for t in x.get("exemples_societes") or []:
            if t not in par.get(code, set()): err.append(f"{x.get('short')} : exemple {t} hors annuaire de {code}")
        if x.get("type") not in ("organique", "complementaire"): err.append(f"{x.get('short')} : type {x.get('type')}")
    eu = d.get("cadre_europeen") or {}
    if not eu.get("esrs"): err.append("cadre_europeen.esrs vide")
    if not eu.get("esma_apm"): err.append("cadre_europeen.esma_apm vide")
    brut = open(f, encoding="utf-8").read()
    m = INTERDITS.search(brut)
    if m: err.append(f"texte interdit : {m.group(0)}")
    (pb.append((code, " ; ".join(err))) if err else ok.append(code))
print(f"OK {len(ok)} / {len(en)}  problemes {len(pb)}")
for c, e in pb: print(c, en.get(c, ""), "->", e)
sys.exit(1 if pb else 0)
