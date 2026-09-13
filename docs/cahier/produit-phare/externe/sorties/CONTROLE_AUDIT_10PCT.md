# Audit reproductible de 10 % des séries P2

## Méthode

Population auditée : 108 fichiers P2 ayant `statut: "ok"`. L'échantillon de 16 fichiers, soit 14,8 % de la population, a été obtenu en triant les noms de fichiers, puis en appliquant `random.Random(20260912).shuffle`. La graine fixe `20260912` rend le tirage reproductible.

Pour chaque fichier, chaque valeur non nulle a été rapprochée de l'extrait de sa source primaire. Le nombre de valeurs a été comparé au nombre de sources annuelles. Les deux contrôles secondaires au minimum ont ensuite été relus : année contrôlée, URL indépendante, valeur annoncée et champ `concorde`. Les conversions explicites d'unités ont été vérifiées séparément.

## Échantillon et résultats

| Fichier | Points | Sources annuelles | Contrôles secondaires | Résultat |
|---|---:|---:|---:|---|
| LMT.json | 10 | 10 | 2 | Conforme |
| P911.DE.json | 10 | 10 | 3 | Conforme |
| NSC.json | 7 | 7 | 3 | Conforme |
| AD.AS.json | 5 | 5 | 2 | Conforme |
| VOW3.DE.json | 5 | 10 | 2 | Conforme, sources supplémentaires pour années nulles |
| MAS~B.json | 10 | 10 | 2 | Conforme |
| MELI.json | 9 | 9 | 3 | Conforme après contrôle de l'unité : 2,4 milliards correspondent à 2 400 millions |
| WSM.json | 10 | 10 | 2 | Conforme |
| PHM.json | 10 | 10 | 2 | Conforme |
| HEN.DE.json | 10 | 10 | 2 | Conforme |
| KER.PA.json | 10 | 10 | 2 | Conforme |
| ODFL.json | 6 | 10 | 3 | Conforme, sources supplémentaires pour années nulles |
| ROK.json | 6 | 6 | 2 | Conforme |
| HLT.json | 8 | 10 | 2 | Conforme, sources supplémentaires pour années nulles |
| RTX.json | 7 | 7 | 2 | Conforme dans le périmètre proxy déclaré dans la note |
| SNA.json | 10 | 10 | 2 | Conforme après rapprochement des valeurs précises avec la seconde source; les extraits Macrotrends sont arrondis au million |

## Contrôles secondaires

Les 37 entrées de contrôle secondaire des 16 fichiers comportent une année présente dans la série, une URL distincte de la source primaire correspondante et `concorde: true`. Aucun contrôle secondaire manquant n'a été relevé. Les fichiers P911.DE, NSC, MELI et ODFL fournissent un troisième contrôle au-delà du minimum demandé.

## Écarts et corrections

Aucun écart numérique certain n'a été constaté. Deux alertes automatiques provenaient du format des extraits et non des données : MELI exprime 2025 en milliards alors que le KPI est en millions; SNA conserve une décimale issue de la source de contrôle tandis que les extraits primaires affichent le million arrondi. Aucune valeur n'a donc été modifiée et aucun chiffre n'a été inventé.

Tous les fichiers échantillonnés conservent leur validation structurelle antérieure. Aucun fichier P2 n'a nécessité de correction ou de nouveau passage de `valide.py`.
