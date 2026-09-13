# Controle final P2 — bloc 2

Date du controle : 2026-09-11

## Resultat global

- 27 fichiers P2 presents dans le bloc et controles.
- 27 fichiers sur 27 acceptes par `valide.py`.
- 227 valeurs numeriques publiees et 43 exercices explicitement laisses a `null`.
- 69 controles secondaires renseignes, soit au moins deux par fichier.
- 296 references URL renseignees, correspondant a 207 URL uniques.
- Toutes les URL renseignees utilisent un schema HTTP(S) valide; aucun champ URL mal forme ou vide pour une valeur numerique.
- Tous les objets contiennent les rubriques attendues : `ticker`, `produit`, `kpi`, `annees`, `estime`, `sources`, `controle`, `note` et `statut`.

## Fichiers valides

`KR`, `KVUE`, `LEN`, `LII`, `LMT`, `LOW`, `LUV`, `MAR`, `MAS`, `MBG.DE`, `MELI`, `MNST`, `MO`, `NCLH`, `NKE`, `NOC`, `NSC`, `ODFL`, `P911.DE`, `PAYX`, `PCAR`, `PH`, `PHM`, `PM`, `PNR`, `PUM.DE`, `RCL`.

## Controles secondaires

Chaque fichier possede au moins deux controles secondaires avec une URL distincte et `concorde: true`. Les URL secondaires sont distinctes entre elles dans chaque fichier.

Six controles secondaires sont heberges sur le meme domaine institutionnel que la source principale de l'annee controlee : `LII` (2021), `MAS` (2022), `PH` (2022), `PM` (2016), `PNR` (2025) et `PUM.DE` (2021). Ils correspondent a des documents ou pages distincts et chacun de ces fichiers possede egalement au moins un autre controle provenant d'un domaine different.

Les deux controles de `LMT.json` ont ete remplaces pendant cette revue par des sources independantes de Lockheed Martin : Reuters/Investing.com pour les 91 livraisons de 2018 et le U.S. Government Accountability Office pour les 110 livraisons de 2024. Les deux pages sont indexees et concordent avec la serie.

## Anomalies et limites conservees

- `KR.json` porte le statut `echec` malgre six valeurs numeriques et une validation technique reussie, car l'historique produit reste incomplet.
- `KVUE.json` porte le statut `echec` malgre cinq valeurs numeriques et une validation technique reussie, car l'historique comparable commence avec le perimetre Self Care disponible.
- `NKE.json` contient neuf valeurs et laisse 2025 a `null` apres le changement de presentation signale dans sa note.
- `MAR.json`, `LOW.json`, `ODFL.json`, `PCAR.json` et `PNR.json` comportent six valeurs; les exercices non disponibles restent explicitement a `null`.
- `LII.json`, `NSC.json` et `PAYX.json` comportent sept valeurs; les exercices non publies de facon comparable restent a `null`.
- `MBG.DE.json` comporte huit valeurs et `MELI.json` ainsi que `PH.json` en comportent neuf.
- Aucun chiffre n'a ete ajoute pour combler ces lacunes et aucun element n'est marque comme estime.

## Conclusion

Le bloc est techniquement valide. Aucune correction de structure ou de valeur n'a ete necessaire. Deux URL de controle de `LMT.json` ont ete corrigees afin d'assurer une independance editoriale effective. Les limites ci-dessus sont documentees et ne provoquent aucune erreur du validateur.
