#!/usr/bin/env python3
"""NFLX: extract quarterly regional revenue (UCAN/EMEA/LATAM/APAC) from 10-Q (+Q4 from 10-K)."""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num


def q_iso(year, q):
    return {1: f"{year}-03-31", 2: f"{year}-06-30", 3: f"{year}-09-30", 4: f"{year}-12-31"}[q]


def regional_from_10q(txt):
    """3-month regional revenue (current quarter) in $thousands -> Mds $."""
    out = {}
    ucan = re.search(r"United States and Canada \(UCAN\)\s+\$?\s*([\d,]+)", txt)
    emea = re.search(r"Europe, Middle East, and Africa \(EMEA\)\s+([\d,]+)", txt)
    latam = re.search(r"Latin America \(LATAM\)\s+([\d,]+)", txt)
    apac = re.search(r"Asia-Pacific \(APAC\)\s+([\d,]+)", txt)
    if ucan:
        out["UCAN"] = round(num(ucan.group(1)) / 1e6, 4)
    if emea:
        out["EMEA"] = round(num(emea.group(1)) / 1e6, 4)
    if latam:
        out["LATAM"] = round(num(latam.group(1)) / 1e6, 4)
    if apac:
        out["APAC"] = round(num(apac.group(1)) / 1e6, 4)
    return out


def filing_quarter(p, txt):
    """Determine (year, quarter) for a NFLX 10-Q from its 'Three Months Ended MONTH DD, YYYY' header."""
    m = re.search(r"Three Months Ended\s+([A-Z][a-z]+ \d+,\s*\d{4})", txt)
    if not m:
        # fallback from filename date
        fn = p.split("/")[-1].split("_")[1]  # 2025-04-18
        y, mo, _ = fn.split("-")
        mo = int(mo)
        # filing month -> reported quarter (filed ~1 month after quarter end)
        if mo in (4, 5):
            return int(y), 1
        if mo in (7, 8):
            return int(y), 2
        if mo in (10, 11):
            return int(y), 3
        return int(y), 4
    d = m.group(1)
    mon = d.split()[0]
    year = int(d.split(",")[-1].strip())
    qmap = {"March": 1, "June": 2, "September": 3, "December": 4}
    return year, qmap.get(mon, 1)


def extract():
    keys = ["UCAN", "EMEA", "LATAM", "APAC"]
    series = {k: {} for k in keys}
    for p in filings("NFLX", "10Q"):
        txt = load_text(p)
        reg = regional_from_10q(txt)
        if not reg:
            continue
        y, q = filing_quarter(p, txt)
        iso = q_iso(y, q)
        for k, v in reg.items():
            series[k][iso] = v
    # Q4 = FY (10-K) - (Q1+Q2+Q3). 10-K regional table = FULL YEAR.
    for p in filings("NFLX", "10K"):
        txt = load_text(p)
        # 10-K regional table: "United States and Canada (UCAN) $ <FY> <FYprior> <FYprior2>"
        m = re.search(r"United States and Canada \(UCAN\)\s+\$?\s*([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
        em = re.search(r"Europe, Middle East, and Africa \(EMEA\)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
        la = re.search(r"Latin America \(LATAM\)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
        ap = re.search(r"Asia-Pacific \(APAC\)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
        fn = p.split("/")[-1].split("_")[1]
        fyear = int(fn[:4]) - 1  # 10-K filed Jan 2026 covers FY2025
        def fyval(m, off):
            return round(num(m.group(off + 1)) / 1e6, 4) if m else None
        for key, m in [("UCAN", m), ("EMEA", em), ("LATAM", la), ("APAC", ap)]:
            if not m:
                continue
            for off in range(3):
                yr = fyear - off
                fy = fyval(m, off)
                q4iso = q_iso(yr, 4)
                if fy is None or q4iso in series[key]:
                    continue
                q1 = series[key].get(q_iso(yr, 1))
                q2 = series[key].get(q_iso(yr, 2))
                q3 = series[key].get(q_iso(yr, 3))
                if None not in (q1, q2, q3):
                    series[key][q4iso] = round(fy - q1 - q2 - q3, 4)
    return series


if __name__ == "__main__":
    s = extract()
    for k in s:
        items = sorted(s[k].items())
        print(f"{k} ({len(items)}q): {[v for _,v in items]}")
        print(f"   last date: {items[-1][0] if items else '-'}")
