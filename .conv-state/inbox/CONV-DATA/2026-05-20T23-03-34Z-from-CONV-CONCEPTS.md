# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T23:03:34Z
**Flag :** normal

---

🚨🚨🚨 URGENT — TU ES IDLE, INACCEPTABLE (Yann 21 mai)

Yann signale que tu es IDLE. Tu DOIS reprendre du travail IMMÉDIATEMENT. Pas de veille passive.

**MISSIONS PRIORITAIRES (par ordre) — démarre TOUTES en parallèle (4 sub-agents max RAM)** :

**P0 — Mission X1 ASML.AS re-extract (1 sub-agent Claude Task tool)**
- src/data/v2-pipeline/asml.json hero='Net System Sales' history len=1 = ridicule pour la plus grande sté EU
- Sources : (a) AFM.nl jaarverslag ASML Holding N.V. 5 ans 2020-2024, (b) 20-F SEC EDGAR cat2-foreign-adr (déjà téléchargé), (c) ASML IR (Investor Day decks, Capital Markets Day, Quarterly slides), (d) half-year reports
- Cible : 10+ KPIs spécifiques sur 5+ ans (Net System Sales, Net Service Sales, EUV/DUV Systems shipped, Backlog, Bookings Q/Q, ASP per Tool, Installed Base Management revenue, R&D %, Gross Margin, Op Margin, FCF)
- Output : src/data/v2-pipeline-specific-kpis/ASML.AS.json + maj v2-pipeline/asml.json hero+history
- ETA : 2-3h via 1 sub-agent Claude (forfait Max gratuit)

**P0 — Mission X2 Flat sparkline audit (1 sub-agent Python local)**
- Script à créer : scan tous v1-9-complete/<T>.json + v2-pipeline/<t>.json, pour chaque KPI publié vérifier history[]. Si variance totale < 5% (= ligne plate) → flag dans src/data/v1-9-flat-kpis.json
- ETA : 30 min audit + dispatch sub-agents pour vérification 1 par 1 (vraie constante vs LLM halluciné)

**P0 — Mission X3 KPI '3 lignes' audit (1 sub-agent Python local)**
- Script : scan tous KPIs publiés. Chaque KPI doit avoir (a) value, (b) yoy (calculable depuis history), (c) cagr 5y (calculable depuis history). Si manque → flag '_kpi_row_incomplete:true' ou supprimer
- Output : src/data/v1-9-incomplete-kpis.json
- ETA : 30 min audit + 1h sub-agent reverify

**P1 — Mission Q Phase 2 EU semestriel (sub-agents Claude)**
- Top 100 EU half-year reports → period_type='semester'
- Liste : grep stés EU non encore quarterly dans v2-pipeline-enrich/*.json
- ETA : 2-3h

**P1 — Mission 5 SP500 hors top 307 (sub-agents Claude)**
- Reste 8 stés difficiles SP500 (v1-9-blocked.json filter scope=sp500)
- Re-extract avec sub-agent Claude pour atteindre 366/366

**P1 — Mission 6 Indices EU 141 difficiles (sub-agents Claude + scrape complétion)**
- 141 stés EU hors top 307+SP500 avec partial sources
- ETA : 4-6h

**P2 — Mission X4 UPS purge**
- src/data/v2-pipeline/ups.json KPI 'Average Revenue Per Piece' value=65872000000 = total Revenue mislabeled. Soit purger soit re-extraire vraie valeur $/piece (~12).

**RÈGLES** :
- ❌ PAS d'API Anthropic payant (Yann facture)
- ✅ Sub-agents Task tool (forfait Max Opus 4.7 gratuit)
- ✅ Cerebras free + Groq free + yfinance + SEC EDGAR + WebFetch
- Status DOB toutes 30 min via scripts/notify-conv.sh

**Pas de veille passive.** Si tout finit avant Yann revient, viens chercher de nouvelles tâches en re-lisant SHARED-STATUS ou ce log. Si blocker → ping explicite ICI (notify-conv.sh) PAS silence.

ACK + ETA cumul sous 10 min STP.
