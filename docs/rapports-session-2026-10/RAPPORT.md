# Audit des fuites publiques (visiteur anonyme), 7 octobre 2026

Périmètre : https://mettrik.ai lu par curl sans cookie : accueil, /pricing, /nvda, /mc.pa, /spcx, /partenaires, /llms.txt, /llms-full.txt, robots.txt, sitemap.xml, 58 chunks JS/CSS (/_next/static/immutable/chunks), en-têtes, 72 routes API en GET simple, base Supabase lue avec la clé anonyme présente dans le JS (lecture seule, aucune écriture tentée), préversions mettrik-niveau1/2.vercel.app.

Rien trouvé : aucune clé secrète (sk_, rk_, whsec_, service_role, AKIA, clé Resend, clé IA), aucune carte de source (.map en 404), aucun chemin local (/Users/yann, .conv-state, .batches-drafts, data-lake, scratchpad), aucun « Fable », « Sonnet », « kpis-haut », « en doute », « à trancher ». Les fiches payantes (NVDA, SPCX) sont bien caviardées côté serveur pour un anonyme. La clé Supabase anonyme dans le JS est normale, mais les règles d'accès (RLS) qui vont avec ne protègent pas plusieurs tables (lignes 1 à 4).

## Éléments douteux (24)

| # | Élément douteux | Où (URL ou chunk + extrait court) | Option A (la plus probable) | Option B |
|---|---|---|---|---|
| 1 | Codes promo lisibles par n'importe qui | Supabase `pricing_promo_codes` avec clé anonyme : `LANCEMENT90` (−90 %, 5 utilisations, libellé « Test paiement reel »), `START50` (−50 % récurrent, sans limite) | RLS : retirer la lecture anonyme (lecture service_role seulement, la validation d'un code passe par la route serveur checkout) | Désactiver LANCEMENT90 tout de suite, garder START50 si public assumé |
| 2 | Courriel personnel + journaux internes | Supabase `desk_page_content` (29 lignes) : `journal_emails` → `"dest":"yannricordeau100@gmail.com"`, sujets « ALERTE ROUGE : 18 bloc(s) de fiche en retard » | RLS : lecture anonyme limitée aux page_key réellement publiques (contact, home, faq, floutage), tout le reste service_role | Déplacer les états internes (journal_emails, alertes_maj, veille_indices, unites_source, valeurs_approx, telemetrie, produit_phare, tam, logos, gics) dans une table séparée sans accès anonyme |
| 3 | Liste des indices suivis + état interne | même table : `veille_indices/etat` = clés `sp500`, `nasdaq100` avec entrées/sorties ; `alertes_maj/etat` = `stesRouges:["APP","AWK","CCL",…]` ; `unites_source`, `valeurs_approx` (décisions de correction) ; `telemetrie` (`hashes_exclus`) | Même correctif que la ligne 2 | idem |
| 4 | Univers complet et sociétés masquées | Supabase `desk_curated_companies` : 901 lignes, `min_plan` = 666 `free` + 235 `hidden` | RLS : supprimer la lecture anonyme (les routes serveur utilisent déjà service_role) | Vue publique ne renvoyant qu'un booléen par ticker demandé |
| 5 | Atelier verrouillé et parrainage lisibles | Supabase `desk_kpi_non_financiers` (MC.PA, `statut:"a_traiter"`, critères) ; `desk_referral_settings` | RLS fermée pour desk_kpi_non_financiers | desk_referral_settings peut rester public (bannière) si voulu |
| 6 | Nombre exact de sociétés par API | `GET /api/online-tickers` → `{"tickers":[…666…]}` sans connexion | Remplacer par une route de recherche `?q=` qui renvoie au plus 10 résultats | Exiger une session ou renvoyer seulement la liste filtrée par la saisie côté serveur |
| 7 | Univers complet dans la page d'accueil | `/` données RSC : tableau de 662 tickers + `\"total\":662` (home-view.tsx importe `v1-9-5-clean-all-tickers.json`) ; 2e tableau de 461 tickers | Ne passer au composant client que ce qu'il affiche (top N), compter côté serveur sans transmettre | Transmettre un total arrondi (« plus de 600 ») |
| 8 | Univers complet + notes internes dans le JS commun | chunk `3udm6nflzhkz2.js` (toutes les pages) : `count:662,tickers:[…]`, `_eu_note:"60 stes ajoutees … ordre Yann : univers en ligne a parite"`, `_gate_fix_note:"… +163 stes … Qualifieur PASS"`, `_be_note:"… entree dans l indice …"` | Retirer les imports JSON de `company-search.tsx` (v1-9-5-clean-all, v1-9-universe, v1-8-tickers-sorted, market-cap-order) ; recherche par API serveur | Script de build qui produit une copie sans champs `_*note` et sans `count` |
| 9 | Classement capi complet + nom de script | même chunk : `"source":"scripts/ranks-univers.py","tickers":[…660…]` ; tableau de 344 tickers (v1-8-tickers-sorted) | Même correctif que la ligne 8 | Charger le classement à la demande par API |
| 10 | Héros de 1 994 tickers dont 221 sociétés masquées | même chunk : `_hero-kpi-index.json` complet (`"AZN.L":{"s":"Pipeline Projects","v":150,…}`) | Servir le héros par API pour les seuls résultats de recherche | Filtrer l'index au build sur les sociétés en ligne |
| 11 | Nombre total de KPI et de KPI avancés (exclusifs) | chunk `3dl1vru5hg2uk.js` (accueil, home-gics-block.tsx ← `kpi-comptes-industries.json`) : `global:{avances:18110,standards:9675,stories:10411,ic:27785,total:38196,stes:671}` + comptes par industrie GICS | Calculer côté serveur et n'envoyer que les libellés affichés (ou des ordres de grandeur) | Retirer `global` et `stes` du JSON importé côté client |
| 12 | Liste des routes internes + description de l'infrastructure | chunk `2flo6vwjedvk6.js` (toutes les pages) : `["/desk-mtk9x4kp","/sandbox/admin","/sandbox/languages-toggle","/sandbox/i18n-audit"]`, `"Niveau 1 (shadow prod) : … sandbox de validation Yann. Stripe en test mode, Resend en dry-run, Supabase séparée"`, `mettrik-niveau${e}.vercel.app` | Charger ce sélecteur de niveau seulement hors production (import dynamique conditionné à `NEXT_PUBLIC_NIVEAU`) | Garder le code mais retirer libellés, prénom et noms d'hôtes |
| 13 | Arbre des routes Next dans chaque fiche | `/nvda`, `/mc.pa`, `/spcx` RSC : `["account","admin","api","auth","chart-lab","concepts","contact","desk-mtk9x4kp","email-lab",…,"sandbox",…]` | Sortir l'outillage (desk, sandbox, admin, concepts, email-lab, chart-lab) dans un projet Vercel séparé | Renommer `desk-mtk9x4kp` (le 404 du proxy protège déjà, seul le nom fuit) |
| 14 | Mode d'emploi interne des blocs | chunk `1cqkri-hts66n.js` (fiches) : `_doc:"… Géré via /sandbox/v1-8/blocks-toggle …"`, `"Géré via /sandbox/v1-8/blocks-per-ste"`, overrides par société | Retirer les champs `_doc` des JSON importés côté client | Lire ces réglages côté serveur uniquement |
| 15 | Préversions publiques avec outillage | `https://mettrik-niveau1.vercel.app/sandbox/v1-9-5` → 200 sans connexion (« V1.9.5 · Stés validées qualité ») ; `niveau1/concepts` → 200 ; `niveau2/sandbox/v1-9-5` → 200 ; noms d'hôtes visibles dans le JS (ligne 12) | Protection Vercel (Deployment Protection / mot de passe) sur niveau1 et niveau2 | Proxy : 404 sur /sandbox et /concepts pour toute session non admin, sur tous les niveaux |
| 16 | État Stripe public | `GET /api/billing/health` → `{"cle_secrete":"live","cle_publique":"live","webhook":"definie",…}` (aussi sur niveau1, qui se dit « Stripe en test mode ») | Réserver la route aux admins | Laisser, mais vérifier pourquoi niveau1 tourne avec des clés live |
| 17 | Promesse « 1000+ sociétés » démontrable fausse | `/pricing` : « Sociétés disponibles : 1000+ », chunk `22-3u-pb8hxm2.js` : `premium:"1 000+ américaines & européennes",max:"1 000+ + ajouts mensuels"` ; or 662 fiches (ligne 7, sitemap) | Aligner le texte (« plus de 600 sociétés ») | Atteindre 1 000 avant d'ouvrir les paiements |
| 18 | Offre gratuite incohérente | `/api/visibles-gratuit` → `["GOOGL","GOOG","NFLX","O","TTE.PA","MC.PA"]` alors que /pricing promet « Accès complet à Google + Meta » et la matrice `free:"5"` | Aligner /pricing sur la liste réelle (ou ajouter META) | Garder la liste publique (utile au client) mais cohérente |
| 19 | Mécanique du floutage exposée | `/api/floutage-zones` : liste des zones floutées par bloc | Laisser (nécessaire au client, sans donnée sensible) | Calculer le floutage côté serveur seulement |
| 20 | Comptage possible par le dictionnaire des sources | chunk `1yfojbsim7ax8.js` (fiches) : `"par_ticker":{…676 tickers…}` | Servir les sources de la seule société affichée (prop serveur) | Laisser (676 ≠ 662, comptage approximatif seulement) |
| 21 | Description interne de l'univers | `/api/popular-stocks` `_meta.method` : « Univers Mettrik (top 300 mondial + extensions régionales) » | Retirer `_meta` de la réponse | Reformuler |
| 22 | Robots.txt révèle des préfixes cachés | `Disallow: /desk-`, `/whoami`, `/_not-found-desk` | Retirer ces lignes (le 404 du proxy suffit) | Laisser |
| 23 | En-têtes internes | `x-mettrik-level: live`, `x-mettrik-version: live/dev` sur toutes les pages | Ne poser ces en-têtes que hors production | Laisser (faible) |
| 24 | Noms de scripts internes et liste des logos | chunk `2j9h8cpoyronn.js` : `"generation":"scripts/build-home-wow.py"` ; chunks `1cqkri…`/`1zkkpe1l5vgal.js` : 516 tickers de `logo-tickers.json` | Retirer le champ `generation` au build | Laisser (faible) |

