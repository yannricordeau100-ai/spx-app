#!/usr/bin/env python3
"""enrich-balance-sheet-yfinance.py — Ajout KPIs balance sheet basiques via
yfinance pour toutes les stés v2-pipeline qui ont <8 KPIs.

Pour chaque sté :
- yfinance.balance_sheet (Total Assets, Total Debt, Cash, Stockholders Equity)
- yfinance.cashflow (Operating Cash Flow, Free Cash Flow)
- Ajoute uniquement les shorts NOT already present
- Skip si kpis >= 8 déjà

Source : yfinance (free, unlimited).
ETA : ~15 min sur 1000+ stés.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/all-unfit-pending.txt"))

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr)
    sys.exit(1)


def get_year_values(df_row, max_points=8):
    if df_row is None:
        return []
    out = []
    for col, val in df_row.items():
        if val is None or (hasattr(val, "isna") and val.isna()) or (isinstance(val, float) and (val != val)):
            continue
        try:
            year = col.year if hasattr(col, "year") else int(str(col)[:4])
            v = float(val)
            out.append((year, v))
        except Exception:
            continue
    out.sort(key=lambda x: x[0])
    return out[-max_points:]


# (short, yfinance_key, name_fr, unit, type, source_df)
CANDIDATES = [
    ("Total Assets", "Total Assets", "Total des actifs", "Mds €", "Balance Sheet", "balance_sheet"),
    ("Total Debt", "Total Debt", "Dette totale", "Mds €", "Balance Sheet", "balance_sheet"),
    ("Cash & Equivalents", "Cash And Cash Equivalents", "Trésorerie & équivalents", "Mds €", "Cash", "balance_sheet"),
    ("Stockholders Equity", "Stockholders Equity", "Capitaux propres", "Mds €", "Balance Sheet", "balance_sheet"),
    ("Operating Cash Flow", "Operating Cash Flow", "Cash flow opérationnel", "Mds €", "Cash", "cashflow"),
    ("Free Cash Flow", "Free Cash Flow", "Free Cash Flow", "Mds €", "Cash", "cashflow"),
    ("Capex", "Capital Expenditure", "Capex (Investissements)", "Mds €", "Cash", "cashflow"),
]


def fmt_value(v, divisor=1e9):
    return round(v / divisor, 2)


def main():
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    print(f"📊 Balance Sheet yfinance : {len(pending)} stés", flush=True)

    updated = 0
    added_total = 0
    no_source = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 50 == 0:
            print(f"  [{i}/{len(pending)}] updated={updated} added={added_total} no_src={no_source} fails={fails}", flush=True)
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue
        kpis = data.get("kpis") or []
        # Skip if already has 8+ KPIs (already enriched enough)
        if len(kpis) >= 8:
            continue
        existing_shorts = {k.get("short") for k in kpis}

        try:
            t = yf.Ticker(tk)
            bs = t.balance_sheet
            cf = t.cashflow
        except Exception:
            fails += 1
            continue
        if (bs is None or bs.empty) and (cf is None or cf.empty):
            no_source += 1
            continue

        added_this = 0
        for short, yf_key, name_fr, unit, kpi_type, src in CANDIDATES:
            if short in existing_shorts:
                continue
            df = bs if src == "balance_sheet" else cf
            if df is None or df.empty:
                continue
            if yf_key not in df.index:
                continue
            hist = get_year_values(df.loc[yf_key])
            if len(hist) < 4:
                continue
            vals = [fmt_value(v) for _, v in hist]
            last = vals[-1]
            prev = vals[-2] if len(vals) >= 2 else None
            yoy = ""
            if prev and prev != 0:
                pct = (last - prev) / abs(prev) * 100
                yoy = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
            new_kpi = {
                "short": short,
                "name_fr": name_fr,
                "name_en": yf_key,
                "value": last,
                "unit": unit,
                "yoy": yoy,
                "history": vals,
                "type": kpi_type,
                "nature": "comptable",
                "comparable": True,
                "signal": f"{name_fr} de {last} {unit} dernière année",
                "description": f"{name_fr} extrait yfinance sur les {len(vals)} dernières années.",
                "is_generic": True,
                "_source": f"yfinance.{src}",
            }
            kpis.append(new_kpi)
            added_this += 1
            added_total += 1
            if len(kpis) >= 8:
                break

        if added_this:
            data["kpis"] = kpis
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
                updated += 1
            except Exception:
                fails += 1

        time.sleep(0.25)

    print(f"DONE: updated={updated} added={added_total} no_source={no_source} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
