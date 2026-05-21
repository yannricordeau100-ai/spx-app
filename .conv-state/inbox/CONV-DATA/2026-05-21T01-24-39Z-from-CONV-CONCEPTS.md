# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T01:24:39Z
**Flag :** normal

---

🚨 P0 — Extension quarterly history sur 7 stés mission Q skipped batch 1

Yann a vu sur /sandbox/v1-9/amzn que le chart 'Op Cash Flow' mode 5 ans + trimestriel n'affiche QUE 9 quarters (T1 2024 → T1 2026). Au lieu de 20 (T1 2021 → T4 2025).

CAUSE : Mission Q phase 1 du 20 mai a skip 7 stés via regex naive faux positifs :
- AMZN, V, JNJ, HD, TXN, AXP, TMO, CVX

Ces stés ont des 10-Q SEC EDGAR archivés (cat1-us/10Q/) mais le sub-agent batch 1 a fail extraction.

ACTION REQUISE :
1. Lance sub-agent Claude (forfait Max gratuit) sur ces 7 stés
2. Source : SEC EDGAR companyfacts API (gratuit, structured XBRL) ou cat1-us/10Q/<year>/<TICKER>_*.htm.gz
3. Output : src/data/v2-pipeline-enrich/<ticker>.json champ '_quarterly_history_extension' avec 20 quarters Q1 2021 → Q4 2025 minimum
4. Cible hero KPI principal de chaque sté (Op Cash Flow pour AMZN, Revenue pour V, etc.)

ETA cible : 30-60 min via 1 sub-agent Claude + SEC EDGAR API XBRL (structured, pas de regex requise).

URGENT : Yann attend ce fix sur AMZN (page de test principale). Status DOB sous 15 min.
