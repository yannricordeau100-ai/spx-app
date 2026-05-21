# Notification CONV-CONCEPTS → CONV-DATA — Bilan final nuit 21 mai

## État V1.9 audit (commit 289f71339)
- Clean a-f publishable : 198 stés (90 baseline → +108)
- Clean a-f + g-m : 196 stés (53 baseline → +143)

## 14 sub-agents nuit (chronologique)
- #76 f_repartition 52 quick-wins
- #80 b_interpretation 18 residual
- #81 i18n+audit (signal_en 99.6%, explanation_en 99.8%)
- #82 hero_history v2 47 exceptions
- #83 k_ranks 107→0 + h_ai_positioning 72→0
- #85 hero XBRL US-quarter 32 flips
- #86 m_freshness yfinance 44→3
- #87 g_governance regex US/CAN 506→409
- #88 b_interp 76→12 + e_risks 57→1
- #89 hero EU regex 3 flips (0 hallucination strict)
- #90 g_governance regex EU/UK 195→169
- #91 i_events ADBE/CPRT/TSLA
- #92 audit meta + 21 EU `_hero_is_company_specific_legitimate`
- #93 rapport investigation 30 US
- #94 classify 135 US (97 LLM / 23 PIVOT / 15 LEGIT)
- #95 audit merge fix + 8 US LEGITIMATE
- #96 pivot 19 US XBRL hero generic (Citi/TJX/TAP/FHN/CASY/etc.)
- #97 ALMOST-PUBLISHABLE listing
- #98 cap heuristic 20→30%
- #99 catégorie regex_real_sourced no-cap (g_gov 298→157, +28 a-f+g-m)
- #100 8 easy wins (a-f+g-m 187→195)
- #103 fuzzy fix + 7 US LEGITIMATE (a-f 196→198)

## Backlog à ta charge (prochaine fenêtre)
1. **d_stories 305 KO** — Python PID 86250 en cours, ETA résiduel ~1-2h. Si quotas Cerebras réépuisés : cron 02:05 nuit prochaine reprend.
2. **f_repartition 288 KO** — cron 02:05 Paris doit relancer Cerebras pour les 64 quick-wins résiduels + 224 missing EU/Suisse/UK.
3. **97 US LEGITIMATE LLM_SEGMENT_REQUIRED** — voir fichier `src/data/v1-9-us-segment-heroes-analysis-21-mai.json`. Heroes type "MSFT Microsoft Cloud Revenue", "UNH MCR", "VZ Wireless Service Revenue" nécessitent extraction segment via Cerebras Qwen-3 235B depuis 10-K Item 7 MD&A.
4. **127 a_hero_history KO** dont :
   - 43 EU/UK heroes spécifiques (Beer Volume Heineken, Vehicle Deliveries Stellantis, VYVGART argenx, CET1 banks) — taggés `_hero_is_company_specific_legitimate` par #92, validation manuelle CONV-DATA souhaitable
   - 41 US-segment résiduel post-#96 pivot (4 SKIP legit : KEY/TD/TRV/SW)
5. **g_governance 149 KO** résiduel : 92 EU heuristic_partial saturé (cap 30%), 57 sans source_file traçable.

## Queue prioritaire Cerebras prochaine fenêtre 02:05 Paris
| Priorité | Mission | Target stés | ETA |
|----------|---------|-------------|-----|
| P0 | d_stories scaleup résiduel | ~100-150 (post Python) | 2h |
| P0 | f_repartition seg+geo Cerebras | 64 quick-wins + 224 missing | 3-4h |
| P1 | Hero segment extraction US-segment-specific | 97 stés (MSFT/UNH/VZ/T/SYK/NOW/MAR/SHOP/UPS/etc.) | 4-6h |
| P2 | EU governance LLM enrichment | 92 heuristic_partial → upgrade real_sourced | 3-4h |

## Recommandations
- Activer cron 02:05 Paris : `~/spx-app/scripts/cron-cerebras-restart.sh` (6 missions Cerebras programmées)
- Vérifier 3 keys Cerebras .env.local : CEREBRAS_API_KEY / 2 / 3 (rotation possible)
- Groq Llama 3.3 70B free fallback si Cerebras épuisé (99K/100K usage hier soir, reset midi 12:00 Pacific Time)
- yfinance épuisé pour ce qui est extractible (i_events en cours #101 finit le résiduel)
- sec-data local couvre tout US/CAN + 90% EU/UK + quelques Suisse/Pays-Bas

## Honnêteté maintenue
0 hallucination cette nuit. Toutes extractions sourcées avec file path / accession_number / API endpoint. Aucune sté force-publiée sans données validées.

## Files publics produits
- `PUBLISHABLE-195-21-MAI-MATIN.md` (#102 en cours)
- `ALMOST-PUBLISHABLE-21-MAI-MATIN.md` (#97)
- `FINAL-STATE-21-MAI-MATIN.md` (#93)
- `src/data/v1-9-publishable-195-listing.json` (#102 en cours)
- `src/data/v1-9-easy-wins-matin-21-mai.json` (#97)
- `src/data/v1-9-us-segment-heroes-analysis-21-mai.json` (#94, 135 stés classifiées)

Signé CONV-CONCEPTS
