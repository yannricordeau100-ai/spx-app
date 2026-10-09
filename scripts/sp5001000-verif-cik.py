#!/usr/bin/env python3
"""Mission sp5001000 : controle d identite des documents SEC de data-lake/<T>/ (surtout ceux rapatries
de ~/Mettrik/sec-data et ~/Mettrik/docs, ranges par ticker : un ticker reutilise peut y avoir mis les
depots d une autre societe). Chaque fichier 10K/10Q/8K/DEF14A/20F/6K/S1/S4 doit correspondre a un depot
du CIK de la societe (accession, ou forme + date pour les noms sans accession), sur les 10 ans.
Les fichiers sans date ni accession (PDF de sites IR) vont dans data-lake/<T>/ir/a_classer/.
Les fichiers etrangers sont DEPLACES (jamais supprimes) dans data-lake/<T>/_hors_cik/<dossier>/.
Ne traite que les societes dont le telechargement EDGAR est fini. 2 requetes/s.
Sortie : data-lake/_sp5001000/verif-cik.json. Usage : python3 scripts/sp5001000-verif-cik.py [--simulation]"""
import json, os, re, ssl, time, urllib.request, certifi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = f"{ROOT}/data-lake"; M = f"{LAKE}/_sp5001000"; OUT = f"{M}/verif-cik.json"
CTX = ssl.create_default_context(cafile=certifi.where()); UA = {"User-Agent": "Mettrik research ricordeauyann@gmail.com"}
SIM = "--simulation" in os.sys.argv
FORMS = {"10K": ("10-K", "10-K/A", "10-KT", "10-K405"), "10Q": ("10-Q", "10-Q/A"), "8K": ("8-K", "8-K/A"), "DEF14A": ("DEF 14A", "DEFA14A", "DEFM14A", "DEFR14A"),
         "20F": ("20-F", "20-F/A"), "6K": ("6-K", "6-K/A"), "S1": ("S-1", "F-1", "S-1/A"), "S4": ("S-4", "F-4", "S-4/A"), "40F": ("40-F",)}
def get(u):
    for k in range(5):
        try:
            time.sleep(0.5)
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60, context=CTX).read()
        except Exception:
            time.sleep(5 * (k + 1))
    return None
L = json.load(open(f"{M}/liste.json")); E = json.load(open(f"{M}/etat.json"))["societes"]
res = json.load(open(OUT)) if os.path.exists(OUT) else {"societes": {}}
RE_D = re.compile(r"\d{4}-\d{2}-\d{2}"); RE_ACC = re.compile(r"\d{10}-\d{2}-\d{6}")
for r in L["societes"]:
    t = r["ticker"]
    if r.get("radiee") or not E.get(t, {}).get("fini") or t in res["societes"]: continue
    b = get(f"https://data.sec.gov/submissions/CIK{r['cik']}.json")
    if not b: continue
    sub = json.loads(b); frames = [sub["filings"]["recent"]]
    for x in sub["filings"].get("files", []):
        bb = get(f"https://data.sec.gov/submissions/{x['name']}")
        if bb: frames.append(json.loads(bb))
    accs = set(); par_date = set()
    for fr in frames:
        for i in range(len(fr["form"])):
            accs.add(fr["accessionNumber"][i]); par_date.add((fr["form"][i], fr["filingDate"][i]))
    hors = []; nc = []
    for d, forms in FORMS.items():
        p = f"{LAKE}/{t}/{d}"
        if not os.path.isdir(p): continue
        for n in os.listdir(p):
            if n.startswith("."): continue
            a = RE_ACC.search(n); m = RE_D.search(n)
            if not a and not m:
                # document sans date ni accession (PDF de site IR range par erreur dans un dossier SEC) : vers ir/a_classer
                nc.append(f"{d}/{n}")
                if not SIM:
                    os.makedirs(f"{LAKE}/{t}/ir/a_classer", exist_ok=True); os.replace(f"{p}/{n}", f"{LAKE}/{t}/ir/a_classer/{d}_{n}")
                continue
            ok = (a.group(0) in accs) if a else (bool(m) and any((f, m.group(0)) in par_date for f in forms))
            if not ok:
                hors.append(f"{d}/{n}")
                if not SIM:
                    os.makedirs(f"{LAKE}/{t}/_hors_cik/{d}", exist_ok=True); os.replace(f"{p}/{n}", f"{LAKE}/{t}/_hors_cik/{d}/{n}")
    res["societes"][t] = {"cik": r["cik"], "n_hors_cik": len(hors), "exemples": hors[:10], "n_non_dates_vers_ir": len(nc)}
    if hors: print(t, len(hors), hors[:3], flush=True)
    json.dump(res, open(OUT, "w"), indent=1)
res["total_non_dates_vers_ir"] = sum(v.get("n_non_dates_vers_ir", 0) for v in res["societes"].values())
res["total_hors_cik"] = sum(v["n_hors_cik"] for v in res["societes"].values())
res["societes_touchees"] = sorted(t for t, v in res["societes"].items() if v["n_hors_cik"])
json.dump(res, open(OUT, "w"), indent=1)
print("fin", len(res["societes"]), "societes, fichiers hors CIK", res["total_hors_cik"])
