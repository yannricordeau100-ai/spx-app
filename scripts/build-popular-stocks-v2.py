#!/usr/bin/env python3
"""build-popular-stocks-v2.py — Construire le ranking "actions les plus
populaires chez les investisseurs" par pays + monde.

Proxy honnête utilisé : **dollar volume 3 mois** (volume × prix moyen).
C'est le meilleur signal "argent qui circule" disponible sans accès
broker payant.

Pourquoi pas Wikipedia : pageviews mesure curiosité grand public (news,
controverse, recrutement, histoire) PAS l'intérêt investisseur.

Pourquoi pas "most consulted on Yahoo" : pas d'API publique fiable, et
"consulté" inclut beaucoup de bruit (clics curieux).

Pourquoi dollar volume :
- C'est de l'argent réel qui change de mains
- Inclut retail + institutionnel (pas que retail)
- Comparable entre USD/EUR/GBP via FX
- Mise à jour quotidienne via yfinance free

Univers : v1-8-tickers-sorted.json (341 stés top market cap mondial).

Sortie : src/data/popular-stocks-by-language.json (schéma compatible
avec ancien script Wikipedia).

Throttle : 0.4s entre fetches (RAM-light). ETA total ~3 min.
"""
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

try:
    import yfinance as yf
except ImportError:
    print("ERR: pip install yfinance", file=sys.stderr)
    sys.exit(2)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UNIVERSE_FILE = PROJECT_ROOT / "src/data/v1-8-tickers-sorted.json"
RANKS_DIR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
OUTPUT = PROJECT_ROOT / "src/data/popular-stocks-by-language.json"

# Suffixe ticker → pays principal (cotation)
SUFFIX_COUNTRY = {
    ".PA": "FR", ".DE": "DE", ".L": "GB", ".AS": "NL", ".ST": "SE",
    ".CO": "DK", ".SW": "CH", ".MI": "IT", ".MC": "ES", ".HE": "FI",
    ".OL": "NO", ".T": "JP", ".HK": "HK", ".TO": "CA", ".AX": "AU",
    ".BR": "BE", ".LS": "PT", ".VI": "AT", ".IR": "IE", ".SS": "CN",
}

# Pays → liste de langues du site qui doivent montrer ce pays en prio
COUNTRY_TO_LANGS = {
    "US": ["en"],
    "FR": ["fr"],
    "GB": ["en-GB"],
    "DE": ["de", "de-CH"],
    "NL": ["nl"],
    "SE": ["sv"],
    "DK": ["da"],
    "CH": ["de-CH"],
    "IT": ["en"],   # pas de langue IT côté site
    "ES": ["en"],
}

# Mapping language → country dont on extrait le top "national"
LANG_TO_LOCAL_COUNTRY = {
    "fr": "FR", "en": "US", "en-GB": "GB", "de": "DE",
    "nl": "NL", "sv": "SE", "da": "DK", "de-CH": "CH",
}


def detect_country(ticker: str) -> str:
    """Pays de cotation depuis le suffixe. Pas de suffixe = US."""
    for suffix, country in SUFFIX_COUNTRY.items():
        if ticker.endswith(suffix):
            return country
    return "US"


def load_meta_from_ranks(ticker: str) -> dict:
    """Lit market_cap + country existants si ranks.json présent."""
    safe = ticker.lower().replace("/", "-")
    path = RANKS_DIR / f"{safe}.ranks.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def fetch_volume_price(ticker: str):
    """Récupère avg dollar volume 3 mois.
    Retourne dict {avg_volume, avg_price, currency, name, country_yf}
    ou None si fail.
    """
    try:
        t = yf.Ticker(ticker)
        # fast_info plus rapide que info (pas full call API)
        try:
            fi = t.fast_info
            avg_vol = float(fi.get("three_month_average_volume") or 0)
            last_price = float(fi.get("last_price") or 0)
            currency = fi.get("currency") or "USD"
        except Exception:
            fi = None
            avg_vol = 0
            last_price = 0
            currency = "USD"

        # Fallback info si fast_info manque l'essentiel
        name = ""
        country_yf = ""
        if avg_vol == 0 or last_price == 0:
            info = t.info or {}
            avg_vol = avg_vol or float(info.get("averageVolume") or info.get("averageDailyVolume3Month") or 0)
            last_price = last_price or float(info.get("regularMarketPrice") or info.get("currentPrice") or 0)
            currency = currency or info.get("currency") or "USD"
            name = info.get("longName") or info.get("shortName") or ""
            country_yf = (info.get("country") or "").upper()
        else:
            # Tenter de récupérer le nom rapidement
            try:
                info = t.info or {}
                name = info.get("longName") or info.get("shortName") or ""
                country_yf = (info.get("country") or "").upper()
            except Exception:
                pass

        if avg_vol <= 0 or last_price <= 0:
            return None

        return {
            "avg_volume": avg_vol,
            "avg_price": last_price,
            "currency": currency,
            "name": name,
            "country_yf": country_yf,
        }
    except Exception as e:
        print(f"  [{ticker}] yfinance err: {e}", file=sys.stderr)
        return None


