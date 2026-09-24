# Inventaire des blocs incomplets sur la fiche société

Mesure du 23 septembre 2026, sur les 671 sociétés de `src/data/v1-9-5-clean-all-tickers.json`.
Méthode : chargement de ce qui est **réellement servi**, par `loadV17Company(ticker, { mode: "v18", locale: "fr" })`
plus `resolveDisabledForTicker(ticker)` (Supabase `desk_disabled_blocks`), exactement comme
`src/app/[ticker]/page.tsx`. 671 fiches sur 671 chargées, aucune erreur, aucun repli legacy.
Lecture seule, aucun fichier du dépôt modifié.

Scripts de mesure (hors dépôt) : `/tmp/inv/raw.ts`, `/tmp/inv/agg.py`.
Données brutes : `/tmp/inv/raw.jsonl` (une ligne par société).

---

## 1. Les mécanismes qui produisent un bloc incomplet ou une mention d attente

Six mécanismes distincts, du plus visible au plus discret.

### a. « Disponible bientôt » : `src/components/block-coming-soon.tsx`
Carte verte, horloge animée, pastille « Bientôt », ligne « Disponible bientôt ».
Le texte d accompagnement vient de `BLOCK_PLACEHOLDER_HINTS` dans `src/lib/v1-9-blocks-control.ts`.
Elle est posée par `src/components/company-view.tsx` pour six blocs : facteurs de risque,
gouvernance, positionnement IA, appel de résultats, histoires KPI, graphiques et schémas,
plus répartition et image findings.

Deux déclencheurs, indépendants :
- `isBlockEnabled(bloc, ticker)` lit `src/data/v1-9-blocks-control.json`.
  **Aujourd hui inerte** : les 14 bascules globales sont à `true` et `per_ticker_overrides` est vide.
- `isDisabled(clé)` lit la liste résolue par `resolveDisabledForTicker`, c est à dire
  l union de la portée `__global__` et de la portée du ticker dans la table Supabase
  `desk_disabled_blocks` (repli sur `src/data/disabled-blocks.json` et
  `disabled-blocks-per-ste.json` si la table est vide). **C est le seul mécanisme actif.**

État mesuré des désactivations :

| Clé désactivée | Sociétés | Effet visible |
|---|---|---|
| `gouvernance_top3_votes` | 671 (global) | les tableaux des premiers actionnaires ne sont jamais rendus |
| `gouvernance_top3_capital` | 671 (global) | idem |
| `events` | 93 | **aucun effet** : `EventTimeline` n est plus monté dans `company-view.tsx` |
| `ai_positioning` | 20 | « Disponible bientôt » à la place du positionnement IA |
| `graphiques_schemas` | 5 | « Disponible bientôt » à la place des graphiques |
| `risks` | 3 | « Disponible bientôt » à la place des facteurs de risque |
| `gouvernance` | 2 | « Disponible bientôt » à la place de la gouvernance |

**27 sociétés** affichent au moins une mention « Disponible bientôt ».

### b. Le carton rouge « Bloc à compléter » : `src/components/v18-missing-placeholder.tsx`
Bordure rouge pointillée, triangle d alerte, et une phrase interne du genre
« Item 1A 10-K à extraire (Sonnet/Haiku Pass 2) » ou « à parser via Cerebras Llama 3.3 70B ».
Le fichier dit « Ne s affiche JAMAIS sur la prod ». **C est faux depuis que la fiche est servie
sur `/<ticker>`** : `page.tsx` passe `v18Mode` dans la branche normale, donc le carton rouge et
son jargon sont publics. Il se déclenche quand `company.risks`, `company.governance` ou
`company.ai_positioning` sont absents alors que le bloc n est pas désactivé.

**3 sociétés concernées aujourd hui : DPW.DE, P911.DE, PUM.DE.** À traiter en priorité, c est
du vocabulaire interne exposé aux visiteurs.

### c. La fiche entière remplacée : `src/components/recent-ipo-placeholder.tsx`
Table `RECENT_IPO_TABLE`, seuil de 24 mois recalculé à la date du jour. Au delà de l en tête
et du prix, toute la fiche est remplacée par un panneau d attente.
**3 sociétés au 23 septembre 2026 : CRWV, Q, SNDK.** Les quatre autres entrées de la table
(FLTR.L, GEHC, GEV, SOLV) ont dépassé les 24 mois et servent la fiche complète.

### d. Le bloc rendu vide faute de données
Le plus fréquent, et le plus silencieux : le composant renvoie `null` et le bloc disparaît sans
la moindre trace. Cas relevés :
- positionnement IA masqué quand `stance === "absent"` ou `evidence` vide (`company-view.tsx`) ;
- répartition masquée quand ni géographie ni segment n a deux parts (`repartition-block.tsx`) ;
- moat et clients masqués ensemble quand les deux manquent (`moat-clients-row.tsx`) ;
- position marché masquée sans `market_positions` ;
- sources utilisées masquées quand la liste filtrée est vide (`sources-externes.tsx`) ;
- graphiques et schémas masqués sans finding approuvé ;
- histoires KPI masquées quand `hasStories` est faux ;
- description masquée quand `hasAnything` est faux (`company-profile-card.tsx`) ;
- pastilles de rang masquées une à une sur valeur vide ou « Pas disponible » (`company-header.tsx`).

