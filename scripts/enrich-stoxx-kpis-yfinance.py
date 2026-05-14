#!/usr/bin/env python3
"""enrich-stoxx-kpis-yfinance.py — Fill hero_history et KPIs basiques pour
Stoxx 600 EU via yfinance financial statements (free, unlimited).

Pour chaque sté de Stoxx 600 :
- yfinance.income_stmt + balance_sheet + cashflow (annual + quarterly)
- Si hero_kpi match Revenue/Sales/CA/Chiffre → fill hero_history depuis income_stmt
- Si <5 KPIs : ajoute Revenue, Net Income, Op Income, FCF, EPS comme nouveaux KPIs

Source : yfinance (Yahoo Finance), gratuit, illimité.
ETA : ~10 min pour 375 stés (yfinance ~1-2s per call).
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
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/stoxx-all.txt"))

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr)
    sys.exit(1)

# Match heuristique hero_kpi → champ yfinance
HERO_PATTERNS = {
    "Total Revenue": [r"^revenue$", r"^sales$", r"chiffre d.affaire", r"^total revenue", r"^net revenue", r"^net sales"],
    "Operating Income": [r"^operating income", r"^op income", r"r.sultat op.ratio"],
    "Net Income": [r"^net income", r"^profit$", r"r.sultat net"],
    "EBITDA": [r"^ebitda$"],
    "Free Cash Flow": [r"^free cash flow", r"^fcf$"],
    "Diluted EPS": [r"^diluted eps", r"^eps$", r"b.n.fice par action"],
}


def match_hero(hero_short: str, hero_name_fr: str = ""):
    text = f"{hero_short} {hero_name_fr}".lower()
    for yf_key, patterns in HERO_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, text):
                return yf_key
    return None


def get_year_values(df_row, max_points=8):
    """Extract series of values from a row of yfinance financials DataFrame.
    Returns list of (year, value) sorted by year ascending.
    """
    if df_row is None:
        return []
    out = []
    for col, val in df_row.items():
        if val is None or (hasattr(val, "isna") and val.isna()) or (isinstance(val, float) and (val != val)):  # NaN check
            continue
        try:
            year = col.year if hasattr(col, "year") else int(str(col)[:4])
            v = float(val)
            out.append((year, v))
        except Exception:
            continue
    out.sort(key=lambda x: x[0])
    return out[-max_points:]


def main():
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    print(f"📊 Stoxx kpis yfinance : {len(pending)} stés", flush=True)

    updated_hero = 0
    added_kpis = 0
    no_source = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(pending)}] hero={updated_hero} added_kpis={added_kpis} no_src={no_source} fails={fails}", flush=True)
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue
        kpis = data.get("kpis") or []
        hero = data.get("hero_kpi") or ""
        h_kpi = next((k for k in kpis if k.get("short") == hero), None)
        h_idx = next((i for i, k in enumerate(kpis) if k.get("short") == hero), None)

        # Skip if hero history already long enough AND >=5 KPIs
        need_history = h_kpi and len(h_kpi.get("history") or []) < 4
        need_kpis = len(kpis) < 5
        if not need_history and not need_kpis:
            continue

        try:
            t = yf.Ticker(tk)
            inc = t.income_stmt
            bs = t.balance_sheet
            cf = t.cashflow
        except Exception:
            fails += 1
            continue

        if inc is None or inc.empty:
            no_source += 1
            continue

        # Try fill hero_history if hero matches a known yfinance field
        changed = False
        if need_history and h_kpi:
            yf_key = match_hero(hero, h_kpi.get("name_fr", ""))
            if yf_key and yf_key in inc.index:
                hist = get_year_values(inc.loc[yf_key])
                if len(hist) >= 4:
                    # values in millions/billions? yfinance returns in original currency
                    # For revenue, typical >= 1e8. Convert to Mds if unit is "Mds"
                    unit = (h_kpi.get("unit") or "").lower()
                    divisor = 1.0
                    if "md" in unit or "billion" in unit or unit == "b":
                        divisor = 1e9
                    elif "m " in unit or unit.startswith("m") or "million" in unit:
                        divisor = 1e6
                    vals = [round(v / divisor, 2) for _, v in hist]
                    kpis[h_idx]["history"] = vals
                    kpis[h_idx]["_hero_history_source"] = "yfinance.income_stmt (annual)"
                    kpis[h_idx]["_hero_history_extracted_at"] = datetime.now(timezone.utc).isoformat()
                    # Remove unverified flag if it was set
                    kpis[h_idx].pop("_hero_history_unverified", None)
                    kpis[h_idx].pop("_hero_history_unverified_reason", None)
                    updated_hero += 1
                    changed = True

        # Add basic KPIs if <5
        if need_kpis:
            existing_shorts = {k.get("short") for k in kpis}
            candidates = [
                ("Total Revenue", "Total Revenue", "Chiffre d'affaires", "Mds €", "Comptes", "comptable"),
                ("Net Income", "Net Income", "Résultat net", "Mds €", "Comptes", "comptable"),
                ("Operating Income", "Operating Income", "Résultat opérationnel", "Mds €", "Comptes", "comptable"),
                ("Diluted EPS", "Diluted EPS", "BPA dilué", "€", "Comptes", "comptable"),
                ("Free Cash Flow", "Free Cash Flow", "Free Cash Flow", "Mds €", "Cash", "comptable"),
            ]
            for short, yf_key, name_fr, unit, kpi_type, nature in candidates:
                if short in existing_shorts:
                    continue
                if yf_key not in inc.index and yf_key not in cf.index if cf is not None else True:
                    continue
                series = None
                if yf_key in inc.index:
                    series = inc.loc[yf_key]
                elif cf is not None and yf_key in cf.index:
                    series = cf.loc[yf_key]
                if series is None:
                    continue
                hist = get_year_values(series)
                if len(hist) < 4:
                    continue
                divisor = 1.0
                if "md" in unit.lower():
                    divisor = 1e9
                vals = [round(v / divisor, 2) for _, v in hist]
                last_val = vals[-1]
                prev_val = vals[-2] if len(vals) >= 2 else None
                yoy = None
                if prev_val and prev_val != 0:
                    yoy_pct = (last_val - prev_val) / abs(prev_val) * 100
                    yoy = f"{'+' if yoy_pct >= 0 else ''}{yoy_pct:.1f}%"
                new_kpi = {
                    "short": short,
                    "name_fr": name_fr,
                    "name_en": yf_key,
                    "value": last_val,
                    "unit": unit,
                    "yoy": yoy or "",
                    "history": vals,
                    "type": kpi_type,
                    "nature": nature,
                    "comparable": True,
                    "signal": f"{name_fr} de {last_val} {unit} dernière année",
                    "description": f"{name_fr} extrait yfinance.income_stmt sur les {len(vals)} dernières années.",
                    "is_generic": True,
                    "_source": "yfinance.income_stmt",
                }
                kpis.append(new_kpi)
                added_kpis += 1
                changed = True
                if len(kpis) >= 5:
                    break

        if changed:
            data["kpis"] = kpis
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception:
                fails += 1

        time.sleep(0.3)

    print(f"DONE: updated_hero={updated_hero} added_kpis={added_kpis} no_source={no_source} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
