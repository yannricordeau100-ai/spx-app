---
name: feedback-mettrik-sources-hors-blocs
description: "Aucune source visible dans un bloc de page societe : toutes les sources vont dans le mini bloc du bas, sans attribution"
metadata:
  node_type: memory
  type: feedback
---

Regle posee par Yann le 18 septembre 2026 pour les graphiques moyen terme, puis
ELARGIE A TOUS LES BLOCS le 21 septembre apres qu il a retrouve
« Source : cabinets d etudes sectorielles » dans le bloc du marche adressable
d Hermes. Ses mots : « a quoi ca sert que je te dise de pas mettre de source
dans les blocs si c est pour en plus pas les mettre dans le mini bloc ».

**Regle** : aucun nom de source, de plateforme, d auteur ni de lien de source
dans un bloc de page societe. Ni « Source : X », ni « Selon X », ni « D apres X »,
ni infobulle de source. Tout va dans le mini bloc du bas, rendu par
`src/components/sources-externes.tsx`, sans jamais dire a quel indicateur ou a
quelle information une source correspond.

**Pourquoi** : Yann veut des blocs qui donnent le fait, pas la bibliographie.
La provenance se consulte en bas, globalement, sans revelation de methode.

**Comment appliquer** : quand un texte mele source et precision de methode,
garder la precision (« estimation indicative ») et retirer la source. Ce qui
reste legitime : le cadre d une these (le nom de l investisseur, de la banque ou
de la methode qui structure l analyse), les noms de societes sujets du propos,
et les avertissements de fraicheur. MarketBeat et StockAnalysis sont filtres
meme dans le mini bloc.

**Piege** : une regle donnee sur UN bloc vaut pour TOUS les blocs. Yann cite ce
qu il a sous les yeux, pas le perimetre.

Liens : [[feedback-mettrik-moyen-terme-sources]] [[feedback-mettrik-liens-outils]]
