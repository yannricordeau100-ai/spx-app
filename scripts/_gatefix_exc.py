#!/usr/bin/env python3
"""EXC: quarterly total operating revenues per regulated utility segment
(ComEd / PECO / BGE / PHI). From the segment reporting note. ($M -> Mds $)
EXC FY = calendar year. PHI = Pepco Holdings (Pepco + DPL + ACE)."""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num

SEGS = ["ComEd", "PECO", "BGE", "PHI"]


def q_iso(p, txt):
    m = re.search(r"Three Months Ended\s+([A-Z][a-z]+)\s+\d+,\s*(\d{4})", txt)
    if m:
        mon, yr = m.group(1), int(m.group(2))
        iso = {"March": f"{yr}-03-31", "June": f"{yr}-06-30",
               "September": f"{yr}-09-30", "December": f"{yr}-12-31"}.get(mon)
        if iso:
            return iso
    fn = p.split("/")[-1].split("_")[1]
    y, mo, _ = fn.split("-")
    mo = int(mo)
    if mo in (4, 5):
        return f"{y}-03-31"
    if mo in (7, 8):
        return f"{y}-06-30"
    if mo in (10, 11):
        return f"{y}-09-30"
    return f"{y}-12-31"


def seg_rev(txt):
    """Total operating revenues per segment (first/current period in the note)."""
    out = {}
    a = txt.find("ComEd PECO BGE PHI Other")
    if a < 0:
        return out
    win = txt[a: a + 900]
    # 'Total operating revenues $ ComEd $ PECO $ BGE $ PHI $ Other $ (elim) $ Exelon'
    m = re.search(
        r"Total operating revenues\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)",
        win)
    if m:
        for i, s in enumerate(SEGS):
            out[s] = round(num(m.group(i + 1)) / 1e3, 4)
    return out


def seg_rev_10k(txt):
    """10-K annual table -> per-segment FULL-YEAR total operating revenues for the
    3 fiscal years shown. Returns {seg: {year: Mds$}}."""
    out = {s: {} for s in SEGS}
    a = txt.find("ComEd PECO BGE PHI Other")
    while a >= 0:
        win = txt[a: a + 1500]
        if "Total operating revenues" in win:
            # capture up to 3 yearly 'Total operating revenues $ a $ b $ c $ d ...' blocks,
            # each preceded by a 4-digit year.
            for ym in re.finditer(r"(20\d{2})\b[^$]{0,40}?Electric revenues.*?Total operating revenues\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)", win):
                yr = int(ym.group(1))
                for i, s in enumerate(SEGS):
                    out[s][yr] = round(num(ym.group(i + 2)) / 1e3, 4)
            break
        a = txt.find("ComEd PECO BGE PHI Other", a + 1)
    return out


# Constellation spinoff completed Feb 2022 -> only post-spinoff data is a consistent
# pure-regulated-utility series. We keep quarters from 2022-Q1 onward.
SPINOFF_CUTOFF = "2022-01-01"


def extract():
    series = {s: {} for s in SEGS}
    fy = {s: {} for s in SEGS}
    for p in filings("EXC", "10Q"):
        txt = load_text(p)
        iso = q_iso(p, txt)
        if iso < SPINOFF_CUTOFF:
            continue
        for k, v in seg_rev(txt).items():
            series[k][iso] = v
    # full-year per segment (latest 10-Ks) for Q4 derivation
    for p in filings("EXC", "10K"):
        txt = load_text(p)
        for k, yd in seg_rev_10k(txt).items():
            for yr, v in yd.items():
                if yr >= 2022:
                    fy[k].setdefault(yr, v)
    # Q4 = FY - (Q1+Q2+Q3)
    for s in SEGS:
        for yr, fyv in fy[s].items():
            q4 = f"{yr}-12-31"
            if q4 in series[s]:
                continue
            q1 = series[s].get(f"{yr}-03-31")
            q2 = series[s].get(f"{yr}-06-30")
            q3 = series[s].get(f"{yr}-09-30")
            if None not in (q1, q2, q3):
                series[s][q4] = round(fyv - q1 - q2 - q3, 4)
    return series


if __name__ == "__main__":
    s = extract()
    for k in s:
        it = sorted(s[k].items())
        print(f"{k} ({len(it)}q): {[v for _,v in it]} | last {it[-1] if it else '-'}")
