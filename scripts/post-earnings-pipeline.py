#!/usr/bin/env python3
"""post-earnings-pipeline.py (Yann 18 sept 2026)

Chaine automatique apres chaque publication de resultats :
  1. attendre le delai de mise a disposition des documents propre au pays,
  2. tenter le telechargement des documents, plusieurs fois sur plusieurs jours,
  3. lancer l extraction des KPI IMMEDIATEMENT apres chaque telechargement,
  4. tenir un journal d etat qui alimente l alerte (rouge seulement a J+7 si les
     KPI n ont pas bouge, jamais parce qu un document manque).

Lance toutes les heures par cron local. Idempotent, reprend ou il s arrete.

Usage :
  python3 scripts/post-earnings-pipeline.py            # fenetre normale
  python3 scripts/post-earnings-pipeline.py --tickers A,MC.PA
  python3 scripts/post-earnings-pipeline.py --fenetre 20 --sec
  python3 scripts/post-earnings-pipeline.py --simulation   # rien n est ecrit
  python3 scripts/post-earnings-pipeline.py --max-rattrapage 5

8 oct 2026, deux causes de retard corrigees (CAG, NKE, MKC, FDS, JBL, MU, ACN,
STZ et 12 semestriels europeens restes au 31/12/2025) :
  1. l inventaire EDGAR vivait dans /tmp et avait disparu : plus aucun CIK, les
     societes americaines partaient vers la veille IR europeenne. Il vit
     desormais dans .conv-state/edgar_inventaire.json, il est regenere s il
     manque, et les CIK sont aussi relus dans les cartes du depot ;
  2. l extraction n etait lancee que si CE script venait de telecharger un
     document. Un document arrive par un autre veilleur n etait jamais extrait.
     L extraction se declenche maintenant pour tout document de resultats du
     data-lake plus recent que la derniere periode affichee, une fois par
     document, y compris hors de la fenetre de 14 jours (passe de rattrapage).
"""
import json, os, re, ssl, subprocess, sys, time, datetime, glob, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT = os.path.join(ROOT, ".conv-state", "post-earnings-etat.json")
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "Mettrik research ricordeauyann@gmail.com"}
AUJ = datetime.date.today()

def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d

FENETRE = int(arg("--fenetre", "14"))
SIMULATION = "--simulation" in sys.argv
MAX_RATTRAPAGE = int(arg("--max-rattrapage", "5"))
INVENTAIRE = os.path.join(ROOT, ".conv-state", "edgar_inventaire.json")
SUFFIXES_HORS_US = (".PA", ".DE", ".AS", ".SW", ".MI", ".MC", ".BR", ".LS", ".VI",
                    ".CO", ".ST", ".HE", ".OL", ".L")
DEPOSANTS_SEC_LEGITIMES = {"AMRZ.SW"}

# Dossiers du data-lake qui portent des documents de RESULTATS (communique,
# rapport trimestriel ou semestriel, presentation). Les mêmes que
# earnings-refresh.py, qui fait l extraction.
DOCS_RESULTATS_US = ("10Q", "10K", "8K", "ER", "EP", "20F", "6K")
DOCS_RESULTATS_EU = ("ir/CP", "ir/SLIDES", "ir/TRIM", "ir/RFS", "ir/URD", "ir/SEMESTRIEL",
                     "ir/PRESENTATION", "ir/S1", "ir/COMMUNIQUES", "ir/COMMUNIQUE", "ir/PRES")
# Duree d une periode selon la cadence des KPI : un document date de plus d une
# periode (plus une semaine) apres la fin de la derniere periode affichee porte
# forcement une periode posterieure. Le rapport annuel de la periode affichee
# (10-K a 60 jours, URD europeen a 120 jours) ne declenche donc rien.
DUREE_PERIODE = {"quarterly": 91, "semiannual": 182, "annual": 365}
MARGE_JOURS = 7

