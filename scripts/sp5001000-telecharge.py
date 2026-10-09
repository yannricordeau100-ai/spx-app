#!/usr/bin/env python3
"""Mission sp5001000, etape 3 : telecharge sur EDGAR tous les documents officiels sur 10 ans
des societes de data-lake/_sp5001000/liste.json (hors radiees), au format des societes existantes :
  data-lake/<T>/10K|10Q|DEF14A|20F|40F|S1|S4/<T>_<date>_<acc>.htm.gz   (document principal)
  data-lake/<T>/8K/<T>_<date>_<acc>.htm.gz + pieces EX-99 hors resultats <T>_<date>_<acc>_<piece>.gz
  data-lake/<T>/6K/... (idem, emetteurs etrangers)
  data-lake/<T>/ER/<T>_<date>_ER.htm   communique de resultats (EX-99.1 d un 8-K item 2.02)
  data-lake/<T>/ES/<T>_<date>_ES.htm   supplement chiffre / commentaire (autre EX-99 du 8-K 2.02)
  data-lake/<T>/EP/<T>_<date>_EP.pdf|htm presentation de resultats (piece nommee presentation/slides)
  data-lake/<T>/xbrl/companyfacts.json
User-Agent Mettrik research ricordeauyann@gmail.com, 8 requetes/s au plus (limite SEC 10/s), 4 fils.
Reprise : data-lake/_sp5001000/etat.json (par societe : fini, comptes par type, accessions traitees).
Arret propre si l espace libre passe sous --min-go (defaut 15).
Usage : python3 scripts/sp5001000-telecharge.py [--tickers A,B] [--fils 4] [--min-go 15]"""
import gzip, json, os, re, ssl, sys, threading, time, urllib.request, urllib.error, html as H
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import certifi
CTX = ssl.create_default_context(cafile=certifi.where())
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = f"{ROOT}/data-lake"; M = f"{LAKE}/_sp5001000"; ETAT = f"{M}/etat.json"
UA = {"User-Agent": "Mettrik research ricordeauyann@gmail.com", "Accept-Encoding": "identity"}
SINCE = "2016-10-09"
ARG = sys.argv
def opt(n, d=None): return ARG[ARG.index(n) + 1] if n in ARG else d
FILS = int(opt("--fils", "4")); MIN_GO = float(opt("--min-go", "15"))
FORMS = {"10-K": "10K", "10-K/A": "10K", "10-KT": "10K", "10-Q": "10Q", "10-Q/A": "10Q", "8-K": "8K", "8-K/A": "8K",
         "DEF 14A": "DEF14A", "20-F": "20F", "20-F/A": "20F", "40-F": "40F", "40-F/A": "40F", "6-K": "6K", "6-K/A": "6K",
         "S-1": "S1", "F-1": "S1", "S-4": "S4", "F-4": "S4"}

# ---------------------------------------------------------------- reseau
_rl = threading.Lock(); _last = [0.0]; _nreq = [0]
def get(url, tries=6):
    for k in range(tries):
        with _rl:
            dt = time.time() - _last[0]
            if dt < 0.125: time.sleep(0.125 - dt)
            _last[0] = time.time(); _nreq[0] += 1
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90, context=CTX) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if e.code in (429, 503, 500, 502) and k < tries - 1: time.sleep(10 * (k + 1)); continue
            if k < tries - 1: time.sleep(3); continue
            raise
        except Exception:
            if k < tries - 1: time.sleep(5 * (k + 1)); continue
            raise

def libre_go():
    s = os.statvfs(ROOT); return s.f_bavail * s.f_frsize / 1e9

# ---------------------------------------------------------------- etat
_el = threading.Lock()
etat = json.load(open(ETAT)) if os.path.exists(ETAT) else {"societes": {}}
def sauve():
    with _el:
        etat["maj"] = datetime.now().isoformat(timespec="seconds")
        s = etat["societes"]
        try: _r = {"n_finies": sum(1 for v in s.values() if v.get("fini")), "n_en_cours_ou_erreur": sum(1 for v in s.values() if not v.get("fini")),
                          "docs_par_type": {k: sum(v.get("n", {}).get(k, 0) for v in s.values()) for k in sorted({k for v in s.values() for k in v.get("n", {})})},
                          "octets": sum(v.get("octets", 0) for v in s.values()), "erreurs": sum(len(v.get("erreurs", [])) for v in s.values()),
                          "requetes_sec": _nreq[0]}
        except RuntimeError: _r = etat.get("resume", {})
        etat["resume"] = _r
        tmp = ETAT + ".tmp"
        for _ in range(5):
            try: txt = json.dumps(etat, ensure_ascii=False); break
            except RuntimeError: time.sleep(0.2)   # un autre fil modifie l etat pendant la copie
        else: return
        open(tmp, "w").write(txt); os.replace(tmp, ETAT)

