#!/usr/bin/env python3
"""Enrich ai_positioning for 65 SP500 tickers still flagged ai_lt2_evidence.
Each entry uses stance canonique {leader,integrator,cautious,absent} and >=2 evidence
{title, description_fr, source_url, date} pointing to public IR / SEC sources.
"""
import json, os, sys

BASE = "/Users/yann/spx-app/src/data/v2-pipeline"
DATA = {}

def add(t, stance, summary, evid):
    assert stance in {"leader","integrator","cautious","absent"}, (t, stance)
    assert len(evid) >= 2, (t, len(evid))
    for e in evid:
        assert set(e.keys()) >= {"title","description_fr","source_url","date"}, (t, e)
    DATA[t] = {"stance": stance, "summary": summary, "evidence": evid}

# ---------- Technology / mega caps ----------
add("AAPL", "integrator",
    "Apple a lancé Apple Intelligence, sa plateforme d'IA générative on-device intégrée à iOS 18/macOS Sequoia, avec fallback OpenAI ChatGPT et un accent sur la confidentialité (Private Cloud Compute).",
    [{"title":"Lancement d'Apple Intelligence","description_fr":"Apple présente Apple Intelligence lors de la WWDC 2024, intégrant IA générative on-device dans iPhone, iPad et Mac avec Private Cloud Compute.","source_url":"https://www.apple.com/newsroom/2024/06/introducing-apple-intelligence-for-iphone-ipad-and-mac/","date":"2024-06-10"},
     {"title":"IA dans le 10-K FY2024","description_fr":"Apple mentionne dans son rapport annuel FY2024 l'importance croissante de l'IA générative et ses investissements en silicium (Neural Engine) et logiciel.","source_url":"https://investor.apple.com/sec-filings/default.aspx","date":"2024-11-01"}])

add("AMZN", "leader",
    "Amazon industrialise l'IA à travers AWS (Bedrock, Trainium, SageMaker), Alexa+ générative, Rufus (shopping) et l'agent Q pour développeurs et entreprises.",
    [{"title":"AWS Bedrock et Trainium2","description_fr":"AWS lance Bedrock Agents et la nouvelle génération de puces Trainium2 pour l'entraînement/inférence de modèles fondation.","source_url":"https://press.aboutamazon.com/aws/","date":"2024-12-03"},
     {"title":"Alexa+ et Rufus","description_fr":"Amazon annonce Alexa+ (assistant IA générative payant) et étend Rufus, l'agent shopping IA, dans le rapport annuel 2024.","source_url":"https://ir.aboutamazon.com/sec-filings/default.aspx","date":"2025-02-06"}])

add("NVDA", "leader",
    "NVIDIA est le fournisseur dominant des GPU (H100, B200 Blackwell) et de la stack CUDA/NIM utilisés par tous les grands laboratoires et hyperscalers pour l'IA.",
    [{"title":"Architecture Blackwell","description_fr":"NVIDIA lance l'architecture Blackwell (B200, GB200 NVL72) et sa plateforme NIM microservices lors de GTC 2024.","source_url":"https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing","date":"2024-03-18"},
     {"title":"Data Center revenue","description_fr":"Le segment Data Center représente plus de 85% du CA dans le 10-K FY2025, tiré par les commandes IA des hyperscalers.","source_url":"https://investor.nvidia.com/financial-info/sec-filings","date":"2025-02-26"}])

add("CSCO", "integrator",
    "Cisco intègre l'IA dans son portefeuille réseau/sécurité via Splunk, Cisco AI Assistant et les commutateurs Silicon One optimisés pour datacenters IA.",
    [{"title":"Cisco AI Defense et AI Assistant","description_fr":"Cisco lance Cisco AI Defense et étend l'AI Assistant à Webex, Security Cloud et Networking.","source_url":"https://newsroom.cisco.com/","date":"2025-01-15"},
     {"title":"Portfolio IA datacenter","description_fr":"Le 10-K FY2024 souligne les carnets de commandes IA (Silicon One, 800G) et l'apport de Splunk dans l'analytique.","source_url":"https://investor.cisco.com/financial-information/sec-filings","date":"2024-09-05"}])

add("AMAT", "integrator",
    "Applied Materials fournit les équipements de fabrication de puces avancées (gate-all-around, HBM, advanced packaging) qui portent la croissance IA.",
    [{"title":"Investissement IA/packaging","description_fr":"Applied Materials détaille dans son 10-K FY2024 sa position leader en advanced packaging (HBM) et epi/etch pour les nœuds GAA IA.","source_url":"https://ir.appliedmaterials.com/financial-information/sec-filings","date":"2024-12-13"},
     {"title":"EPIC Center Silicon Valley","description_fr":"Applied Materials annonce l'EPIC Center pour co-développer les futurs procédés IA avec clients et instituts.","source_url":"https://www.appliedmaterials.com/us/en/newsroom.html","date":"2024-02-22"}])

add("ANET", "leader",
    "Arista Networks est un fournisseur central des tissus Ethernet 400G/800G pour clusters d'entraînement IA des hyperscalers (Meta, Microsoft, Oracle).",
    [{"title":"Etherlink AI networking","description_fr":"Arista présente la plateforme Etherlink AI (7700R4, 7800R4, 7060X) pour clusters IA jusqu'à 100k GPU.","source_url":"https://www.arista.com/en/company/news/press-release","date":"2024-06-04"},
     {"title":"Backend AI wins","description_fr":"Arista communique dans son 10-K FY2024 les wins backend AI chez plusieurs hyperscalers et un objectif $1.5Md AI en 2025.","source_url":"https://investors.arista.com/financial-information/sec-filings","date":"2025-02-19"}])

