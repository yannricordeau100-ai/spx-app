#!/usr/bin/env python3
"""Mission sp5001000, etape 2 : recense les documents deja presents sur le Mac pour les
societes de data-lake/_sp5001000/liste.json et COPIE l utile dans data-lake/<T>/.
Sources : data-lake/<T> (en place), ~/Mettrik/sec-data/cat1-us/{10K,10Q,8K,DEF14A}/<annee>/,
~/Mettrik/docs/<T>/, ~/Desktop/Projets 2025 26/App KPI/DATA/<T>/, ~/Mettrik/sec-data/{cat1-us,cat3-european,}/<T>/,
ancien lac dans la corbeille. Documents SEC copies a partir du 2016-10-09 (10 ans).
Transcripts copies seulement si le texte cite la societe (les transcripts Fool locaux sont souvent contamines).
Sortie : data-lake/_sp5001000/existant.json. Idempotent. Usage : python3 scripts/sp5001000-existant.py [--simulation]"""
import json, os, re, shutil, sys, gzip, collections, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = f"{ROOT}/data-lake"; M = f"{LAKE}/_sp5001000"
H = os.path.expanduser("~")
SINCE = "2016-10-09"
SIM = "--simulation" in sys.argv
L = json.load(open(f"{M}/liste.json"))
SOC = [r for r in L["societes"] if not r.get("radiee")]  # radiees : rien a rapatrier
SEC = f"{H}/Mettrik/sec-data"; DOCS = f"{H}/Mettrik/docs"; OLD = f"{H}/Desktop/Projets 2025 26/App KPI/DATA"
TRASH = f"{H}/.Trash/data-lake-second-lac-8oct"
DMAP = {"10-K": "10K", "10-Q": "10Q", "8-K": "8K", "DEF14A": "DEF14A", "DEF 14A": "DEF14A", "ER": "ER",
        "supplement": "ES", "transcript": "transcripts", "10K": "10K", "10Q": "10Q", "8K": "8K", "S-1": "S1", "S-4": "S4"}
RE_D = re.compile(r"(\d{4}-\d{2}-\d{2})")
RE_ACC = re.compile(r"(\d{10}-\d{2}-\d{6})")

# index cat1-us par ticker (un seul passage)
cat1 = collections.defaultdict(list)
for f in ["10K", "10Q", "8K", "DEF14A"]:
    for p in glob.glob(f"{SEC}/cat1-us/{f}/*/*"):
        b = os.path.basename(p); cat1[(b.split("_")[0], f)].append(p)

def cle(dossier, nom):
    d = RE_D.search(nom); a = RE_ACC.search(nom)
    if dossier == "8K" and a: return (dossier, a.group(1), nom.split(a.group(1))[-1])
    if a: return (dossier, a.group(1))
    return (dossier, d.group(1) if d else nom)

def presents(t):
    """cles des documents deja dans data-lake/<T> (date seule ET accession, pour dedoublonner)"""
    s = set()
    base = f"{LAKE}/{t}"
    if not os.path.isdir(base): return s
    for d in os.listdir(base):
        p = f"{base}/{d}"
        if not os.path.isdir(p): continue
        for n in os.listdir(p):
            s.add(cle(d, n)); m = RE_D.search(n)
            if m and d != "8K": s.add((d, m.group(1)))
            a = RE_ACC.search(n)
            if a: s.add((d, a.group(1)))
    return s

def mots(nom):
    stop = {"inc", "corp", "corporation", "holdings", "group", "company", "the", "ltd", "plc", "class", "trust", "technologies", "international"}
    return [w for w in re.findall(r"[a-z]{4,}", (nom or "").lower()) if w not in stop][:2]

def cite(p, nom, t):
    try:
        raw = gzip.open(p).read(400000) if p.endswith(".gz") else open(p, "rb").read(400000)
        s = raw.decode("utf-8", "ignore").lower()
    except Exception:
        return False
    w = mots(nom)
    return bool(w) and (w[0] in s) or f"({t.lower()})" in s or f"nyse: {t.lower()}" in s or f"nasdaq: {t.lower()}" in s

def copie(src, dst):
    if SIM: return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(os.path.realpath(src), dst)

res = {"_note": "Recensement des documents deja presents sur le Mac (etape 2). 'en_place' = deja dans data-lake/<T> avant la mission ; 'copies' = copies par ce script ; 'ignores' = vus mais non copies (raison).",
       "genere_le": __import__("datetime").datetime.now().isoformat(timespec="seconds"), "sources": [LAKE, f"{SEC}/cat1-us", DOCS, OLD, f"{SEC}/cat3-european", TRASH, f"{H}/Downloads", f"{H}/spx-quant-engine"],
       "societes": {}}
