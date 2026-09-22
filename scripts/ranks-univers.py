#!/usr/bin/env python3
"""Rangs et ordre de capitalisation de l univers (666 societes), 7 sept 2026.

Source : yfinance (gratuit, aucun jeton). Pour chaque societe : capitalisation
en devise locale + devise + pays, convertie en dollars avec les taux yfinance du
jour. Puis rangs mondial / Etats-Unis / secteur / sous-industrie (meme format que
scripts/enrich-ranks-yfinance.py) ecrits dans src/data/v2-pipeline-enrich/<T>.ranks.json,
et ordre decroissant de capitalisation dans src/data/market-cap-order.json
(barre de recherche, page d accueil).

Usage : python3 scripts/ranks-univers.py [--workers 6] [--limit N]
Concu pour le cron quotidien (.github/workflows/daily-earnings-refresh.yml).
"""
import argparse, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENR = ROOT / "src/data/v2-pipeline-enrich"
COMP = ROOT / "src/data/companies"
UNI = json.load(open(ROOT / "src/data/v1-9-5-clean-all-tickers.json"))["tickers"]

US_LIKE = {"United States"}

# Rang national, 22 sept 2026 (Yann, apres l audit des rangs).
# Jusqu ici seules les societes americaines recevaient un rang national : les
# 172 autres affichaient trois pastilles au lieu de quatre. Le pays est deja
# dans chaque fiche de rangs (champ `country`, venu de yfinance), la meme
# source que les capitalisations qui servent deja a tous les rangs : aucune
# dependance nouvelle n est introduite.
#
# Garde fous :
#   - un pays n obtient de rang que s il compte au moins SEUIL_PAYS societes
#     dans l univers, sinon aucun rang n est ecrit pour ce pays ;
#   - le pays vient du champ de donnees (yfinance, repli sur la fiche
#     societe), jamais d une deduction a partir du suffixe du ticker ;
#   - une societe sans pays exploitable reste sans rang national et est
#     listee en fin d execution.
SEUIL_PAYS = 15


# Symboles yfinance differents du ticker Mettrik.
# 22 sept 2026 : ROG.SW et MT.PA ne repondent plus chez yfinance (404), leurs
# fiches de rangs restaient donc figees au 13 septembre et servaient un rang
# perime, seule cause des inversions relevees par l audit. Les symboles RO.SW
# (Roche) et MT.AS (ArcelorMittal) donnent la capitalisation de la meme
# societe, chez le meme fournisseur.
ALIAS = {"BF.B": "BF-B", "DPW.DE": "DHL.DE", "BRK-B": "BRK-B", "ROG.SW": "RO.SW", "MT.PA": "MT.AS"}

# Doubles classes d actions : la classe secondaire est la meme societe que la
# principale (la capitalisation yfinance couvre deja toute la societe). Elle
# recoit le meme rang que la principale et sort de l ordre de capitalisation.
DOUBLE_CLASSE = {"GOOG": "GOOGL", "FOX": "FOXA", "NWS": "NWSA"}


def yf_symbol(t):
    return ALIAS.get(t, t)


def fiche(t):
    # 9 sept 2026 : repli sur la fiche pipeline quand la fiche companies
    # n existe pas (ex SPCX) : sans secteur, les rangs sectoriels sortaient "-".
    for c in (t, t.lower(), t.upper()):
        p = COMP / f"{c}.json"
        if not p.exists():
            p = ROOT / "src/data/v2-pipeline" / f"{c.lower()}.json"
        if p.exists():
            try:
                return json.load(open(p))
            except Exception:
                return {}
    return {}


def fx_rates(currencies):
    import yfinance as yf
    rates = {"USD": 1.0}
    for c in sorted(set(currencies) - {"USD", None, ""}):
        code = "GBP" if c == "GBp" else c
        try:
            h = yf.Ticker(f"{code}USD=X").history(period="5d")
            r = float(h["Close"].dropna().iloc[-1])
            rates[c] = r / 100.0 if c == "GBp" else r
        except Exception:
            rates[c] = None
    return rates


