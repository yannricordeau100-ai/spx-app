#!/usr/bin/env python3
"""Mission sp5001000 : transcripts des conferences de resultats (gratuits) sur 10 ans
pour les societes de data-lake/_sp5001000/liste.json (hors radiees).
Source 1 : stockanalysis.com (historique complet depuis l introduction en bourse ou ~2018) ;
source 2 : MarketBeat (7 derniers appels environ) si stockanalysis n a rien.
Controle d identite : le titre de la page (stockanalysis) ou le texte (MarketBeat) doit
contenir un mot distinctif du nom SEC de la societe, sinon rien n est ecrit.
Sortie : data-lake/<T>/transcripts/<T>_<date>_<periode>.json.gz
  {ticker, source, source_url, periode, quarter, year, date, content}
Etat : data-lake/_sp5001000/etat-transcripts.json (reprise). Aucune ecriture hors du lac.
Usage : python3 scripts/sp5001000-transcripts.py [--tickers A,B] [--pause 1.5]"""
import importlib.util, json, os, re, sys, time, gzip
from datetime import datetime, date
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = f"{ROOT}/data-lake"; M = f"{LAKE}/_sp5001000"; ETAT = f"{M}/etat-transcripts.json"
def charge(nom):
    sp = importlib.util.spec_from_file_location(nom.replace("-", "_"), f"{ROOT}/scripts/{nom}.py"); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
SA = charge("stockanalysis-transcripts"); MB = charge("marketbeat-transcripts")
SA.enregistre_symbole = lambda *a, **k: None          # pas de cache hors du lac
ARG = sys.argv
def opt(n, d=None): return ARG[ARG.index(n) + 1] if n in ARG else d
PAUSE = float(opt("--pause", "1.5")); SINCE = "2016-10-09"
if opt("--etat"): ETAT = f"{M}/{opt('--etat')}"   # fil secondaire : etat separe, fusionne ensuite
etat = json.load(open(ETAT)) if os.path.exists(ETAT) else {"societes": {}}
def sauve():
    s = etat["societes"]
    etat["maj"] = datetime.now().isoformat(timespec="seconds")
    etat["resume"] = {"n_finies": sum(1 for v in s.values() if v.get("fini")), "n_avec_transcripts": sum(1 for v in s.values() if v.get("n", 0) > 0),
                      "transcripts": sum(v.get("n", 0) for v in s.values()), "par_source": {k: sum(1 for v in s.values() if v.get("source") == k) for k in ("stockanalysis", "marketbeat", None)}}
    tmp = ETAT + ".tmp"; json.dump(etat, open(tmp, "w"), ensure_ascii=False, indent=0); os.replace(tmp, ETAT)

FORMES = {"ltd", "llc", "limited", "lp", "plc", "co", "sa", "nv", "ag", "se", "the", "and", "com", "class", "del", "new", "american", "first", "national", "financial", "global", "capital", "energy", "health", "united"}
def mots(nom):
    m = SA.mots_distinctifs(nom or "") - FORMES
    if not m:   # nom court (Nu Holdings...) : premier mot du nom, meme de 2 lettres
        m = set(re.findall(r"[a-z0-9]{2,}", (nom or "").lower())[:1])
    return m
def titre_ok(ms, titre):
    tw = set(re.findall(r"[a-z0-9]{2,}", titre.lower()))
    return not ms or bool(ms & tw)

def ecrit(t, doc):
    d = f"{LAKE}/{t}/transcripts"; os.makedirs(d, exist_ok=True)
    p = f"{d}/{t}_{doc['date'] or 'sans-date'}_{doc['periode']}.json.gz"
    if os.path.exists(p): return 0
    with gzip.open(p + ".part", "wt", encoding="utf-8") as f: json.dump(doc, f, ensure_ascii=False)
    os.replace(p + ".part", p); return 1

def deja(t):
    d = f"{LAKE}/{t}/transcripts"
    return set(os.listdir(d)) if os.path.isdir(d) else set()

