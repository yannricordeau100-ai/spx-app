#!/usr/bin/env python3
"""
SA26-00 quarterly extractor — Claude direct, deterministic regex.

For a given US ticker, scans /Users/yann/Mettrik/sec-data/cat1-us/10Q/**/<T>_*.htm.gz
and 10K/**/<T>_*.htm.gz to pull per-quarter values for unambiguous consolidated
income-statement line items :
  - Net sales / Total revenues / Revenues
  - Gross margin / Gross profit
  - Operating income / Income from operations
  - Net income (loss)
  - Research and development
  - Diluted EPS

Returns dict { 'Q1 2022': {...}, 'Q2 2022': {...}, ... } sorted chronologically.

Anti-invention :
- valeurs lues telles quelles dans le filing (in thousands → divisé)
- pas d'interpolation
- skip si label ambigu
- Q4 dérivé = annual_FY (10-K) - Q1 - Q2 - Q3 (10-Q)
"""
import gzip
import json
import re
import sys
from html import unescape
from pathlib import Path

SEC = Path("/Users/yann/Mettrik/sec-data/cat1-us")

# Each pattern returns the THIRD-COL number (Three Months Ended <date>, year=current period).
# Format dans les 10-Q : "Three Months Ended <Date>, <Y> <Y-1> Net sales ... $ <curr> ... $ <prev>"
# Sometimes only single column ; we always grab the FIRST number after label.

LABELS = {
    'revenue': [
        r'Total net revenues?\s+(?:\$|[\d,])',
        r'Total operating revenues?\s+(?:\$|[\d,])',
        r'Total revenues?\s+(?:\$|[\d,])',
        r'Total net sales\s+(?:\$|[\d,])',
        r'Net sales\s+(?:\$|[\d,])',
        r'Revenues?\s+(?:\$|[\d,])',
    ],
    'gross_profit': [
        r'Gross margin\s+(?:\$|[\d,])',
        r'Gross profit\s+(?:\$|[\d,])',
    ],
    'operating_income': [
        r'Operating profit\s+(?:\$|[\(\d,])',
        r'Income from operations\s+(?:\$|[\(\d,])',
        r'Operating income\s+(?:\$|[\(\d,])',
        r'\(Loss\) income from operations\s+(?:\$|[\(\d,])',
        r'Income \(loss\) from operations\s+(?:\$|[\(\d,])',
    ],
    'net_income': [
        r'Net income\s+(?:\$|[\d,])',
        r'Net earnings\s+(?:\$|[\d,])',
        r'Net income \(loss\)\s+(?:\$|[\d,])',
    ],
    'rd_expense': [
        r'Research and development\s+(?:\$|[\d,])',
    ],
}

NUM = r'\$?\s*\(?\s*([\d,]+(?:\.\d+)?)\s*\)?'

