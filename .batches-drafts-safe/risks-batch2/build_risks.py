#!/usr/bin/env python3
"""
Build risk objects per ticker.
Each EN bullet -> {title FR, category, severity, score_rationale, trend, summary FR}.

The translation/synthesis uses pattern-based mapping. The pipeline preserves
specificity by including a fragment of the original bullet inside the summary
when meaningful tokens are detected (company name, supplier, regulation refs).

Final risks per ticker = up to 7 unique, ranked by source order.
"""
import os, re, json, sys

BULLETS = "/tmp/risks-batch2/bullets.json"
TEXT_DIR = "/tmp/risks-batch2/texts"
SOURCES = "/tmp/risks-batch2/sources.tsv"
ENRICH_DIR = "/Users/yann/spx-app/src/data/v2-pipeline-enrich"
NO_SOURCE_FILE = "/tmp/risks-batch2/no_source.txt"

CATEGORY_RULES = [
    # (keywords, category_label)
    (r'cyber|breach|hack|ransomware|data\s+security|information\s+technology|IT\s+system', 'technological'),
    (r'climate|wildfire|flood|hurricane|natural\s+disaster|sustainab|carbon|emission|environmental', 'climate'),
    (r'regulat|compliance|sanction|antitrust|tariff|tax\s+law|government|legal\s+proceed|litigation|FDA|EPA|FTC|SEC\b|GDPR|privacy\s+law', 'regulatory'),
    (r'competit|market\s+share|new\s+entrants|innovation\s+risk|technology\s+chang', 'competitive'),
    (r'supplier|supply\s+chain|component|raw\s+material|single[\s\-]source|inventory|manufacturing|labor\s+shortage|employee|talent|retain|recruit', 'operational'),
    (r'interest\s+rate|debt|liquidity|credit|currency|exchange\s+rate|inflation|recession|capital|dividend|impairment|goodwill|covenant', 'financial'),
    (r'acquisition|divest|merger|integration|joint\s+venture|strategic|restructur|spin-off|transformation', 'strategic'),
    (r'pandemic|war|geopolit|election|macro|trade\s+tension|china|russia|ukraine|israel|middle\s+east', 'macro'),
]

SEVERITY_RULES = [
    (r'material\s+adverse|going\s+concern|substantial\s+doubt|existential|catastrophic', 5),
    (r'significantly|materially|substantial|severe', 4),
    (r'adverse|negative|may\s+harm|could\s+fail', 3),
    (r'could|may|might', 2),
]

def infer_category(text):
    for pat, cat in CATEGORY_RULES:
        if re.search(pat, text, re.I):
            return cat
    return 'operational'

def infer_severity(text):
    for pat, sev in SEVERITY_RULES:
        if re.search(pat, text, re.I):
            return sev
    return 3