### e. Le contenu présent mais manifestement insuffisant
C est le gros du sujet, invisible à l œil nu sur une fiche isolée :
- un facteur de risque **sans citation verbatim** : `risk-stack.tsx` désactive le dépliant
  (`hasQuote`), la carte n a plus ni chevron ni clic, il ne reste que le titre et la note ;
- un positionnement IA avec une ou deux preuves **non datées** ;
- une position marché à **un seul segment** alors que le gabarit en prévoit deux ;
- une seule source dans « Sources utilisées » ;
- un hero KPI à historique très court ou à dernière donnée périmée ;
- une gouvernance sans taux d indépendance ou sans rémunération.

### f. Ce qui n est pas de l incomplétude
Le floutage freemium (`FreemiumBlurProvider`, `caviardeCompanyPourGratuit`, `ZoneReservee`) et
le verrouillage plan Max de la thèse et de l anti-thèse retirent du contenu **existant** selon le
palier du visiteur. Mesure faite hors palier, donc sur le contenu complet.
La logothèque est saine : 671 sociétés sur 671 ont un logo, zéro repli sur monogramme.

---

## 2. Tableau de mesure, 671 sociétés

Classé du plus lourd au plus léger, en nombre de sociétés à traiter (incomplètes + absentes).
Les 3 sociétés à cotation récente comptent en « absent » partout, leur fiche étant remplacée.

| Bloc | Complet | Incomplet | Absent | Critère de complétude retenu | Difficulté | Cause dominante |
|---|---:|---:|---:|---|---|---|
| **Facteurs de risque** | 2 | 665 | 4 | au moins 5 risques, chacun avec note, justification de note **et citation verbatim du document** | extraction de documents déjà téléchargés | 519 fiches ont un résumé mais aucune citation ; 143 n ont ni citation ni résumé (titre et note seuls) : le dépliant est mort sur 665 fiches |
| **Graphiques et schémas** | 25 | 6 | 640 | au moins 3 graphiques approuvés, le gabarit de l atelier en demande 3 | recherche extérieure | 632 fiches sans aucun graphique approuvé, 5 désactivées en « Disponible bientôt » |
| **Positionnement IA** | 80 | 382 | 209 | position différente d « absent », **au moins 2 preuves datées** sur 3 preuves minimum, source citée, résumé étoffé | extraction de documents déjà téléchargés | 359 fiches ont moins de 2 preuves datées (187 n en ont aucune datée) ; 185 masquées faute de preuve ; 20 désactivées |
| **Sources utilisées** | 243 | 368 | 60 | au moins 2 sources externes après retrait de Motley Fool, Wikipédia, MarketBeat, StockAnalysis | donnée déjà présente à réinjecter | 368 fiches n ont qu une seule source retenue, le filtrage des quatre éditeurs écartés vide les listes |
| **Position marché (TAM)** | 254 | 364 | 53 | 2 segments chiffrés avec part de marché et marché adressable, le gabarit en affiche deux | recherche extérieure | 364 fiches n ont qu un segment posé, la carte occupe alors toute la largeur |
| **Avantage concurrentiel (moat)** | 458 | 34 | 179 | niveau différent d « Aucun », texte, tendance Mettrik et justification Mettrik | donnée à chercher à l extérieur | 176 sociétés sans note du tout, surtout hors États Unis ; 34 avec la note mais sans lecture Mettrik |
| **Répartition du chiffre d affaires** | 537 | 111 | 23 | les deux axes présents, géographie et segment, avec au moins 2 parts chacun | extraction de documents déjà téléchargés | 111 fiches n ont qu un seul axe ; 20 n ont aucune répartition (foncières, distribution, énergie) |
| **Hero KPI** | 544 | 99 | 28 | KPI hero trouvé, au moins 8 points d historique, dernière donnée de moins de 15 mois | donnée déjà présente à réinjecter | 86 historiques trop courts, 13 séries périmées, 25 hero introuvable dans le tableau servi |
| **Concentration clients** | 589 | 75 | 7 | soit « diffus » déclaré, soit part du premier client chiffrée avec exercice et source | extraction de documents déjà téléchargés | 75 fiches portent l objet clients sans part chiffrée du premier client |
| **Gouvernance** | 599 | 67 | 5 | dirigeant, rémunération, taille du conseil, taux d indépendance, exercice de 2024 ou après | extraction de documents déjà téléchargés | 68 fiches incomplètes, presque toutes européennes : taux d indépendance ou rémunération manquants, pas de document d assemblée à la mode américaine |
| **Description Mettrik** | 609 | 32 | 30 | les deux versions françaises remplies, simple (4 sections) et avancée (4 sections) | donnée déjà présente à réinjecter | 27 sociétés sans aucune description, 26 d entre elles européennes ; 32 n ont qu une seule des deux versions |
| **Histoires KPI** | 651 | 6 | 14 | au moins 3 histoires retenues après le filtre anti-doublon de `buildStories` | donnée déjà présente à réinjecter | 11 fiches sans aucune histoire usable, le filtre anti-doublon du tableau les élimine toutes |
| **Rangs** | 655 | 11 | 5 | au moins 3 pastilles valides dont un rang national | donnée déjà présente à réinjecter | 10 fiches à moins de 3 rangs, 2 sans aucun rang |
| **Anti-thèse** | 660 | 3 | 8 | au moins 3 arguments, 2 éléments chiffrés et un résumé | donnée à rédiger, sources déjà réunies | 5 sociétés sans anti-thèse : BE, EDEN.PA, JDEP.AS, PAH3.DE, PUM.DE |
| **Indicateurs clés** | 665 | 3 | 3 | au moins 6 KPI portant 4 points d historique ou plus | donnée déjà présente à réinjecter | 3 fiches à séries trop maigres : DPW.DE, HONA, RAND.AS |
| **Appel de résultats** | 667 | 1 | 3 | synthèse d au moins 4 points | extraction de documents déjà téléchargés | 1 fiche n a que l appel brut sans synthèse |
| **Thèse d investissement** | 668 | 0 | 3 | au moins 3 arguments, 2 éléments chiffrés et un résumé | rien à faire | seules les 3 fiches à cotation récente ne la portent pas |

