#!/usr/bin/env python3
"""enrich-dividend-kpis-yfinance.py — Ajoute DPS + Cap Return + Payout Ratio
sur les stés du top 307 (et autres) qui paient un dividende mais n'ont pas
ces 3 KPIs requis par le bloc DividendStories.

Source : yfinance.dividends (DPS), .cashflow (Cap Return = Common Stock
Dividend Paid), .income_stmt (Payout Ratio = Dividends Paid / Net Income).

Sortie : append KPIs dans v2-pipeline/<ticker>.json. Ne touche pas aux KPIs
existants. Skip si les 3 KPIs existent déjà.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/dividend-missing.txt"))

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr)
    sys.exit(1)


def main():
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    print(f"📊 Dividend KPIs yfinance : {len(pending)} stés à enrichir", flush=True)

    added_full = 0
    partial = 0
    no_data = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(pending)}] full={added_full} partial={partial} no_data={no_data} fails={fails}", flush=True)
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue
        kpis = data.get("kpis") or []
        existing = {k.get("short") for k in kpis}

        try:
            t = yf.Ticker(tk)
            info = t.info or {}
            divs = t.dividends  # Series indexed by date, value = $ per share
            cf = t.cashflow
            inc = t.income_stmt
        except Exception:
            fails += 1
            continue

        # Build DPS annual series from t.dividends (sum by year)
        dps_by_year = {}
        try:
            for ts, val in divs.items():
                if val is None or val != val: continue
                y = ts.year if hasattr(ts, "year") else int(str(ts)[:4])
                dps_by_year[y] = dps_by_year.get(y, 0) + float(val)
        except Exception:
            pass

        # Cap Return (Common Dividends Paid) from cashflow (negative number)
        cap_ret_series = []
        if cf is not None and not cf.empty:
            for key in ["Cash Dividends Paid", "Common Stock Dividend Paid", "Common Dividend Paid"]:
                if key in cf.index:
                    for col, val in cf.loc[key].items():
                        if val is None or (isinstance(val, float) and val != val): continue
                        y = col.year if hasattr(col, "year") else int(str(col)[:4])
                        cap_ret_series.append((y, abs(float(val))))
                    break
        cap_ret_series.sort()

        # Net Income from income_stmt (for Payout Ratio)
        ni_by_year = {}
        if inc is not None and not inc.empty and "Net Income" in inc.index:
            for col, val in inc.loc["Net Income"].items():
                if val is None or (isinstance(val, float) and val != val): continue
                y = col.year if hasattr(col, "year") else int(str(col)[:4])
                ni_by_year[y] = float(val)

        # Build KPIs
        cur = info.get("currency") or "USD"
        cur_sym = "$" if cur == "USD" else cur
        added_this = 0

        # DPS
        if "DPS" not in existing and len(dps_by_year) >= 3:
            years = sorted(dps_by_year.keys())[-7:]
            vals = [round(dps_by_year[y], 4) for y in years]
            last = vals[-1]; prev = vals[-2] if len(vals)>=2 else None
            yoy = ""
            if prev and prev > 0:
                pct = (last-prev)/abs(prev)*100; yoy = f"{'+' if pct>=0 else ''}{pct:.1f}%"
            kpis.append({
                "short":"DPS","name_fr":"Dividende par action","name_en":"Dividend Per Share",
                "value":last,"unit":cur_sym,"yoy":yoy,"history":vals,
                "type":"Dividende","nature":"comptable","comparable":True,
                "signal":f"Dividende par action de {last} {cur_sym} dernière année.",
                "description":f"Dividende par action versé annuellement, agrégé depuis yfinance.dividends sur les {len(vals)} dernières années fiscales déclarées par la société.",
                "is_generic":True,
                "_source":"yfinance.dividends",
            })
            added_this += 1

        # Cap Return (in Mds local currency)
        if "Cap Return" not in existing and len(cap_ret_series) >= 3:
            years = [y for y,_ in cap_ret_series][-7:]
            vals = [round(v/1e9, 3) for _,v in cap_ret_series[-7:]]
            last = vals[-1]; prev = vals[-2] if len(vals)>=2 else None
            yoy = ""
            if prev and prev > 0:
                pct = (last-prev)/abs(prev)*100; yoy = f"{'+' if pct>=0 else ''}{pct:.1f}%"
            unit_cap = f"Mds {cur_sym}"
            kpis.append({
                "short":"Cap Return","name_fr":"Capital retourné (dividendes)","name_en":"Capital Returned (Dividends)",
                "value":last,"unit":unit_cap,"yoy":yoy,"history":vals,
                "type":"Cash","nature":"comptable","comparable":True,
                "signal":f"Capital retourné aux actionnaires via dividendes de {last} {unit_cap} dernière année.",
                "description":f"Capital retourné aux actionnaires via dividendes annuels, extrait depuis yfinance.cashflow sur les {len(vals)} dernières années fiscales déclarées.",
                "is_generic":True,
                "_source":"yfinance.cashflow",
            })
            added_this += 1

        # Payout Ratio (= Dividend Paid / Net Income, %)
        if "Payout Ratio" not in existing:
            payout_series = []
            for y, divPaid in cap_ret_series:
                if y in ni_by_year and ni_by_year[y] > 0:
                    pct = (divPaid / ni_by_year[y]) * 100
                    payout_series.append((y, round(pct, 1)))
            if len(payout_series) >= 3:
                vals = [v for _,v in payout_series[-7:]]
                last = vals[-1]; prev = vals[-2] if len(vals)>=2 else None
                yoy = ""
                if prev and prev > 0:
                    delta = last - prev
                    yoy = f"{'+' if delta>=0 else ''}{delta:.1f} pts"
                kpis.append({
                    "short":"Payout Ratio","name_fr":"Taux de distribution","name_en":"Payout Ratio",
                    "value":last,"unit":"%","yoy":yoy,"history":vals,
                    "type":"Dividende","nature":"comptable","comparable":True,
                    "signal":f"Part du résultat net distribué en dividendes : {last}% dernière année.",
                    "description":f"Taux de distribution = Dividendes versés / Résultat net, calculé sur les {len(vals)} dernières années fiscales depuis yfinance.cashflow et yfinance.income_stmt.",
                    "is_generic":True,
                    "_source":"computed: yfinance.cashflow / yfinance.income_stmt",
                })
                added_this += 1

        if added_this == 3:
            added_full += 1
        elif added_this > 0:
            partial += 1
        else:
            no_data += 1

        if added_this > 0:
            data["kpis"] = kpis
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception:
                fails += 1

        time.sleep(0.3)

    print(f"DONE: full_3kpis={added_full} partial={partial} no_data={no_data} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
