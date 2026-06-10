#!/usr/bin/env python3
"""CF: quarterly net sales by nitrogen product (Ammonia/Granular Urea/UAN/AN) from the
'summary operating results by business segment' table, plus quarterly production volume
by product. CF FY = calendar year."""
import re
import sys
sys.path.insert(0, "/Users/yann/spx-app/scripts")
from _gatefix_extract import load_text, filings, num

PRODUCTS = ["Ammonia", "Granular Urea", "UAN", "AN"]


def q_iso(p, txt):
    """CF 10-Q 'Three months ended <Month> DD, YYYY' (calendar quarters)."""
    m = re.search(r"[Tt]hree months ended\s+([A-Z][a-z]+)\s+\d+,\s*(\d{4})", txt)
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


def seg_revenue(txt):
    """Quarterly net sales by product from the 'business segment' summary.
    Layout: 'Net sales $ <Ammonia> <Granular Urea> <UAN> <AN> <Other> <Consolidated>'.
    Returns dict in Mds $ (table is in $millions)."""
    out = {}
    # anchor on the segment summary table; numbers are '$'-separated:
    # 'Net sales $ A $ B $ C $ D $ E $ Total'
    a = txt.find("summary operating results by business segment")
    seg = txt[a: a + 600] if a >= 0 else txt
    m = re.search(
        r"Net sales\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)",
        seg)
    if m:
        for i, prod in enumerate(PRODUCTS):
            out[prod] = round(num(m.group(i + 1)) / 1e3, 4)  # $M -> Mds $
    return out


def prod_volume(txt):
    """Quarterly production volume by product (000s tons) from the MD&A operating table.
    'Production volume by product tons (000s): Ammonia (3) <3mo cur> <3mo prior> ...
     Granular urea <..> UAN (32%) (4) <..> AN <..>'. Returns dict in millions of tons."""
    out = {}
    m = re.search(
        r"Production volume by product tons \(000s\):\s*Ammonia\s*(?:\(\d\))?\s*([\d,]+)"
        r".*?Granular urea\s+([\d,]+)"
        r".*?UAN \(32%\)\s*(?:\(\d\))?\s*([\d,]+)"
        r".*?AN\s+([\d,]+)", txt)
    if m:
        out["Ammonia prod"] = round(num(m.group(1)) / 1e3, 4)   # 000s tons -> M tons
        out["Granular Urea prod"] = round(num(m.group(2)) / 1e3, 4)
        out["UAN prod"] = round(num(m.group(3)) / 1e3, 4)
        out["AN prod"] = round(num(m.group(4)) / 1e3, 4)
    return out


def extract():
    rev = {p: {} for p in PRODUCTS}
    vol = {f"{p} prod": {} for p in PRODUCTS}
    for p in filings("CF", "10Q"):
        txt = load_text(p)
        iso = q_iso(p, txt)
        for k, v in seg_revenue(txt).items():
            rev[k][iso] = v
        for k, v in prod_volume(txt).items():
            vol[k][iso] = v
    return rev, vol


if __name__ == "__main__":
    rev, vol = extract()
    print("=== Net sales by product (Mds $) ===")
    for k in rev:
        it = sorted(rev[k].items())
        print(f"{k} ({len(it)}q): {[v for _,v in it]} | last {it[-1] if it else '-'}")
    print("\n=== Production volume by product (M tons) ===")
    for k in vol:
        it = sorted(vol[k].items())
        print(f"{k} ({len(it)}q): {[v for _,v in it]} | last {it[-1] if it else '-'}")
