# Présentations investisseurs : 4 sociétés aux sites bloqués (9 oct. 2026)

Voies utilisées : Wayback Machine (fichier brut id_), téléchargement direct avec un vrai profil de navigateur (curl_cffi, sans résoudre de défi anti-robot), recherche web pour retrouver les noms de fichiers. Aucun audio ni vidéo. Chaque PDF a été vérifié (en-tête %PDF, pdfinfo, première page lue). Le texte a été extrait dans un .txt.gz placé à côté du PDF.

## SGO.PA (Saint-Gobain)

| Point | Résultat |
|---|---|
| Documents récupérés | 1 : T1 2021 « Résultats récents et perspectives », 66 p. (Wayback) |
| KPI créés | aucun (un seul document, rien qui fasse 4 périodes) |
| Pertinent pour de nouveaux KPI IC sur 5 ans | non, pas en l'état : les présentations de 2024 à 2026 ne sont pas accessibles |
| Beaucoup plus de KPI que le document légal | non : présentation FY2024, 46 p., 231 nombres distincts (5 par page) ; URD 2024, 509 p., 3 740 nombres (7 par page). Le communiqué contient déjà prix/volume et la répartition par région |
| Disponible et valide par année | 2021 oui · 2022 oui · 2023 oui · 2024 partiel (FY et T1 dans le lac ; S1 et T3 non) · 2025 non · 2026 non |

Blocage : Cloudflare demande un défi à chaque visite. Je n'ai pas cherché à le contourner. Wayback n'a archivé aucune présentation postérieure à FY2024. Le CMD d'octobre 2025 manque aussi. Les noms exacts des fichiers sont connus : H1_2025_ENG-a.pdf, FY_2025_ENG-a.pdf, 9M-H1-2025_ANG-a.pdf, dans /sites/saint-gobain.com/files/media/document/. Un téléchargement à la main est possible.

## SU.PA (Schneider Electric)

