# Notification CONV-CONCEPTS → CONV-DATA: bilan nuit 21 mai

## État V1.9 audit
- Clean a-f publishable : 188 stés (90 baseline → +98)
- Clean a-f + g-m : 136 stés (53 baseline → +83)
- a_hero_history KO : 182 → 161 (cette session sub-agent #92 : -21 EU/UK
  taggées `_hero_is_company_specific_legitimate` avec cap séparé 10 %)

## Backlog encore à ta charge

1. **d_stories 305 KO** (en cours Python PID 86250 CONV-CONCEPTS): completer
   les 305 stés résiduelles via Cerebras quand quotas reset (02:05 Paris cron #46)

2. **f_repartition 288 KO**: résiduel après #76 (52 quick-wins fixées)

3. **a_hero_history 140 US-segment-specific KO**: heroes type "AMD Data Center
   Revenue", "CAT Backlog", "UNH MCR", "SHOP GMV" nécessitent extraction segment
   via LLM Cerebras (XBRL pur ne suffit pas)

4. **g_governance 506 KO baseline** dont 327 US/CAN en cours #87, 179 EU/UK en
   cours #90: possible que tu doives reprendre les filings DEF14A complets
   pour les stés où regex ne suffit pas

5. **a_hero_history 43 EU/UK heroes spécifiques**: 21 stés taggées
   `_hero_is_company_specific_legitimate` par #92 cette session, mais
   validation manuelle souhaitable (CONV-DATA confirmer que "Beer Volume
   Heineken" est bien le hero KPI officiel publié, etc.). Liste tagguée :
   ARGX.BR (biotech_pipeline), AZN.L (biotech_pipeline), BMED.MI (bank_cet1),
   NDA-SE.ST (bank_roe), P911.DE (automotive_deliveries), VOW.DE
   (automotive_deliveries), VOW3.DE (automotive_deliveries), ABBN.SW
   (industrial_segment), PRY.MI (industrial_segment), VOE.VI
   (industrial_segment), POLY.L (mining_production), NHY.OL
   (aluminium_adj_ebitda), WDP.BR (reit_portfolio_value), WIZZ.L
   (aviation_fleet), WTB.L (hospitality_rooms), SRG.MI (utility_rab),
   AMUN.PA (asset_mgmt_aum), SIE.DE (industrial_orders), COFB.BR
   (holding_portfolio_share), HER.MI (utility_waste_ebitda), HOLN.SW
   (industrial_recurring_ebit).
   Reste ~22 EU/UK candidates non taggés (heroes Revenue/Margin trop
   génériques, à investiguer cas par cas si besoin).

## Recommandations
- Cerebras 3 keys reset 02:05 Paris (cron #46 actif): utiliser pour scaleup
  d_stories + segment heroes
- yfinance déjà épuisé sur 188 stés (i_events, m_freshness, k_ranks, h_ai_positioning)
- sec-data local couvre majorité US/CAN/EU, manque ~50 stés .L .PA .DE .MI .BR
  pures (pas de FPI SEC)

## Files modifiés cette session (sub-agent #92)
- `scripts/audit-v1-9-pre-publication.js` (exception company-specific +
  cap 10 % + tracker by_category)
- `scripts/tag-hero-company-specific.mjs` (script tagging idempotent)
- 21 fichiers `src/data/v2-pipeline-enrich/<lowercase>.json` (tags
  `_hero_is_company_specific_legitimate` + rationale + category)
- `SHARED-STATUS.md` (log activité bilan nuit)

Signé CONV-CONCEPTS (sub-agent #92)
