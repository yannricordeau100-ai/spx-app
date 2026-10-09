# Rapport : consignes d'ajout de nouvelles sociétés (9 oct 2026)

## Livré (rien de commité ni de déployé de mon fait)
- `docs/CONSIGNES-NOUVELLES-SOCIETES.md` : source unique, environ 770 lignes. Les titres de niveau 1 servent d'onglets. Le marqueur `<!-- sous-onglets -->` range les titres de niveau 2 en sous-onglets.
- Les 8 onglets :
  1. Vue d'ensemble et checklist (9 étapes, commandes, durées)
  2. Blocs de fiche (25 sous-onglets : source, format, remplissage simple, process spéciaux, pièges, contrôle)
  3. Données hors bloc (16 sous-onglets)
  4. Agents de recherche (règles et gabarits)
  5. Nouveau pays ou nouvelle bourse (fiche pays et 15 tables codées en dur)
  6. Règles qualité
  7. Contrôles finaux, avec comparaison à NVDA et MC.PA
  8. Incohérences et trous
- Page `src/app/sandbox/consignes-societes/page.tsx` + `onglets.tsx` :
  - accès réservé au propriétaire, ou avec le jeton d'audit ;
  - rendu Markdown maison, sans dépendance ;
  - recherche dans tout le document ;
  - `?onglet=N` pour ouvrir directement un onglet.
- `src/app/sandbox/sandbox-client.tsx` : entrée ajoutée au menu de la sandbox. ATTENTION : une autre session l'a déjà commitée dans 2657027c50.
- `next.config.ts` : `outputFileTracingIncludes` pour `docs/CONSIGNES-NOUVELLES-SOCIETES.md`. Sans cela, le fichier est absent sur Vercel.
- `npx tsc --noEmit` passe avec 0 erreur. Rendu vérifié sur le serveur de développement : HTTP 200, onglets, sous-onglets, tableaux, encadrés et recherche fonctionnent.

## Trous et incohérences principaux (détail dans l'onglet 8)
1. `scripts/verif-societe.py` :
   - il exige les fichiers i18n en/de, alors que les traductions sont interdites : toute nouvelle société échoue ;
   - il teste le logo sous sa forme à point, alors que le site sert la forme à tirets ;
   - il cherche `src/data/societes-gics.json`, qui n'existe pas ;
   - il ne regarde ni Supabase ni l'index de recherche.
2. `daily-doc-watcher.py` lit `v1-9-pre-publication-audit.json` (25 mai) au lieu de la liste clean-all : 139 sociétés ne sont jamais surveillées. `/admin/blocks`, `fetch-filing-dates.py` et `build-ir-coverage.py` s'appuient aussi sur des listes figées.
3. La recherche exige une ligne `desk_curated_companies`, qu'aucune checklist ne mentionnait (`publish-online.ts`). BE, FDXF et FERG sont introuvables aujourd'hui.
4. Les blocs masqués écrits en JSON par `aexdax-onboard.py` sont sans effet, car la table `desk_disabled_blocks` est prioritaire dès qu'elle contient une ligne.
5. Le `hero_kpi` posé dans kpis-haut est ignoré par le chargeur. Seul l'override Supabase garantit le hero.
6. Les 12 KPI `WEB_*` de MC.PA n'ont pas de champ `frequency` : leur historique est vidé et seule la valeur est servie. Le gabarit d'injection web est à corriger.
7. Les trois tables d'alias divergent, par exemple `VOW3.DE`/`VOW.DE` inversés entre le proxy et le chargeur. La devise de cotation est fausse (en $) pour `.ST`, `.CO`, `.OL` et `.T`.
8. Fichiers globaux sans générateur ni couverture complète :
   - `employees.json` : 212 absents ;
   - `cours-fmp` : 393 ;
   - `evenements` : 402 ;
   - `kpi-annuel-fiche` : 145, presque tous hors US.
9. Aucune migration pour `desk_these`, `desk_kpi_pistes` et `desk_kpi_non_financiers`. R2 n'est pas implémenté.
10. Règles contradictoires à trancher par Yann :
    - TAM externe ou non ;
    - moyen terme : uniquement des sources externes ;
    - source visible dans le `signal` des KPI web ;
    - plafond d'agents ;
    - User-Agent de navigateur dans deux scripts ;
    - position IA « absent » ;
    - CLAUDE.md §2 et §8 périmés.
11. `.conv-state/ajout-societe-CHECKLIST.md` cite un `verif-societe.ts` inexistant et un mauvais chemin pour ATT-PROCEDURE. `docs/cahier/PROMPTS.md` fait écrire dans `src/data/companies/`, dossier que le site ne lit jamais.

## Corrections apportées aux conclusions des agents
- Ils affirmaient que les `WEB_*` de MC.PA étaient « invisibles ». C'est faux : ils sont servis, avec une valeur seule et sans historique (vérifié avec `fiche-sources.py`).
- Horaires : ceux de la crontab et des launchd réels ont été retenus (daily 12h05, earnings-refresh 14h00), pas ceux de la mémoire.

## À faire par la suite (non fait, hors périmètre)
- Corriger `verif-societe.py` (i18n, logo à tirets, GICS, Supabase, index).
- Basculer `daily-doc-watcher.py` sur clean-all.
- Ajouter `frequency` aux KPI `WEB_*`.
- Remplacer `.conv-state/ajout-societe-CHECKLIST.md` par un renvoi vers le nouveau document.
