#!/usr/bin/env python3
"""Cours de bourse via yfinance pour les societes NON couvertes par l API FMP gratuite (Yann, 3 oct 2026).

FMP gratuit ne sert qu une liste fermee de grandes valeurs americaines (aucune action europeenne).
Ce script complete, pour les societes prioritaires (CAC 40 + 10 societes temoin), au meme format que
scripts/fmp-cours-collecte.py (src/data/cours-fmp/<ticker>.json), source affichee : Yahoo Finance.
Usage : python3 scripts/cours-yfinance-collecte.py [--only T1,T2] [--rafraichir]
--rafraichir (4 oct 2026, cron quotidien) : recharge le cours de TOUTES les societes deja presentes dans
src/data/cours-fmp (cours ajustes des divisions d actions), pour que « % vs plus haut » et « depuis le 1er janvier »
partent toujours du dernier cours de cloture.
"""
import importlib.util, json, os, sys, datetime
import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("fmp", os.path.join(ROOT, "scripts", "fmp-cours-collecte.py"))
fmp = importlib.util.module_from_spec(spec); spec.loader.exec_module(fmp)
OUT = os.path.join(ROOT, "src", "data", "cours-fmp")
TEMOIN = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "V", "JPM", "BRK-B"]


def prioritaires():
    ic = json.load(open(os.path.join(ROOT, "src", "data", "indices-composition.json")))
    cac = ic["indices"]["cac40"]
    cac = [m["ticker"] if isinstance(m, dict) else m for m in cac["membres"]]
    return list(dict.fromkeys([str(t).upper() for t in cac] + TEMOIN))


def main():
    only = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
    rafraichir = "--rafraichir" in sys.argv
    if rafraichir:
        liste = sorted(f[:-5].upper() for f in os.listdir(OUT) if f.endswith(".json") and not f.startswith("_"))
    else:
        liste = only.split(",") if only else prioritaires()
    faits, deja, vides = [], [], []
    for t in liste:
        if not rafraichir and os.path.exists(os.path.join(OUT, t.lower() + ".json")):
            deja.append(t); continue
        try:
            h = yf.Ticker(t).history(period="max", auto_adjust=False)
        except Exception:
            vides.append(t); continue
        rows = [{"date": d.strftime("%Y-%m-%d"), "price": float(r["Close"])} for d, r in h.iterrows() if r["Close"] == r["Close"]]
        c = fmp.compacte(rows)
        if not c:
            vides.append(t); continue
        c["source"] = "Yahoo Finance (yfinance), cours de cloture"
        doc = {"ticker": t, "symbole_fmp": t, "collecte": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), **c}
        json.dump(doc, open(os.path.join(OUT, t.lower() + ".json"), "w"), ensure_ascii=False, separators=(",", ":"))
        faits.append(t)
    print(f"ajoutees {len(faits)} deja presentes {len(deja)} sans donnees {len(vides)} {vides}")


if __name__ == "__main__":
    main()
