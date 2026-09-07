# Unités des KPI du secteur Matériaux (GICS 15)

Relevé exhaustif du champ `unit` des KPI des 36 sociétés des lots `docs/cahier/donnees/_lots/15-*.json`, dans `src/data/companies/<ticker>.json` et `.batches-drafts-safe/kpis-haut/<TICKER>.json`.

Les graphies différentes d'une même unité sont regroupées sur une seule ligne, la première forme citée étant la plus fréquente. Les mentions entre parenthèses ajoutées dans certains fichiers (par exemple « % (approx) », « M$ (annuel) ») sont des annotations de contexte, pas des unités distinctes : elles sont rattachées à l'unité de base.

## Monnaies et montants

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `Mds $` (`$B`, `Md $`, `Md USD`, `Mds USD`, `G$`, `Bn USD`, `billion USD`, `Mds`) | Milliards de dollars américains | Montant exprimé en milliards de dollars | 1 milliard de dollars en coupures de 100 dollars, c'est 10 millions de billets ; une épaisseur de billet étant de 0,1092 mm, la pile atteint environ 1 090 mètres, soit à peu près trois fois la hauteur de la tour Eiffel |
| `M $` (`M USD`, `$M`, `M$`, `MUSD`, `M`) | Millions de dollars américains | Montant exprimé en millions de dollars | 1 million de dollars en coupures de 100 dollars, c'est 10 000 billets, une pile d'environ 1,09 mètre, la hauteur d'un comptoir de cuisine posé sur une chaise |
| `Mds €` (`Mds EUR`, `€B`) | Milliards d'euros | Montant exprimé en milliards d'euros | 1 milliard d'euros en billets de 500 euros, c'est 2 millions de billets, environ 2,2 tonnes de papier, le poids d'une grosse camionnette chargée |
| `M€` (`M €`, `M EUR`, `K Mln EUR`) | Millions d'euros | Montant exprimé en millions d'euros | 1 million d'euros en billets de 50 euros pèse environ 20 kg, le poids d'une valise de soute bien remplie |
| `€` (`EUR`) | Euro | Montant unitaire en euros | Un euro, une pièce de 7,5 grammes, le poids de deux morceaux de sucre |
| `$` (`USD`) | Dollar américain | Montant unitaire en dollars | Un dollar, un billet de 1 gramme, le poids d'un trombone |
| `M CHF` (`Mds CHF`, `CHF`, `CHFB`) | Francs suisses, en millions ou milliards | Montant exprimé en monnaie suisse | 1 million de francs suisses en billets de 200 francs, c'est 5 000 billets, une pile d'environ 55 cm, la hauteur d'une caisse de déménagement |
| `$/action` (`USD/action`, `USD/share`) | Dollars par action | Montant rapporté à une action, typiquement bénéfice ou dividende par action | 1 dollar par action sur 500 millions d'actions représente 500 millions de dollars distribués, l'équivalent d'environ 16 000 voitures citadines neuves à 30 000 dollars |

## Prix par quantité physique

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `USD/tonne` (`$/ton`, `$/t`, `$/tonne`, `USD/ton`, `$ / tonne`) | Dollars par tonne | Prix de vente ou coût pour une tonne de produit (ciment, acier, engrais, granulats) | 100 dollars la tonne, c'est 10 centimes le kilo : le prix d'un sac de ciment de 25 kg revient alors à 2,50 dollars |
| `K $/ton` (`K $/tonne`, `k$/tonne`, `K $/t LCE`) | Milliers de dollars par tonne | Prix pour une tonne, exprimé en milliers de dollars, pour des produits de forte valeur comme les sels de lithium | 20 000 dollars la tonne, c'est 20 dollars le kilo, à peu près le prix au kilo d'un fromage affiné |
| `$/lb` (`USD/lb`, `USD per pound`) | Dollars par livre | Prix pour une livre anglo-saxonne, soit 0,4536 kg ; unité de référence du cuivre | 4 dollars la livre, c'est 8,82 dollars le kilo ; une pièce de cuivre de la taille d'une brique pèse environ 3 kg |
| `$/oz` (`K $/oz`, `$/once`, `USD per ounce`) | Dollars par once troy | Prix pour une once troy, soit 31,103 grammes ; unité de référence de l'or | Une once troy d'or, c'est un lingotin de la taille d'une pièce de 2 euros un peu épaissie, pesant autant qu'une tablette de chocolat de 30 grammes |
| `USD/kg` (`$/kg LCE`) | Dollars par kilogramme | Prix pour un kilogramme de produit | 10 dollars le kilo, c'est le prix au kilo d'un poulet fermier |
| `$/MMBtu` | Dollars par million de British thermal units | Prix de l'énergie, surtout le gaz naturel ; 1 MMBtu vaut 1,055 gigajoule, soit 293 kWh | 1 MMBtu, c'est environ 293 kWh, la consommation électrique mensuelle d'un petit appartement chauffé à l'électricité de façon modérée |
| `$/yd³` | Dollars par verge cube | Prix pour une verge cube de matériau, soit 0,7646 m³ ; unité américaine des granulats et du béton | Une verge cube, c'est 765 litres, environ cinq baignoires standard de 150 litres |

