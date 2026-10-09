# Compteur KPI automatique, LANCEMENT90, sitemap (8 oct 2026)

Rien n'est commité ni déployé. `npx tsc --noEmit` : 0 erreur.

## 1. Totaux de KPI automatiques

**Page admin** : `/sandbox/comptes-kpi` (préversion niveau2, session propriétaire ou jeton d'audit, sinon 404). Lien ajouté dans l'index sandbox, section « Création et modification de KPI ».

**Blocs comptés** (repérés dans `company-view.tsx` et le dictionnaire) :
| Bloc fiche | Ce qui est compté | Règle |
|---|---|---|
| Long terme « Indicateurs clés long terme » (= KPI IC) | KPI avancés + KPI standard + KPI arrêtés | même fonction que la fiche |
| Moyen terme « Indicateurs variés » | graphiques approuvés servis (`image_findings`) | si bloc actif (`image_findings`, `graphiques_schemas`) |
| Court terme « Faits marquants (Stories) » | slides `buildStories` | si bloc actif (`stories`, `kpi_stories`) |
| **Total général** | long terme + moyen terme + court terme | |

Non comptés : « KPI sur mesure » et « KPI et cours » (admin seulement, jamais servis au public), CA trimestriels (calculés mais plus affichés).

**Même source que les fiches** : la logique de regroupement du tableau a été DÉPLACÉE telle quelle de `company-view.tsx` vers `src/lib/groupes-kpis-fiche.ts` ; la fiche et le compteur appellent la même fonction `groupesKpisFiche`. Chaque fiche est chargée par `loadV17Company` (comme `/[ticker]`), blocs désactivés lus en base (`resolveDisabledForTicker`).

**Contrôle contre les fiches servies (niveau2)** : nombre d'indicateurs du tableau et nombre de graphiques moyen terme identiques sur GOOGL (47 / 11), NVDA (46 / 13), MC.PA (69 / 16), JPM (50 / 3).

**Chiffres (calcul local du 8 oct 2026, 662 fiches, 0 échec, 106 s, 0,7 Go de RAM)** :
| | KPI |
|---|---|
| Long terme (KPI IC) | 27 512 (17 734 avancés, 9 465 standard, 313 arrêtés) |
| Moyen terme | 379 |
| Court terme (stories) | 10 235 |
| **Total général** | **38 126** |
| Industries GICS | 69 (662 sociétés, toutes avec code) |

Avant (instantané du 13 sept) : 38 196, formule IC + stories, 671 sociétés. Copie de l'ancien fichier : `scratchpad/kpi-comptes-industries.avant.json`.

**Fichiers**
- `src/lib/groupes-kpis-fiche.ts` (nouveau) : regroupement du tableau, code déplacé de company-view.
- `src/components/company-view.tsx` : appelle `groupesKpisFiche` (comportement inchangé).
- `src/lib/comptes-kpi.ts` (nouveau) : comptage par bloc et agrégation par industrie.
- `scripts/genere-comptes-kpi.ts` (nouveau) : `npx tsx scripts/genere-comptes-kpi.ts [--sec]`, écrit `src/data/kpi-comptes-industries.json` (même chemin, clés anciennes conservées, nouvelles clés `long_terme`, `moyen_terme`, `arretes`, `par_societe`). Garde-fous : refus d'écrire si plus de 3 % d'échecs, ou si total ou moyen terme baissent de plus de 25 %.
- `scripts/deploy-niveau2.sh` : lance le calcul à chaque mise en ligne, commite le fichier seulement si un chiffre a bougé (même schéma que l'inventaire de structure) ; en cas de refus, l'ancien fichier reste.
- `src/lib/comptes-gics-public.ts` : commentaire mis à jour ; lit le fichier régénéré.
- `scripts/agrege-comptes-kpi.py` : neutralisé (sortie immédiate « obsolète »), sinon il réécrirait l'ancien format.
- `src/app/sandbox/comptes-kpi/page.tsx` (nouveau), `src/app/sandbox/sandbox-client.tsx` (lien).

**Accueil** : inchangé côté navigateur. Le serveur n'envoie que le total par industrie et le total général (`{ parIndustrie, total }`) : ni avancés/exclusifs, ni nombre de sociétés. Le JSON complet n'est importé que par du code serveur (`comptes-gics-public.ts`, page sandbox).

Non fait : rendu de la page sandbox dans un navigateur (pas de serveur local lancé, Mac fragile) ; à vérifier sur niveau2 après déploiement.

## 2. Code promo LANCEMENT90 désactivé

- Base `pricing_promo_codes` : `is_active = false` (mis à jour le 8 oct 10:34 UTC). Le checkout filtre sur `is_active = true`.
- Stripe (clé live) : promotion code `promo_1UC1upClUEb0T7vSd3FEJDcU` (LANCEMENT90) passé `active = false`, vérifié en relecture. Le coupon `pNeIukCr` reste (non supprimé ; Stripe n'a pas d'état « inactif » pour un coupon, seul le promotion code se désactive). 0 utilisation.

## 3. Sitemap

- `src/app/sitemap.ts` : liste blanche explicite (accueil, `/pricing`, `/legal/mentions`, `/legal/conditions`, `/legal/confidentialite`) + fiches de `v1-9-5-clean-all-tickers.json`, alias et sociétés retirées exclus. Filtre de sécurité qui rejette tout chemin sandbox, desk, admin, concepts, api, chart-lab, email-lab, whoami, auth, account, login, signup, maintenance, favorites, mes-societes, preversion, test, v1-9-5, `/k/`, `/_`.
- Test local : 667 URL (5 pages + 662 fiches), 0 route interne.
- `robots.ts` vérifié, laissé tel quel : bloque `/api/ /auth/ /account/ /admin/ /sandbox/ /concepts/`, interdit les robots d'entraînement, pointe vers le sitemap. Les routes cachées (`/desk-…`, `/whoami`) n'y sont volontairement pas citées (décision de l'audit du 7 oct).
- Limite : le sitemap donne toujours le nombre exact de fiches (662), inévitable si les fiches y figurent.
