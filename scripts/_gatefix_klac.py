#!/usr/bin/env python3
"""KLAC: quarterly revenue-by-product (Wafer Inspection / Patterning / Specialty /
PCB & Component Inspection / Services) from 10-Q revenue table. (in thousands -> Mds $)"""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num, period_end

# KLAC FY ends June 30. Q1 Sep30, Q2 Dec31, Q3 Mar31, Q4 Jun30.
PRODUCTS = [
    ("Wafer Inspection", r"Wafer Inspection"),
    ("Patterning", r"Patterning"),
    ("Specialty Semiconductor Process", r"Specialty Semiconductor Process"),
    ("PCB & Component Inspection", r"PCB and Component Inspection"),
    ("Services", r"Services"),
]


def q_from(p, txt):
    """KLAC 10-Q header 'Three Months Ended <Month> DD, YYYY' or from filename."""
    m = re.search(r"Three Months Ended\s+([A-Z][a-z]+)\s+\d+,\s*(\d{4})", txt)
    if m:
        mon, yr = m.group(1), int(m.group(2))
        iso = {"September": f"{yr}-09-30", "December": f"{yr}-12-31",
               "March": f"{yr}-03-31", "June": f"{yr}-06-30"}.get(mon)
        if iso:
            return iso
    fn = p.split("/")[-1].split("_")[1]
    y, mo, _ = fn.split("-")
    mo = int(mo)
    # KLAC files Q1~Oct/Nov, Q2~Jan/Feb, Q3~Apr/May
    if mo in (10, 11):
        return f"{y}-09-30"
    if mo in (1, 2):
        return f"{int(y)-1}-12-31"
    if mo in (4, 5):
        return f"{y}-03-31"
    return f"{y}-06-30"


def extract():
    series = {name: {} for name, _ in PRODUCTS}
    for p in filings("KLAC", "10Q"):
        txt = load_text(p)
        # anchor: the 3-month revenue-by-product table starts at "Revenues: Wafer Inspection $ <3mo>"
        m = re.search(r"Revenues:\s*Wafer Inspection\s+\$?\s*([\d,]+)", txt)
        if not m:
            continue
        iso = q_from(p, txt)
        # window of the table
        win = txt[m.start(): m.start() + 700]
        for name, pat in PRODUCTS:
            # grab first number after product label inside the table window
            mm = re.search(pat + r"\s+\$?\s*([\d,]{4,})", win)
            if mm:
                series[name][iso] = round(num(mm.group(1)) / 1e6, 4)
    return series


if __name__ == "__main__":
    s = extract()
    for k in s:
        it = sorted(s[k].items())
        print(f"{k} ({len(it)}q): {[v for _,v in it]}")
        print(f"   last: {it[-1] if it else '-'}")
