# État audit V1.9 après-midi 21 mai (sub-agent #130 snapshot)

Snapshot effectué : 2026-05-21 13h10 local.

## Bilan global session

Référentiels :
- baseline matin (avant #122) : clean a-f ≈ 90, clean a-f+g-m ≈ 53
- baseline pre-#128 (commit `f8fa69f39` audit gap) : clean_af = 345, clean_all = 61
- snapshot #130 (post-#128 batch 1) : **clean_af = 355, clean_all = 63**

Mesures clés (771 tickers publishable cible) :

| Indicateur                  | Baseline matin | Pre-#128 | #130 snapshot | Δ session |
|-----------------------------|----------------|----------|---------------|-----------|
| Clean a-f publishable       | 90             | 345      | **355**       | +265      |
| Clean a-f + ext g-m         | 53             | 61       | **63**        | +10       |
| d_stories KO                | n/a            | 233      | **222**       | -11       |
| a_hero_history KO           | n/a            | 152      | **152**       | 0 (en cours #123) |
| f_repartition KO            | n/a            | 135      | **135**       | 0         |
| b_interpretation KO         | n/a            | 26       | 26            | 0         |

Distribution par nombre de critères a-f failed :
- 0 failed : **355**
- 1 failed : 307
- 2 failed : 94
- 3 failed : 13
- 4 failed : 2

Extensions qui échouent (top) :
- `g_governance` : 609 stés (79.0 %)
- `m_freshness` : 16
- `k_ranks` : 8
- `i_events` : 7
- `l_hero_name_fr` : 7

Cohort breakdown (heuristique sur audit JSON) :
- Top 307 (avec market_cap_usd connu, 297 mappés) : **146 clean a-f**, 30 clean all
- US no-dot (proxy SP500, 561 stés) : **286 clean a-f**, 52 clean all
- EU/Asie (avec suffixe, 210 stés) : 69 clean a-f, 11 clean all

## État sub-agents en cours

| # | Job                                | Process               | Progress              | ETA résiduel |
|---|------------------------------------|-----------------------|-----------------------|--------------|
| 123 | Hero segment US (Cerebras paid)  | pid 96999 (KEY_INDEX=2) | 30/97 (HTTP 429 backoff fréquents, rotation key) | ~30-45 min (limité par rate-limit) |
| 128 | d_stories scaleup résiduel #2    | déjà committed batch 1 (560d22697, 65 enrich files) | batch 1 done, batch 2 ? | inconnu (process Python plus visible) |
| 129 | Investigation gap clean_all      | mission lecture (aucune écriture) | n/a              | n/a          |
| 130 | (ce sub-agent) consolidation     | en cours              | rapport en cours       | < 5 min      |

Confirmation : un seul process Python Cerebras tournait au moment du snapshot (`hero-segment-cerebras/extract_hero_segment_paid.py`, key_idx=2). #128 a déjà committé sa batch 1 il y a < 1 min, ce qui a vidé le working tree de ses 65 fichiers enrich.

## Working tree post-#128

Avant snapshot : 1073 fichiers modifiés, dont 65 v2-pipeline-enrich orphelins.
Après commit #128 batch 1 (560d22697) : **plus aucun fichier v2-pipeline-enrich/ non-committé**.

Reste en working tree (n'a PAS été touché par #130 — interdit par scope) :
- 911 fichiers `src/data/v1-9-complete/<TICKER>.json` (i18n EN fill via `i18n-fill-deterministic.js`) — INTERDIT, CONV-DATA strict
- 28 `src/data/v2-pipeline/*.json` — INTERDIT, CONV-DATA strict
- 2 `src/data/v2-pipeline-specific-kpis/*.json` — non listé dans scope, ignoré
- scripts modifiés (`i18n-fill-deterministic.js`, `scaleup_residuel_dstories.py`) — INTERDIT (scope dit "sauf si bug détecté")
- divers JSON top-level (`kpi-history-*`, `v1-9-blocked`, `v1-9-missing-blocks`, `v1-9-publishable`, `v1-9-repartition-notify-data`) — non listés dans scope, ignoré
- inbox CONV-DATA déplacé vers `read/` — ne concerne pas #130

#130 commit : uniquement `src/data/v1-9-pre-publication-audit.json` (autorisé) + ce fichier markdown (autorisé).

## Commits récents (dernière heure)

```
560d22697  feat(stories): Cerebras paid d_stories scaleup résiduel #2 batch 1 (#128)
f8fa69f39  audit(v1-9): gap clean_af vs clean_all breakdown — 284 stés, 99.6% g_governance
5e660fe94  feat(audit): merge enrich repartition with single_segment/single_region_legitimate (#127)
0af894756  feat(v1-9): page live publishable clean a-f+g-m avec filtres scope/sector
f9441b8a0  notify: CONV-CONCEPTS-sub122 → CONV-CONCEPTS (normal)
b23ab77fc  feat(repartition): Cerebras paid f_repartition extraction (#122) top 307 + SP500
aa0d6c3f1  urgent(quality): rollback hallucinations #121 Cerebras paid massif (#125)
2d5cafbf9  urgent(quality): hallucination audit + domain filter for stories backfill (#124)
e176ccec6  feat(stories): Cerebras paid scaleup résiduel d_stories batch 5 final (#121)
86658eb16  feat(stories): Cerebras paid scaleup résiduel d_stories batch 4 (#121)
```

## Top 10 stés clean a-f par market cap

| Ticker  | MC (Mds $) | Clean all-ext |
|---------|------------|---------------|
| NVDA    | 5 710      | non (g_governance) |
| GOOGL   | 4 859      | non (g_governance) |
| AAPL    | 4 380      | non (g_governance) |
| AVGO    | 2 082      | non (g_governance) |
| TSLA    | 1 665      | non (g_governance) |
| LLY     | 898        | non (g_governance) |
| MU      | 875        | non (g_governance) |
| JPM     | 804        | non (g_governance) |
| ASMLF   | 660        | **OUI**       |
| V       | 613        | non (g_governance) |

Le bottleneck pour clean_all reste massivement `g_governance` (609 stés KO sur 771, 79%).

## Top 20 stés à fixer en priorité (1-2 critères manquants)

```
GOOG   MC=4812 → d_stories
MSFT   MC=3041 → a_hero_history
ASML   MC=660  → a_hero_history
UNH    MC=362  → a_hero_history
NVS    MC=320  → d_stories
GE     MC=305  → d_stories
C      MC=213  → a_hero_history
VZ     MC=197  → a_hero_history
PANW   MC=193  → d_stories
TTE.PA MC=188  → d_stories
BA     MC=181  → d_stories
BTAFF  MC=179  → d_stories
BLK    MC=171  → d_stories
T      MC=171  → a_hero_history
IBKR   MC=150  → d_stories
CRM    MC=137  → d_stories
UL     MC=135  → d_stories
PLD    MC=133  → d_stories
BBVXF  MC=127  → f_repartition
BKNG   MC=120  → d_stories
```

## Recommandations post-completion

1. **Attendre fin de #123 (hero segment US)** avant nouvelle commit batch — actuellement bloqué par HTTP 429, ~30-45 min. Sortie attendue : couvrir 97 stés US clusters, déclencher recul de `a_hero_history KO` sous 140.
2. **Lancer batch 2 #128 d_stories scaleup résiduel** dès que #123 est fini (un seul process Cerebras à la fois pour éviter rate-limit cumulatif). Cible : `d_stories KO` < 200.
3. **g_governance reste le bottleneck systémique** (609 KO). Considérer un nouveau sous-agent Cerebras paid gov-extraction dédié EU/Asie après #123 + #128.
4. **Working tree v1-9-complete diff massif (911 fichiers, i18n EN fill)** — appartient à CONV-DATA. Demander à CONV-DATA si ce diff doit être committé ou rollback. #130 n'y touche pas.
5. **Audit re-run** : relancer après chaque batch commit, et particulièrement après fin de #123.

## Système (snapshot rapide)

- 1 process Python Cerebras actif (pid 96999, KEY_INDEX=2, 0% CPU au moment du snapshot car en backoff)
- vm_stat : 17971 pages free (~280 Mo libres), 275k actives. RAM tendue mais pas saturée.
- Aucun process node/python concurrent lourd détecté.

— sub-agent #130 (consolidation, sans Cerebras)
