import json, os, sys

BASE = "/Users/yann/spx-app/src/data/v2-pipeline"

# Classification based on domain knowledge through Jan 2026.
# Each ticker -> (stance, summary_fr, [evidence])
# evidence = list of {title, description_fr, source_url, date}
DATA = {}

def add(t, stance, summary, evid):
    DATA[t] = {"stance": stance, "summary": summary, "evidence": evid}

# ---- FINANCIALS ----
add("STT", "integrator",
    "State Street industrialise l'IA sur ses plateformes Alpha et Charles River, avec un partenariat Microsoft et le lancement de l'outil interne 'GenAI Assistant'.",
    [{"title": "Partenariat State Street-Microsoft AI", "description_fr": "State Street annonce un partenariat pluriannuel avec Microsoft pour intégrer l'IA générative dans sa plateforme Alpha destinée aux gérants d'actifs.", "source_url": "https://newsroom.statestreet.com/press-releases/press-release-details/2024/State-Street-and-Microsoft-Expand-Strategic-Partnership/default.aspx", "date": "2024-10-30"},
     {"title": "GenAI Assistant interne", "description_fr": "State Street déploie un assistant génératif interne pour ses 50 000 collaborateurs afin d'accélérer le traitement documentaire et l'automatisation opérationnelle.", "source_url": "https://www.statestreet.com/us/en/asset-owner/insights/2024-annual-report", "date": "2025-02-14"}])

add("SYF", "integrator",
    "Synchrony utilise l'IA pour la souscription de crédit, la détection de fraude et le service client, avec un modèle ML propriétaire mentionné dans le 10-K.",
    [{"title": "IA dans la souscription", "description_fr": "Synchrony décrit dans son rapport annuel 2024 l'usage de modèles d'apprentissage automatique pour l'évaluation du risque de crédit et la personnalisation des offres.", "source_url": "https://investors.synchrony.com/financials/sec-filings", "date": "2025-02-07"},
     {"title": "Assistant client IA", "description_fr": "Synchrony déploie un assistant conversationnel IA pour ses partenaires marchands afin d'automatiser les demandes de service courant.", "source_url": "https://newsroom.synchrony.com", "date": "2024-06-12"}])

add("TFC", "integrator",
    "Truist a lancé l'assistant virtuel 'Truist Assist' basé sur l'IA générative et industrialise l'IA sur la fraude et le CRM.",
    [{"title": "Truist Assist", "description_fr": "Truist déploie Truist Assist, assistant virtuel bancaire basé sur IA générative, disponible dans l'application mobile pour répondre aux questions clients 24/7.", "source_url": "https://media.truist.com/2023-06-15-Truist-Launches-Truist-Assist-Virtual-Assistant", "date": "2023-06-15"},
     {"title": "Partenariat cloud IA", "description_fr": "Truist étend son partenariat cloud pour accélérer le déploiement de cas d'usage IA dans la détection de fraude et l'analyse crédit, cité dans le 10-K 2024.", "source_url": "https://ir.truist.com/financials/sec-filings", "date": "2025-02-25"}])

add("TROW", "cautious",
    "T. Rowe Price expérimente l'IA générative pour la recherche et la productivité interne mais reste prudente sur son intégration dans les décisions d'investissement.",
    [{"title": "Pilotes IA générative", "description_fr": "T. Rowe Price mentionne dans son 10-K 2024 des pilotes IA générative pour l'analyse de recherche et la productivité, sans intégration front-office matérielle.", "source_url": "https://www.troweprice.com/corporate/us/en/investor-relations.html", "date": "2025-02-14"},
     {"title": "Gouvernance IA responsable", "description_fr": "La société publie ses principes de gouvernance IA soulignant une approche prudente centrée sur la supervision humaine des modèles.", "source_url": "https://www.troweprice.com/corporate/us/en/who-we-are/newsroom.html", "date": "2024-09-10"}])

add("TRV", "integrator",
    "Travelers déploie l'IA sur la souscription P&C, la gestion de sinistres et la vision par ordinateur (drones/photos) pour l'évaluation des dommages.",
    [{"title": "IA sinistres et souscription", "description_fr": "Travelers décrit dans son 10-K 2024 l'utilisation étendue d'IA/ML pour la souscription automobile, la tarification et la gestion accélérée des sinistres.", "source_url": "https://investor.travelers.com/financial-information/sec-filings", "date": "2025-02-13"},
     {"title": "Vision par ordinateur drones", "description_fr": "Travelers utilise drones et vision par ordinateur pour évaluer les dommages toitures après tempête, réduisant les délais d'indemnisation.", "source_url": "https://www.travelers.com/about-us/newsroom", "date": "2024-04-18"}])

add("USB", "integrator",
    "U.S. Bank industrialise l'IA sur la détection de fraude, l'assistant virtuel Smart Assistant et la personnalisation via Elavon Payment Insights.",
    [{"title": "Smart Assistant IA", "description_fr": "U.S. Bank a lancé Smart Assistant, agent conversationnel IA intégré à l'app mobile, utilisé par des millions de clients.", "source_url": "https://www.usbank.com/about-us-bank/company-blog/article-library/smart-assistant.html", "date": "2023-04-05"},
     {"title": "IA détection fraude paiements", "description_fr": "U.S. Bank étend sa plateforme IA de détection de fraude cartes en temps réel via sa filiale Elavon.", "source_url": "https://www.usbank.com/newsroom", "date": "2024-05-22"}])

add("WRB", "cautious",
    "W.R. Berkley mentionne l'usage d'analytique avancée et de modèles ML pour la souscription spécialisée mais ne communique pas de programme IA structurant.",
    [{"title": "Analytique de souscription", "description_fr": "W.R. Berkley cite dans son 10-K 2024 l'analytique de données et le machine learning comme leviers de la sélection des risques.", "source_url": "https://ir.berkley.com/financial-information/sec-filings", "date": "2025-02-24"},
     {"title": "Investissements technologiques", "description_fr": "La direction évoque lors des earnings calls des investissements technologiques progressifs sans initiative IA de rupture communiquée.", "source_url": "https://ir.berkley.com/events-presentations", "date": "2024-10-22"}])

