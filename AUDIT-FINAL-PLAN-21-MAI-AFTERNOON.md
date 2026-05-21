# Plan final 100% top 307 + SP500 — 21 mai après-midi

Sub-agent #139 — audit lecture pure, zéro modif data.
Source : `node scripts/audit-v1-9-pre-publication.js --json` → `src/data/v1-9-pre-publication-audit.json`.

## État actuel (post sub-agents #131 / #137 / #138)

| Métrique | Valeur |
| --- | --- |
| Total publishable audité | 771 |
| Clean a-f (publishable strict) | **443** |
| Clean a-f + g-m (full extensions) | **208** |
| V1.9.5 live | 184 stés |

Distribution failed a-f :
- 0 fail : 443
- 1 fail : 247
- 2 fail : 70
- 3 fail : 10
- 4 fail : 1

Top critères qui bloquent (sur les 771) :
- `a_hero_history` 152 (19.7%)
- `f_repartition` 135 (17.5%)
- `d_stories` 101 (13.1%)
- `b_interpretation` 26 (3.4%)
- `e_risks` 6 (0.8%)
- ext `g_governance` 472 (61.2%)
- ext `m_freshness` 16, `k_ranks` 8, `i_events` 7, `l_hero_name_fr` 7, `h_ai_positioning` 5

### Par scope

| Scope | Univers | Audité | Clean a-f | % a-f | Clean all | % all |
| --- | --- | --- | --- | --- | --- | --- |
| Top 307 | 307 | 297 | **206** | 67.1% | **81** | 26.4% |
| SP500 | 503 | 485 | **317** | 63.0% | **156** | 31.0% |
| Union top307 ∪ SP500 | 673 | 649 | 426 | 63.3% | 203 | 30.2% |
| EU / autres (hors union) | — | 114 | 16 | — | 5 | — |

Top 307 ∩ SP500 = 136 stés (US large caps).

## Gap top 307 → 100% clean_all

### Bloc 1 — Tickers absents du publishable (10 stés à intégrer)
`AMGN`, `MO`, `UPS`, `KHC`, `III.L`, `ABF.L`, `URW.PA`, `UPM.HE`, `VIAV`, `ABVX`.

### Bloc 2 — 91 stés non clean a-f (sur 297 auditées)
Cluster a-f :
| Critère | Stés |
| --- | --- |
| d_stories | 42 |
| f_repartition | 36 |
| a_hero_history | 28 |
| b_interpretation | 4 |
| e_risks | 1 |

Top stés à fix (1 critère manquant, MC haute) : MSFT (a_hero_history), ASML (a_hero_history), JNJ (d_stories), UNH (a_hero_history), NVS (d_stories), GE (d_stories), C (a_hero_history), VZ (a_hero_history), PANW (d_stories), BA (d_stories).

### Bloc 3 — Extension g_governance (186 stés)
Plus gros bloqueur du clean_all top 307. Le sub-agent #131 (DEF14A US massif 212) cible exactement ce périmètre.

### Bloc 4 — Marginaux (l_hero_name_fr 2)
Trivial (renommage FR du hero).

**TOTAL gap top 307 100%** = 10 absents + 91 a-f + 186 governance + ~2 marginaux ≈ **289 fixes** (avec recoupements multi-critères).

## Gap SP500 → 100% clean_all

### Bloc 1 — Tickers absents du publishable (18 stés)
`AMGN`, `AMZN`, `DIS`, `KHC`, `KIM`, `KO`, `MO`, `ROL`, `ROP`, `RSG`, `SATS`, `SNDK`, `TPR`, `UPS`, `VEEV`, `VRT`, `VTRS`, `WY`.
(7 communs avec top307 : AMGN, MO, UPS, KHC + 14 SP500-only.)

### Bloc 2 — 168 stés non clean a-f (sur 485 auditées)
| Critère | Stés |
| --- | --- |
| a_hero_history | 109 |
| d_stories | 67 |
| f_repartition | 18 |
| b_interpretation | 1 |

