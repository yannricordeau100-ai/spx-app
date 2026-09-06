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


# Symboles yfinance differents du ticker Mettrik.
ALIAS = {"BF.B": "BF-B", "DPW.DE": "DHL.DE", "BRK-B": "BRK-B"}


def yf_symbol(t):
    return ALIAS.get(t, t)


def fiche(t):
    for c in (t, t.lower(), t.upper()):
        p = COMP / f"{c}.json"
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
        rows.append(t)
    ok = [t for t in rows if res[t]["mc_usd"]]
    ok.sort(key=lambda t: -res[t]["mc_usd"])
    print(f"capitalisation obtenue : {len(ok)} / {len(rows)}")
    us = [t for t in ok if res[t]["country"] in US_LIKE]
    by_sec, by_sub = {}, {}
    for t in ok:
        by_sec.setdefault(res[t]["sector"], []).append(t)
        by_sub.setdefault(res[t]["subsector"], []).append(t)
    now = datetime.now(timezone.utc).isoformat()
    n = 0
    for i, t in enumerate(ok, 1):
        v = res[t]
        ranks = {
            "global_world": f"#{i}",
            "global_us": f"#{us.index(t) + 1}" if t in us else "-",
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
    json.dump({"generation": now, "source": "scripts/ranks-univers.py", "tickers": ok,
               "market_cap_usd": {t: round(res[t]["mc_usd"]) for t in ok}},
              open(ROOT / "src/data/market-cap-order.json", "w"), ensure_ascii=False, indent=0)
    manq = [t for t in rows if not res[t]["mc_usd"]]
    print(f"{n} fichiers ranks ecrits, ordre de capitalisation : {len(ok)} societes ; sans capitalisation : {manq}")


if __name__ == "__main__":
    main()