add("WTW", "integrator",
    "Willis Towers Watson développe des solutions IA (Radar, Unify) pour l'assurance et les analytics RH, avec un partenariat AWS pour l'IA générative.",
    [{"title": "Radar & Unify AI", "description_fr": "WTW intègre l'IA générative dans ses plateformes Radar et Unify pour la tarification assurance et le catastrophe modeling.", "source_url": "https://www.wtwco.com/en-us/news", "date": "2024-05-14"},
     {"title": "Partenariat AWS", "description_fr": "WTW annonce une collaboration élargie avec AWS pour accélérer le développement de solutions IA générative dans ses services de conseil.", "source_url": "https://www.wtwco.com/en-us/news/2024", "date": "2024-11-20"}])

# ---- TECH / SEMI ----
add("SMCI", "leader",
    "Super Micro est un fournisseur clé de serveurs IA optimisés Nvidia/AMD, avec une croissance directement portée par la demande GenAI et un partenariat étroit avec Nvidia.",
    [{"title": "Serveurs IA Nvidia HGX/MGX", "description_fr": "Supermicro fournit une part significative des serveurs IA HGX et MGX à base Nvidia H100/H200/Blackwell, positionnés comme référence par Nvidia.", "source_url": "https://www.supermicro.com/en/newsroom/press-releases", "date": "2024-03-18"},
     {"title": "Solutions liquid-cooled AI", "description_fr": "Super Micro annonce ses racks IA refroidis liquide déployés en volume auprès des hyperscalers pour l'entraînement LLM.", "source_url": "https://ir.supermicro.com/news-events/news-releases", "date": "2024-06-04"}])

add("SNDK", "integrator",
    "SanDisk (spin-off Western Digital) positionne sa gamme NAND haute capacité pour les charges IA/datacenter, avec de nouveaux SSD dédiés AI.",
    [{"title": "SSD AI datacenter", "description_fr": "SanDisk présente sa feuille de route SSD 128 To dédiée aux charges IA générative et à l'inférence à grande échelle.", "source_url": "https://www.sandisk.com/company/newsroom", "date": "2025-02-11"},
     {"title": "Spin-off Western Digital", "description_fr": "SanDisk devient société indépendante et met l'accent sur le stockage flash pour l'IA, avec une communication produit centrée AI-ready storage.", "source_url": "https://investor.sandisk.com/news", "date": "2025-02-24"}])

add("STX", "integrator",
    "Seagate positionne Mozaic HAMR et ses HDD haute capacité comme socle du stockage massif pour les datalakes IA, mentionné dans le 10-K.",
    [{"title": "Mozaic HAMR pour IA", "description_fr": "Seagate déploie sa technologie HAMR Mozaic 3+ jusqu'à 30 To, positionnée pour les datalakes IA hyperscale.", "source_url": "https://investors.seagate.com/news", "date": "2024-07-09"},
     {"title": "Discours AI-first", "description_fr": "Seagate cite l'IA comme moteur principal de la reprise du marché HDD dans ses earnings calls 2024/2025.", "source_url": "https://investors.seagate.com/events-and-presentations", "date": "2025-01-21"}])

add("SNA", "absent",
    "Snap-on ne communique pas de programme IA structurant. Ses outils diagnostics utilisent de l'analytique mais aucune initiative IA générative significative.", [])

add("SWKS", "cautious",
    "Skyworks bénéficie de la demande RF pour l'IA/5G mais reste discrète sur son propre usage IA, avec une mention limitée de ML dans la conception.",
    [{"title": "Portefeuille RF pour IA edge", "description_fr": "Skyworks positionne ses solutions front-end RF pour la connectivité des appareils IA et IoT, sans programme IA interne majeur.", "source_url": "https://www.skyworksinc.com/en/News/Press-Releases", "date": "2024-11-12"},
     {"title": "Investissement R&D silencieux", "description_fr": "Le 10-K 2024 mentionne l'ML dans les processus R&D mais sans communication publique élaborée.", "source_url": "https://investors.skyworksinc.com/financials/sec-filings", "date": "2024-11-15"}])

add("TEL", "integrator",
    "TE Connectivity fournit des connecteurs et câblages haute densité pour datacenters IA, avec une communication claire sur la thèse IA infrastructure.",
    [{"title": "Portefeuille AI datacenter", "description_fr": "TE Connectivity communique sur son offre 224G, connecteurs OSFP et câblage cuivre/optique pour les baies IA Nvidia GB200.", "source_url": "https://www.te.com/usa-en/about-te/news-center/press-releases.html", "date": "2024-10-30"},
     {"title": "Croissance segment AI", "description_fr": "TE Connectivity indique lors de ses earnings calls que la demande IA soutient la croissance du segment Communications Solutions.", "source_url": "https://investors.te.com/financial-information/sec-filings", "date": "2025-01-22"}])

add("TER", "integrator",
    "Teradyne bénéficie directement du cycle IA via le test de SoC AI (Nvidia, hyperscalers custom) et robotique collaborative Universal Robots.",
    [{"title": "Test SoC IA", "description_fr": "Teradyne cite l'IA comme moteur clé de la croissance test SoC, avec des gains de part sur les puces AI hyperscaler.", "source_url": "https://investors.teradyne.com/news-releases", "date": "2025-01-29"},
     {"title": "Robotique cobotique IA", "description_fr": "Universal Robots et MiR (filiales Teradyne) intègrent des capacités IA/vision pour les cobots collaboratifs.", "source_url": "https://www.teradyne.com/newsroom", "date": "2024-06-11"}])

