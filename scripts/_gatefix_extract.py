#!/usr/bin/env python3
"""
_gatefix_extract.py — helpers de parsing verbatim des filings SEC (10-K/10-Q US)
et rapports annuels EU (BESI.AS), pour re-extraire des KPIs SPECIFIQUES propres.

ZERO invention : on ne lit que des nombres presents verbatim dans le filing.
NULL si non trouve. Aucune extrapolation.

Usage: importe par les scripts de fix par-ticker.
"""
import gzip
import re
import os
import glob

SEC = "/Users/yann/Mettrik/sec-data"


def load_text(path):
    """Decompress + strip HTML to a single-space-normalized text blob."""
    if path.endswith(".gz"):
        with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as f:
            html = f.read()
    else:
        with open(path, encoding="utf-8", errors="ignore") as f:
            html = f.read()
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = txt.replace("&#160;", " ").replace("&nbsp;", " ").replace("&amp;", "&")
    txt = txt.replace("&#8217;", "'").replace("&#8212;", "-").replace("&#8211;", "-")
    txt = txt.replace("&#8220;", '"').replace("&#8221;", '"').replace("&#8226;", "*")
    txt = re.sub(r"[ \t\r\n]+", " ", txt)
    return txt


def filings(ticker, kind):
    """Return sorted list of filing paths for a ticker/kind (10K|10Q), oldest first."""
    pat = os.path.join(SEC, f"cat1-us/{kind}/*/{ticker}_*.htm.gz")
    return sorted(glob.glob(pat))


def num(s):
    """Parse a US-formatted number string (commas, parens=neg, $) to float, or None."""
    if s is None:
        return None
    s = s.strip().replace("$", "").replace(",", "").replace(" ", "")
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    if s in ("", "-", "—"):
        return None
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return None


def grab_after(txt, label, n=2):
    """Grab the first n numeric tokens immediately after `label`.
    Returns list of floats (length<=n). Numbers may carry $/commas/parens."""
    i = txt.find(label)
    if i < 0:
        return []
    seg = txt[i + len(label): i + len(label) + 220]
    toks = re.findall(r"\(?\$?\s*[\d][\d,]*(?:\.\d+)?\s*\)?|\(\s*[\d,]+\s*\)", seg)
    out = []
    for t in toks:
        v = num(t)
        if v is not None:
            out.append(v)
        if len(out) >= n:
            break
    return out


def period_end(txt):
    """Extract the 'THREE MONTHS ENDED <MONTH DAY>' period-end label from a 10-Q."""
    m = re.search(r"THREE MONTHS ENDED\s+([A-Z][A-Za-z]+ \d+)", txt)
    if m:
        return m.group(1)
    m = re.search(r"Three Months Ended\s+([A-Z][A-Za-z]+ \d+)", txt)
    return m.group(1) if m else None


if __name__ == "__main__":
    # self-test on NKE
    qs = filings("NKE", "10Q")
    print("NKE 10Q count:", len(qs))
    t = load_text(qs[-1])
    print("period:", period_end(t))
    print("Sales through NIKE Direct:", grab_after(t, "Sales through NIKE Direct", 4))
    print("North America:", grab_after(t, "North America", 4))
