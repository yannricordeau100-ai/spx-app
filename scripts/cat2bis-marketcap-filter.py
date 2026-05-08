#!/usr/bin/env python3
"""
Cat 2 bis : top 500 FPI ADR par market cap, sans Chine, sans EU dual listings.
Utilise yfinance pour récup market cap + country.
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
META = ROOT / "sec-data/_meta"


def fetch_info(ticker: str) -> dict:
    try:
        info = yf.Ticker(ticker).info
        return {
            "ticker": ticker,
            "market_cap": info.get("marketCap") or 0,
            "country": (info.get("country") or "").upper(),
            "name": info.get("longName") or info.get("shortName") or "",
        }
    except Exception:
        return {"ticker": ticker, "market_cap": 0, "country": "", "name": ""}


def main():
    fpi = json.loads((META / "fpi-tickers.json").read_text())
    tickers = [t["ticker"].upper() for t in fpi.get("tickers", []) if isinstance(t, dict)]
    print(f"Fetching market cap pour {len(tickers)} FPI...")
    results = []
    with ThreadPoolExecutor(max_workers=30) as ex:
        futs = {ex.submit(fetch_info, tk): tk for tk in tickers}
        for i, fut in enumerate(as_completed(futs)):
            results.append(fut.result())
            if (i+1) % 200 == 0:
                print(f"  {i+1}/{len(tickers)}")

    # Filtre : exclure Chine + Hong Kong + Taiwan
    EXCLUDE_COUNTRIES = {"CHINA", "HONG KONG", "TAIWAN"}
    # Pour EU dual : on identifie via le country = EU country (les ADR FPI EU listed séparement)
    EU_COUNTRIES = {"FRANCE", "GERMANY", "ITALY", "SPAIN", "NETHERLANDS", "BELGIUM",
                    "SWITZERLAND", "SWEDEN", "DENMARK", "NORWAY", "FINLAND", "PORTUGAL",
                    "UNITED KINGDOM", "IRELAND", "AUSTRIA", "GREECE"}

    cleaned = []
    for r in results:
        if r["country"] in EXCLUDE_COUNTRIES: continue
        # On garde EU stés (ce sont des dual listings volontaires, pas exclues)
        cleaned.append(r)
    cleaned.sort(key=lambda x: -x["market_cap"])
    top500 = cleaned[:500]

    # Enregistre
    out = {
        "generated": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"),
        "count": len(top500),
        "excluded_china_hk_tw": sum(1 for r in results if r["country"] in EXCLUDE_COUNTRIES),
        "tickers": top500,
    }
    (META / "cat2-bis-top500.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n=== Cat 2 bis top 500 (sans Chine/HK/TW) : {len(top500)} ===")
    print(f"Exclus Chine/HK/TW : {out['excluded_china_hk_tw']}")
    # Stats par country
    from collections import Counter
    cc = Counter(r["country"] for r in top500)
    print(f"Top 10 pays :")
    for c, n in cc.most_common(10):
        print(f"  {c or '(unknown)':20s} : {n}")


if __name__ == "__main__":
    main()