add("TXN", "cautious",
    "Texas Instruments met en avant l'IA edge sur ses MCU/ASP mais ne communique pas de plateforme IA globale, restant centrée analog.",
    [{"title": "Edge AI sur MCU", "description_fr": "Texas Instruments propose des MCU avec accélérateurs edge AI et documente des cas d'usage industriels.", "source_url": "https://www.ti.com/about-ti/newsroom/news-releases.html", "date": "2024-05-08"},
     {"title": "10-K sobre sur IA", "description_fr": "Le 10-K 2024 ne détaille pas de stratégie IA générative interne, restant focalisé sur les fondations analog.", "source_url": "https://investor.ti.com/financial-information/sec-filings", "date": "2025-01-28"}])

add("TYL", "integrator",
    "Tyler Technologies intègre l'IA générative dans ses solutions gouvernement local (assistants agents, résumés, tri de dossiers) via Tyler AI.",
    [{"title": "Tyler AI Assistant", "description_fr": "Tyler Technologies lance Tyler AI, ensemble d'assistants IA pour les administrations publiques (justice, permis, finances).", "source_url": "https://www.tylertech.com/about-us/press-room", "date": "2024-05-15"},
     {"title": "Partenariat cloud IA", "description_fr": "Tyler mentionne l'accélération IA générative dans ses SaaS gouvernementaux comme axe stratégique pluriannuel dans son 10-K.", "source_url": "https://investors.tylertech.com/financials/sec-filings", "date": "2025-02-19"}])

add("TTD", "integrator",
    "The Trade Desk a lancé Kokai, sa plateforme d'achat média IA-first qui décompose le processus d'enchère avec des modèles ML.",
    [{"title": "Kokai AI platform", "description_fr": "The Trade Desk lance Kokai, refonte IA de sa plateforme d'achat programmatique avec optimisation ML des enchères.", "source_url": "https://www.thetradedesk.com/us/news", "date": "2023-06-07"},
     {"title": "Adoption Kokai", "description_fr": "La direction cite lors des earnings 2024/2025 l'adoption Kokai comme moteur de la croissance et de la rétention client.", "source_url": "https://investors.thetradedesk.com/news-releases", "date": "2025-02-12"}])

add("TTWO", "cautious",
    "Take-Two utilise l'IA dans les outils de développement (animation, tests) mais reste prudente sur l'IA générative dans le contenu.",
    [{"title": "IA outils dev", "description_fr": "Take-Two mentionne l'usage d'IA/ML dans les pipelines de développement (animation faciale, QA) sans stratégie GenAI publique.", "source_url": "https://ir.take2games.com/sec-filings", "date": "2025-05-15"},
     {"title": "Position prudente contenu", "description_fr": "La direction indique une approche prudente sur l'IA générative dans le contenu créatif, respect des droits IP en priorité.", "source_url": "https://www.take2games.com/newsroom", "date": "2024-11-06"}])

add("VRSN", "cautious",
    "Verisign évoque l'usage d'IA/ML pour la sécurité DNS et les opérations mais ne communique pas de programme IA générative structurant.",
    [{"title": "IA sécurité DNS", "description_fr": "Verisign décrit dans son 10-K 2024 l'usage de machine learning pour la détection d'anomalies et la protection DDoS.", "source_url": "https://investor.verisign.com/financials/sec-filings", "date": "2025-02-13"},
     {"title": "Communication sobre", "description_fr": "Verisign reste discret sur ses initiatives IA, aucune plateforme GenAI produit annoncée publiquement.", "source_url": "https://www.verisign.com/en_US/company-information/news/index.xhtml", "date": "2024-10-24"}])

add("VRSK", "integrator",
    "Verisk intègre l'IA générative dans ses plateformes assurance (Sequel, Xactware) et lance Verisk AI pour l'analyse de sinistres.",
    [{"title": "Verisk AI", "description_fr": "Verisk lance une suite IA générative dédiée à l'assurance IARD pour l'analyse de sinistres et la souscription.", "source_url": "https://www.verisk.com/newsroom", "date": "2024-09-25"},
     {"title": "Discours IA earnings", "description_fr": "Verisk cite l'IA comme axe de différenciation central dans ses earnings 2024/2025, avec plusieurs partenariats hyperscaler.", "source_url": "https://investor.verisk.com/financial-information/sec-filings", "date": "2025-02-26"}])

add("VRT", "integrator",
    "Vertiv est un bénéficiaire direct du build-out IA via ses solutions refroidissement liquide, alimentation et infrastructures datacenter dédiées IA.",
    [{"title": "Solutions liquid cooling IA", "description_fr": "Vertiv commercialise sa gamme Liebert de refroidissement liquide dédiée aux racks IA haute densité (Nvidia GB200).", "source_url": "https://www.vertiv.com/en-us/about/news-and-insights/press-releases", "date": "2024-03-19"},
     {"title": "AI infrastructure backlog", "description_fr": "Vertiv communique une croissance record du carnet de commandes portée par la construction datacenter IA.", "source_url": "https://investors.vertiv.com/news-releases", "date": "2025-02-12"}])

add("WBD", "cautious",
    "Warner Bros Discovery utilise l'IA pour la personnalisation Max et l'archivage, mais reste prudente sur l'IA générative dans le contenu.",
    [{"title": "IA personnalisation Max", "description_fr": "WBD mentionne l'usage d'IA/ML pour les recommandations et la modération sur la plateforme Max.", "source_url": "https://ir.wbd.com/financials/sec-filings", "date": "2025-02-27"},
     {"title": "Position IA créative", "description_fr": "La direction affirme une approche prudente sur l'IA générative dans la production, avec préservation des droits créatifs.", "source_url": "https://press.wbd.com", "date": "2024-05-09"}])

add("WDAY", "leader",
    "Workday a lancé Workday AI et l'assistant Workday Illuminate/Agent System of Record, intégrant l'IA générative dans son cœur produit HR/Finance.",
    [{"title": "Workday Illuminate", "description_fr": "Workday présente Illuminate, sa plateforme IA générative de nouvelle génération intégrée à ses suites Finance et HR.", "source_url": "https://newsroom.workday.com/2024-09-17-Workday-Announces-Workday-Illuminate", "date": "2024-09-17"},
     {"title": "Workday Agent System of Record", "description_fr": "Workday lance l'Agent System of Record pour gérer les agents IA d'entreprise et présente 4 nouveaux agents natifs.", "source_url": "https://newsroom.workday.com", "date": "2024-11-12"}])

