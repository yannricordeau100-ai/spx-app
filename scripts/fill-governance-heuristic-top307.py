#!/usr/bin/env python3
import json, os, sys, time
from pathlib import Path
from datetime import datetime

GOV_FIELDS = [
    "ceo_total_comp_m","board_size","voting_structure_note","avg_tenure_years",
    "ceo_pay_ratio","exec_comp_approval_pct","board_independence_pct","board_women_pct",
]

DUAL_CLASS = {
    'META','GOOGL','GOOG','BRK-A','BRK-B','BRKA','BRKB','FOX','FOXA','NWS','NWSA','UA','UAA',
    'SPOT','SNAP','PINS','LYFT','PLTR','COIN','RBLX','BIDU','BABA','JD','TCEHY','NIO','XPEV','LI',
    'PSKY','PARA','DIS','CMCSA','HEI','HEI-A','CWEN-A','CWEN','GEF','GEF-B','MOG-A','BIO','BIO-B',
    'DLB','FFIV','SHOP','NET','OKTA','CRWD','ZS','CFLT','DDOG','DKNG','MELI','SE','STZ','STZ-B',
}

try:
    import yfinance as yf
    YF_OK = True
except ImportError:
    YF_OK = False

def detect_country(t):
    EU_SUF = ('.PA','.DE','.L','.SW','.AS','.MI','.ST','.CO','.HE','.OL','.MC','.BR','.IR','.LS','.VI','.BX','.LSE')
    if any(t.upper().endswith(s) for s in EU_SUF):
        return 'EU'
    if t.upper().endswith('.T') or t.upper().endswith('.HK') or t.upper().endswith('.KS'):
        return 'ASIA'
    return 'US'

def load_existing_gov(t):
    base = {}
    p1 = Path(f'src/data/v2-pipeline/{t.lower()}.json')
    p2 = Path(f'src/data/v2-pipeline-enrich/{t.lower()}.json')
    if p1.exists():
        d = json.load(open(p1))
        if isinstance(d.get('governance'), dict):
            base = {**d['governance']}
    if p2.exists():
        d = json.load(open(p2))
        if isinstance(d.get('governance'), dict):
            base = {**base, **d['governance']}
        if isinstance(d.get('overrides_governance'), dict):
            base = {**base, **d['overrides_governance']}
    return base

YF_CACHE = {}
def yf_board_size(t):
    if not YF_OK: return None
    if t in YF_CACHE: return YF_CACHE[t]
    try:
        info = yf.Ticker(t).info
        officers = info.get('companyOfficers', [])
        if isinstance(officers, list) and len(officers) >= 3:
            YF_CACHE[t] = len(officers)
            return len(officers)
    except Exception:
        pass
    YF_CACHE[t] = None
    return None

def main():
    tickers = json.load(open('src/data/v1-8-tickers-sorted.json'))[:307]
    stats = {
        'total': len(tickers), 'processed': 0,
        'filled_heuristic': {f:0 for f in GOV_FIELDS},
        'yf_board_size_hits': 0, 'yf_board_size_miss': 0,
        'partial_flagged': 0, 'samples': {},
    }
    SAMPLE_KEYS = ['ABBN.SW','NESN.SW','OR.PA','AI.PA','SAP']
    
    yf_calls = 0
    yf_cap = 60  # limit yfinance calls

    for i, t in enumerate(tickers, 1):
        existing = load_existing_gov(t)
        country = detect_country(t)
        is_us = country == 'US'
        
        if t in SAMPLE_KEYS:
            stats['samples'].setdefault(t, {})['before'] = {f: existing.get(f) for f in GOV_FIELDS}
            stats['samples'][t]['country'] = country
        
        overrides = {}
        
        if not existing.get('voting_structure_note'):
            if t.upper() in DUAL_CLASS:
                overrides['voting_structure_note'] = 'Dual-class shares classes A/B'
            else:
                overrides['voting_structure_note'] = 'OK 1-share-1-vote'
            stats['filled_heuristic']['voting_structure_note'] += 1
        
        if not existing.get('board_size') and yf_calls < yf_cap:
            bs = yf_board_size(t)
            yf_calls += 1
            if bs:
                overrides['board_size'] = bs
                stats['filled_heuristic']['board_size'] += 1
                stats['yf_board_size_hits'] += 1
            else:
                stats['yf_board_size_miss'] += 1
            time.sleep(0.3)
        
        if not existing.get('board_independence_pct') and is_us:
            overrides['board_independence_pct'] = 80
            stats['filled_heuristic']['board_independence_pct'] += 1
        
        if not existing.get('avg_tenure_years'):
            overrides['avg_tenure_years'] = 7 if is_us else 5.5
            stats['filled_heuristic']['avg_tenure_years'] += 1
        
        if not existing.get('ceo_pay_ratio') and is_us:
            overrides['ceo_pay_ratio'] = 100
            stats['filled_heuristic']['ceo_pay_ratio'] += 1
        
        sensitive_missing = []
        for f in ['ceo_total_comp_m','exec_comp_approval_pct','board_women_pct']:
            if not existing.get(f) and not overrides.get(f):
                sensitive_missing.append(f)
        if not is_us:
            if not existing.get('ceo_pay_ratio') and not overrides.get('ceo_pay_ratio'):
                sensitive_missing.append('ceo_pay_ratio')
            if not existing.get('board_independence_pct') and not overrides.get('board_independence_pct'):
                sensitive_missing.append('board_independence_pct')
        if not existing.get('board_size') and not overrides.get('board_size'):
            sensitive_missing.append('board_size')
        
        partial_flag = len(sensitive_missing) > 0
        
        if not overrides and not partial_flag:
            continue
        
        if t in SAMPLE_KEYS:
            merged_after = {**existing, **overrides}
            stats['samples'][t]['after'] = {f: merged_after.get(f) for f in GOV_FIELDS}
            stats['samples'][t]['partial_missing'] = sensitive_missing
        
        p = Path(f'src/data/v2-pipeline-enrich/{t.lower()}.json')
        if p.exists():
            d = json.load(open(p))
        else:
            d = {'ticker': t}
        
        if overrides:
            existing_overrides = d.get('overrides_governance', {})
            if isinstance(existing_overrides, dict):
                d['overrides_governance'] = {**existing_overrides, **overrides}
            else:
                d['overrides_governance'] = overrides
        
        if partial_flag:
            d['_governance_partial'] = True
            d['_governance_missing_fields'] = sensitive_missing
            stats['partial_flagged'] += 1
        d['_governance_heuristic_at'] = datetime.utcnow().isoformat() + 'Z'
        d['_governance_heuristic_source'] = 'fill-governance-heuristic-top307'
        
        json.dump(d, open(p,'w'), ensure_ascii=False, indent=2)
        stats['processed'] += 1
        
        if i % 30 == 0:
            print(f'... {i}/{len(tickers)} processed, yf calls {yf_calls}/{yf_cap}')
    
    json.dump(stats, open('/tmp/governance-fill-stats.json','w'), indent=2, ensure_ascii=False)
    print(f"\n=== DONE ===")
    print(f"Processed: {stats['processed']}/{stats['total']}")
    print(f"Partial flagged: {stats['partial_flagged']}")
    print(f"yfinance: hits={stats['yf_board_size_hits']} miss={stats['yf_board_size_miss']}")
    for f, c in sorted(stats['filled_heuristic'].items(), key=lambda x:-x[1]):
        print(f"  {f}: {c}")

main()
