#!/usr/bin/env python3
"""Verification du raccordement d une societe (13 sept 2026) : artefacts et listes.
  python3 scripts/verif-societe.py RDDT [--json]
Sort en code 1 si un element obligatoire manque."""
import json,os,sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T=sys.argv[1].upper(); t=T.lower()
def ex(p): return os.path.exists(os.path.join(ROOT,p))
def js(p):
    try: return json.load(open(os.path.join(ROOT,p)))
    except Exception: return None
obl={
 "v2-pipeline":f"src/data/v2-pipeline/{t}.json","v2-pipeline-enrich":f"src/data/v2-pipeline-enrich/{t}.json","kpis-haut":f".batches-drafts-safe/kpis-haut/{T}.json",
 "transcript":f"src/data/transcripts/{t}.json","synthese":f"src/data/transcript-summaries/{t}.json","anti-these":f"src/data/att/{t}.json","logo":f"public/logos/{T}.png",
 "ranks":f"src/data/v2-pipeline-enrich/{t}.ranks.json","tam":f"src/data/v2-pipeline-enrich/{t}.tam.json","cahier-donnees":f"docs/cahier/donnees/{T}.json","cahier-tam":f"docs/cahier/tam/{T}.json","cahier-clients":f"docs/cahier/clients/{T}.json",
 "i18n-en":f"src/data/v2-pipeline-i18n/{t}.en.json","i18n-de":f"src/data/v2-pipeline-i18n/{t}.de.json","data-lake":f"data-lake/{T}",
}
res={"artefacts":{k:ex(p) for k,p in obl.items()},"listes":{}}
def dans(p,cle=None):
    j=js(p)
    if j is None: return None
    s=json.dumps(j)
    return f'"{T}"' in s or f'"{t}"' in s
for p in ["src/data/v1-9-5-clean-all-tickers.json","src/data/v1-7-public.json","src/data/societes-gics.json","src/data/market-cap-order.json","src/data/earnings-calendar.json","src/data/compare-index.json","src/data/kpi-industries-etat.json","src/data/indices-composition.json","src/data/ir-directory.json","src/data/kpi-classification.json","docs/cahier/societes-gics.json"]:
    res["listes"][p.split("/")[-1]]=dans(p)
fiche=js(obl["v2-pipeline"]) or {}
kp=[k for k in fiche.get("kpis",[]) if len(k.get("history") or [])>=5]
haut=js(obl["kpis-haut"]) or {}
res["contenu"]={"kpis_5ans":len(kp),"kpis_haut":len(haut.get("kpis",[])),"risques":len(fiche.get("risks") or []),"gouvernance":bool(fiche.get("governance")),"positionnement_ia":bool(fiche.get("ai_positioning")),"hero":fiche.get("hero_kpi"),"gics":fiche.get("gics_code"),"repartition":bool((js(obl["v2-pipeline-enrich"]) or {}).get("revenue_by_segment"))}
manque=[k for k,v in res["artefacts"].items() if not v]+[k for k,v in res["listes"].items() if v is False]
# carte-pays-kpis et home-wow-kpis sont des selections curatees : informatif seulement
res["listes"]["carte-pays-kpis.json (curatee)"]=dans("src/data/carte-pays-kpis.json"); res["listes"]["home-wow-kpis.json (curatee)"]=dans("src/data/home-wow-kpis.json")
manque=[m for m in manque if "curatee" not in m]
res["manque"]=manque
if "--json" in sys.argv: print(json.dumps(res,ensure_ascii=False,indent=1))
else:
    print(T,"| artefacts manquants :",[k for k,v in res["artefacts"].items() if not v]); print("   listes sans la societe :",[k for k,v in res["listes"].items() if v is False]); print("   contenu :",res["contenu"])
sys.exit(1 if manque else 0)