| Point | Résultat |
|---|---|
| Documents récupérés | 19 : 16 présentations T1/S1/T3/FY de 2021 à 2024 (assets se.com, profil navigateur), S1 2026 (download.se.com), CMD déc. 2025 finance et automatismes (2 PDF). 2025 était déjà dans SLIDES, T1 2026 déjà dans TRIM |
| KPI créés | Croissance de l'ARR d'AVEVA : FY2022 à FY2025 (4 périodes) |
| Pertinent pour de nouveaux KPI IC sur 5 ans | non : l'URD et les communiqués reprennent presque tout (prix net, ARR, régions, segments) |
| Beaucoup plus de KPI que le document légal | non : présentation FY2024, 53 p., 339 nombres distincts ; URD FY2024, 677 p., 4 123 nombres. Seuls 1 ou 2 indicateurs sont propres à la présentation (historique de l'ARR) |
| Disponible et valide par année | 2021 oui · 2022 oui · 2023 oui · 2024 oui · 2025 oui (lac) · 2026 oui (T1, S1) |

Reste à récupérer : les comptes semestriels S1 2026. Les présentations stratégie et gestion de l'énergie du CMD 2025 ont été refusées par le serveur (code 413).

## EN.PA (Bouygues)

| Point | Résultat |
|---|---|
| Documents récupérés | 21 : 19 présentations T1/S1/9M/FY de 2021 à T1 2026 (Wayback), FY2025 (profil navigateur), Climate Markets Day déc. 2020 (dernière journée investisseurs du groupe, Wayback) |
| KPI créés | ABPU Fixe trimestriel : T1 2021 à T1 2026 (21 trimestres) ; Consommation de données mobiles par client : T1 2021 à T1 2026 (21 trimestres) |
| Pertinent pour de nouveaux KPI IC sur 5 ans | oui : l'annexe « Indicateurs clés de Bouygues Telecom » donne 12 lignes sur 12 trimestres (parcs, ABPU, usage, CA services). L'URD ne publie que les valeurs de fin d'année |
| Beaucoup plus de KPI que le document légal | oui pour le trimestriel : environ 10 séries trimestrielles propres à la présentation. Non en volume brut : présentation FY2025, 61 p., 829 nombres distincts (14 par page) ; URD 573 p., 4 119 nombres (7 par page) |
| Disponible et valide par année | 2021 oui · 2022 oui · 2023 oui · 2024 oui · 2025 oui · 2026 partiel (T1 oui, S1 non archivé) |

Remarques : les présentations FY2024 et S1 2025 sont des PDF valides mais en images, sans texte extractible. La présentation sur le projet de rachat de SFR (juin 2026) n'a pas pu être téléchargée.

## SAF.PA (Safran)

| Point | Résultat |
|---|---|
| Documents récupérés | 18 : 17 présentations de T1 2021 à S1 2026 (liste filtrée publications-resultats?type[]=result puis /fr/download/media/id, profil navigateur ; 4 via Wayback), CMD 2024 (86 p.) |
| KPI créés | Livraisons de toboggans d'évacuation A320, Livraisons de toilettes A350, Livraisons de trains d'atterrissage A350 : FY2021 à FY2025 (5 périodes chacun) |
| Pertinent pour de nouveaux KPI IC sur 5 ans | oui : le tableau « Quantités livrées » couvre 13 programmes, chaque trimestre, semestre et année |
| Beaucoup plus de KPI que le document légal | oui pour l'opérationnel : 13 quantités livrées dans la présentation S1 2026, contre environ 3 dans le RFS S1 2026 (LEAP, M88). Non en volume brut : 28 p. et 382 nombres, contre 71 p. et 1 145 nombres |
| Disponible et valide par année | 2021 oui · 2022 oui · 2023 oui · 2024 oui · 2025 oui · 2026 oui (T1, S1) |

Remarques : l'URD donne aussi les livraisons annuelles de turbines d'hélicoptères, de moteurs de forte puissance et de nacelles A320neo. Je ne les ai donc pas créées. Le KPI existant « CA trimestriel (T1 et T2 publiés) » indique que le T3 n'est pas publié. Or les présentations 9M le donnent. Je ne l'ai pas modifié (hors périmètre).

## Sondes (citations exactes, PDF du lac)

| Société | KPI, période | Valeur | Citation | Source |
|---|---|---|---|---|
| SAF.PA | Toboggans A320, FY2021 | 3 598 | « Toboggans d’évacuation A320 3 598 4 454 24 % » | PRESENTATION/2023-02-17_FY2022.pdf p28 |
| SAF.PA | Toilettes A350, FY2025 | 423 | « Toilettes A350 448 423 - 25 -6 % » | PRESENTATION/2026-02-13_FY2025.pdf p25 |
| SAF.PA | Trains A350, FY2023 | 46 | « Trains d’atterrissage A350 46 48 2 4% » | PRESENTATION/2025-02-14_FY2024.pdf p23 |
| SU.PA | ARR AVEVA, FY2022 | 12,3 % | « ARR up +12.3%1 at 31 Dec. » | PRESENTATION/2023-02-16_FY2022.pdf p31 |
| SU.PA | ARR AVEVA, FY2023 | 19 % | « ARR growth at AVEVA, up +19%1 » | PRESENTATION/2024-02-15_FY2023.pdf p19 |
| SU.PA | ARR AVEVA, FY2024 | 15 % | « AVEVA: Strong growth in ARR, up +15% » | PRESENTATION/2025-02-20_FY2024.pdf p31 |
| EN.PA | ABPU Fixe, T1 2021 | 28,0 € | ligne « ABPU Fixe f (incluant BTBD) 29,5 … 28,0 », dernière colonne = T1 2021 | PRESENTATION/2023-02-23_FY2022.pdf p43 |
| EN.PA | Données mobiles, T4 2024 | 21,3 Go | ligne « Usage data Go/mois/client (c) 23,0 … 21,3 … », 5e colonne = T4 2024 | PRESENTATION/2026-02-26_FY2025.pdf p46 |
| EN.PA | ABPU Fixe, T1 2026 | 33,5 € | « Fixed ABPU (f) 33.5 33.8 … » | PRESENTATION/2026-05-07_T1-2026.pdf p37 |

## Fichiers modifiés

- data-lake/{SGO,SU,EN,SAF}.PA/ir/PRESENTATION/ et ir/CMD/ : PDF nommés AAAA-MM-JJ_type.pdf, avec leur .txt.gz.
- .batches-drafts-safe/kpis-haut/SAF.PA.json (+3), SU.PA.json (+1), EN.PA.json (+2). Le format d'origine est conservé ; chaque ajout porte `_added_batch: presentations-ir-bloques-oct-2026`.
- data-lake/_ir-bloques/etat/{SGO,SU,EN,SAF}.PA.json, puis page.mjs relancé.

## Dates à vérifier

Ces dates ne viennent pas d'une page de garde : Bouygues FY2024 = 2025-03-06 (date du communiqué), Bouygues S1 2025 = 2025-07-30 (date de création du PDF et du conseil), Schneider T1 2021 = 2021-04-29 et Saint-Gobain T1 2021 = 2021-04-29 (déduites de la date de création du PDF).