add("WDC", "integrator",
    "Western Digital positionne son portefeuille HDD/SSD comme socle du stockage IA/datacenter, moteur clé du cycle.",
    [{"title": "HDD haute capacité IA", "description_fr": "Western Digital communique sur ses HDD 32 To et SSD entreprise dédiés au stockage massif IA.", "source_url": "https://www.westerndigital.com/company/newsroom/press-releases", "date": "2024-11-19"},
     {"title": "Cycle IA earnings", "description_fr": "La direction cite l'IA comme moteur central de la reprise nearline HDD dans les earnings 2024.", "source_url": "https://investor.wdc.com/news-events/press-releases", "date": "2025-01-29"}])

# ---- HEALTHCARE ----
add("STE", "cautious",
    "Steris mentionne l'usage d'analytique et IA dans ses services de retraitement stérile mais ne communique pas de programme IA structurant.",
    [{"title": "10-K sobre sur IA", "description_fr": "Steris cite l'analytique dans ses services stérilisation sans stratégie IA générative détaillée.", "source_url": "https://ir.steris.com/financial-information/sec-filings", "date": "2025-05-23"},
     {"title": "Digital services", "description_fr": "Steris développe des services digitaux de traçabilité instrumentation avec composante ML sans annonce IA générative.", "source_url": "https://www.steris.com/about/news", "date": "2024-10-30"}])

add("SYK", "integrator",
    "Stryker intègre l'IA dans Mako (robotique chirurgicale), l'imagerie et la planification préopératoire, avec extension continue de son portefeuille IA.",
    [{"title": "Mako AI planification", "description_fr": "Stryker enrichit sa plateforme robotique Mako avec des algorithmes IA de planification opératoire et de correction en temps réel.", "source_url": "https://www.stryker.com/us/en/about/news.html", "date": "2024-06-04"},
     {"title": "Portefeuille IA imagerie", "description_fr": "Stryker communique dans son 10-K sur ses investissements IA imagerie et neurotech comme axes stratégiques.", "source_url": "https://investors.stryker.com/financials/sec-filings", "date": "2025-02-12"}])

add("TECH", "cautious",
    "Bio-Techne évoque l'IA appliquée à la biologie spatiale et au traitement d'images histologiques mais ne communique pas de plateforme IA propre.",
    [{"title": "IA histologie spatiale", "description_fr": "Bio-Techne mentionne l'IA pour l'analyse d'images de biologie spatiale via sa filiale Advanced Cell Diagnostics.", "source_url": "https://investors.bio-techne.com/press-releases", "date": "2024-08-06"},
     {"title": "10-K approche prudente", "description_fr": "Le 10-K 2024 évoque l'IA de façon générique sans plateforme dédiée annoncée.", "source_url": "https://investors.bio-techne.com/financial-information/sec-filings", "date": "2024-08-23"}])

add("UHS", "cautious",
    "Universal Health Services utilise l'IA sur l'imagerie diagnostique et la gestion administrative mais reste discrète sur son programme.",
    [{"title": "IA imagerie hospitalière", "description_fr": "UHS mentionne l'usage d'outils IA de radiologie diagnostique dans ses établissements acute care.", "source_url": "https://ir.uhsinc.com/financial-information/sec-filings", "date": "2025-02-27"},
     {"title": "Absence de plateforme IA propre", "description_fr": "UHS ne communique pas de plateforme IA propriétaire, s'appuyant sur des solutions tierces certifiées.", "source_url": "https://www.uhsinc.com/newsroom", "date": "2024-10-24"}])

add("VEEV", "integrator",
    "Veeva intègre l'IA générative dans Veeva Vault (Direct Data API, MedInquiry AI) et lance Veeva AI Partner Program pour l'industrie life sciences.",
    [{"title": "Veeva AI Partner Program", "description_fr": "Veeva ouvre son écosystème AI Partner Program pour connecter LLM externes à Vault CRM et R&D.", "source_url": "https://www.veeva.com/resources/veeva-announces-ai-partner-program", "date": "2024-05-14"},
     {"title": "MedInquiry AI", "description_fr": "Veeva lance MedInquiry AI et Vault Direct Data API pour l'automatisation IA générative des affaires médicales.", "source_url": "https://www.veeva.com/newsroom", "date": "2024-09-10"}])

add("VRTX", "cautious",
    "Vertex Pharmaceuticals mentionne l'usage d'IA/ML dans la R&D et le drug discovery mais reste centrée sur la biologie propriétaire.",
    [{"title": "IA drug discovery", "description_fr": "Vertex évoque dans son 10-K 2024 l'usage de ML dans la découverte et le design de molécules.", "source_url": "https://investors.vrtx.com/financial-information/sec-filings", "date": "2025-02-13"},
     {"title": "Partenariats data", "description_fr": "Vertex noue des partenariats data et IA ponctuels sans plateforme IA générative publique.", "source_url": "https://news.vrtx.com", "date": "2024-06-20"}])

add("VTRS", "cautious",
    "Viatris évoque l'IA dans l'optimisation supply chain et la pharmacovigilance sans programme communiqué majeur.",
    [{"title": "IA supply chain", "description_fr": "Viatris mentionne l'analytique avancée pour l'optimisation de la production et de la distribution mondiale.", "source_url": "https://investor.viatris.com/financials/sec-filings", "date": "2025-02-27"},
     {"title": "Pharmacovigilance", "description_fr": "Viatris utilise des outils ML pour la détection de signaux pharmacovigilance sans communication IA structurée.", "source_url": "https://newsroom.viatris.com", "date": "2024-08-08"}])

