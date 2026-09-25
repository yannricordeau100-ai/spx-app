#!/usr/bin/env python3
"""Societes rachetees par chaque societe du site, 10 dernieres annees (24 sept 2026).

Methode C (hors Claude) :
 1. Rapports annuels du lac (data-lake/<T>/10K|20F) : on garde les phrases qui
    parlent d acquisition, Cerebras (repli Groq) liste les societes rachetees,
    puis on ne garde que les noms LITTERALEMENT presents dans le texte source.
 2. Wikidata (gratuit) : entites dont le proprietaire / la maison mere est la
    societe, avec date de debut >= 2016.
Sortie : src/data/rachats/<t>.json et src/data/rachats-index.json.
Usage : python3 scripts/rachats-collecte.py [TICKER ...]   (sans argument = tout l univers)
Reprise : une societe deja ecrite est sautee (--force pour refaire)."""
import gzip, html, json, os, re, sys, time, urllib.parse, urllib.request, ssl, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/data/rachats"
OUT.mkdir(exist_ok=True)
LOG = Path("/tmp/rachats-collecte.log")
AN_MIN = 2016
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
UA = "Mettrik research contact@mettrik.ai"

for line in (ROOT / ".env.local").read_text().splitlines():
    k, _, v = line.partition("=")
    if k.strip() and "=" in line and not os.environ.get(k.strip()):
        os.environ[k.strip()] = v.strip().strip('"').strip("'")
CLES = [c for c in (os.environ.get("CEREBRAS_API_KEY"), os.environ.get("CEREBRAS2_API_KEY"), os.environ.get("CEREBRAS3_API_KEY")) if c]
GROQ = os.environ.get("GROQ_API_KEY")
verrou_log = threading.Lock()


def log(m):
    with verrou_log:
        with LOG.open("a") as f:
            f.write(time.strftime("%d %H:%M:%S ") + m + "\n")


def texte_brut(h):
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?s)<ix:header>.*?</ix:header>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h)))


GENERIQUES = re.compile(r"(?i)(subsidiary|acquiree|target|entity [a-z]|acquisitions?|other|series|immaterial|individually|aggregate|various|certain|businesses|platform|portfolio|assets?|segment|transaction|combination|entities|companies|fiscal|year|\d{4})")
PREUVE = re.compile(r"BusinessCombinationRecognizedIdentifiableAssets|GoodwillAcquiredDuringPeriod|^Goodwill$|BusinessAcquisitionEffectiveDateOfAcquisition|PurchasePriceAllocation|BusinessAcquisitionsProForma|BusinessCombinationProForma")
PRIX = ("BusinessCombinationConsiderationTransferred1", "BusinessCombinationConsiderationTransferred", "BusinessAcquisitionCostOfAcquiredEntityPurchasePrice",
        "BusinessCombinationPurchasePrice", "BusinessAcquisitionCostOfAcquiredEntityTransactionCosts0")


def humain(membre):
    n = membre.split(":")[-1]
    n = re.sub(r"Member$", "", n)
    n = re.sub(r"(LLC|Inc|Ltd|GmbH|Corp|Limited|Holdings?|Group|AG|SA|BV|NV|SE|Plc|PLC)(?=[A-Z]|$)", r" \1 ", n)
    n = re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", n)
    mots = n.split()
    # artefacts du balisage : lettre isolee ou premier mot repete en fin de nom
    while len(mots) > 1 and (len(mots[-1]) == 1 or mots[-1] == mots[0]):
        mots.pop()
    return " ".join(mots)


def nom_litteral(n, texte):
    mots = [w for w in re.split(r"\s+", n) if w]
    if not mots:
        return n
    motif = r"\b" + r"[\s.,&'\-]*".join(re.escape(w) for w in mots) + r"\b"
    m = re.search(motif, texte, re.I)
    return re.sub(r"\s+", " ", m.group(0)).strip() if m else n