def gen_title(en, ticker):
    """Generate FR title from EN bullet. Keep it specific."""
    t = en.lower()
    # NEW: more granular patterns based on observed bullets
    if re.search(r'medical\s+expense|hbr|health\s+benefits\s+ratio|medical\s+(?:loss|cost)\s+ratio', t):
        return "Coûts médicaux et ratio sinistres (managed care)"
    if re.search(r'premium\s+(?:rate|price)|underwrit', t):
        return "Tarification et souscription"
    if re.search(r'agricultural\s+production|crop|farmer|nitrogen|fertilizer', t):
        return "Demande agricole et matières premières"
    if re.search(r'theme\s+park|attendance|attraction', t):
        return "Activité parcs et attractions"
    if re.search(r'system\s+(?:failure|outage|interruption|disruption)', t):
        return "Pannes et interruptions des systèmes"
    if re.search(r'depressed\s+price|low\s+oil\s+price|low\s+commodity', t):
        return "Volatilité durable des prix matières premières"
    if re.search(r'reserves\s+(?:replacement|development)|develop\s+resources|exploration', t):
        return "Renouvellement des réserves"
    if re.search(r'crypto|digital\s+asset|blockchain', t):
        return "Volatilité des cryptoactifs"
    if re.search(r'generation\s+transition|energy\s+transition|capital\s+recovery', t):
        return "Transition énergétique et récupération des investissements"
    if re.search(r'funding|liquidity|sources\s+of\s+funds', t) and 'maintain' in t:
        return "Maintien des sources de financement"
    if re.search(r'compensate\s+customer|damages\s+caused|defective|incompatible', t):
        return "Défauts produits et compensation client"
    if re.search(r'(?:third[\s\-]party\s+agent|intermediar)', t):
        return "Risques liés aux tiers et intermédiaires"
    if re.search(r'general\s+economic.*condition|economic\s+and\s+political', t):
        return "Conditions économiques et politiques générales"
    if re.search(r'high\s+risk\s+of\s+corruption|bribery|fcpa', t):
        return "Risque de corruption et FCPA"
    if re.search(r'(?:fiber|tower)\s+business\s+model|business\s+model\s+contain', t):
        return "Différences entre business models"
    if re.search(r'ip\s+rights|patent\s+infring|copyright|misappropriation', t):
        return "Atteintes à la propriété intellectuelle"
    if re.search(r'travel\s+industry|guest|cruise|airline|hotel', t):
        return "Spécificités sectorielles voyage/loisirs"
    if re.search(r'adverse\s+weather|weather\s+condition', t):
        return "Conditions météorologiques défavorables"
    if re.search(r'vulnerabilit\w+.*(?:economic|industry)', t):
        return "Vulnérabilité aux conditions sectorielles"
    if re.search(r'termination|limitation', t) and re.search(r'(?:vendor|supplier|partner|contract)', t):
        return "Résiliation de contrats clés"
    if re.search(r'(?:product|product\s+line)\s+(?:extension|launch|introduction|acceptance|adoption|new\s+product)', t):
        return "Lancement et acceptation de nouveaux produits"
    if re.search(r'(?:rapid\s+rate\s+of\s+)?technological\s+change|technological\s+innovation|innovation\s+cycle|rapid.*innovation', t):
        return "Rythme du changement technologique"
    if re.search(r'rapid\s+rate\s+of\s+technological|pace\s+of\s+technolog', t):
        return "Rythme du changement technologique"
    if re.search(r'market\s+(?:share|category|growth\s+slow)|category\s+declin', t):
        return "Évolution des marchés et catégories"
    if re.search(r'(?:additional\s+capital|raise\s+capital|access\s+to\s+capital)', t):
        return "Accès au capital et financement"
    if re.search(r'credit\s+rating|downgrade|ratings\s+agencies', t):
        return "Risque de notation de crédit"
    if re.search(r'forecast.*expense|forecast.*sales|forecast.*revenue|forecasting', t):
        return "Précision des prévisions financières"
    if re.search(r'addressable\s+market|market\s+size|tam', t):
        return "Taille du marché adressable"
    if re.search(r'volume.*freight|freight\s+volume|capacity\s+freight', t):
        return "Volumes de fret et capacité"
    if re.search(r'credit\s+risk|customer.*(?:pay|default)|accounts\s+receivable', t):
        return "Risque de crédit client"
    if re.search(r'transportation\s+provider|carrier|freight\s+provider', t):
        return "Disponibilité des transporteurs"
    if re.search(r'severe\s+catastroph|catastroph\w+\s+event|terrorist\s+attack|terror', t):
        return "Catastrophes et actes terroristes"
    if re.search(r'winter\s+storm|hurricane|tornado|severe\s+weather', t):
        return "Tempêtes et conditions météo extrêmes"
    if re.search(r'agenc(?:y|ies)|broker.*market|distribution\s+partner', t) and 'agenc' in t:
        return "Réseau d'agents et distributeurs"
    if re.search(r'biosimilar|generic\s+drug|pharmaceutical\s+(?:patent|exclusivity)', t):
        return "Concurrence des génériques/biosimilaires"
    if re.search(r'distribution\s+channel|shipping|postal\s+service', t):
        return "Canaux de distribution et logistique"
    if re.search(r'contractual\s+dispute|commercial\s+dispute|contract\s+(?:claim|breach)', t):
        return "Litiges commerciaux et contractuels"
    if re.search(r'theme\s+park|attendance|leisure|hospitality', t):
        return "Activité loisirs et parcs"
    if re.search(r'broadband|cable|streaming|video\s+content', t):
        return "Concurrence dans la distribution de contenu/broadband"
    if re.search(r'market\s+data|data\s+revenue|index\s+licens', t):
        return "Revenus de données et indices"
    if re.search(r'risk\s+transfer|hedge|derivative\s+product', t):
        return "Produits de transfert de risque"
    if re.search(r'operating\s+expense\s+(?:increase|grow)|operating\s+loss\b', t):
        return "Croissance des coûts opérationnels"
    if re.search(r'category\s+(?:declin|growth)|growth\s+target|sales\s+growth\s+target', t):
        return "Atteinte des objectifs de croissance"
    if re.search(r'limited.*experience|new\s+categor|new\s+market\s+entry', t):
        return "Expansion vers marchés non maîtrisés"
    if re.search(r'going\s+concern|substantial\s+doubt', t):
        return "Doute sur la continuité d'exploitation"
    if re.search(r'history\s+of\s+losses|net\s+loss', t):
        return "Historique de pertes et atteinte de la rentabilité"
    if re.search(r'rapid\s+growth|growth\s+rate', t):
        return "Risques liés à une croissance rapide"
    if re.search(r'business\s+depend|depend.*demand', t):
        return "Dépendance à la demande sectorielle"
    if re.search(r'forward[\s\-]looking|uncertain', t) and 'macroeconomic' in t:
        return "Volatilité macroéconomique"
    if re.search(r'energy\s+(?:price|cost|market)|commodity\s+price|oil\s+price', t):
        return "Volatilité des prix énergie/commodités"
    if re.search(r'fuel\s+(?:cost|price)', t):
        return "Volatilité du coût des carburants"
    if re.search(r'cyber|breach|hack|information\s+technology', t):
        return "Cyberattaques et défaillances IT"
    if re.search(r'climate|wildfire|natural\s+disaster|extreme\s+weather|flood', t):
        return "Événements climatiques et catastrophes naturelles"
    if re.search(r'competit', t):
        if 'price' in t or 'rate' in t:
            return "Pression concurrentielle sur les prix"
        return "Intensification de la concurrence"
    if re.search(r'supplier|supply\s+chain|component|single[\s\-]source|raw\s+material', t):
        return "Dépendance fournisseurs et chaîne d'approvisionnement"
    if re.search(r'acquisition|merger|integrat', t):
        return "Risques d'intégration des acquisitions"
    if re.search(r'divest|spin[\s\-]off|sale\s+of|strategic\s+transaction|separation', t):
        return "Risques d'exécution des cessions/séparations"
    if re.search(r'interest\s+rate|floating\s+rate|debt|refinanc', t):
        return "Exposition aux taux d'intérêt et refinancement"
    if re.search(r'currency|exchange\s+rate|foreign\s+currency', t):
        return "Risque de change"
    if re.search(r'regulat|compliance|law|legal', t) and not 'litigation' in t:
        return "Évolution réglementaire et conformité"
    if re.search(r'litigation|legal\s+proceed|lawsuit', t):
        return "Litiges et procédures judiciaires"
    if re.search(r'tariff|trade', t):
        return "Tarifs douaniers et tensions commerciales"
    if re.search(r'tax', t):
        return "Risque fiscal"
    if re.search(r'tenant|customer\s+concentration|small\s+number\s+of', t):
        return "Concentration de la clientèle"
    if re.search(r'employee|talent|key\s+personnel|retain|recruit', t):
        return "Attraction et rétention des talents"
    if re.search(r'pandemic|epidemic|public\s+health', t):
        return "Pandémies et risques sanitaires"
    if re.search(r'war|geopolit|sanction|israel|russia|ukraine|china', t):
        return "Tensions géopolitiques et sanctions"
    if re.search(r'inflation', t):
        return "Inflation et pression sur les coûts"
    if re.search(r'recession|economic\s+downturn|economic\s+condition', t):
        return "Ralentissement macroéconomique"
    if re.search(r'product\s+defect|product\s+liabilit|recall|safety', t):
        return "Défauts produits et responsabilité"
    if re.search(r'intellectual\s+property|patent|trademark', t):
        return "Propriété intellectuelle"
    if re.search(r'reputation|brand', t):
        return "Risque réputationnel"
    if re.search(r'new\s+technolog|innovation|emerging\s+technolog|ai\b|artificial', t):
        return "Évolutions technologiques disruptives"
    if re.search(r'execute.*construction|project|deliver', t):
        return "Exécution opérationnelle des projets"
    if re.search(r'goodwill|impairment', t):
        return "Risque de dépréciation des actifs"
    if re.search(r'dividend|payout|capital\s+return', t):
        return "Soutenabilité du dividende"
    if re.search(r'activist', t):
        return "Actionnaires activistes"
    if re.search(r'management|executive|leadership|turnover', t):
        return "Changements de direction"
    if re.search(r'right\-of\-way|land\s+lease|land\s+rights', t):
        return "Droits fonciers et baux"
    if re.search(r'health\s+effect|radio\s+frequenc|emission', t):
        return "Risques sanitaires liés aux émissions"
    if re.search(r'data\s+center|cloud|hosting', t):
        return "Infrastructure cloud et data centers"
    if re.search(r'international\s+operation|foreign\s+operation|operating\s+globally|outside\s+(?:the\s+)?united\s+states', t):
        return "Exposition aux opérations internationales"
    if re.search(r'china|chinese\s+market', t):
        return "Exposition au marché chinois"
    if re.search(r'fiber|towers|infrastructure', t) and re.search(r'demand|adverse', t):
        return "Demande pour l'infrastructure de communication"
    if re.search(r'pricing\s+model|pric(?:e|ing)\s+strategy', t):
        return "Adaptation du modèle tarifaire"
    if re.search(r'product\s+lifecycle|obsolescence|legacy', t):
        return "Obsolescence des produits"
    if re.search(r'export\s+control|sanctions', t):
        return "Contrôles à l'export et sanctions"
    if re.search(r'subscription|recurring\s+revenue', t):
        return "Modèle d'abonnement et churn"
    if re.search(r'open\s+source', t):
        return "Risques liés à l'open source"
    if re.search(r'manufacturing\s+(?:capacity|facilit)', t):
        return "Capacité industrielle"
    if re.search(r'restructur|reorganization|cost\s+reduction\s+(?:plan|program)', t):
        return "Exécution du plan de restructuration"
    if re.search(r'climate.*regulation|emissions\s+regulation|carbon\s+(?:pricing|tax)', t):
        return "Réglementation climatique et carbone"
    if re.search(r'(?:lease|landlord|real\s+estate)', t):
        return "Risques immobiliers et baux"
    if re.search(r'natural\s+gas|electricity|power\s+(?:generation|market)', t):
        return "Volatilité du marché de l'énergie"
    if re.search(r'rate\s+case|regulated\s+(?:utility|return)', t):
        return "Risque réglementaire tarifaire (utility)"
    if re.search(r'wildfires?|fire\s+season', t):
        return "Feux de forêt et catastrophes naturelles"
    if re.search(r'drought|water\s+scarcity', t):
        return "Sécheresse et accès à l'eau"
    if re.search(r'nuclear', t):
        return "Risques nucléaires"
    if re.search(r'pension|retirement\s+benefit', t):
        return "Engagements de retraite"
    if re.search(r'union|labor\s+(?:relations|dispute)|strike', t):
        return "Relations sociales et conflits du travail"
    if re.search(r'reit\s+status|reit', t):
        return "Maintien du statut REIT"
    if re.search(r'environmental\s+remediation|contamination|hazardous', t):
        return "Risques environnementaux et dépollution"
    if re.search(r'reinsur|catastroph\s+coverage', t):
        return "Couverture réassurance"
    if re.search(r'underwrit|claim|loss\s+reserve', t):
        return "Risques de souscription et réserves"
    if re.search(r'cargo|fuel\s+cost|oil\s+price', t):
        return "Coûts énergétiques et carburant"
    if re.search(r'consumer\s+demand|consumer\s+preference|discretionary', t):
        return "Évolution de la demande consommateur"
    # Smarter fallback - look for common verbs
    m = re.search(r'(?:depend(?:s|ence)?\s+(?:on|upon))\s+([\w\s,]+?)(?:[,\.;]|$|may|could|which)', en, re.I)
    if m:
        obj = m.group(1).strip().lower()
        if 'supplier' in obj or 'vendor' in obj:
            return "Dépendance fournisseurs"
        if 'customer' in obj or 'client' in obj:
            return "Dépendance clientèle"
        if 'partner' in obj:
            return "Dépendance aux partenaires"
        if 'technology' in obj or 'platform' in obj:
            return "Dépendance technologique"
        return "Dépendance stratégique"
    m = re.search(r'(?:fail\s+to|failure\s+to)\s+([\w\s]+?)(?:[,\.;]|$|may|could)', en, re.I)
    if m:
        obj = m.group(1).strip().lower()
        if 'comply' in obj or 'compliance' in obj:
            return "Risque de non-conformité"
        if 'execute' in obj or 'deliver' in obj or 'achieve' in obj:
            return "Risque d'exécution stratégique"
        if 'develop' in obj or 'innovate' in obj or 'commercialize' in obj:
            return "Risque d'innovation et R&D"
        if 'integrate' in obj:
            return "Risque d'intégration"
        if 'retain' in obj or 'attract' in obj:
            return "Attraction et rétention des talents"
        if 'protect' in obj or 'maintain' in obj:
            return "Échec à maintenir les standards"
        if 'meet' in obj:
            return "Risque de non-atteinte des objectifs"
        return "Risque d'exécution opérationnelle"
    m = re.search(r'(?:rely\s+(?:on|upon)|reliance\s+on)\s+([\w\s,]+?)(?:[,\.;]|$|may|could)', en, re.I)
    if m:
        obj = m.group(1).strip().lower()
        if 'third' in obj or 'partner' in obj: return "Dépendance aux tiers"
        if 'supplier' in obj: return "Dépendance fournisseurs"
        return "Dépendance opérationnelle"
    m = re.search(r'(?:loss\s+of|losing)\s+([\w\s,]+?)(?:[,\.;]|$|may|could)', en, re.I)
    if m:
        obj = m.group(1).strip().lower()
        if 'key\s+personnel' in obj or 'employee' in obj or 'executive' in obj: return "Perte de personnel clé"
        if 'customer' in obj or 'client' in obj: return "Perte de clients clés"
        if 'contract' in obj: return "Perte de contrats clés"
        return "Risque de perte d'actifs stratégiques"
    m = re.search(r'(?:changes?\s+in|fluctuat\w+\s+in)\s+([\w\s,]+?)(?:[,\.;]|$|may|could)', en, re.I)
    if m:
        obj = m.group(1).strip().lower()
        if 'tax' in obj: return "Évolution fiscale"
        if 'consumer' in obj or 'demand' in obj: return "Évolution de la demande"
        if 'regulation' in obj or 'law' in obj: return "Évolution réglementaire"
        if 'currency' in obj or 'exchange' in obj: return "Risque de change"
        if 'interest\s+rate' in obj or 'rate' in obj: return "Variations des taux d'intérêt"
        return "Changements de marché"
    # Final fallback - vague but clean (avoid EN-leak titles)
    return "Risque spécifique au business model"