# FX approximatif (mise à jour rare, négligeable pour ranking relatif)
FX_TO_USD = {
    "USD": 1.0, "EUR": 1.08, "GBP": 1.27, "GBp": 0.0127,  # pence
    "CHF": 1.13, "JPY": 0.0065, "SEK": 0.094, "DKK": 0.145,
    "NOK": 0.094, "CAD": 0.74, "AUD": 0.66, "HKD": 0.128,
}


def to_usd(amount: float, currency: str) -> float:
    rate = FX_TO_USD.get(currency, 1.0)
    return amount * rate


def main():
    tickers = json.loads(UNIVERSE_FILE.read_text())
    print(f"Univers : {len(tickers)} tickers depuis {UNIVERSE_FILE.name}")

    enriched = []
    start = time.time()
    for i, ticker in enumerate(tickers, 1):
        data = fetch_volume_price(ticker)
        if data is None:
            print(f"  [{i}/{len(tickers)}] {ticker} skip (no data)")
            continue

        country = detect_country(ticker)
        # Si yfinance donne un pays plus précis, on garde la cotation suffix
        # (le pays "headquartered" peut différer du pays de cotation, ex BABA en US)
        local_dollar = data["avg_volume"] * data["avg_price"]
        usd_dollar = to_usd(local_dollar, data["currency"])

        # Récup market_cap depuis ranks.json si dispo (sinon yf)
        meta = load_meta_from_ranks(ticker)
        market_cap = meta.get("market_cap_usd") or 0

        # Nom : préférer ranks > yf
        name = data["name"] or meta.get("ticker") or ticker

        enriched.append({
            "ticker": ticker,
            "name": name,
            "country": country,
            "dollar_volume_usd": round(usd_dollar),
            "avg_volume": round(data["avg_volume"]),
            "avg_price": round(data["avg_price"], 2),
            "currency": data["currency"],
            "market_cap_usd": market_cap,
        })

        if i % 25 == 0:
            elapsed = time.time() - start
            eta = elapsed / i * (len(tickers) - i)
            print(f"  [{i}/{len(tickers)}] elapsed {elapsed:.0f}s · ETA {eta:.0f}s")
        time.sleep(0.4)

    print(f"\nEnrichi : {len(enriched)} / {len(tickers)} stés")

    # Tri par dollar volume desc
    enriched.sort(key=lambda x: x["dollar_volume_usd"], reverse=True)

    # Construire les rankings
    def with_rank(rows, key="dollar_volume_usd"):
        out = []
        for i, r in enumerate(rows, 1):
            out.append({
                "rank": i,
                "ticker": r["ticker"],
                "name": r["name"],
                "country": r["country"],
                "dollar_volume_usd": r["dollar_volume_usd"],
                "avg_volume": r["avg_volume"],
                "avg_price": r["avg_price"],
                "currency": r["currency"],
                "market_cap_usd": r["market_cap_usd"],
            })
        return out

    # WORLD = top 100 toutes cotations confondues
    world_top = with_rank(enriched[:100])

    # Par langue : top 50 stés cotées dans le pays "local" de la langue
    # + ajout top 25 mondial dilué pour donner de l'utilité aux pays sans
    # marché propre (ex Suisse a peu de cotations, mix avec mondial)
    output = {
        "_meta": {
            "window": f"3 derniers mois (volume moyen) au {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
            "source": "yfinance · dollar volume 3 mois (volume × prix moyen)",
            "explanation": "Argent qui circule sur la valeur. Inclut retail + institutionnel. Mise à jour quotidienne.",
            "universe_size": len(tickers),
            "enriched_size": len(enriched),
        },
        "world": world_top,
    }

    for lang, country in LANG_TO_LOCAL_COUNTRY.items():
        local = [r for r in enriched if r["country"] == country]
        # Au moins top 50 local. Si <50 dispo, complète avec top mondial.
        if len(local) >= 20:
            top = local[:50]
        else:
            # Pays sans assez de cotations dans v1-8 → utilise mondial (ex Suisse)
            existing_tickers = {r["ticker"] for r in local}
            for r in enriched:
                if r["ticker"] not in existing_tickers:
                    local.append(r)
                if len(local) >= 50:
                    break
            top = local[:50]

        output[lang] = with_rank(top)

    # Backup ancien fichier
    if OUTPUT.exists():
        backup = OUTPUT.with_suffix(f".bak-{datetime.now().strftime('%Y%m%d-%H%M')}.json")
        backup.write_text(OUTPUT.read_text())
        print(f"Backup ancien fichier : {backup.name}")

    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\nÉcrit : {OUTPUT}")
    print(f"  · world top 100")
    for lang in LANG_TO_LOCAL_COUNTRY.keys():
        print(f"  · {lang} top {len(output[lang])}")

    elapsed = time.time() - start
    print(f"\nTotal : {elapsed:.0f}s")


if __name__ == "__main__":
    main()
