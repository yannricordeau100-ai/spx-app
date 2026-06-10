#!/usr/bin/env python3
"""NKE: build clean KPI set. Hero=NIKE Direct quarterly (>=16q). Plus annual segment KPIs (5y)."""
import re
import json
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num, period_end


def nike_direct_quarterly():
    """Return chronologically-sorted list of (iso, value_Bn) for NIKE Direct 3-month."""
    rows = {}
    for p in filings("NKE", "10Q"):
        txt = load_text(p)
        pe = period_end(txt)
        if not pe:
            continue
        nd = re.search(r"Sales through NIKE Direct\s+\$?\s*([\d,]+)\s+([\d,]+)", txt)
        if not nd:
            continue
        v = num(nd.group(1))
        fn = p.split("/")[-1]
        fyear = int(fn.split("_")[1][:4])
        mon = pe.split()[0].upper()
        day = pe.split()[1] if len(pe.split()) > 1 else "30"
        if mon == "AUGUST":
            iso = f"{fyear}-08-31"
        elif mon == "NOVEMBER":
            iso = f"{fyear}-11-30"
        elif mon == "FEBRUARY":
            iso = f"{fyear}-02-{day.zfill(2)}"
        elif mon == "MAY":
            iso = f"{fyear}-05-31"
        else:
            iso = f"{fyear}-{mon}-{day}"
        if v is not None:
            rows[iso] = round(v / 1000.0, 3)  # $M -> Mds $
    # sort by iso
    items = sorted(rows.items())
    return items


def annual_segments():
    """From the latest 10-K, get FY-by-FY series (most recent 3y per 10-K) for:
    Footwear, Apparel, Converse, NIKE Direct annual, Greater China annual.
    We stitch 10-Ks to get >=5 fiscal years where possible."""
    # Each 10-K REVENUES table: 'Footwear $ FY(t) FY(t-1) ... FY(t-2)' with %chg cols interleaved.
    out = {"Footwear": {}, "Apparel": {}, "Converse": {}, "NIKE Direct": {}, "Greater China": {}}
    for p in filings("NKE", "10K"):
        txt = load_text(p)
        fn = p.split("/")[-1]
        fyear = int(fn.split("_")[1][:4])  # filing year ~ fiscal year (May 31)
        # Footwear: '$ A B -x% -y% C' => FY fyear, fyear-1, fyear-2
        fw = re.search(r"NIKE Brand Revenues by:\s*Footwear\s+\$?\s*([\d,]+)\s+([\d,]+)\s+[-\d%\s]+?([\d,]+)", txt)
        ap = re.search(r"Footwear\s+\$?\s*[\d,]+\s+[\d,]+\s+[-\d%\s]+?[\d,]+\s+[-\d%\s]+?Apparel\s+([\d,]+)\s+([\d,]+)\s+[-\d%\s]+?([\d,]+)", txt)
        cv = re.search(r"Converse\s+([\d,]+)\s+([\d,]+)\s+[-\d%\s]+?([\d,]+)", txt)
        nd = re.search(r"Sales through NIKE Direct\s+([\d,]+)\s+([\d,]+)\s+[-\d%\s]+?([\d,]+)", txt)
        gc = re.search(r"Greater China\s+\$?\s*([\d,]+)\s+([\d,]+)\s+[-\d%\s]+?([\d,]+)", txt)
        def put(key, m):
            if not m:
                return
            for off, g in enumerate(m.groups()):
                v = num(g)
                if v is not None:
                    out[key][fyear - off] = round(v / 1000.0, 3)
        put("Footwear", fw)
        put("Apparel", ap)
        put("Converse", cv)
        put("NIKE Direct", nd)
        put("Greater China", gc)
    return out


if __name__ == "__main__":
    q = nike_direct_quarterly()
    print("NIKE Direct quarterly (%d pts):" % len(q))
    for iso, v in q:
        print(" ", iso, v)
    print()
    ann = annual_segments()
    for k, d in ann.items():
        ys = sorted(d.items())
        print(k, "(%dy):" % len(ys), ys)
