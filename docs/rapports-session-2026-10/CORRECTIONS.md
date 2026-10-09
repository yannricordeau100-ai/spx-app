# Corrections des fuites publiques (« tout A »), 8 octobre 2026

Rien n'est commité ni déployé. La production ne changera qu'après ton déploiement (niveau2 puis go-n0).
Vérifications faites : `npx tsc --noEmit` = 0 erreur ; code client public regroupé par esbuild + chargeur d'assainissement = 0 rouge, 0 orange ; pages `/`, `/pricing`, `/nvda`, `/mc.pa`, `/spcx` et API testées sur un serveur local ; règles du proxy testées avec l'en-tête Host `mettrik.ai` puis `mettrik-niveau2.vercel.app`.

## 1. Les 24 lignes

| # | Fait ? | Comment | Fichier(s) |
|---|---|---|---|
| 1 | SQL prêt, **pas appliqué** | Politique de lecture anonyme des codes promo supprimée. La validation passe déjà par la clé service (`validatePromoCode`). Le jeton Supabase du `.env.local` est en lecture seule (erreur `database_migrations_write`) : **coller le SQL dans l'éditeur SQL de Supabase** | `supabase/migrations/20261008_fermeture_lecture_anonyme.sql` |
| 2 | SQL prêt, pas appliqué | Lecture anonyme de `desk_page_content` supprimée en entier, plus stricte que l'option A. Les 30 lecteurs passent tous par la clé service (vérifié fichier par fichier) | même migration |
| 3 | SQL prêt, pas appliqué | Même correctif que la ligne 2 | même migration |
| 4 | SQL prêt, pas appliqué | Lecture anonyme de `desk_curated_companies` supprimée. La route admin `/api/desk/curated-companies` lisait et écrivait avec la session : elle passe à la clé service une fois le propriétaire vérifié | migration + `src/app/api/desk/curated-companies/route.ts` |
| 5 | SQL prêt, pas appliqué | RLS activée sur `desk_kpi_non_financiers` et `desk_kpi_pistes`. `desk_referral_settings` est fermée aussi : `/parrainage`, `/api/referrals` et la route admin lisent avec la clé service | migration + `src/app/parrainage/page.tsx`, `src/app/api/referrals/route.ts`, `src/app/api/desk/referrals-settings/route.ts` |
| 6 | Fait | `/api/online-tickers` répond 404 sans session admin ou jeton d'audit. La recherche publique passe par la nouvelle route `/api/recherche-societes?q=` : 10 résultats au plus, sans saisie les 10 plus grosses capitalisations | `src/app/api/online-tickers/route.ts`, `src/app/api/recherche-societes/route.ts`, `src/lib/recherche-societes.ts` |
| 7 | Fait | L'accueil ne transmet plus ni liste ni total : plus de `tickers`, plus de `searchScope`, plus d'import de `clean-all` dans `home-view` | `src/app/sandbox/v1-9-5/page.tsx`, `src/components/home-view.tsx` |
| 8 | Fait | `company-search.tsx` n'importe plus aucun JSON. La recherche est calculée par le serveur avec le même score et le même ordre capi | `src/components/company-search.tsx`, `src/lib/recherche-societes.ts`, `src/lib/ticker-dedup-aliases.ts` |
| 9 | Fait | Même correctif que la ligne 8 | idem |
| 10 | Fait | L'index des héros reste sur le serveur. Seuls les héros des 10 résultats affichés partent au navigateur | idem |
| 11 | Fait | `home-gics-block` n'importe plus le JSON. Le serveur n'envoie que les nombres affichés (total par industrie et total général). Le nombre de sociétés au survol est retiré. `KpiCountersRow`, qui embarquait `_kpi-counts.json`, est supprimé (il n'était plus affiché) | `src/components/home-gics-block.tsx`, `src/lib/comptes-gics-public.ts`, `src/app/page.tsx`, `src/components/home-view.tsx` |
| 12 | Fait | Le panneau admin n'est plus dans le JS commun : il est chargé dynamiquement hors de mettrik.ai. Infobulles réécrites sans prénom ni description d'infrastructure, plus aucun nom d'hôte en dur, plus de liste de routes internes | `src/components/admin-floating-panel-loader.tsx`, `admin-floating-panel.tsx`, `level-badge.tsx`, `src/app/layout.tsx`, `src/lib/i18n/lang-picker-visibility.ts`, `src/lib/desk/use-effective-tier.ts`, `src/lib/desk/effective-tier-shared.ts` |
| 13 | Fait (autrement) | Je n'ai pas créé de projet Vercel séparé. La liste venait du « routage optimiste » de Next 16, désactivé (`experimental.optimisticRouting: false`) : les fiches n'envoient plus l'arbre des routes. Même effet, sans migration | `next.config.ts` |
| 14 | Fait, permanent | Nouveau chargeur appliqué au build à tout `src/data/*.json` importé par du code navigateur. Il retire `_doc`, `_note*`, les commentaires et toute clé `_…` qui cite le prénom, un chemin ou un script. Le serveur lit toujours les fichiers complets | `src/build/assainir-json-client.cjs`, `next.config.ts` (`turbopack.rules`) |
| 15 | Option B | La protection Vercel n'a pas été posée : elle aurait bloqué les scripts qui lisent niveau2 (health, verif-release, export PNG, golden). À la place, le proxy renvoie 404 sur `/sandbox`, `/admin`, `/desk-…`, `/concepts`, `/chart-lab`, `/email-lab`, `/whoami`, `/faq` et `/populaire-investisseurs` sur toute préversion. Passent seulement : ta session admin (propriétaire ou mettrikai@gmail.com), le jeton d'audit, le poste local. Testé : 404 en anonyme, 200 avec le jeton | `src/proxy.ts` |
| 16 | Fait | `/api/billing/health` renvoie `{ok:true}` (200, les contrôles de disponibilité marchent toujours). Le détail Stripe est réservé aux admins et au jeton d'audit | `src/app/api/billing/health/route.ts` |
| 17 | Fait | « Plus de 600 » partout : grille en base (Premium et Max, `pricing_plan_features` mis à jour), textes de secours, cartes tarifs, FAQ tarifs, encart de l'accueil (« Des milliers d'actions »), page hub, e-mail de confirmation (FR, EN, DE). Garde-fou dans `loadPricingCatalog` : toute valeur « 1 000 » sur cette ligne est remplacée | `src/lib/billing/load-pricing.ts`, `plans.ts`, `pricing-cards.tsx`, `dictionary.ts`, `home-view.tsx`, `email-lab/translations.ts`, `email-templates/confirm-signup.html`, `concepts/pricing-v2/page.tsx` |
| 18 | Fait | La valeur « Gratuit » de la ligne Sociétés est **calculée** à partir de `/api/visibles-gratuit`, classes d'actions fusionnées : 5 aujourd'hui (Alphabet, Netflix, Realty Income, TotalEnergies, LVMH). « Google + Meta » est retiré des textes de secours | `src/lib/billing/load-pricing.ts`, `pricing-cards.tsx`, `plans.ts` |
| 19 | Laissé (option A) | Nécessaire au floutage, sans donnée sensible | aucun |
| 20 | Fait | Les sources externes et l'effet de change sont joints côté serveur à la seule société affichée. En gratuit et en anonyme, les noms des sources ne partent plus : seulement des libellés neutres, liste floutée comme avant | `src/lib/donnees-fiche-client.ts`, `src/lib/data.ts` (type), `sources-externes.tsx`, `repartition-block.tsx`, `company-view.tsx`, les 2 pages fiche |
| 21 | Fait | Toute clé `_…` est retirée de `/api/popular-stocks`. Le filtrage sur l'univers en ligne passe côté serveur (`home-popular-block` n'importe plus la liste) | `src/app/api/popular-stocks/route.ts`, `src/components/home-popular-block.tsx` |
| 22 | Fait | `/desk-`, `/whoami` et `/_not-found-desk` retirés de robots.txt | `src/app/robots.ts` |
| 23 | Fait | En-têtes `x-mettrik-*` posés seulement hors mettrik.ai (testé) | `src/proxy.ts` |
| 24 | Fait | Le champ `generation` (« scripts/… ») est retiré par le chargeur. Les listes de logos (516 et 1 012 tickers) partent en empreintes : la liste n'est plus lisible, l'affichage est inchangé | chargeur + `src/lib/empreinte-ticker.ts`, `src/components/logos.tsx` |

