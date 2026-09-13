# Transfert complet Mettrik

Ce paquet contient les éléments nécessaires pour reprendre ou contrôler la mission :

- `MISSION.md` : instructions de référence.
- `societes-a-traiter.json` : liste source des 168 sociétés.
- `identification-deja-faite.json` : identifications fournies au départ.
- `valide.py` : validateur des séries P2.
- `exemples/` : formats de référence.
- `sorties/P1/` : 168 identifications.
- `sorties/V1/` : 168 vérifications indépendantes.
- `sorties/P2/` : 161 fichiers, dont 158 séries principales et 3 variantes historiques.
- `sorties/EXCEPTIONS.json` et `sorties/ARBITRAGES_PROPRIETAIRE.json` : exceptions et décisions.
- `sorties/RAISONS_INDISPONIBILITE.json` : 53 KPI indisponibles et 10 sociétés sans produit physique, avec leur raison.
- `sorties/JOURNAL.md`, `sorties/CONTROLE.md`, `sorties/MANIFESTE.txt` et les rapports de contrôle complémentaires.

AMZN, AXON et DD ne figurent pas dans `societes-a-traiter.json` et n'ont donc aucun fichier P1, V1 ou P2 dans cette mission.