Constat annexe (fonctionnel, pas une fuite) : BE, FDXF, FERG, FLEX et RDDT ont une fiche servie (200, dans le sitemap) mais ne figurent pas dans `/api/online-tickers` (FERG et RDDT sont `hidden` en base, les 3 autres absentes de la table) : elles sont donc introuvables par la recherche.

## Premium/Max : peut-on connaître le nombre exact ?

**Oui. Un anonyme peut établir que Premium et Max donnent accès exactement aux mêmes 662 sociétés.**

Comment premium/max sont définis dans `src/` :
- `src/lib/desk/company-visibility.ts` prévoit un `min_plan` par société (free / premium / max / hidden) lu dans `desk_curated_companies`, mais ce module n'est importé nulle part en dehors du sandbox : il n'y a aucun cloisonnement de sociétés entre Premium et Max. En base, tous les `min_plan` valent `free` (666) ou `hidden` (235) : aucun `premium`, aucun `max`.
- `src/lib/freemium/tier-serveur.ts` ne distingue les sociétés que pour le gratuit et l'anonyme (liste `visibles-gratuit`, 6 sociétés). Max ne diffère de Premium que par des fonctions (historique, exports, API, favoris), pas par des sociétés (`pricing-cards.tsx`, « Tout du plan Premium, et : … »).

