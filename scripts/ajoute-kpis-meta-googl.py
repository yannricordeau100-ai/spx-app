#!/usr/bin/env python3
"""Mission autonome 1er sept 2026 : nouveaux KPI IC + story pour META et GOOGL.

Chaque valeur provient d une source tierce identifiable, citee dans le signal
et dans _source. Aucune invention : les series trop courtes ont ete rebasculees
en story (regle Yann) ou abandonnees, listees dans le rapport de conversation.
Les series StatCounter sont des moyennes trimestrielles calculees depuis les
CSV officiels gs.statcounter.com telecharges le 1er sept 2026.
"""
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]

def charge_stat(nom):
    return [{"q": q, "v": v} for q, v in json.loads(Path(f"/tmp/kpi-data/{nom}-q.json").read_text())]

def yoy_pts(hist):
    """Ecart en points vs meme periode un an plus tot (series en %)."""
    if len(hist) < 5:
        return None
    d = hist[-1]["v"] - hist[-5]["v"]
    return f"{'+' if d >= 0 else ''}{str(round(d, 1)).replace('.', ',')} pt"

# ---------------------------------------------------------------- GOOGL IC --
SEARCH = charge_stat("search")
CHROME = charge_stat("chrome")
ANDROID = charge_stat("android")

GOOGL_IC = [
    {
        "short": "search_share_ww",
        "name_fr": "Part de marché mondiale de Google Search",
        "name_en": "Google worldwide search market share",
        "explanation_fr": "Part des requêtes de recherche effectuées sur Google parmi tous les moteurs (Bing, Yahoo, Baidu…), mesurée par StatCounter sur le trafic web mondial, tous appareils.",
        "value": SEARCH[-1]["v"], "unit": "%", "yoy": yoy_pts(SEARCH),
        "pv_score": 9, "is_wow": True,
        "signal": f"{str(SEARCH[-1]['v']).replace('.', ',')} % des recherches mondiales au T2 2026, un quasi-monopole stable depuis plus de dix ans malgré l'irruption des IA génératives. Source : StatCounter, moyenne trimestrielle, août 2026.",
        "frequency": "quarterly", "last_data_date": "2026-06-30",
        "history": SEARCH,
        "notes": "Moyenne trimestrielle des parts mensuelles StatCounter (tous appareils, monde). Trimestres complets uniquement.",
        "_source": "StatCounter Global Stats, gs.statcounter.com, CSV telecharge le 2026-09-01",
    },
    {
        "short": "chrome_share_ww",
        "name_fr": "Part de marché mondiale du navigateur Chrome",
        "name_en": "Chrome worldwide browser market share",
        "explanation_fr": "Part des pages web vues depuis Chrome parmi tous les navigateurs, mesurée par StatCounter sur le trafic web mondial, tous appareils.",
        "value": CHROME[-1]["v"], "unit": "%", "yoy": yoy_pts(CHROME),
        "pv_score": 8, "is_wow": True,
        "signal": f"{str(CHROME[-1]['v']).replace('.', ',')} % du web mondial passe par Chrome au T2 2026, contre 43 % début 2015 : la porte d'entrée du web reste contrôlée par Google. Source : StatCounter, moyenne trimestrielle, août 2026.",
        "frequency": "quarterly", "last_data_date": "2026-06-30",
        "history": CHROME,
        "notes": "Moyenne trimestrielle des parts mensuelles StatCounter (tous appareils, monde).",
        "_source": "StatCounter Global Stats, gs.statcounter.com, CSV telecharge le 2026-09-01",
    },
    {
        "short": "android_share_mobile",
        "name_fr": "Part de marché mondiale d'Android (mobile)",
        "name_en": "Android worldwide mobile OS market share",
        "explanation_fr": "Part des smartphones actifs sur le web tournant sous Android, mesurée par StatCounter sur le trafic web mobile mondial. Le reste revient presque entièrement à iOS.",
        "value": ANDROID[-1]["v"], "unit": "%", "yoy": yoy_pts(ANDROID),
        "pv_score": 8, "is_wow": True,
        "signal": f"{str(ANDROID[-1]['v']).replace('.', ',')} % des mobiles dans le monde tournent sous Android au T2 2026 : deux smartphones sur trois embarquent l'écosystème Google. Source : StatCounter, moyenne trimestrielle, août 2026.",
        "frequency": "quarterly", "last_data_date": "2026-06-30",
        "history": ANDROID,
        "notes": "Moyenne trimestrielle des parts mensuelles StatCounter (OS mobile, monde).",
        "_source": "StatCounter Global Stats, gs.statcounter.com, CSV telecharge le 2026-09-01",
    },
    {
        "short": "youtube_tv_share_us",
        "name_fr": "Part de YouTube dans le temps de télévision aux États-Unis",
        "name_en": "YouTube share of US TV viewing time (Nielsen)",
        "explanation_fr": "Pourcentage du temps total passé devant un écran de télévision aux États-Unis capté par YouTube, mesuré par le panel Nielsen (rapport mensuel The Gauge). Première plateforme de streaming à dépasser les chaînes classiques.",
        "value": 12.7, "unit": "%", "yoy": "+1,1 pt",
        "pv_score": 9, "is_wow": True,
        "signal": "12,7 % du temps de télévision américain capté par YouTube en février 2026, contre 7,9 % en février 2023 : YouTube est devenu le premier distributeur de télévision des États-Unis, devant Disney et Netflix. Source : Nielsen The Gauge.",
        "frequency": "quarterly", "last_data_date": "2026-02-28",
        "history": [
            {"q": "Q1-2023", "v": 7.9}, {"q": "Q1-2024", "v": 9.7},
            {"q": "Q3-2024", "v": 10.4}, {"q": "Q4-2024", "v": 11.1},
            {"q": "Q1-2025", "v": 11.6}, {"q": "Q2-2025", "v": 12.4},
            {"q": "Q3-2025", "v": 12.6}, {"q": "Q1-2026", "v": 12.7},
        ],
        "notes": "Points mensuels Nielsen The Gauge rattaches a leur trimestre (fev 2023, mars 2024, juil 2024, dec 2024, fev 2025, avr 2025, sept 2025, fev 2026). Nielsen a retarde le rapport de mars 2026 (differend methodologique).",
        "_source": "Nielsen The Gauge / Media Distributor Gauge, communiques Nielsen 2023-2026 ; adwave.com pour janv-fev 2026",
    },
    {
        "short": "gcp_cloud_share",
        "name_fr": "Part de marché de Google Cloud dans l'infrastructure cloud",
        "name_en": "Google Cloud infrastructure market share (Synergy)",
        "explanation_fr": "Part de Google Cloud dans les dépenses mondiales d'infrastructure cloud (IaaS, PaaS, cloud privé hébergé), estimée chaque trimestre par Synergy Research. AWS et Microsoft Azure sont les deux premiers.",
        "value": 15, "unit": "%", "yoy": "+2 pt",
        "pv_score": 8, "is_wow": True,
        "signal": "15 % du marché mondial de l'infrastructure cloud au T2 2026, contre 9 % début 2022 : Google Cloud grignote AWS (28 %) et Azure (20 %) chaque année, porté par l'IA. Source : Synergy Research Group.",
        "frequency": "quarterly", "last_data_date": "2026-06-30",
        "history": [
            {"q": "Q1-2022", "v": 9}, {"q": "Q1-2023", "v": 10},
            {"q": "Q1-2024", "v": 11}, {"q": "Q3-2025", "v": 13},
            {"q": "Q1-2026", "v": 14}, {"q": "Q2-2026", "v": 15},
        ],
        "notes": "Estimations trimestrielles Synergy Research reprises par Statista et la presse specialisee ; serie discontinue (points publies).",
        "_source": "Synergy Research Group (srgresearch.com), Statista chart 18819, presse Q2 2026",
    },
    {
        "short": "waymo_cities",
        "name_fr": "Villes desservies par Waymo",
        "name_en": "Cities served by Waymo robotaxis",
        "explanation_fr": "Nombre de villes américaines où les robotaxis Waymo (filiale d'Alphabet) transportent des clients payants sans conducteur de sécurité.",
        "value": 10, "unit": "villes", "yoy": "+4",
        "pv_score": 8, "is_wow": True,
        "signal": "10 villes américaines desservies en mars 2026 (Phoenix, San Francisco, Los Angeles, Austin, Atlanta, Miami, Dallas, Houston, San Antonio, Orlando), contre 1 seule fin 2020 ; Londres et Tokyo sont annoncées. Source : Waymo, presse, mars 2026.",
        "frequency": "annual", "last_data_date": "2026-03-31",
        "history": [
            {"q": "FY2020", "v": 1}, {"q": "FY2024", "v": 3},
            {"q": "FY2025", "v": 6}, {"q": "FY2026", "v": 10},
        ],
        "notes": "Phoenix seul public fin 2020 ; SF et LA commerciaux en 2024 ; Austin, Atlanta puis Miami en 2025 ; Dallas, Houston, San Antonio, Orlando debut 2026. FY2026 = etat en mars 2026, pas une cloture d exercice.",
        "_source": "Annonces Waymo (waymo.com/blog), CNBC 18 nov 2025, sherwood.news mars 2026",
    },
]