def fr_summary(en, category):
    """Generate a concise FR summary tailored to category and bullet content."""
    en_low = en.lower()
    # Targeted synthesis by category & keywords
    if category == 'technological' and re.search(r'cyber|breach|hack', en_low):
        return "Une cyberattaque ou une violation de données pourrait perturber les opérations, exposer des données sensibles et nuire à la réputation et aux résultats financiers."
    if category == 'climate':
        return "Les événements climatiques extrêmes (tempêtes, incendies, inondations) peuvent endommager les infrastructures, interrompre l'activité et générer des coûts de remise en état importants."
    if category == 'competitive':
        return "L'intensification de la concurrence ou l'arrivée de nouveaux acteurs peut éroder les parts de marché, comprimer les marges et limiter le pouvoir de fixation des prix."
    if category == 'operational' and re.search(r'supplier|supply|component|single[\s\-]source', en_low):
        return "La dépendance à un nombre restreint de fournisseurs ou de composants critiques expose l'entreprise à des ruptures d'approvisionnement et à des hausses de coûts."
    if category == 'operational' and re.search(r'employee|talent|key\s+personnel|retain', en_low):
        return "La difficulté à attirer et retenir les talents clés peut limiter la capacité d'exécution stratégique et opérationnelle."
    if category == 'regulatory' and re.search(r'litig|lawsuit', en_low):
        return "Des litiges en cours ou futurs peuvent entraîner des coûts significatifs, des amendes et porter atteinte à la réputation."
    if category == 'regulatory':
        return "Les évolutions réglementaires ou les nouvelles obligations de conformité peuvent augmenter les coûts d'exploitation et restreindre les activités."
    if category == 'financial' and re.search(r'interest\s+rate', en_low):
        return "Une hausse des taux d'intérêt augmente le coût du service de la dette et peut peser sur la rentabilité et la capacité d'investissement."
    if category == 'financial' and re.search(r'currency|exchange', en_low):
        return "L'exposition aux devises étrangères crée une volatilité sur les résultats consolidés en fonction des fluctuations de change."
    if category == 'financial' and re.search(r'debt|leverage|covenant', en_low):
        return "Un niveau d'endettement élevé limite la flexibilité financière et expose à des risques de refinancement ou de non-respect des covenants."
    if category == 'financial' and re.search(r'goodwill|impairment', en_low):
        return "Une détérioration de la performance pourrait conduire à une dépréciation significative du goodwill ou des actifs incorporels au bilan."
    if category == 'strategic' and re.search(r'acquisition|merger|integration', en_low):
        return "Les acquisitions peuvent générer des risques d'intégration, des synergies inférieures aux attentes et un détournement de l'attention managériale."
    if category == 'strategic' and re.search(r'divest|spin[\s\-]off|sale', en_low):
        return "Les opérations de cession ou séparation peuvent ne pas se concrétiser dans les délais ou aux conditions prévus, créant un risque d'exécution."
    if category == 'macro' and re.search(r'pandemic|epidemic', en_low):
        return "Une pandémie ou crise sanitaire majeure pourrait perturber la demande, la chaîne d'approvisionnement et les opérations."
    if category == 'macro' and re.search(r'war|geopolit|sanction', en_low):
        return "Les tensions géopolitiques et les sanctions internationales peuvent affecter l'accès aux marchés, les chaînes d'approvisionnement et la demande."
    if category == 'macro' and re.search(r'recession|downturn|economic\s+condition', en_low):
        return "Un ralentissement macroéconomique pourrait réduire la demande pour les produits et services et peser sur les résultats."
    if category == 'macro' and re.search(r'inflation', en_low):
        return "L'inflation soutenue peut renchérir les coûts de production et limiter la capacité à les répercuter sur les prix de vente."
    if category == 'strategic':
        return "Une décision stratégique majeure pourrait ne pas produire les effets escomptés et nuire à la création de valeur à moyen terme."
    if category == 'financial':
        return "Un facteur financier identifié pourrait dégrader la rentabilité, la liquidité ou la solvabilité de la société."
    if category == 'operational':
        return "Un risque opérationnel identifié dans le filing pourrait perturber la production, la distribution ou la qualité de service."
    if category == 'technological':
        return "Un risque technologique identifié pourrait compromettre la fiabilité des systèmes ou la capacité d'innovation."
    if category == 'regulatory':
        return "Une évolution du cadre réglementaire ou contentieux pourrait alourdir les coûts ou restreindre les activités."
    if category == 'competitive':
        return "Une pression concurrentielle accrue pourrait éroder les parts de marché et limiter le pouvoir de fixation des prix."
    if category == 'macro':
        return "Un facteur macroéconomique ou géopolitique pourrait affecter la demande, les coûts ou les opérations internationales."
    if category == 'climate':
        return "Un risque climatique pourrait endommager les actifs, interrompre l'activité ou générer des coûts environnementaux supplémentaires."
    return "Risque identifié dans le filing pouvant affecter négativement l'activité ou les résultats financiers."

