# Top 10 stés témoin — workflow freeze

Édicté par Yann le 29 mai 2026 (Phase 3B restructure). **Permanent.**

## Liste canonique

10 stés témoin (top market cap monde) : **NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, V, JPM, BRK-B**.

## Workflow freeze

1. **Validation visuelle** : Yann inspecte la page sté complète sur niveau2 (`https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/<lowercase>?audit_token=...`) et confirme que tous les blocs sont OK (hero KPI, indicateurs clés, stories, risques, gouvernance, AI positioning, répartition CA, events).

2. **Promote snapshot** : copier `tests/golden/snapshots-proposed/<t>.proposed.json` vers `tests/golden/snapshots/<t>.golden.json`. Le fichier `.golden.json` devient la référence figée.

3. **Test de régression** : `npm run test:golden` compare le rendu live niveau2 vs `.golden.json`. Tolérances : hero value ±5%, yoy ±2 pts, capi ±10%, name/unit/top4 exact match. Toute divergence bloque le merge.

4. **Scale-up progressif** : après validation 10/10 stés témoin, scaling vers SP500 (~493 stés) par batches validés. Puis Stoxx 600 (~316 stés EU). Total cible ~810 stés freeze à terme.

5. **Régression bloquante** : si une sté ne valide pas (data fake, unit mismatch, hero suspect), fix data PRIORITAIRE avant toute extension de scope. Pas de "scale ahead with broken témoins".

## Lien data canonique

Les snapshots golden lisent `src/data/companies/<t>.json` (source unique Phase 3A, commit 0bc94b68c) consolidée à partir de `v2-pipeline/` + `v2-pipeline-enrich/`.

## Pipeline complet

```
src/data/v2-pipeline/<t>.json (base CONV-DATA)
+ src/data/v2-pipeline-enrich/<t>.*.json (enrichments)
   ↓ build-companies-unified.ts (idempotent ~12s)
src/data/companies/<t>.json (source unique Phase 3A)
   ↓ src/lib/v1-7/load-company.ts
Page sté /sandbox/v1-9-5/<t> rendu SSR
   ↓ Playwright (tests/golden/spec.ts)
Compare vs tests/golden/snapshots/<t>.golden.json
   ↓ PASS / FAIL
```

## Pourquoi ce workflow

Yann a observé historiquement (mai 2026) :
- 75 stés avec hero KPI hallucinés (history fake monotone)
- 209 stés SP500 reverify avec 85% d'inventions LLM
- Cross-pollution ticker→IR (DG.PA = Virbac, SGSN.SW = battery report chinois, etc.)
- Rangs faussement attribués #1 mondial (TSLA, JPM, OR.PA, BLK, BRK-B)
- Units systématiquement faux ("Mds $" sur ratios %, counts users, growth rates)

Le top 10 freeze est la garantie qu'au moins les stés les plus visibles de la démo investisseurs (baggr.fr / iq-invest) restent propres en permanence.
