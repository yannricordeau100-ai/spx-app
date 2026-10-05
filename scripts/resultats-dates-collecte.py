#!/usr/bin/env python3
"""Dates de publication des resultats (earnings) sur 5 ans, pour le bloc admin « KPI et cours de bourse ».

Sources reelles uniquement (aucune date estimee ou inventee) :
 1. yfinance get_earnings_dates : seules les lignes avec un BPA publie (« Reported EPS » renseigne) et une date
    passee sont retenues (les dates a venir et les estimations sont ecartees).
 2. SEC EDGAR (societes americaines) : dates de depot des 8-K portant le point 2.02 (« Results of Operations »),
    soit la date reelle du communique de resultats. Sert de complement quand Yahoo n a rien ou trop peu.
Complement 3 : la cotation americaine (ADR) de la meme societe quand Yahoo n a rien sur la cotation locale
(seul cas utile verifie le 5 oct 2026 : ArcelorMittal MT.PA -> MT). Les societes sans aucune source reelle
(25 sur 95, surtout francaises) restent sans point : aucune date n est estimee.
Sortie : src/data/resultats-dates.json = { TICKER: { "source": "...", "dates": ["AAAA-MM-JJ", ...] } }
Societes traitees : celles qui ont un cours (src/data/cours-fmp/<t>.json). Sequentiel, pauses (charge Mac).
Usage : python3 scripts/resultats-dates-collecte.py [--only=T1,T2]
"""
import datetime, json, os, sys, time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURS = os.path.join(ROOT, "src", "data", "cours-fmp")
SORTIE = os.path.join(ROOT, "src", "data", "resultats-dates.json")
AUJ = datetime.date.today()
DEBUT = AUJ.replace(year=AUJ.year - 5)
UA = {"User-Agent": "Mettrik admin ricordeauyann@gmail.com"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


ADR = {"MT.PA": "MT"}


def dates_yahoo(t):
    import yfinance as yf
    d = yf.Ticker(ADR.get(t, t)).get_earnings_dates(limit=40)
    out = set()
    if d is None or len(d) == 0:
        return []
    for idx, row in d.iterrows():
        if row.get("Reported EPS") != row.get("Reported EPS"):  # NaN : pas encore publie
            continue
        j = idx.date()
        if DEBUT <= j <= AUJ:
            out.add(j.isoformat())
    return sorted(out)


_cik = None
def cik_de(t):
    global _cik
    if _cik is None:
        _cik = {v["ticker"].upper(): v["cik_str"] for v in get("https://www.sec.gov/files/company_tickers.json").values()}
    return _cik.get(t.upper().replace(".", "-")) or _cik.get(t.upper())


def dates_edgar(t):
    c = cik_de(t)
    if not c:
        return []
    sub = get(f"https://data.sec.gov/submissions/CIK{int(c):010d}.json")
    blocs = [sub["filings"]["recent"]]
    for f in sub["filings"].get("files", []):
        if f["filingTo"] >= DEBUT.isoformat():
            time.sleep(0.4)
            blocs.append(get("https://data.sec.gov/submissions/" + f["name"]))
    out = set()
    for b in blocs:
        for form, date, items in zip(b["form"], b["filingDate"], b.get("items", [""] * len(b["form"]))):
            if form == "8-K" and "2.02" in (items or "").split(",") and DEBUT.isoformat() <= date <= AUJ.isoformat():
                out.add(date)
    return sorted(out)


def main():
    only = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
    liste = only.split(",") if only else sorted(f[:-5].upper() for f in os.listdir(COURS) if f.endswith(".json") and not f.startswith("_"))
    res = json.load(open(SORTIE)) if os.path.exists(SORTIE) else {}
    for t in liste:
        try:
            y = dates_yahoo(t)
        except Exception as e:
            y = []
        time.sleep(1.5)
        e = []
        # EDGAR en complement (societes americaines) : on garde la source la plus fournie
        if len(y) < 18 and "." not in t:
            try:
                e = dates_edgar(t)
            except Exception:
                e = []
            time.sleep(1.0)
        if len(e) > len(y):
            res[t] = {"source": "SEC EDGAR, 8-K point 2.02 (communique de resultats)", "dates": e}
        elif y:
            res[t] = {"source": "Yahoo Finance, dates de resultats publiees", "dates": y}
        else:
            res[t] = {"source": "", "dates": []}
        print(t, len(res[t]["dates"]), res[t]["source"][:12], flush=True)
        json.dump(res, open(SORTIE, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