# Enrichissement de l IC existant waymo_rides_week (1 point -> serie 2023-2026)
WAYMO_RIDES_HISTORY = [
    {"q": "Q2-2023", "v": 10000}, {"q": "Q2-2024", "v": 50000},
    {"q": "Q4-2024", "v": 175000}, {"q": "Q1-2025", "v": 200000},
    {"q": "Q2-2025", "v": 250000}, {"q": "Q4-2025", "v": 450000},
    {"q": "Q1-2026", "v": 500000},
]

# ------------------------------------------------------------- GOOGL story --
GOOGL_STORIES = [
    {
        "short": "waymo_swissre_securite",
        "name_fr": "Waymo : 92 % de blessures en moins que les conducteurs humains",
        "story_fr": "L'étude Waymo x Swiss Re publiée en décembre 2024, portant sur 25,3 millions de miles entièrement autonomes, mesure 92 % de déclarations de dommages corporels et 88 % de dommages matériels en moins que la référence des conducteurs humains (base Swiss Re : plus de 500 000 sinistres et 200 milliards de miles). Sur cette distance, Waymo compte 9 sinistres matériels et 2 corporels, contre 78 et 26 attendus pour des humains.",
        "story_en": "The Waymo x Swiss Re study released in December 2024, covering 25.3 million fully autonomous miles, found 92% fewer bodily injury claims and 88% fewer property damage claims than the human-driver baseline built on 500,000+ claims and 200 billion miles of exposure.",
        "signal": "Preuve assurantielle de la sécurité du robotaxi : -92 % de sinistres corporels vs conducteurs humains (Swiss Re, déc. 2024).",
        "category": "Sécurité",
        "is_short_history": True,
        "_source": "Etude Waymo / Swiss Re, dec 2024 (waymo.com/blog, reinsurancene.ws)",
    },
    {
        "short": "waymo_courses_cumulees",
        "name_fr": "Waymo : plus de 20 millions de courses payantes cumulées",
        "story_fr": "Waymo a franchi les 20 millions de courses payantes cumulées en décembre 2025, dont environ 15 millions réalisées sur la seule année 2025 : le volume de trajets a quadruplé en un an. Le rythme hebdomadaire est passé de 250 000 courses en avril 2025 à 500 000 en mars 2026, avec l'objectif affiché d'un million par semaine fin 2026.",
        "story_en": "Waymo passed 20 million cumulative paid rides in December 2025, including roughly 15 million in 2025 alone; weekly volume grew from 250,000 in April 2025 to 500,000 in March 2026, with a stated target of one million weekly rides by end of 2026.",
        "signal": "20 M de courses payantes cumulées en déc. 2025, volume annuel quadruplé : la seule flotte robotaxi à l'échelle aux États-Unis.",
        "category": "Croissance",
        "is_short_history": True,
        "_source": "Waymo / TechCrunch 27 mars 2026, thedriverlessdigest.com dec 2025",
    },
    {
        "short": "waymo_valorisation",
        "name_fr": "Waymo valorisée 126 milliards de dollars",
        "story_fr": "En février 2026, Waymo a levé 16 milliards de dollars (série D menée par Dragoneer, DST Global et Sequoia, Alphabet apportant la majorité) sur une valorisation de 126 milliards de dollars, presque le triple des 45 milliards d'octobre 2024. Alphabet reste très largement majoritaire : cette pépite interne vaut déjà plus que la plupart des constructeurs automobiles mondiaux.",
        "story_en": "In February 2026 Waymo raised $16 billion (series led by Dragoneer, DST Global and Sequoia, majority funded by Alphabet) at a $126 billion valuation, nearly triple the $45 billion of October 2024.",
        "signal": "126 Mds $ de valorisation en févr. 2026 (levée de 16 Mds $), presque le triple d'octobre 2024.",
        "category": "Valorisation",
        "is_short_history": True,
        "_source": "CNBC / Bloomberg / Electrek, 2 fev 2026",
    },
    {
        "short": "google_apple_20mds",
        "name_fr": "Environ 20 milliards de dollars par an versés à Apple",
        "story_fr": "Les documents du procès antitrust du DOJ ont révélé en mai 2024 que Google a versé 20 milliards de dollars à Apple pour la seule année 2022 afin de rester le moteur de recherche par défaut de Safari, soit 36 % du revenu de recherche généré via le navigateur d'Apple. C'est l'un des accords commerciaux les plus chers du monde, au cœur du jugement sur le monopole de la recherche.",
        "story_en": "DOJ antitrust trial documents revealed in May 2024 that Google paid Apple $20 billion for 2022 alone to remain Safari's default search engine, i.e. 36% of search revenue generated through Apple's browser.",
        "signal": "20 Mds $ versés à Apple pour la seule année 2022 (36 % du revenu de recherche Safari), révélés au procès DOJ.",
        "category": "Modèle économique",
        "is_short_history": True,
        "_source": "Documents du proces DOJ v. Google, reveles mai 2024 (MacRumors, Yahoo Finance)",
    },
    {
        "short": "cout_reponse_ia",
        "name_fr": "Une réponse d'IA coûte environ 10 fois plus qu'une recherche",
        "story_fr": "John Hennessy, président du conseil d'Alphabet, a déclaré à Reuters en février 2023 qu'un échange avec un grand modèle de langage coûte probablement dix fois plus cher qu'une recherche classique par mot-clé, tout en prévoyant une baisse rapide avec l'optimisation des modèles. Ce ratio explique l'enjeu industriel des TPU maison et des datacenters géants d'Alphabet.",
        "story_en": "Alphabet chairman John Hennessy told Reuters in February 2023 that an exchange with a large language model likely costs about 10 times more than a standard keyword search, while predicting rapid cost declines as models are tuned.",
        "signal": "Coût d'une réponse IA ≈ 10x celui d'une recherche classique (John Hennessy, président d'Alphabet, Reuters, févr. 2023).",
        "category": "Modèle économique",
        "is_short_history": True,
        "_source": "Reuters, 22 fev 2023, interview John Hennessy (president d Alphabet)",
    },
    {
        "short": "maps_2mds_utilisateurs",
        "name_fr": "Google Maps : plus de 2 milliards d'utilisateurs par mois",
        "story_fr": "Lors des résultats du T3 2024 (octobre 2024), Alphabet a annoncé que Google Maps dépasse désormais 2 milliards d'utilisateurs mensuels, rejoignant Search, YouTube, Android, Chrome et Gmail dans le club des produits Google à plus de 2 milliards d'utilisateurs. Maps s'appuie sur 20 ans de cartographie et devient une surface publicitaire et IA (Gemini intégré) encore peu monétisée.",
        "story_en": "During Q3 2024 earnings (October 2024), Alphabet announced Google Maps now exceeds 2 billion monthly users, joining Search, YouTube, Android, Chrome and Gmail in the 2-billion-user club.",
        "signal": "2 Mds d'utilisateurs mensuels annoncés au T3 2024 : septième produit Google au-dessus de ce seuil.",
        "category": "Audience",
        "is_short_history": True,
        "_source": "Alphabet, resultats T3 2024 (9to5google, 29 oct 2024)",
    },
    {
        "short": "alphafold_nobel",
        "name_fr": "AlphaFold : 200 millions de structures de protéines et un prix Nobel",
        "story_fr": "AlphaFold, l'IA de Google DeepMind, a prédit la structure de plus de 200 millions de protéines, couvrant la quasi-totalité des protéines connues de la science, utilisées par plus de 2 millions de chercheurs. Ses créateurs Demis Hassabis et John Jumper ont reçu le prix Nobel de chimie 2024 : la première IA d'une entreprise cotée à décrocher un Nobel.",
        "story_en": "AlphaFold, Google DeepMind's AI, has predicted the structure of over 200 million proteins, used by more than 2 million researchers; its creators Demis Hassabis and John Jumper received the 2024 Nobel Prize in Chemistry.",
        "signal": "200 M de structures de protéines prédites, 2 M de chercheurs utilisateurs, Nobel de chimie 2024 pour DeepMind.",
        "category": "Innovation",
        "is_short_history": True,
        "_source": "Google DeepMind (deepmind.google), Nobel de chimie oct 2024",
    },
    {
        "short": "zero_click",
        "name_fr": "Recherches sans clic : de 60 % à 68 % en deux ans",
        "story_fr": "Selon les études SparkToro / Datos, 60,45 % des recherches Google aux États-Unis se terminaient sans aucun clic vers un site en 2024 ; début 2026, cette part atteint 68 %, portée par les réponses IA (AI Overviews). Google garde l'audience sur ses pages : un enjeu majeur pour les éditeurs web et un levier de monétisation directe pour Alphabet.",
        "story_en": "Per SparkToro / Datos studies, 60.45% of US Google searches ended without any click to a website in 2024; by early 2026 that share reached 68%, driven by AI Overviews.",
        "signal": "68 % des recherches US sans clic vers un site début 2026 (60,45 % en 2024) : l'audience reste chez Google. Source : SparkToro.",
        "category": "Mutation du search",
        "is_short_history": True,
        "_source": "SparkToro / Datos, etudes 2024 et 2026 (sparktoro.com)",
    },
]