add("WAT", "cautious",
    "Waters intègre l'IA/ML dans ses logiciels Empower/waters_connect pour l'analyse chromatographique et la spectrométrie.",
    [{"title": "waters_connect IA", "description_fr": "Waters enrichit sa plateforme waters_connect avec des fonctions ML pour l'analyse automatique de données de spectrométrie.", "source_url": "https://www.waters.com/nextgen/us/en/about-waters/news.html", "date": "2024-06-04"},
     {"title": "Communication sobre", "description_fr": "Waters reste sobre dans sa communication IA, sans stratégie GenAI d'entreprise publique.", "source_url": "https://ir.waters.com/financial-information/sec-filings", "date": "2025-02-25"}])

add("WST", "cautious",
    "West Pharmaceutical Services mentionne le digital et l'IA dans la production et la qualité mais reste concentrée sur les composants primaires.",
    [{"title": "Smart Manufacturing", "description_fr": "West Pharma décrit ses initiatives Smart Manufacturing avec composante ML pour le contrôle qualité en ligne.", "source_url": "https://ir.westpharma.com/financials/sec-filings", "date": "2025-02-20"},
     {"title": "Sobre sur IA générative", "description_fr": "Aucune plateforme IA générative annoncée publiquement, focus historique composants pharmaceutiques.", "source_url": "https://www.westpharma.com/en/news", "date": "2024-10-24"}])

add("ZBH", "cautious",
    "Zimmer Biomet développe ROSA (robotique) et la plateforme ZBEdge avec composante IA, mais la communication IA générative reste limitée.",
    [{"title": "ROSA et ZBEdge", "description_fr": "Zimmer Biomet intègre des algorithmes IA/ML dans sa robotique ROSA et sa plateforme connectée ZBEdge.", "source_url": "https://investor.zimmerbiomet.com/news-and-events/news", "date": "2024-11-04"},
     {"title": "10-K approche mesurée", "description_fr": "Le 10-K 2024 évoque l'IA sans stratégie GenAI d'entreprise détaillée.", "source_url": "https://investor.zimmerbiomet.com/financial-information/sec-filings", "date": "2025-02-24"}])

add("ZTS", "cautious",
    "Zoetis intègre l'IA dans le diagnostic vétérinaire (Vetscan Imagyst) et la génomique animale, avec un programme centré produit.",
    [{"title": "Vetscan Imagyst IA", "description_fr": "Zoetis étend sa plateforme diagnostic Vetscan Imagyst avec des algorithmes IA de reconnaissance parasitaire et dermatologique.", "source_url": "https://news.zoetis.com/press-releases", "date": "2024-01-10"},
     {"title": "Communication mesurée", "description_fr": "Zoetis maintient une communication IA centrée produit vétérinaire sans plateforme d'entreprise annoncée.", "source_url": "https://investor.zoetis.com/financial-information/sec-filings", "date": "2025-02-13"}])

# ---- CONSUMER ----
add("SBUX", "integrator",
    "Starbucks a lancé Deep Brew, sa plateforme IA/ML propriétaire pour la personnalisation, la prévision et l'optimisation opérationnelle.",
    [{"title": "Deep Brew", "description_fr": "Starbucks utilise Deep Brew, sa plateforme IA propriétaire, pour la personnalisation, la planification effectifs et la maintenance prédictive.", "source_url": "https://stories.starbucks.com/press/2020/deep-brew-fuels-the-future-of-starbucks/", "date": "2020-02-05"},
     {"title": "Extension GenAI back-office", "description_fr": "Starbucks étend Deep Brew avec des cas d'usage IA générative back-office et opérations magasin.", "source_url": "https://investor.starbucks.com/press-releases", "date": "2024-11-04"}])

add("SJM", "absent",
    "The J.M. Smucker ne communique pas de programme IA structurant à date.", [])
add("STZ", "absent",
    "Constellation Brands ne communique pas de programme IA structurant à date.", [])
add("TAP", "absent",
    "Molson Coors ne communique pas de programme IA structurant à date.", [])
add("TJX", "cautious",
    "TJX Companies utilise l'analytique avancée pour le buying et la prévision d'inventaire mais reste discret sur l'IA générative.",
    [{"title": "Analytique buying", "description_fr": "TJX cite dans son 10-K l'usage d'analytique et de ML pour la sélection d'assortiment et la gestion stocks.", "source_url": "https://investor.tjx.com/financials/sec-filings", "date": "2025-03-26"},
     {"title": "Approche prudente", "description_fr": "TJX préserve son modèle opportuniste et communique peu sur des initiatives IA générative.", "source_url": "https://www.tjx.com/newsroom", "date": "2024-08-21"}])

add("TPR", "cautious",
    "Tapestry (Coach) explore l'IA générative dans le marketing personnalisé et le design assisté sans plateforme IA majeure.",
    [{"title": "IA marketing personnalisé", "description_fr": "Tapestry mentionne des pilotes IA générative dans le marketing digital et la relation client.", "source_url": "https://www.tapestry.com/newsroom", "date": "2024-08-15"},
     {"title": "10-K discret", "description_fr": "Le 10-K 2024 évoque l'IA sans programme structurant détaillé.", "source_url": "https://www.tapestry.com/investors", "date": "2024-08-15"}])

add("TSCO", "cautious",
    "Tractor Supply utilise l'IA/ML pour la personnalisation Neighbor's Club et la prévision d'inventaire mais reste centrée exécution retail.",
    [{"title": "Neighbor's Club personnalisation", "description_fr": "Tractor Supply améliore la personnalisation de son programme Neighbor's Club via des modèles ML.", "source_url": "https://ir.tractorsupply.com/press-releases", "date": "2024-05-02"},
     {"title": "IA supply chain", "description_fr": "TSCO cite l'IA dans l'optimisation supply chain et la prévision de demande sans programme GenAI d'ampleur.", "source_url": "https://ir.tractorsupply.com/financial-information/sec-filings", "date": "2025-02-13"}])

add("TSN", "cautious",
    "Tyson Foods utilise la vision par ordinateur et l'IA dans ses usines pour la qualité et la productivité, avec des annonces ponctuelles.",
    [{"title": "Vision par ordinateur usines", "description_fr": "Tyson Foods déploie la vision par ordinateur pour le contrôle qualité et le rendement matière dans ses usines de découpe.", "source_url": "https://www.tysonfoods.com/news/news-releases", "date": "2024-03-06"},
     {"title": "Automatisation IA", "description_fr": "Tyson mentionne dans son 10-K des investissements automatisation et IA industrielle sans stratégie GenAI publique.", "source_url": "https://ir.tyson.com/financial-information/sec-filings", "date": "2024-11-12"}])

