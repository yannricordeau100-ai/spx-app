# Journées investisseurs et conférences développeurs

Statut : cadrage et pilote du 6 octobre 2026, en attente de validation de Yann. Aucun fichier servi modifié.
Pilote : `/private/tmp/claude-501/-Users-yann/f6e0203b-2aed-4432-a0b3-a87ba8db1323/scratchpad/evenements-pilote/<ticker>.json` (6 fichiers).

## 1. Où va chaque donnée

| Type de donnée | Exemple | Destination | Remarque |
|---|---|---|---|
| Objectif moyen terme chiffré | SU : croissance organique 7 à 10 % par an à 2030 | Story KPI court terme | nature « objectif », jamais présenté comme prévision Mettrik |
| Chiffre d usage ponctuel | GOOGL : Gemini 900 M d utilisateurs actifs mensuels | Story KPI court terme | si 2 points (an passé et an en cours), les deux dans l historique |
| Allocation du capital | GEV : autorisation de rachat 10 Mds $ (6 avant) | Story KPI court terme | dividende, rachat, cessions, capex annoncé |
| Capacité ou carnet annoncé | NVDA : 1,7 GW chez les partenaires cloud | Story KPI court terme | |
| Marché adressable revendiqué (TAM) | « marché de X Mds $ en 2030 » dit par la société | Bloc TAM, candidat | source « déclaré par la société », jamais mélangé aux TAM de cabinets sans l étiquette |
| Positionnement IA pur | TPU 8t, DGX Station, modèle maison, nombre de cas d usage IA | Bloc positionnement IA | pas de story sauf si un chiffre d usage mesurable |
| Guidance annuelle | GEV : CA 2026 de 41 à 42 Mds $ | Ignoré ici | relève du bloc perspectives et des résultats |
| Opinion, benchmark interne, chiffre externe | « demande x 1 million » (PDG), « 7x plus rapide » (test interne) | Ignoré | listé dans `ignores` du JSON pour traçabilité |

## 2. Format d une story

| Champ | Contenu |
|---|---|
| Titre | `short` (court) et `name_fr` / `name_en` |
| Chiffre | `value` (nombre) ou `value_texte` si fourchette ou seuil (« > 900 », « 7 à 10 ») ; `unit` aux unités Mettrik (Mds $, M, %, GW) |
| Période | `period` (mai 2026, 2030, fin 2028) ; `history` + `history_periods` si un point de comparaison est donné par la société |
| Texte | `story_fr` (2 phrases max, français, sans tiret long) ; `story_en` uniquement derrière le « i » |
| Étiquette | `label_fr` = « annoncé par la société le JJ/MM/AAAA » |
| Source | `source_url` + `citation` verbatim ; affichage dans le mini bloc du bas uniquement, jamais dans la story |
| Catégorie | `story_category` (Adoption, Capacité, Objectifs, Capital, Clients, Innovation, Perspectives) |
| Nature | `realise` / `usage` / `capacite` / `objectif` ; pour `objectif`, le texte dit « vise », « prévoit », « attend » |

## 3. Règles

| Règle | Détail |
|---|---|
| Dernier événement seulement | un `dernier.json` écrasé à chaque nouvel événement, pas d historique d événements |
| Vérification de 3 valeurs | 3 valeurs par société relues contre la source avant écriture, citation retrouvée mot pour mot (le script du pilote le contrôle) |
| Pas de prévision Mettrik | tout chiffre futur est « objectif de la société » ; interdit de calculer, d interpoler ou de prendre un milieu de fourchette |
| Jamais de valeur inventée | chiffre absent de la source = ignoré, listé dans `ignores` (cas MSFT : chiffres d usage de la keynote introuvables en texte) |
| Langue | texte visible en français ; anglais seulement derrière le « i » |
| Pas de cuisine interne | passage par `assainirPourClient` avant rendu, aucune mention de pilote ou de script |
| Unités | « billion » américain converti en « billions » français (10^12) ou en Mds, unité écrite dans `unit`, jamais ambiguë |
| Approbation | aucune story publiée sans feu vert de Yann |

## 4. Sources par type

| Type d événement | Source principale | Secours |
|---|---|---|
| Journée investisseurs | communiqué IR (page IR, PDF) ; 8-K Item 7.01 / 8.01 pour les US | transcription IR, présentation PDF |
| Résultat de journée avec transcription | transcription officielle sur le site IR (JPM) | communiqué de presse |
| Conférence développeurs | blog officiel de la keynote (blog.google, blogs.nvidia.com, news.microsoft.com) | communiqué du blog presse, live blog |
| Sociétés européennes | communiqué réglementé (finanzwire, se.com, site IR) | présentation PDF du jour |

## 5. Stockage

| Chemin | Rôle |
|---|---|
| `data-lake/<T>/evenement/dernier.json` | extraction brute, un fichier par société, écrasé au renouvellement |
| `src/data/evenements/<ticker>.json` | version validée, lue par le bloc story (créé seulement après feu vert) |

Champs : `ticker`, `societe`, `evenement{nom,type,date,lieu}`, `source_principale`, `stories[]` (champs du §2 + `id`, `explanation`, `_citation_verifiee`), `tam_candidats[]`, `positionnement_ia[]`, `ignores[]`, `sondes[]` (3 valeurs vérifiées), `extrait_le`, `statut`.

## 6. Renouvellement

| Étape | Fréquence |
|---|---|
| Veille : calendrier des journées investisseurs et conférences par société (pages IR, 8-K 7.01) | hebdomadaire, dans la chaîne de veille existante |
| Détection d un nouvel événement | alerte, extraction à J+2, vérification à J+3, alerte rouge à J+7 sans extraction |
| Remplacement | le nouveau `dernier.json` écrase l ancien, la story ancienne disparaît à la validation |
| Péremption | story masquée 24 mois après l événement sauf objectif encore dans sa période |

## 7. Coût et délai pour environ 250 sociétés (Sonnet)

Estimation à partir du pilote, non mesurée sur 250 : un agent par société, lecture de 30 000 caractères maximum (règle `_30k`), 3 agents en parallèle.

| Poste | Par société | 250 sociétés |
|---|---|---|
| Recherche de l événement et de la source | 1 requête web, environ 0,05 $ | environ 12 $ |
| Extraction (35 k tokens entrée, 4 k sortie) | environ 0,17 $ | environ 43 $ |
| Vérification de 3 valeurs et contrôle des citations | environ 0,05 $ | environ 12 $ |
| Total | environ 0,27 $ | environ 70 $ (marge ×1,5 : 100 $) |
| Délai (6 min par société, 3 agents) | | environ 8 h, soit 2 nuits avec les quotas |

Seules les sociétés ayant tenu un événement dans les 24 derniers mois sont traitées ; les autres sont marquées « sans événement » dans un registre.