def analyse_xbrl(brut):
    """Rachats balises dans un rapport XBRL (inline .htm ou instance .xml)."""
    ctx, periode = {}, {}
    for m in re.finditer(r"<(?:xbrli:)?context\b[^>]*id=\"([^\"]+)\"[^>]*>(.*?)</(?:xbrli:)?context>", brut, re.S):
        mm = re.search(r"BusinessAcquisitionAxis\"[^>]*>\s*([\w-]+:\w+)", m.group(2))
        if mm:
            ctx[m.group(1)] = mm.group(1)
            d = re.findall(r"<(?:xbrli:)?instant>([\d-]+)<", m.group(2))
            periode[m.group(1)] = d[0] if d else None
    faits = {}
    for m in re.finditer(r"<(ix:non(?:Fraction|Numeric)|[\w-]+:\w+)\b([^>]*\bcontextRef=\"([^\"]+)\"[^>]*)>(.*?)</\1>", brut, re.S):
        cr = m.group(3)
        if cr not in ctx:
            continue
        if m.group(1).startswith("ix:"):
            nm = re.search(r"name=\"[\w-]+:(\w+)\"", m.group(2))
            if not nm:
                continue
            nom = nm.group(1)
        else:
            nom = m.group(1).split(":")[1]
        f = faits.setdefault(ctx[cr], {"noms": set(), "prix": None, "date": None, "dates": []})
        f["noms"].add(nom)
        val = re.sub(r"<[^>]+>", "", m.group(4)).strip()
        if nom == "BusinessAcquisitionEffectiveDateOfAcquisition1":
            f["date"] = val[:10]
        if periode.get(cr) and re.search(r"RecognizedIdentifiableAssets|^Goodwill$", nom):
            f["dates"].append(periode[cr])
        if nom in PRIX and not f["prix"]:
            try:
                x = float(val.replace(",", ""))
                sc = re.search(r"scale=\"(-?\d+)\"", m.group(2))
                x *= 10 ** int(sc.group(1)) if sc else 1
                f["prix"] = x
            except ValueError:
                pass
    return faits


def an_de(f, an_doc):
    for d in [f.get("date")] + sorted(f["dates"]):
        mm = re.search(r"(20\d\d)", d or "")
        if mm:
            return int(mm.group(1))
    return None


def montant(x):
    if not x:
        return None
    return f"{x/1e9:.1f} Mds $".replace(".", ",") if x >= 1e9 else f"{x/1e6:.0f} M$"


GICS = json.load(open(ROOT / "docs/cahier/societes-gics.json"))["societes"]


def depuis_rapports(t, nom):
    """10-K du lac (XBRL inline) + 10-K 2018 de l EDGAR pour couvrir 2016-2018."""
    # Lac marque « mauvaise societe » : ses rapports sont ceux d une autre.
    if (ROOT / "data-lake" / t / "_WRONG_COMPANY.txt").exists():
        return []
    # Foncieres (GICS 60) : l axe des rachats liste des immeubles, pas des societes.
    if str(GICS.get(t, "")).startswith("60"):
        return []
    fichiers = []
    for sous in ("10K", "20F", "40F"):
        d = ROOT / "data-lake" / t / sous
        if d.is_dir():
            for f in d.glob("*.htm*"):
                m = re.search(r"_(\d{4})-\d{2}-\d{2}", f.name)
                if m and int(m.group(1)) >= 2019:
                    fichiers.append((m.group(1), f))
    brutes = []
    for an, f in sorted(fichiers):
        try:
            brutes.append((an, f.name.split(".htm")[0], gzip.open(f, "rt", errors="ignore").read() if f.suffix == ".gz" else f.read_text(errors="ignore")))
        except Exception:
            pass
    if not brutes or min(a for a, _, _ in brutes) > "2019":
        vieux = edgar_10k_2018(t)
        if vieux:
            brutes.insert(0, vieux)
    res = {}
    base = norm(nom)
    for an, src, brut in brutes:
        faits = analyse_xbrl(brut)
        if not faits:
            continue
        texte = None
        for membre, f in faits.items():
            if membre.startswith("us-gaap:") or not any(PREUVE.search(n) for n in f["noms"]):
                continue  # pas de preuve de rachat finalise (abandonne, en attente, generique)
            n = humain(membre)
            if GENERIQUES.search(n) or len(n) < 3:
                continue
            if base and (norm(n).startswith(base[:6]) and len(base) >= 6):
                continue  # la societe elle-meme
            if texte is None:
                texte = texte_brut(brut) if src.endswith("xml") is False else ""
            nl = nom_litteral(n, texte) if texte else n
            a = an_de(f, an)
            if a and a < AN_MIN:
                continue
            k = norm(nl) or norm(n)
            r = res.setdefault(k, {"nom": nl, "annee": a, "montant": montant(f["prix"]), "citation": None,
                                   "source": f"rapport annuel {src}", "moteur": "aucun (XBRL)"})
            if not r["montant"] and f["prix"]:
                r["montant"] = montant(f["prix"])
            if not r["annee"] and a:
                r["annee"] = a
    return [r for r in res.values() if r["annee"] is None or r["annee"] >= AN_MIN]