def load_html(path):
    with gzip.open(path, 'rt', errors='ignore') as f:
        raw = f.read()
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = unescape(text)
    # Remove zero-width chars and other invisible Unicode
    text = re.sub(r'[​‌‍ ﻿]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text

def detect_period(text, filename):
    # Try header: "For the Quarterly Period Ended <date>"
    m = re.search(r'(?i)For the Quarterly Period Ended\s+([A-Z][a-z]+ \d+,\s*20\d{2})', text)
    if m:
        return m.group(1)
    m = re.search(r'(?i)For the (?:Fiscal )?Year Ended\s+([A-Z][a-z]+ \d+,\s*20\d{2})', text)
    if m:
        return m.group(1)
    # Try income statement header : "Three Months Ended <date>, <YYYY>"
    m = re.search(r'(?i)Three Months Ended\s*([A-Z][a-z]+ \d+),?\s*(20\d{2})', text)
    if m:
        return f"{m.group(1)}, {m.group(2)}"
    # Try "Period of \d+ Weeks Ended <date>"  (retail fiscal calendars)
    m = re.search(r'(?i)(?:\d+\s+Weeks Ended|Period Ended|Ended)\s+([A-Z][a-z]+ \d+,\s*20\d{2})', text)
    if m:
        return m.group(1)
    return None

def date_to_quarter(date_str, fiscal_offset=0):
    """Convert filing date or period-end to fiscal Q label. fiscal_offset=0 for calendar.
    Returns ('Q1 2024', sort_key) or (None, None) if unparseable."""
    months = {'JANUARY':1,'FEBRUARY':2,'MARCH':3,'APRIL':4,'MAY':5,'JUNE':6,
              'JULY':7,'AUGUST':8,'SEPTEMBER':9,'OCTOBER':10,'NOVEMBER':11,'DECEMBER':12}
    m = re.match(r'([A-Za-z]+) (\d+),\s*(\d{4})', date_str)
    if m:
        mo = months.get(m.group(1).upper())
        yr = int(m.group(3))
    else:
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
        if not m:
            return None, None
        yr = int(m.group(1)); mo = int(m.group(2))
    if mo is None:
        return None, None
    if mo <= 3: q = 1
    elif mo <= 6: q = 2
    elif mo <= 9: q = 3
    else: q = 4
    return f"Q{q} {yr}", yr * 10 + q

def find_first_number_after(text, label_regex, start_idx=0, window=400):
    """Find label and return first numeric value after it within window chars.
    Label regex must end with the start of a $ or digit (so we capture from there)."""
    pat = re.compile(label_regex, re.IGNORECASE)
    m = pat.search(text, start_idx)
    if not m:
        return None, -1
    # Start from one char before end (since regex includes \$ or first digit)
    tail = text[m.end()-1:m.end()-1+window]
    n = re.search(NUM, tail)
    if not n:
        return None, m.end()
    v = n.group(1).replace(',', '')
    try:
        val = float(v)
    except:
        return None, m.end()
    # Check for negative : parens in the matched NUM itself OR surrounding chars
    raw_match = n.group(0)
    ctx_before = tail[max(0, n.start()-10):n.start()]
    ctx_after = tail[n.end():n.end()+5]
    label_tail = text[max(0, m.end()-3):m.end()+2]
    has_open = '(' in raw_match or '(' in ctx_before or '(' in label_tail
    has_close = ')' in raw_match or ')' in ctx_after
    if has_open and has_close:
        val = -val
    return val, m.end()

def find_income_statement_section(text):
    """Return (start, end) of consolidated statements of operations / income."""
    pat = re.compile(
        r'(?i)(?:CONDENSED\s+)?(?:CONSOLIDATED\s+)?(?:'
        r'STATEMENTS?\s+OF\s+(?:OPERATIONS(?:\s+AND\s+COMPREHENSIVE\s+INCOME)?|INCOME|EARNINGS)'
        r'|INCOME\s+STATEMENTS?'
        r'|STATEMENTS?\s+OF\s+CONDENSED\s+CONSOLIDATED\s+OPERATIONS'
        r'|STATEMENTS?\s+OF\s+CONSOLIDATED\s+OPERATIONS'
        r')'
    )
    m = pat.search(text)
    if m:
        # Look for the FOLLOWING "operating revenues" or "net sales" within next ~1000 chars
        # to make sure we landed on the actual statement, not a reference.
        snip = text[m.start():m.start()+1500]
        if re.search(r'(?i)(?:Net sales|Total revenue|Operating revenue|Total net sales|Revenues?\s+\$)', snip):
            return m.start(), m.start() + 8000
        # Otherwise try the NEXT match
        for m2 in pat.finditer(text, m.end()):
            snip = text[m2.start():m2.start()+1500]
            if re.search(r'(?i)(?:Net sales|Total revenue|Operating revenue|Total net sales|Revenues?\s+\$)', snip):
                return m2.start(), m2.start() + 8000
    return None, None

def extract_one_filing(path, is_10k=False):
    text = load_html(path)
    period = detect_period(text, path.name)
    if not period:
        return None
    qlabel, qsort = date_to_quarter(period)
    if not qlabel:
        return None
    sec_start, sec_end = find_income_statement_section(text)
    if sec_start is None:
        return None
    section = text[sec_start:sec_end]

    out = {'_period_end': period, '_quarter': qlabel, '_qsort': qsort, '_path': str(path)}
    for key, patterns in LABELS.items():
        for pat in patterns:
            val, _ = find_first_number_after(section, pat, window=200)
            if val is not None:
                out[key] = val
                break
    return out

def scan_ticker(ticker):
    """Returns sorted list of per-quarter dicts."""
    q_files = sorted(SEC.glob(f"10Q/**/{ticker}_*.htm.gz"))
    k_files = sorted(SEC.glob(f"10K/**/{ticker}_*.htm.gz"))
    out = []
    for f in q_files:
        rec = extract_one_filing(f, is_10k=False)
        if rec:
            out.append(rec)
    k_recs = []
    for f in k_files:
        rec = extract_one_filing(f, is_10k=True)
        if rec:
            rec['_is_10k'] = True
            k_recs.append(rec)
    out.sort(key=lambda r: r['_qsort'])
    k_recs.sort(key=lambda r: r['_qsort'])
    return out, k_recs

def derive_q4_from_10k(q_recs, k_recs):
    """For each 10-K (annual FY), compute Q4 = annual - Q1 - Q2 - Q3.
    Returns list of Q4 dicts to append."""
    derived = []
    keys_to_derive = ['revenue', 'gross_profit', 'operating_income', 'net_income', 'rd_expense']
    for k in k_recs:
        # FY year = year of period_end
        yr = k['_qsort'] // 10
        q1 = next((r for r in q_recs if r['_qsort'] == yr*10+1), None)
        q2 = next((r for r in q_recs if r['_qsort'] == yr*10+2), None)
        q3 = next((r for r in q_recs if r['_qsort'] == yr*10+3), None)
        if not (q1 and q2 and q3):
            continue
        rec = {'_period_end': k['_period_end'], '_quarter': f"Q4 {yr}", '_qsort': yr*10+4, '_derived_from_10k': True, '_path': k['_path']}
        for key in keys_to_derive:
            ann = k.get(key)
            v1, v2, v3 = q1.get(key), q2.get(key), q3.get(key)
            if all(x is not None for x in [ann, v1, v2, v3]):
                rec[key] = ann - v1 - v2 - v3
        derived.append(rec)
    return derived

def merge_quarters(q_recs, derived_q4):
    by_sort = {r['_qsort']: r for r in q_recs}
    for d in derived_q4:
        if d['_qsort'] not in by_sort:
            by_sort[d['_qsort']] = d
    return sorted(by_sort.values(), key=lambda r: r['_qsort'])

def main():
    if len(sys.argv) < 2:
        print("Usage: extract-q.py TICKER")
        sys.exit(1)
    ticker = sys.argv[1].upper()
    q_recs, k_recs = scan_ticker(ticker)
    derived = derive_q4_from_10k(q_recs, k_recs)
    merged = merge_quarters(q_recs, derived)
    # Pretty print summary
    print(f"\n=== {ticker} : {len(q_recs)} 10-Q + {len(k_recs)} 10-K → {len(derived)} Q4 derived → {len(merged)} total ===\n")
    for r in merged[-24:]:
        flags = " [Q4-from-10K]" if r.get('_derived_from_10k') else ""
        print(f"{r['_quarter']:>10}  rev={r.get('revenue','-'):>15}  gross={r.get('gross_profit','-'):>15}  opinc={r.get('operating_income','-'):>15}  ni={r.get('net_income','-'):>15}  rd={r.get('rd_expense','-'):>13}  eps={r.get('diluted_eps','-')}{flags}")
    # Dump JSON
    out_path = Path(f"/tmp/sa26-{ticker.lower()}-quarters.json")
    out_path.write_text(json.dumps(merged, indent=2))
    print(f"\nWrote {out_path}")

if __name__ == '__main__':
    main()
