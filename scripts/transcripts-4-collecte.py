#!/usr/bin/env python3
"""Collecte des QUATRE dernieres conferences de resultats par societe
(mission docs/cahier/MISSION-TRANSCRIPTS-4.md, Yann 24 sept 2026).
Etats-Unis : MarketBeat ; autres : StockAnalysis. Ecrit `calls` (recent
d abord) dans src/data/transcripts/<t>.json sans toucher `latest`.
Journal : .conv-state/transcripts-4/collecte.jsonl. Reprise : les societes
deja completes (4 conferences) sont sautees."""
import importlib.util, json, os, re, sys, time, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def charge(nom):
    spec = importlib.util.spec_from_file_location(nom, f'{ROOT}/scripts/{nom}.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
MB = charge('marketbeat-transcripts'); SA = charge('stockanalysis-transcripts')
JOURNAL = f'{ROOT}/.conv-state/transcripts-4'; os.makedirs(JOURNAL, exist_ok=True)
N = 4
def journal(**k):
    k['at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    open(f'{JOURNAL}/collecte.jsonl', 'a').write(json.dumps(k, ensure_ascii=False) + '\n')
def est_us(t): return '.' not in t and not t.endswith(('-CO',))
def via_marketbeat(t):
    rapports, ex = MB.liste_rapports(t)
    today = datetime.date.today().isoformat(); calls = []
    for date_iso, url in rapports:
        if date_iso > today: continue
        code, body = MB.fetch(url); time.sleep(MB.PAUSE)
        if code != 200 or not body: continue
        ex_ = MB.extrait_transcript(body)
        if not ex_ or len(ex_['content']) < MB.MIN_LEN: continue
        calls.append({'quarter': ex_.get('quarter'), 'year': ex_.get('year'), 'date': date_iso, 'source_url': url, 'content': ex_['content']})
        if len(calls) >= N: break
    return calls, 'marketbeat'
def via_stockanalysis(t):
    liste, code = SA.liste_transcripts(t); calls = []
    for ident, slug, url in liste:
        code, body = SA.fetch(url); time.sleep(SA.PAUSE)
        if code != 200 or not body: continue
        ex_ = SA.extrait_transcript(body)
        if not ex_ or len(ex_.get('content', '')) < 3000: continue
        calls.append({'quarter': ex_.get('quarter'), 'year': ex_.get('year'), 'date': ex_.get('date'), 'source_url': url, 'content': ex_['content']})
        if len(calls) >= N: break
    return calls, 'stockanalysis'
def traite(t):
    p = f'{ROOT}/src/data/transcripts/{t.lower()}.json'
    doc = json.load(open(p)) if os.path.exists(p) else {'ticker': t}
    if len(doc.get('calls') or []) >= N: return 'deja complet'
    calls, source = (via_marketbeat(t) if est_us(t) else via_stockanalysis(t))
    if not calls and est_us(t): calls, source = via_stockanalysis(t)
    if not calls: journal(ticker=t, source=source, n=0, statut='aucune conference'); return 'aucune'
    calls.sort(key=lambda c: (c.get('date') or ''), reverse=True)
    doc['calls'] = calls; doc['_calls_source'] = source; doc['_calls_fetched_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    json.dump(doc, open(p, 'w'), ensure_ascii=False, indent=2)
    journal(ticker=t, source=source, n=len(calls), statut='ok', dates=[c.get('date') for c in calls]); return f'{len(calls)} conferences ({source})'
if __name__ == '__main__':
    univers = json.load(open(f'{ROOT}/src/data/v1-9-5-clean-all-tickers.json'))['tickers']
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; limite = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    cibles = args or univers[:limite]
    for t in cibles:
        try: r = traite(t)
        except Exception as e: r = f'erreur {e}'; journal(ticker=t, statut='erreur', detail=str(e)[:200])
        print(t, r, flush=True)
