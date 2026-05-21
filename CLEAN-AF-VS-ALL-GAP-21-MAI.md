# Gap clean_af vs clean_all — Audit V1.9 — 21 mai

## Vue d'ensemble

- **Clean a-f** : 345 stés
- **Clean a-f+g-m (all)** : 61 stés
- **Gap** : 284 stés bloquées sur 1+ critère g-m

Note : chiffres réels audit V1.9 différents du brief (345 vs 326 clean_af, 61 vs 50 clean_all, 284 vs 276 gap).

## Cluster par critère bloqueur dominant

| Critère g-m | Stés KO (sur 284) | % du gap |
|-------------|-------------------|----------|
| g_governance | 283 | 99.6% |
| h_ai_positioning | 0 | 0.0% |
| i_events | 0 | 0.0% |
| j_description | 0 | 0.0% |
| k_ranks | 0 | 0.0% |
| l_hero_name_fr | 2 | 0.7% |
| m_freshness | 0 | 0.0% |

**Finding critique : g_governance est responsable de 99.6% du gap (283/284 stés).**

Distribution nb critères KO par sté :
- 1 critère KO : 283 stés (99.6%)
- 2 critères KO : 1 sté (SBAC : g_governance + l_hero_name_fr)

## Décomposition g_governance — champs manquants

| Champ manquant | Stés concernées |
|----------------|-----------------|
| ceo_name | 262 |
| ceo_total_comp_m | 225 |
| voting_structure | 207 |
| board_size | 207 |
| top_capital | 33 |
| top_voting | 33 |

## Top 15 combos missing g_governance

| Stés | Combo manquant | Sample tickers |
|------|----------------|----------------|
| 153 | board_size+ceo_name+ceo_total_comp_m+voting_structure | AAPL, ABBV, ABNB, ABT, ADI |
| 36 | board_size+ceo_name+voting_structure | GILD, HAL, HAS, HSY, ITW |
| 24 | ceo_name+ceo_total_comp_m+top_capital+top_voting | 1COV.DE, ADYEN.AS, AGS.BR, BARC.L, BBVA.MC |
| 19 | ceo_name+ceo_total_comp_m | AKZA.AS, ATCO-A.ST, BN.PA, CAP.PA, CLNX.MC |
| 15 | (empty — reason top_capital/voting <3) | BLDR, CMG, CRWV, ETN, FAST |
| 14 | ceo_name+ceo_total_comp_m+voting_structure | A, ABBN.SW, AZN.ST, BP, BX |
| 6 | board_size+ceo_name+ceo_total_comp_m+top_capital+top_voting | DIM.PA, FORTUM.HE, HEN.DE, KOG.OL, MAP.MC |
| 5 | board_size+ceo_name+ceo_total_comp_m | ANA.MC, AZN.L, LEN, VIE.PA, ZTS |
| 2 | board_size+ceo_total_comp_m+top_capital+top_voting | DDOG, ROG.SW |
| 2 | board_size | FOX, STLD |
| 2 | ceo_name | KVUE, PODD |
| 2 | ceo_name+voting_structure | NWSA, UHS |
| 1 | board_size+ceo_total_comp_m+voting_structure | DRI |
| 1 | board_size+ceo_name | FTNT |
| 1 | board_size+ceo_total_comp_m+top_capital+top_voting+voting_structure | FUTU |

## Catégorisation par effort de fix

| Catégorie | Stés | Description |
|-----------|------|-------------|
| medium_us_proxy_full | 212 | US — proxy/DEF14A complet à scraper (ceo_name, ceo_total_comp_m, board_size, voting_structure) |
| medium_eu_full | 24 | EU — ceo_name + ceo_total_comp_m + top_capital + top_voting |
| easy_ceo_yfinance | 21 | EU — uniquement ceo_name+ceo_total_comp_m (yfinance officers) |
| top_capital_voting_lt3_or_reason_only | 15 | US — top_capital ou top_voting <3 entrées (reason only) |
| hard_multi_source | 9 | Combos complexes 5 champs manquants |
| easy_board_structure_proxy | 2 | board_size uniquement (FOX, STLD) |
| no_governance_issue | 1 | KO sur autre extension (SBAC: l_hero_name_fr) |

## Easy wins immédiats (top 30)