def via_sa(t, nom, st):
    ms = mots(nom)
    for sym in dict.fromkeys([t.lower(), t.lower().replace("-", "."), t.lower().replace("-", "")]):
        url = f"{SA.BASE}/stocks/{sym}/transcripts/"
        code, body = SA.fetch(url); time.sleep(PAUSE)
        if code != 200 or not body or "transcripts/" not in body: continue
        titre = SA.nom_page(body)
        if not titre_ok(ms, titre):
            st.setdefault("ecartes", []).append(f"stockanalysis {sym}: page '{titre[:60]}'"); continue
        liens = []; vus = set()
        for m in SA.RE_LIEN.finditer(body):
            href, ident, slug = m.groups()
            if ident in vus: continue
            vus.add(ident)
            if SA.RE_PERIODE.match(SA.periode_norm(slug)): liens.append((slug, SA.BASE + href))
        return liens
    return None

def traite(r):
    t = r["ticker"]; st = etat["societes"].setdefault(t, {"n": 0})
    if st.get("fini"): return
    nom = r["nom"]; have = deja(t); n = st.get("n", 0)
    liens = via_sa(t, nom, st)
    if liens:
        st["source"] = "stockanalysis"; st["n_liste"] = len(liens)
        for slug, url in liens:
            if any(slug in h for h in have): continue
            code, body = SA.fetch(url); time.sleep(PAUSE)
            if code != 200 or not body: st.setdefault("erreurs", []).append(f"{slug}: HTTP {code}"); continue
            x = SA.extrait_transcript(body)
            if not x or len(x.get("content") or "") < 2000: st.setdefault("vides", []).append(slug); continue
            if x.get("date") and x["date"] < SINCE: continue
            n += ecrit(t, {"ticker": t, "source": "stockanalysis", "source_url": url, "periode": slug, "quarter": x.get("quarter"), "year": x.get("year"), "date": x.get("date"), "content": x["content"]})
    else:
        rapports, ex = MB.liste_rapports(t)
        st["source"] = "marketbeat" if rapports else None; st["n_liste"] = len(rapports)
        ms = mots(nom); today = date.today().isoformat()
        for d, url in rapports:
            if d > today or d < SINCE: continue
            if any(f"_{d}_" in h for h in have): continue
            code, body = MB.fetch(url); time.sleep(max(PAUSE, MB.PAUSE))
            if code != 200 or not body: continue
            x = MB.extrait_transcript(body)
            if not x or len(x["content"]) < MB.MIN_LEN: continue
            if ms and not any(re.search(r"\b" + re.escape(w) + r"\b", x["content"].lower()) for w in ms):
                st.setdefault("ecartes", []).append(f"marketbeat {d}: nom absent du texte"); continue
            per = f"q{x['quarter']}-{x['year']}" if x.get("quarter") and x.get("year") else "periode-inconnue"
            n += ecrit(t, {"ticker": t, "source": "marketbeat", "source_url": url, "periode": per, "quarter": x.get("quarter"), "year": x.get("year"), "date": d, "content": x["content"]})
    st["n"] = n; st["fini"] = True; st["fin"] = datetime.now().isoformat(timespec="seconds")
    sauve(); print(f"{t}: {n} transcripts ({st.get('source')})", flush=True)

if __name__ == "__main__":
    L = json.load(open(f"{M}/liste.json"))
    soc = [r for r in L["societes"] if not r.get("radiee")]
    if opt("--tickers"): w = set(opt("--tickers").split(",")); soc = [r for r in soc if r["ticker"] in w]
    if opt("--tranche"):   # i/n : repartit les societes entre n fils
        i, n = map(int, opt("--tranche").split("/")); soc = [r for k, r in enumerate(soc) if k % n == i]
    if opt("--sauf-etat"):   # saute les societes deja finies dans un autre etat
        autre = json.load(open(f"{M}/{opt('--sauf-etat')}")).get("societes", {})
        soc = [r for r in soc if not autre.get(r["ticker"], {}).get("fini")]
    for r in soc:
        try: traite(r)
        except Exception as e:
            etat["societes"].setdefault(r["ticker"], {})["erreur"] = str(e)[:120]; sauve(); print("ERR", r["ticker"], str(e)[:100], flush=True)
    sauve(); print("FIN", json.dumps(etat["resume"]), flush=True)
