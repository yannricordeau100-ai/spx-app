#!/usr/bin/env python3
"""NFLX: robust extraction across both 10-Q era formats.
Old era (<=2025-Q1): per-region blocks with Revenues + 'Paid memberships at end of period'.
New era (>=2025-Q2): consolidated regional revenue table, no membership metrics.
Builds: regional revenue (Mds $) quarterly, paid memberships per region (M),
and total paid memberships (M, sum of regions) where available."""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num

REGIONS = [
    ("UCAN", r"United States and Canada \(UCAN\)"),
    ("EMEA", r"Europe, Middle East, and Africa \(EMEA\)"),
    ("LATAM", r"Latin America \(LATAM\)"),
    ("APAC", r"Asia-Pacific \(APAC\)"),
]


def q_iso(year, q):
    return {1: f"{year}-03-31", 2: f"{year}-06-30", 3: f"{year}-09-30", 4: f"{year}-12-31"}[q]


def filing_quarter(p, txt):
    m = re.search(r"Three Months Ended\s+([A-Z][a-z]+ \d+,\s*\d{4})", txt)
    qmap = {"March": 1, "June": 2, "September": 3, "December": 4}
    if m:
        d = m.group(1)
        return int(d.split(",")[-1].strip()), qmap.get(d.split()[0], 1)
    fn = p.split("/")[-1].split("_")[1]
    y, mo, _ = fn.split("-")
    mo = int(mo)
    return int(y), (1 if mo in (4, 5) else 2 if mo in (7, 8) else 3 if mo in (10, 11) else 4)


def extract():
    rev = {k: {} for k, _ in REGIONS}
    memb = {k: {} for k, _ in REGIONS}  # paid memberships end of period (M)
    for p in filings("NFLX", "10Q"):
        txt = load_text(p)
        y, q = filing_quarter(p, txt)
        iso = q_iso(y, q)
        # ERA detection: OLD era has per-region blocks "(UCAN) As of/ Three Months Ended";
        # NEW era has a single consolidated table ending "Total Revenues $".
        old_era = "(UCAN) As of" in txt
        if old_era:
            # per-region blocks: <Region (CODE)> ... Revenues $ <3mo cur> ...
            for code, pat in REGIONS:
                m = re.search(pat + r"\s+As of.*?Revenues\s+\$?\s*([\d,]+)", txt)
                if m:
                    rev[code][iso] = round(num(m.group(1)) / 1e6, 4)
                mb = re.search(pat + r"\s+As of.*?Paid memberships at end of period\s*(?:\(\d\))?\s*([\d,]+)", txt)
                if mb:
                    memb[code][iso] = round(num(mb.group(1)) / 1e3, 4)  # thousands -> M
        else:
            # consolidated table: <Region (CODE)> $? <3mo cur> ... grab FIRST number after code.
            for code, pat in REGIONS:
                mm = re.search(pat + r"\s*\$?\s*([\d,]{4,})", txt)
                if mm:
                    rev[code][iso] = round(num(mm.group(1)) / 1e6, 4)
    # 10-K: per-region full-year revenue (for Q4 derivation) + Q4 end-of-period memberships.
    for p in filings("NFLX", "10K"):
        txt = load_text(p)
        fn = p.split("/")[-1].split("_")[1]
        fyear = int(fn[:4]) - 1
        for code, pat in REGIONS:
            # full-year streaming revenues: "<Region> As of/Year Ended ... revenues $ FY FY-1 FY-2"
            mrev = re.search(pat + r"\s+As of/Year Ended.*?[Rr]evenues\s+\$?\s*([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
            # Q4 paid memberships end of period (3 fiscal years)
            mmemb = re.search(pat + r"\s+As of/Year Ended.*?Paid memberships at end of period\s*(?:\(\d\))?\s*([\d,]+)\s+([\d,]+)\s+([\d,]+)", txt)
            # NOTE: Q4 revenue derivation (FY - 9M) is unreliable across NFLX format eras
            # (gaps in extracted quarters). We keep only directly-extracted quarterly
            # revenue points. Memberships Q4 come straight from the 10-K end-of-period.
            if mmemb:
                for off in range(3):
                    yr = fyear - off
                    q4iso = q_iso(yr, 4)
                    if q4iso not in memb[code]:
                        memb[code][q4iso] = round(num(mmemb.group(off + 1)) / 1e3, 4)
    # total paid memberships = sum across regions for quarters where ALL 4 present
    total_memb = {}
    isos = set()
    for code, _ in REGIONS:
        isos |= set(memb[code].keys())
    for iso in isos:
        vals = [memb[code].get(iso) for code, _ in REGIONS]
        if None not in vals:
            total_memb[iso] = round(sum(vals), 3)
    return rev, memb, total_memb


if __name__ == "__main__":
    rev, memb, total = extract()
    for k in rev:
        it = sorted(rev[k].items())
        print(f"REV {k} ({len(it)}q): {[v for _,v in it]} | last {it[-1][0] if it else '-'}")
    print()
    it = sorted(total.items())
    print(f"TOTAL Paid Memberships ({len(it)}q): {[v for _,v in it]}")
    print(f"   dates: {[d for d,_ in it]}")
    print()
    it = sorted(memb['UCAN'].items())
    print(f"UCAN Paid Memberships ({len(it)}q): {[v for _,v in it]}")
