#!/usr/bin/env python3
"""
cleanup-events-timeline.py — Trie + cap les events timeline pour TOUTES stés.

Règles :
1. Sort events par date desc (plus récents en haut)
2. Cap à top 6 events
3. Si > 3 events <12 mois disponibles, drop tous les events > 18 mois (bruit)
4. Sinon garde tels quels (sté avec peu d'actu récente)

Écrit dans src/data/v2-pipeline-enrich/<t>.events.json si modifié.
Préserve src/data/v2-pipeline/<t>.json (CONV-DATA scope strict).
"""
import json, os, glob
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
PIPE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

now = datetime.now(timezone.utc)
ONE_YEAR = now - timedelta(days=365)
EIGHTEEN_MONTHS = now - timedelta(days=540)


def parse_date(s):
    if not isinstance(s, str): return None
    try:
        if 'T' in s:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        return datetime.fromisoformat(s + 'T00:00:00+00:00')
    except: return None


def get_events(ticker):
    """Returns merged events from pipe + enrich (enrich override if present)."""
    pipe_p = PIPE / f"{ticker}.json"
    enr_p = ENRICH / f"{ticker}.json"
    if not pipe_p.exists(): return []
    d = json.load(pipe_p.open())
    e = json.load(enr_p.open()) if enr_p.exists() else {}
    # Enrich override priority
    if isinstance(e.get('events'), list) and e['events']:
        return e['events']
    return d.get('events') or []


def main():
    total = 0
    cleaned = 0
    no_change = 0
    no_events_count = 0
    for f in glob.glob(str(ENRICH / "*.json")):
        # Skip side-files (.tam.json, .ranks.json, .events.json, etc.)
        name = os.path.basename(f)
        if name.count('.') > 1: continue
        total += 1
        ticker = name.replace('.json', '')
        events = get_events(ticker)
        if not events:
            no_events_count += 1
            continue
        # Parse dates
        dated = []
        for ev in events:
            if not isinstance(ev, dict): continue
            d_parsed = parse_date(ev.get('date') or ev.get('iso_date'))
            dated.append((d_parsed or datetime(1970, 1, 1, tzinfo=timezone.utc), ev))
        # Sort by date desc
        dated.sort(key=lambda x: x[0], reverse=True)
        # Count events <12mo
        recent_count = sum(1 for d, _ in dated if d >= ONE_YEAR)
        # If >3 recent, drop >18mo
        if recent_count >= 3:
            filtered = [(d, ev) for d, ev in dated if d >= EIGHTEEN_MONTHS]
        else:
            filtered = dated
        # Cap at 6
        capped = filtered[:6]
        new_events = [ev for _, ev in capped]
        # Compare with original
        if new_events != events:
            # Write enrich override
            enr_p = ENRICH / f"{ticker}.json"
            if enr_p.exists():
                e = json.load(enr_p.open())
            else:
                e = {'ticker': ticker.upper()}
            e['events'] = new_events
            e['_events_cleaned_at'] = now.isoformat()
            enr_p.write_text(json.dumps(e, ensure_ascii=False, indent=2))
            cleaned += 1
        else:
            no_change += 1
    print(f'Total stés processed: {total}')
    print(f'Events cleaned (sort + cap + filter old): {cleaned}')
    print(f'No change needed: {no_change}')
    print(f'No events at all: {no_events_count}')


if __name__ == "__main__":
    main()
