#!/usr/bin/env python3
"""
cross-source-validate.py — Mettrik Phase 2C
============================================
Compare les donnees Mettrik (src/data/v2-pipeline/<ticker>.json) avec
les donnees market live yfinance pour le top 50 tickers.

Sortie : src/data/cross-source-deltas.json (alertes, jamais d'overwrite data).

Politique :
- 1 seul process, sleep 1s entre tickers (politesse yfinance + RAM Mac).
- Pas de modification des fichiers v2-pipeline/*.json (scope CONV-DATA).
- yfinance + stdlib uniquement.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("ERREUR: yfinance non installe. pip install yfinance", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
V2 = DATA / "v2-pipeline"
OUT = DATA / "cross-source-deltas.json"

# Seuils de classification
ECART_CAPI_WARN = 0.05   # 5% ecart capi -> warning
ECART_CAPI_CRIT = 0.20   # 20% ecart capi -> critical
TOP5_MIN_MCAP_USD = 2_000_000_000_000  # 2000 Mds$ floor pour pretendre "#1 mondial"
SLEEP_SEC = 1.0

# Mapping ticker Mettrik -> ticker yfinance (BRK-B etc)
YF_TICKER_MAP = {
    "BRK-B": "BRK-B",
    "BRK.B": "BRK-B",
}

def load_tickers_top50():
    """Charge la liste top 50 (v1-9-5 si dispo, sinon v1-8)."""
    candidates = [
        DATA / "v1-9-5-tickers-sorted.json",
        DATA / "v1-8-tickers-sorted.json",
    ]
    for p in candidates:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                lst = json.load(f)
            return lst[:50], p.name
    raise FileNotFoundError("Aucun fichier de tickers sortes trouve")

def load_mettrik(ticker):
    """Charge le fichier v2-pipeline/<ticker>.json (lowercase). None si absent."""
    fname = f"{ticker.lower()}.json"
    p = V2 / fname
    if not p.exists():
        # essai BRK-B -> brk-b.json ou brk.b.json
        alt = V2 / f"{ticker.lower().replace('.', '-')}.json"
        if alt.exists():
            p = alt
        else:
            return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  ! erreur lecture {fname}: {e}", file=sys.stderr)
        return None

def fetch_yfinance(ticker):
    """Fetch info yfinance. Retourne dict ou None si echec."""
    yf_ticker = YF_TICKER_MAP.get(ticker, ticker)
    try:
        info = yf.Ticker(yf_ticker).info
        if not info or "marketCap" not in info:
            # fallback fast_info
            fi = yf.Ticker(yf_ticker).fast_info
            return {
                "marketCap": getattr(fi, "market_cap", None),
                "currentPrice": getattr(fi, "last_price", None),
                "sharesOutstanding": getattr(fi, "shares", None),
                "sector": None,
                "shortName": ticker,
                "_source": "fast_info",
            }
        return {
            "marketCap": info.get("marketCap"),
            "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "sector": info.get("sector"),
            "shortName": info.get("shortName") or info.get("longName"),
            "_source": "info",
        }
    except Exception as e:
        return {"_error": str(e)}

def mds_usd(mcap):
    """Convertit en milliards USD."""
    if mcap is None:
        return None
    return round(mcap / 1_000_000_000, 1)

def estimate_rank(mcap_usd):
    """Estime le rang mondial approximatif (mai 2026) selon capi USD."""
    if mcap_usd is None:
        return None
    mds = mcap_usd / 1e9
    # Seuils approximatifs (top capi mondiales 2026)
    if mds >= 3500: return 1
    if mds >= 3000: return 2
    if mds >= 2500: return 3
    if mds >= 2000: return 5
    if mds >= 1500: return 7
    if mds >= 1000: return 10
    if mds >= 700:  return 15
    if mds >= 500:  return 25
    if mds >= 300:  return 50
    return 100

def compare(ticker, mettrik, yfin):
    """Compare et retourne liste de deltas."""
    deltas = []

    if yfin is None or yfin.get("_error"):
        deltas.append({
            "ticker": ticker,
            "field": "_yfinance_fetch",
            "severity": "warning",
            "note": f"yfinance fetch failed: {yfin.get('_error') if yfin else 'None'}",
        })
        return deltas

    if mettrik is None:
        deltas.append({
            "ticker": ticker,
            "field": "_mettrik_dataset",
            "severity": "warning",
            "note": "Pas de fichier v2-pipeline/<ticker>.json (ticker non couvert)",
        })
        return deltas

    yf_mcap = yfin.get("marketCap")
    yf_mcap_mds = mds_usd(yf_mcap)
    real_rank = estimate_rank(yf_mcap)

    # 1) Verif rank global_world : extraire le N de "#N" et comparer au rang reel
    ranks = mettrik.get("ranks", {}) or {}
    global_world = ranks.get("global_world")
    if global_world and yf_mcap:
        import re
        m = re.search(r"#(\d+)", str(global_world))
        if m:
            claimed_rank = int(m.group(1))
            # Critical : Mettrik pretend "#1" mais capi < seuil top5
            if claimed_rank == 1 and yf_mcap < TOP5_MIN_MCAP_USD:
                deltas.append({
                    "ticker": ticker,
                    "field": "ranks.global_world",
                    "mettrik": global_world,
                    "yfinance_marketcap_mds": yf_mcap_mds,
                    "estimated_real_rank": real_rank,
                    "severity": "critical",
                    "note": f"Mettrik dit '{global_world}' mais capi {yf_mcap_mds} Mds$ implique rang ~#{real_rank}",
                })
            # Warning : ecart rang > facteur 2 (et claimed_rank > 1)
            elif real_rank and claimed_rank > 1 and (
                claimed_rank > real_rank * 2 or real_rank > claimed_rank * 2
            ):
                deltas.append({
                    "ticker": ticker,
                    "field": "ranks.global_world",
                    "mettrik": global_world,
                    "yfinance_marketcap_mds": yf_mcap_mds,
                    "estimated_real_rank": real_rank,
                    "severity": "warning",
                    "note": f"Mettrik dit '{global_world}' mais capi {yf_mcap_mds} Mds$ implique rang ~#{real_rank}",
                })

    # 2) Coherence sector (info)
    yf_sector = yfin.get("sector")
    m_sector = mettrik.get("sector")
    if yf_sector and m_sector and yf_sector.lower() != m_sector.lower():
        # Tolerance : "Technology" vs "Tech", "Healthcare" vs "Health"...
        if not (yf_sector.lower()[:4] == m_sector.lower()[:4]):
            deltas.append({
                "ticker": ticker,
                "field": "sector",
                "mettrik": m_sector,
                "yfinance": yf_sector,
                "severity": "warning",
                "note": "Divergence secteur",
            })

    # 3) Capi : si dataset stocke capi (rare ici, mais on check)
    m_capi = mettrik.get("market_cap") or mettrik.get("marketCap") or mettrik.get("capi")
    if m_capi is not None and yf_mcap:
        # Normaliser : si Mettrik en Mds$
        if m_capi < 100000:  # probablement en Mds
            m_capi_usd = m_capi * 1e9
        else:
            m_capi_usd = m_capi
        ecart = abs(m_capi_usd - yf_mcap) / yf_mcap
        if ecart > ECART_CAPI_CRIT:
            sev = "critical"
        elif ecart > ECART_CAPI_WARN:
            sev = "warning"
        else:
            sev = None
        if sev:
            deltas.append({
                "ticker": ticker,
                "field": "market_cap",
                "mettrik_mds": mds_usd(m_capi_usd),
                "yfinance_mds": yf_mcap_mds,
                "ecart_pct": round(ecart * 100, 1),
                "severity": sev,
                "note": f"Ecart capi {round(ecart*100,1)}%",
            })

    # 4) Note informative : pas de capi stockee
    if m_capi is None:
        deltas.append({
            "ticker": ticker,
            "field": "market_cap",
            "mettrik": None,
            "yfinance_mds": yf_mcap_mds,
            "estimated_real_rank": real_rank,
            "severity": "info",
            "note": f"Pas de capi stockee Mettrik. Live: {yf_mcap_mds} Mds$ (rang ~#{real_rank})",
        })

    # 5) Hero KPI : note descriptive (non comparable)
    hero = mettrik.get("hero_kpi")
    kpis = mettrik.get("kpis") or []
    hero_val = None
    hero_unit = None
    if kpis:
        hero_val = kpis[0].get("value")
        hero_unit = kpis[0].get("unit")
    deltas.append({
        "ticker": ticker,
        "field": "hero_kpi",
        "mettrik": hero,
        "mettrik_value": hero_val,
        "mettrik_unit": hero_unit,
        "severity": "info",
        "note": "Hero KPI = donnee metier, non comparable yfinance (info uniquement)",
    })

    return deltas

def main():
    print(f"[cross-source-validate] start {datetime.now(timezone.utc).isoformat()}")
    tickers, src_file = load_tickers_top50()
    print(f"  source: {src_file} ({len(tickers)} tickers)")

    all_deltas = []
    summary = {"ok": 0, "info": 0, "warning": 0, "critical": 0}

    for i, t in enumerate(tickers, 1):
        print(f"[{i:2d}/{len(tickers)}] {t} ...", end=" ", flush=True)
        mettrik = load_mettrik(t)
        yfin = fetch_yfinance(t)
        deltas = compare(t, mettrik, yfin)
        if not deltas:
            summary["ok"] += 1
            print("ok")
        else:
            # compter le pire niveau
            sevs = [d.get("severity", "info") for d in deltas]
            worst = "critical" if "critical" in sevs else ("warning" if "warning" in sevs else "info")
            summary[worst] += 1
            all_deltas.extend(deltas)
            crit_count = sum(1 for d in deltas if d.get("severity") == "critical")
            warn_count = sum(1 for d in deltas if d.get("severity") == "warning")
            print(f"deltas={len(deltas)} (crit={crit_count} warn={warn_count})")
        time.sleep(SLEEP_SEC)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_tickers_file": src_file,
        "tickers_checked": len(tickers),
        "summary": summary,
        "thresholds": {
            "ecart_capi_warn_pct": ECART_CAPI_WARN * 100,
            "ecart_capi_critical_pct": ECART_CAPI_CRIT * 100,
            "top5_min_marketcap_usd": TOP5_MIN_MCAP_USD,
        },
        "deltas": all_deltas,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n[cross-source-validate] done")
    print(f"  output: {OUT}")
    print(f"  summary: {summary}")

    # Top 5 critiques
    criticals = [d for d in all_deltas if d.get("severity") == "critical"]
    if criticals:
        print(f"\nTOP 5 CRITIQUES:")
        for d in criticals[:5]:
            print(f"  - {d['ticker']} [{d['field']}]: {d.get('note')}")

if __name__ == "__main__":
    main()