_CIK = {}


def cik_de(t):
    if not _CIK:
        req = urllib.request.Request("https://www.sec.gov/files/company_tickers.json", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as r:
            for v in json.loads(r.read()).values():
                _CIK[v["ticker"].upper()] = v["cik_str"]
    return _CIK.get(t.replace(".", "-")) or _CIK.get(t)


def sec(url):
    time.sleep(0.7)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
        return r.read()


def edgar_10k_2018(t):
    """Instance XBRL du 10-K depose en 2018 ou 2019 (couvre 2016 a 2018)."""
    try:
        cik = cik_de(t)
        if not cik:
            return None
        sub = json.loads(sec(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"))
        r = sub["filings"]["recent"]
        for forme, date, acc in zip(r["form"], r["filingDate"], r["accessionNumber"]):
            if forme == "10-K" and date[:4] in ("2019", "2018"):
                idx = json.loads(sec(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/index.json"))
                noms = [i["name"] for i in idx["directory"]["item"]]
                inst = [n for n in noms if n.endswith(".xml") and not re.search(r"(_cal|_def|_lab|_pre|FilingSummary)", n)]
                inst = [n for n in inst if n.endswith("_htm.xml")] or inst
                if not inst:
                    continue
                brut = sec(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{inst[0]}").decode("utf-8", "ignore")
                return (date[:4], f"{t}_{date} (EDGAR, instance xml)", brut)
    except Exception as e:
        log(f"{t} edgar {type(e).__name__}")
    return None


def norm(s):
    s = re.sub(r"(?i)\b(inc|corp|corporation|company|co|llc|ltd|limited|plc|s\.?a\.?|n\.?v\.?|ag|se|gmbh|holdings?|group|the)\b\.?", "", s or "")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def sparql(q):
    u = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    for _ in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), context=SSL_CTX, timeout=25) as r:
                return json.loads(r.read())["results"]["bindings"]
        except Exception:
            time.sleep(3)
    return []


def depuis_wikidata(t, nom):
    sym = t.split(".")[0].replace("-", ".")
    b = sparql(f'SELECT DISTINCT ?c ?cLabel WHERE {{ ?c p:P414 ?s . ?s pq:P249 "{sym}" . SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,fr,de" }} }} LIMIT 8')
    base = norm(nom)
    def proche(l):
        l = norm(l)
        return len(l) >= 3 and (l in base or base[:6] in l)
    b = [x for x in b if proche(x["cLabel"]["value"])] if len(b) > 1 else b
    if len(b) != 1:
        return [], None  # symbole ambigu ou absent : on ne devine pas
    q = b[0]["c"]["value"].rsplit("/", 1)[1]
    rows = sparql(f"""SELECT DISTINCT ?x ?xLabel ?d WHERE {{
      {{ ?x p:P127 ?st . ?st ps:P127 wd:{q} . ?st pq:P580 ?d }} UNION
      {{ ?x p:P749 ?st . ?st ps:P749 wd:{q} . ?st pq:P580 ?d }} UNION
      {{ wd:{q} p:P1830 ?st . ?st ps:P1830 ?x . ?st pq:P580 ?d }}
      ?x wdt:P31/wdt:P279* wd:Q4830453 .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,fr,de" }} }}""")
    out = []
    base_nom = norm(nom)[:6]
    for r in rows:
        d = r.get("d", {}).get("value", "")
        lab = r["xLabel"]["value"]
        if not d or int(d[:4]) < AN_MIN or re.fullmatch(r"Q\d+", lab):
            continue
        if base_nom and base_nom in norm(lab):
            continue  # filiale au nom du groupe (« Stellantis Europe ») : pas un rachat
        out.append({"nom": lab, "annee": int(d[:4]), "_date": d[:10], "montant": None, "citation": None,
                    "source": f"Wikidata {r['x']['value'].rsplit('/', 1)[1]}", "moteur": "aucun"})
    # 25 sept 2026 : une fusion ou une reorganisation change le proprietaire de
    # nombreuses entites le MEME jour (PSA-FCA : Fiat, Maserati...). Quatre
    # entites ou plus a la meme date = restructuration, pas des rachats.
    parjour = {}
    for x in out:
        parjour[x["_date"]] = parjour.get(x["_date"], 0) + 1
    out = [x for x in out if parjour[x["_date"]] < 4]
    for x in out:
        x.pop("_date", None)
    return out, q


def fusion(lst):
    par = {}
    for r in lst:
        k = norm(r["nom"])
        if not k:
            continue
        if k not in par:
            par[k] = dict(r, sources=[r["source"]])
        else:
            p = par[k]
            p["sources"] = sorted(set(p["sources"] + [r["source"]]))
            for c in ("annee", "montant", "citation"):
                if not p.get(c) and r.get(c):
                    p[c] = r[c]
    out = []
    for r in par.values():
        r.pop("source", None)
        out.append(r)
    return sorted(out, key=lambda r: (-(r.get("annee") or 0), r["nom"]))


def traite(t, noms, force):
    f = OUT / f"{t.lower()}.json"
    if f.exists() and not force:
        return
    nom = noms.get(t, t)
    try:
        a = depuis_rapports(t, nom)
        b, qid = depuis_wikidata(t, nom)
        rachats = fusion(a + b)
        # 26 sept 2026 : les rachats ajoutes par recherche web verifiee (Europe)
        # et les montants verifies ne sont jamais perdus a une relance.
        if f.exists():
            try:
                ancien = json.load(open(f))
                vus = {norm(r["nom"]) for r in rachats}
                for r in ancien.get("rachats", []):
                    k = norm(r["nom"])
                    if r.get("moteur") == "recherche web verifiee" and k not in vus:
                        rachats.append(r); vus.add(k)
                    elif r.get("montant"):
                        for x in rachats:
                            if norm(x["nom"]) == k and not x.get("montant"):
                                x["montant"] = r["montant"]
            except Exception:
                pass
        json.dump({"ticker": t, "nom": nom, "depuis": AN_MIN, "maj": time.strftime("%Y-%m-%d"), "wikidata": qid,
                   "nb": len(rachats), "rachats": rachats,
                   "_note": "Rachats finalises depuis 2016 : balises XBRL des rapports annuels (allocation du prix d achat ou ecart d acquisition = rachat finalise) et Wikidata (entrees datees). Petites acquisitions non nommees par la societe absentes."},
                  open(f, "w"), ensure_ascii=False, indent=1)
        log(f"{t} OK {len(rachats)} rachats (rapports {len(a)}, wikidata {len(b)})")
    except Exception as e:
        log(f"{t} ECHEC {type(e).__name__} {e}")


def index():
    idx = {}
    for f in OUT.glob("*.json"):
        d = json.load(open(f))
        idx[d["ticker"]] = {"nom": d["nom"], "nb": d["nb"]}
    json.dump({"maj": time.strftime("%Y-%m-%d %H:%M"), "depuis": AN_MIN, "societes": idx},
              open(ROOT / "src/data/rachats-index.json", "w"), ensure_ascii=False, indent=1)
    # classement du bloc de fiche (version C) : top 5 Etats-Unis et top 5 Europe
    def top5(filtre):
        ts = sorted([t for t in idx if filtre(t) and idx[t]["nb"] > 0], key=lambda t: -idx[t]["nb"])[:5]
        return [{"ticker": t, "nom": idx[t]["nom"], "nb": idx[t]["nb"]} for t in ts]
    eu = lambda t: "." in t and t not in ("BRK.B", "BF.B")
    json.dump({"maj": time.strftime("%Y-%m-%d"), "depuis": AN_MIN, "us": top5(lambda t: not eu(t)), "eu": top5(eu)},
              open(ROOT / "src/data/rachats-classement.json", "w"), ensure_ascii=False, indent=1)
    # detail des 40 plus gros acheteurs pour la page concept (import statique)
    top = sorted(idx, key=lambda t: -idx[t]["nb"])[:40]
    json.dump([json.load(open(OUT / f"{t.lower()}.json")) for t in top],
              open(ROOT / "src/data/rachats-top.json", "w"), ensure_ascii=False)
    return len(idx)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    univ = json.load(open(ROOT / "src/data/v1-9-5-clean-all-tickers.json"))["tickers"]
    quar = set((json.load(open(ROOT / "src/data/quarantaine-pollution.json")).get("tickers") or []))
    noms = {}
    for i in json.load(open(ROOT / "src/data/indices-composition.json"))["indices"].values():
        for m in i["membres"]:
            noms.setdefault(m["ticker"], m["nom"])
    liste = args or [t for t in univ if t not in quar]
    log(f"DEBUT {len(liste)} societes")
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda t: traite(t, noms, force), liste))
    log(f"FIN index {index()} societes")


if __name__ == "__main__":
    main()