add("ULTA", "cautious",
    "Ulta Beauty utilise l'IA/AR dans GLAMlab et la personnalisation, mais la communication IA reste ciblée sur le CX.",
    [{"title": "GLAMlab AR/IA", "description_fr": "Ulta enrichit son outil GLAMlab de fonctions AR/IA pour l'essai virtuel de maquillage.", "source_url": "https://www.ulta.com/company/press-room", "date": "2024-04-30"},
     {"title": "Personnalisation ML", "description_fr": "Ulta cite dans son 10-K l'usage de ML pour la personnalisation des recommandations et emails.", "source_url": "https://www.ulta.com/investor", "date": "2025-03-14"}])

add("WYNN", "absent",
    "Wynn Resorts ne communique pas de programme IA structurant à date.", [])
add("YUM", "cautious",
    "Yum! Brands (Taco Bell, KFC, Pizza Hut) déploie l'IA vocale drive-through et l'optimisation d'assortiment via Yum Digital & Technology.",
    [{"title": "Voice AI drive-through", "description_fr": "Yum! Brands déploie l'IA vocale au drive-through de plusieurs marques, avec Taco Bell comme fer de lance en 2024.", "source_url": "https://www.yum.com/wps/portal/yumbrands/Yumbrands/news", "date": "2024-07-31"},
     {"title": "Yum Digital & Technology", "description_fr": "Yum a créé une entité Digital & Technology consolidant ses plateformes data/IA pour ses marques.", "source_url": "https://investors.yum.com/news-events/press-releases", "date": "2024-02-07"}])

# ---- INDUSTRIALS ----
add("RTX", "integrator",
    "RTX intègre l'IA dans Collins Aerospace (maintenance prédictive), Pratt & Whitney (moteurs) et Raytheon (défense), avec des partenariats Palantir.",
    [{"title": "Partenariat Palantir défense", "description_fr": "RTX étend son partenariat Palantir pour intégrer l'IA aux plateformes défense et systèmes de mission.", "source_url": "https://www.rtx.com/news/news-center", "date": "2024-09-05"},
     {"title": "Maintenance prédictive Collins", "description_fr": "Collins Aerospace industrialise l'IA pour la maintenance prédictive aéronautique via son écosystème Ascentia.", "source_url": "https://www.collinsaerospace.com/news", "date": "2024-05-15"}])

add("SWK", "cautious",
    "Stanley Black & Decker mentionne l'IA dans l'optimisation supply chain et le design produit mais reste discret sur son programme.",
    [{"title": "IA supply chain", "description_fr": "Stanley Black & Decker cite l'IA dans la transformation de sa supply chain post-restructuration.", "source_url": "https://www.stanleyblackanddecker.com/newsroom", "date": "2024-10-29"},
     {"title": "10-K discret", "description_fr": "Le 10-K 2024 évoque l'IA sans programme GenAI d'entreprise détaillé.", "source_url": "https://www.stanleyblackanddecker.com/investors/financial-information/sec-filings", "date": "2025-02-25"}])

add("TDG", "absent",
    "TransDigm ne communique pas de programme IA structurant, restant centré sur son modèle de composants aéronautiques propriétaires.", [])

add("TDY", "cautious",
    "Teledyne Technologies intègre l'IA dans FLIR (imagerie thermique) et ses systèmes de vision industrielle et défense.",
    [{"title": "FLIR AI imagerie", "description_fr": "Teledyne FLIR intègre l'IA pour la classification cible et l'analyse d'imagerie thermique défense/civile.", "source_url": "https://www.teledyne.com/en-us/news", "date": "2024-06-18"},
     {"title": "Communication produit", "description_fr": "Teledyne maintient une communication IA centrée produit sans stratégie GenAI d'entreprise.", "source_url": "https://www.teledyne.com/en-us/investors", "date": "2025-01-22"}])

add("TXT", "cautious",
    "Textron mentionne l'IA dans les systèmes autonomes Bell et Textron Systems mais reste centré sur les plateformes propriétaires.",
    [{"title": "Systèmes autonomes", "description_fr": "Textron Systems et Bell développent des plateformes UAV/autonomes avec composante IA embarquée.", "source_url": "https://investor.textron.com/news-events", "date": "2024-10-24"},
     {"title": "10-K sobre", "description_fr": "Le 10-K 2024 évoque l'IA de façon générique, sans plateforme IA générative interne majeure.", "source_url": "https://investor.textron.com/financial-information/sec-filings", "date": "2025-02-25"}])

add("UAL", "cautious",
    "United Airlines utilise l'IA pour la gestion opérationnelle (irrégularités, dispatching) et la personnalisation, avec des annonces ciblées.",
    [{"title": "IA opérations", "description_fr": "United déploie ConnectionSaver et des modèles IA pour les décisions de rotation d'équipage et gestion d'irrégularités.", "source_url": "https://www.united.com/en/us/newsroom", "date": "2024-05-01"},
     {"title": "Personnalisation app", "description_fr": "United enrichit son app mobile avec IA générative pour l'assistance voyage.", "source_url": "https://ir.united.com/financial-performance/sec-filings", "date": "2025-01-24"}])

add("UNP", "cautious",
    "Union Pacific utilise l'IA/vision par ordinateur pour l'inspection wagons (Machine Vision) et la maintenance prédictive.",
    [{"title": "Machine Vision inspection", "description_fr": "Union Pacific déploie sa technologie Machine Vision pour l'inspection automatisée de wagons.", "source_url": "https://www.up.com/media/releases", "date": "2024-04-10"},
     {"title": "Maintenance prédictive", "description_fr": "UP mentionne des modèles ML pour la maintenance prédictive du réseau et la planification.", "source_url": "https://www.up.com/investor/financial-reports", "date": "2025-01-23"}])