# ---------------------------------------------------------------- utilitaires
RE_D = re.compile(r"\d{4}-\d{2}-\d{2}"); RE_ACC = re.compile(r"\d{10}-\d{2}-\d{6}")
def index_local(t):
    """cles deja presentes : (dossier, accession) et (dossier, date) hors 8K/6K"""
    s = set(); base = f"{LAKE}/{t}"
    if not os.path.isdir(base): return s
    for d in os.listdir(base):
        p = f"{base}/{d}"
        if not os.path.isdir(p): continue
        for n in os.listdir(p):
            a = RE_ACC.search(n); m = RE_D.search(n)
            if a: s.add((d, a.group(0)))
            if m and d not in ("8K", "6K"): s.add((d, m.group(0)))
            if m and d in ("ER", "ES", "EP"): s.add((d, m.group(0)))
    return s

def ecrit(p, b, gz=True):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".part"
    if gz:
        with gzip.open(tmp, "wb") as f: f.write(b)
    else:
        open(tmp, "wb").write(b)
    os.replace(tmp, p); return os.path.getsize(p)

def pieces(cik, acc):
    """liste (nom, type, description) des documents d un depot, depuis la page -index.htm"""
    b = get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{acc}-index.htm")
    if not b: return []
    s = b.decode("utf-8", "ignore"); out = []
    for tr in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", s):
        td = re.findall(r"(?is)<td[^>]*>(.*?)</td>", tr)
        if len(td) < 4: continue
        m = re.search(r'href="([^"]+)"', td[2])
        if not m: continue
        nom = m.group(1).split("/")[-1]
        if nom.startswith("ix?doc="): nom = nom.split("/")[-1]
        typ = H.unescape(re.sub("<[^>]+>", "", td[3])).strip().upper()
        desc = H.unescape(re.sub("<[^>]+>", "", td[1])).strip()
        out.append((nom, typ, desc))
    return out

def est_presentation(nom, desc):
    s = (nom + " " + desc).lower()
    return bool(re.search(r"presentation|slides?\b|deck|webcast|investor.?day", s))