# Delai, en jours, entre la publication des resultats et le moment ou les
# documents sont reellement telechargeables. Mesure par place de cotation :
# le communique sort le jour meme partout, le rapport complet plus tard.
DELAIS = {
    "US":  {"premier": 0, "complet": 3},   # 8-K le jour meme, 10-Q sous 3 jours
    ".PA": {"premier": 0, "complet": 2},   # communique le matin, PDF complet J+1
    ".DE": {"premier": 0, "complet": 2},
    ".AS": {"premier": 0, "complet": 2},
    ".BR": {"premier": 0, "complet": 2},
    ".SW": {"premier": 0, "complet": 1},
    ".MC": {"premier": 0, "complet": 2},
    ".MI": {"premier": 0, "complet": 2},
    ".LS": {"premier": 0, "complet": 3},
    ".L":  {"premier": 0, "complet": 1},
    ".ST": {"premier": 0, "complet": 1},
    ".OL": {"premier": 0, "complet": 1},
    ".CO": {"premier": 0, "complet": 1},
    ".HE": {"premier": 0, "complet": 1},
}
ALERTE_JOURS = 7   # rouge seulement au dela, et seulement si les KPI n ont pas bouge
RETENTE_JUSQUA = 12  # on retente le telechargement jusqu a J+12

def place(t):
    if "." not in t: return "US"
    s = "." + t.rsplit(".", 1)[1]
    return s if s in DELAIS else "US"

def lire(p, d=None):
    try:
        with open(p, encoding="utf8") as f: return json.load(f)
    except Exception: return d

def dates_locales(t):
    """dernier document present par dossier du data-lake"""
    out = {}
    base = os.path.join(ROOT, "data-lake", t)
    if not os.path.isdir(base): return out
    for d in os.listdir(base):
        p = os.path.join(base, d)
        if not os.path.isdir(p): continue
        ds = [m.group(0) for n in os.listdir(p) for m in [re.search(r"\d{4}-\d{2}-\d{2}", n)] if m]
        if ds: out[d] = max(ds)
    return out

def kpi_maj(t):
    """date de derniere mise a jour des KPI de la fiche"""
    cands = [os.path.join(ROOT, ".batches-drafts-safe", "kpis-haut", f"{t.upper()}.json"),
             os.path.join(ROOT, "src", "data", "v2-pipeline", f"{t.lower()}.json")]
    best = None
    for p in cands:
        d = lire(p)
        if not d: continue
        ks = d.get("kpis") if isinstance(d, dict) else d
        for k in (ks or []):
            # `last_data_date` est la fin de la periode couverte par la donnee,
            # pas la date du traitement : l utiliser faisait passer pour "a jour"
            # des fiches dont les KPI dataient de mai (Yann, 21 sept 2026).
            for champ in ("_maj_le", "_extrait_le"):
                v = k.get(champ) if isinstance(k, dict) else None
                if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
                    v = v[:10]
                    if v > AUJ.isoformat(): continue   # date future : ignoree
                    if best is None or v > best: best = v
    return best

def depose_a_la_sec(t):
    t = t.upper()
    return t in DEPOSANTS_SEC_LEGITIMES or not t.endswith(SUFFIXES_HORS_US)

def charge_cik():
    """CIK par ticker. L inventaire est regenere s il manque ; les cartes du
    depot servent de filet, pour qu une societe americaine ne parte JAMAIS vers
    la veille IR europeenne faute d inventaire."""
    if not os.path.exists(INVENTAIRE) and not SIMULATION:
        try:
            subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "edgar-inventaire.py")],
                           cwd=ROOT, timeout=1800, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    out = {}
    for p in (os.path.join(ROOT, "sec-data", "_meta", "ticker-cik-map.json"),
              os.path.join(ROOT, ".conv-state", "quarterly-refresh-cik-map.json")):
        for k, v in (lire(p, {}) or {}).items():
            if isinstance(v, dict): v = v.get("cik") or v.get("cik_str")
            if v: out[k.upper().replace("-", ".")] = v
    for k, v in ((lire(INVENTAIRE, {}) or {}).get("stes") or {}).items():
        if (v or {}).get("cik"): out[k.upper()] = v["cik"]
    return out

