# Spec rotation des KPI Stories au refresh trimestriel — Yann 12 juil 2026

À chaque nouveau trimestre publié (10-Q/10-K/8-K/ER/call) pour une sté, le bloc
Stories doit être RE-CURÉ, pas seulement complété.

## Principe
1. **Extraire les candidates du nouveau filing** : nouveaux chiffres marquants
   (lancements produits, jalons segments, records, deals, guidance chiffrée,
   buybacks/dividendes, capacité, adoption). Format = KPI story standard
   (short, name_fr, value, unit, yoy, signal ≤120c, description 150-300c,
   story_category, is_short_history:true, _source:"stories-filings",
   last_data_date du trimestre).
2. **Rafraîchir les stories conservées** : si une story existante porte sur un
   KPI re-publié ce trimestre (ex Backlog, MAU), mettre à jour value/yoy/
   signal/description avec le dernier chiffre. JAMAIS garder un chiffre
   périmé quand le filing donne le nouveau.
3. **Scorer la pertinence** de chaque story (anciennes + nouvelles) :
   - fraîcheur (trimestre du chiffre : plus récent = mieux)
   - matérialité (impact investisseur : record, inflexion, gros montant relatif)
   - unicité (pas de doublon thématique avec une autre story mieux notée)
   - narrative encore vraie (une story "lancement imminent" devenue fausse = retirer)
4. **Sélection finale** : garder 8-16 stories, réparties sur ≥3 catégories
   (Marché/Adoption/Capacité/Innovation/Capital/Segments). Les anciennes encore
   pertinentes RESTENT ; les périmées/faibles sont déplacées dans
   `_stories_archived` (jamais supprimées : traçabilité + réversibilité).
5. **Interdits** : inventer un chiffre ; retirer une story simplement parce
   qu'elle est ancienne si elle reste structurellement pertinente (ex moat,
   part de marché stable) ; em-dash ; anglais dans name_fr/signal/description.

## Écriture
- Fichier : `src/data/v2-pipeline/<t>.json` champ kpis[] (is_short_history)
  et/ou stories_kpis, archives dans `_stories_archived` (avec `archived_at`
  et `archived_reason` court).
- Validation post-rotation : `npx tsx scripts/audit-pages-full.ts <T>` doit
  rendre 0 issue S1/S2, et buildStories ≥3 catégories.

## Déclenchement
Le script cron (quarterly-refresh) NE fait PAS la rotation lui-même (LLM requis) :
il inscrit la sté dans `.conv-state/quarterly-refresh-todo-llm.json` avec
`"stories_rotation": true` + le chemin du nouveau filing. La conv Claude
traite ensuite ce todo par lots d'agents (mêmes règles que les chantiers de
juillet 2026).
