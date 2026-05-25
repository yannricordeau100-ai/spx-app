# Mission KPI Verification Exhaustive v3

**Mandant** : Yann, 25 mai 2026 ~03h40
**Owner** : CONV-CONCEPTS (initial scan + script architecture)
**Status** : Phase 1 (scan) terminée, Phase 2 (extraction LLM) à dispatcher

## Objectif

Pour chaque sté clean_all (audit V1.9 = 629 stés), vérifier qu'aucun KPI
disclosé par la sté dans ses documents publics (10-K, 10-Q, 8-K, DEF14A,
20-F, 6-K, annual-text, half-year, ad-hoc, IR-presentations, ESG,
transcripts) n'a été manqué par l'extraction LLM précédente.

## Anti-doublon scope STRICT

- **N'écrit JAMAIS** dans `src/data/v2-pipeline/<t>.json` (scope CONV-DATA, autoritaire pour KPIs principaux)
- **N'écrit JAMAIS** dans `src/data/v2-pipeline-enrich/<t>.json` (scope sub-agent parallèle `a835a9aea0c20825f`, blocs f_repartition + g_governance + etc.)
- **N'écrit QUE** dans `src/data/v2-pipeline-enrich/<t>.kpis-v3.json` (nouveau fichier dédié)

## Phase 1 — SCAN (terminée 25 mai)

Script : `scripts/verify-kpis-v3/scan-kpis.py`

Action : pour chaque ticker clean_all :
1. Lit l'état actuel (`v2-pipeline/<t>.json` + `v2-pipeline-enrich/<t>.*.json`)
2. Charge le manifest local (`sec-data/_manifests/<TICKER>.json`)
3. Détecte les buckets sectoriels (banks, pharma, tech, semis, retail, energy,
   industrials, insurance, hospitality, utilities, reit, mining, aerospace, luxury)
4. Scanne les sources locales (jusqu'à 5 docs, 1.5 MB chaque) pour les
   keywords KPI sectoriels
5. Filtre fuzzy : skip si déjà présent dans KPIs extraits (token overlap ≥ 60%)
6. Retient candidats avec ≥3 mentions cumulées dans les sources

Résultat scan global : **199/629 stés** ont au moins 1 KPI candidat manquant,
**291 candidats** au total. Détail : `src/data/v1-9-kpis-v3-scan.json`.

## Phase 2 — EXTRACTION LLM (à dispatcher)

Pour chaque candidat KPI :
1. Charger 2-3 sources locales (le 10-K récent + le 10-Q + le DEF14A)
2. Prompt Cerebras Qwen-3 235B free (3 keys rotation, sleep 5s) STRICT :
   ```
   Société : {name} ({ticker})
   KPI à extraire : {kpi_name}
   
   Format JSON STRICT :
   {{
     "value": <number|null>,
     "unit": "<unit>",
     "history": [<5 years values>],
     "yoy": "<+X%>",
     "source": "<10-K 2024 p.42>"
   }}
   
   RÈGLES :
   1. null SI non chiffré explicitement dans le filing fourni
   2. JAMAIS d'invention, JAMAIS d'extrapolation
   3. history sur 5 ans (year+0 = plus récent)
   4. Mention count ≥5 dans la source pour confirmer
   
   Extrait du filing : <ctx>
   ```
3. Anti-hallucination : vérif manuelle nom canonique dans le filing,
   mention count ≥5
4. Si OK : append au fichier `src/data/v2-pipeline-enrich/<ticker>.kpis-v3.json`
   format :
   ```json
   {
     "ticker": "WYNN",
     "_kpis_v3_extracted_at": "2026-05-25T...",
     "_kpis_v3_source": "Cerebras qwen-3-235b-a22b-instruct-2507",
     "kpis": [
       {
         "short": "RevPAR",
         "name_en": "Revenue per Available Room",
         "name_fr": "Revenu par chambre disponible",
         "value": 246.5,
         "unit": "$",
         "history": [185, 142, 210, 235, 246.5],
         "yoy": "+4.9%",
         "type": "Operating",
         "source_file": "cat1-us/10K/2022/WYNN_2022-02-28.htm.gz",
         "mention_count": 6
       }
     ]
   }
   ```

## Phase 3 — INTÉGRATION SSR (à faire)

Patch `src/lib/v1-7/load-company.ts` pour merge auto les `.kpis-v3.json`
sur les KPIs visibles, en append-only (skip si `short` déjà présent côté
v2-pipeline). Voir comment CONV-DIV V1 a patché load-company.ts pour
merger `enrich.kpis` (commit ref dans SHARED-STATUS log 2026-05-09 21:05).

## Top 25 candidats par mentions (les plus prometteurs)

Voir `src/data/v1-9-kpis-v3-scan.json` ou run :
```bash
python3 -c "
import json
with open('src/data/v1-9-kpis-v3-scan.json') as f:
    r = json.load(f)
cands = [(x['ticker'], c['name'], c['mentions']) for x in r['results']
         for c in (x.get('candidates') or [])]
cands.sort(key=lambda c: -c[2])
for t, k, m in cands[:25]:
    print(f'{t:10s} {k:35s} ({m} mentions)')
"
```

Top : NWS/NWSA Subscribers (73), INVH FFO (67), MRNA Pipeline Phase 3 (66),
RRC/FANG/APA/OXY Reserves boe, PSA/DOC FFO, VRTX/ARGX Pipeline Phase 3,
LMT Backlog (38).

## Limites connues

1. **Buckets sectoriels incomplets** : 14 buckets actuels couvrent les
   secteurs majeurs (banks, insurance, pharma, semis, tech, retail, energy,
   industrials, hospitality, utilities, reit, mining, aerospace, luxury).
   À étendre pour : food/beverages, chemicals, transport (rail/shipping),
   defense (séparé d'aerospace), media/entertainment, payments/fintech.

2. **Pattern duplication** : "Reserves (boe)" et "Reserves (oz/Mt)" matchent
   le même pattern → dédupliquer. Faire un pass post-scan pour merge
   candidats avec patterns identiques.

3. **Window 1.5 MB** : couvre 90% des 10-K mais peut rater du contenu
   dans la 2e moitié de gros 10-K (>3 MB). À monter à 3 MB si besoin
   (impact mémoire faible).

4. **1 seul doc par type** : le manifest contient `latest_path` uniquement,
   on rate les sources historiques (annuels N-1, N-2). Pour les KPI
   history sur 5 ans, l'extraction LLM devra charger plusieurs annuels.

## Relance batch en autonomie

```bash
# Scan complet (idempotent, peut être relancé)
python3 scripts/verify-kpis-v3/scan-kpis.py --batch 629

# Scan ciblé
python3 scripts/verify-kpis-v3/scan-kpis.py --tickers NVDA,GOOGL,AAPL

# Phase 2 (à implémenter) : extraction LLM
# python3 scripts/verify-kpis-v3/extract-kpis-cerebras.py --batch 50
```

## RAM monitoring

Le scan est I/O-bound (lecture fichiers .htm.gz décompressés). RAM ~80 MB
par proc Python. Multi-procs OK (max 3-4 simultanés conformément à
règle §14 RAM Mac).

L'extraction LLM Phase 2 sera également peu coûteuse en RAM (~50 MB par
proc Cerebras call), mais limitée par rate-limit Cerebras free (30 req/min
par key × 3 keys = 90 req/min total). Sleep 5s recommandé.