Autres corrections :
- **support_tickets et support_messages** : la RLS était **désactivée**. Avec la clé anonyme, on pouvait lire **et écrire** les tickets clients, données personnelles comprises (tables vides aujourd'hui). RLS activée dans la même migration.
- `desk_releases`, `companies_v2` et `companies_v2_i18n` n'ont plus de lecture anonyme. Elles ne sont lues que par le serveur.
- Paywall : le lien par défaut ne pointe plus vers `/sandbox/billing` mais vers `/pricing`.

## 2. Garde-fous permanents (les prochaines versions)

- `scripts/verif-release.py`, nouveau bloc 10 « Fuites » (go-n0.sh refuse la promotion si un feu est rouge) :
  - a) `verif-fuites-publiques.mjs https://mettrik-niveau2.vercel.app --previews` (rouge si un rouge). Le script couvre les pages, tous les chunks (point fixe sur 6 passes), les API, robots, les en-têtes, l'outillage des préversions (404 attendu) et **toutes** les tables Supabase. La liste des tables est lue dans la description OpenAPI avec la clé anonyme : une nouvelle table ouverte est détectée sans toucher au script. Les constats sur niveau1 restent en orange (ancien déploiement, voir § 4).
  - b0) `--source` : regroupe avec esbuild tout le code client public, avec le même chargeur que le build, puis l'analyse. Sans `next build`, quelques secondes.
  - b) `--static .next-audit` (ou `.next`) : tout `static/` d'un build local, s'il existe. Rouge pour les fichiers atteignables depuis une route publique, orange pour le reste.
  - c) Rouge si une table du schéma `public` n'a pas la RLS.