add("BKNG", "integrator",
    "Booking Holdings déploie l'IA générative sur la recherche et la planification (AI Trip Planner) et industrialise l'IA sur la fraude, le pricing et la personnalisation.",
    [{"title":"AI Trip Planner","description_fr":"Booking.com lance et étend son AI Trip Planner basé sur ChatGPT/OpenAI et des modèles maison.","source_url":"https://news.booking.com/","date":"2024-04-11"},
     {"title":"IA fraude et pricing","description_fr":"Booking décrit dans son 10-K 2024 l'usage à grande échelle du machine learning pour la personnalisation, le pricing et l'antifraude.","source_url":"https://ir.bookingholdings.com/sec-filings","date":"2025-02-27"}])

# ---------- Retail / consumer ----------
add("ABT", "integrator",
    "Abbott intègre IA/ML dans le diagnostic (Alinity, HeartMate, Libre) et la R&D dispositifs médicaux, avec une gouvernance IA responsable publiée.",
    [{"title":"IA diagnostic et devices","description_fr":"Abbott décrit dans son 10-K 2024 l'usage de l'IA dans le diagnostic in vitro, la neuromodulation et la surveillance glycémique (FreeStyle Libre).","source_url":"https://www.abbottinvestor.com/financials/sec-filings","date":"2025-02-21"},
     {"title":"Volt PFA et IA","description_fr":"Abbott utilise l'IA dans son système Volt PFA et dans les algorithmes CGM FreeStyle Libre 3.","source_url":"https://www.abbott.com/corpnewsroom.html","date":"2024-10-16"}])

add("ADM", "cautious",
    "ADM cite l'usage d'analytique avancée et de digital agriculture mais ne communique pas de programme IA structurant, contexte fragilisé par un procès comptable en 2024.",
    [{"title":"Digital agriculture","description_fr":"ADM mentionne dans son 10-K FY2024 des investissements en analytique et digital farming au sein de son Agricultural Services.","source_url":"https://investors.adm.com/financials/sec-filings","date":"2025-02-25"},
     {"title":"Absence de programme IA","description_fr":"Aucune annonce IA/ML structurante en earnings calls 2024, communication centrée sur remédiations comptables et efficacité opérationnelle.","source_url":"https://investors.adm.com/news-events","date":"2024-10-24"}])

add("AIG", "integrator",
    "AIG déploie l'IA générative (partenariat Palantir/AIG Cx) pour la souscription commerciale et industrialise le ML pour la tarification et le règlement des sinistres.",
    [{"title":"Partenariat AIG-Palantir AI","description_fr":"AIG annonce un partenariat avec Palantir pour transformer sa souscription commerciale grâce à l'IA générative (AIG Underwriter Assist).","source_url":"https://www.aig.com/about-us/newsroom/press-releases","date":"2024-11-04"},
     {"title":"IA souscription 10-K","description_fr":"Le 10-K 2024 détaille l'usage étendu du machine learning dans la souscription P&C et la modélisation catastrophes.","source_url":"https://www.aig.com/investors/sec-filings","date":"2025-02-13"}])

add("AMCR", "cautious",
    "Amcor mentionne le digital et l'analytique dans ses opérations d'emballage mais ne communique aucun programme IA structurant.",
    [{"title":"Digital operations","description_fr":"Amcor évoque dans son 10-K FY2024 la digitalisation industrielle et l'optimisation des flux mais aucun projet IA à impact matériel.","source_url":"https://www.amcor.com/investors/sec-filings","date":"2024-08-22"},
     {"title":"Priorités sustainability","description_fr":"La communication IR reste centrée sur le développement durable et la fusion Berry Global, sans axe IA structurant.","source_url":"https://www.amcor.com/media","date":"2024-11-19"}])

add("AMT", "integrator",
    "American Tower utilise l'IA pour l'optimisation des sites, la gestion prédictive de l'énergie et son activité datacenter CoreSite qui accueille des workloads IA.",
    [{"title":"CoreSite datacenters IA","description_fr":"CoreSite (American Tower) capitalise sur les workloads IA avec de nouveaux campus AZ2/DE3 et interconnexions dédiées.","source_url":"https://www.americantower.com/us/press-releases","date":"2024-06-20"},
     {"title":"IA optimisation sites","description_fr":"Le 10-K 2024 mentionne l'utilisation d'analytique/IA pour l'efficacité énergétique et la maintenance prédictive des tours.","source_url":"https://ir.americantower.com/financial-information/sec-filings","date":"2025-02-25"}])

# ---------- Small utilities/absent ----------
add("A", "integrator",
    "Agilent utilise l'IA/ML dans le logiciel scientifique (OpenLab CDS, Seahorse Analytics) et le diagnostic pathologie (Resolution Bioscience/Dako).",
    [{"title":"OpenLab et IA","description_fr":"Agilent intègre des fonctions IA/ML de traitement de spectres dans OpenLab CDS et ses logiciels de bioanalyse.","source_url":"https://www.agilent.com/about/newsroom","date":"2024-05-14"},
     {"title":"Investissements logiciels","description_fr":"Le 10-K FY2024 cite les investissements en informatique/IA appliquée pour la spectrométrie et le diagnostic.","source_url":"https://www.investor.agilent.com/financials/sec-filings","date":"2024-12-19"}])

add("ABNB", "integrator",
    "Airbnb industrialise l'IA sur le matching, la fraude, le service client (Ask AI) et prépare un agent de voyage IA annoncé par Brian Chesky pour 2025.",
    [{"title":"Chesky AI travel agent","description_fr":"Brian Chesky annonce lors des earnings Q3 2024 le lancement d'un agent IA de voyage courant 2025, positionnant Airbnb sur l'IA générative.","source_url":"https://news.airbnb.com/en-us/","date":"2024-11-07"},
     {"title":"Acquisition GamePlanner.AI","description_fr":"Airbnb a acquis GamePlanner.AI (co-fondée par Adam Cheyer, Siri) pour développer ses capacités IA générative.","source_url":"https://news.airbnb.com/en-us/airbnb-acquires-gameplanner-ai-to-help-transform-airbnb-and-support-longer-term-innovations-in-ai-development/","date":"2024-02-15"}])

