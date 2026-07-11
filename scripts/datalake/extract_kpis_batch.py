#!/usr/bin/env python3
"""
extract_kpis_batch.py — Extrait les KPIs pour les tickers rouge de kpi_normaux.
Lit /tmp/kpi_rouge_tickers.json, pour chaque ticker sans data-lake/<T>/kpis/extracted.json :
  - yfinance income_stmt → revenue annuel → period_type='year' → kpi_normaux vert
Résumé-safe, séquentiel, sleep entre calls (règle Mac).
"""
import json, os, time, pathlib, sys

ROUGE_FILE = '/tmp/kpi_rouge_tickers.json'
DATALAKE = pathlib.Path('/Users/yann/spx-app/data-lake')

KPI_DEFS = [
    {"short": "revenue",          "name_fr": "Chiffre d'affaires",  "keywords": ["total revenue", "revenue"]},
    {"short": "gross_profit",     "name_fr": "Marge brute",          "keywords": ["gross profit"]},
    {"short": "operating_income", "name_fr": "Résultat opérationnel","keywords": ["operating income", "ebit"]},
    {"short": "net_income",       "name_fr": "Résultat net",         "keywords": ["net income"]},
]

def find_row(stmt, keywords):
    for kw in keywords:
        parts = kw.split()
        for idx in stmt.index:
            s = str(idx).lower()
            if all(p in s for p in parts):
                return stmt.loc[idx]
    return None

def row_to_history(row):
    history = []
    for col in row.index:
        try:
            v = float(row[col])
            if v != v:
                continue
            history.append({"period_end": str(col)[:10], "value": round(v / 1_000_000, 2)})
        except (TypeError, ValueError):
            continue
    history.sort(key=lambda x: x['period_end'])
    return history

def yfinance_kpis(ticker):
    """Retourne dict {short: history} pour tous les KPIs disponibles."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        stmt = t.income_stmt
        if stmt is None or stmt.empty:
            return {}
        result = {}
        for kdef in KPI_DEFS:
            row = find_row(stmt, kdef["keywords"])
            if row is not None:
                h = row_to_history(row)
                if h:
                    result[kdef["short"]] = h
        return result
    except Exception:
        return {}

def write_extracted(ticker, kpis_data):
    out_dir = DATALAKE / ticker / 'kpis'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / 'extracted.json'
    kpi_list = []
    for kdef in KPI_DEFS:
        if kdef["short"] in kpis_data:
            kpi_list.append({
                "short": kdef["short"],
                "name_fr": kdef["name_fr"],
                "unit": "M USD",
                "period_type": "year",
                "history": kpis_data[kdef["short"]]
            })
    data = {"ticker": ticker, "kpis": kpi_list}
    with open(out_file, 'w') as f:
        json.dump(data, f, indent=2)
    return out_file

def main():
    with open(ROUGE_FILE) as f:
        tickers = json.load(f)

    print(f"{len(tickers)} tickers rouge à traiter")
    done = 0
    skipped = 0
    failed = []

    for i, ticker in enumerate(tickers):
        out_file = DATALAKE / ticker / 'kpis' / 'extracted.json'
        if out_file.exists():
            skipped += 1
            continue

        kpis_data = yfinance_kpis(ticker)
        if kpis_data:
            write_extracted(ticker, kpis_data)
            done += 1
            kpi_names = list(kpis_data.keys())
            print(f"[{i+1}/{len(tickers)}] {ticker}: {len(kpis_data)} KPIs {kpi_names} → OK")
        else:
            failed.append(ticker)
            print(f"[{i+1}/{len(tickers)}] {ticker}: pas de données yfinance")

        # Sleep pour ne pas saturer (règle Mac)
        time.sleep(1.5)

        # Toutes les 20, afficher un bilan
        if (i + 1) % 20 == 0:
            print(f"  --- Bilan: {done} écrits, {skipped} déjà présents, {len(failed)} fails ---")

    print(f"\nTerminé: {done} nouveaux, {skipped} déjà présents, {len(failed)} fails")
    if failed:
        print(f"Fails: {failed[:20]}")

if __name__ == '__main__':
    main()
