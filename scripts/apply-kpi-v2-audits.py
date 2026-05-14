#!/usr/bin/env python3
"""Apply kpi-v2 audits aux v2-pipeline JSON.

Logic :
1. Pour chaque kpi-extract-<TICKER>.json :
   - verified_existing : si correction_needed=true, applique true_value au KPI existing
   - new_kpis : ajoute au tableau kpis[] (skip si short déjà présent)
   - hero_kpi_should_be : renomme hero + KPI short

Priorité true_value fields :
   - true_value (simple) > true_value_FY26_annual > true_value_FY25_annual >
     true_value_run_rate > true_value_Q2_FY26 > true_value_Q1_FY26 > etc.

Backup avant changements : <ticker>.pre-kpi-v2.json (rollback safety).
"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDITS = ROOT / "src/data/v2-pipeline-kpi-v2"
PIPE = ROOT / "src/data/v2-pipeline"

def best_true_value(d):
    """Find the best true_value field from priority list."""
    priorities = [
        'true_value', 'true_value_FY26_annual', 'true_value_run_rate',
        'true_value_FY26_run_rate', 'true_value_FY25_annual',
        'true_value_H1_FY26', 'true_value_Q2_FY26', 'true_value_Q1_FY26',
    ]
    for key in priorities:
        v = d.get(key)
        if v is not None and isinstance(v, (int, float)):
            return v, key
    # Also try true_history_quarterly etc.
    return None, None

def apply_audit(ticker, audit_data, pipe_data):
    """Returns (updated_pipe_data, log_msgs)."""
    logs = []
    
    # 1. Apply verified_existing corrections
    for v in audit_data.get('verified_existing', []):
        if not isinstance(v, dict): continue
        if not v.get('correction_needed'): continue
        short = v.get('short')
        if not short: continue
        new_val, src_field = best_true_value(v)
        if new_val is None:
            logs.append(f'  ⚪ {short}: correction_needed but no true_value')
            continue
        # Find KPI in pipe
        kpis = pipe_data.get('kpis', [])
        target_kpi = next((k for k in kpis if k.get('short') == short), None)
        if not target_kpi:
            logs.append(f'  ⚠ {short}: KPI not found in pipe')
            continue
        old_val = target_kpi.get('value')
        target_kpi['value'] = new_val
        target_kpi['_corrected_from'] = old_val
        target_kpi['_correction_source'] = f'kpi-v2 audit ({src_field})'
        # Update history if quarterly fournie
        hist = v.get('true_history_quarterly_FY24_to_FY26') or v.get('true_history') or v.get('history')
        if hist and isinstance(hist, list):
            target_kpi['history'] = hist
        logs.append(f'  ✅ {short}: {old_val} → {new_val} ({src_field})')
    
    # 2. Rename hero_kpi if specified
    hero_should = audit_data.get('hero_kpi_should_be')
    if hero_should and isinstance(hero_should, str):
        current_hero = pipe_data.get('hero_kpi')
        if current_hero != hero_should:
            # Check if hero_should already exists in kpis
            kpis = pipe_data.get('kpis', [])
            hero_kpi_obj = next((k for k in kpis if k.get('short') == hero_should), None)
            if not hero_kpi_obj:
                # Rename the current hero KPI's short
                cur_kpi = next((k for k in kpis if k.get('short') == current_hero), None)
                if cur_kpi:
                    cur_kpi['short'] = hero_should
                    logs.append(f'  🏷 hero renamed: "{current_hero}" → "{hero_should}"')
            pipe_data['hero_kpi'] = hero_should
            logs.append(f'  🎯 hero_kpi: → {hero_should}')
    
    # 3. Add new_kpis (skip duplicates)
    new_kpis_added = 0
    existing_shorts = {k.get('short','').lower() for k in pipe_data.get('kpis',[]) if k.get('short')}
    for nk in audit_data.get('new_kpis', []):
        if not isinstance(nk, dict): continue
        if not nk.get('short'): continue
        if nk['short'].lower() in existing_shorts: continue
        # Validate has value
        if not isinstance(nk.get('value'), (int, float)): continue
        # Adapt format : check required fields
        kpi_entry = {
            'short': nk['short'],
            'name_fr': nk.get('name_fr', nk['short']),
            'name_en': nk.get('name_en', nk['short']),
            'explanation': nk.get('explanation', nk.get('comment','')[:100] if nk.get('comment') else ''),
            'value': nk['value'],
            'unit': nk.get('unit', ''),
            'yoy': nk.get('yoy', ''),
            'type': nk.get('type', 'Revenue'),
            'nature': nk.get('nature', 'Conjoncturel'),
            'comparable': nk.get('comparable', 'Comparable'),
            'signal': nk.get('signal', ''),
            'description': nk.get('description', nk.get('comment','')),
        }
        # History if provided
        hist = nk.get('history') or nk.get('history_quarterly_Q1_FY25_to_Q2_FY26') or nk.get('history_quarterly')
        if hist and isinstance(hist, list):
            kpi_entry['history'] = hist
        if nk.get('PV'): kpi_entry['_PV_score'] = nk['PV']
        pipe_data['kpis'].append(kpi_entry)
        existing_shorts.add(nk['short'].lower())
        new_kpis_added += 1
    if new_kpis_added > 0:
        logs.append(f'  ➕ new_kpis: +{new_kpis_added}')
    
    # 4. Audit trail
    pipe_data['_kpi_v2_audit_applied_at'] = datetime.now(timezone.utc).isoformat()
    if audit_data.get('notes'):
        pipe_data['_kpi_v2_audit_notes'] = audit_data['notes'][:500]
    
    return pipe_data, logs

def main():
    audits_files = list(AUDITS.glob('kpi-extract-*.json'))
    print(f'Total kpi-v2 audits: {len(audits_files)}')
    
    applied = 0
    skipped_no_change = 0
    failed = 0
    total_corrections = 0
    total_new_kpis = 0
    
    for af in audits_files:
        ticker = af.stem.replace('kpi-extract-','')
        # Normalize : some files have BRK_B, dots, etc.
        ticker = ticker.replace('_','.')  # tentative
        pipe_f = PIPE / f'{ticker.lower()}.json'
        if not pipe_f.exists():
            # Try without normalize
            ticker2 = af.stem.replace('kpi-extract-','')
            pipe_f = PIPE / f'{ticker2.lower()}.json'
            if not pipe_f.exists():
                failed += 1
                continue
        
        try:
            audit = json.loads(af.read_text())
            pipe = json.loads(pipe_f.read_text())
        except Exception as e:
            failed += 1
            continue
        
        # Count corrections
        corrections = sum(1 for v in audit.get('verified_existing',[]) if isinstance(v,dict) and v.get('correction_needed'))
        new_kpis = len(audit.get('new_kpis',[]))
        if corrections == 0 and new_kpis == 0 and not audit.get('hero_kpi_should_be'):
            skipped_no_change += 1
            continue
        
        try:
            updated_pipe, logs = apply_audit(ticker, audit, pipe)
            pipe_f.write_text(json.dumps(updated_pipe, indent=2, ensure_ascii=False))
            applied += 1
            total_corrections += corrections
            total_new_kpis += new_kpis
            if applied <= 10 or applied % 20 == 0:
                print(f'{ticker}:')
                for log in logs[:5]: print(log)
        except Exception as e:
            failed += 1
            print(f'  ❌ {ticker}: {type(e).__name__} {e}')
    
    print(f'\n=== SUMMARY ===')
    print(f'Audits applied: {applied}')
    print(f'Skipped (no changes): {skipped_no_change}')
    print(f'Failed: {failed}')
    print(f'Total corrections : {total_corrections}')
    print(f'Total new KPIs added: {total_new_kpis}')

if __name__ == '__main__':
    main()