## Masses et volumes de production

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `Mt` (`M tonnes`, `M tons`, `millions de tonnes`, `M t`, `M tonnes metriques`) | Millions de tonnes | Volume de production ou capacité exprimé en millions de tonnes | 1 million de tonnes, c'est environ 100 fois le poids de la structure métallique de la tour Eiffel, qui pèse 10 100 tonnes |
| `kt` (`K tons`, `K tonnes`, `k tonnes`, `k tonnes brutes`, `k tons`, `000s tonnes`) | Milliers de tonnes | Volume exprimé en milliers de tonnes | 1 000 tonnes, c'est environ 700 voitures citadines de 1,4 tonne, soit un parking de supermarché plein |
| `tonnes` (`t`) | Tonne métrique | 1 000 kilogrammes | Une tonne, c'est le poids d'une petite voiture citadine |
| `Gt` (`Mds tonnes`, `Mds t`) | Milliards de tonnes | Volume exprimé en milliards de tonnes, réservé aux réserves minières ou aux granulats | 1 milliard de tonnes, c'est environ 100 000 fois le poids de la structure de la tour Eiffel |
| `M net tons` (`milliers de tonnes courtes`, `tons`, `tons/an`, `M tons/an`) | Tonnes courtes américaines | Unité américaine valant 907,2 kg, soit 9 % de moins que la tonne métrique ; usuelle pour l'acier aux États-Unis | 1 million de tonnes courtes, c'est 907 200 tonnes métriques, soit environ 90 fois le poids de la structure de la tour Eiffel |
| `Moz` (`Koz`, `K oz`, `k oz`, `koz`, `thousand ounces`, `Koz/an`) | Millions ou milliers d'onces troy | Quantité de métal précieux ; 1 once troy vaut 31,103 grammes | 1 Moz d'or vaut environ 31 tonnes, le poids de 5 éléphants d'Afrique de 6 tonnes ; 1 koz vaut 31,1 kg, le poids d'un enfant de dix ans |
| `M lbs` (`Mlbs`, `mm lbs`, `million pounds`, `M livres`, `Md lbs`, `Mds lbs`, `M lbs/an`) | Millions de livres | Quantité de métal, surtout le cuivre ; 1 livre vaut 0,4536 kg | 1 million de livres, c'est 453,6 tonnes, le poids d'environ 320 voitures citadines |
| `kt LCE` (`kt Li métal`) | Milliers de tonnes d'équivalent carbonate de lithium, ou de lithium métal | Unité de référence du lithium ; le carbonate de lithium contient environ 18,8 % de lithium métal | 1 kt de LCE, c'est 1 000 tonnes, de quoi équiper environ 25 000 batteries de voiture électrique de 60 kWh, qui consomment chacune de l'ordre de 40 kg de LCE |
| `g/t` | Grammes par tonne | Teneur d'un minerai : masse de métal contenue dans une tonne de roche | 1 g/t, c'est un trombone de 1 gramme dissous dans le volume de roche d'une petite voiture d'une tonne |
| `Mm3` | Millions de mètres cubes | Volume, par exemple de gaz ou de réserves de granulats | 1 million de m³, c'est 400 piscines olympiques de 2 500 m³ |
| `M gallons` | Millions de gallons américains | Volume de liquide ; 1 gallon US vaut 3,785 litres | 1 million de gallons, c'est 3 785 m³, soit une piscine olympique et demie |
| `Mds litres/an` (`litres`) | Milliards de litres par an | Volume annuel de liquide traité ou vendu | 1 milliard de litres, c'est 400 piscines olympiques par an |
| `M yd³` | Millions de verges cubes | Volume de granulats ou de béton ; 1 verge cube vaut 0,7646 m³ | 1 million de verges cubes, c'est 765 000 m³, soit 306 piscines olympiques |
| `kb/j` | Milliers de barils par jour | Débit d'une raffinerie ou d'un craqueur ; 1 baril vaut 158,99 litres | 100 kb/j, c'est 15,9 millions de litres par jour, soit 6 piscines olympiques quotidiennes |