Concentration sur `a_hero_history` (109) = >65% du gap a-f SP500 — gros volume mid-cap US avec historiques 4-ans.

### Bloc 3 — Extension g_governance (289 stés)
Périmètre cible du sub-agent #131 DEF14A.

### Bloc 4 — Marginaux
- `l_hero_name_fr` 3
- `m_freshness` 3
- `i_events` 2

**TOTAL gap SP500 100%** = 18 absents + 168 a-f + 289 governance + 8 marginaux ≈ **483 fixes**.

## Dispatch final recommandé (4 sub-agents)

### Sub-agent #140 — DEF14A US massif phase 2 (g_governance)
- Périmètre : 289 SP500 + 186 top307 non clean g_governance (≈ ~340 stés uniques après dédoublonnage).
- Continuation directe du #131 sur le reliquat post-phase 1.
- Source : SEC DEF 14A 2024-2025 → board_size, voting_note, CEO.
- ETA : 8-10 h Cerebras paid (~$0.8).

### Sub-agent #141 — Hero history backfill SP500 (a_hero_history)
- Périmètre : 109 SP500 + 28 top307 = ~125 stés uniques avec a_hero_history fail.
- Action : compléter 5e année KPI hero (mid-caps US à historiques 4 ans).
- Tactique : extend `_hero_is_company_specific_legitimate` whitelist + remplir 5e année via 10-K archives.
- ETA : 6-8 h.

### Sub-agent #142 — Stories + repartition fix (d_stories + f_repartition)
- Périmètre :
  - d_stories : 67 SP500 + 42 top307 = ~80 stés uniques
  - f_repartition : 18 SP500 + 36 top307 = ~45 stés uniques
- Action : générer stories KPI (≥5) + breakdown segments/géographies.
- ETA : 5-7 h.

### Sub-agent #143 — Integration 18 SP500 absents + 10 top307 absents
- Périmètre : 18 SP500 + 10 top307 = 22 tickers uniques (4 communs).
- Action : générer datasets v1.9 complets from scratch (KPI hero, stories, risks, repartition, governance, freshness).
- Tactique : reprendre le pipeline d'intégration v1.9 utilisé pour les 184 existants.
- ETA : 4-6 h (22 stés × ~15 min, mais parallélisable).

### Marginaux (l_hero_name_fr, m_freshness, i_events) — inline du #140
- 8-10 fixes triviaux à intégrer en fin de #140 (renommage FR, refresh dates, events).

## Séquencement optimal

```
Phase 1 (parallèle Cerebras, attention pic Mac) :
  #140 (g_governance) + #143 (intégrations 22 tickers)
  → débloque 289 SP500 + 186 top307 + 22 nouveaux
  → ETA 10h, ~$1.5 Cerebras

Phase 2 (séquentiel, après #140 stabilisé) :
  #141 (a_hero_history) puis #142 (stories + repartition)
  → débloque les 91 top307 + 168 SP500 a-f
  → ETA 12-14h
```

## ETA confidentielle 100%

| Cible | ETA cumulée |
| --- | --- |
| **Top 307 100% clean_all** | 16-20 h (governance + hero + stories + 10 intégrations) |
| **SP500 100% clean_all** | 22-26 h (governance + hero + stories + 18 intégrations) |
| **Union top307 ∪ SP500 (673 stés) 100%** | 24-28 h |
| Budget Cerebras estimé | ~$4-6 (sur $30 disponibles) |

## Notes méthodologiques

- Source de vérité : `src/data/v1-9-pre-publication-audit.json` (771 audits) généré ce run.
- Matching scope : exact ticker (top307-breakdown.json `.ticker` + sp500-tickers.json array).
- Aucune normalisation suffixe — les tickers EU gardent leur extension marché (`.PA`, `.L`, etc.).
- Exceptions exemptées comptabilisées correctement (caps `_hero_is_company_specific_legitimate` ≤ 10%, `unavailable_adr` < 15%, `heuristic_partial` ≤ 30% — tous OK).
- Sub-agents #131/#137/#138 réputés terminés au moment de l'audit (audit récupère leur output).
