# Contrôle global des URL P2

Date du contrôle : 2026-09-12. Périmètre : 161 fichiers P2, 955 références annuelles non vides, 492 URL distinctes. Le contrôle a été exécuté par requêtes HTTP HEAD, en 12 flux légers, avec un délai maximal de 4 secondes et sans téléchargement des corps. Le magasin local de certificats étant incomplet, le statut HTTP a été relevé avec la validation TLS locale désactivée. Cette option ne modifie pas les fichiers ni les sources.

## Résultats agrégés

Parmi les 469 URL HTTP(S) distinctes : 222 ont répondu 200, 1 a répondu 202, 2 ont répondu 302, 1 a répondu 400, 167 ont répondu 403, 11 ont répondu 404, 2 ont répondu 405, 3 ont répondu 429, 9 ont répondu 502, 50 ont dépassé le délai de 4 secondes et 1 a produit une erreur réseau. Le client a constaté 29 redirections effectives, dont la majorité aboutissent à une réponse finale 200 et sont donc incluses dans les 222 réponses 200.

Les réponses 403 et 405 signifient souvent que le serveur refuse HEAD ou les clients automatisés; elles ne prouvent pas que la page est absente. Les délais et réponses 429/502 sont également classés comme indéterminés. Aucune URL n'a été remplacée automatiquement, car une réponse technique ne suffit pas à établir avec certitude une source officielle équivalente portant la même valeur.

## Références qui ne sont pas des URL

Vingt-trois références utilisent des chemins internes `data-lake/...` et ne peuvent pas être ouvertes comme URL : GE 2019-2023; GD 2016-2024; DPZ 2016-2024. Elles doivent être remplacées ultérieurement par les dépôts SEC officiels correspondants après vérification valeur par valeur.

## Fichiers comportant au moins une réponse autre que 200

Le nombre ci-dessous compte les URL distinctes non 200 associées à chaque fichier; une URL réutilisée sur plusieurs années ne compte qu'une fois pour ce relevé.

| Fichier | URL non 200 |
|---|---:|
| CPRT | 10 |
| DHL.DE | 7 |
| DHL.DE~B | 4 |
| DPZ | 1 |
| DTG.DE | 5 |
| EN.PA | 5 |
| F | 10 |
| FER | 1 |
| FIX | 6 |
| G1A.DE | 2 |
| GE | 3 |
| GEV | 1 |
| GM | 5 |
| GNRC | 9 |
| HLT | 7 |
| HWM | 5 |
| IEX | 4 |
| IR | 3 |
| ITW | 5 |
| JBHT | 3 |
| KER.PA | 6 |
| KNIN.SW | 1 |
| KR | 1 |
| KVUE | 1 |
| LEN | 8 |
| LII | 7 |
| LMT | 7 |
| MAR | 4 |
| MAS | 2 |
| MAS~B | 2 |
| MBG.DE | 8 |
| MELI | 7 |
| MNST | 7 |
| MO | 9 |
| NCLH | 10 |
| NKE | 4 |
| NOC | 5 |
| NSC | 2 |
| ODFL | 6 |
| P911.DE | 7 |
| PAYX | 2 |
| PCAR | 6 |
| PHM | 10 |
| PM | 1 |
| PNR | 3 |
| RCL | 7 |
| RI.PA | 1 |
| RKLB | 10 |
| RL | 8 |
| RMS.PA | 5 |
| RNO.PA | 3 |
| ROK | 4 |
| ROL | 7 |
| RSG | 9 |
| RTX | 5 |
| SAF.PA | 10 |
| SBUX | 2 |
| SGO.PA | 8 |
| SIE.DE | 1 |
| SNA | 10 |
| STLAP.PA | 6 |
| SU.PA | 7 |
| SWK | 1 |
| TAP | 1 |
| TGT | 10 |
| TPR | 10 |
| TSCO | 4 |
| TSN | 10 |
| TXT | 2 |
| UAL | 10 |
| UBER | 8 |
| ULTA | 10 |
| UNA.AS | 1 |
| UNP | 10 |
| UPS | 10 |
| URI | 1 |
| VRSK | 2 |
| WKL.AS | 3 |
| WM | 5 |
| WMT | 10 |
| WSM | 10 |
| WYNN | 10 |
| XYL | 10 |
| YUM | 10 |

## Interprétation

Ce contrôle mesure l'accessibilité technique au moment du passage. Les 222 réponses 200 et la réponse 202 sont accessibles. Les 29 redirections ont été suivies automatiquement. Les 11 réponses 404 sont des échecs explicites; les réponses 400, 403, 405, 429 et 502 ainsi que les délais restent à contrôler manuellement avec un navigateur ou une requête GET autorisée par le site. Les 23 chemins `data-lake` sont des anomalies de schéma certaines. Aucun remplacement n'a été effectué faute d'équivalence officielle certaine vérifiée pour la valeur et l'année concernées.

## Traitement ciblé des 11 réponses 404

Contrôle complémentaire du 2026-09-12 : les onze URL ont été réexaminées contre la même année et la même valeur.

Six URL ont été remplacées par une source officielle équivalente certaine : MELI 2017 par l'exhibit SEC confirmant 270,1 millions d'articles; GM 2020 par le communiqué investisseurs GM; KNIN.SW 2025 par la page du rapport annuel confirmant 4 325 000 TEU; KER.PA 2025 par le document financier Kering confirmant 5 992 millions d'euros; LMT 2021 par la page Lockheed Martin corrigée confirmant 142 livraisons; TXT 2023 et 2024 par le rapport annuel officiel hébergé sur le site investisseurs Textron, confirmant respectivement 168 et 151 jets.

Cinq URL mortes n'ont pas été remplacées faute d'équivalence officielle certaine pour la valeur exacte : GM 2016, 2018 et 2019; RI.PA 2020; RTX 2020 et 2021. Chaque note de fichier indique désormais explicitement le 404 et la conservation du chiffre sans substitution.

`valide.py` a été relancé sur les huit fichiers touchés : MELI 9 points OK; GM 10 points OK; KNIN.SW 10 points OK; RI.PA 10 points OK; RTX 7 points OK; KER.PA 10 points OK; LMT 10 points OK; TXT 10 points OK.
