#!/usr/bin/env python3
"""Collecte des cours de bourse via l API FMP GRATUITE (cle FMP_API_KEY de .env.local).

Mission admin cours x KPI (1er oct 2026).
- Un seul appel par societe (historique EOD "light", from=1980 : l API renvoie au plus 5000 seances).
- Cache brut sur disque (.cache/fmp-cours/<ticker>.json) : une societe deja interrogee n est JAMAIS rappelee
  sauf --refresh. Arret propre si le quota gratuit est atteint (reprendre le lendemain).
- Ecrit un fichier compact par societe couverte dans src/data/cours-fmp/<ticker en minuscules>.json
  (lu par l app cote serveur, aucun appel FMP a l affichage).
- Ecrit docs/cahier/fmp-couverture-gratuite.json (couvert oui/non, motif exact renvoye par l API, profondeur,
  dernier cours et date).

Usage : python3 scripts/fmp-cours-collecte.py [--sample] [--refresh] [--only T1,T2]
"""
import json, os, sys, time, ssl, urllib.request, urllib.parse, datetime
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "fmp-cours")
OUT = os.path.join(ROOT, "src", "data", "cours-fmp")
COUV = os.path.join(ROOT, "docs", "cahier", "fmp-couverture-gratuite.json")
UNIVERS = os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")

SAMPLE = ["AAPL", "KO", "TSM", "BRK-B", "BF.B", "MC.PA", "SAP.DE", "ASML.AS", "ASML", "NESN.SW", "SHELL.AS", "PDD"]


def key():
    for line in open(os.path.join(ROOT, ".env.local")):
        if line.startswith("FMP_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("FMP_API_KEY absente de .env.local")


def candidats(t):
    """Formats FMP a essayer, dans l ordre. L univers est deja au format FMP (MC.PA, SAP.DE, ASML.AS, NESN.SW)."""
    if t == "BRK-B":
        return ["BRK-B", "BRK.B"]
    if t == "BF.B":
        return ["BF-B", "BF.B"]
    return [t]


def appel(sym, k):
    q = urllib.parse.urlencode({"symbol": sym, "from": "1980-01-01", "apikey": k})
    url = "https://financialmodelingprep.com/stable/historical-price-eod/light?" + q
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=40, context=CTX) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 429 and i < 3:
                time.sleep(5 + 10 * i)
                continue
            return e.code, body
        except Exception as e:  # coupure reseau : on reessaie (30 s)
            if i < 3:
                time.sleep(30)
                continue
            return 0, "erreur reseau : " + str(e)


def analyse(status, body):
    try:
        j = json.loads(body)
    except Exception:
        return None, body.strip()[:300]
    if isinstance(j, list):
        if not j:
            return None, "liste vide renvoyee par l API"
        return j, None
    if isinstance(j, dict):
        msg = j.get("Error Message") or j.get("error") or j.get("message") or json.dumps(j)[:300]
        return None, str(msg)[:300]
    return None, str(j)[:300]


def compacte(rows):
    rows = sorted(({"d": r["date"], "p": float(r["price"])} for r in rows if r.get("price") is not None), key=lambda x: x["d"])
    if not rows:
        return None
    last = rows[-1]
    ath = max(rows, key=lambda x: x["p"])
    lastd = datetime.date.fromisoformat(last["d"])
    # quotidien sur les 400 derniers jours, hebdomadaire (dernier cours de la semaine) avant
    cut = (lastd - datetime.timedelta(days=400)).isoformat()
    weekly, cur = [], None
    for r in rows:
        if r["d"] >= cut:
            break
        wk = datetime.date.fromisoformat(r["d"]).isocalendar()[:2]
        if cur != wk:
            weekly.append([r["d"], r["p"]])
            cur = wk
        else:
            weekly[-1] = [r["d"], r["p"]]
    daily = [[r["d"], r["p"]] for r in rows if r["d"] >= cut]
    ytd_ref = None
    for r in rows:
        if r["d"][:4] == last["d"][:4]:
            break
        ytd_ref = r
    return {
        "source": "Financial Modeling Prep (API gratuite), cours de cloture",
        "premiere_date": rows[0]["d"],
        "derniere_date": last["d"],
        "dernier_cours": last["p"],
        "plus_haut": {"date": ath["d"], "cours": ath["p"]},
        "cloture_annee_precedente": {"date": ytd_ref["d"], "cours": ytd_ref["p"]} if ytd_ref else None,
        "seances": len(rows),
        "points": [p for p in weekly] + daily,
    }


