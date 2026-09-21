---
name: reference-mettrik-definitions-kpi
description: Vocabulaire officiel Mettrik (12 sept 2026) - KPI total, KPI IC total, KPI = type de KPI comparable ; regle du concurrent
metadata:
  type: reference
---

Definitions posees par Yann le 12 sept 2026 (page /sandbox/kpi-definitions) :
- **KPI total** = tous les KPI IC (standard + avances) + KPI stories.
- **KPI IC total** = tous les KPI IC (standard + avances).
- **Types de KPI** (nom valide par Yann le 12 sept) = nombre de types de KPI IC differents (standard + avances), compte sur l univers ET par societe. Un type = une mesure qu un concurrent peut publier, meme en theorie (suffit). Sinon = KPI unique.
- Exemples Google : types = nombre d employes, BPA dilue, nombre de systemes d exploitation mobile sur le marche, cout d acquisition de trafic. PAS des types = nombre de systemes Android, villes desservies par Waymo, part de marche de Chrome.
- Waymo valide : villes desservies par Waymo -> villes couvertes par un service de robotaxi.
- Transformation : un KPI unique dont l actif sous-jacent est comparable devient un type en generalisant (part de marche de Chrome -> part de marche des navigateurs web). Toute « part de marche [X] » est eligible. Tous les KPI ne sont pas transformables.
- Pas de colonne en plus dans le tableau : le type generique va dans un champ de donnees invisible, affiche dans le « i » et utilise par le Comparer.
- Tout renommage de ces termes attend la validation de Yann.

Lie a [[project-mettrik-comparer]] et [[project-cahier-gics]].