# ----------------------------------------------------------------- META IC --
META_IC = [
    {
        "short": "threads_mau",
        "name_fr": "Utilisateurs actifs mensuels de Threads",
        "name_en": "Threads monthly active users",
        "explanation_fr": "Nombre de personnes utilisant Threads, le concurrent de X (Twitter) lancé par Meta en juillet 2023, au moins une fois par mois. MAU = utilisateurs actifs mensuels.",
        "value": 400, "unit": "M utilisateurs", "yoy": "+100%",
        "pv_score": 9, "is_wow": True,
        "signal": "400 millions d'utilisateurs mensuels en août 2025, deux ans après le lancement : croissance deux fois plus rapide que TikTok à âge égal, X revendiquait ~600 M. Source : annonces Meta (Zuckerberg).",
        "frequency": "quarterly", "last_data_date": "2025-08-31",
        "history": [
            {"q": "Q4-2023", "v": 100}, {"q": "Q2-2024", "v": 150},
            {"q": "Q3-2024", "v": 200}, {"q": "Q4-2024", "v": 275},
            {"q": "Q1-2025", "v": 320}, {"q": "Q2-2025", "v": 350},
            {"q": "Q3-2025", "v": 400},
        ],
        "notes": "Jalons annonces par Meta (calls de resultats et posts de Mark Zuckerberg) rattaches a leur trimestre : ~100M oct 2023, 150M avr 2024, 200M aout 2024, 275M nov 2024, 320M debut 2025, 350M avr 2025, 400M aout 2025.",
        "_source": "Annonces Meta / Mark Zuckerberg 2023-2025 (calls de resultats, Threads), 9to5mac 12 aout 2025",
    },
    {
        "short": "whatsapp_mau",
        "name_fr": "Utilisateurs mensuels de WhatsApp",
        "name_en": "WhatsApp monthly active users",
        "explanation_fr": "Nombre de personnes utilisant WhatsApp au moins une fois par mois. Racheté 19 milliards de dollars en 2014, WhatsApp est devenu la plus grande messagerie du monde.",
        "value": 3.0, "unit": "Md utilisateurs", "yoy": "+11%",
        "pv_score": 9, "is_wow": True,
        "signal": "3 milliards d'utilisateurs mensuels franchis en 2025 (annonce de Mark Zuckerberg, call du T1 2025) : un humain connecté sur deux utilise WhatsApp, seul Facebook fait mieux. Source : Meta.",
        "frequency": "annual", "last_data_date": "2025-05-01",
        "history": [
            {"q": "FY2014", "v": 0.5}, {"q": "FY2015", "v": 0.7},
            {"q": "FY2016", "v": 1.0}, {"q": "FY2020", "v": 2.0},
            {"q": "FY2023", "v": 2.7}, {"q": "FY2025", "v": 3.0},
        ],
        "notes": "Jalons officiels : 500M avr 2014, 700M janv 2015, 1Md fev 2016, 2Md fev 2020, 2,7Md juil 2023, 3Md annonces au call T1 2025 (TechCrunch 1er mai 2025).",
        "_source": "Annonces WhatsApp/Meta, TechCrunch 1 mai 2025, Statista",
    },
    {
        "short": "rayban_meta_ventes",
        "name_fr": "Lunettes IA Ray-Ban Meta vendues par an",
        "name_en": "Ray-Ban Meta AI glasses sold per year",
        "explanation_fr": "Paires de lunettes connectées Ray-Ban Meta (caméra + assistant IA) vendues chaque année par EssilorLuxottica, partenaire industriel de Meta.",
        "value": 7.0, "unit": "M paires", "yoy": "+600%",
        "pv_score": 9, "is_wow": True,
        "signal": "Plus de 7 millions de paires vendues en 2025, contre 2 millions cumulées sur 2023-2024 : les ventes ont plus que triplé et EssilorLuxottica monte la production vers 10 millions d'unités par an d'ici fin 2026. Source : EssilorLuxottica, févr. 2026.",
        "frequency": "annual", "last_data_date": "2025-12-31",
        "history": [
            {"q": "FY2023", "v": 1.0}, {"q": "FY2024", "v": 1.0}, {"q": "FY2025", "v": 7.0},
        ],
        "notes": "EssilorLuxottica : plus de 1M vendues en 2024 (UploadVR fev 2025), 2M cumulees 2023-2024 (aout 2025), plus de 7M en 2025 (CNBC 11 fev 2026). Repartition 2023/2024 arrondie a 1M chacune sur la base de ces bornes publiques.",
        "_source": "EssilorLuxottica / CNBC 11 fev 2026, UploadVR, Daring Fireball aout 2025",
    },
    {
        "short": "quest_vr_share",
        "name_fr": "Part de marché des casques Quest dans la VR",
        "name_en": "Meta Quest VR headset market share (IDC)",
        "explanation_fr": "Part des casques de réalité virtuelle et mixte Meta Quest dans les livraisons mondiales, mesurée par le cabinet IDC. Apple (Vision Pro), Sony (PSVR2) et ByteDance (Pico) sont les principaux concurrents.",
        "value": 75.7, "unit": "%", "yoy": "+5 pt",
        "pv_score": 7, "is_wow": True,
        "signal": "75,7 % du marché XR (casques + lunettes) au T3 2025 selon IDC, contre 50 % mi-2023 : malgré les milliards perdus par Reality Labs, Meta écrase le matériel VR. Source : IDC.",
        "frequency": "annual", "last_data_date": "2025-09-30",
        "history": [
            {"q": "Q2-2023", "v": 50.2}, {"q": "Q3-2024", "v": 70.8},
            {"q": "FY2024", "v": 74.6}, {"q": "Q3-2025", "v": 75.7},
        ],
        "notes": "Points publies par IDC (tracker AR/VR) : 50,2 % T2 2023, 70,8 % T3 2024, 74,6 % annee 2024, 75,7 % T3 2025 (marche XR incluant lunettes connectees).",
        "_source": "IDC Worldwide Quarterly AR/VR Headset Tracker (communiques 2023-2025)",
    },
    {
        "short": "fb_ados_us",
        "name_fr": "Part des ados américains qui utilisent Facebook",
        "name_en": "Share of US teens using Facebook (Pew)",
        "explanation_fr": "Pourcentage des 13-17 ans américains déclarant utiliser Facebook, mesuré par les enquêtes du Pew Research Center. Indicateur du vieillissement de l'audience du réseau historique.",
        "value": 32, "unit": "%", "yoy": "-1 pt",
        "pv_score": 8, "is_wow": True,
        "signal": "32 % des ados américains seulement utilisent encore Facebook en 2024, contre 71 % en 2014-15 : l'audience du réseau historique vieillit, mais Instagram (61 %) capte la relève. Source : Pew Research Center.",
        "frequency": "annual", "last_data_date": "2024-12-12",
        "history": [
            {"q": "FY2015", "v": 71}, {"q": "FY2018", "v": 51},
            {"q": "FY2022", "v": 32}, {"q": "FY2023", "v": 33}, {"q": "FY2024", "v": 32},
        ],
        "notes": "Enquetes Pew Research Center aupres des 13-17 ans US : 2014-15 (71 %), 2018 (51 %), 2022 (32 %), 2023 (33 %), 2024 (32 %). Pas d enquete chaque annee.",
        "_source": "Pew Research Center, Teens Social Media and Technology 2015-2024",
    },
    {
        "short": "insta_ados_us",
        "name_fr": "Part des ados américains qui utilisent Instagram",
        "name_en": "Share of US teens using Instagram (Pew)",
        "explanation_fr": "Pourcentage des 13-17 ans américains déclarant utiliser Instagram (enquêtes Pew Research Center). À comparer aux 32 % de Facebook : la relève générationnelle de Meta passe par Instagram.",
        "value": 61, "unit": "%", "yoy": "+2 pt",
        "pv_score": 7, "is_wow": True,
        "signal": "61 % des ados américains utilisent Instagram en 2024 (52 % en 2014-15) : pendant que Facebook décroche chez les jeunes, Instagram tient tête à TikTok (63 %). Source : Pew Research Center.",
        "frequency": "annual", "last_data_date": "2024-12-12",
        "history": [
            {"q": "FY2015", "v": 52}, {"q": "FY2022", "v": 62},
            {"q": "FY2023", "v": 59}, {"q": "FY2024", "v": 61},
        ],
        "notes": "Enquetes Pew Research Center aupres des 13-17 ans US. Pas d enquete chaque annee.",
        "_source": "Pew Research Center, Teens Social Media and Technology 2015-2024",
    },
]