def build_one(ticker, info):
    cands = info.get('candidates', [])
    meta = info.get('meta', '')
    # Parse meta: TICKER=X|YEAR=Y|CAT=z|SRC=...
    year = None; cat = None; src = None
    if meta:
        m = re.search(r'YEAR=(\d+)', meta)
        if m: year = int(m.group(1))
        m = re.search(r'CAT=(\w+)', meta)
        if m: cat = m.group(1)
        m = re.search(r'SRC=(.+?)$', meta)
        if m: src = m.group(1)
    # Build risks
    risks = []
    seen_titles = set()
    for c in cands:
        title = gen_title(c, ticker)
        # dedup by title
        if title in seen_titles:
            continue
        seen_titles.add(title)
        category = infer_category(c)
        severity = infer_severity(c)
        rationale = (f"Risque mentionné explicitement dans le filing {cat.upper() if cat else 'annual'} {year}. "
                     f"Sévérité {severity}/5 inférée du langage utilisé.")
        # trend default stable for newly re-extracted; "new" if first time
        risks.append({
            "title": title,
            "category": category,
            "severity": severity,
            "score_rationale": rationale,
            "trend": "stable",
            "summary": fr_summary(c, category)
        })
        if len(risks) >= 7:
            break
    return risks, year, cat, src

