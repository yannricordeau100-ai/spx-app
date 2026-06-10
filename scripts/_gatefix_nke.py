#!/usr/bin/env python3
"""Extract NKE clean quarterly segment KPIs from 10-Q/10-K filings (verbatim)."""
import re
import json
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num, period_end

# Map fiscal period-end month/day -> calendar quarter ISO date.
# NIKE FY ends May 31. Q1 Aug31, Q2 Nov30, Q3 Feb28/29, Q4 May31.
MONTH = {"AUGUST": "08-31", "NOVEMBER": "11-30", "FEBRUARY": "02-28",
         "FEBRUARY 29": "02-29", "MAY": "05-31"}


def geo_3mo(txt):
    """Parse the segment-revenue table (3-month columns) for NA/EMEA/GC/APLA + NIKE Direct.
    The 10-Q revenue-by-segment table layout:
      North America $ <cur3m> <prior3m> %chg %chgcc $ <cur9m> <prior9m> ...
    Returns dict of cur-quarter values in $M."""
    out = {}
    # Anchor on the segment revenue table: "North America $ X Y ... EMEA ... Greater China ... APLA"
    # Find the table where North America is followed by a number then EMEA appears within ~400 chars.
    for m in re.finditer(r"North America\s+\$?\s*([\d,]+)\s+([\d,]+)", txt):
        seg = txt[m.start(): m.start() + 600]
        if "Europe, Middle East & Africa" in seg and "Greater China" in seg and "Asia Pacific" in seg:
            out["North America"] = num(m.group(1))
            me = re.search(r"Europe, Middle East & Africa\s+([\d,]+)\s+([\d,]+)", seg)
            gc = re.search(r"Greater China\s+([\d,]+)\s+([\d,]+)", seg)
            ap = re.search(r"Asia Pacific & Latin America\s+([\d,]+)\s+([\d,]+)", seg)
            if me:
                out["EMEA"] = num(me.group(1))
            if gc:
                out["Greater China"] = num(gc.group(1))
            if ap:
                out["APLA"] = num(ap.group(1))
            break
    # NIKE Direct 3-month
    nd = re.search(r"Sales through NIKE Direct\s+\$?\s*([\d,]+)\s+([\d,]+)", txt)
    if nd:
        out["NIKE Direct"] = num(nd.group(1))
    # Footwear 3-month
    fw = re.search(r"NIKE Brand Revenues by:\s*Footwear\s+\$?\s*([\d,]+)\s+([\d,]+)", txt)
    if fw:
        out["Footwear"] = num(fw.group(1))
    # Converse 3-month (in the by-product table: ... TOTAL NIKE BRAND REVENUES X Y .. Converse C P)
    cv = re.search(r"TOTAL NIKE BRAND REVENUES\s+[\d,]+\s+[\d,]+\s+[\d%\-\s]+?Converse\s+([\d,]+)\s+([\d,]+)", txt)
    if cv:
        out["Converse"] = num(cv.group(1))
    return out


def iso_for(period, fy_year):
    """period like 'FEBRUARY 28' -> need calendar year. NIKE FY label is year filing-based.
    We compute from filing context instead (handled by caller)."""
    return period


def main():
    qs = filings("NKE", "10Q")
    rows = []  # (iso_date, dict)
    for p in qs:
        txt = load_text(p)
        pe = period_end(txt)
        if not pe:
            continue
        d = geo_3mo(txt)
        # derive ISO date from period-end + filing year
        fn = p.split("/")[-1]  # NKE_2026-04-01.htm.gz
        fyear = int(fn.split("_")[1][:4])
        mon = pe.split()[0].upper()
        if mon == "AUGUST":
            iso = f"{fyear}-08-31"
        elif mon == "NOVEMBER":
            iso = f"{fyear}-11-30"
        elif mon == "FEBRUARY":
            day = pe.split()[1]
            iso = f"{fyear}-02-{day.zfill(2)}"
        else:
            iso = f"{fyear}-{pe}"
        rows.append((iso, d))
    # Q4 = FY(10-K) - 9M YTD. Parse 10-Ks for FY totals + the embedded 9M? 10-K has FY only.
    # We'll compute Q4 from 10-K FY total minus the sum of that fiscal year's Q1+Q2+Q3.
    # First print raw quarterly rows.
    print("=== NKE quarterly rows (oldest->newest) ===")
    for iso, d in rows:
        print(iso, {k: d.get(k) for k in ["North America", "EMEA", "Greater China", "APLA", "NIKE Direct", "Footwear", "Converse"]})
    return rows


if __name__ == "__main__":
    main()