# -------------------------------------------------------------- META story --
META_STORIES = [
    {
        "short": "salaires_ia_100m",
        "name_fr": "Des packages à 100 millions de dollars pour les chercheurs IA",
        "story_fr": "En juin 2025, Sam Altman (OpenAI) a affirmé que Meta proposait à ses chercheurs des offres allant jusqu'à 100 millions de dollars pour rejoindre les Superintelligence Labs. Meta a contesté le terme de « prime à la signature », son CTO Andrew Bosworth précisant qu'il s'agissait de packages de rémunération globaux réservés à quelques postes très seniors. Le signal reste le même : la guerre des talents IA se chiffre en dizaines de millions par tête.",
        "story_en": "In June 2025, OpenAI's Sam Altman claimed Meta was offering AI researchers packages of up to $100 million to join its Superintelligence Labs; Meta's CTO disputed the 'signing bonus' framing, describing total compensation packages for a few very senior roles.",
        "signal": "Packages jusqu'à 100 M$ évoqués pour débaucher les chercheurs IA (selon Sam Altman, juin 2025 ; cadrage contesté par Meta).",
        "category": "Talents IA",
        "is_short_history": True,
        "_source": "Sam Altman (podcast Uncapped, juin 2025), CNBC 18 juin 2025, dementi partiel CTO Meta (TechCrunch 27 juin 2025)",
    },
    {
        "short": "hyperion_5gw",
        "name_fr": "Hyperion : un datacenter de 5 GW, la taille de Manhattan",
        "story_fr": "Annoncé par Mark Zuckerberg en juillet 2025, le datacenter Hyperion en Louisiane doit atteindre 5 gigawatts de puissance de calcul pour l'IA, sur une emprise couvrant une grande partie de la superficie de Manhattan. Le coût du projet est passé d'environ 10 à quelque 50 milliards de dollars selon Fortune (juillet 2026) : le plus grand pari d'infrastructure de l'histoire de Meta.",
        "story_en": "Announced by Mark Zuckerberg in July 2025, the Hyperion datacenter in Louisiana targets 5 gigawatts of AI compute on a footprint covering much of Manhattan's area; its cost estimate grew from about $10 billion to some $50 billion (Fortune, July 2026).",
        "signal": "5 GW de calcul IA sur un site grand comme Manhattan, coût réévalué vers 50 Mds $ : le plus grand chantier de Meta (annonce juil. 2025).",
        "category": "Infrastructure IA",
        "is_short_history": True,
        "_source": "Annonce Mark Zuckerberg juil 2025 (itpro, Bloomberg), Fortune 13 juil 2026 pour le cout",
    },
    {
        "short": "scale_ai_49pct",
        "name_fr": "Scale AI : 14,3 milliards de dollars pour 49 %",
        "story_fr": "En juin 2025, Meta a investi 14,3 milliards de dollars pour 49 % (sans droits de vote) de Scale AI, valorisant la société de données d'entraînement 29 milliards. Son fondateur Alexandr Wang a rejoint Meta comme Chief AI Officer pour diriger les Superintelligence Labs : Meta a de fait acheté l'état-major de sa stratégie IA.",
        "story_en": "In June 2025, Meta invested $14.3 billion for a 49% non-voting stake in Scale AI, valuing the training-data company at $29 billion; founder Alexandr Wang joined Meta as Chief AI Officer to lead its Superintelligence Labs.",
        "signal": "14,3 Mds $ pour 49 % de Scale AI (valorisée 29 Mds) et le débauchage de son fondateur comme Chief AI Officer (juin 2025).",
        "category": "Acquisitions IA",
        "is_short_history": True,
        "_source": "CNBC 10-13 juin 2025, communique Meta / Scale AI",
    },
    {
        "short": "controle_zuckerberg",
        "name_fr": "Zuckerberg : 13 % du capital, 61 % des votes",
        "story_fr": "Grâce aux actions de classe B à 10 voix (il en détient 99,7 %), Mark Zuckerberg contrôle environ 61 % des droits de vote de Meta avec environ 13 % du capital économique. Aucune résolution d'actionnaires ne peut passer sans lui : l'investisseur Meta investit d'abord sur les décisions d'un seul homme.",
        "story_en": "Through Class B shares carrying 10 votes each (he owns 99.7% of them), Mark Zuckerberg controls about 61% of Meta's voting power with roughly 13% of the economic ownership.",
        "signal": "61 % des droits de vote avec 13 % du capital : contrôle verrouillé par les actions à 10 voix (proxy 2024-2025).",
        "category": "Gouvernance",
        "is_short_history": True,
        "_source": "Proxy statements Meta (AG mai 2024 et 2025), Harvard Law corpgov fev 2025",
    },
    {
        "short": "whatsapp_100mds_messages",
        "name_fr": "WhatsApp : plus de 100 milliards de messages par jour",
        "story_fr": "Mark Zuckerberg a annoncé en octobre 2020 que WhatsApp achemine environ 100 milliards de messages chaque jour, contre 65 milliards en 2018 : plus d'un million de messages par seconde. C'est l'infrastructure de communication privée la plus utilisée du monde, encore très peu monétisée par rapport à son audience.",
        "story_en": "Mark Zuckerberg announced in October 2020 that WhatsApp delivers roughly 100 billion messages per day, up from 65 billion in 2018 - over one million messages per second.",
        "signal": "100 Mds de messages par jour annoncés en oct. 2020 (65 Mds en 2018) : plus d'un million de messages par seconde.",
        "category": "Audience",
        "is_short_history": True,
        "_source": "Mark Zuckerberg, call de resultats oct 2020 (Slashdot 30 oct 2020)",
    },
    {
        "short": "meta_ai_1md",
        "name_fr": "Meta AI : 1 milliard d'utilisateurs mensuels",
        "story_fr": "L'assistant Meta AI, intégré à Facebook, Instagram et WhatsApp, est passé d'environ 500 millions d'utilisateurs mensuels en septembre 2024 à 700 millions en mars 2025, puis 1 milliard annoncé par Mark Zuckerberg à l'assemblée générale de mai 2025 : la base d'utilisateurs IA grand public la plus large du monde, devant ChatGPT.",
        "story_en": "Meta AI, embedded in Facebook, Instagram and WhatsApp, grew from about 500 million monthly users in September 2024 to 700 million in March 2025, then 1 billion announced by Mark Zuckerberg at the May 2025 annual meeting.",
        "signal": "1 Md d'utilisateurs mensuels en mai 2025 (500 M en sept. 2024) : la plus large base IA grand public au monde.",
        "category": "IA grand public",
        "is_short_history": True,
        "_source": "Annonces Meta : 500M sept 2024, 700M mars 2025, 1Md AG mai 2025 (CNBC 28 mai 2025)",
    },
    {
        "short": "temps_passe_apps",
        "name_fr": "Temps passé par jour : Instagram face à TikTok et YouTube",
        "story_fr": "Selon le panel Sensor Tower du T2 2024, l'utilisateur moyen passe chaque jour 96 minutes sur TikTok, 79 sur YouTube, 63 sur Instagram et 52 sur Facebook dans le monde. Instagram a comblé une partie de l'écart grâce aux Reels (51 minutes mi-2022), mais TikTok reste la référence d'engagement que Meta pourchasse.",
        "story_en": "Per Sensor Tower's Q2 2024 panel, the average user spends 96 minutes a day on TikTok, 79 on YouTube, 63 on Instagram and 52 on Facebook worldwide; Instagram narrowed the gap from 51 minutes in mid-2022 thanks to Reels.",
        "signal": "63 min/jour sur Instagram vs 96 sur TikTok et 79 sur YouTube (Sensor Tower, T2 2024) : l'écart d'engagement se resserre.",
        "category": "Engagement",
        "is_short_history": True,
        "_source": "Sensor Tower, App Intelligence panel T2 2024 (et T2 2022 pour la comparaison)",
    },
    {
        "short": "meta_depasse_google_pub",
        "name_fr": "Meta va dépasser Google dans la publicité digitale en 2026",
        "story_fr": "Selon les prévisions eMarketer de 2026, Meta devrait devenir pour la première fois le premier vendeur de publicité digitale au monde : 243,5 milliards de dollars de revenus publicitaires nets attendus (26,8 % du marché mondial), contre 239,5 milliards pour Google (26,4 %). Un basculement historique : Google dominait ce classement depuis sa création.",
        "story_en": "Per eMarketer's 2026 forecasts, Meta is set to become the world's largest digital ad seller for the first time: $243.5 billion in net ad revenue (26.8% share) versus $239.5 billion for Google (26.4%).",
        "signal": "26,8 % du marché mondial de la pub digitale attendu en 2026, devant Google (26,4 %) pour la première fois. Source : eMarketer.",
        "category": "Marché publicitaire",
        "is_short_history": True,
        "_source": "eMarketer, previsions publiees debut 2026 (emarketer.com, mediapost)",
    },
]