Preuves que le nombre exact arrive chez un anonyme :
1. `https://mettrik.ai/` (RSC) : tableau de 662 tickers suivi de `\"total\":662`.
2. Chunk `3udm6nflzhkz2.js`, chargé sur toutes les pages : `count:662,tickers:[…]` (= `v1-9-5-clean-all-tickers.json`).
3. `sitemap.xml` : 667 URL = 5 pages + 662 fiches, exactement la même liste (comparaison faite, 0 écart).
4. `GET /api/online-tickers` : 666 tickers = 662 − 5 fiches servies mais absentes (BE, FDXF, FERG, FLEX, RDDT) + 9 alias redirigés (GOOG, VOW3.DE, HEN3.DE, DPW.DE, AIR.DE, FOX, NWSA, EA, JDEP.AS : 307/308).
5. Supabase avec la clé anonyme : `desk_curated_companies` = 666 `free` + 235 `hidden`.
6. Chunk `3dl1vru5hg2uk.js` (accueil) : `stes:671` et `avances:18110` (instantané du 13 septembre).

Ce qui est visible, mais qu'on ne peut pas retirer : le sitemap donne de toute façon le nombre de fiches indexables. Pour masquer le compte exact, il faudrait accepter un sitemap découpé ou partiel ; les autres sources (lignes 4, 6 à 11) peuvent être supprimées sans perte pour le visiteur.

