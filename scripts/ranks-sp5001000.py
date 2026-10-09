#!/usr/bin/env python3
"""Rangs des fiches du NIVEAU 1 (vague sp5001000, Russell 1000), 9 oct 2026.

Version separee de scripts/ranks-univers.py, pour ne RIEN changer aux sociétés
existantes : leurs fichiers <t>.ranks.json et src/data/market-cap-order.json ne
sont ni lus en ecriture ni recalcules. Pour chaque fiche prete du niveau 1
(src/data/univers-sp5001000.json), la capitalisation est relevee sur yfinance
(meme fonction que ranks-univers.py), puis la societe est classee parmi
l univers principal (capitalisations du jour de market-cap-order.json) + les
autres fiches du niveau 1. Seuls les fichiers <t>.ranks.json des societes du
niveau 1 sont ecrits (source « ranks-sp5001000 », reconnue par
scripts/sp5001000-onboard.py qui ne les deplace pas).

Consequence assumee (consigne de Yann du 9 oct 2026) : tant que la vague n est
pas integree, une societe du niveau 1 peut partager un numero de rang avec une
societe existante (les rangs existants ne sont pas decales). A l integration
(apres le go), scripts/ranks-univers.py recalcule tout l univers.

Usage : python3 scripts/ranks-sp5001000.py [--tickers SNOW,TWLO] [--workers 4]
"""
import argparse, importlib.util, json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENR = ROOT / "src/data/v2-pipeline-enrich"
_sp = importlib.util.spec_from_file_location("ranks_univers", ROOT / "scripts/ranks-univers.py")
RU = importlib.util.module_from_spec(_sp)
_sp.loader.exec_module(RU)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default=None)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    n1 = json.load(open(ROOT / "src/data/univers-sp5001000.json"))
    cibles = [t.strip().upper() for t in a.tickers.split(",")] if a.tickers else list(n1["tickers"])
    cibles = [t for t in cibles if t in set(n1["vague_complete"])]
    if not cibles:
        print("aucune fiche du niveau 1 a classer")
        return
    # Univers principal : capitalisations, pays et secteurs du dernier passage de ranks-univers.py.
    mco = json.load(open(ROOT / "src/data/market-cap-order.json"))
    base = {}
    for t, mc in (mco.get("market_cap_usd") or {}).items():
        r = {}
        p = ENR / f"{t.lower()}.ranks.json"
        if p.exists():
            try:
                r = json.load(open(p))
            except Exception:
                r = {}
        f = RU.fiche(t)
        sec = f.get("sector")
        code = str(RU.GICS_CODES.get(t, ""))
        if code[:2] in RU.SECTEURS_GICS:
            sec = RU.SECTEURS_GICS[code[:2]]
        base[t] = {"mc_usd": mc, "country": r.get("country") or "", "sector": sec, "subsector": f.get("subsector")}
    print(f"univers principal : {len(base)} capitalisations (market-cap-order.json du {mco.get('generation', '?')[:10]})")
    res = {}
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for t, mc, cur, country in ex.map(RU.fetch, cibles):
            res[t] = {"mc_local": mc, "currency": cur or "USD", "country": country}
    rates = RU.fx_rates(v["currency"] for v in res.values())
    for t, v in res.items():
        r = rates.get(v["currency"]) if v["currency"] else 1.0
        v["mc_usd"] = v["mc_local"] * r if v["mc_local"] and r else None
        f = json.load(open(ROOT / "src/data/v2-pipeline" / f"{t.lower()}.json")) if (ROOT / "src/data/v2-pipeline" / f"{t.lower()}.json").exists() else {}
        v["sector"], v["subsector"] = f.get("sector"), f.get("subsector")
        v["country"] = RU.pays_de(t, v.get("country"), f)
    tous = {**base, **{t: v for t, v in res.items() if v["mc_usd"]}}
    ordre = sorted(tous, key=lambda t: -tous[t]["mc_usd"])
    par_pays = {}
    for t in ordre:
        c = tous[t].get("country")
        if c:
            par_pays.setdefault(c, []).append(t)
    pays_ok = {c: l for c, l in par_pays.items() if len(l) >= RU.SEUIL_PAYS}
    by_sec, by_sub = {}, {}
    for t in ordre:
        by_sec.setdefault(tous[t].get("sector"), []).append(t)
        by_sub.setdefault(tous[t].get("subsector"), []).append(t)
    now = datetime.now(timezone.utc).isoformat()
    ecrits, sans = [], []
    for t in cibles:
        v = res.get(t) or {}
        if not v.get("mc_usd"):
            sans.append(t)
            continue
        c = v["country"]
        national = f"#{pays_ok[c].index(t) + 1} in {c}" if c in pays_ok else "-"
        ranks = {
            "global_world": f"#{ordre.index(t) + 1}",
            "global_us": national,
            "global_country": national,
            "sector": RU.format_sector_rank(by_sec[v["sector"]].index(t) + 1, v["sector"]) or "-",
            "subsector": RU.format_sector_rank(by_sub[v["subsector"]].index(t) + 1, v["subsector"]) or "-",
        }
        out = {"ticker": t, "ranks": ranks, "market_cap_usd": round(v["mc_usd"]), "market_cap_local": v["mc_local"],
               "currency": v["currency"], "country": c, "_data_freshness_date": now, "fetched_at": now,
               "source": "yfinance ranks-sp5001000 (niveau 1 : classement parmi l univers principal + la vague, rangs existants inchanges)"}
        json.dump(out, open(ENR / f"{t.lower()}.ranks.json", "w"), ensure_ascii=False, indent=2)
        ecrits.append(t)
    print(f"{len(ecrits)} fichiers de rangs ecrits pour le niveau 1 ; sans capitalisation : {sans}")


if __name__ == "__main__":
    main()
