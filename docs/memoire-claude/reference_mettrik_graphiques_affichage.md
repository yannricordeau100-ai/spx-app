---
name: reference-mettrik-graphiques-affichage
description: "Graphiques moyen terme : jumeau PNG pour Safari, valeurs horizontales, unite sur l axe, generation et regeneration"
metadata:
  node_type: memory
  type: reference
---

**Double affichage, 21 septembre 2026.** Safari affichait un carre avec un point
d interrogation a la place de certains graphiques, alors que le SVG etait valide
et servi avec le bon type. Plutot que de chercher indefiniment la cause,
`scripts/findings-png.js` genere un jumeau PNG de chaque graphique
(`node scripts/findings-png.js --liste <fichier de chemins>`, pour ne convertir
que les graphiques presents en base et ne pas alourdir le depot). L apercu sert
le PNG en premier, puis redescend sur le SVG, puis sur l image d origine.
Le bloc de la fiche societe injecte le SVG en ligne et bascule sur le PNG en cas
d echec.

**Lisibilite, regles de Yann** : les valeurs s ecrivent NORMALEMENT, a
l horizontale, taille reduite jusqu a 8 pixels si besoin, verticales seulement
si aucune taille lisible ne tient ; jamais le signe pourcent sur les barres ;
l unite est ecrite une seule fois au milieu de l axe vertical, decalee a gauche
des graduations (`%` pour les pourcentages, sinon le champ `unite_axe` de la
spec) ; espace franc entre les series de la legende.

**Regeneration complete** : boucler `python3 scripts/finding-svg.py` sur
`scripts/specs-findings/*.json` et `scripts/specs-findings/*/*.json` (environ
1 727 specs), puis relancer la generation des PNG.

**Publication** : `python3 scripts/kpi-mt-publie-specs.py <TICKER> --titre "..."
--max N --publie`. Le controle exige que chaque citation se retrouve mot pour
mot dans la page citee et que 80 pour cent des valeurs y figurent. Une source
bloquee aux robots (Ofcom renvoie 403) se cite par un PDF telecharge dans /tmp :
le script sait lire un chemin local.

Liens : [[feedback-mettrik-moyen-terme-sources]] [[reference-mettrik-kpi-ecriture-series]]
