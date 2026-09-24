# Floutage fin : une partie par petit element de chaque bloc

Demande de Yann, 24 septembre 2026 : « je prefere avoir un peu trop de
personnalisation de floutage que pas assez ». Reprise bloc par bloc de tout ce
qui a ete ajoute ou modifie depuis le 4 septembre. Les blocs de taille
variable selon la societe (nombre de risques, de segments, d indicateurs, de
citations) recoivent des parties « par element » (chaque ligne, chaque carte),
pas seulement « le tableau » : le floutage s adapte alors a la taille reelle.

Regle technique : une partie n existe que si le composant emet
`data-blur-part="<partie>"` sur l element ; sinon la zone est morte dans
l outil. Controle apres travaux : `scripts/verif-floutage-parties.ts` charge
chaque composant et verifie que chaque partie declaree dans
`PARTIES_PAR_BLOC` est emise au moins une fois.

| Bloc | Parties existantes | Parties a ajouter (element) |
|---|---|---|
| hero | graphique, variation | titre, valeur, source, qualite, cagr, percentile, interpretation |
| kpis / kpis_standard | tableau, valeur, variation, indicateur, qualite, voir-plus | ligne (chaque KPI), signal, historique (sparkline), unite |
| stories | texte, titre | carte (chaque story), valeur, periode, source |
| repartition | (aucune) | titre, graphique, tableau, ligne (chaque segment), pourcentage, onglets |
| governance | texte | titre, tableau, ligne (chaque mesure), ceo, remuneration, top3-votes, top3-capital, vote-remuneration |
| risks | titre, note | texte (chaque risque), categorie, tendance, source, citation, carte (chaque risque) |
| ai_positioning | (aucune) | titre, categorie, texte, citation (chaque), original (le i), source |
| transcripts | texte | titre, fleches, suivi-kpi, cites-une-fois, ligne (chaque KPI), citation, source, date |
| these / antithese | texte, titre | hook, resume, points (chaque), preuve (le i), glossaire |
| moat | niveau, tendance, texte, titre | justification, confiance, depuis |
| clients | graphique, texte, titre, valeur, noms | top10, commentaire, source |
| tam | (composant : titre, valeur, graphique, texte, source) | segment (chaque position), croissance, fourchette, methodologie (le i) |
| image_findings | mt_titre, mt_sources, mt_fleches | graphique (chaque), legende, valeur, source (chaque) |
| dividend / events / ranks / unites / prochains_resultats | partiel ou aucun | titre, tableau, ligne, valeur, date |
| comprendre (profile) | (aucun bloc) | bloc `comprendre` : activite, produits, clients, force, avance (4 sections), snapshot |
| capacite (nouveau bloc) | (aucun) | titre, synthese, reglage, ligne (ROIC, ROE), chiffre, ecart, reserve |

Etapes : 1) ajouter les parties au type `PartieDeBloc` et a `LIBELLES_PARTIES` ;
2) baliser chaque composant (les elements repetes portent la meme partie,
donc le floutage suit le nombre reel d elements) ; 3) mettre a jour
`PARTIES_PAR_BLOC` et la page /sandbox/floutage ; 4) controle automatique
partie par partie sur trois fiches de tailles differentes (AAPL, DPW.DE,
petite societe) ; 5) deploiement preversion puis go n0.
Estimation : 4 a 5 h. Rien de tout cela ne change les reglages deja enregistres.
