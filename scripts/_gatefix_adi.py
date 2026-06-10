#!/usr/bin/env python3
"""ADI: quarterly revenue by end market (Industrial/Automotive/Communications/Consumer).
ADI 10-Q table: 'Industrial $ <3mo cur> <%> <Y/Y%> $ <3mo prior> ...'. (thousands -> Mds $)"""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num

MARKETS = ["Industrial", "Automotive", "Communications", "Consumer"]


def q_iso(p, txt):
    """ADI fiscal quarter end. Header 'Three Months Ended <Month> DD, YYYY'.
    ADI FY ends ~early Nov: Q1~Feb, Q2~May, Q3~Aug, Q4~Nov."""
    m = re.search(r"Three Months Ended\s+([A-Z][a-z]+)\s+\d+,\s*(\d{4})", txt)
    if m:
        mon, yr = m.group(1), int(m.group(2))
        mo = {"January": "01-31", "February": "02-01", "April": "04-30", "May": "05-03",
              "July": "07-31", "August": "08-02", "October": "10-31", "November": "11-02"}.get(mon)
        if mo:
            return f"{yr}-{mo}"
    fn = p.split("/")[-1].split("_")[1]
    y, mo, _ = fn.split("-")
    mo = int(mo)
    if mo in (2, 3):
        return f"{y}-02-01"
    if mo in (5, 6):
        return f"{y}-05-03"
    if mo in (8, 9):
        return f"{y}-08-02"
    return f"{y}-11-02"


def extract():
    series = {m: {} for m in MARKETS}
    for p in filings("ADI", "10Q"):
        txt = load_text(p)
        # anchor the end-market table: "Industrial $ <num> <pct>% <yy>% $ <prior>"
        m = re.search(r"Industrial\s+\$?\s*([\d,]{5,})\s+\d+\s*%", txt)
        if not m:
            continue
        iso = q_iso(p, txt)
        win = txt[m.start(): m.start() + 500]
        for mk in MARKETS:
            mm = re.search(mk + r"\s+\$?\s*([\d,]{5,})\s+\d+\s*%", win)
            if mm:
                series[mk][iso] = round(num(mm.group(1)) / 1e6, 4)
    return series


if __name__ == "__main__":
    s = extract()
    for k in s:
        it = sorted(s[k].items())
        print(f"{k} ({len(it)}q): {[v for _,v in it]}")
        print(f"   last: {it[-1] if it else '-'}")