## Rythmes et cadences

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `Mt/an` (`M tonnes/an`, `kt/an`, `t/an`, `tonnes/an`, `tonnes metriques/an`, `M tonnes/trimestre`, `tonnes/trimestre`, `tonnes/mois`) | Tonnes par unité de temps | Capacité ou production rapportée à une période | 1 Mt/an, c'est 2 740 tonnes par jour, soit environ 110 camions de 25 tonnes chargés chaque jour |
| `t clinker/jour` | Tonnes de clinker par jour | Débit d'un four à ciment ; le clinker est le produit intermédiaire cuit du ciment | 3 000 tonnes par jour, c'est 120 camions de 25 tonnes chaque jour |
| `M USD/an` (`M$/an`, `Md$/an`, `M USD run-rate`, `million/an`) | Millions ou milliards de dollars par an | Montant annualisé, souvent une économie de coûts en rythme annuel | 100 M$/an, c'est environ 274 000 dollars par jour, soit le prix d'une maison chaque jour |
| `cylindres/an` (`molécules/an`, `tests/an`, `vaches/jour`, `points de données/jour`) | Quantités d'objets ou d'opérations par unité de temps | Cadence opérationnelle d'un site ou d'un service | 1 million d'unités par an, c'est environ 2 740 unités par jour, soit une unité toutes les 31 secondes |
| `% par an` (`% CAGR`, `% croissance`, `% en moyenne`) | Pourcentage annuel, taux de croissance annuel moyen | Rythme de progression d'un montant d'une année sur l'autre | 7 % par an double une valeur en dix ans, comme une plante qui gagne 7 cm par mètre chaque année |

## Ratios, taux et scores

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `%` (`% yoy`, `% du CA`, `% du CA total`, `% (approx)`, `% headcount`, `% cible 2025`, `% cible 2030`, `% depuis 2024`, et autres annotations) | Pourcentage | Part d'un total ou variation relative ; « yoy » signifie par rapport à la même période de l'année précédente | 25 %, c'est un quart, soit une part de gâteau sur quatre |
| `x` (`x Phase 1`, `x (doublement)`) | Multiple, nombre de fois | Rapport entre deux grandeurs, par exemple dette rapportée à l'excédent d'exploitation | 3x, c'est trois fois plus, comme un immeuble de trois étages face à une maison de plain-pied |
| `points vs industrie` (`% au-dessus moyenne 3 ans`) | Points de pourcentage d'écart | Écart exprimé en points, non en pourcentage relatif, par rapport à une référence | 3 points d'écart entre 12 % et 15 %, comme trois barreaux d'écart sur une échelle de cent |
| `/100` (`indice`) | Score sur 100, indice | Note d'évaluation, souvent extra financière | 80/100, c'est la note d'un très bon devoir noté sur 100 |
| `notch` | Cran de notation | Écart d'un échelon dans une échelle de notation de crédit, par exemple de BBB à BBB+ | Un cran, c'est une marche d'escalier dans une volée d'une vingtaine de marches |
| `kg CO2/t` (`kg net CO2 / tonne`, `kg / t`) | Kilogrammes de dioxyde de carbone par tonne produite | Intensité carbone d'un produit | 500 kg de CO2 par tonne de ciment, c'est le poids de cinq sacs de ciment de 100 kg de gaz émis pour chaque tonne fabriquée |
| `Mt CO2/an` (`t CO2/an`) | Millions de tonnes de dioxyde de carbone par an | Émissions annuelles totales | 1 Mt de CO2 par an, c'est l'empreinte annuelle d'environ 100 000 personnes en France, dont l'empreinte moyenne est de l'ordre de 10 tonnes par an |
| `accidents / M h` (`incidents/200k heures`) | Accidents par million d'heures travaillées, ou par 200 000 heures | Taux de fréquence des accidents du travail | 1 million d'heures travaillées, c'est environ 625 salariés pendant une année entière à 1 600 heures ; 200 000 heures, c'est 100 salariés pendant un an à 2 000 heures |
| `bushels/acre` | Boisseaux par acre | Rendement agricole américain ; un boisseau de soja pèse 27,2 kg et un acre vaut 4 047 m² | 50 boisseaux par acre, c'est 1,36 tonne sur un terrain de 4 047 m², un peu plus d'un demi terrain de football |
| `% de l'offre mondiale` (`% des surfaces soja US`, `% capacite O&P-EAI`, `% vs pic 2018`) | Pourcentage d'un total de référence | Part de marché ou part d'un parc, rapportée à une base précisée dans le libellé | 10 % de l'offre mondiale, c'est une part sur dix, comme une tranche sur une pizza coupée en dix |

## Surfaces et distances

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `Md pi²` (`Md sqft`, `BSF`, `M sq ft`) | Milliards ou millions de pieds carrés | Surface, par exemple de panneaux ou d'emballages produits ; 1 pied carré vaut 0,0929 m² | 1 milliard de pieds carrés, c'est 92,9 km², presque la surface de Paris intra muros qui fait 105 km² |
| `acres` | Acre | Unité de surface agricole américaine valant 4 047 m² | Un acre, c'est un peu plus d'un demi terrain de football, qui fait 7 140 m² |
| `km` (`km de pipelines`) | Kilomètres | Longueur de réseau, par exemple de canalisations industrielles | 1 000 km de pipelines, c'est la distance de Paris à Marseille aller retour, cette liaison faisant environ 775 km par la route |