- Nouveaux motifs du script : `_note`/`_doc`, noms d'hôtes `mettrik-niveau*` (passés en rouge), `/api/recherche-societes` limitée à 10 résultats, `/api/billing/health` réduit à `{ok}`, `/api/online-tickers` fermée.
- Chargeur `src/build/assainir-json-client.cjs`, placé hors de `/scripts` parce que `.vercelignore` exclut ce dossier du déploiement : il s'applique automatiquement à tout nouveau JSON importé par du code navigateur.

## 3. Audit « tout le code public téléchargé »

- **Build local impossible sur le Mac** : `next build` a été tué deux fois, une fois par le système (code 137), une fois par mon garde-fou mémoire (swap au-dessus de 13,8 Go). J'ai pris un équivalent :
  - **code navigateur public** : 158 composants client des routes publiques regroupés par esbuild, chargeur d'assainissement appliqué, sorties minifiées comme en production. **0 rouge, 0 orange** : plus de liste de plus de 300 tickers, plus de compte d'univers, plus de `_note`/`_doc`, plus de prénom, courriel ou nom d'hôte.
  - **HTML et RSC** (serveur local, en anonyme) de `/`, `/pricing`, `/nvda`, `/mc.pa`, `/spcx` : plus de liste de tickers ni de `"total":662`, plus d'arbre des routes, sources externes neutralisées en anonyme. Les `promo_note` et `source_note` trouvés sont des champs de contenu, pas des notes internes.
  - **API** : `recherche-societes` (10 résultats au plus, vérifié), `billing/health` = `{ok:true}`, `online-tickers` = 404, `popular-stocks` sans `_meta`.