def main():
    args = sys.argv[1:]
    refresh = "--refresh" in args
    k = key()
    univers = json.load(open(UNIVERS))["tickers"]
    if "--sample" in args:
        cibles = SAMPLE
    elif "--only" in args:
        cibles = args[args.index("--only") + 1].split(",")
    else:
        cibles = univers
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    appels = 0
    for t in cibles:
        cf = os.path.join(CACHE, t.replace("/", "_") + ".json")
        if os.path.exists(cf) and not refresh:
            continue
        essais = []
        for sym in candidats(t):
            status, body = appel(sym, k)
            appels += 1
            rows, motif = analyse(status, body)
            essais.append({"symbole": sym, "http": status, "motif": motif, "n": len(rows) if rows else 0})
            if motif and "Limit Reach" in motif:
                print("QUOTA ATTEINT apres", appels, "appels :", motif[:160])
                construit(univers)
                return
            if rows:
                json.dump({"ticker": t, "symbole": sym, "collecte": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "essais": essais, "rows": rows}, open(cf, "w"))
                break
        else:
            if all(e["http"] == 0 for e in essais):
                print("erreur reseau, non mise en cache :", t)
                continue
            json.dump({"ticker": t, "symbole": None, "collecte": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "essais": essais, "rows": []}, open(cf, "w"))
        time.sleep(0.25)
    print("appels FMP :", appels)
    construit(univers)


def construit(univers):
    res = []
    for t in univers:
        cf = os.path.join(CACHE, t.replace("/", "_") + ".json")
        if not os.path.exists(cf):
            res.append({"ticker": t, "couvert": None, "motif": "non encore teste (quota du jour)"})
            continue
        c = json.load(open(cf))
        if c["rows"]:
            comp = compacte(c["rows"])
            json.dump({"ticker": t, "symbole_fmp": c["symbole"], "collecte": c["collecte"], **comp},
                      open(os.path.join(OUT, t.lower() + ".json"), "w"), separators=(",", ":"))
            d0 = datetime.date.fromisoformat(comp["premiere_date"])
            d1 = datetime.date.fromisoformat(comp["derniere_date"])
            res.append({"ticker": t, "symbole_fmp": c["symbole"], "couvert": True, "motif": None,
                        "historique_annees": round((d1 - d0).days / 365.25, 1),
                        "premiere_date": comp["premiere_date"],
                        "dernier_cours": comp["dernier_cours"], "date_dernier_cours": comp["derniere_date"],
                        "seances": comp["seances"], "essais": c["essais"]})
        else:
            res.append({"ticker": t, "couvert": False, "motif": c["essais"][-1]["motif"],
                        "essais": c["essais"]})
    # Index compact lu par l app (motif de non-couverture affiche en mode admin).
    json.dump({r["ticker"]: ({"couvert": True} if r["couvert"] else {"couvert": r["couvert"], "motif": r["motif"]}) for r in res},
              open(os.path.join(OUT, "_couverture.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    couv = [r for r in res if r["couvert"] is True]
    non = [r for r in res if r["couvert"] is False]
    json.dump({
        "genere_le": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "api": "https://financialmodelingprep.com/stable/historical-price-eod/light (from=1980-01-01), cle FMP_API_KEY plan gratuit",
        "note": "Couverture etablie d apres les reponses de l API, pas d apres le site FMP. L API renvoie au plus 5000 seances par appel : la profondeur est donc plafonnee a environ 20 ans.",
        "total": len(res), "couvertes": len(couv), "non_couvertes": len(non),
        "non_testees": len(res) - len(couv) - len(non),
        "societes": res,
    }, open(COUV, "w"), ensure_ascii=False, indent=1)
    print("couvertes", len(couv), "non couvertes", len(non), "non testees", len(res) - len(couv) - len(non))


if __name__ == "__main__":
    main()