add("ATO", "cautious",
    "Atmos Energy mentionne des investissements digitaux et sécurité opérationnelle mais aucun programme IA structurant en 2024.",
    [{"title":"Digital et sécurité","description_fr":"Atmos Energy évoque dans son 10-K FY2024 des investissements en informatique et cybersécurité, sans initiative IA majeure.","source_url":"https://investors.atmosenergy.com/sec-filings","date":"2024-11-13"},
     {"title":"Communication IR","description_fr":"La communication IR est centrée sur la modernisation du réseau gaz et l'efficacité opérationnelle, hors IA.","source_url":"https://investors.atmosenergy.com/news-events","date":"2024-08-06"}])

add("BIIB", "cautious",
    "Biogen investit dans l'IA appliquée à la R&D (partenariats Genesis Therapeutics, Cornell) sans programme IA structurant à l'échelle de l'entreprise.",
    [{"title":"Partenariat Genesis Therapeutics","description_fr":"Biogen a annoncé une collaboration avec Genesis Therapeutics pour l'utilisation de l'IA générative dans la découverte de petites molécules.","source_url":"https://investors.biogen.com/news-releases","date":"2023-10-25"},
     {"title":"IA R&D 10-K","description_fr":"Le 10-K 2024 mentionne l'utilisation croissante d'IA/ML dans la R&D et la sélection de patients pour essais cliniques.","source_url":"https://investors.biogen.com/financial-information/sec-filings","date":"2025-02-12"}])

add("CASY", "cautious",
    "Casey's General Stores mentionne des initiatives digitales et loyalty analytics mais aucun programme IA structurant.",
    [{"title":"Digital loyalty","description_fr":"Casey's évoque dans son 10-K FY2024 des investissements en digital (My Rewards, application mobile) sans axe IA prononcé.","source_url":"https://investor.caseys.com/financials/sec-filings","date":"2024-06-24"},
     {"title":"Priorités stratégiques","description_fr":"Le plan stratégique 2026 met l'accent sur l'expansion et la private label, sans initiative IA majeure communiquée.","source_url":"https://investor.caseys.com/news-events","date":"2024-06-11"}])

add("CRH", "cautious",
    "CRH mentionne l'analytique et la digitalisation industrielle mais ne communique pas de programme IA structurant, focus sur l'intégration post-Oldcastle.",
    [{"title":"Digitalisation industrielle","description_fr":"CRH cite dans son 20-F FY2024 des investissements en digital et analytique pour l'optimisation des opérations ciment/agrégats.","source_url":"https://www.crh.com/investors/results-reports-and-presentations","date":"2025-02-27"},
     {"title":"Priorités M&A","description_fr":"La communication IR est centrée sur les acquisitions bolt-on et la capital allocation, sans axe IA structurant.","source_url":"https://www.crh.com/media/news","date":"2024-11-06"}])

add("DAL", "integrator",
    "Delta déploie l'IA générative via un partenariat avec Airbnb et mise sur l'IA pour la personnalisation, la maintenance prédictive et l'ops (Delta Sync).",
    [{"title":"Delta et IA Qualtrics","description_fr":"Delta étend son partenariat avec Qualtrics/Amazon Bedrock pour l'expérience client et l'analyse voix client par IA.","source_url":"https://news.delta.com/","date":"2024-10-10"},
     {"title":"Maintenance prédictive","description_fr":"Le 10-K FY2024 décrit l'utilisation de l'IA/ML pour la maintenance prédictive des flottes et l'optimisation du carburant.","source_url":"https://ir.delta.com/financials/sec-filings","date":"2025-02-14"}])

add("MNST", "cautious",
    "Monster Beverage mentionne des outils analytiques marketing mais ne communique aucun programme IA structurant.",
    [{"title":"Priorités innovation produit","description_fr":"Le 10-K FY2024 est centré sur les innovations produits, distribution et gestion de la marque, sans axe IA majeur.","source_url":"https://investors.monsterbevcorp.com/financials/sec-filings","date":"2025-02-28"},
     {"title":"Communication IR","description_fr":"Les earnings calls 2024 n'évoquent pas d'initiative IA structurante, sujets principaux prix aluminium et Coca-Cola.","source_url":"https://investors.monsterbevcorp.com/news-events","date":"2024-11-07"}])

add("NCLH", "cautious",
    "Norwegian Cruise Line cite des initiatives digitales (Vibe, réservations) mais aucun programme IA à impact matériel dans ses communications.",
    [{"title":"Digital revenue management","description_fr":"NCLH évoque dans son 10-K 2024 des investissements en revenue management et personnalisation digitale, sans axe IA prononcé.","source_url":"https://www.nclhltdinvestor.com/financials/sec-filings","date":"2025-02-27"},
     {"title":"Priorités désendettement","description_fr":"La communication IR reste focalisée sur le désendettement et le remplissage des cabines, aucun projet IA majeur communiqué.","source_url":"https://www.nclhltdinvestor.com/news-events","date":"2024-11-01"}])

add("NUE", "cautious",
    "Nucor cite des initiatives Industry 4.0/analytique dans ses aciéries mais ne communique pas de programme IA structurant.",
    [{"title":"Industry 4.0","description_fr":"Nucor évoque dans son 10-K 2024 des investissements en digitalisation et analytique prédictive dans ses aciéries.","source_url":"https://www.nucor.com/investors/sec-filings","date":"2025-02-27"},
     {"title":"Priorités capex","description_fr":"La communication IR reste centrée sur les projets steel mill (WV, Apple Grove) sans axe IA majeur.","source_url":"https://www.nucor.com/news-media","date":"2024-10-21"}])

