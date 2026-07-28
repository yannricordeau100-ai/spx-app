#!/usr/bin/env python3
"""Recale value/yoy sur le dernier point de l'history et purge les points annuels
des series trimestrielles. Passe de correction globale post-chaine KPI v3."""
import json, glob, os, re, sys

APPLY = '--apply' in sys.argv

# labels trimestriels acceptes : Q1-2026, Q1-FY2026, T1-2026, 2026Q1, Q12026
QUARTER = re.compile(r'^(Q|T)\s*([1-4])\s*-?\s*(FY)?(\d{4})$|^(\d{4})Q([1-4])$', re.I)
# labels annuels : FY2025, FY-2025, 2025, CY2025
ANNUAL = re.compile(r'^(FY|CY)-?\d{4}e?$|^\d{4}$', re.I)


def qkey(q):
    """(annee, trimestre) pour un label trimestriel, sinon None."""
    m = QUARTER.match(str(q).strip())
    if not m:
        return None
    if m.group(2):
        return (int(m.group(4)), int(m.group(2)))
    return (int(m.group(5)), int(m.group(6)))


def fmt_yoy(cur, prev):
    if prev in (None, 0) or cur is None:
        return None
    pct = (cur - prev) / abs(prev) * 100
    return f"{pct:+.1f}%".replace('.0%', '%')


purged = realigned = yoy_fixed = 0
touched_files = set()

for path in sorted(glob.glob('.batches-drafts-safe/kpis-haut/*.json')):
    ticker = os.path.basename(path)[:-5]
    try:
        doc = json.load(open(path))
    except Exception:
        continue
    dirty = False

    for kpi in doc.get('kpis', []):
        hist = kpi.get('history') or []
        if not hist:
            continue
        freq = (kpi.get('frequency') or '').lower()

        # 1) purge des points annuels dans une serie trimestrielle
        if freq == 'quarterly':
            keep = [p for p in hist if not ANNUAL.match(str(p.get('q', '')).strip())]
            # on ne purge que si la serie reste exploitable (>= 4 points trimestriels)
            if len(keep) >= 4 and len(keep) != len(hist):
                kpi['_v3_purged_annual'] = [p['q'] for p in hist if p not in keep]
                hist = keep
                kpi['history'] = hist
                purged += len(kpi['_v3_purged_annual'])
                dirty = True

        last = hist[-1].get('v')
        if not isinstance(last, (int, float)):
            continue

        # 2) value = dernier point
        val = kpi.get('value')
        if isinstance(val, (int, float)) and last != 0 and abs(val - last) / abs(last) > 0.005:
            kpi['_v3_value_was'] = val
            kpi['value'] = last
            realigned += 1
            dirty = True

            # 3) yoy recalcule sur le meme trimestre N-1
            k = qkey(hist[-1].get('q'))
            if k:
                prev_key = (k[0] - 1, k[1])
                prev = next((p['v'] for p in hist if qkey(p.get('q')) == prev_key), None)
                new_yoy = fmt_yoy(last, prev)
                if new_yoy and new_yoy != kpi.get('yoy'):
                    kpi['_v3_yoy_was'] = kpi.get('yoy')
                    kpi['yoy'] = new_yoy
                    yoy_fixed += 1

    if dirty:
        touched_files.add(ticker)
        if APPLY:
            json.dump(doc, open(path, 'w'), ensure_ascii=False, indent=1)

print(f"{'APPLIQUE' if APPLY else 'SIMULATION'}: "
      f"{realigned} value recalees, {yoy_fixed} yoy recalcules, "
      f"{purged} points annuels purges, sur {len(touched_files)} stes")