---

## 3. Défense des critères devant un investisseur confirmé

- **Facteurs de risque** : un risque sans la phrase d origine du document n est pas vérifiable.
  L interface le sait déjà, elle coupe le dépliant. Cinq risques est le minimum pour couvrir les
  grandes familles (marché, opérations, réglementaire, financier, géopolitique).
- **Positionnement IA** : deux preuves datées au minimum, sinon la lecture ne se distingue pas
  d un discours d entreprise. La date sert à séparer l annonce du fait accompli. C est le critère
  proposé par Yann, appliqué tel quel.
- **Position marché** : un seul segment ne permet aucune comparaison de la part captée.
  Le gabarit prévoit deux cartes, une carte seule est un gabarit à moitié rempli.
- **Graphiques et schémas** : l atelier fixe lui même trois graphiques par demande
  (`desired_count` à 3). En dessous, le bloc ne raconte rien.
- **Gouvernance** : sans taux d indépendance du conseil ni rémunération du dirigeant, il ne reste
  qu un annuaire de noms. L exercice doit dater de 2024 ou après, sinon l information est périmée.
- **Hero KPI** : huit points d historique, c est deux ans en trimestriel, le minimum pour lire une
  tendance. Une dernière donnée de plus de 15 mois périme le chiffre mis en avant sur la fiche.
- **Sources utilisées** : une source unique ne recoupe rien.
- **Concentration clients** : sans exercice ni source, le pourcentage n est pas opposable.
- **Description Mettrik** : les deux niveaux sont promis par l interface, le sélecteur
  simple / avancée est toujours affiché.

---

## 4. Ordre de traitement conseillé

1. **Facteurs de risque, 669 sociétés.** Le plus lourd, mais le mieux outillé : les documents sont
   déjà téléchargés et les risques déjà titrés et notés. Il s agit de remettre la citation
   d origine et sa traduction dans `quote` et `quote_fr`. Une partie de la citation se trouve
   déjà recopiée à l intérieur de `score_rationale` sur beaucoup de fiches, donc récupérable
   sans nouvelle extraction.
2. **Graphiques et schémas, 646 sociétés.** Difficulté maximale : recherche extérieure image par
   image, puis arbitrage dans l atelier. C est le chantier le plus long au point.
3. **Positionnement IA, 591 sociétés.** Extraction dans les documents déjà présents, en exigeant
   la date de chaque preuve. 185 fiches sont masquées faute de preuve, elles ne coûtent rien
   aujourd hui en visibilité mais laissent un trou dans la fiche.
4. **Sources utilisées, 428 sociétés.** Le moins coûteux du haut de tableau : la donnée existe
   dans `src/data/sources-externes.json`, c est le filtre des quatre éditeurs écartés qui vide
   les listes. À réalimenter avec les sources réellement utilisées lors des extractions.
5. **Position marché, 417 sociétés.** Recherche extérieure du marché adressable du deuxième segment.
6. **Avantage concurrentiel, 213 sociétés.** 176 notes manquantes, concentrées hors États Unis.
7. Puis répartition (134), hero KPI (127), clients (82), gouvernance (72), description (62),
   et la queue courte : histoires KPI (20), rangs (16), anti-thèse (11), indicateurs clés (6),
   appel de résultats (4), thèse (3).

## 5. Trois corrections ponctuelles, hors volume

- Retirer le carton rouge « Bloc à compléter » de la route publique, ou compléter DPW.DE, P911.DE
  et PUM.DE : le jargon interne est aujourd hui visible par les visiteurs.
- La clé `events` est désactivée sur 93 sociétés pour un bloc qui n existe plus dans la fiche.
  Ménage sans risque.
- Les deux clés `gouvernance_top3_votes` et `gouvernance_top3_capital` sont désactivées
  globalement : les premiers actionnaires ne s affichent sur aucune fiche, alors que la donnée
  est chargée. Décision à reprendre.
