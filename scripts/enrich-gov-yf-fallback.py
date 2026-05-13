#!/usr/bin/env python3
"""
enrich-gov-yf-fallback.py — gouvernance minimale via yfinance pour les stés
où l'extraction LLM filing échoue (ceo=None, source insuffisante).

Pour chaque sté avec governance vide OU `_governance_extraction_rejected` :
- Lit yfinance.companyOfficers
- Construit governance = {ceo_name, ceo_title, officers (top 5), fiscal_year}
- Pas de top_capital / top_voting (yfinance n'a pas) → laissé null
- Pas de ceo_total_comp_m (yfinance dataset payant) → null

Source : yfinance Yahoo Finance API
Couverture estimée : ~110/126 KO governance

Usage : python3 scripts/enrich-gov-yf-fallback.py
"""
import json, time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
CACHE_YF = Path("/tmp/yf-ceo-cache.json")
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-gov-yf.log"
LOG.parent.mkdir(parents=True, exist_ok=True)


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def main():
    # Lire pending : stés top 307 sans governance OU avec rejet pollution
    audit = json.load(open('/tmp/audit-top307-missing.json'))
    gov_ko = audit['governance']
    log_line(f"START gov-yf-fallback : {len(gov_ko)} stés gov KO")

    # Use cache si dispo, sinon fetch
    cache = {}
    if CACHE_YF.exists():
        cache = json.loads(CACHE_YF.read_text())
        log_line(f"Cache loaded : {len(cache)} stés")

    written = 0
    skipped = 0
    no_data = 0
    for tk in gov_ko:
        pipe_f = PIPELINE / f'{tk.lower()}.json'
        if not pipe_f.exists():
            skipped += 1
            continue
        d = json.loads(pipe_f.read_text())

        # Skip si gov-safe a deja écrit (validated par yfinance match)
        if d.get('_governance_yfinance_validated') is True:
            skipped += 1
            continue

        # Use cache or fetch
        info = cache.get(tk)
        if not info:
            try:
                t = yf.Ticker(tk)
                yfinfo = t.info or {}
                officers = yfinfo.get('companyOfficers') or []
                ceo = next((o for o in officers if 'CEO' in (o.get('title','') or '').upper() or 'chief executive' in (o.get('title','') or '').lower()), None)
                if not ceo and officers: ceo = officers[0]
                info = {
                    'ceo_name': ceo.get('name') if ceo else None,
                    'ceo_title': ceo.get('title') if ceo else None,
                    'officers': officers[:5],
                    'company_name': yfinfo.get('longName') or yfinfo.get('shortName'),
                }
                cache[tk] = info
                time.sleep(0.3)
            except Exception as e:
                log_line(f"  ❌ {tk}: yfinance error {e}")
                no_data += 1
                continue

        ceo_name = info.get('ceo_name')
        if not ceo_name:
            log_line(f"  ⚪ {tk}: no CEO in yfinance")
            no_data += 1
            continue

        # Merge into existing governance (don't overwrite if already filled)
        gov = d.get('governance') or {}
        if not gov.get('ceo_name'):
            gov['ceo_name'] = ceo_name
        if not gov.get('ceo_title'):
            gov['ceo_title'] = info.get('ceo_title')
        # officers = ceo + co-officers
        officers_list = info.get('officers') or []
        if officers_list and not gov.get('officers'):
            gov['officers'] = [
                {'name': o.get('name'), 'title': o.get('title'), 'age': o.get('age')}
                for o in officers_list[:5] if o.get('name')
            ]
        # Fallback fiscal_year
        if not gov.get('fiscal_year'):
            gov['fiscal_year'] = datetime.now().year - 1

        d['governance'] = gov
        d['_governance_yf_fallback_at'] = datetime.now(timezone.utc).isoformat()
        pipe_f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        written += 1
        log_line(f"  ✅ {tk}: ceo={ceo_name}")

    # Save updated cache
    if cache:
        CACHE_YF.write_text(json.dumps(cache, indent=2))
    log_line(f"END : written={written} skipped={skipped} no_data={no_data}")


if __name__ == "__main__":
    main()
