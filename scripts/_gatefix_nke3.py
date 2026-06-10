#!/usr/bin/env python3
"""NKE final: extract NIKE Direct + 4 geo segments quarterly across all 10-Qs.
Robust to both filing-table eras. Q4 = FY(10-K) - 9M YTD where derivable."""
import re
import json
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num, period_end


def iso_from(p, pe):
    fn = p.split("/")[-1]
    fyear = int(fn.split("_")[1][:4])
    parts = pe.split()
    mon = parts[0].upper()
    day = parts[1] if len(parts) > 1 else "30"
    if mon == "AUGUST":
        return f"{fyear}-08-31"
    if mon == "NOVEMBER":
        return f"{fyear}-11-30"
    if mon == "FEBRUARY":
        return f"{fyear}-02-{day.zfill(2)}"
    if mon == "MAY":
        return f"{fyear}-05-31"
    return f"{fyear}-{mon}-{day}"


def extract():
    # series[key][iso] = value Bn
    keys = ["NIKE Direct", "North America", "EMEA", "Greater China", "APLA"]
    series = {k: {} for k in keys}
    for p in filings("NKE", "10Q"):
        txt = load_text(p)
        pe = period_end(txt)
        if not pe:
            continue
        iso = iso_from(p, pe)
        # NIKE Direct 3-month
        nd = re.search(r"Sales through NIKE Direct\s+\$?\s*([\d,]+)", txt)
        if nd:
            v = num(nd.group(1))
            if v:
                series["NIKE Direct"][iso] = round(v / 1000.0, 3)
        # Geo REVENUES table: anchor North America followed by number, with EMEA/GC/APLA
        # nearby AND the block ending in 'TOTAL NIKE, INC. REVENUES' (disambiguates from
        # the INVENTORIES and EBIT tables which also list the same geo rows).
        for m in re.finditer(r"North America\s+\$?\s*([\d,]+)", txt):
            seg = txt[m.start(): m.start() + 700]
            segU = seg.upper()
            if ("EUROPE, MIDDLE EAST & AFRICA" in segU and "GREATER CHINA" in segU
                    and "ASIA PACIFIC & LATIN AMERICA" in segU
                    and "TOTAL NIKE, INC. REVENUES" in segU):
                na = num(m.group(1))
                me = re.search(r"Europe, Middle East & Africa\s+([\d,]+)", seg)
                gc = re.search(r"Greater China\s+([\d,]+)", seg)
                ap = re.search(r"Asia Pacific & Latin America\s+([\d,]+)", seg)
                if na:
                    series["North America"][iso] = round(na / 1000.0, 3)
                if me:
                    series["EMEA"][iso] = round(num(me.group(1)) / 1000.0, 3)
                if gc:
                    series["Greater China"][iso] = round(num(gc.group(1)) / 1000.0, 3)
                if ap:
                    series["APLA"][iso] = round(num(ap.group(1)) / 1000.0, 3)
                break
    return series


if __name__ == "__main__":
    s = extract()
    for k in s:
        items = sorted(s[k].items())
        print(f"{k} ({len(items)}q): {[v for _,v in items]}")
        print(f"   dates: {[d for d,_ in items]}")