- **Proxy** (testé avec l'en-tête Host) : `/sandbox`, `/concepts`, `/admin`, `/desk-…` et `/chart-lab` répondent 404 sur mettrik.ai et sur niveau2 en anonyme, 200 sur niveau2 avec le jeton d'audit. Aucun en-tête `x-mettrik-*` sur mettrik.ai.
- **Supabase anonyme** : les 4 tables ci-dessous resteront lisibles tant que la migration n'est pas collée.
- **À refaire après ton déploiement niveau2** : `python3 scripts/verif-release.py` (bloc Fuites), ou directement `node scripts/verif-fuites-publiques.mjs https://mettrik-niveau2.vercel.app --previews`. Lancé aujourd'hui sur l'ancien niveau2 : 41 rouges, tous corrigés dans le code ou par la migration.

## 4. Ce qui reste visible, et pourquoi

| Élément | Pourquoi |
|---|---|
| **Tables Supabase** `pricing_promo_codes`, `desk_page_content` (dont ton courriel), `desk_curated_companies`, `desk_referral_settings`, `desk_kpi_non_financiers`, `support_*` | Migration non appliquée : jeton en lecture seule. Coller `supabase/migrations/20261008_fermeture_lecture_anonyme.sql` dans l'éditeur SQL Supabase. Sans risque pour la prod actuelle : tous les lecteurs publics y passent déjà par la clé service |
| sitemap.xml (667 URL = nombre exact de fiches) | Inévitable pour le référencement (option : sitemap partiel) |
| Total KPI par industrie GICS et « 38 196 KPI Mettrik AI » sur l'accueil | Affichage voulu (12 et 17 sept). Seuls les nombres affichés partent désormais. Voir § 5 |
| Grille tarifaire (`pricing_*` en lecture anonyme) | Publique par nature, c'est ce qu'affiche `/pricing` |
| `/api/floutage-zones` | Ligne 19, laissée (option A) |
| `/api/visibles-gratuit` (6 tickers) | Nécessaire au client, cohérent avec la grille |
| Énumération par la recherche (10 résultats par requête) | On peut encore deviner l'univers avec beaucoup de requêtes : c'est le prix d'une recherche publique |
| Fichiers `/logos/<TICKER>.png` (1 017) | On peut les sonder un par un. Aucune liste n'est publiée |
| FAQ / llms-full.txt : « Plus de 650 grandes sociétés » | Borne arrondie, pas un compte exact. Laissée |
| **niveau1** (`mettrik-niveau1.vercel.app`) : `/sandbox/v1-9-5` et `/concepts` à 200, ancien code | Le nouveau proxy n'y sera qu'après redéploiement. Voir § 5 |
| Modèle d'e-mail de confirmation **dans Supabase Auth** (« Plusieurs milliers de sociétés ») | Corrigé dans `email-templates/confirm-signup.html`, mais le modèle en ligne vit dans la config Supabase (jeton en lecture seule). À recoller dans Supabase > Authentication > Email templates |

## 5. À trancher par Yann

1. **Compteurs KPI de l'accueil** (« 38 196 KPI Mettrik AI » + totaux par industrie) : **A** arrondir (« plus de 38 000 KPI », totaux à la centaine) ; **B** garder les nombres exacts (état actuel).
2. **niveau1** : **A** supprimer l'alias (`npx vercel alias rm mettrik-niveau1.vercel.app`) ; **B** le repointer sur le nouveau déploiement niveau2. En attendant, verif-release le signale en orange.
3. **Sitemap** : **A** le garder complet (référencement, état actuel) ; **B** sitemap partiel (perd du référencement).
4. **Promo `LANCEMENT90`** (−90 %, libellé « Test paiement reel ») : déjà lue par des tiers avant la fermeture. **A** la désactiver ; **B** la garder.

## 6. Fichiers modifiés ou créés

Créés : `supabase/migrations/20261008_fermeture_lecture_anonyme.sql`, `src/app/api/recherche-societes/route.ts`, `src/lib/recherche-societes.ts`, `src/lib/ticker-dedup-aliases.ts`, `src/lib/comptes-gics-public.ts`, `src/lib/donnees-fiche-client.ts`, `src/lib/empreinte-ticker.ts`, `src/build/assainir-json-client.cjs`, `src/components/admin-floating-panel-loader.tsx`.

Modifiés : `next.config.ts`, `tsconfig.json` (exclut `.next-audit`), `.gitignore` (`/.next-audit/`), `src/proxy.ts`, `src/app/robots.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[ticker]/page.tsx`, `src/app/sandbox/v1-9-5/page.tsx`, `src/app/sandbox/v1-9-5/[ticker]/page.tsx`, `src/app/parrainage/page.tsx`, `src/app/api/online-tickers/route.ts`, `src/app/api/billing/health/route.ts`, `src/app/api/popular-stocks/route.ts`, `src/app/api/referrals/route.ts`, `src/app/api/desk/referrals-settings/route.ts`, `src/app/api/desk/curated-companies/route.ts`, `src/app/concepts/fiche-onglets/contenu.tsx` (1 ligne), `src/app/concepts/pricing-v2/page.tsx`, `src/components/company-search.tsx`, `src/components/home-view.tsx`, `src/components/home-gics-block.tsx`, `src/components/home-popular-block.tsx`, `src/components/logos.tsx`, `src/components/sources-externes.tsx`, `src/components/repartition-block.tsx`, `src/components/company-view.tsx` (1 ligne), `src/components/admin-floating-panel.tsx`, `src/components/level-badge.tsx`, `src/components/billing/paywall.tsx`, `src/components/billing/pricing-cards.tsx`, `src/components/email-lab/translations.ts`, `src/lib/data.ts` (type `Company`), `src/lib/billing/load-pricing.ts`, `src/lib/billing/plans.ts`, `src/lib/i18n/dictionary.ts`, `src/lib/i18n/lang-picker-visibility.ts`, `src/lib/desk/use-effective-tier.ts`, `src/lib/desk/effective-tier-shared.ts`, `email-templates/confirm-signup.html`, `scripts/verif-fuites-publiques.mjs`, `scripts/verif-release.py`.

En base, déjà fait (clé service) : `pricing_plan_features` stes_count Premium et Max passés de « 1000+ » à « Plus de 600 ».

Attention au commit : d'autres sessions ont des fichiers modifiés dans le dépôt (`company-header.tsx`, `scripts/earnings-refresh.py`, `src/lib/billing/remise-annuelle.ts`…). Ils ne sont pas de moi : n'ajouter que la liste ci-dessus, fichier par fichier.

Divers : le serveur de dev du port 3000 s'est arrêté pendant mes builds, je l'ai relancé (`next dev --webpack`, journal dans `/tmp/next-dev-3000.log`).