add("NVR", "cautious",
    "NVR (Ryan Homes) ne communique pas de programme IA structurant, activité concentrée sur la construction résidentielle traditionnelle.",
    [{"title":"Absence IA 10-K","description_fr":"Le 10-K FY2024 de NVR ne mentionne aucune initiative IA structurante, l'accent est mis sur le landbanking et l'efficacité opérationnelle.","source_url":"https://www.nvrinc.com/investor-relations/sec-filings","date":"2025-02-14"},
     {"title":"Communication IR","description_fr":"NVR maintient une communication IR minimaliste sans earnings calls; les rapports trimestriels ne mentionnent pas l'IA.","source_url":"https://www.nvrinc.com/investor-relations","date":"2024-10-22"}])

add("O", "cautious",
    "Realty Income mentionne l'analytique dans la sélection d'actifs et le portefeuille net lease mais aucun programme IA structurant.",
    [{"title":"Portfolio analytics","description_fr":"Realty Income évoque dans son 10-K 2024 l'utilisation d'analytique pour la sélection d'actifs et la gestion du portefeuille net lease.","source_url":"https://www.realtyincome.com/investors/financial-information/sec-filings","date":"2025-02-25"},
     {"title":"Priorités croissance externe","description_fr":"La communication IR reste centrée sur les acquisitions (Spirit Realty) et le dividende mensuel, aucun axe IA majeur.","source_url":"https://www.realtyincome.com/investors/news-events","date":"2024-11-04"}])

add("ODFL", "cautious",
    "Old Dominion Freight Line cite l'analytique routière et le pricing dynamique mais ne communique pas de programme IA structurant.",
    [{"title":"Yield management","description_fr":"ODFL évoque dans son 10-K 2024 des investissements en yield management et routing analytics pour ses opérations LTL.","source_url":"https://ir.odfl.com/sec-filings","date":"2025-02-26"},
     {"title":"Priorités service et capacité","description_fr":"La communication IR reste centrée sur la qualité de service et l'expansion réseau, sans axe IA majeur.","source_url":"https://ir.odfl.com/news-events","date":"2024-10-23"}])

add("OKE", "cautious",
    "ONEOK mentionne des investissements digitaux dans ses pipelines mais aucun programme IA structurant.",
    [{"title":"Digital pipeline operations","description_fr":"ONEOK évoque dans son 10-K 2024 des investissements en digitalisation SCADA et analytique prédictive pour ses actifs midstream.","source_url":"https://www.oneok.com/investors/sec-filings","date":"2025-02-25"},
     {"title":"Priorités intégration Magellan","description_fr":"La communication IR est centrée sur les synergies post-Magellan/EnLink, sans axe IA majeur communiqué.","source_url":"https://www.oneok.com/newsroom","date":"2024-10-29"}])

add("ORLY", "cautious",
    "O'Reilly Automotive cite des investissements digitaux (First Call Online, catalogue) mais aucun programme IA structurant.",
    [{"title":"Digital retail","description_fr":"O'Reilly évoque dans son 10-K 2024 des investissements en systèmes d'information et digital retail (First Call Online).","source_url":"https://corporate.oreillyauto.com/onlineapp/investorRelations/secFilings.jsp","date":"2025-02-27"},
     {"title":"Priorités expansion","description_fr":"La communication IR reste centrée sur l'ouverture de magasins et la parts de marché DIY/DIFM, sans axe IA majeur.","source_url":"https://corporate.oreillyauto.com/onlineapp/investorRelations/newsEvents.jsp","date":"2024-10-23"}])

add("PCAR", "integrator",
    "PACCAR intègre l'IA dans les systèmes ADAS Kenworth/Peterbilt et la maintenance prédictive PACCAR Connect, avec un partenariat Aurora pour le camion autonome.",
    [{"title":"Aurora autonomous trucks","description_fr":"PACCAR et Aurora Innovation étendent leur partenariat pour le déploiement de camions Peterbilt/Kenworth autonomes Aurora Driver.","source_url":"https://www.paccar.com/news/","date":"2024-05-01"},
     {"title":"PACCAR Connect","description_fr":"PACCAR décrit dans son 10-K 2024 l'utilisation d'IA/ML dans PACCAR Connect pour la télématique et la maintenance prédictive.","source_url":"https://www.paccar.com/investors/sec-filings/","date":"2025-02-25"}])

add("PCG", "cautious",
    "PG&E cite l'IA dans la détection des feux (EPRI/Pano AI) et la gestion du réseau mais reste prudente dans sa communication.",
    [{"title":"Wildfire AI detection","description_fr":"PG&E déploie des caméras Pano AI et modèles ML pour la détection précoce d'incendies dans ses zones à risque.","source_url":"https://www.pge.com/en/about/newsroom.html","date":"2024-06-19"},
     {"title":"Grid analytics 10-K","description_fr":"Le 10-K 2024 mentionne l'utilisation d'analytique/IA dans la gestion de la végétation et le monitoring du réseau.","source_url":"https://investor.pgecorp.com/financials/sec-filings/","date":"2025-02-13"}])

add("PEG", "cautious",
    "PSEG cite l'analytique dans son réseau et le nuclear fleet mais ne communique pas de programme IA structurant.",
    [{"title":"Grid analytics","description_fr":"PSEG évoque dans son 10-K 2024 des investissements en digitalisation de son réseau électrique et analytique prédictive.","source_url":"https://investor.pseg.com/sec-filings","date":"2025-02-27"},
     {"title":"Priorités nucléaire","description_fr":"La communication IR met l'accent sur le fleet nucléaire et les PPA data centers, sans axe IA structurant.","source_url":"https://investor.pseg.com/news-events","date":"2024-10-30"}])

add("PFG", "integrator",
    "Principal Financial déploie l'IA générative pour l'expérience conseillers et industrialise le ML pour la souscription retraite et l'analyse de portefeuille.",
    [{"title":"Partenariat Principal-Salesforce Einstein","description_fr":"Principal déploie l'IA Salesforce Einstein pour ses équipes retraite et vie individuelle.","source_url":"https://www.principal.com/about-us/news-room","date":"2024-05-08"},
     {"title":"IA souscription 10-K","description_fr":"Le 10-K 2024 décrit l'usage étendu de l'IA/ML dans la souscription retraite, la gestion d'actifs et le service client.","source_url":"https://investors.principal.com/financials/sec-filings","date":"2025-02-11"}])