tot = collections.Counter()
for r in SOC:
    t = r["ticker"]; nom = r["nom"]
    e = {"en_place": {}, "copies": collections.Counter(), "ignores": collections.Counter(), "autres_sources": []}
    base = f"{LAKE}/{t}"
    if os.path.isdir(base):
        for d in sorted(os.listdir(base)):
            p = f"{base}/{d}"
            e["en_place"][d] = len(os.listdir(p)) if os.path.isdir(p) else 1
    have = presents(t)
    cands = []  # (src, dossier, nom_dest, verif_transcript)
    for f in ["10K", "10Q", "8K", "DEF14A"]:
        for p in cat1.get((t, f), []): cands.append((p, f, os.path.basename(p), False, "sec-data/cat1-us"))
    for racine, lab in [(f"{DOCS}/{t}", "Mettrik/docs"), (f"{OLD}/{t}", "Desktop/App KPI/DATA"), (f"{TRASH}/{t}", "corbeille/data-lake-second-lac-8oct")]:
        if not os.path.isdir(racine): continue
        for d in os.listdir(racine):
            p = f"{racine}/{d}"
            if not os.path.isdir(p):
                if d not in ("INDEX.json", ".DS_Store"): e["ignores"][f"{lab}/{d} (hors classement)"] += 1
                continue
            dest = DMAP.get(d)
            for n in os.listdir(p):
                if n.startswith("."): continue
                if not dest: e["ignores"][f"{lab}/{d} (dossier non classe)"] += 1; continue
                cands.append((f"{p}/{n}", dest, n, dest == "transcripts", lab))
    for src, dest, n, verif, lab in cands:
        m = RE_D.search(n)
        if dest not in ("transcripts", "ER", "ES") and m and m.group(1) < SINCE:
            e["ignores"][f"{lab} {dest} avant {SINCE}"] += 1; continue
        k = cle(dest, n); m2 = RE_D.search(n); a = RE_ACC.search(n)
        if k in have or (a and (dest, a.group(1)) in have) or (dest != "8K" and m2 and (dest, m2.group(1)) in have):
            e["ignores"][f"{lab} {dest} deja present"] += 1; continue
        if verif and not cite(src, nom, t):
            e["ignores"][f"{lab} transcript ne citant pas la societe (contamine)"] += 1; continue
        copie(src, f"{base}/{dest}/{n}")
        have.add(k)
        if m2 and dest != "8K": have.add((dest, m2.group(1)))
        if a: have.add((dest, a.group(1)))
        e["copies"][dest] += 1; tot[dest] += 1
    # autres sources : rapports annuels et instantanes de pages (copies dans ir/ si le PDF cite la societe)
    for racine in [f"{SEC}/cat3-european/{t}", f"{SEC}/cat1-us/{t}", f"{SEC}/{t}"]:
        if not os.path.isdir(racine): continue
        for dp, dn, fn in os.walk(racine):
            for n in fn:
                if n.startswith("."): continue
                p = f"{dp}/{n}"; sous = os.path.relpath(dp, racine)
                ok = False
                if n.endswith((".pdf", ".txt")):
                    txt = ""
                    if n.endswith(".txt"): txt = open(p, errors="ignore").read(200000).lower()
                    else:
                        try:
                            import subprocess
                            txt = subprocess.run(["pdftotext", "-l", "3", p, "-"], capture_output=True, timeout=60).stdout.decode("utf-8", "ignore").lower()
                        except Exception: txt = ""
                    w = mots(nom); ok = bool(w) and w[0] in txt
                e["autres_sources"].append({"fichier": p.replace(H, "~"), "cite_la_societe": ok})
                if ok:
                    dst = f"{base}/ir/{sous.replace('/', '_')}/{t}_{n}"
                    if not os.path.exists(dst): copie(p, dst); e["copies"]["ir"] += 1; tot["ir"] += 1
    e["copies"] = dict(e["copies"]); e["ignores"] = dict(e["ignores"])
    res["societes"][t] = e
res["totaux_copies"] = dict(tot)
res["n_societes_avec_existant"] = sum(1 for v in res["societes"].values() if v["copies"] or any(k not in ("governance", "kpis") for k in v["en_place"]))
# Downloads, Documents, spx-quant-engine : rien d utile trouve au 9 oct (cours Invvest en PDF, CSV de prix) ; trace ci-dessous
res["recherche_hors_lac"] = {"~/Downloads, ~/Desktop, ~/Documents": "balayage des noms de fichiers par ticker et nom de societe le 9 oct 2026 : seuls des PDF de cours Invvest (SNOW, AFRM) et des CSV de prix, aucun document de societe ; ~/Desktop/Projets 2025 26/App KPI/DATA traite ci-dessus",
                             "~/spx-quant-engine/data": "aucun dossier par ticker",
                             "~/.Trash/data-lake-second-lac-8oct": "225 dossiers, aucun ticker de la liste"}
if not SIM:
    json.dump(res, open(f"{M}/existant.json", "w"), indent=1, ensure_ascii=False)
print("copies", dict(tot), "| stes avec existant", res["n_societes_avec_existant"])