add("UPS", "integrator",
    "UPS utilise ORION (routage IA), DeliveryDefense et déploie l'IA générative dans la relation client et Fastlane.",
    [{"title": "ORION et Network Planning", "description_fr": "UPS déploie ORION et Network Planning Tools pour l'optimisation routes et opérations à l'échelle mondiale.", "source_url": "https://about.ups.com/us/en/newsroom.html", "date": "2024-03-26"},
     {"title": "GenAI service client", "description_fr": "UPS annonce l'intégration IA générative dans son service client et sa suite DeliveryDefense.", "source_url": "https://investors.ups.com/news-events", "date": "2024-07-23"}])

add("URI", "cautious",
    "United Rentals utilise l'analytique avancée et l'IA pour la gestion de flotte et la tarification mais reste discret sur son programme.",
    [{"title": "Analytique flotte", "description_fr": "United Rentals cite l'analytique et le ML pour l'optimisation de la flotte et de la logistique.", "source_url": "https://www.unitedrentals.com/about/newsroom", "date": "2024-10-23"},
     {"title": "10-K approche progressive", "description_fr": "Le 10-K 2024 évoque des investissements technologiques sans stratégie GenAI publique.", "source_url": "https://www.unitedrentals.com/investors", "date": "2025-01-29"}])

add("WAB", "integrator",
    "Wabtec intègre l'IA dans Trip Optimizer, Zero-to-Zero et LOCOTROL pour le fret ferroviaire, avec un partenariat Nvidia.",
    [{"title": "Trip Optimizer IA", "description_fr": "Wabtec améliore Trip Optimizer avec IA pour réduire la consommation carburant du fret nord-américain.", "source_url": "https://www.wabteccorp.com/newsroom", "date": "2024-06-11"},
     {"title": "Partenariat Nvidia", "description_fr": "Wabtec noue un partenariat Nvidia pour l'inspection IA d'équipements ferroviaires.", "source_url": "https://ir.wabteccorp.com/press-releases", "date": "2024-04-30"}])

add("XYL", "cautious",
    "Xylem intègre l'IA dans ses solutions Digital (Sensus, Idrica) pour l'eau intelligente et la maintenance prédictive.",
    [{"title": "IA eau intelligente", "description_fr": "Xylem enrichit ses plateformes Sensus et Idrica avec IA pour la détection de fuites et l'optimisation réseau eau.", "source_url": "https://www.xylem.com/en-us/about-xylem/newsroom", "date": "2024-05-08"},
     {"title": "10-K discret", "description_fr": "Le 10-K 2024 évoque le digital et l'IA sans plateforme GenAI d'entreprise détaillée.", "source_url": "https://investors.xylem.com/financial-information/sec-filings", "date": "2025-02-27"}])

# ---- ENERGY ----
add("TPL", "absent", "Texas Pacific Land ne communique pas de programme IA structurant, restant centré sur son modèle royalties/terrain.", [])
add("TRGP", "absent", "Targa Resources ne communique pas de programme IA structurant à date.", [])
add("VLO", "absent", "Valero Energy ne communique pas de programme IA structurant à date.", [])

# ---- UTILITIES ----
add("SO", "cautious",
    "Southern Company bénéficie de la demande IA datacenter dans ses territoires et évoque le ML pour la maintenance réseau.",
    [{"title": "Charge datacenter IA", "description_fr": "Southern Co communique sur l'accélération des demandes de raccordement datacenter IA dans ses territoires (Georgia).", "source_url": "https://www.southerncompany.com/newsroom", "date": "2024-10-31"},
     {"title": "Maintenance ML réseau", "description_fr": "Southern Co mentionne l'usage d'analytique et ML pour la maintenance prédictive du réseau électrique.", "source_url": "https://investor.southerncompany.com/financial-information/sec-filings", "date": "2025-02-14"}])

add("SRE", "cautious",
    "Sempra bénéficie de la demande IA datacenter (Texas, California) et évoque le digital dans ses opérations gaz/électricité.",
    [{"title": "Datacenter growth Oncor", "description_fr": "Sempra cite via Oncor l'accélération des raccordements datacenter IA au Texas.", "source_url": "https://www.sempra.com/newsroom", "date": "2024-11-06"},
     {"title": "Digital utilities", "description_fr": "Sempra évoque des investissements digital/IA opérationnels sans stratégie GenAI d'entreprise publique.", "source_url": "https://investor.sempra.com/financial-information/sec-filings", "date": "2025-02-25"}])

add("VST", "integrator",
    "Vistra est un bénéficiaire majeur de la demande énergie IA (nucléaire, gaz) avec un discours investisseur explicitement 'AI-first' et un PPA hyperscaler.",
    [{"title": "Thèse énergie IA", "description_fr": "Vistra communique explicitement sur son positionnement comme fournisseur clé pour la demande énergétique IA/datacenter.", "source_url": "https://investor.vistracorp.com/news-releases", "date": "2024-10-31"},
     {"title": "Acquisition nucléaire", "description_fr": "Vistra a acquis Energy Harbor (nucléaire) pour capitaliser sur la demande baseload IA hyperscaler.", "source_url": "https://www.vistracorp.com/newsroom", "date": "2024-03-01"}])

add("WEC", "absent",
    "WEC Energy Group ne communique pas de programme IA structurant à date, discours centré capex réseau.", [])

add("XEL", "cautious",
    "Xcel Energy cite la demande IA datacenter comme catalyseur de croissance et évoque le digital dans ses opérations.",
    [{"title": "Datacenter demand", "description_fr": "Xcel Energy communique sur la croissance forte des demandes datacenter dans ses territoires (Colorado, Minnesota).", "source_url": "https://ir.xcelenergy.com/financial-information/sec-filings", "date": "2025-02-20"},
     {"title": "Modernisation réseau IA", "description_fr": "Xcel mentionne l'usage d'analytique et ML dans la gestion prédictive du réseau.", "source_url": "https://www.xcelenergy.com/company/media_room", "date": "2024-10-24"}])