## Effectifs, sites et volumes de comptage

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `employés` (`employees`, `salariés`, `salaries`, `personnes`, `collaborateurs`, `headcount`, `FTE`, `K FTE`, `k employés`, `postes`) | Effectif, équivalents temps plein | Nombre de personnes employées ; ETP signifie équivalent temps plein, une personne à mi temps comptant pour 0,5 | 50 000 salariés, c'est la population d'une ville moyenne comme Chartres |
| `usines` (`sites`, `plants`, `mills`, `unités de production`, `sites Verbund`, `machines a papier`, `machines`, `centres`, `hubs`, `hubs de recherche`, `localisations`, `stations`, `operations`, `actifs`) | Nombre d'installations industrielles ou de sites | Taille du parc industriel ou du réseau d'implantations | 100 usines, c'est une implantation par département en France, qui en compte 101 |
| `magasins` (`stores`, `établissements partenaires`) | Points de vente | Nombre de magasins détenus ou franchisés | 4 000 magasins, c'est environ le nombre d'hypermarchés en France |
| `M actions` (`M titres`) | Millions d'actions ou de titres | Nombre de titres en circulation ou rachetés | 500 millions d'actions, c'est 500 millions de parts d'un même gâteau découpé |
| `unités` (`Mds unités`, `milliards d'unites`, `Mrd unités`, `Mrd canettes`, `produits`, `produits/solutions`, `références`, `appareils`, `solutions`, `parfums`, `variétés`, `matières premières`, `molécules`) | Nombre d'objets, de produits ou de références | Volume de production ou étendue d'un catalogue | 1 milliard de canettes de 33 cl, c'est 330 millions de litres, soit 132 piscines olympiques de boisson |
| `pays` (`marchés`, `États`, `cultures différentes`) | Nombre de pays, de marchés ou de cultures couverts | Étendue géographique ou agronomique de l'activité | 100 pays, c'est environ la moitié des 193 États membres de l'ONU |
| `brevets` (`familles de brevets`, `EPD`, `programmes`, `projets`, `contrats`, `deals`, `acquisitions`, `partenariats`, `nomination`, `projet`) | Nombre d'éléments dénombrés du portefeuille | Compte de brevets, de projets, d'opérations ou de contrats ; EPD désigne une déclaration environnementale de produit | 16 000 brevets, c'est environ 45 dépôts par jour pendant un an |
| `clients` (`consommateurs`, `patients`, `fermiers`, `societes`, `societes cotees`, `startups`, `partenaires`, `scientifiques`, `experts`, `chercheurs`, `parfumeurs`, `hôpitaux/cliniques`) | Nombre de personnes ou d'organisations | Compte de clients, de partenaires ou de spécialistes | 1 million de clients, c'est la population de la ville de Marseille et de sa proche banlieue |
| `cas d'usage` | Nombre de cas d'usage | Compte d'applications concrètes identifiées, souvent pour une technologie ou un outil numérique | 50 cas d'usage, c'est une application par semaine pendant un an |

## Durées

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `années` (`ans`, `annee`, `year`, `ans en service`) | Années | Durée, ancienneté ou horizon d'un plan | 10 ans, c'est la durée de vie moyenne d'une voiture particulière en France |
| `trimestres` | Trimestres | Durée exprimée en périodes de trois mois | 4 trimestres, c'est une année complète, comme les quatre saisons |
| `semaines` | Semaines | Durée exprimée en semaines, par exemple un délai de livraison | 8 semaines, c'est la durée des grandes vacances scolaires d'été |

## Valeurs non numériques rencontrées dans le champ `unit`

| Acronyme affiché (variantes) | Nom complet | Signification | Ordre de grandeur concret |
| --- | --- | --- | --- |
| `Fait` (`N/A`, `discontinued`, `stade`, chaîne vide) | Marqueur d'état, sans unité | Le champ ne porte pas d'unité mais un statut : réalisé, non applicable, arrêté, ou stade d'avancement | Sans objet, ce n'est pas une grandeur mesurable |

## Notes de relevé

- Les mentions ajoutées entre parenthèses dans certains libellés, par exemple « M$ (run rate annuel) », « % (65-75%) » ou « sites (1000+) », mélangent l'unité et un commentaire de contexte. Elles sont ici rattachées à l'unité de base.
- Les tonnes courtes américaines et les tonnes métriques coexistent dans les fichiers de sidérurgie. Un écart de 9,3 % sépare les deux, il ne faut pas les additionner sans conversion.
- Les onces citées pour les métaux précieux sont des onces troy de 31,103 g, à ne pas confondre avec l'once avoirdupois de 28,35 g.