def cik_de(CIK, t):
    if not depose_a_la_sec(t): return None
    return CIK.get(t.upper()) or CIK.get(t.upper().replace("-", "."))

def _cadence(k):
    f = (k.get("frequency") or "").lower()
    f = {"year": "annual", "yearly": "annual", "fy": "annual", "quarter": "quarterly",
         "semester": "semiannual", "half": "semiannual"}.get(f, f)
    if not f:
        f = {"year": "annual", "annual": "annual", "quarter": "quarterly", "quarterly": "quarterly",
             "semester": "semiannual", "semiannual": "semiannual", "half": "semiannual"}.get(
             (k.get("period_type") or "").lower(), "")
    return f if f in DUREE_PERIODE else None

def fin_affichee(t):
    """Fin de la derniere periode affichee par la MAJORITE des KPI periodiques
    (hors stories) : mediane de last_data_date, avec la cadence la plus courte
    presente. Un KPI mis a jour seul ne masque pas les autres restes en retard
    (MKC : 4 KPI sur 58 au T3, 40 au T2)."""
    for p in (os.path.join(ROOT, ".batches-drafts-safe", "kpis-haut", f"{t.upper()}.json"),
              os.path.join(ROOT, "src", "data", "v2-pipeline", f"{t.lower()}.json")):
        d = lire(p)
        ks = (d.get("kpis") if isinstance(d, dict) else d) or []
        dates, cad = [], set()
        for k in ks:
            if not isinstance(k, dict) or k.get("story_category") or not k.get("history"): continue
            c = _cadence(k)
            v = k.get("last_data_date")
            if not c or not isinstance(v, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", v[:10]): continue
            if v[:10] > AUJ.isoformat(): continue
            dates.append((v[:10], c)); cad.add(c)
        if dates:
            # Mediane prise sur les seuls KPI de la cadence la plus courte : les
            # KPI annuels restent legitimement sur FY2025 jusqu au rapport annuel
            # et ne doivent pas faire croire qu un semestre manque (MC.PA).
            courte = min(cad, key=lambda c: DUREE_PERIODE[c])
            dates = sorted(x for x, c in dates if c == courte)
            return dates[(len(dates) - 1) // 2], courte
    return None, None

def doc_resultats_recent(t):
    """Document de resultats le plus recent du data-lake, quelle que soit la
    facon dont il est arrive (ce script, daily-doc-watcher, fr-doc-watcher,
    telechargement manuel)."""
    base = os.path.join(ROOT, "data-lake", t)
    dirs = (DOCS_RESULTATS_US + DOCS_RESULTATS_EU) if depose_a_la_sec(t) else DOCS_RESULTATS_EU
    best = None
    for rel in dirs:
        p = os.path.join(base, rel)
        if not os.path.isdir(p): continue
        for n in os.listdir(p):
            m = re.search(r"20\d{2}-\d{2}-\d{2}", n)
            if m and m.group(0) <= AUJ.isoformat() and (best is None or m.group(0) > best):
                best = m.group(0)
    return best

def a_extraire(t, st):
    """Vrai si un document de resultats plus recent que la derniere periode
    affichee n a pas encore ete soumis a l extraction."""
    fin, cad = fin_affichee(t)
    doc = doc_resultats_recent(t)
    st["fin_affichee"], st["doc_resultats"] = fin, doc
    if not fin or not doc: return False
    seuil = datetime.date.fromisoformat(fin) + datetime.timedelta(days=DUREE_PERIODE[cad] + MARGE_JOURS)
    if datetime.date.fromisoformat(doc) <= seuil: return False
    return (st.get("extraction") or {}).get("doc") != doc

def telecharge_sec(t, cik, depuis):
    """telecharge les depots EDGAR posterieurs a `depuis` qui manquent"""
    MAP = {"10-K": "10K", "10-Q": "10Q", "8-K": "8K", "DEF 14A": "DEF14A", "20-F": "20F", "6-K": "6K"}
    n = 0
    try:
        u = f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"
        j = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), context=CTX, timeout=40).read())
    except Exception as e:
        return 0, f"EDGAR injoignable ({str(e)[:50]})"
    r = j["filings"]["recent"]
    for form, date, acc, prim in zip(r["form"], r["filingDate"], r["accessionNumber"], r["primaryDocument"]):
        d = MAP.get(form.strip())
        if not d or date < depuis: continue
        dossier = os.path.join(ROOT, "data-lake", t, d)
        os.makedirs(dossier, exist_ok=True)
        p = os.path.join(dossier, f"{t}_{date}_{acc}.htm.gz")
        if os.path.exists(p) or os.path.exists(os.path.join(dossier, f"{t}_{date}.htm.gz")): continue
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-','')}/{prim}"
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=CTX, timeout=60).read()
        except Exception:
            try:
                b = urllib.request.urlopen(urllib.request.Request(
                    f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}.txt", headers=UA), context=CTX, timeout=60).read()
            except Exception:
                continue
        import gzip
        with gzip.open(p, "wb") as f: f.write(b)
        n += 1
        time.sleep(0.15)
        if d == "8K":
            n += telecharge_communique(t, cik, date, acc)
    return n, None

def telecharge_communique(t, cik, date, acc):
    """Le document principal d un 8-K n est que la page de garde : les chiffres
    sont dans l exhibit 99 (communique de resultats). Sans lui, une societe qui
    clot son exercice (FDS, JBL, MU, ACN : pas de 10-Q au T4, 10-K six semaines
    plus tard) restait sans aucun chiffre a extraire (8 oct 2026)."""
    dossier = os.path.join(ROOT, "data-lake", t, "ER")
    if glob.glob(os.path.join(dossier, f"{t}_{date}_ER*")): return 0
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}"
    try:
        idx = json.loads(urllib.request.urlopen(urllib.request.Request(base + "/index.json", headers=UA),
                                                context=CTX, timeout=40).read())
    except Exception:
        return 0
    noms = []
    for it in idx.get("directory", {}).get("item", []):
        nom, taille = it.get("name", ""), int(it.get("size") or 0)
        if not nom.lower().endswith((".htm", ".html")) or nom.startswith(("R", acc)): continue
        if re.search(r"ex(?:hibit)?[-_]?99|earnings|results|release|pressrelease", nom, re.I) and taille > 30000:
            noms.append(nom)
    n = 0
    for k, nom in enumerate(noms[:2]):
        try:
            b = urllib.request.urlopen(urllib.request.Request(f"{base}/{nom}", headers=UA), context=CTX, timeout=60).read()
        except Exception:
            continue
        os.makedirs(dossier, exist_ok=True)
        with open(os.path.join(dossier, f"{t}_{date}_ER{'' if k == 0 else '_' + str(k + 1)}.html"), "wb") as f:
            f.write(b)
        n += 1
        time.sleep(0.15)
    return n

