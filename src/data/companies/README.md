# `src/data/companies/` — source unique par sté (Phase 3A)

Chaque fichier `<ticker>.json` est un artefact **généré automatiquement** qui
consolide :

- `src/data/v2-pipeline/<ticker>.json` (base, scope CONV-DATA)
- `src/data/v2-pipeline-enrich/<ticker>.<subkey>.json` (enrichments séparés)

## ⚠️ NE PAS ÉDITER MANUELLEMENT

Toute modification doit se faire dans les sources :

- KPIs / risks / governance / hero / etc. → `src/data/v2-pipeline/<ticker>.json`
  (scope **CONV-DATA strict**).
- Enrichissements (events, ai-pos, tam, ranks, description, i18n,
  quarterly-history, kpis-v3, hero_name_fr, etc.) → `src/data/v2-pipeline-enrich/`.

Puis re-générer ce dossier via :

```bash
npx tsx scripts/build-companies-unified.ts
```

## Statut Phase 3A migration

- ✅ Source unique générée pour ~2270 stés.
- ✅ `v2-pipeline/` et `v2-pipeline-enrich/` **restent autoritaires** pour les
  writes (scope CONV-DATA / enrichers existants inchangés).
- ✅ `src/lib/v1-7/load-company.ts` lit en priorité ce dossier si présent,
  sinon fallback sur le merge runtime (compatibilité backwards).
- ❌ Suppression des sources **NON prévue** dans cette phase. Migration
  progressive.

## Format

Le JSON unifié reprend la structure du fichier `v2-pipeline/<ticker>.json` puis :

- Ajoute (append-only) les clés du `v2-pipeline-enrich/<ticker>.json` racine
  (sans écraser les champs existants côté base).
- Range les sous-fichiers nommés sous `enrich_<subkey>` :
  - `enrich_events`, `enrich_ranks`, `enrich_description`,
    `enrich_ai_pos` / `enrich_ai_positioning`, `enrich_tam`,
    `enrich_hero_name_fr`, `enrich_i18n`, `enrich_quarterly_history`,
    `enrich_kpis_v3`, etc.
- Ajoute les metadata `_companies_unified_built_at` (ISO) et
  `_companies_unified_sources` (paths utilisés).

## Lecture côté code

`src/lib/v1-7/load-company.ts` tente d'abord `companies/<ticker>.json` :
si présent et frais, il sert de raccourci ; sinon le merge runtime historique
(plusieurs `readJsonOrNull` séparés) reste actif.