## Script de contrôle : `scripts/verif-fuites-publiques.mjs`

Non branché. Usage : `node scripts/verif-fuites-publiques.mjs [URL_BASE] [--json] [--strict] [--previews]` (par défaut https://mettrik.ai ou variable `BASE`). Node 22, aucune dépendance, 6 requêtes en parallèle au plus, environ 25 s.

Ce qu'il fait, en lecture seule :
1. Télécharge 8 pages publiques et relève les en-têtes `x-mettrik-*` / `x-powered-by`.
2. Télécharge tous les chunks référencés, plus ceux référencés par les chunks (2 passes), et vérifie l'absence de `sourceMappingURL` ; sonde 10 fichiers `.map` (doivent répondre 404).
3. Applique les motifs : clés (Stripe sk/rk, whsec, Resend, AWS, GitHub, IA), `service_role`, JWT dont le rôle n'est pas `anon`, chemins internes, noms de scripts, `desk-mtk9x4kp`, routes sandbox/concepts, prénom, noms de modèles IA, vocabulaire interne (kpis-haut, en doute, à trancher, KEPT_SOURCES, « stes ajoutees »…), description de l'infrastructure, comptes exacts (`count:662`, `"total":662`, `stes:671`), comptes de KPI (`global:{…}`, `avances:18110`), clés d'indices structurées (`sp500:[`, `nasdaq100:{`…), « N KPI exclusifs », courriels hors liste autorisée, tableaux de plus de 300 tickers, objets indexés par plus de 300 tickers.
4. robots.txt (préfixe `/desk-`) et sitemap (nombre d'URL, en orange : c'est inévitable).
5. 31 routes API en GET sans connexion : celles qui doivent être fermées et répondent 200 sont signalées ; `/api/online-tickers` est en rouge au-delà de 20 tickers.
6. Récupère la clé anonyme et l'URL Supabase dans le JS, puis compte les lignes lisibles (`Prefer: count=exact`, `limit=1`) de 20 tables : rouge si une table interne renvoie au moins une ligne ; analyse le contenu de `desk_page_content`.
7. Avec `--previews` : niveau1/niveau2 `/`, `/sandbox/v1-9-5`, `/concepts` (rouge si l'outillage répond 200).

Sortie : une ligne par constat (`ROUGE`/`ORANGE`, identifiant, emplacement, extrait), ou du JSON avec `--json` (`{rouges, oranges, constats[]}`) pour `verif-release.py`. Code de retour : 0 sans rouge, 1 avec au moins un rouge (ou au moins un orange avec `--strict`), 2 si le site est illisible. Lancé aujourd'hui avec `--previews` : 33 rouges, 30 oranges, code de retour 1 (sortie complète dans `script-run.txt`).

Branchement proposé plus tard dans `verif-release.py`, sur le modèle du bloc 8b : `subprocess.run(["node","scripts/verif-fuites-publiques.mjs","--json"])`, puis feu rouge si `rouges > 0`, orange si `oranges > 0`, vert sinon.
