# Stés presque publiables — Matin 21 mai

Audit basé sur `src/data/v1-9-pre-publication-audit.json` (état **post sub-agent #98** = cap heuristic_partial relevé 20 %→30 %, commit 622e46419).
Fichier complémentaire détaillé : `src/data/v1-9-easy-wins-matin-21-mai.json`.

## Bilan

| Métrique | Pré-#98 (cap 20 %) | Post-#98 (cap 30 %) | Δ |
|----------|---------------------|----------------------|---|
| Clean a-f publishable | 190 | **190** | 0 (les fixes #98 portent sur g-m) |
| Clean a-f + g-m | 130 | **159** | +29 |
| Gap clean a-f KO sur g-m | 60 | **31** | -29 |
| g_governance KO total | 376 | 298 | -78 |
| heuristic_partial retenus | 155 | 233 | +78 |
| heuristic_partial_capped | 219 | 141 | -78 |
| dont EU capped | 90 | **84** | -6 |

Note : le relâchement #98 a libéré principalement des stés US/CAN (-72 sur 129 = -56 %) et seulement 6 EU sur 90. Le cap a été appliqué `top_voting OR top_capital ≥1` d'abord, puis market_cap desc — les US/CAN ont passé le sort en premier.

## Cluster par critère g-m KO (31 stés gap restantes)

| Critère | Nb stés | Top 5 tickers |
|---------|---------|---------------|
| g_governance | **31** (100 %) | OR.PA · NG.L · MO · FTNT · GD |
| h_ai_positioning · i_descriptions · j_events · k_ranks · l_devises_units · m_freshness | 0 | — |

100 % du gap reste bloqué sur g_governance. Sub-cluster :

| Sub-cause | Nb | Top tickers | Fix |
|----------|-----|-------------|-----|
| heuristic_partial_capped (cap 30 % saturé) | **23** | OR.PA · NG.L · BVI.PA · AI.PA · CRL | relever cap 30 %→35 % ou extraire ceo_total_comp_m |
| top_capital < 3 (US) | 5 | FTNT · GD · LEN · MO · ZTS | yfinance institutional_holders |
| gov manque (CEO/board_size) | 2 | DTE (ceo_name) · EDP.LS (ceo_total_comp_m, board_size) | manuel 5 min |
| top_voting < 3 | 1 | ATCO-A.ST | rapport Atlas Copco (Wallenberg A/B) |

## Easy wins matin Yann (8 stés fixables ≤ 15 min, total ≤ 75 min)

Ces 8 stés ne dépendent PAS du cap : data manquante ou extraction incomplète. Fix immédiat **sans relâchement cap**.

| # | Ticker | KO | Suggestion fix | Min |
|---|--------|-----|----------------|-----|
| 1 | DTE | ceo_name vide | yfinance.info[longBusinessSummary] → Jerry Norcia | 5 |
| 2 | EDP.LS | ceo_total_comp_m + board_size | rapport annuel EDP.pt 2024 (section gouvernance) | 5 |
| 3 | FTNT | top_capital < 3 (US) | yfinance institutional_holders → Vanguard/BR/SS | 10 |
| 4 | GD | top_capital < 3 (US) | yfinance institutional_holders | 10 |
| 5 | LEN | top_capital < 3 (US) | yfinance institutional_holders | 10 |
| 6 | MO | top_capital < 3 (US) | yfinance institutional_holders | 10 |
| 7 | ZTS | top_capital < 3 (US) | yfinance institutional_holders | 10 |
| 8 | ATCO-A.ST | top_voting < 3 | annual report Atlas Copco 2024 (Wallenberg structure A/B) | 15 |

**Effet immédiat estimé** : clean_af_plus_gm 159 → **167** (+8 stés) si les 8 sont fixées avant 9h.

Les 23 autres stés du gap (heuristic_partial_capped) ne se débloquent QUE via relâchement du cap (cf P0 ci-dessous).

## Stés EU heuristic_partial_capped (84 stés data-ready, post-#98)

84 stés EU restent éligibles à l'exception heuristic_partial mais downgradées car le cap 30 % global (233 slots) est saturé par les US/CAN du sub-agent #87.

**Répartition par pays** :

| Pays | Nb | Exemples top MC |
|------|----|-----------------|
| .L (UK) | ~22 | BP.L · GLEN.L · NG.L · BARC.L · BA.L |
| .PA (FR) | ~17 | OR.PA · CS.PA · DG.PA · BN.PA |
| .DE (DE) | ~10 | SIE.DE · MRK.DE · MUV2.DE |
| .MI (IT) | ~8 | ISP.MI · PRY.MI · SPM.MI |
| .SW (CH) | ~7 | ABBN.SW · ROG.SW · LOGN.SW |
| .AS (NL) | ~7 | INGA.AS · AGN.AS · AD.AS |
| .BR · .HE · .ST · .CO · .MC · .OL | ~13 | COFB.BR · NDA-FI.HE · BBVA.MC |

**Top 10 EU capped par MC** (priorité commerciale haute, exact ordering dans le JSON) :

1. OR.PA — 206.9 Mds $ — L'Oréal
2. BBVA.MC — 114.2 Mds $ — Banco Bilbao Vizcaya
3. ISP.MI — 109.4 Mds $ — Intesa Sanpaolo
4. BP.L — 106.9 Mds $ — BP plc
5. GLEN.L — 89.4 Mds $ — Glencore
6. CS.PA — 86.7 Mds $ — AXA
7. NG.L — 82.2 Mds $ — National Grid
8. INGA.AS — 80.4 Mds $ — ING Group
9. BARC.L — 75.9 Mds $ — Barclays
10. BA.L — 72.3 Mds $ — BAE Systems

**Champs déjà extraits** (échantillon sub-agent #90 + yfinance) :
- ~100 % ont ceo_name + ceo_title
- ~30-40 % ont board_size + voting_structure_note
- 0 % ont ceo_total_comp_m (réglementation EU n'impose pas la divulgation)
- ~70 % ont officers (5-15 dirigeants)

## Scénarios relâchement cap heuristic_partial (à partir de 30 % actuel)

État actuel : cap 30 % = 233 slots retenus, 141 capped (84 EU + 57 US/autres). Total éligibles = 374.

| Cap | Slots | +Slots additionnels | EU débloquées (prop.) | Clean_af_plus_gm cible |
|-----|-------|---------------------|----------------------|------------------------|
| 30 % (actuel post-#98) | 233 | 0 | 0 | 159 |
| 35 % | 272 | +39 | ~23 | 159 + ~14 EU dans gap = **~173** |
| 40 % | 311 | +78 | ~46 | 159 + ~21 (limité par gap 23) = **~180** |
| 45 % | 350 | +117 | ~70 | 159 + 23 (tout gap cap-bound débloqué) = **~182** |

Note : sur les 23 stés du gap heuristic_partial_capped, ~17 sont EU. Le calcul "EU dans gap débloquées" applique la proportion EU (84/141 ≈ 60 %) au nombre de slots additionnels.

## Recommandations actions Yann

1. **[P0] Fix 8 easy wins ≤ 15 min** (DTE, EDP.LS, FTNT, GD, LEN, MO, ZTS, ATCO-A.ST). Effet : +8 sur clean_af_plus_gm (159 → 167). ETA cumulé ≤ 75 min, 0 risque hallucination (data publique vérifiable).

2. **[P0] Relâcher cap heuristic_partial 30 %→35 %** dans `scripts/audit-v1-9-pre-publication.js` (sub-agent #98 a déjà fait 20→30, marche prouvée). Effet : +14 EU dans gap débloquées. Cap ratio reste sous le seuil 35 % généralement accepté.

3. **[P0] Cron 02:05 Paris Cerebras** sur les 305 d_stories + 64 f_repartition résiduels (mission #94 + cron #46 déjà en file). Effet : clean_af 190 → 210-225 selon succès LLM.

4. **[P1] Pivot hero ~30 US-segment stés** vers Revenue/NetIncome générique (sub-agent #96 fait 23 ce matin). Effet : a_hero_history KO 153 → 130.

5. **[P2] Audit pre-deploy staging visual via Chrome MCP** (règle 0.bis) sur 5-10 stés témoins EU débloquées post-#98 (BN.PA, CAP.PA, AZN.ST, ABBN.SW, ARGX.BR) avant promote prod.

6. **[P3] CONV-DATA reprend les 97 LLM_SEGMENT_REQUIRED US** post quotas reset Cerebras (00:00 UTC).

## Métriques cibles fin journée (21 mai soir)

| Métrique | Baseline matin (post-#98) | Cible | Levier |
|----------|---------------------------|-------|--------|
| Clean a-f publishable | 190 | **230** (+40) | cron stories + pivot hero + f_repartition |
| Clean a-f + g-m | 159 | **190** (+31) | easy wins (+8) + cap 35 % (+14) + propagation clean_af |
| Tag _is_short_history_legitimate | 128 (16.4 %) | stable ≤ 21 % cap | acquis sub-agent #92 |
| Tag _hero_is_company_specific_legitimate | 21 (2.7 %) | ≤ 10 % cap | marge confortable |
| g_governance KO | 298 | 250 (-48) | cap 35 % + easy wins + ré-extraction ceo_total_comp_m EU |

## Fichiers livrés

- `ALMOST-PUBLISHABLE-21-MAI-MATIN.md` (ce fichier)
- `src/data/v1-9-easy-wins-matin-21-mai.json` (data machine-readable : 31 easy wins + 84 EU capped + scénarios cap)

## Annexe : interaction avec sub-agents concurrents

- Sub-agent **#95** (commit 73e7e81e6) : audit merge fix + tag 9 US — ne touche pas mon scope.
- Sub-agent **#96** : pivot hero 23 US XBRL — réduit a_hero_history KO mais hors mon clustering.
- Sub-agent **#98** (commit 622e46419) : cap relax 20 %→30 % — **déjà appliqué**, mes chiffres reflètent ce nouvel état.
- Python stories PID 86250 : 305 d_stories — sera la source du +20-35 sur clean_af côté soir.

Pas de chevauchement scope. Mission lecture pure, zéro modif données.
