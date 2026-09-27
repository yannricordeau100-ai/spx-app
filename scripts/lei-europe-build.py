#!/usr/bin/env python3
"""Construit scripts/lei-europe.json : LEI de chaque societe europeenne de l univers (28 sept 2026).
Sert a la veille des rapports annuels (registre ESEF filings.xbrl.org). Source : GLEIF (gratuit).
Un LEI n est garde que si filings.xbrl.org a au moins un depot pour lui."""
import json, time, urllib.request, urllib.parse, ssl, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mettrik research yannricordeau100@gmail.com"}
import certifi
CTX = ssl.create_default_context(cafile=certifi.where())
def get(u):
    try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), context=CTX, timeout=40).read())
    except Exception: return None
uni = [t for t in json.load(open(f"{ROOT}/src/data/v1-9-5-clean-all-tickers.json"))["tickers"] if "." in t and t not in ("BRK.B", "BF.B")]
sortie = f"{ROOT}/scripts/lei-europe.json"
res = json.load(open(sortie)) if os.path.exists(sortie) else {}
for t in uni:
    if t in res and res[t].get("lei"): continue
    try: nom = json.load(open(f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json")).get("name") or t
    except Exception: nom = t
    trouve = None
    for q in (nom, nom.split("(")[0].strip(), nom.split(" ")[0]):
        d = get("https://api.gleif.org/api/v1/fuzzycompletions?field=entity.legalName&q=" + urllib.parse.quote(q))
        for c in (d or {}).get("data", [])[:6]:
            lei = ((c.get("relationships") or {}).get("lei-records") or {}).get("data", {}).get("id")
            if not lei: continue
            f = get(f"https://filings.xbrl.org/api/filings?filter%5Bentity.identifier%5D={lei}&page%5Bsize%5D=1")
            if f and f.get("data"):
                trouve = {"lei": lei, "nom_legal": c.get("attributes", {}).get("value"), "requete": q}; break
            time.sleep(0.3)
        if trouve: break
    res[t] = trouve or {"lei": None, "nom": nom}
    print(t, (trouve or {}).get("lei"), (trouve or {}).get("nom_legal"), flush=True)
    json.dump(res, open(sortie, "w"), ensure_ascii=False, indent=1)
print("LEI trouves", sum(1 for v in res.values() if v.get("lei")), "/", len(res))