# ---------------------------------------------------------------- une societe
def traite(r):
    t = r["ticker"]; cik = r["cik"]; st = etat["societes"].setdefault(t, {})
    if st.get("fini"): return
    st.update({"cik": cik, "debut": st.get("debut") or datetime.now().isoformat(timespec="seconds")})
    st.setdefault("n", {}); st.setdefault("octets", 0); st.setdefault("erreurs", []); faits = set(st.get("acc_faits", []))
    base = f"{LAKE}/{t}"
    def compte(k, o): st["n"][k] = st["n"].get(k, 0) + 1; st["octets"] += o
    try:
        sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{cik}.json"))
    except Exception as e:
        st["erreurs"].append(f"submissions: {str(e)[:80]}"); sauve(); return
    st["nom_sec"] = sub.get("name"); st["sic"] = sub.get("sic"); st["sic_libelle"] = sub.get("sicDescription")
    st["etranger"] = any(f in ("20-F", "40-F", "6-K") for f in sub["filings"]["recent"]["form"][:200])
    frames = [sub["filings"]["recent"]]
    for x in sub["filings"].get("files", []):
        if x.get("filingTo", "9999") >= SINCE:
            try: frames.append(json.loads(get(f"https://data.sec.gov/submissions/{x['name']}")))
            except Exception as e: st["erreurs"].append(f"submissions {x['name']}: {str(e)[:60]}")
    depots = []
    for fr in frames:
        for i in range(len(fr["form"])):
            f = fr["form"][i]; d = fr["filingDate"][i]
            if f in FORMS and d >= SINCE:
                depots.append({"form": f, "date": d, "acc": fr["accessionNumber"][i], "prim": fr["primaryDocument"][i], "items": fr.get("items", [""] * len(fr["form"]))[i] or ""})
    depots.sort(key=lambda x: x["date"])
    st["n_depots_10ans"] = len(depots)
    # XBRL companyfacts
    px = f"{base}/xbrl/companyfacts.json"
    if not os.path.exists(px) or time.time() - os.path.getmtime(px) > 7 * 86400:
        try:
            b = get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json")
            if b: compte("xbrl", ecrit(px, b, gz=False))
            else: st["xbrl"] = "absent (404)"
        except Exception as e: st["erreurs"].append(f"xbrl: {str(e)[:60]}")
    have = index_local(t); n0 = 0
    for x in depots:
        if libre_go() < MIN_GO:
            st["erreurs"].append(f"ARRET espace libre {libre_go():.1f} Go"); sauve(); raise SystemExit(2)
        dos = FORMS[x["form"]]; acc = x["acc"]; dte = x["date"]
        if acc in faits: continue
        cikn = int(cik); accn = acc.replace("-", "")
        try:
            if dos not in ("8K", "6K"):
                if (dos, acc) in have or (dos, dte) in have: faits.add(acc); continue
                if not x["prim"]: continue
                ext = (x["prim"].rsplit(".", 1)[-1] or "htm").lower()
                b = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{accn}/{x['prim']}") or get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}.txt")
                if b is None: st["erreurs"].append(f"{x['form']} {dte} {acc}: 404"); continue
                compte(dos, ecrit(f"{base}/{dos}/{t}_{dte}_{acc}.{ 'htm' if ext in ('htm','html') else ext}.gz", b)); have.add((dos, acc)); have.add((dos, dte))
            else:
                # document principal
                if (dos, acc) not in have and x["prim"]:
                    b = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{accn}/{x['prim']}")
                    if b is not None: compte(dos, ecrit(f"{base}/{dos}/{t}_{dte}_{acc}.htm.gz", b)); have.add((dos, acc))
                # pieces 99
                ps = [p for p in pieces(cik, acc) if p[1].startswith("EX-99")]
                resultats = dos == "8K" and "2.02" in x["items"]
                n_es = 0
                for k, (nom, typ, desc) in enumerate(ps):
                    low = nom.lower()
                    if not low.endswith((".htm", ".html", ".txt", ".pdf")): continue
                    if resultats:
                        if est_presentation(nom, desc): cible = "EP"
                        elif typ in ("EX-99.1", "EX-99", "EX-99.01") or k == 0: cible = "ER"
                        else: cible = "ES"
                        ext = "pdf" if low.endswith(".pdf") else "htm"
                        suf = ""
                        if cible == "ES":
                            n_es += 1; suf = "" if n_es == 1 else str(n_es)
                        nomf = f"{t}_{dte}_{cible}{suf}.{ext}"
                        # ancien nommage edgar_<acc>_991/992 rapatrie de ~/Mettrik/docs : renomme au format du lac
                        for old in (f"{base}/{cible}/edgar_{acc}_991.htm", f"{base}/{cible}/edgar_{acc}_992.htm"):
                            if os.path.exists(old) and not os.path.exists(f"{base}/{cible}/{nomf}"): os.replace(old, f"{base}/{cible}/{nomf}")
                        p = f"{base}/{cible}/{nomf}"
                        proprio = st.setdefault("fichiers_acc", {})
                        if os.path.exists(p):
                            if proprio.get(nomf, acc) == acc: continue   # deja la (copie de l existant ou passe precedente)
                            p = f"{base}/{cible}/{t}_{dte}_{acc}_{cible}{suf}.{ext}"   # second depot 2.02 le meme jour
                            if os.path.exists(p): continue
                        b = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{accn}/{nom}")
                        if b is not None:
                            compte(cible, ecrit(p, b, gz=False)); proprio[os.path.basename(p)] = acc
                    else:
                        p = f"{base}/{dos}/{t}_{dte}_{acc}_{nom}.gz"
                        if os.path.exists(p): continue
                        b = get(f"https://www.sec.gov/Archives/edgar/data/{cikn}/{accn}/{nom}")
                        if b is not None: compte(dos + "_EX99", ecrit(p, b))
            faits.add(acc); n0 += 1
            if n0 % 25 == 0: st["acc_faits"] = sorted(faits); sauve()
        except SystemExit: raise
        except Exception as e:
            st["erreurs"].append(f"{x['form']} {dte} {acc}: {str(e)[:60]}")
    st["acc_faits"] = sorted(faits)
    st["fini"] = True; st["fin"] = datetime.now().isoformat(timespec="seconds")
    etat["societes"][t] = st
    sauve()
    print(f"{t}: {sum(st['n'].values())} fichiers, {st['octets']/1e6:.0f} Mo, {len(st['erreurs'])} err | libre {libre_go():.1f} Go | req {_nreq[0]}", flush=True)

if __name__ == "__main__":
    L = json.load(open(f"{M}/liste.json"))
    soc = [r for r in L["societes"] if not r.get("radiee") and r.get("cik")]
    if opt("--tickers"): w = set(opt("--tickers").split(",")); soc = [r for r in soc if r["ticker"] in w]
    print(len(soc), "societes, libre", round(libre_go(), 1), "Go", flush=True)
    with ThreadPoolExecutor(max_workers=FILS) as ex:
        for f in [ex.submit(traite, r) for r in soc]:
            try: f.result()
            except SystemExit: print("ARRET espace disque", flush=True); os._exit(2)
            except Exception as e: print("ERR", str(e)[:100], flush=True)
    sauve(); print("FIN", json.dumps(etat["resume"]), flush=True)
