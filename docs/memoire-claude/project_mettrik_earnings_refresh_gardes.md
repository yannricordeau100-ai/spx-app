---
name: project_mettrik_earnings_refresh_gardes
description: Regression du rafraichissement des resultats Mettrik corrigee le 28 aout 2026, et les trois garde-fous ajoutes
metadata:
  type: project
---

`scripts/earnings-refresh.py` (lance en masse par `scripts/refresh-superviseur.py`)
corrompait les series : chiffre trimestriel colle a la fin d une serie annuelle,
et republication du dernier point a l identique. Corrige le 28 aout 2026.

Les trois causes, a reverifier si le defaut revient :
- le controle de periode lisait `kpi["frequency"]`, champ inexistant ; les fiches
  portent `period_type` (year / quarter / semester). Une frequence inconnue est
  desormais refusee, plus acceptee.
- `echelle_compatible` (nouveau) : un point doit tenir dans le tiers au triple des
  quatre derniers points de sa propre serie.
- `deja_present` (nouveau) : `last_period` rend None des que l historique est une
  liste de nombres, donc la garde anti-reecriture ne se declenchait jamais.

Les rejets sont comptes par motif dans le log (`motifs={...}`), ce qui permet de
distinguer un garde-fou utile d un garde-fou trop serre.

**Pourquoi :** le superviseur tourne sans surveillance pendant des heures et
touche des centaines de fiches ; un point mal range ne se voit qu a l affichage.

**Comment l appliquer :** avant de commiter un lot du superviseur, comparer
semantiquement HEAD et l arbre de travail (pas le diff textuel : ces scripts
reecrivent le JSON sur une ligne). Deux detecteurs sont la pour ca :
`scripts/scan-unit-magnitude.py` et `scripts/scan-stale-descriptions-large.py`.
Voir [[project_mettrik_ca_pipeline_regression]] et [[reference_mettrik_casse_fichiers]].
