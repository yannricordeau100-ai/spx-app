#!/usr/bin/env python3
"""BESI.AS: extract from genuine annual reports (2020-2024; 2025.txt is cross-polluted
shipping report -> EXCLUDED). Builds:
  - Orders (order intake, EUR M) 5y from Key Highlights table.
  - Geographic revenue by country (China/US/Taiwan/Malaysia, EUR M) stitched across reports.
All verbatim from the genuine BESI filings. EUR.
"""
import re
import os

DIR = "/Users/yann/Mettrik/sec-data/cat3-european/BESI.AS/annual-text"
GENUINE = ["2020", "2021", "2022", "2023", "2024"]  # 2025.txt = contaminated (shipping)


def flat_of(year):
    p = os.path.join(DIR, f"{year}.txt")
    if not os.path.exists(p):
        return None
    t = open(p, encoding="utf-8", errors="ignore").read()
    return re.sub(r"[ \t]+", " ", t)


def n(s):
    s = s.replace(",", "").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return None


def orders_5y():
    """From the 2024 Key Highlights table: 'Orders 586.7 548.3 663.7 939.1 472.1'
    = FY2024 2023 2022 2021 2020 (EUR millions). Returns {year: value}."""
    f = flat_of("2024")
    m = re.search(r"\bOrders\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)", f)
    if not m:
        return {}
    years = [2024, 2023, 2022, 2021, 2020]
    return {years[i]: round(float(m.group(i + 1)), 3) for i in range(5)}


def revenue_5y():
    f = flat_of("2024")
    m = re.search(r"\bRevenue\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+Orders", f)
    if not m:
        return {}
    years = [2024, 2023, 2022, 2021, 2020]
    return {years[i]: round(float(m.group(i + 1)), 3) for i in range(5)}


COUNTRIES = ["China", "United States", "Taiwan", "Malaysia"]


def geo_revenue():
    """Geographic revenue disaggregation note: 'China <cur> <prior>' etc, EUR thousands.
    Each report gives current + prior year. Stitch across 2021-2024 reports.
    Returns {country: {year: EUR M}}."""
    out = {c: {} for c in COUNTRIES}
    for yr in ["2021", "2022", "2023", "2024"]:
        f = flat_of(yr)
        if not f:
            continue
        # anchor on the disaggregation note
        a = f.find("geographical distribution of the Company")
        if a < 0:
            a = f.find("disaggregates the geographical")
        if a < 0:
            continue
        win = f[a: a + 1500]
        cur_year = int(yr)         # report named <yr> covers fiscal <yr>
        prior_year = cur_year - 1
        for c in COUNTRIES:
            m = re.search(re.escape(c) + r"\s+([\d,]+)\s+([\d,]+)", win)
            if m:
                cv = n(m.group(1))
                pv = n(m.group(2))
                if cv is not None:
                    out[c].setdefault(cur_year, round(cv / 1000.0, 4))   # k EUR -> M EUR
                if pv is not None:
                    out[c].setdefault(prior_year, round(pv / 1000.0, 4))
    return out


if __name__ == "__main__":
    print("Orders 5y:", orders_5y())
    print("Revenue 5y:", revenue_5y())
    geo = geo_revenue()
    for c in geo:
        it = sorted(geo[c].items())
        print(f"GEO {c} ({len(it)}y): {it}")