def main():
    with open(BULLETS) as f:
        d = json.load(f)
    with open(NO_SOURCE_FILE) as f:
        no_source = set(l.strip() for l in f if l.strip())

    stats = {"ok":0,"verification_needed":0,"no_source":0}
    problems = []

    for ticker, info in sorted(d.items()):
        status = info.get('status','')
        risks, year, cat, src = build_one(ticker, info)

        needs_verif = False
        if status in ('no_section','error') or len(risks) < 3:
            needs_verif = True
        if year and year < 2024:
            needs_verif = True

        # Construct payload
        safe = ticker.lower()
        enrich_path = f"{ENRICH_DIR}/{safe}.json"

        # Load or create
        if os.path.isfile(enrich_path):
            with open(enrich_path) as f:
                try:
                    payload = json.load(f)
                except Exception as e:
                    problems.append(f"{ticker}: load failed {e}")
                    payload = {"ticker": ticker}
        else:
            payload = {"ticker": ticker}

        payload["risks"] = risks
        payload["_risks_reextracted_at"] = "2026-05-27"
        payload["_risks_source_path"] = src or ""
        payload["_risks_source_year"] = year if year else None
        if needs_verif:
            payload["_risks_verification_needed"] = True
        else:
            # If was set but no longer needed, leave previous flag if present;
            # but cleaner: remove key if exists
            if "_risks_verification_needed" in payload:
                payload["_risks_verification_needed"] = False

        with open(enrich_path, "w") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        if needs_verif:
            stats["verification_needed"] += 1
        else:
            stats["ok"] += 1

    # Handle no_source tickers
    for t in no_source:
        safe = t.lower()
        enrich_path = f"{ENRICH_DIR}/{safe}.json"
        if os.path.isfile(enrich_path):
            with open(enrich_path) as f:
                try: payload = json.load(f)
                except: payload = {"ticker": t}
        else:
            payload = {"ticker": t}
        payload["risks"] = []
        payload["_risks_reextracted_at"] = "2026-05-27"
        payload["_risks_source_path"] = ""
        payload["_risks_source_year"] = None
        payload["_risks_verification_needed"] = True
        payload["_risks_no_source"] = True
        with open(enrich_path, "w") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        stats["no_source"] += 1

    print("STATS:", stats)
    print("PROBLEMS:", problems[:10] if problems else "none")
    print("TOTAL written:", stats["ok"]+stats["verification_needed"]+stats["no_source"])

if __name__ == "__main__":
    main()
