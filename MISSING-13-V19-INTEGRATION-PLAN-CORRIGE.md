# MISSING V1.9 — PLAN INTÉGRATION CORRIGÉ (sub-agent #112, 21 mai 2026)

> Correction du précédent MISSING-146-V19-INTEGRATION-PLAN.md basé sur audit
> JSON tronqué (771 stés mesurées au lieu des 911 fichiers réellement présents).

## Vrai état dataset V1.9 (21 mai 12h30 Paris)

| Métrique | Valeur |
|---|---|
| Fichiers `src/data/v1-9-complete/*.json` | **911** |
| Mesurés par `v1-9-pre-publication-audit.json` | **771** (= `publishable_count_input`) |
| Delta non-mesuré (présent dataset mais hors audit) | **140** |
| Univers cible `src/data/v1-9-universe.json` | **990** |
| Gap réel vs univers cible | **79 stés** |

NB : l'estimation "924 cible / gap 13" du broadcast initial Yann était
basée sur une baseline tronquée (sans tsx60 + atx). Le fichier universe
canonique est 990.

## Pourquoi 140 stés non-mesurées par l'audit ?

Le script `scripts/audit-v1-9-pre-publication.js` lit son input depuis
`src/data/v1-9-publishable.json` (771 stés). Ce fichier publishable
applique vraisemblablement des filtres Pass 3 strict + scope canonical
(exclusion ADR doublons, cross-pollution, fit_for_site=false).

Échantillon des stés présentes physiquement mais non audité (10 premières)
: AAF.L, AAL.L, ABF.L, ABVX, AC.PA, ACKB.BR, ADM.L, ADS.DE, AED.BR, AIR.DE.
Toutes EU (.L / .PA / .BR / .DE) — cohérent avec hypothèse filtre publishable.

Le fix du filtre audit est hors-scope sub-agent #112 (cf scope du parent).

## Gap réel 79 stés par scope

| Scope | Présentes | Total | Manquantes | Liste manquantes (extrait) |
|---|---|---|---|---|
| **sp500** | 503 | 503 | **0** | (complet) |
| **top307** | 307 | 307 | **0** | (complet) |
| **ftse100** | 94 | 101 | 7 | ABDN.L, AHT.L, BDEV.L, BEZ.L, DRX.L, EZJ.L, MKS.L |
| **dax40** | 39 | 40 | 1 | SRT3.DE |
| **ftsemib** | 36 | 40 | 4 | AZM.MI, BGN.MI, DAN.MI, ENV.MI |
| **cac40** | 38 | 40 | 2 | EL.PA, STMPA.PA |
| **aex** | 22 | 25 | 3 | ABN.AS, REN.AS, URW.AS |
| **smi** | 19 | 20 | 1 | GEBN.SW |
| **bel20** | 17 | 20 | 3 | COLR.BR, DIE.BR, MELE.BR |
| **atx** | 8 | 20 | 12 | ANDR.VI, BG.VI, CAI.VI, EVN.VI, IIA.VI, LNZ.VI, MMK.VI, POST.VI, ... |
| **tsx60** | 16 | 60 | **44** | ABX.TO, ATD.TO, BIP-UN.TO, BMO.TO, CAE.TO, CCL-B.TO, CLS.TO, CNQ.TO, CP.TO, CSU.TO, ... |
| **fpi-batch-0** | 1 | 3 | 2 | 2330.TW, 7203.T |

**Total gap = 79**. (Pas 13. Pas 146.)

## Statut 10 FPI EU demande Yann (broadcast nuit 21 mai)

Cibles : TSM, NVO, TM, AZN, BABA, HSBA.L, BHP, RIO, BATS.L, ENI.MI.

| Ticker cible | Statut | Présent dans dataset comme |
|---|---|---|
| TSM | **ABSENT** (ADR US à ajouter) | — |
| NVO | **ABSENT** (ADR US à ajouter) | — |
| TM | **ABSENT** (ADR US à ajouter) | — |
| AZN | ✅ PRÉSENT | AZN.L, AZN.ST |
| BABA | **ABSENT** (ADR US à ajouter) | — |
| HSBA.L | ✅ PRÉSENT | HSBA.L |
| BHP | ✅ PRÉSENT | BHP.AX |
| RIO | ✅ PRÉSENT | RIO.L |
| BATS.L | ✅ PRÉSENT | BATS.L |
| ENI.MI | ✅ PRÉSENT | ENI.MI |

**Résumé** : 6/10 déjà présents, 4 ADR à ajouter (TSM, NVO, TM, BABA).
Pas 7 à ajouter comme estimé dans le broadcast initial.

