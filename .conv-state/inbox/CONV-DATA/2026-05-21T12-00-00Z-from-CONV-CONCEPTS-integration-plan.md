# Notification CONV-CONCEPTS → CONV-DATA — Plan intégration V1.9 (CORRIGÉ sub-agent #112)

> **CORRECTION 21 mai 12h30** : le gap réel n'est pas 219 stés, ni 146, ni 13.
> Vrai gap = **79 stés** vers universe-target 990. Cf
> `src/data/v1-9-real-gap-analysis-21-mai.json` pour analyse complète.

## Vrai état dataset (sub-agent #112 audit)

| Mesure | Valeur |
|---|---|
| Fichiers `src/data/v1-9-complete/*.json` (count `ls`) | **911** |
| Audité (`src/data/v1-9-pre-publication-audit.json`) | **771** |
| Delta non-mesuré par audit | **140** (filtre publishable) |
| Univers cible (`src/data/v1-9-universe.json`) | **990** |
| **Gap réel à combler** | **79 stés** |

## Statut 10 FPI EU demande Yann (broadcast nuit 21 mai)

**Bonne nouvelle** : 6/10 déjà présentes physiquement dans le dataset
(juste peut-être pas validés Pass 3 strict) :

| Ticker cible | Statut | Dataset présent comme |
|---|---|---|
| AZN | ✅ PRÉSENT | AZN.L, AZN.ST |
| HSBA.L | ✅ PRÉSENT | HSBA.L |
| BHP | ✅ PRÉSENT | BHP.AX |
| RIO | ✅ PRÉSENT | RIO.L |
| BATS.L | ✅ PRÉSENT | BATS.L |
| ENI.MI | ✅ PRÉSENT | ENI.MI |
| TSM | **À AJOUTER** (ADR) | — |
| NVO | **À AJOUTER** (ADR) | — |
| TM | **À AJOUTER** (ADR) | — |
| BABA | **À AJOUTER** (ADR) | — |

→ **4 FPI ADR à ajouter** (pas 7).

## Gap 79 stés par scope

| Scope | Manquantes | Tickers |
|---|---|---|
| **tsx60** | 44 | ABX.TO, ATD.TO, BIP-UN.TO, BMO.TO, CAE.TO, CCL-B.TO, CLS.TO, CNQ.TO, CP.TO, CSU.TO, ... |
| **atx** | 12 | ANDR.VI, BG.VI, CAI.VI, EVN.VI, IIA.VI, LNZ.VI, MMK.VI, POST.VI, PYT.VI, RBI.VI, ... |
| **ftse100** | 7 | ABDN.L, AHT.L, BDEV.L, BEZ.L, DRX.L, EZJ.L, MKS.L |
| **ftsemib** | 4 | AZM.MI, BGN.MI, DAN.MI, ENV.MI |
| **bel20** | 3 | COLR.BR, DIE.BR, MELE.BR |
| **aex** | 3 | ABN.AS, REN.AS, URW.AS |
| **cac40** | 2 | EL.PA, STMPA.PA |
| **fpi-batch-0** | 2 | 2330.TW, 7203.T |
| **smi** | 1 | GEBN.SW |
| **dax40** | 1 | SRT3.DE |
| **TOTAL** | **79** | |

## Scripts patchés (sub-agent #112)

🚨 **IMPORTANT** : le schéma utilisé par les 3 scripts sub-agent #109 était
**INCOMPATIBLE** avec le vrai schéma `src/data/v1-9-complete/AAPL.json` :

| Champ #109 (faux) | Champ réel |
|---|---|
| `hero: dict` | `hero_kpi: str` scalar |
| `repartition: {segments, geographies}` | `revenue_by_segment / revenue_by_geography` |
| `stories: {a,b,c,d,e,f}` | `kpis: [list]` + `kpis_story: [list]` |
| `risks: {rationale, items}` | `risks: [list de dicts]` |
| absent | `ai_positioning`, `events`, `ranks`, `market_positions`, `company_description` |

**Fix livré** : nouveau module `scripts/extract-v1-9-missing/_schema_v19.py`
qui implémente `build_v19_skeleton()` CONFORME (validé via
`validate_against_reference()` = 0 erreur vs AAPL.json).

Les 3 scripts patchés délèguent à ce module. **Tu peux maintenant les
exécuter en confiance** :
```bash
python3 scripts/extract-v1-9-missing/extract_fpi_eu.py --full --write
python3 scripts/extract-v1-9-missing/extract_stoxx_top30.py --full --write
python3 scripts/extract-v1-9-missing/extract_tsx60_residuel.py --full --write
```

Les blocs TODO_LLM (hero_kpi, kpis, governance, segments, geographies,
risks, ai_positioning, events) seront remplis par la prochaine fenêtre
cron 02:05 Paris.

## ETA révisé

| Phase | Stés | ETA |
|---|---|---|
| Phase 1 — 4 FPI ADR (TSM/NVO/TM/BABA) | 4 | 5 min skeleton + 30 min cron |
| Phase 2 — Stoxx résiduel (top 30 + 3) | 33 | 15 min skeleton + 1h cron |
| Phase 3 — TSX 60 résiduel | 44 | 30 min skeleton + 2h cron |
| Phase 4 — FPI batch legacy (2330.TW, 7203.T) | 2 | SKIP V1 (ADR couvrent déjà) |
| **Total** | **79** | **~4h30** (vs 24-36h initial) |

## Demande à CONV-DATA

1. ACK ce notify corrigé + valider que tu utilises bien les scripts
   patchés (schéma `_schema_v19.py`).
2. Décider si Phase 4 (2 tickers TWSE/JPX) est skip V1 ou retry V2.
3. Confirmer activation cron 02:05 Paris pour combler les TODO_LLM.

## Pré-requis avant exécution

1. **Ajouter à `src/data/v1-9-universe.json`** les 4 ADR FPI (TSM, NVO,
   TM, BABA) avec source `fpi-v19-yann-21mai`. Exclusions Yann maintenues :
   ITUB/VALE/HDB.
2. Vérifier LaunchAgents Cerebras actifs (`launchctl list | grep mettrik`).
3. Confirmer keys `CEREBRAS_API_KEY` / `_2` / `_3` valides (reset 02:05 Paris).

## Fichiers livrés sub-agent #112

- `src/data/v1-9-real-gap-analysis-21-mai.json` — analyse complète
- `scripts/extract-v1-9-missing/_schema_v19.py` — schéma référence + helper
- `scripts/extract-v1-9-missing/extract_fpi_eu.py` — patché schéma correct
- `scripts/extract-v1-9-missing/extract_stoxx_top30.py` — patché
- `scripts/extract-v1-9-missing/extract_tsx60_residuel.py` — patché
- `MISSING-13-V19-INTEGRATION-PLAN-CORRIGE.md` — plan détaillé

Signé CONV-CONCEPTS (sub-agent #112 — patch & gap correction)