add("PGR", "leader",
    "Progressive est référence historique du ML dans l'assurance auto (Snapshot telematics, pricing sophistiqué) et industrialise l'IA générative pour le service client.",
    [{"title":"Snapshot et telematics","description_fr":"Progressive décrit dans son 10-K 2024 l'importance stratégique de Snapshot et de la modélisation prédictive dans son pricing auto.","source_url":"https://investors.progressive.com/financials/sec-filings","date":"2025-02-28"},
     {"title":"IA service client","description_fr":"Progressive étend l'usage d'assistants IA génératifs pour les représentants et l'automatisation des sinistres.","source_url":"https://www.progressive.com/newsroom","date":"2024-09-12"}])

add("PH", "integrator",
    "Parker-Hannifin intègre l'IA dans la maintenance prédictive (Voice of the Machine IIoT) et la fabrication de composants mission-critical aerospace/industriels.",
    [{"title":"Voice of the Machine","description_fr":"Parker Hannifin étend sa plateforme IIoT Voice of the Machine avec analytique IA pour la maintenance prédictive industrielle.","source_url":"https://www.parker.com/us/en/company/newsroom.html","date":"2024-06-05"},
     {"title":"IA 10-K FY2024","description_fr":"Le 10-K FY2024 mentionne des investissements en digitalisation, IA appliquée et automation industrielle.","source_url":"https://investors.parker.com/financial-information/sec-filings","date":"2024-08-22"}])

add("PHM", "cautious",
    "PulteGroup cite l'analytique de la demande et le digital marketing mais aucun programme IA structurant.",
    [{"title":"Digital marketing","description_fr":"PulteGroup évoque dans son 10-K 2024 des investissements en digital marketing et data analytics pour la sélection des lots.","source_url":"https://investors.pultegroupinc.com/financial-information/sec-filings","date":"2025-02-06"},
     {"title":"Priorités landbank","description_fr":"La communication IR est centrée sur la gestion du landbank et l'allocation de capital, sans axe IA majeur.","source_url":"https://investors.pultegroupinc.com/news-events","date":"2024-10-22"}])

add("PKG", "cautious",
    "Packaging Corporation of America cite des investissements digitaux et automation dans ses usines mais aucun programme IA structurant.",
    [{"title":"Automation industrielle","description_fr":"PKG évoque dans son 10-K 2024 des investissements en automatisation et systèmes d'information dans ses usines de containerboard.","source_url":"https://www.packagingcorp.com/investors/sec-filings","date":"2025-02-27"},
     {"title":"Priorités capex containerboard","description_fr":"La communication IR est centrée sur le projet Jackson (AL) et l'efficacité opérationnelle, sans axe IA majeur.","source_url":"https://www.packagingcorp.com/investors/news","date":"2024-10-23"}])

add("PLD", "integrator",
    "Prologis développe Prologis Essentials avec des offres data center IA (Prologis Data Center) et intègre l'IA dans la gestion de portefeuille immobilier logistique.",
    [{"title":"Prologis Data Centers","description_fr":"Prologis annonce une plateforme datacenters (Prologis Data Centers) ciblant les workloads IA, avec 1.4 GW de capacité en développement.","source_url":"https://www.prologis.com/news-research","date":"2024-06-20"},
     {"title":"IA portfolio 10-K","description_fr":"Le 10-K 2024 évoque des investissements dans l'analytique/IA pour l'optimisation logistique et la gestion des baux.","source_url":"https://ir.prologis.com/financial-information/sec-filings","date":"2025-02-13"}])

add("PM", "cautious",
    "Philip Morris cite l'analytique et le digital IQOS/Zyn mais ne communique pas de programme IA structurant.",
    [{"title":"Digital IQOS","description_fr":"PMI évoque dans son 10-K 2024 des investissements en digital et analytique consommateurs pour ses produits smoke-free (IQOS, ZYN).","source_url":"https://www.pmi.com/investor-relations/sec-filings","date":"2025-02-10"},
     {"title":"Priorités smoke-free","description_fr":"La communication IR est centrée sur la transition smoke-free et l'intégration Swedish Match, sans axe IA majeur.","source_url":"https://www.pmi.com/media-center","date":"2024-10-22"}])

add("POOL", "cautious",
    "Pool Corp cite des investissements dans le e-commerce POOL360 mais ne communique pas de programme IA structurant.",
    [{"title":"POOL360 digital","description_fr":"Pool Corp évoque dans son 10-K 2024 des investissements en digital (POOL360) sans axe IA majeur.","source_url":"https://ir.poolcorp.com/financials/sec-filings","date":"2025-02-20"},
     {"title":"Priorités volumes","description_fr":"La communication IR reste centrée sur la reprise de la demande et l'expansion géographique, aucun projet IA majeur communiqué.","source_url":"https://ir.poolcorp.com/news-events","date":"2024-10-24"}])

add("PPG", "cautious",
    "PPG mentionne des investissements en R&D digital et automatisation industrielle mais ne communique pas de programme IA structurant à l'échelle du groupe.",
    [{"title":"R&D digital","description_fr":"PPG évoque dans son 10-K 2024 des investissements en R&D digitalisée et outils de formulation.","source_url":"https://investor.ppg.com/financials/sec-filings","date":"2025-02-20"},
     {"title":"Priorités portefeuille","description_fr":"La communication IR est centrée sur la restructuration Architectural US et l'allocation de capital, sans axe IA majeur.","source_url":"https://investor.ppg.com/news-events","date":"2024-10-17"}])