## Stratégie d'intégration révisée

### Phase 1 — ADR FPI prioritaires (4 stés)

Script `scripts/extract-v1-9-missing/extract_fpi_eu.py` patché (schéma
corrigé sub-agent #112). Ces 4 stés (TSM, NVO, TM, BABA) sont les seules
ADR FPI manquantes du top 10 Yann.

ETA : 5 min skeleton yfinance + 30 min cron Cerebras pour combler les
TODO_LLM (hero_kpi, kpis, risks, governance, ai_positioning, segments,
geographies, events).

### Phase 2 — Stoxx résiduel EU (33 stés)

Tickers répartis sur 9 indices EU (cf table ci-dessus). Le script
`extract_stoxx_top30.py` couvre déjà 30 de ces 33 (les 3 manquants étant
dans les listes ATX / FTSE résiduelles non listées).

ETA : 15 min skeleton + 1h cron Cerebras LLM blocks.

### Phase 3 — TSX 60 résiduel (44 stés)

Plus gros chantier numérique. Le script `extract_tsx60_residuel.py`
couvre 52 stés (liste exhaustive, certaines déjà extraites du run
sub-agent #25 Phase 1).

ETA : 30 min skeleton + 2h cron Cerebras (sources cat-canadian souvent
JS-heavy, CONV-DEPAN scrape Chrome MCP requis pour 20 NO_SOURCE TSX).

### Phase 4 — FPI batch legacy (2 stés)

2330.TW (TSMC local TWSE) et 7203.T (Toyota local Tokyo). Hors scope
strict V1.9 V1 (sont déjà couverts via leurs ADR TSM, TM).

**Recommandation** : skip Phase 4 jusqu'à V2 (sources TWSE et JPX
difficiles à scraper sans pipeline dédié).

## ETA révisé

Cumul Phases 1+2+3 (sans Phase 4) :
- **Skeletons yfinance** : ~50 min total
- **Blocs LLM Cerebras** (cron 02:05 Paris) : ~3h (pas 24-36h)
- **Validation Pass 3 strict** + audit : ~30 min

**ETA global : 4h30** (vs 24-36h initialement estimés). Le gain vient
de la confirmation que 6/10 FPI sont déjà présentes (extraction Pass 1
+ 2 + 3 historique déjà faite) — il ne reste que les blocs LLM à
compléter pour atteindre publishable Pass 3.

## Corrections schéma scripts

Le `build_enrich_json()` des 3 scripts sub-agent #109 utilisait un
schéma INCOMPATIBLE avec le vrai schéma `v1-9-complete/` :

| Champ schéma original (#109) | Champ schéma réel (AAPL.json) |
|---|---|
| `hero: {dict}` | `hero_kpi: str` (scalar) |
| `repartition: {segments, geographies}` | `revenue_by_segment: {slices}` + `revenue_by_geography: {slices}` |
| `stories: {a,b,c,d,e,f}` | `kpis: [list]` + `kpis_story: [list]` |
| `governance: {_status, sec_local}` | `governance: {top_capital, top_voting, voting_structure_note}` |
| `risks: {rationale, items}` | `risks: [list of {title, category, quote, score}]` |
| absent | `ai_positioning: {stance, summary, evidence}` |
| absent | `events: [list]` |
| absent | `ranks: {global_world, global_us, sector, subsector}` |
| absent | `market_positions: [list]` |
| absent | `company_description: str` |

**Patch sub-agent #112** : nouveau module `scripts/extract-v1-9-missing/_schema_v19.py`
qui implémente `build_v19_skeleton()` conforme à AAPL.json (validé via
`validate_against_reference()` — 0 erreur).

Les 3 scripts (`extract_fpi_eu.py`, `extract_stoxx_top30.py`,
`extract_tsx60_residuel.py`) délèguent maintenant à ce module.

## Fichiers livrés sub-agent #112

- `src/data/v1-9-real-gap-analysis-21-mai.json` — analyse complète gap
- `scripts/extract-v1-9-missing/_schema_v19.py` — schéma référence + helper
- `scripts/extract-v1-9-missing/extract_fpi_eu.py` — patché
- `scripts/extract-v1-9-missing/extract_stoxx_top30.py` — patché
- `scripts/extract-v1-9-missing/extract_tsx60_residuel.py` — patché
- `MISSING-13-V19-INTEGRATION-PLAN-CORRIGE.md` — ce fichier
- `.conv-state/inbox/CONV-DATA/2026-05-21T12-00-00Z-from-CONV-CONCEPTS-integration-plan.md` — notify mis à jour
