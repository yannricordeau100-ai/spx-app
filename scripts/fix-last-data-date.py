#!/usr/bin/env python3
"""
Fix last_data_date des KPIs hero via yfinance (gratuit).
Utilise quarterly_income_stmt.columns[0] comme dernière période data dispo.
"""
import json
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/data/v2-pipeline"


def get_latest_period(ticker: str) -> str | None:
    try:
        tk = yf.Ticker(ticker)
        qis = tk.quarterly_income_stmt
        if qis is None or qis.empty:
            qis = tk.income_stmt
        if qis is None or qis.empty: return None
        latest = max(qis.columns)
        if isinstance(latest, pd.Timestamp):
            return latest.strftime("%Y-%m-%d")
    except Exception:
        return None
    return None


def needs_fix(d: dict) -> bool:
    kpis = d.get("kpis", []) or []
    hero = d.get("hero_kpi")
    hk = next((k for k in kpis if k.get("short") == hero), kpis[0] if kpis else None)
    if not hk: return False
    ldd = hk.get("last_data_date")
    if not ldd: return True
    try:
        dt = datetime.fromisoformat(ldd.replace("Z", ""))
        return (datetime.now() - dt).days > 540
    except Exception:
        return True


def process(ticker: str) -> tuple[str, bool, str]:
    json_path = OUT / f"{ticker.lower()}.json"
    try: d = json.loads(json_path.read_text())
    except: return ticker, False, "bad-json"
    if "_validation" not in d: return ticker, False, "not-validated"
    if not needs_fix(d): return ticker, False, "skip-already-fresh"
    new_date = get_latest_period(ticker)
    if not new_date: return ticker, False, "no-yfinance"
    kpis = d.get("kpis", []) or []
    hero = d.get("hero_kpi")
    hk = next((k for k in kpis if k.get("short") == hero), kpis[0] if kpis else None)
    if not hk: return ticker, False, "no-hero"
    hk["last_data_date"] = new_date
    json_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    return ticker, True, new_date


def main():
    tickers = []
    for f in OUT.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n: continue
        try: d = json.loads(f.read_text())
        except: continue
        if "_validation" not in d: continue
        if needs_fix(d):
            tickers.append(n[:-5].upper())
    print(f"À fixer : {len(tickers)}")
    fixed = 0
    with ThreadPoolExecutor(max_workers=20) as ex:
        futs = {ex.submit(process, tk): tk for tk in tickers}
        for i, fut in enumerate(as_completed(futs)):
            tk, ok, msg = fut.result()
            if ok: fixed += 1
            if (i+1) % 50 == 0:
                print(f"  {i+1}/{len(tickers)} ({fixed} fixed)")
    print(f"DONE : {fixed}/{len(tickers)} fixed")


if __name__ == "__main__":
    main()