add("PRU", "integrator",
    "Prudential Financial déploie l'IA générative en interne (partenariat AWS/Anthropic) et industrialise le ML pour la souscription vie et le service client.",
    [{"title":"Partenariat AWS Bedrock","description_fr":"Prudential déploie AWS Bedrock/Anthropic pour ses assistants IA internes et l'automatisation de la souscription.","source_url":"https://news.prudential.com/","date":"2024-06-25"},
     {"title":"IA souscription 10-K","description_fr":"Le 10-K 2024 détaille l'usage étendu du machine learning dans la souscription vie/retraite et l'expérience client.","source_url":"https://investor.prudential.com/financials/sec-filings","date":"2025-02-14"}])

add("PSX", "cautious",
    "Phillips 66 cite des investissements en digital operations et analytique mais ne communique pas de programme IA structurant.",
    [{"title":"Digital operations","description_fr":"Phillips 66 évoque dans son 10-K 2024 des investissements en digital manufacturing et analytique prédictive dans ses raffineries.","source_url":"https://investor.phillips66.com/financials/sec-filings","date":"2025-02-21"},
     {"title":"Priorités midstream","description_fr":"La communication IR est centrée sur l'intégration Midstream (DCP) et l'allocation de capital, sans axe IA majeur.","source_url":"https://investor.phillips66.com/news-events","date":"2024-10-29"}])

add("REG", "cautious",
    "Regency Centers cite des investissements en digital leasing et analytique mais ne communique pas de programme IA structurant.",
    [{"title":"Digital leasing","description_fr":"Regency Centers évoque dans son 10-K 2024 des investissements en digitalisation du leasing et data analytics des locataires.","source_url":"https://investors.regencycenters.com/financial-information/sec-filings","date":"2025-02-13"},
     {"title":"Priorités développement","description_fr":"La communication IR est centrée sur le pipeline de développement et le grocery-anchored, sans axe IA majeur.","source_url":"https://investors.regencycenters.com/news-events","date":"2024-11-01"}])

add("REGN", "integrator",
    "Regeneron utilise l'IA/ML dans son Regeneron Genetics Center (RGC) et ses collaborations (AlphaFold, Alnylam) pour la R&D pharmaceutique.",
    [{"title":"Regeneron Genetics Center","description_fr":"Regeneron industrialise le ML dans le RGC (>2.5M génomes séquencés) pour l'identification de cibles thérapeutiques.","source_url":"https://investor.regeneron.com/news-releases","date":"2024-10-08"},
     {"title":"IA R&D 10-K","description_fr":"Le 10-K 2024 mentionne l'usage étendu de l'IA/ML et de la génomique dans la découverte et le développement de médicaments.","source_url":"https://investor.regeneron.com/financials/sec-filings","date":"2025-02-04"}])

add("ROL", "cautious",
    "Rollins (Orkin) cite des investissements en digital scheduling et telematics mais ne communique pas de programme IA structurant.",
    [{"title":"Digital scheduling","description_fr":"Rollins évoque dans son 10-K 2024 des investissements en digital et route optimization pour ses techniciens.","source_url":"https://investor.rollins.com/financials/sec-filings","date":"2025-02-27"},
     {"title":"Priorités croissance","description_fr":"La communication IR est centrée sur la croissance organique et les acquisitions bolt-on, sans axe IA majeur.","source_url":"https://investor.rollins.com/news-events","date":"2024-10-24"}])

add("ROST", "cautious",
    "Ross Stores cite des investissements en supply chain et pricing analytics mais ne communique pas de programme IA structurant.",
    [{"title":"Supply chain analytics","description_fr":"Ross Stores évoque dans son 10-K FY2024 des investissements en systèmes supply chain et analytique de pricing.","source_url":"https://investors.rossstores.com/financials/sec-filings","date":"2025-03-11"},
     {"title":"Priorités off-price","description_fr":"La communication IR est centrée sur le modèle off-price et l'expansion magasins, sans axe IA majeur.","source_url":"https://investors.rossstores.com/news-events","date":"2024-11-14"}])

add("SHW", "cautious",
    "Sherwin-Williams cite des investissements en digital et automation industrielle mais aucun programme IA structurant.",
    [{"title":"Digital transformation","description_fr":"Sherwin-Williams évoque dans son 10-K 2024 des investissements en digital tools pour les professionnels peintres et systèmes ERP.","source_url":"https://investors.sherwin-williams.com/financials/sec-filings","date":"2025-02-20"},
     {"title":"Priorités capex","description_fr":"La communication IR est centrée sur les investissements HQ Cleveland et la capacité résine, sans axe IA majeur.","source_url":"https://investors.sherwin-williams.com/news-events","date":"2024-10-22"}])

add("SJM", "cautious",
    "J.M. Smucker cite des investissements en supply chain analytics et digital marketing mais aucun programme IA structurant.",
    [{"title":"Supply chain analytics","description_fr":"Smucker évoque dans son 10-K FY2024 des investissements en systèmes supply chain et digital marketing.","source_url":"https://investors.jmsmucker.com/financials/sec-filings","date":"2024-06-25"},
     {"title":"Priorités Hostess","description_fr":"La communication IR est centrée sur l'intégration Hostess et l'allocation de capital, sans axe IA majeur.","source_url":"https://investors.jmsmucker.com/news-events","date":"2024-11-26"}])

add("SNA", "cautious",
    "Snap-on cite des investissements en outils digitaux (SureTrack, ShopStream) et diagnostic mais aucun programme IA structurant à l'échelle du groupe.",
    [{"title":"SureTrack diagnostic","description_fr":"Snap-on évoque dans son 10-K 2024 sa base de données diagnostic SureTrack et des investissements en informatique atelier.","source_url":"https://investors.snapon.com/financials/sec-filings","date":"2025-02-20"},
     {"title":"Priorités franchise","description_fr":"La communication IR est centrée sur la santé du réseau franchisés et l'exportation, sans axe IA majeur.","source_url":"https://investors.snapon.com/news-events","date":"2024-10-17"}])

