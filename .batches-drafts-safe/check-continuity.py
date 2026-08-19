import json
import re
from pathlib import Path

kpis_dir = Path('/Users/yann/spx-app/.batches-drafts-safe/kpis-haut')

def parse_q(q):
    m = re.match(r'Q(\d)-(?:FY)?(\d{4})', q)
    if m:
        return ('Q', int(m.group(2)), int(m.group(1)))
    m = re.match(r'FY(\d{4})', q)
    if m:
        return ('FY', int(m.group(1)), 0)
    return None

def find_gaps(history, freq):
    parsed = sorted(set(filter(None, (parse_q(h['q']) for h in history))), key=lambda x: (x[1], x[2]))
    if len(parsed) < 2:
        return []
    gaps = []
    if freq == 'quarterly':
        qs = [(y, qn) for (_, y, qn) in parsed if qn != 0]
        fy_years = set(y for (kind, y, _) in parsed if kind == 'FY')
        # Treat a standalone FY-YYYY entry as satisfying Q4-YYYY when no explicit Q4 exists that year
        q4_years = set(y for (y, qn) in qs if qn == 4)
        for y in fy_years:
            if y not in q4_years:
                qs.append((y, 4))
        qs = sorted(set(qs))
        if len(qs) < 2:
            return []
        for i in range(1, len(qs)):
            y0, q0 = qs[i-1]
            y1, q1 = qs[i]
            expected_y, expected_q = (y0, q0 + 1) if q0 < 4 else (y0 + 1, 1)
            if (y1, q1) != (expected_y, expected_q):
                gaps.append(f"trou entre Q{q0}-{y0} et Q{q1}-{y1}")
    else:
        ys = sorted(set(y for (_, y, _) in parsed))
        for i in range(1, len(ys)):
            if ys[i] != ys[i-1] + 1:
                gaps.append(f"trou entre FY{ys[i-1]} et FY{ys[i]}")
    return gaps

report = []
for f in sorted(kpis_dir.glob('*.json')):
    ticker = f.stem
    try:
        data = json.load(open(f))
    except Exception as e:
        report.append((ticker, 'ERREUR LECTURE', str(e)))
        continue
    for kpi in data.get('kpis', []):
        hist = kpi.get('history', [])
        freq = kpi.get('frequency')
        if not freq:
            report.append((ticker, kpi.get('short'), 'frequency MANQUANT'))
            continue
        if not isinstance(hist, list) or any(not isinstance(h, dict) or 'q' not in h for h in hist):
            report.append((ticker, kpi.get('short'), f'history MALFORME: {hist!r}'))
            continue
        if len(hist) < 2:
            continue
        gaps = find_gaps(hist, freq)
        for g in gaps:
            report.append((ticker, kpi.get('short'), g))

print(f"Total anomalies continuite : {len(report)}")
tickers_touched = sorted(set(r[0] for r in report))
print(f"Tickers touches : {len(tickers_touched)}")
for t in tickers_touched:
    issues = [r for r in report if r[0] == t]
    print(f"\n{t}:")
    for _, kpi, issue in issues[:10]:
        print(f"  {kpi}: {issue}")