| # | Ticker | Scope | Catégorie | Missing | Reason |
|---|--------|-------|-----------|---------|--------|
| 1 | AKZA.AS | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 2 | ATCO-A.ST | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 3 | BN.PA | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 4 | CAP.PA | EU_other | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 5 | CLNX.MC | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 6 | DG.PA | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 7 | EQNR.OL | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 8 | ERF.PA | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 9 | FLTR.L | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 10 | KER.PA | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 11 | KVUE | SP500_other | easy_ceo_yfinance | ceo_name | gov manque: ceo_name |
| 12 | LAND.L | EU_other | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 13 | MUV2.DE | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 14 | NESTE.HE | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 15 | NOKIA.HE | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 16 | NOVN.SW | EU_other | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 17 | PHIA.AS | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 18 | PODD | SP500_other | easy_ceo_yfinance | ceo_name | gov manque: ceo_name |
| 19 | PRY.MI | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 20 | TEL2-B.ST | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 21 | VWS.CO | top307 | easy_ceo_yfinance | ceo_name,ceo_total_comp_m | gov manque: ceo_name,ceo_total_comp_m |
| 22 | FOX | SP500_other | easy_board_structure_proxy | board_size | gov manque: board_size |
| 23 | STLD | SP500_other | easy_board_structure_proxy | board_size | gov manque: board_size |
| 24 | BLDR | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 25 | CMG | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 26 | CRWV | top307 | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 27 | ETN | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 28 | FAST | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 29 | INCY | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |
| 30 | INTU | SP500_other | top_capital_voting_lt3_or_reason_only | — | top_capital < 3 (partial_allowed=false) |

## Breakdown par scope

| Scope | Total audité | Clean_all current | Gap (af ok, all ko) |
|-------|--------------|-------------------|----------------------|
| Top 307 | 297 | 28 | 108 |
| SP500 (hors top307) | 350 | 30 | 162 |
| EU (hors top307) | 112 | 0 | 14 |
| Others | 12 | 3 | 0 |

Distribution par nb critères g-m KO (gap) :
| Scope | 1 critère KO | 2 critères KO | 3+ critères KO |
|-------|--------------|---------------|----------------|
| Top 307 | 108 | 0 | 0 |
| SP500_other | 161 | 1 | 0 |
| EU_other | 14 | 0 | 0 |

## Recommandations dispatch sub-agents

Le gap est mono-cause : g_governance. Pas besoin de dispatch sur i_events/m_freshness/k_ranks/j_description (déjà OK partout sauf marginal).

### Plan revisé

1. **Sub-agent #130 — fix easy_ceo_yfinance (21 stés EU)**
   - Source : yfinance `info['companyOfficers']` pour ceo_name + ceo_total_comp_m
   - ETA : 30 min
   - Impact estimé clean_all : +21 → 82

2. **Sub-agent #131 — fix top_capital_voting_lt3 (15 stés US)**
   - Source : SEC 13F holders top 3-5 (BLDR, CMG, CRWV, ETN, FAST, INCY, INTU, PKG, RIVN, SBAC, STT, SYF, TRMB, TYL, UAL)
   - ETA : 45 min
   - Impact estimé clean_all : +14 → 96 (SBAC bloqué aussi par l_hero_name_fr)

3. **Sub-agent #132 — fix medium_us_proxy_full (212 stés US batch DEF14A)**
   - Source : SEC DEF14A scrape (ceo_name + ceo_total_comp_m + board_size + voting_structure)
   - ETA : 2-3h (212 stés, batch parallèle nécessaire)
   - Impact estimé clean_all : +180-200 → ~280

4. **Sub-agent #133 — fix medium_eu_full (24 stés EU)**
   - Source : URD/Document de référence + EU registries
   - ETA : 1-1.5h
   - Impact estimé clean_all : +20 → +)

5. **Sub-agent #134 — fix easy_board_structure_proxy (FOX, STLD) + SBAC l_hero_name_fr**
   - ETA : 10 min
   - Impact : +3

### ETA récupération clean_all 200+

- **Court terme (1h)** : sub-agents #130+#131+#134 → clean_all 61 → ~99 (+38)
- **Moyen terme (3h)** : ajouter #132 partiel + #133 → clean_all ~260+
- **Cible 200+ atteignable** via sub-agent #132 DEF14A batch (qui pèse 212/284 = 74% du gap)

## Top 3 critères bloqueurs

1. **g_governance** — 283 stés (99.6%)
   - Sous-décomposition : ceo_name (262), ceo_total_comp_m (225), voting_structure (207), board_size (207), top_capital/voting (33 chacun)
2. **l_hero_name_fr** — 2 stés (INGA.AS, SBAC) — fix manuel <5 min
3. Aucun autre critère g-m ne bloque significativement (autres extensions <1% chacune)