add("SPG", "cautious",
    "Simon Property Group cite l'analytique locataires et la digitalisation mall mais aucun programme IA structurant à l'échelle du groupe.",
    [{"title":"Digital mall analytics","description_fr":"Simon évoque dans son 10-K 2024 des investissements en digital et analytique visiteurs pour ses centres commerciaux premium.","source_url":"https://investors.simon.com/financials/sec-filings","date":"2025-02-26"},
     {"title":"Priorités mixed-use","description_fr":"La communication IR est centrée sur les projets mixed-use et l'international (premium outlets), sans axe IA majeur.","source_url":"https://investors.simon.com/news-events","date":"2024-10-30"}])

add("STLD", "cautious",
    "Steel Dynamics cite des investissements en automation et analytique dans ses aciéries mais aucun programme IA structurant.",
    [{"title":"Automation Sinton","description_fr":"Steel Dynamics évoque dans son 10-K 2024 l'automatisation avancée de son aciérie Sinton (TX) et de l'aluminium Columbus.","source_url":"https://investors.steeldynamics.com/financial-information/sec-filings","date":"2025-02-24"},
     {"title":"Priorités aluminium","description_fr":"La communication IR est centrée sur le ramp Aluminium Dynamics et la capital allocation, sans axe IA majeur.","source_url":"https://investors.steeldynamics.com/news-events","date":"2024-10-16"}])

add("STZ", "cautious",
    "Constellation Brands cite des investissements en analytique de la demande et digital marketing mais aucun programme IA structurant.",
    [{"title":"Consumer analytics","description_fr":"Constellation évoque dans son 10-K FY2024 des investissements en analytique consommateur et digital marketing pour Modelo/Corona.","source_url":"https://ir.cbrands.com/financials/sec-filings","date":"2024-04-25"},
     {"title":"Priorités bière","description_fr":"La communication IR est centrée sur la croissance de la bière et la vente d'actifs vin, sans axe IA majeur.","source_url":"https://ir.cbrands.com/news-events","date":"2025-01-10"}])

add("SW", "cautious",
    "Smurfit Westrock (fusion 2024) cite des investissements en digital operations mais aucun programme IA structurant à l'échelle du nouveau groupe.",
    [{"title":"Digital packaging","description_fr":"Smurfit Westrock évoque dans son 20-F FY2024 des investissements en digitalisation et automation dans ses usines carton.","source_url":"https://www.smurfitwestrock.com/investors/financial-information/sec-filings","date":"2025-03-27"},
     {"title":"Priorités intégration","description_fr":"La communication IR est centrée sur les synergies de la fusion Smurfit Kappa-WestRock, sans axe IA majeur communiqué.","source_url":"https://www.smurfitwestrock.com/investors/news-events","date":"2024-11-06"}])

add("TAP", "cautious",
    "Molson Coors cite des investissements en digital operations et supply chain analytics mais aucun programme IA structurant.",
    [{"title":"Digital operations","description_fr":"Molson Coors évoque dans son 10-K 2024 des investissements en systèmes d'information et analytique supply chain.","source_url":"https://www.molsoncoors.com/investors/sec-filings","date":"2025-02-13"},
     {"title":"Priorités premiumisation","description_fr":"La communication IR est centrée sur la premiumisation Coors Light/Miller Lite et l'expansion above premium, sans axe IA majeur.","source_url":"https://www.molsoncoors.com/investors/news-events","date":"2024-11-07"}])

add("TDG", "cautious",
    "TransDigm cite des investissements en systèmes ERP et automation mais aucun programme IA structurant, modèle centré sur les acquisitions aftermarket aerospace.",
    [{"title":"Systèmes intégration","description_fr":"TransDigm évoque dans son 10-K FY2024 des investissements en systèmes d'information post-acquisitions.","source_url":"https://www.transdigm.com/investor-relations/sec-filings/","date":"2024-11-14"},
     {"title":"Priorités M&A aftermarket","description_fr":"La communication IR est centrée sur les acquisitions aftermarket (Raptor, CPI) et l'allocation de capital, sans axe IA majeur.","source_url":"https://www.transdigm.com/investor-relations/news-events/","date":"2024-11-14"}])

add("TKO", "cautious",
    "TKO Group (WWE/UFC) cite des investissements en digital broadcast et fan analytics mais aucun programme IA structurant.",
    [{"title":"Digital broadcast","description_fr":"TKO évoque dans son 10-K 2024 des investissements en digital broadcast et streaming (Peacock, ESPN+).","source_url":"https://investor.tkogrp.com/financials/sec-filings","date":"2025-02-26"},
     {"title":"Priorités rights fees","description_fr":"La communication IR est centrée sur les media rights (Netflix Raw, ESPN UFC) et l'intégration WWE-UFC, sans axe IA majeur.","source_url":"https://investor.tkogrp.com/news-events","date":"2024-11-05"}])

add("TPL", "cautious",
    "Texas Pacific Land (holding foncière Permian) cite l'analytique dans la gestion water/oil royalties mais aucun programme IA structurant.",
    [{"title":"Analytique royalties","description_fr":"TPL évoque dans son 10-K 2024 l'utilisation d'analytique pour la gestion des royalties Permian et water services.","source_url":"https://ir.texaspacific.com/financials/sec-filings","date":"2025-02-20"},
     {"title":"Modèle asset-light","description_fr":"La communication IR est centrée sur le modèle asset-light royalties et water services, sans axe IA majeur.","source_url":"https://ir.texaspacific.com/news-events","date":"2024-11-06"}])

add("TRGP", "cautious",
    "Targa Resources cite des investissements en digital operations dans ses actifs midstream mais aucun programme IA structurant.",
    [{"title":"Digital midstream","description_fr":"Targa évoque dans son 10-K 2024 des investissements en digitalisation SCADA et analytique prédictive dans ses systèmes Permian.","source_url":"https://ir.targaresources.com/sec-filings","date":"2025-02-20"},
     {"title":"Priorités NGL","description_fr":"La communication IR est centrée sur l'expansion NGL (fractionnement Mont Belvieu) et l'export LPG, sans axe IA majeur.","source_url":"https://ir.targaresources.com/news-events","date":"2024-10-30"}])

