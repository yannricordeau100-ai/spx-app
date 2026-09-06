#!/usr/bin/env python3
"""Pose des TAM arbitres par le proprietaire (7 sept 2026).
Lit les choix (desk_page_content, page tam / arbitrages : {TICKER: [ids]}) et les
candidats du Cahier (docs/cahier/tam/<T>.json), ecrit
src/data/v2-pipeline-enrich/<t>.tam.json {market_positions: [...], _arbitrage_proprietaire: true}.
Liste vide = bloc masque. Usage : python3 scripts/tam-pose.py [TICKER...]
"""
import json, os, sys, urllib.request
from datetime import date
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for l in open(os.path.join(ROOT, ".env.local")):
    if "=" in l and not l.startswith("#"):
        k, v = l.rstrip("\n").split("=", 1); env[k] = v.strip().strip('"')
U, K = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
req = urllib.request.Request(f"{U}/rest/v1/desk_page_content?select=content_fr&page_key=eq.tam&section_key=eq.arbitrages", headers={"apikey": K, "Authorization": f"Bearer {K}"})
rows = json.load(urllib.request.urlopen(req))
choix = json.loads(rows[0]["content_fr"]) if rows and rows[0].get("content_fr") else {}
def unite(u):
    u = (u or "").strip()
    return {"Mds $": "$B", "M $": "$M", "Mds €": "€B", "M €": "€M"}.get(u, u)
seuls = set(a.upper() for a in sys.argv[1:])
n = 0
for t, ids in choix.items():
    if seuls and t.upper() not in seuls: continue
    p = os.path.join(ROOT, "docs/cahier/tam", f"{t}.json")
    if not os.path.exists(p): print(t, ": pas de fichier Cahier"); continue
    d = json.load(open(p))
    cands = {c["id"]: c for c in d.get("candidats", [])}
    mp = []
    for cid in ids[:2]:
        c = cands.get(cid)
        if not c: print(t, ": candidat", cid, "introuvable"); continue
        src = c.get("tam_source") or {}
        mp.append({
            "segment_name": c["segment"],
            "segment_revenue": c["segment_revenu"], "segment_unit": unite(c["segment_unite"]),
            "tam": c["tam"], "tam_unit": unite(c["tam_unite"]),
            **({"tam_range": c["tam_fourchette"]} if c.get("tam_fourchette") else {}),
            "source": f"{src.get('titre') or src.get('url') or 'source'}",
            "source_note": f"{c.get('tam_intitule','')}. {c.get('commentaire','')} Source : {src.get('url','')}".strip(),
            **({"market_cagr": c["croissance_marche_pct"]} if isinstance(c.get("croissance_marche_pct"), (int, float)) else {}),
        })
    out = {"ticker": t, "researched_at": str(date.today()), "market_positions": mp, "_arbitrage_proprietaire": True, "_source": "docs/cahier/tam + /sandbox/tam"}
    json.dump(out, open(os.path.join(ROOT, "src/data/v2-pipeline-enrich", f"{t.lower()}.tam.json"), "w"), ensure_ascii=False, indent=2)
    n += 1
print(f"{n} fichiers tam.json ecrits")
