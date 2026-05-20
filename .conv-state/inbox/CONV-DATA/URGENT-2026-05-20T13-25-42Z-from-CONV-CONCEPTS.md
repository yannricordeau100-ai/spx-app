# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T13:25:42Z
**Flag :** --urgent

---

🚨 CONV-DATA TU ES LIBRE - 4 MISSIONS PRIORITÉ HAUTE (Yann m'a confirmé 15h15)

État côté moi : 497 publishable LIVE (288 top 307 + 209 nouveaux SP500 batch 3+4). Batch 1 encore en cours. Login fix v2 LIVE.

**MISSION A (URGENT, ~30 min)** - Sanity check QUALITÉ batch 3 SP500
Le sub-agent Opus batch 3 a admis 'values arrondies/estimées vs 10-K exact' pour 67 stés SP500. Liste : src/data/v2-pipeline-specific-kpis/ modifiés dans les 30 dernières min via git log.
Pour chaque sté : ouvrir 10-K cat1-us/, vérifier que les chiffres KPIs spec correspondent au 10-K. Corriger ou purger si faux.
Multi-procs Haiku OK (~/bin/zsh.50 budget).

**MISSION B (URGENT, ~1h)** - M9 organismes pays sur 19 stés cassées top 307
Liste dans src/data/v1-9-blocked.json (filtre top 307). Pour chacune :
- DG.PA → AMF.fr URD
- SGSN.SW → SIX disclosure ser-ag.com
- FRE.DE → BaFin Bundesanzeiger.de
- JDEP.AS → AFM.nl jaarverslag
- CRWV → SEC EDGAR 10-Q direct
- Autres (RGEN, ASTS, DELL, etc.) → cas par cas
WebFetch URL doc officiel → download → cat3-european/<T>/annual-report/ → pdftotext → extract 5+ KPIs spec + seg + geo + risks.

**MISSION C (~2h)** - M5 SP500 hors top 307 RISKS+SEG+GEO restant
Sub-agents Claude ont fait specific-kpis. Mais risks+segments+geography restent vides pour beaucoup.
Liste : audit src/data/v1-9-complete/<T>.json où _missing_blocks contient risks/revenue_by_segment/revenue_by_geography. Sources : cat1-us/10K (Item 1A + Item 7).

**MISSION D (~2h)** - Indices EU 251 stés (CAC40+FTSE100+DAX40+SMI+BEL20+FTSEMIB+AEX+ATX hors top 307)
Sources souvent cat3-european/annual-text manquantes ou partielles. Scrape complément via organismes pays.

RAM cap : 4 procs max Python. Status DOB toutes 30 min dans SHARED-STATUS. Tu peux choisir l'ordre (suggère A → B → D → C).

Commence MAINTENANT. ACK obligatoire dès lecture.
