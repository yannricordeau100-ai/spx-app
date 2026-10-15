# KPI des présentations de résultats, 16 octobre 2026

Périmètre : ASML et les 24 sociétés en retard (audit du 15/10). Chaque valeur retenue a été retrouvée telle quelle dans le texte de la présentation (citation littérale contrôlée par script avant écriture). Les KPI IC sont ajoutés dans `src/data/v2-pipeline/<t>.json` (préfixe `pres_`), les stories dans `stories_kpis` de `src/data/v2-pipeline-enrich/<t>.json`.

Présentations trouvées : 14 (ASML, BAC, BLK, BNY, C, GS, JPM, MS, PLD, PNC, STT, UNH, USB, WFC). Aucune présentation publiée pour : CPB, DPZ, FAST, IBKR, JBHT, JBL, JNJ, MRSH, PGR, RI.PA, SCHW.

| Société | KPI | Classement | Raison | Valeur | Période |
|---|---|---|---|---|---|
| ASML | Part Logique des ventes de systèmes | IC | Répartition par usage final publiée chaque trimestre, absente de la fiche | 54.0 | T3 2026 |
| ASML | Part EUV des ventes de systèmes (en valeur) | IC | Mix technologique en valeur, distinct du nombre d'unités EUV déjà sur la fiche | 49.0 | T3 2026 |
| ASML | Systèmes ArFi (immersion DUV) vendus | IC | Volume DUV immersion publié chaque trimestre, absent de la fiche | 40.0 | T3 2026 |
| ASML | Ventes Installed Base Management | refusé | Définition voisine de CAHIER_INSTALLED_BASE_SERVIC déjà sur la fiche |  |  |
| BAC | Ratio de levier supplémentaire (SLR) | IC | ratio réglementaire publié chaque trimestre, absent de la fiche ; historique limité aux trimestres contigus (2 sur 3) | 5.5 | T3 2026 |
| BAC | Actifs pondérés par les risques (approche standard) | IC | dénominateur du CET1, série trimestrielle stable ; historique limité aux trimestres contigus (2 sur 3) | 1824 | T3 2026 |
| BAC | Actions ordinaires en circulation | IC | mesure directe des rachats, publiée chaque trimestre ; historique limité aux trimestres contigus (2 sur 3) | 6.92 | T3 2026 |
| BAC | Comptes d'investissement Consumer Banking | IC | nombre de comptes, distinct des actifs déjà sur la fiche | 4.2 | T3 2026 |
| BAC | Ventes numériques Consumer | story | valeur ponctuelle | 2341 | T3 2026 |
| BAC | Croissance des dépenses cartes clients | story | valeur ponctuelle | 7 | T3 2026 |
| BAC | Ratio CET1 (approche avancée) | refusé | définition voisine du CET1 standard déjà sur la fiche |  |  |
| BLK | Levée brute marchés privés | refusé | valeurs extraites des graphiques sans attribution certaine (levée vs déploiement), pas d'historique |  |  |
| BLK | Capital disponible marchés privés | refusé | déjà sur la fiche (CAHIER_DRY_POWDER) |  |  |
| BLK | Commissions de base et prêt de titres | refusé | définition voisine des commissions de gestion déjà sur la fiche |  |  |
| BNY | Ordres quotidiens moyens Pershing (DARTs, plateforme US) | IC | indicateur d'activité Pershing publié chaque trimestre ; historique limité aux trimestres contigus (2 sur 3) | 299 | T3 2026 |
| BNY | Comptes de compensation actifs moyens | IC | nombre de comptes Pershing, série stable ; historique limité aux trimestres contigus (2 sur 3) | 8832 | T3 2026 |
| BNY | Volume quotidien moyen de paiements en dollars | IC | volume Treasury Services publié chaque trimestre ; historique limité aux trimestres contigus (2 sur 3) | 257345 | T3 2026 |
| BNY | Programmes de certificats de dépôt (Depositary Receipts) | IC | nombre de programmes, série stable ; historique limité aux trimestres contigus (2 sur 3) | 1670 | T3 2026 |
| BNY | Ratio de levier Tier 1 | refusé | limite de 4 IC atteinte |  |  |
| BNY | Taux de distribution total | refusé | déjà sur la fiche |  |  |
| C | Revenus de conseil (Banking) | IC | ventilation des revenus de banque d'investissement, absente de la fiche ; historique limité aux trimestres contigus (5 sur 6) | 406.0 | T3 2026 |
| C | Revenus d'émission d'actions | IC | ventilation trimestrielle stable ; historique limité aux trimestres contigus (5 sur 6) | 343.0 | T3 2026 |
| C | Revenus d'émission de dette | IC | ventilation trimestrielle stable ; historique limité aux trimestres contigus (5 sur 6) | 601.0 | T3 2026 |
| C | Comptes actifs moyens cartes privatives (Retail Services) | story | nombre de comptes publié chaque trimestre ; seul le T3 2026 figure en valeur ; un seul trimestre publié : classé en story | 21379 | T3 2026 |
| GS | Actifs liquides de premier rang moyens (GCLA) | IC | réserve de liquidité publiée chaque trimestre ; historique limité aux trimestres contigus (2 sur 3) | 574 | T3 2026 |
| GS | Ratio de levier supplémentaire (SLR) | IC | ratio réglementaire absent de la fiche ; historique limité aux trimestres contigus (2 sur 3) | 4.3 | T3 2026 |
| GS | Rentabilité des fonds propres Global Banking & Markets | story | rentabilité par segment publiée chaque trimestre ; un seul trimestre publié : classé en story | 20.7 | T3 2026 |
| GS | Rentabilité des fonds propres Asset & Wealth Management | story | rentabilité par segment publiée chaque trimestre ; un seul trimestre publié : classé en story | 16.1 | T3 2026 |
| GS | Trimestres consécutifs de collecte nette long terme | story | valeur ponctuelle | 35 | T3 2026 |
| GS | Dépôts des particuliers | story | valeur ponctuelle | 230 | T3 2026 |
| JPM | Actifs en conservation (CIB, fin de période) | IC | Métrique Securities Services publiée chaque trimestre, absente de la fiche | 44107.0 | T3 2026 |
| JPM | Nombre de conseillers clients (Wealth Management groupe) | IC | Effectif commercial gestion de fortune, série trimestrielle stable | 10893.0 | T3 2026 |
| JPM | Encours de prêts cartes de crédit (fin de période) | IC | Encours cartes, moteur de marge, publié chaque trimestre | 252697.0 | T3 2026 |
| JPM | VaR moyenne (95 %) | IC | Risque de marché moyen du trimestre, série stable | 48.0 | T3 2026 |
| JPM | Clients digitaux actifs | refusé | Définition voisine de MobileCust (clients mobiles actifs) déjà sur la fiche |  |  |
| JPM | Ratio de levier supplémentaire | refusé | Valeur T3 2026 provisoire (renvoi (b)), ratio réglementaire secondaire face au CET1 |  |  |
| MS | Ressources de liquidité moyennes | IC | Coussin de liquidité publié chaque trimestre, absent de la fiche ; historique limité aux trimestres contigus (2 sur 3) | 439909.0 | T3 2026 |
| MS | Prêts sur marge et autres (Wealth Management) | IC | Encours de financement des clients, distinct des prêts bancaires WM_loans ; historique limité aux trimestres contigus (2 sur 3) | 37.1 | T3 2026 |
| MS | Coût moyen pondéré annualisé des dépôts (moyenne de période) | IC | Coût de financement WM, série trimestrielle stable ; historique limité aux trimestres contigus (2 sur 3) | 2.72 | T3 2026 |
| MS | Participants aux plans d'actions (Workplace) | IC | Taille du canal Workplace, source de collecte future ; historique limité aux trimestres contigus (2 sur 3) | 6.7 | T3 2026 |
| PLD | Investissements de maintien en % du NOI (moyenne 4 trimestres) | IC | Intensité capitalistique d'entretien du parc, série trimestrielle stable | 14.1 | T3 2026 |
| PLD | Coûts de relocation totaux (TI + commissions, parc détenu et géré) | IC | Coût de relocation, publié chaque trimestre | 251942.0 | T3 2026 |
| PLD | Dette / EBITDA ajusté | IC | Levier financier publié chaque trimestre | 4.5 | T3 2026 |
| PLD | Dette en % des actifs immobiliers bruts | IC | Levier sur actifs, publié chaque trimestre | 34.3 | T3 2026 |
| PLD | Propositions de bail en cours | story | Indicateur avancé publié en graphique sans historique chiffré | 134.0 | T3 2026 |
| PLD | Délai de négociation des nouveaux baux | story | Valeur graphique sans historique chiffré | 50.0 | T3 2026 |
| PLD | Taux d'occupation moyen | refusé | Définition voisine de occupancy_rate déjà sur la fiche |  |  |
| PNC | Nombre d'agences | IC | Réseau physique publié chaque trimestre, absent de la fiche (seul l'investissement d'expansion y figure) | 2302.0 | T3 2026 |
| PNC | Portefeuille de prêts immobiliers commerciaux gérés pour compte | IC | Activité de gestion de prêts, série trimestrielle stable | 294.0 | T3 2026 |
| PNC | Encours de prêts cartes de crédit | IC | Encours cartes, série trimestrielle | 7527.0 | T3 2026 |
| PNC | Volume de production de prêts immobiliers résidentiels | IC | Production trimestrielle publiée à chaque trimestre | 1.4 | T3 2026 |
| PNC | Actifs non performants / prêts | refusé | Définition voisine de NPL déjà sur la fiche |  |  |
| PNC | Revenus Treasury Management | refusé | Définition voisine de CCM_FEE déjà sur la fiche |  |  |
| STT | Collecte nette Investment Management (trimestre) | IC | Flux nets totaux SSGA, distincts des seuls flux ETF déjà sur la fiche | 7.0 | T3 2026 |
| STT | Portefeuille de titres d'investissement moyen | IC | Principal actif productif d'intérêts, série trimestrielle | 108.0 | T3 2026 |
| STT | Dépôts non rémunérés moyens | IC | Financement gratuit, moteur du produit net d'intérêts, publié chaque trimestre | 29.0 | T3 2026 |
| STT | Marge nette d'intérêt (FTE) | refusé | Déjà sur la fiche (NIM) |  |  |
| STT | Marge avant impôt hors éléments notables | refusé | Définition voisine de Pre-tax Margin déjà sur la fiche |  |  |
| STT | Ratio de liquidité à court terme | refusé | Ordre des colonnes non vérifiable dans le texte |  |  |
| UNH | Membres Medicare Part D autonome | IC | Membres publiés chaque trimestre, absents de la fiche ; historique limité aux trimestres contigus (2 sur 4) | 2690.0 | T3 2026 |
| UNH | Membres Medicare Supplement (standardisé) | IC | Membres publiés chaque trimestre, absents de la fiche ; historique limité aux trimestres contigus (2 sur 4) | 4245.0 | T3 2026 |
| UNH | Membres Commercial à risque | IC | Sous-ensemble assuré du commercial, moteur du ratio médical, distinct du total COMM_ENROLL ; historique limité aux trimestres contigus (2 sur 4) | 7575.0 | T3 2026 |
| UNH | Membres Medicare Advantage en plans 4 étoiles et plus | story | Valeur annuelle ponctuelle | 69.0 | T3 2026 |
| UNH | Baisse des seniors servis en Medicare Advantage depuis fin 2025 | refusé | refusé à la vérification : valeur non retrouvée telle quelle (T3 2026) | -935000.0 | T3 2026 |
| UNH | Membres Commercial en gestion pour compte | refusé | Complément de COMM_ENROLL, une seule des deux composantes retenue |  |  |
| USB | Coût total des dépôts | IC | Coût de financement publié chaque trimestre, absent de la fiche ; seconde série du graphique (la plus basse, dépôts non rémunérés inclus) | 1.88 | T3 2026 |
| USB | Taux de pertes nettes sur cartes de crédit | IC | Qualité de crédit du portefeuille cartes, distincte du NCO groupe | 3.29 | T3 2026 |
| USB | Encours moyen de prêts immobiliers résidentiels | IC | Encours par portefeuille, série trimestrielle | 116886.0 | T3 2026 |
| USB | Encours moyen de prêts commerciaux | IC | Encours par portefeuille, série trimestrielle | 155360.0 | T3 2026 |
| USB | Encours moyen cartes de crédit | refusé | Déjà sur la fiche (Average credit card loans) |  |  |
| USB | Coût total du financement | refusé | Ordre des séries ambigu dans le texte extrait |  |  |
| WFC | Rendement moyen total des prêts | IC | Rendement des prêts, distinct du rendement des actifs productifs déjà sur la fiche | 5.65 | T3 2026 |
| WFC | Produit net d'intérêts des activités de marché | IC | Composante volatile du NII publiée chaque trimestre | 428.0 | T3 2026 |
| WFC | Encours moyen de prêts commerciaux | refusé | Attribution des séries consommateurs/entreprises ambiguë dans le texte extrait |  |  |

Ajoutés par société (IC / stories) : ASML 3/0, BAC 4/2, BNY 4/0, C 3/1, GS 2/4, JPM 4/0, MS 4/0, PLD 4/2, PNC 4/0, STT 3/0, UNH 3/1, USB 4/0, WFC 2/0