def fetch(t):
    import yfinance as yf
    for attempt in range(3):
        try:
            tk = yf.Ticker(yf_symbol(t))
            info = tk.info or {}
            mc = info.get("marketCap")
            cur = info.get("currency") or ""
            if not mc:
                # repli : fast_info (capitalisation et devise de cotation)
                try:
                    fi = tk.fast_info
                    mc = fi.get("marketCap") if hasattr(fi, "get") else getattr(fi, "market_cap", None)
                    cur = cur or (fi.get("currency") if hasattr(fi, "get") else getattr(fi, "currency", "")) or ""
                except Exception:
                    pass
            return t, (float(mc) if mc else None), cur, info.get("country") or ""
        except Exception:
            time.sleep(1.0 + attempt)
    return t, None, "", ""


def pays_de(t, country_yf, f):
    """Pays de la societe, depuis les champs de donnees uniquement.

    1. `country` de yfinance (deja telecharge avec la capitalisation) ;
    2. repli sur le champ `country` de la fiche societe quand yfinance est
       muet (ex ML.PA, FISV au 22 sept 2026).
    Aucune deduction a partir du suffixe du ticker : une societe sans pays
    exploitable ressort vide et ne recevra aucun rang national.
    """
    c = (country_yf or "").strip()
    if c:
        return c
    for cle in ("country", "pays", "headquarters_country"):
        v = f.get(cle)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def format_sector_rank(rank, sector):
    if not sector:
        return None
    if rank == 1:
        return f"#1 in {sector}"
    if rank <= 3:
        return f"Top 3 in {sector}"
    if rank <= 5:
        return f"Top 5 in {sector}"
    if rank <= 10:
        return f"Top 10 in {sector}"
    if rank <= 25:
        return f"Top 25 in {sector}"
    if rank <= 50:
        return f"Top 50 in {sector}"
    return f"#{rank} in {sector}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--only", default=None, help="tickers separes par des virgules : ne re-telecharge que ceux-la, garde les autres depuis les ranks.json existants")
    a = ap.parse_args()
    tickers = UNI[: a.limit] if a.limit else UNI
    seuls = set(a.only.split(",")) if a.only else None
    print(f"yfinance : {len(tickers)} societes, {a.workers} fils")
    res = {}
    a_telecharger = [t for t in tickers if not seuls or t in seuls]
    if seuls:
        # les autres sont relus depuis leur fichier ranks.json du jour
        for t in tickers:
            if t in seuls:
                continue
            p = ENR / f"{t.lower()}.ranks.json"
            if p.exists():
                r = json.load(open(p))
                if r.get("market_cap_usd"):
                    res[t] = {"mc_local": r.get("market_cap_local") or r["market_cap_usd"], "currency": r.get("currency") or "USD", "country": r.get("country") or ""}
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for t, mc, cur, country in ex.map(fetch, a_telecharger):
            res[t] = {"mc_local": mc, "currency": cur, "country": country}
    rates = fx_rates(v["currency"] for v in res.values())
    rows = []
    for t, v in res.items():
        r = rates.get(v["currency"]) if v["currency"] else 1.0
        if v["mc_local"] and r:
            v["mc_usd"] = v["mc_local"] * r
        else:
            v["mc_usd"] = None
        f = fiche(t)
        v["sector"], v["subsector"] = f.get("sector"), f.get("subsector")
        v["country"] = pays_de(t, v.get("country"), f)
        rows.append(t)
    ok = [t for t in rows if res[t]["mc_usd"] and t not in DOUBLE_CLASSE]
    ok.sort(key=lambda t: -res[t]["mc_usd"])
    print(f"capitalisation obtenue : {len(ok)} / {len(rows)}")
    us = [t for t in ok if res[t]["country"] in US_LIKE]
    # Rang national : un classement par pays, reserve aux pays qui atteignent
    # le seuil. Les autres pays, et les societes sans pays, ne recoivent rien.
    par_pays = {}
    for t in ok:
        c = res[t]["country"]
        if c:
            par_pays.setdefault(c, []).append(t)
    pays_classes = {c: lst for c, lst in par_pays.items() if len(lst) >= SEUIL_PAYS}
    sans_pays = [t for t in ok if not res[t]["country"]]
    print(f"rang national : {len(pays_classes)} pays au dessus du seuil de {SEUIL_PAYS} "
          f"({', '.join(f'{c} {len(l)}' for c, l in sorted(pays_classes.items(), key=lambda kv: -len(kv[1])))})")
    hors_seuil = sorted({c: len(l) for c, l in par_pays.items() if len(l) < SEUIL_PAYS}.items(), key=lambda kv: -kv[1])
    if hors_seuil:
        print(f"pays sous le seuil, aucun rang national ecrit : {', '.join(f'{c} {n}' for c, n in hors_seuil)}")
    if sans_pays:
        print(f"sans pays exploitable, aucun rang national : {sans_pays}")
    by_sec, by_sub = {}, {}
    for t in ok:
        by_sec.setdefault(res[t]["sector"], []).append(t)
        by_sub.setdefault(res[t]["subsector"], []).append(t)
    now = datetime.now(timezone.utc).isoformat()
    n = 0
    for i, t in enumerate(ok, 1):
        v = res[t]
        # Le rang national est porte par `global_us`, qui est le champ de rang
        # national deja servi par load-company.ts. Le pays est inscrit dans la
        # valeur, comme pour les rangs sectoriels : l en tete y lit le libelle
        # de la pastille et n affiche que le numero.
        c = v["country"]
        national = f"#{pays_classes[c].index(t) + 1} in {c}" if c in pays_classes else "-"
        ranks = {
            "global_world": f"#{i}",
            "global_us": national,
            "global_country": national,
            "sector": format_sector_rank(by_sec[v["sector"]].index(t) + 1, v["sector"]) or "-",
            "subsector": format_sector_rank(by_sub[v["subsector"]].index(t) + 1, v["subsector"]) or "-",
        }
        out = {"ticker": t, "ranks": ranks, "market_cap_usd": round(v["mc_usd"]), "market_cap_local": v["mc_local"],
               "currency": v["currency"], "country": v["country"], "_data_freshness_date": now, "fetched_at": now,
               "source": "yfinance ranks-univers (cron quotidien)"}
        # nom de fichier en minuscules : c est ce que lit load-company.ts, et
        # Vercel (Linux) distingue la casse (regle Mettrik : majuscules = 404).
        p = ENR / f"{t.lower()}.ranks.json"
        json.dump(out, open(p, "w"), ensure_ascii=False, indent=2)
        n += 1
    # Classes secondaires : meme rang que la classe principale.
    for sec, pri in DOUBLE_CLASSE.items():
        if pri not in ok:
            continue
        base = json.load(open(ENR / f"{pri.lower()}.ranks.json"))
        base["ticker"] = sec
        base["source"] = f"yfinance ranks-univers (classe secondaire de {pri})"
        json.dump(base, open(ENR / f"{sec.lower()}.ranks.json", "w"), ensure_ascii=False, indent=2)
        n += 1
    json.dump({"generation": now, "source": "scripts/ranks-univers.py", "tickers": ok,
               "market_cap_usd": {t: round(res[t]["mc_usd"]) for t in ok}},
              open(ROOT / "src/data/market-cap-order.json", "w"), ensure_ascii=False, indent=0)
    avec_national = sum(1 for t in ok if res[t]["country"] in pays_classes)
    print(f"rang national attribue a {avec_national} societes, dont "
          f"{avec_national - len(pays_classes.get('United States', []))} hors Etats-Unis")
    # Purge des fiches de rangs perimees (22 sept 2026, audit des rangs).
    # Une societe dont la capitalisation n a pas pu etre relevee ce jour ci
    # gardait son fichier d une execution precedente et continuait a servir un
    # rang d une autre semaine, ce qui produisait des doublons et des
    # inversions. On prefere ne rien afficher a afficher un rang faux : le
    # fichier est conserve, mais vide de ses rangs.
    perimes = []
    for t in tickers:
        if t in ok or t in DOUBLE_CLASSE:
            continue
        p = ENR / f"{t.lower()}.ranks.json"
        if not p.exists():
            continue
        vieux = json.load(open(p))
        if all(v in ("-", "", None) for v in (vieux.get("ranks") or {}).values()):
            continue
        vieux["ranks"] = {"global_world": "-", "global_us": "-", "global_country": "-", "sector": "-", "subsector": "-"}
        vieux["_data_freshness_date"] = now
        vieux["source"] = "yfinance ranks-univers : capitalisation indisponible ce jour, rangs retires plutot que perimes"
        json.dump(vieux, open(p, "w"), ensure_ascii=False, indent=2)
        perimes.append(t)
    if perimes:
        print(f"rangs perimes retires (capitalisation indisponible) : {perimes}")

    manq = [t for t in rows if not res[t]["mc_usd"]]
    print(f"{n} fichiers ranks ecrits, ordre de capitalisation : {len(ok)} societes ; sans capitalisation : {manq}")


if __name__ == "__main__":
    main()
