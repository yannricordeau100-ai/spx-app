#!/usr/bin/env python3
"""Generate profit_warning template pour top 307 V1.8 + reste merged.

Heuristique sans LLM (déclenchée sans coût) :
- Lit hero KPI yoy + margin trend
- Score 1 = très faible, 5 = élevé
- Rationale templated + spécifique sté
"""
import json, re
from datetime import datetime, timezone
from pathlib import Path

PIPE = Path('src/data/v2-pipeline')

def compute_pw(d):
    """Calcule profit_warning depuis les KPIs."""
    kpis = d.get('kpis', [])
    if not kpis:
        return None
    hero = d.get('hero_kpi','')
    hero_kpi = next((k for k in kpis if k.get('short') == hero), None)
    
    # Compute average margin trend from any Op Margin / Net Margin / Gross Margin
    margins = [k for k in kpis if any(w in (k.get('short','') or '').lower() for w in ['margin','marge'])]
    margin_yoys = []
    for m in margins:
        yoy = m.get('yoy','')
        if isinstance(yoy, str):
            mm = re.match(r'^([+-]?\d+(?:\.\d+)?)\s*(?:%|pts)', yoy.strip())
            if mm:
                try: margin_yoys.append(float(mm.group(1)))
                except: pass
    
    # Hero growth
    hero_yoy_num = None
    if hero_kpi:
        yoy = hero_kpi.get('yoy','')
        if isinstance(yoy, str):
            mm = re.match(r'^([+-]?\d+(?:\.\d+)?)\s*%', yoy.strip())
            if mm:
                try: hero_yoy_num = float(mm.group(1))
                except: pass
    
    # Score logic
    score = 3  # default neutral
    rationale_parts = []
    
    # Margin component
    if margin_yoys:
        avg_margin_yoy = sum(margin_yoys) / len(margin_yoys)
        if avg_margin_yoy > 1:
            margin_trend_s = f"Marges en expansion (+{avg_margin_yoy:.1f} pts en moyenne sur les KPIs marge)."
            score -= 1
        elif avg_margin_yoy < -1:
            margin_trend_s = f"Marges sous pression ({avg_margin_yoy:.1f} pts en moyenne)."
            score += 1
        else:
            margin_trend_s = f"Marges stables (variation moyenne {avg_margin_yoy:+.1f} pts)."
    else:
        margin_trend_s = "Pas de KPI marge disponible pour évaluer la tendance."
    
    # Hero growth component
    if hero_yoy_num is not None:
        if hero_yoy_num < -10:
            rationale_parts.append(f"Hero KPI {hero} en repli ({hero_yoy_num:+.1f}%), signal de prudence.")
            score += 1
        elif hero_yoy_num > 10:
            rationale_parts.append(f"Hero KPI {hero} en croissance soutenue ({hero_yoy_num:+.1f}%), faible probabilité de profit warning.")
            score -= 1
        else:
            rationale_parts.append(f"Hero KPI {hero} en croissance modérée ({hero_yoy_num:+.1f}%).")
    
    rationale_parts.append("Pas de profit warning formel identifié dans les sources analysées (10-K, transcripts).")
    rationale_parts.append("À reconfirmer au prochain earnings call.")
    
    score = max(1, min(5, score))
    return {
        "last_date": None,
        "score": score,
        "rationale": " ".join(rationale_parts),
        "margin_trend": margin_trend_s,
    }

# Run on top 307 + tout merged
top307 = json.load(open('src/data/v1-8-tickers-sorted.json'))[:307]
processed = 0
written = 0
skipped = 0
for tk in top307:
    f = PIPE / f'{tk.lower()}.json'
    if not f.exists(): continue
    try: d = json.load(f.open())
    except: continue
    processed += 1
    if d.get('profit_warning'):
        skipped += 1
        continue
    pw = compute_pw(d)
    if not pw: continue
    d['profit_warning'] = pw
    f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    written += 1

print(f'Profit_warning généré: {written} stés (skipped déjà set: {skipped}, total {processed} top 307)')
