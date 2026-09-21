---
name: project-mettrik-ateliers-kpi
description: "Deux ateliers de recherche d indicateurs construits le 21 sept 2026, verrouilles tant que Yann n a pas donne le feu vert"
metadata:
  node_type: memory
  type: project
---

Yann veut trouver les indicateurs qui interessent vraiment les investisseurs,
hors de ceux deja presents et hors ratios financiers. Deux ateliers ont ete
construits, AUCUNE recherche ne doit etre lancee sans son feu vert explicite.

**`/sandbox/kpi-pistes`, « Trouver les bons KPI »**, table `desk_kpi_pistes`,
cinq sous onglets, un par methode :
1. questions repetees des analystes en seance ;
2. regulateurs et federations du secteur (`src/data/kpi-regulateurs.json`) ;
3. concurrents, par arbre groupe d industries puis sous industrie ;
4. referentiel par sous industrie, ce qui reste non couvert ;
5. journees investisseurs, deux tableaux.

**`/sandbox/kpi-non-financiers`**, table `desk_kpi_non_financiers` : Yann saisit
des tickers, coche des criteres, recoit des propositions a cocher puis a
enregistrer. Definition retenue : non financier veut dire introuvable sur un
comparateur boursier de selection de titres. Le prix moyen d un abonnement est
accepte, le benefice par action est refuse.
**Une demande attend depuis le 21 septembre 00h02 : MC.PA, statut a traiter.**

**Regle arretee apres test sur MPWR, YUM et AMGN** : une seule conference de
resultats par societe, la derniere. La deuxieme apporte 57 pour cent d idees en
plus pour 100 pour cent de cout en plus, et presque rien des que la fiche
depasse 25 indicateurs. Les transcriptions sont dans
`src/data/transcripts/<ticker>.json`, champ `latest.content`, 747 societes, un
seul appel chacune.

**Economie imposee** : isoler la section des questions par script AVANT toute
lecture par un modele, ne jamais avaler un transcript entier, et faire tourner
ces passes sur Haiku ou un moteur gratuit, jamais sur Opus.

Liens : [[project-cahier-gics]] [[reference-mettrik-definitions-kpi]]
