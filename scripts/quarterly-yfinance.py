#!/usr/bin/env python3
"""
Quarterly extraction via yfinance — détecte la fréquence + récup data gratuit.

Pour chaque sté :
  1. Fetch quarterly_income_stmt via yfinance (gratuit, pas LLM)
  2. Détecte fréquence réelle depuis les dates des périodes :
     - Δ ~90j → trimestriel
     - Δ ~180j → semestriel
     - Δ ~365j → annuel
  3. Si hero_kpi mappable à yfinance metric (Revenue, Net Income, etc.) → utilise data directement
  4. Sinon : juste set period_type, laisse history existant (Sonnet plus tard pour segments)

Coût : $0 (yfinance gratuit, pas de LLM).
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src/data/v2-pipeline"
LOG_PATH = ROOT / "sec-data/_meta/quarterly-yfinance.log"

# Mapping hero KPI typique → yfinance metric (pour récupérer history direct)
HERO_TO_YF = {
    # Revenue variants
    "revenue": "TotalRevenue",
    "total revenue": "TotalRevenue",
    "net revenue": "TotalRevenue",
    "net sales": "TotalRevenue",
    "total net sales": "TotalRevenue",
    "total net revenues": "TotalRevenue",
    "revenues": "TotalRevenue",
    # Income
    "net income": "NetIncome",
    "operating income": "OperatingIncome",
    "operating profit": "OperatingIncome",
    "ebitda": "EBITDA",
    "adjusted ebitda": "EBITDA",
    # Per share
    "eps": "BasicEPS",
    "diluted eps": "DilutedEPS",
    "diluted earnings per share": "DilutedEPS",
}


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n"); fh.flush()


def detect_frequency(dates: list) -> str:
    """Depuis une liste de dates de périodes, retourne 'quarter', 'semester', ou 'annual'."""
    if len(dates) < 2:
        return "annual"
    # Tri ascending
    sorted_dates = sorted(dates)
    deltas = [(sorted_dates[i+1] - sorted_dates[i]).days for i in range(len(sorted_dates)-1)]
    avg = sum(deltas) / len(deltas)
    if avg < 120:
        return "quarter"
    elif avg < 240:
        return "semester"
    else:
        return "annual"


def choose_scale(values: list[float]) -> tuple[float, str]:
    """Choisit UNE échelle unique pour toute la série basée sur la valeur max.
    Retourne (divisor, unit_str)."""
    if not values:
        return 1, "$"
    abs_max = max(abs(v) for v in values if v is not None)
    if abs_max >= 1e9:
        return 1e9, "Mds $"
    elif abs_max >= 1e6:
        return 1e6, "M $"
    elif abs_max >= 1e3:
        return 1e3, "K $"
    else:
        return 1, "$"


def detect_unit_scale(value) -> tuple[float, str]:
    """LEGACY : conservé pour compat, mais ne pas utiliser pour series."""
    if value is None: return None, ""
    abs_v = abs(value)
    if abs_v >= 1e9: return round(value / 1e9, 3), "Mds $"
    elif abs_v >= 1e6: return round(value / 1e6, 2), "M $"
    else: return round(value, 2), "$"


def process_ticker(ticker: str) -> dict:
    """Process 1 ticker, retourne dict résultat."""
    res = {"ticker": ticker, "status": "fail", "msg": ""}
    json_path = OUT_DIR / f"{ticker.lower()}.json"
    if not json_path.exists():
        res["msg"] = "no-dataset"
        return res
    try:
        d = json.loads(json_path.read_text())
    except:
        res["msg"] = "bad-json"
        return res

    kpis = d.get("kpis", [])
    hero_short = d.get("hero_kpi")
    hero_kpi = next((k for k in kpis if k.get("short") == hero_short), kpis[0] if kpis else None)
    if not hero_kpi:
        res["msg"] = "no-hero"
        return res
    if hero_kpi.get("period_type") in ("quarter", "semester"):
        res["status"] = "skip"
        res["msg"] = "already-period"
        return res

    # yfinance fetch
    try:
        tk = yf.Ticker(ticker)
        # quarterly d'abord
        qis = tk.quarterly_income_stmt
        if qis is None or qis.empty:
            qis = tk.income_stmt  # annual fallback
        if qis is None or qis.empty:
            res["msg"] = "no-yfinance-data"
            return res
    except Exception as e:
        res["msg"] = f"yf-error-{type(e).__name__}"
        return res

    # Dates des périodes (colonnes du DataFrame)
    period_dates = list(qis.columns)
    if len(period_dates) < 2:
        res["msg"] = "too-few-periods"
        return res

    period_type = detect_frequency(period_dates)

    # Tente de mapper hero_kpi à un row yfinance
    hero_name = (hero_kpi.get("name_en") or hero_kpi.get("short") or "").lower().strip()
    yf_metric = HERO_TO_YF.get(hero_name)
    if not yf_metric:
        # Essaie sur le short
        yf_metric = HERO_TO_YF.get(hero_short.lower().strip() if hero_short else "")

    history = []
    last_date = None
    last_value = None
    last_unit = hero_kpi.get("unit", "")

    if yf_metric and yf_metric in qis.index:
        # Récupère history sur cette metric — UNE SEULE échelle pour toute la série
        row = qis.loc[yf_metric]
        sorted_idx = sorted(row.index)
        raw_values = []
        raw_dates = []
        for date in sorted_idx:
            v = row[date]
            if pd.notna(v):
                raw_values.append(float(v))
                raw_dates.append(date)
        if not raw_values:
            res["msg"] = "no-numeric-values"
            return res
        # Choix unique d'échelle basé sur le max de la série
        divisor, unit = choose_scale(raw_values)
        history = [round(v / divisor, 3) for v in raw_values]
        last_date = raw_dates[-1]
        last_value = history[-1]
        last_unit = unit
    else:
        # Pas mappable : on garde l'history existant, on set juste period_type
        # Mais en l'absence de history yfinance, on ne peut pas confirmer la fréquence sans data
        # Donc on set period_type=annual par défaut si pas mappable
        history = hero_kpi.get("history", [])
        if not history:
            res["msg"] = f"hero-not-mapped-no-existing-history ({hero_name})"
            return res
        # On ne change rien d'existant, juste on note period_type d'après yfinance détection
        last_date = period_dates[0] if period_dates else None

    # Patch dataset
    hero_kpi["period_type"] = period_type
    if yf_metric and yf_metric in qis.index:
        hero_kpi["history"] = history
        hero_kpi["unit"] = last_unit
        if last_value is not None:
            hero_kpi["value"] = last_value
        # Reset TTM (sera recalculé proprement par autre script si besoin)
        if "ttm" in hero_kpi:
            hero_kpi["ttm"] = None
    if last_date:
        hero_kpi["last_data_date"] = pd.Timestamp(last_date).strftime("%Y-%m-%d")

    d.setdefault("_quarterly_extraction", {}).update({
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "n_periods": len(history),
        "period_type": period_type,
        "method": "yfinance",
        "yf_metric": yf_metric or "(none-fallback-existing-history)",
    })

    json_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    res["status"] = "ok"
    res["msg"] = f"{period_type}-{len(history)}p-{yf_metric or 'kept-existing'}"
    return res


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker-file", required=True)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=15)
    args = p.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")

    tickers = [l.strip().upper() for l in Path(args.ticker_file).read_text().splitlines() if l.strip()]
    if args.limit:
        tickers = tickers[:args.limit]
    log(f"YFINANCE QUARTERLY : {len(tickers)} stés, {args.workers} threads", fh)

    counts = {}
    detail = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_ticker, tk): tk for tk in tickers}
        for i, fut in enumerate(as_completed(futs)):
            r = fut.result()
            key = r["status"]
            counts[key] = counts.get(key, 0) + 1
            if r["status"] == "ok":
                detail.append(r["msg"])
            if (i+1) % 50 == 0:
                log(f"  {i+1}/{len(tickers)} | counts={counts}", fh)

    # Stats par period_type
    from collections import Counter
    period_counts = Counter()
    for m in detail:
        if m:
            pt = m.split("-")[0]
            period_counts[pt] += 1
    log(f"=== TOTAL : {counts} ===", fh)
    log(f"=== Par period_type : {dict(period_counts)} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