def telecharge_ir(t):
    """veille IR pour une societe hors EDGAR ; s appuie sur le watcher existant"""
    # fr-doc-watcher couvre TOUTES les societes europeennes de l univers depuis
    # le 26 aout 2026 (CAC, SMI, DAX, AEX, Bruxelles et le reste via l annuaire IR).
    p = os.path.join(ROOT, "scripts", "fr-doc-watcher.py")
    if not os.path.exists(p): return 0, f"pas de veille pour {t}"
    avant = len(glob.glob(os.path.join(ROOT, "data-lake", t, "**", "*"), recursive=True))
    try:
        subprocess.run([sys.executable, p, f"--tickers={t}"], cwd=ROOT, timeout=240,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        return 0, f"veille IR en echec ({str(e)[:40]})"
    apres = len(glob.glob(os.path.join(ROOT, "data-lake", t, "**", "*"), recursive=True))
    return max(0, apres - avant), None

def extrait(t):
    """Extraction des KPI de la fiche par la chaine existante earnings-refresh.py
    (moteurs gratuits, preuve mot pour mot, garde-fous d echelle, de periode et
    de trou ; a defaut de moteur, dossier de travail dans .conv-state/earnings-inbox).
    Les anciens appels (extract_quarterly, extract_kpis_batch) n ecrivaient
    rien sur la fiche : ils lisaient sec-data et une liste /tmp."""
    # Interrupteur (8 oct 2026) : tant que ce fichier existe, aucune extraction
    # n est declenchee par ce script (detection et journal continuent).
    if os.path.exists(os.path.join(ROOT, ".conv-state", "post-earnings-extraction-off")):
        return {"scripts": [], "resultat": "extraction neutralisee (.conv-state/post-earnings-extraction-off)"}
    p = os.path.join(ROOT, "scripts", "earnings-refresh.py")
    if not os.path.exists(p): return {"scripts": [], "resultat": "earnings-refresh.py absent"}
    a = [f"--tickers={t}", "--dry-run" if SIMULATION else "--apply"]
    try:
        r = subprocess.run([sys.executable, p, *a], cwd=ROOT, timeout=900, capture_output=True, text=True)
        lignes = [l for l in (r.stdout or "").splitlines() if f"ticker={t}" in l]
        return {"scripts": ["earnings-refresh.py " + " ".join(a)], "resultat": (lignes[-1][-300:] if lignes else (r.stderr or "")[-200:])}
    except Exception as e:
        return {"scripts": ["earnings-refresh.py"], "resultat": f"echec {str(e)[:80]}"}

def main():
    cal = lire(os.path.join(ROOT, "src/data/earnings-calendar.json"), {}) or {}
    par = cal.get("par_ticker", {})
    CIK = charge_cik()
    etat = lire(ETAT, {"maj": None, "stes": {}}) or {"maj": None, "stes": {}}
    cibles = [x.strip().upper() for x in (arg("--tickers") or "").split(",") if x.strip()]
    if not cibles:
        for t, v in par.items():
            d = v.get("precedente")
            if not d: continue
            try: j = (AUJ - datetime.date.fromisoformat(d)).days
            except Exception: continue
            if 0 <= j <= FENETRE: cibles.append(t.upper())
    res = []
    for t in cibles:
        v = par.get(t) or par.get(t.upper()) or {}
        dres = v.get("precedente")
        if not dres:
            continue
        j = (AUJ - datetime.date.fromisoformat(dres)).days
        pl = place(t); dl = DELAIS[pl]
        st = etat["stes"].setdefault(t, {"resultats": dres, "place": pl, "tentatives": [], "telecharges": 0})
        if st.get("resultats") != dres:  # nouveau trimestre : on repart de zero
            st.update({"resultats": dres, "tentatives": [], "telecharges": 0, "extraction": None, "alerte": None})
        st["place"] = pl
        if j < dl["premier"]:
            st["statut"] = "attente du delai de mise a disposition"; res.append((t, st["statut"], 0)); continue
        n, err = (0, None)
        if j <= RETENTE_JUSQUA and not SIMULATION:
            cik = cik_de(CIK, t)
            if cik:
                n, err = telecharge_sec(t, cik, dres)
            elif depose_a_la_sec(t):
                # Jamais la veille IR europeenne pour une societe americaine.
                n, err = 0, "CIK introuvable (inventaire EDGAR et cartes du depot)"
            else:
                n, err = telecharge_ir(t)
            st["tentatives"].append({"le": AUJ.isoformat(), "nouveaux": n, "erreur": err})
            st["tentatives"] = st["tentatives"][-20:]
            st["telecharges"] = st.get("telecharges", 0) + n
        # Extraction des qu un document de resultats plus recent que la periode
        # affichee est present, qu il vienne de ce script ou d un autre veilleur.
        if a_extraire(t, st) and not os.path.exists(os.path.join(ROOT, ".conv-state", "post-earnings-extraction-off")):
            st["extraction"] = {"le": datetime.datetime.now().isoformat(timespec="seconds"),
                                "doc": st["doc_resultats"], **extrait(t)}
            if SIMULATION: st["extraction"]["simulation"] = True
            print(f"  extraction {t} (document du {st['doc_resultats']}, periode affichee {st['fin_affichee']}) : {st['extraction'].get('resultat', '')[:240]}")
        loc = dates_locales(t)
        doc_recent = max([d for d in loc.values() if d], default=None)
        st["dernier_document"] = doc_recent
        st["kpi_maj_le"] = kpi_maj(t)
        a_jour = bool(st["kpi_maj_le"] and st["kpi_maj_le"] >= dres)
        if a_jour:
            st["statut"] = "a jour"; st["alerte"] = None
        elif j < ALERTE_JOURS:
            st["statut"] = ("documents recuperes, extraction en cours" if (doc_recent and doc_recent >= dres)
                            else f"documents attendus, tentative {len(st['tentatives'])}")
            st["alerte"] = None
        else:
            st["statut"] = "KPI non mis a jour"
            st["alerte"] = f"rouge : {j} jours apres la publication du {dres}, KPI non mis a jour"
        res.append((t, st["statut"], n))
    # Passe de rattrapage : toute societe de l univers, hors fenetre, dont un
    # document de resultats est plus recent que la periode affichee (cas des
    # semestriels europeens publies fin juillet et restes au 31/12/2025).
    if not arg("--tickers"):
        univ = (lire(os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"), {}) or {}).get("tickers", [])
        rat = etat.setdefault("rattrapage", {})
        faits = 0
        for t in univ:
            if faits >= MAX_RATTRAPAGE: break
            t = t.upper()
            if t in cibles: continue
            sr = rat.setdefault(t, {})
            if os.path.exists(os.path.join(ROOT, ".conv-state", "post-earnings-extraction-off")): break
            if not a_extraire(t, sr):
                if not sr.get("extraction"): rat.pop(t, None)
                continue
            sr["extraction"] = {"le": datetime.datetime.now().isoformat(timespec="seconds"),
                                "doc": sr["doc_resultats"], **extrait(t)}
            if SIMULATION: sr["extraction"]["simulation"] = True
            print(f"  rattrapage {t} (document du {sr['doc_resultats']}, periode affichee {sr['fin_affichee']}) : {sr['extraction'].get('resultat', '')[:240]}")
            res.append((t, f"rattrapage : document du {sr['doc_resultats']} > periode affichee {sr['fin_affichee']}", 0))
            faits += 1
    etat["maj"] = datetime.datetime.now().isoformat(timespec="seconds")
    etat["regles"] = {"delais_par_place": DELAIS, "alerte_jours": ALERTE_JOURS, "retente_jusqua": RETENTE_JUSQUA}
    if not SIMULATION:
        os.makedirs(os.path.dirname(ETAT), exist_ok=True)
        json.dump(etat, open(ETAT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    al = [t for t, s, _ in res if s == "KPI non mis a jour"]
    print(f"societes en fenetre {len(res)} | documents nouveaux {sum(x[2] for x in res)} | alertes {len(al)}")
    for t, s, n in res[:40]: print(f"  {t:9} {s} {'(+' + str(n) + ' doc)' if n else ''}")

if __name__ == "__main__":
    main()