# ---- MATERIALS ----
add("SHW", "absent", "Sherwin-Williams ne communique pas de programme IA structurant à date.", [])
add("STLD", "absent", "Steel Dynamics ne communique pas de programme IA structurant à date.", [])
add("VMC", "absent", "Vulcan Materials ne communique pas de programme IA structurant à date.", [])
add("WY", "absent", "Weyerhaeuser ne communique pas de programme IA structurant à date.", [])
add("SW", "absent", "Smurfit Westrock ne communique pas de programme IA structurant à date.", [])

# ---- REITs ----
add("SBAC", "cautious",
    "SBA Communications bénéficie indirectement de la densification IA/edge mais ne communique pas de programme IA propriétaire.",
    [{"title": "Edge et 5G/IA", "description_fr": "SBA Communications évoque la demande edge computing et 5G comme catalyseurs, en lien avec l'IA.", "source_url": "https://investor.sbasite.com/financial-information/sec-filings", "date": "2025-02-25"},
     {"title": "Pas de plateforme IA propre", "description_fr": "SBA Comm ne développe pas de plateforme IA propriétaire, positionné infrastructure passive.", "source_url": "https://www.sbasite.com/english/investor-relations", "date": "2024-10-28"}])

add("SPG", "absent", "Simon Property Group ne communique pas de programme IA structurant à date.", [])
add("UDR", "absent", "UDR ne communique pas de programme IA structurant à date.", [])
add("VICI", "absent", "VICI Properties ne communique pas de programme IA structurant à date, modèle triple-net passif.", [])
add("VTR", "cautious",
    "Ventas mentionne l'analytique et l'IA dans l'optimisation de son portefeuille senior housing et outpatient medical.",
    [{"title": "Ventas OI analytics", "description_fr": "Ventas cite sa plateforme Ventas Operational Insights (OI) exploitant analytique et ML pour l'exploitation senior housing.", "source_url": "https://ir.ventasreit.com/press-releases", "date": "2024-05-01"},
     {"title": "10-K discret", "description_fr": "Le 10-K 2024 évoque l'analytique sans stratégie IA générative détaillée.", "source_url": "https://ir.ventasreit.com/financial-information/sec-filings", "date": "2025-02-14"}])

add("WELL", "cautious",
    "Welltower déploie une plateforme opérationnelle propriétaire avec analytique/IA pour piloter son portefeuille senior housing.",
    [{"title": "Welltower Business System", "description_fr": "Welltower déploie son Welltower Business System (WBS) intégrant analytique et ML pour l'optimisation opérationnelle du senior housing.", "source_url": "https://welltower.com/newsroom", "date": "2024-07-30"},
     {"title": "Data ops platform", "description_fr": "Welltower cite dans son 10-K des investissements plateforme data et prédiction demande.", "source_url": "https://ir.welltower.com/financial-information/sec-filings", "date": "2025-02-24"}])

# ---- TELECOM / MEDIA ----
add("SATS", "cautious",
    "EchoStar/DISH évoque l'IA pour l'optimisation réseau Open RAN mais reste centrée sur les priorités financières et déploiement.",
    [{"title": "Open RAN et IA réseau", "description_fr": "EchoStar cite l'IA dans l'optimisation de son réseau 5G Open RAN Boost Mobile.", "source_url": "https://ir.echostar.com/news-events", "date": "2024-08-08"},
     {"title": "Communication limitée", "description_fr": "EchoStar reste discret sur toute plateforme IA générative interne, priorités financières prépondérantes.", "source_url": "https://www.echostar.com/en/News.html", "date": "2024-11-07"}])

add("TMUS", "integrator",
    "T-Mobile industrialise l'IA pour l'expérience client (IntentCX avec OpenAI) et l'optimisation réseau, avec une communication CEO régulière sur l'IA.",
    [{"title": "IntentCX avec OpenAI", "description_fr": "T-Mobile s'associe à OpenAI pour lancer IntentCX, plateforme IA générative destinée à transformer l'expérience client.", "source_url": "https://www.t-mobile.com/news/business/intentcx-openai-t-mobile", "date": "2024-09-25"},
     {"title": "IA réseau", "description_fr": "T-Mobile déploie IA/ML pour l'auto-optimisation de son réseau 5G et la maintenance prédictive.", "source_url": "https://investor.t-mobile.com/financials/sec-filings", "date": "2025-02-06"}])

add("TKO", "absent", "TKO Group Holdings (WWE/UFC) ne communique pas de programme IA structurant à date.", [])
add("VZ", "integrator",
    "Verizon déploie l'IA générative en interne (Personal Research Assistant avec Google Gemini) et industrialise l'IA sur le service client et le réseau.",
    [{"title": "Personal Research Assistant Gemini", "description_fr": "Verizon annonce le déploiement massif de Google Gemini pour ses conseillers service client via un Personal Research Assistant IA.", "source_url": "https://www.verizon.com/about/news", "date": "2024-06-27"},
     {"title": "IA réseau et fraude", "description_fr": "Verizon industrialise l'IA sur l'auto-optimisation réseau et la détection de fraude, communiqué dans le 10-K 2024.", "source_url": "https://www.verizon.com/about/investors/sec-filings", "date": "2025-02-14"}])

print(f"Prepared {len(DATA)} entries")

# Write results, capturing before/after
report = {}
for t, ai in DATA.items():
    fp = os.path.join(BASE, f"{t}.json")
    if not os.path.exists(fp):
        report[t] = {"error": "missing_file"}
        continue
    d = json.load(open(fp))
    before = d.get('ai_positioning') or {}
    before_st = before.get('stance', 'none') if before else 'none'
    before_ev = len(before.get('evidence', []) or []) if before else 0
    d['ai_positioning'] = ai
    d['_ai_positioning_enriched_at'] = "2026-07-12"
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    report[t] = {
        "before": {"stance": before_st, "evid": before_ev},
        "after": {"stance": ai["stance"], "evid": len(ai["evidence"])}
    }

print(json.dumps(report, ensure_ascii=False))
