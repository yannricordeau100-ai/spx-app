import json, os

SIGNER = "CONV-SUBAGENT-RISKS-BATCH060-2026-05-30"

def rationale_4(): return "Sévérité 4/5 : le risque est qualifié de \"material adverse effect\" et concerne un facteur structurel de l'activité."
def rationale_3(): return "Sévérité 3/5 : la société utilise l'expression \"material adverse effect\" indiquant un impact potentiel matériel sur résultats ou situation financière."
def rationale_2(): return "Sévérité 2/5 : risque mentionné dans Item 1A Risk Factors sans qualification d'intensité spécifique."

DATA = {
    "TPR": {
        "source": "10-K FY2025 Item 1A (Tapestry, déposé 2025-08-14)",
        "risks": [
            {"title":"Évolution des préférences consommateurs luxe","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Capacité à anticiper et répondre aux changements rapides de préférences mode et de comportements d'achat dans le segment accessibles luxury, sous peine d'érosion des ventes et marges."},
            {"title":"Tarifs douaniers et accords commerciaux","category":"macro","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Exposition aux modifications des accords commerciaux internationaux et imposition de tarifs additionnels sur produits importés, pouvant alourdir les coûts."},
            {"title":"Réseau de distribution et chaîne logistique","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risques liés aux réseaux de fulfillment et à la dépendance envers fournisseurs et prestataires logistiques tiers concentrés à l'international."},
            {"title":"Exposition aux devises étrangères","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Fluctuations des taux de change pouvant affecter les revenus consolidés, marges et valeur des actifs détenus hors États-Unis."},
            {"title":"Cybersécurité et données clients","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Exposition aux cyberattaques, intrusions et fuites de données personnelles, pouvant entraîner pertes financières et atteinte à la réputation."},
            {"title":"Baux commerciaux non résiliables","category":"financial","severity":2,"score_rationale":rationale_2(),"trend":"stable","summary":"Engagements locatifs longue durée pour boutiques physiques limitant la flexibilité opérationnelle en cas de baisse du trafic ou fermeture de magasins."}
        ]
    },
    "TRGP": {
        "source": "10-K FY2025 Item 1A (Targa Resources, déposé 2026-02-19)",
        "risks": [
            {"title":"Volatilité des prix des hydrocarbures","category":"macro","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Sensibilité aux fluctuations des prix du gaz naturel, des LGN et du pétrole brut, affectant directement les marges des activités de gathering, processing et fractionation."},
            {"title":"Risques réglementaires et environnementaux","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Évolution des normes fédérales et étatiques sur émissions, méthane et infrastructures midstream pouvant alourdir les coûts de conformité."},
            {"title":"Concentration géographique Permian","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Forte dépendance à la production des bassins Permian et Bakken, exposant aux risques de ralentissement local du forage et de saturation des infrastructures."},
            {"title":"Risque contrepartie producteurs","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Exposition au risque de crédit des producteurs amont en cas de faillite ou défaut, dans un contexte de prix volatils."},
            {"title":"Transition énergétique et demande hydrocarbures","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Accélération de la décarbonation et baisse anticipée de la demande long terme en hydrocarbures pouvant réduire la valeur des actifs midstream."},
            {"title":"Sécurité des infrastructures et cybermenaces","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risques d'incidents physiques sur pipelines et usines, complétés par les cyberattaques visant systèmes de contrôle SCADA."}
        ]
    },
    "TRMB": {
        "source": "10-K FY2025 Item 1A (Trimble, déposé 2026-02-25)",
        "risks": [
            {"title":"Cycle de développement produit","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risques liés au développement de nouveaux produits hardware et software, avec délais de mise sur marché et obsolescence technologique rapide."},
            {"title":"Conformité internationale complexe","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Société globale soumise à un ensemble complexe et évolutif de réglementations internationales et américaines, augmentant le risque de non-conformité."},
            {"title":"Volatilité du cours de l'action","category":"financial","severity":2,"score_rationale":rationale_2(),"trend":"stable","summary":"Prix de l'action historiquement volatil pouvant affecter la rémunération des dirigeants et la confiance des investisseurs."},
            {"title":"Transition vers modèle SaaS récurrent","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Bascule du modèle économique vers abonnements récurrents, créant incertitude sur le timing de reconnaissance du revenu et risque d'exécution."},
            {"title":"Cybersécurité et protection des données","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Exposition aux cyberattaques visant les solutions connectées et plateformes cloud Trimble, avec impact possible sur clients construction, agriculture et géospatial."},
            {"title":"Dépendance fournisseurs composants","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque d'approvisionnement en composants électroniques critiques et de saisie manuelle de données augmentant les coûts opérationnels."}
        ]
    },
    "TROW": {
        "source": "10-K FY2025 Item 1A (T. Rowe Price, déposé 2026-02-13)",
        "risks": [
            {"title":"Volatilité des marchés financiers","category":"macro","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Performance des actifs sous gestion étroitement liée aux conditions de marché, avec impact direct sur frais de gestion et résultats."},
            {"title":"Concurrence des produits passifs et ETF","category":"competitive","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Pression concurrentielle accrue des gestionnaires passifs et ETF à bas coûts, érodant les marges et entraînant rachats nets sur les fonds actifs."},
            {"title":"Erreurs opérationnelles et service client","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque d'erreurs opérationnelles ou de service aux clients pouvant engendrer pertes financières, litiges et atteinte à la réputation."},
            {"title":"Cybersécurité et protection des actifs clients","category":"technological","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Cyberattaques pouvant compromettre données clients, actifs sous gestion et continuité des systèmes de trading et de comptabilité fonds."},
            {"title":"Évolutions réglementaires gestion d'actifs","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Réformes SEC, DOL et internationales sur la fiduciary duty, les frais et la transparence pouvant peser sur le modèle économique."},
            {"title":"Intégration et adoption de l'IA","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risques de non-conformité et limites à l'adoption efficace de l'IA, avec visibilité limitée sur la qualité des modèles tiers utilisés."}
        ]
    },
    "TRV": {
        "source": "10-K FY2025 Item 1A (The Travelers Companies, déposé 2026-02-12)",
        "risks": [
            {"title":"Catastrophes naturelles et changement climatique","category":"macro","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Exposition aux ouragans, incendies, tempêtes et autres événements catastrophiques dont la fréquence et la sévérité augmentent avec le changement climatique."},
            {"title":"Inexactitude des modèles de tarification","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risque d'inexactitude des modèles actuariels et de pricing, accentué par l'intégration croissante d'outputs de modèles IA dans les décisions de souscription."},
            {"title":"Volatilité du portefeuille d'investissement","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque de défaut sur titres obligataires et impact négatif sur actifs non-fixed income lors de stress de marché."},
            {"title":"Cybersécurité et tensions géopolitiques","category":"technological","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risque de cyberattaques exacerbé par les tensions géopolitiques et actions hostiles d'États-nations ou d'organisations terroristes."},
            {"title":"Litiges et coût des sinistres","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Inflation sociale et difficulté à prédire le coût ultime des sinistres assurance dommages, notamment sur les lignes responsabilité civile."},
            {"title":"Dépendance agents et courtiers indépendants","category":"operational","severity":2,"score_rationale":rationale_2(),"trend":"stable","summary":"Risque lié aux montants dus par agents et courtiers indépendants et à la qualité de leur distribution."}
        ]
    },
    "TSCO": {
        "source": "10-K FY2025 Item 1A (Tractor Supply, déposé 2026-02-19)",
        "risks": [
            {"title":"Dépendance aux fournisseurs concentrés","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risques liés à la concentration des fournisseurs clés et à leur capacité à maintenir qualité, volumes et délais de livraison."},
            {"title":"Tarifs douaniers et commerce international","category":"macro","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Impact actuel ou potentiel des tarifs douaniers américains sur les coûts d'approvisionnement de produits importés."},
            {"title":"Cybersécurité et données clients","category":"technological","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risque d'accès non autorisé, malware et incidents impactant la sécurité des systèmes et des données clients du programme fidélité."},
            {"title":"Conditions économiques et pouvoir d'achat rural","category":"macro","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Sensibilité de la clientèle rurale et agricole aux conditions économiques générales, prix des matières premières agricoles et météo."},
            {"title":"Concurrence omnicanale et grands distributeurs","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Pression de la concurrence des distributeurs nationaux, pure players e-commerce et chaînes spécialisées sur prix et expérience client."},
            {"title":"Conformité réglementaire et licences produits","category":"regulatory","severity":2,"score_rationale":rationale_2(),"trend":"stable","summary":"Risque de non-conformité aux réglementations sur les produits vendus, notamment produits chimiques, armes à feu, animaux et carburants."}
        ]
    },
    "TSLA": {
        "source": "10-K FY2025 Item 1A (Tesla, déposé 2026-01-29)",
        "risks": [
            {"title":"Expansion internationale et risques pays","category":"macro","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risques liés au maintien et à l'expansion des opérations internationales : réglementations, politique, fiscalité, conditions de travail défavorables et incertaines."},
            {"title":"Responsabilité produit et rappels véhicules","category":"operational","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risque de réclamations si les véhicules ne performent pas comme attendu, et de rappels affectant marges, réputation et confiance dans Autopilot/FSD."},
            {"title":"Concurrence intensifiée VE","category":"competitive","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Pression accrue des constructeurs traditionnels et nouveaux entrants chinois sur le marché des véhicules électriques, comprimant prix et parts de marché."},
            {"title":"Programmes de financement et risque crédit","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risques liés aux divers programmes de financement véhicules et solaire, exposant Tesla au risque de crédit des clients et résiduel des véhicules."},
            {"title":"Conflits sociaux et arrêts de travail","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risque d'arrêts de travail et de pressions syndicales dans les usines, notamment en Europe et aux États-Unis, pouvant perturber la production."},
            {"title":"Volatilité du cours de l'action","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Prix de négociation de l'action très volatil, susceptible d'affecter la rémunération en actions, le moral des employés et la capacité de financement."}
        ]
    },
    "TSN": {
        "source": "10-K FY2025 Item 1A (Tyson Foods, déposé 2025-11-10)",
        "risks": [
            {"title":"Volatilité des coûts matières premières agricoles","category":"macro","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Fluctuations des prix du maïs, soja, bétail et porc affectant directement les marges des activités beef, pork, chicken et prepared foods."},
            {"title":"Maladies animales et biosécurité","category":"operational","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risques d'épizooties (grippe aviaire, peste porcine africaine) pouvant entraîner abattages massifs, restrictions à l'export et pénurie d'approvisionnement."},
            {"title":"Réclamations légales et antitrust","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Exposition à des réclamations légales et actions d'application réglementaire, notamment enquêtes antitrust sur la filière viande aux États-Unis."},
            {"title":"Sécurité alimentaire et rappels produits","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque de contamination, rappels de produits et pertes de confiance des consommateurs et distributeurs en cas de défaillance qualité."},
            {"title":"Concentration clients distribution","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Dépendance envers un nombre limité de grandes enseignes de distribution et de restauration rapide, créant pression sur prix et conditions commerciales."},
            {"title":"Évolutions consommateurs et alternatives végétales","category":"competitive","severity":2,"score_rationale":rationale_2(),"trend":"increasing","summary":"Risque de baisse de consommation de viande au profit d'alternatives végétales et cellulaires, et évolution des préférences vers protéines durables."}
        ]
    },
    "TT": {
        "source": "10-K FY2025 Item 1A (Trane Technologies, déposé 2026-02-05)",
        "risks": [
            {"title":"Conditions économiques mondiales","category":"macro","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Opérations globales exposées à des risques économiques liés à la croissance régionale, l'inflation et les cycles du bâtiment commercial et industriel."},
            {"title":"Technologies disruptives CVC","category":"competitive","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risque de technologies disruptives provenant d'acteurs non traditionnels du secteur CVC et raccourcissement des cycles produits."},
            {"title":"Cybersécurité et systèmes IT","category":"technological","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risques liés aux systèmes IT et menaces d'utilisation malveillante de l'IA pour attaques cyber sophistiquées contre Trane, partenaires et fournisseurs."},
            {"title":"Réglementation environnementale et réfrigérants","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Évolutions réglementaires sur les réfrigérants HFC, normes d'efficacité énergétique et décarbonation des bâtiments pouvant nécessiter investissements R&D."},
            {"title":"Régime fiscal et domiciliation irlandaise","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"increasing","summary":"Risques relatifs aux changements de fiscalité, traités et statut sous lois américaines et internationales, complétés par les spécificités du droit irlandais."},
            {"title":"Chaîne d'approvisionnement composants","category":"operational","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Dépendance envers fournisseurs de composants critiques (compresseurs, semi-conducteurs, métaux) avec risques de pénurie et inflation des intrants."}
        ]
    },
    "TTD": {
        "source": "10-K FY2025 Item 1A (The Trade Desk, déposé 2026-02-27)",
        "risks": [
            {"title":"Évolution réglementaire vie privée et cookies","category":"regulatory","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risques liés au traitement de données par des tiers, GDPR, CCPA et disparition des cookies tiers, pouvant compromettre le ciblage publicitaire programmatique."},
            {"title":"Concurrence walled gardens","category":"competitive","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Pression concurrentielle des plateformes intégrées Google, Meta et Amazon disposant d'inventaires propriétaires et de données utilisateurs first-party."},
            {"title":"Dépendance budgets publicitaires","category":"macro","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Sensibilité directe des revenus aux cycles économiques affectant les budgets publicitaires des annonceurs et agences."},
            {"title":"Risque de crédit clients agences","category":"financial","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque de perte de crédit sur créances clients, majoritairement des agences média intermédiaires entre Trade Desk et annonceurs."},
            {"title":"Propriété intellectuelle et litiges","category":"regulatory","severity":3,"score_rationale":rationale_3(),"trend":"stable","summary":"Risque d'être visé par des réclamations de propriété intellectuelle dans un environnement adtech très brevetable."},
            {"title":"Cybersécurité de la plateforme programmatique","category":"technological","severity":4,"score_rationale":rationale_4(),"trend":"increasing","summary":"Risque d'incidents de sécurité sur la plateforme DSP traitant volumes massifs de données enchères et signaux utilisateurs en temps réel."}
        ]
    }
}

os.makedirs('/tmp/risks-batch060', exist_ok=True)
for ticker, d in DATA.items():
    out = {
        "ticker": ticker,
        "risks": d["risks"],
        "_risks_count": len(d["risks"]),
        "_source": d["source"],
        "_risks_signed_by": SIGNER
    }
    path = f'/tmp/risks-batch060/{ticker}.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"{ticker}: {len(d['risks'])} risques -> {path}")
