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
"""
import json, os, re, ssl, subprocess, sys, time, datetime, glob, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT = os.path.join(ROOT, ".conv-state", "post-earnings-etat.json")
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "Mettrik research contact@mettrik.ai"}
AUJ = datetime.date.today()

def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d

FENETRE = int(arg("--fenetre", "14"))

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
    return n, None

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
    """extraction des KPI juste apres un telechargement"""
    lancees = []
    for s, a in [("scripts/datalake/extract_quarterly.py", [f"--tickers={t}"]),
                 ("scripts/datalake/extract_kpis_batch.py", [f"--tickers={t}"])]:
        p = os.path.join(ROOT, s)
        if not os.path.exists(p): continue
        try:
            subprocess.run([sys.executable, p, *a], cwd=ROOT, timeout=900,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            lancees.append(os.path.basename(s))
        except Exception:
            pass
    return lancees

def main():
    cal = lire(os.path.join(ROOT, "src/data/earnings-calendar.json"), {}) or {}
    par = cal.get("par_ticker", {})
    inv = lire("/tmp/edgar_inventaire.json", {"stes": {}}) or {"stes": {}}
    CIK = {k.upper(): (v or {}).get("cik") for k, v in inv.get("stes", {}).items()}
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
        if j <= RETENTE_JUSQUA:
            if CIK.get(t):
                n, err = telecharge_sec(t, CIK[t], dres)
            else:
                n, err = telecharge_ir(t)
            st["tentatives"].append({"le": AUJ.isoformat(), "nouveaux": n, "erreur": err})
            st["tentatives"] = st["tentatives"][-20:]
            st["telecharges"] = st.get("telecharges", 0) + n
        if n:  # extraction IMMEDIATE apres tout nouveau document
            st["extraction"] = {"le": datetime.datetime.now().isoformat(timespec="seconds"), "scripts": extrait(t)}
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
    etat["maj"] = datetime.datetime.now().isoformat(timespec="seconds")
    etat["regles"] = {"delais_par_place": DELAIS, "alerte_jours": ALERTE_JOURS, "retente_jusqua": RETENTE_JUSQUA}
    os.makedirs(os.path.dirname(ETAT), exist_ok=True)
    json.dump(etat, open(ETAT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    al = [t for t, s, _ in res if s == "KPI non mis a jour"]
    print(f"societes en fenetre {len(res)} | documents nouveaux {sum(x[2] for x in res)} | alertes {len(al)}")
    for t, s, n in res[:40]: print(f"  {t:9} {s} {'(+' + str(n) + ' doc)' if n else ''}")

if __name__ == "__main__":
    main()