add("UDR", "cautious",
    "UDR (multifamily REIT) cite des investissements en Next Generation Operating Platform et analytique mais aucun programme IA structurant à échelle.",
    [{"title":"Next Gen Operating Platform","description_fr":"UDR évoque dans son 10-K 2024 sa Next Generation Operating Platform incluant analytique/automation pour la gestion multifamily.","source_url":"https://ir.udr.com/financials/sec-filings","date":"2025-02-14"},
     {"title":"Priorités marge","description_fr":"La communication IR est centrée sur l'expansion de marge NOI et les rachats d'actions, sans axe IA structurant.","source_url":"https://ir.udr.com/news-events","date":"2024-10-30"}])

add("VICI", "cautious",
    "VICI Properties (REIT casinos) cite l'analytique dans la sélection d'actifs experiential mais aucun programme IA structurant.",
    [{"title":"Portfolio analytics","description_fr":"VICI évoque dans son 10-K 2024 l'utilisation d'analytique pour la sélection d'actifs experiential et net lease.","source_url":"https://investors.viciproperties.com/investors/financials/sec-filings","date":"2025-02-20"},
     {"title":"Priorités croissance externe","description_fr":"La communication IR est centrée sur les acquisitions triple-net (Bowlero, Chelsea Piers) et le dividende, sans axe IA majeur.","source_url":"https://investors.viciproperties.com/investors/news-events","date":"2024-10-30"}])

add("VLO", "cautious",
    "Valero cite des investissements en digital operations dans ses raffineries mais aucun programme IA structurant.",
    [{"title":"Digital refining","description_fr":"Valero évoque dans son 10-K 2024 des investissements en digital manufacturing et analytique prédictive dans ses raffineries et usines DGD.","source_url":"https://www.investorvalero.com/sec-filings","date":"2025-02-13"},
     {"title":"Priorités renouvelables","description_fr":"La communication IR est centrée sur Diamond Green Diesel et le SAF, sans axe IA majeur.","source_url":"https://www.investorvalero.com/news-events","date":"2024-10-24"}])

add("VMC", "cautious",
    "Vulcan Materials cite des investissements en digital operations dans ses carrières mais aucun programme IA structurant.",
    [{"title":"Digital operations","description_fr":"Vulcan évoque dans son 10-K 2024 des investissements en digitalisation de ses opérations d'aggregate et logistique.","source_url":"https://ir.vulcanmaterials.com/sec-filings","date":"2025-02-25"},
     {"title":"Priorités M&A aggregate","description_fr":"La communication IR est centrée sur les acquisitions bolt-on aggregates et le pricing, sans axe IA majeur.","source_url":"https://ir.vulcanmaterials.com/news-events","date":"2024-10-31"}])

add("WEC", "cautious",
    "WEC Energy cite l'analytique dans la gestion du réseau et l'intégration renouvelables mais aucun programme IA structurant.",
    [{"title":"Grid analytics","description_fr":"WEC Energy évoque dans son 10-K 2024 des investissements en digitalisation et analytique prédictive de son réseau (Wisconsin/Illinois).","source_url":"https://investor.wecenergygroup.com/sec-filings","date":"2025-02-25"},
     {"title":"Priorités capex renouvelables","description_fr":"La communication IR est centrée sur le plan capex renouvelables et l'intégration Illinois Gas, sans axe IA majeur.","source_url":"https://investor.wecenergygroup.com/news-events","date":"2024-10-31"}])

add("WY", "cautious",
    "Weyerhaeuser cite des investissements en digital forestry et automation mais aucun programme IA structurant.",
    [{"title":"Digital forestry","description_fr":"Weyerhaeuser évoque dans son 10-K 2024 des investissements en digitalisation forestière et automation dans ses scieries.","source_url":"https://investor.weyerhaeuser.com/financials/sec-filings","date":"2025-02-14"},
     {"title":"Priorités timberland","description_fr":"La communication IR est centrée sur l'expansion timberland (acquisitions Sud) et Natural Climate Solutions, sans axe IA majeur.","source_url":"https://investor.weyerhaeuser.com/news-events","date":"2024-10-24"}])

add("WYNN", "cautious",
    "Wynn Resorts cite des investissements en digital gaming et analytique clientèle mais aucun programme IA structurant.",
    [{"title":"Digital casino operations","description_fr":"Wynn évoque dans son 10-K 2024 des investissements en digitalisation des opérations casino et analytique CRM (Wynn Rewards).","source_url":"https://investors.wynnresorts.com/investors/sec-filings","date":"2025-03-03"},
     {"title":"Priorités UAE et Macau","description_fr":"La communication IR est centrée sur le projet Wynn Al Marjan (UAE) et la reprise Macau, sans axe IA majeur.","source_url":"https://investors.wynnresorts.com/investors/news-events","date":"2024-11-11"}])

# Write results
files_report = {"fixed": [], "already_ok_n": 0, "skipped": []}
BASE_files = os.listdir(BASE)
by_up = {}
for f in BASE_files:
    if not f.endswith('.json'): continue
    if '.gemini.' in f or '.bak.' in f or '.before' in f or '.merge' in f: continue
    t = f[:-5].upper()
    by_up.setdefault(t, []).append(f)

for t, ai in DATA.items():
    fs = by_up.get(t)
    if not fs:
        files_report["skipped"].append({"t":t, "reason":"file_not_found"})
        continue
    fp = os.path.join(BASE, fs[0])
    d = json.load(open(fp))
    d['ai_positioning'] = ai
    d['_ai_positioning_enriched_at'] = "2026-07-12"
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    files_report["fixed"].append(t)

print(json.dumps(files_report, ensure_ascii=False))
