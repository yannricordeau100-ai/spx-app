#!/usr/bin/env python3
"""
Date stories short-history for SP500. Zero invention.
Output: {stes_touched, stories_dated_via_source_file, stories_dated_via_source_type, stories_dated_via_last_data, stories_null}
"""
import os, json, re, sys

ROOT = '/Users/yann/spx-app'
SP500 = json.load(open(f'{ROOT}/src/data/sp500-tickers.json'))

MOIS_FR = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']
MOIS_FR_ACC = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

DATE_RE = re.compile(r'(\d{4})-(\d{2})-(\d{2})')
ACCESSION_RE = re.compile(r'\d{10}-\d{2}-\d{6}')

def fr_month(iso_date):
    m = DATE_RE.search(iso_date)
    if not m: return None
    y, mo, _ = m.groups()
    idx = int(mo) - 1
    if idx < 0 or idx > 11: return None
    return f'{MOIS_FR_ACC[idx]} {y}'

def find_lake_dir(ticker):
    for v in (ticker, ticker.upper(), ticker.replace('.','-'), ticker.replace('.','-').upper()):
        p = f'{ROOT}/data-lake/{v}'
        if os.path.isdir(p): return p
    return None

def list_folder_files(lake_dir, subfolder):
    p = f'{lake_dir}/{subfolder}'
    if not os.path.isdir(p): return []
    out = []
    for f in os.listdir(p):
        m = DATE_RE.search(f)
        if m:
            out.append((m.group(0), f))
    out.sort(key=lambda x: x[0])
    return out

def most_recent_before(files, deadline_iso):
    # files: list of (iso, name), sorted asc
    if not files: return None
    if not deadline_iso:
        return files[-1][0]
    # find last file with iso <= deadline
    picked = None
    for iso, _ in files:
        if iso <= deadline_iso:
            picked = iso
        else:
            break
    return picked or files[0][0]

def find_by_accession(lake_dir, accession):
    for sub in ('10K','10Q','8K'):
        p = f'{lake_dir}/{sub}'
        if not os.path.isdir(p): continue
        for f in os.listdir(p):
            if accession in f:
                m = DATE_RE.search(f)
                if m: return m.group(0)
    return None

def source_type_folders(src_str):
    """Return list of data-lake subfolders to search based on _source string."""
    s = (src_str or '').lower()
    folders = []
    # SEC filing types (priority)
    if '10-k' in s: folders.append('10K')
    if '10-q' in s: folders.append('10Q')
    if '8-k' in s: folders.append('8K')
    # Earnings
    if 'stories-calls' in s or 'calls-5y' in s or ' ec' in f' {s}' or s.strip() == 'ec' or s.endswith(' ec') or 'earnings call' in s:
        folders.append('ES')
    if s.strip() == 'er' or 'earnings release' in s or ' er' in f' {s}':
        folders.append('ER')
    if 'stories-filings' in s:
        # generic filings, prefer 10K then 10Q then 8K
        for x in ('10K','10Q','8K'):
            if x not in folders: folders.append(x)
    return folders

def process_ticker(ticker):
    pipe_path = f'{ROOT}/src/data/v2-pipeline/{ticker.lower()}.json'
    if not os.path.exists(pipe_path):
        pipe_path = f'{ROOT}/src/data/v2-pipeline/{ticker.lower().replace(".","-")}.json'
    if not os.path.exists(pipe_path):
        return None
    with open(pipe_path) as f:
        data = json.load(f)
    lake_dir = find_lake_dir(ticker)
    changed = False
    stats = {'via_source_file': 0, 'via_source_type': 0, 'via_last_data': 0, 'null': 0}
    for arr_name in ('kpis', 'stories_kpis'):
        arr = data.get(arr_name)
        if not isinstance(arr, list): continue
        for kk in arr:
            if not kk.get('is_short_history'): continue
            if kk.get('_source_month'): continue
            src = kk.get('_source') or ''
            src_file = kk.get('_source_file') or ''
            last_dt = kk.get('last_data_date') or ''
            month = None
            reason_type = None
            # (b) _source_file pointing data-lake
            if isinstance(src_file, str) and 'data-lake/' in src_file:
                m = DATE_RE.search(src_file)
                if m:
                    month = fr_month(m.group(0))
                    reason_type = 'via_source_file'
            # (c) _source type match
            if month is None and lake_dir:
                # Try SEC accession first
                acc = ACCESSION_RE.search(str(src))
                if acc:
                    iso = find_by_accession(lake_dir, acc.group(0))
                    if iso:
                        month = fr_month(iso)
                        reason_type = 'via_source_type'
                if month is None:
                    folders = source_type_folders(src)
                    picked_iso = None
                    for sub in folders:
                        files = list_folder_files(lake_dir, sub)
                        if not files: continue
                        cand = most_recent_before(files, last_dt if last_dt else None)
                        if cand:
                            if picked_iso is None or cand > picked_iso:
                                picked_iso = cand
                    if picked_iso:
                        month = fr_month(picked_iso)
                        reason_type = 'via_source_type'
            # (d) last_data_date fallback
            if month is None and last_dt:
                month = fr_month(last_dt)
                if month:
                    reason_type = 'via_last_data'
            if month:
                kk['_source_month'] = month
                stats[reason_type] += 1
                changed = True
            else:
                kk['_source_month'] = None
                kk['_source_month_reason'] = 'Aucune source identifiable dans data-lake'
                stats['null'] += 1
                changed = True
    if changed:
        with open(pipe_path, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return stats

def main():
    totals = {'stes_touched': 0,
              'stories_dated_via_source_file': 0,
              'stories_dated_via_source_type': 0,
              'stories_dated_via_last_data': 0,
              'stories_null': 0}
    for t in SP500:
        r = process_ticker(t)
        if r is None: continue
        touched = r['via_source_file'] + r['via_source_type'] + r['via_last_data'] + r['null']
        if touched > 0:
            totals['stes_touched'] += 1
        totals['stories_dated_via_source_file'] += r['via_source_file']
        totals['stories_dated_via_source_type'] += r['via_source_type']
        totals['stories_dated_via_last_data'] += r['via_last_data']
        totals['stories_null'] += r['null']
    print(json.dumps(totals))

if __name__ == '__main__':
    main()