def integre():
    # ---- IC dans kpis-haut ----
    for ticker, nouveaux in [("GOOGL", GOOGL_IC), ("META", META_IC)]:
        p = RACINE / ".batches-drafts-safe" / "kpis-haut" / f"{ticker}.json"
        d = json.loads(p.read_text(encoding="utf8"))
        existants = {k.get("short") for k in d["kpis"]}
        ajoutes = 0
        for k in nouveaux:
            if k["short"] in existants:
                print(f"  {ticker} : {k['short']} deja present, saute")
                continue
            d["kpis"].append(k)
            ajoutes += 1
        # enrichissement waymo_rides_week
        if ticker == "GOOGL":
            for k in d["kpis"]:
                if k.get("short") == "waymo_rides_week":
                    anciens = k.get("history") or []
                    if len(anciens) <= 2:
                        k["history"] = WAYMO_RIDES_HISTORY
                        k["value"] = 500000
                        k["unit"] = k.get("unit") or "courses/semaine"
                        k["yoy"] = "+100%"
                        k["frequency"] = "quarterly"
                        k["last_data_date"] = "2026-03-31"
                        k["signal"] = "500 000 courses payantes par semaine en mars 2026, contre 10 000 mi-2023 : x50 en trois ans, objectif 1 million fin 2026. Source : annonces Waymo / CNBC."
                        k["notes"] = (k.get("notes") or "") + " | 1er sept 2026 : serie reconstituee depuis les jalons publics Waymo (10k mai 2023, 50k mai 2024, 175k nov 2024, 200k fev 2025, 250k avr 2025, 450k dec 2025, 500k mars 2026)."
                        print(f"  GOOGL : waymo_rides_week enrichi ({len(WAYMO_RIDES_HISTORY)} points)")
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
        print(f"{ticker} : {ajoutes} IC ajoutes ({len(d['kpis'])} au total)")

    # ---- stories dans enrich ----
    for ticker, nouvelles in [("googl", GOOGL_STORIES), ("meta", META_STORIES)]:
        p = RACINE / "src" / "data" / "v2-pipeline-enrich" / f"{ticker}.json"
        brut = p.read_text(encoding="utf8")
        compact = "\n" not in brut.strip()
        d = json.loads(brut)
        st = d.setdefault("stories_kpis", [])
        existants = {s.get("short") for s in st} | {s.get("name_fr") for s in st}
        ajoutees = 0
        for s in nouvelles:
            if s["short"] in existants or s["name_fr"] in existants:
                print(f"  {ticker} : story {s['short']} deja presente, sautee")
                continue
            st.append(s)
            ajoutees += 1
        if compact:
            p.write_text(json.dumps(d, ensure_ascii=False) + "\n", encoding="utf8")
        else:
            p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
        print(f"{ticker} : {ajoutees} stories ajoutees ({len(st)} au total)")

if __name__ == "__main__":
    integre()
