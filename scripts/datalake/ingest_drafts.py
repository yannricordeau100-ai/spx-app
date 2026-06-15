#!/usr/bin/env python3
"""ingest_drafts.py — ingere les extracted.json (KPI + gouvernance) des agents
dans data-lake/mettrik.db (table facts, bloc=kpi_normaux/story/gouvernance).
A relancer pour faire avancer le monitor pendant que les fan-outs tournent."""
import json, glob, sqlite3, os
DB='data-lake/mettrik.db'
con=sqlite3.connect(DB)
con.execute("""CREATE TABLE IF NOT EXISTS facts(ticker TEXT,metric_key TEXT,bloc TEXT,period_type TEXT,period_end TEXT,value REAL,unit TEXT,currency TEXT,source_doc TEXT,source_ref TEXT,extracted_by TEXT,citation TEXT,fiscal_period TEXT,UNIQUE(ticker,metric_key,period_type,period_end,source_ref))""")
nk=ng=0
for f in glob.glob('data-lake/*/kpis/extracted.json'):
    tk=f.split('/')[1].upper()
    try: d=json.load(open(f))
    except: continue
    for k in d.get('kpis',[]):
        pt=k.get('period_type','year'); pt='quarter' if pt=='quarter' else 'year'
        bloc='story' if pt=='quarter' else 'kpi_normaux'
        for h in k.get('history',[]):
            con.execute("INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (tk,k.get('short','?'),bloc,pt,h.get('period_end'),h.get('value') if isinstance(h.get('value'),(int,float)) else 0,
               k.get('unit',''),'','agent','accn:'+str(h.get('accession','')),'agent-verbatim',(h.get('quote') or '')[:200],''))
            nk+=1
    con.commit()
# Yann 13 juin 2026 : KPI haut de gamme (hero/) -> bloc 'story'
for f in glob.glob('data-lake/*/hero/extracted.json'):
    tk=f.split('/')[1].upper()
    try: d=json.load(open(f))
    except: continue
    for k in d.get('kpis',[]):
        pt=k.get('period_type','quarter'); pt='quarter' if pt=='quarter' else 'year'
        for h in k.get('history',[]):
            con.execute("INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (tk,k.get('short','?'),'story',pt,h.get('period_end'),h.get('value') if isinstance(h.get('value'),(int,float)) else 0,
               k.get('unit',''),'','agent','accn:'+str(h.get('accession','')),'agent-verbatim',(h.get('quote') or '')[:200],''))
            nk+=1
    con.commit()
for f in glob.glob('data-lake/*/governance/extracted.json'):
    tk=f.split('/')[1].upper()
    try: d=json.load(open(f))
    except: continue
    g=d.get('governance') or {}
    for field in ['ceo_name','ceo_total_comp_usd','board_size','board_independent_pct','board_women_pct','say_on_pay_pct','voting_structure','top_holders']:
        v=g.get(field)
        if v not in (None,'',[]):
            con.execute("INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (tk,field,'gouvernance','instant','2025-12-31',0,'','','DEF 14A','','agent-verbatim',str(v)[:120],''))
            ng+=1
    con.commit()
con.close()
print(f"ingéré: {nk} points KPI/story, {ng} champs gouvernance")
