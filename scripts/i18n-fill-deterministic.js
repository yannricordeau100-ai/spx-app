#!/usr/bin/env node
/**
 * i18n-fill-deterministic.js
 *
 * Mission : remplir `label_en` sur les slices de `revenue_by_segment` et
 * `revenue_by_geography` via un mapping FR/EN -> EN canonique deterministe
 * (sans LLM). Couvre les ~90% de labels communs.
 *
 * Scope : src/data/v2-pipeline/*.json + src/data/v2-pipeline-enrich/*.json
 * (recursif sur la structure, exclut les fichiers commencant par '_').
 *
 * Modifie UNIQUEMENT le champ `slice.label_en` quand il est absent et
 * qu'un mapping existe. Aucune autre cle n'est touchee.
 *
 * Usage : node scripts/i18n-fill-deterministic.js [--dry]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'src/data/v2-pipeline'),
  path.join(ROOT, 'src/data/v2-pipeline-enrich'),
];
const DRY = process.argv.includes('--dry');

// ---------------------------------------------------------------------------
// Mapping FR/EN -> EN canonique. Cles normalisees (lower + trim + diacritics
// preserves). On accepte aussi les variantes anglaises pour les standardiser.
// ---------------------------------------------------------------------------
const MAP_RAW = {
  // ----- GEO : grandes regions -----
  'amerique du nord': 'North America',
  'amérique du nord': 'North America',
  'north america': 'North America',
  'amerique du sud': 'South America',
  'amérique du sud': 'South America',
  'south america': 'South America',
  'amerique latine': 'Latin America',
  'amérique latine': 'Latin America',
  'latin america': 'Latin America',
  'ameriques': 'Americas',
  'amériques': 'Americas',
  'americas': 'Americas',
  'the americas': 'Americas',
  'autres ameriques': 'Other Americas',
  'autres amériques': 'Other Americas',
  'other americas': 'Other Americas',
  'amerique centrale': 'Central America',
  'amérique centrale': 'Central America',
  'central america': 'Central America',
  'south and central america': 'South and Central America',
  'canada and latin america': 'Canada and Latin America',

  // Europe
  'europe': 'Europe',
  'europe de l\'ouest': 'Western Europe',
  'europe occidentale': 'Western Europe',
  'western europe': 'Western Europe',
  'europe de l\'est': 'Eastern Europe',
  'europe orientale': 'Eastern Europe',
  'eastern europe': 'Eastern Europe',
  'europe centrale et orientale': 'Central and Eastern Europe',
  'central and eastern europe': 'Central and Eastern Europe',
  'europe du sud': 'Southern Europe',
  'southern europe': 'Southern Europe',
  'europe du nord': 'Northern Europe',
  'northern europe': 'Northern Europe',
  'reste de l\'europe': 'Rest of Europe',
  'rest of europe': 'Rest of Europe',
  'other europe': 'Other Europe',
  'autres europe': 'Other Europe',
  'pays nordiques': 'Nordic Countries',
  'nordics': 'Nordics',
  'pays baltes': 'Baltic Countries',
  'baltics': 'Baltics',
  'iberia': 'Iberia',
  'iberie': 'Iberia',
  'ibérie': 'Iberia',

  // Pays Europe
  'france': 'France',
  'allemagne': 'Germany',
  'germany': 'Germany',
  'royaume-uni': 'United Kingdom',
  'royaume uni': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'uk': 'United Kingdom',
  'italie': 'Italy',
  'italy': 'Italy',
  'espagne': 'Spain',
  'spain': 'Spain',
  'portugal': 'Portugal',
  'pays-bas': 'Netherlands',
  'pays bas': 'Netherlands',
  'netherlands': 'Netherlands',
  'belgique': 'Belgium',
  'belgium': 'Belgium',
  'suisse': 'Switzerland',
  'switzerland': 'Switzerland',
  'autriche': 'Austria',
  'austria': 'Austria',
  'irlande': 'Ireland',
  'ireland': 'Ireland',
  'republic of ireland': 'Republic of Ireland',
  'suede': 'Sweden',
  'suède': 'Sweden',
  'sweden': 'Sweden',
  'norvege': 'Norway',
  'norvège': 'Norway',
  'norway': 'Norway',
  'danemark': 'Denmark',
  'denmark': 'Denmark',
  'finlande': 'Finland',
  'finland': 'Finland',
  'pologne': 'Poland',
  'poland': 'Poland',
  'grece': 'Greece',
  'grèce': 'Greece',
  'greece': 'Greece',
  'hongrie': 'Hungary',
  'hungary': 'Hungary',
  'republique tcheque': 'Czech Republic',
  'république tchèque': 'Czech Republic',
  'czech republic': 'Czech Republic',
  'roumanie': 'Romania',
  'romania': 'Romania',
  'lituanie': 'Lithuania',
  'lithuania': 'Lithuania',
  'lettonie': 'Latvia',
  'latvia': 'Latvia',
  'estonie': 'Estonia',
  'estonia': 'Estonia',
  'royaume-uni et irlande': 'United Kingdom and Ireland',
  'royaume uni et irlande': 'United Kingdom and Ireland',
  'united kingdom and ireland': 'United Kingdom and Ireland',

  // Etats-Unis
  'etats-unis': 'United States',
  'etats unis': 'United States',
  'états-unis': 'United States',
  'états unis': 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  'usa': 'United States',
  'u.s.': 'United States',
  'us': 'United States',
  'domestic (usa)': 'Domestic (USA)',
  'hors etats-unis': 'Outside United States',
  'hors états-unis': 'Outside United States',
  'outside united states': 'Outside United States',
  // composites longs (V1.9 residuals)
  'etats-unis et bahamas': 'United States and Bahamas',
  'états-unis et bahamas': 'United States and Bahamas',
  'amerique du nord (etats-unis renewables)': 'North America (United States Renewables)',
  'amérique du nord (etats-unis renewables)': 'North America (United States Renewables)',
  'amerique du sud (bresil 30 ans presence)': 'South America (Brazil 30 years presence)',
  'amérique du sud (brésil 30 ans présence)': 'South America (Brazil 30 years presence)',
  'europe (hors iberia : pologne, france, etc.)': 'Europe (excluding Iberia: Poland, France, etc.)',
  'europe du sud et afrique': 'Southern Europe and Africa',
  'pays-bas (cellnex netherlands 4104 sites)': 'Netherlands (Cellnex Netherlands 4104 sites)',
  'reste du monde (dont italie 2e marche domestique)': 'Rest of the world (incl. Italy 2nd domestic market)',
  'reste du monde (dont italie 2e marché domestique)': 'Rest of the world (incl. Italy 2nd domestic market)',
  'canada': 'Canada',
  'mexique': 'Mexico',
  'mexico': 'Mexico',
  'bresil': 'Brazil',
  'brésil': 'Brazil',
  'brazil': 'Brazil',
  'argentine': 'Argentina',
  'argentina': 'Argentina',
  'chili': 'Chile',
  'chile': 'Chile',
  'perou': 'Peru',
  'pérou': 'Peru',
  'peru': 'Peru',
  'colombie': 'Colombia',
  'colombia': 'Colombia',
  'uruguay': 'Uruguay',
  'venezuela': 'Venezuela',

  // Asie
  'asie': 'Asia',
  'asia': 'Asia',
  'asie-pacifique': 'Asia-Pacific',
  'asie pacifique': 'Asia-Pacific',
  'asia-pacific': 'Asia-Pacific',
  'asia pacific': 'Asia-Pacific',
  'apac': 'APAC',
  'apj': 'APJ',
  'apac (asia pacific)': 'APAC',
  'asie-pacifique japon': 'Asia-Pacific Japan',
  'asie du sud-est': 'Southeast Asia',
  'asie du sud est': 'Southeast Asia',
  'southeast asia': 'Southeast Asia',
  'reste de l\'asie': 'Rest of Asia',
  'rest of asia': 'Rest of Asia',
  'chine': 'China',
  'china': 'China',
  'china (mainland)': 'Mainland China',
  'chine continentale': 'Mainland China',
  'mainland china': 'Mainland China',
  'greater china': 'Greater China',
  'grande chine': 'Greater China',
  'hong kong': 'Hong Kong',
  'taiwan': 'Taiwan',
  'taïwan': 'Taiwan',
  'japon': 'Japan',
  'japan': 'Japan',
  'coree': 'Korea',
  'corée': 'Korea',
  'korea': 'Korea',
  'coree du sud': 'South Korea',
  'corée du sud': 'South Korea',
  'south korea': 'South Korea',
  'inde': 'India',
  'india': 'India',
  'hors inde': 'Outside India',
  'singapour': 'Singapore',
  'singapore': 'Singapore',
  'malaisie': 'Malaysia',
  'malaysia': 'Malaysia',
  'indonesie': 'Indonesia',
  'indonésie': 'Indonesia',
  'indonesia': 'Indonesia',
  'thailande': 'Thailand',
  'thaïlande': 'Thailand',
  'thailand': 'Thailand',
  'philippines': 'Philippines',
  'vietnam': 'Vietnam',
  'pakistan': 'Pakistan',
  'bangladesh': 'Bangladesh',

  // Oceanie
  'oceanie': 'Oceania',
  'océanie': 'Oceania',
  'oceania': 'Oceania',
  'australie': 'Australia',
  'australia': 'Australia',
  'nouvelle-zelande': 'New Zealand',
  'nouvelle zélande': 'New Zealand',
  'new zealand': 'New Zealand',
  'pacific': 'Pacific',
  'pacifique': 'Pacific',
  'pacifique developpe': 'Developed Pacific',
  'pacifique développé': 'Developed Pacific',

  // Afrique / Moyen-Orient
  'afrique': 'Africa',
  'africa': 'Africa',
  'afrique du sud': 'South Africa',
  'south africa': 'South Africa',
  'afrique du nord': 'North Africa',
  'north africa': 'North Africa',
  'afrique de l\'ouest': 'West Africa',
  'west africa': 'West Africa',
  'moyen-orient': 'Middle East',
  'moyen orient': 'Middle East',
  'middle east': 'Middle East',
  'moyen-orient et afrique': 'Middle East and Africa',
  'middle east and africa': 'Middle East and Africa',
  'middle east and north africa': 'Middle East and North Africa',
  'mena': 'MENA',
  'emea': 'EMEA',
  'europe, moyen-orient et afrique': 'Europe, Middle East and Africa',
  'europe moyen-orient et afrique': 'Europe, Middle East and Africa',
  'europe, middle east and africa': 'Europe, Middle East and Africa',
  'europe, middle east, and africa': 'Europe, Middle East and Africa',
  'asie, moyen-orient et afrique': 'Asia, Middle East and Africa',
  'africa, middle east': 'Africa, Middle East',
  'afrique, moyen-orient et europe de l\'est': 'Africa, Middle East and Eastern Europe',
  'israel': 'Israel',
  'israël': 'Israel',
  'egypte': 'Egypt',
  'égypte': 'Egypt',
  'egypt': 'Egypt',
  'turquie': 'Turkey',
  'turkey': 'Turkey',
  'arabie saoudite': 'Saudi Arabia',
  'saudi arabia': 'Saudi Arabia',
  'emirats arabes unis': 'United Arab Emirates',
  'émirats arabes unis': 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  'uae': 'UAE',
  'azerbaidjan': 'Azerbaijan',
  'azerbaïdjan': 'Azerbaijan',

  // Reste du monde / Autres
  'reste du monde': 'Rest of World',
  'rest of world': 'Rest of World',
  'rest of the world': 'Rest of the World',
  'rest of the world ': 'Rest of the World',
  'rest of world ': 'Rest of World',
  'reste du monde ': 'Rest of World',
  'autres': 'Other',
  'other': 'Other',
  'others': 'Others',
  'autres regions': 'Other regions',
  'autres régions': 'Other regions',
  'other regions': 'Other regions',
  'autres pays': 'Other countries',
  'other countries': 'Other countries',
  'autres pays etrangers': 'Other foreign countries',
  'autres pays étrangers': 'Other foreign countries',
  'foreign': 'Foreign',
  'all other countries': 'All other countries',
  'autres geographies matures': 'Other mature geographies',
  'autres géographies matures': 'Other mature geographies',
  'geographies de croissance': 'Growth geographies',
  'géographies de croissance': 'Growth geographies',
  'autres marches': 'Other markets',
  'autres marchés': 'Other markets',
  'other markets': 'Other markets',
  'marches emergents': 'Emerging Markets',
  'marchés émergents': 'Emerging Markets',
  'emerging markets': 'Emerging Markets',
  'marches developpes': 'Developed Markets',
  'marchés développés': 'Developed Markets',
  'developed markets': 'Developed Markets',
  'international': 'International',
  'other international': 'Other International',
  'other operating segments': 'Other operating segments',
  'autres international': 'Other International',
  'other / inter-segment': 'Other / Inter-segment',
  'domestique': 'Domestic',
  'domestic': 'Domestic',
  'caraibes': 'Caribbean',
  'caraïbes': 'Caribbean',
  'caribbean': 'Caribbean',
  'mer du nord': 'North Sea',
  'north sea': 'North Sea',
  'asie/afrique/australasie': 'Asia/Africa/Australasia',
  'asia/africa/australasia': 'Asia/Africa/Australasia',
  'afrique/asie/australie': 'Africa/Asia/Australia',
  'asie et reste du monde': 'Asia and rest of world',
  'europe et reste du monde': 'Europe and rest of world',
  'europe incluant royaume-uni': 'Europe including United Kingdom',
  'stratégies mondiales': 'Global Strategies',
  'strategies mondiales': 'Global Strategies',
  'activites mondiales': 'Global activities',
  'activités mondiales': 'Global activities',
  'global': 'Global',
  'mondial': 'Global',
  'worldwide': 'Worldwide',
  'emea/asie-pacifique': 'EMEA/Asia-Pacific',
  'outside germany': 'Outside Germany',

  // US regions
  'west': 'West',
  'east': 'East',
  'north': 'North',
  'south': 'South',
  'central': 'Central',
  'midwest': 'Midwest',
  'northeast': 'Northeast',
  'north east': 'North East',
  'southeast': 'Southeast',
  'south east': 'South East',
  'northwest': 'Northwest',
  'southwest': 'Southwest',
  'mountain': 'Mountain',
  'pennsylvania': 'Pennsylvania',
  'florida': 'Florida',
  'mid atlantic': 'Mid Atlantic',
  'mid-atlantic': 'Mid Atlantic',
  'mid east': 'Mid East',
  'atlantic': 'Atlantic',

  // ----- SEGMENT : business jargon -----
  // Tech / Cloud
  'cloud': 'Cloud',
  'services': 'Services',
  'service': 'Service',
  'hardware': 'Hardware',
  'software': 'Software',
  'logiciel': 'Software',
  'logiciels': 'Software',
  'materiel': 'Hardware',
  'matériel': 'Hardware',
  'plateforme': 'Platform',
  'plate-forme': 'Platform',
  'platform': 'Platform',
  'technology': 'Technology',
  'technologie': 'Technology',
  'electronics': 'Electronics',
  'electronique': 'Electronics',
  'électronique': 'Electronics',
  'electronic systems': 'Electronic Systems',
  'imaging': 'Imaging',
  'systems': 'Systems',
  'systemes': 'Systems',
  'systèmes': 'Systems',
  'solutions': 'Solutions',
  'systems solutions': 'Systems Solutions',
  'materials solutions': 'Materials Solutions',
  'products': 'Products',
  'produits': 'Products',
  'product': 'Product',
  'produit': 'Product',
  'communications': 'Communications',
  'communication': 'Communication',

  // Ventes / Clients
  'vente directe': 'Direct Sales',
  'ventes directes': 'Direct Sales',
  'direct sales': 'Direct Sales',
  'vente indirecte': 'Indirect Sales',
  'ventes indirectes': 'Indirect Sales',
  'indirect sales': 'Indirect Sales',
  'b2b': 'B2B',
  'b2c': 'B2C',
  'professionnel': 'Enterprise',
  'professionnels': 'Enterprise',
  'professional services': 'Professional Services',
  'particulier': 'Consumer',
  'particuliers': 'Consumer',
  'consumer': 'Consumer',
  'consumers': 'Consumer',
  'consumer services': 'Consumer Services',
  'grand public': 'Consumer',
  'enterprise': 'Enterprise',
  'entreprises': 'Enterprise',
  'entreprise': 'Enterprise',
  'retail': 'Retail',
  'commerce de detail': 'Retail',
  'commerce de détail': 'Retail',
  'wholesale': 'Wholesale',
  'gros': 'Wholesale',
  'commerce de gros': 'Wholesale',
  'wholesalers': 'Wholesalers',
  'retailers': 'Retailers',
  'distributors': 'Distributors',
  'distributeurs': 'Distributors',
  'oems': 'OEMs',
  'oem': 'OEM',
  'staffing': 'Staffing',
  'inhouse': 'Inhouse',
  'professionals': 'Professionals',
  'same store': 'Same Store',

  // Medias / Publicite / Abonnement
  'medias': 'Media',
  'médias': 'Media',
  'media': 'Media',
  'publicite': 'Advertising',
  'publicité': 'Advertising',
  'advertising': 'Advertising',
  'advertising revenue': 'Advertising revenue',
  'recette publicitaire': 'Advertising revenue',
  'souscription': 'Subscription',
  'subscription': 'Subscription',
  'abonnement': 'Subscription',
  'abonnements': 'Subscriptions',
  'subscriptions': 'Subscriptions',
  'entertainment': 'Entertainment',
  'divertissement': 'Entertainment',
  'television': 'Television',
  'télévision': 'Television',
  'cable network programming': 'Cable Network Programming',
  'gaming': 'Gaming',
  'jeux': 'Gaming',
  'jeux video': 'Video Games',
  'jeux vidéo': 'Video Games',

  // Sante / Pharma
  'pharmacie': 'Pharmaceuticals',
  'pharmaceutiques': 'Pharmaceuticals',
  'pharmaceutique': 'Pharmaceuticals',
  'pharmaceuticals': 'Pharmaceuticals',
  'pharma': 'Pharma',
  'diagnostics': 'Diagnostics',
  'diagnostic': 'Diagnostic',
  'medicament': 'Medication',
  'médicament': 'Medication',
  'medicaments': 'Medications',
  'médicaments': 'Medications',
  'medication': 'Medication',
  'medical': 'Medical',
  'medical devices': 'Medical Devices',
  'dispositifs medicaux': 'Medical Devices',
  'dispositifs médicaux': 'Medical Devices',
  'sante': 'Health',
  'santé': 'Health',
  'health': 'Health',
  'health care': 'Health Care',
  'healthcare': 'Healthcare',
  'connected care': 'Connected Care',
  'personal health': 'Personal Health',
  'personal care': 'Personal Care',
  'diagnosis & treatment': 'Diagnosis & Treatment',
  'laboratory': 'Laboratory',
  'laboratoire': 'Laboratory',
  'oncology': 'Oncology',
  'oncologie': 'Oncology',
  'immunology': 'Immunology',
  'immunologie': 'Immunology',
  'neuroscience': 'Neuroscience',
  'neurosciences': 'Neurosciences',
  'animal health': 'Animal Health',
  'sante animale': 'Animal Health',
  'santé animale': 'Animal Health',
  'life sciences': 'Life Sciences',
  'sciences de la vie': 'Life Sciences',
  'injectables': 'Injectables',
  'branded': 'Branded',
  'advanced wound care': 'Advanced Wound Care',
  'ostomy care': 'Ostomy Care',
  'continence care': 'Continence Care',
  'infusion care': 'Infusion Care',

  // Energie
  'energie': 'Energy',
  'énergie': 'Energy',
  'energy': 'Energy',
  'petrole': 'Oil',
  'pétrole': 'Oil',
  'oil': 'Oil',
  'gaz': 'Gas',
  'gas': 'Gas',
  'gaz naturel': 'Natural Gas',
  'natural gas': 'Natural Gas',
  'renouvelables': 'Renewables',
  'energies renouvelables': 'Renewable Energy',
  'énergies renouvelables': 'Renewable Energy',
  'renewables': 'Renewables',
  'renewable energy': 'Renewable Energy',
  'electric': 'Electric',
  'electricite': 'Electricity',
  'électricité': 'Electricity',
  'electricity': 'Electricity',
  'electrification': 'Electrification',
  'utilities': 'Utilities',
  'services publics': 'Utilities',
  'upstream': 'Upstream',
  'midstream': 'Midstream',
  'downstream': 'Downstream',
  'refining': 'Refining',
  'raffinage': 'Refining',
  'exploration & production': 'Exploration & Production',
  'exploration et production': 'Exploration & Production',
  'marketing & services': 'Marketing & Services',
  'pipeline': 'Pipeline',

  // Finance
  'banque': 'Banking',
  'banking': 'Banking',
  'banque de detail': 'Retail Banking',
  'banque de détail': 'Retail Banking',
  'retail banking': 'Retail Banking',
  'banque de proximite': 'Retail Banking',
  'banque de proximité': 'Retail Banking',
  'banque d\'investissement': 'Investment Banking',
  'investment banking': 'Investment Banking',
  'banque commerciale': 'Commercial Banking',
  'commercial banking': 'Commercial Banking',
  'banque privee': 'Private Banking',
  'banque privée': 'Private Banking',
  'private banking': 'Private Banking',
  'private banking & wealth management': 'Private Banking & Wealth Management',
  'banque personnelle': 'Personal Banking',
  'personal banking': 'Personal Banking',
  'consumer banking': 'Consumer Banking',
  'business banking': 'Business Banking',
  'wholesale banking': 'Wholesale Banking',
  'gestion d\'actifs': 'Asset Management',
  'asset management': 'Asset Management',
  'gestion de patrimoine': 'Wealth Management',
  'wealth management': 'Wealth Management',
  'asset & wealth management': 'Asset & Wealth Management',
  'wealth': 'Wealth',
  'patrimoine': 'Wealth',
  'investment management': 'Investment Management',
  'gestion d\'investissement': 'Investment Management',
  'corporate finance': 'Corporate Finance',
  'finance d\'entreprise': 'Corporate Finance',
  'large corporates & institutions': 'Large Corporates & Institutions',
  'grandes clienteles': 'Large Corporates & Institutions',
  'grandes clientèles': 'Large Corporates & Institutions',
  'commercial & institutional': 'Commercial & Institutional',
  'private equity': 'Private Equity',
  'capital investissement': 'Private Equity',
  'mortgage banking': 'Mortgage Banking',
  'gestion de l\'epargne et assurances': 'Savings and Insurance Management',
  'gestion de l\'épargne et assurances': 'Savings and Insurance Management',
  'services financiers specialises': 'Specialized Financial Services',
  'services financiers spécialisés': 'Specialized Financial Services',
  'financial services': 'Financial Services',
  'financial services ': 'Financial Services',
  'services financiers': 'Financial Services',
  'payments': 'Payments',
  'paiements': 'Payments',

  // Assurance
  'assurance': 'Insurance',
  'insurance': 'Insurance',
  'assurance vie': 'Life Insurance',
  'life insurance': 'Life Insurance',
  'life': 'Life',
  'vie': 'Life',
  'assurance non-vie': 'Non-Life Insurance',
  'non-life insurance': 'Non-Life Insurance',
  'p&c': 'Property & Casualty',
  'property & casualty': 'Property & Casualty',
  'reinsurance': 'Reinsurance',
  'reassurance': 'Reinsurance',
  'réassurance': 'Reinsurance',

  // Industrie / Automobile
  'industriel': 'Industrial',
  'industrielle': 'Industrial',
  'industriels': 'Industrial',
  'industrial': 'Industrial',
  'industrials': 'Industrials',
  'industrie': 'Industry',
  'industry': 'Industry',
  'manufacturing': 'Manufacturing',
  'fabrication': 'Manufacturing',
  'infrastructure': 'Infrastructure',
  'infrastructures': 'Infrastructure',
  'automobile': 'Automotive',
  'automotive': 'Automotive',
  'mobility': 'Mobility',
  'mobilite': 'Mobility',
  'mobilité': 'Mobility',
  'transportation': 'Transportation',
  'transport': 'Transport',
  'transports': 'Transport',
  'logistique': 'Logistics',
  'logistics': 'Logistics',
  'marine': 'Marine',
  'aviation': 'Aviation',
  'aerospace': 'Aerospace',
  'aérospatial': 'Aerospace',
  'aerospatial': 'Aerospace',
  'airline': 'Airline',
  'compagnie aerienne': 'Airline',
  'compagnie aérienne': 'Airline',
  'motion': 'Motion',
  'process automation': 'Process Automation',
  'robotics & discrete automation': 'Robotics & Discrete Automation',
  'engineered structures': 'Engineered Structures',
  'test system business': 'Test System Business',

  // Immobilier
  'immobilier': 'Real Estate',
  'real estate': 'Real Estate',
  'residentiel': 'Residential',
  'résidentiel': 'Residential',
  'residential': 'Residential',
  'commercial': 'Commercial',
  'commerciale': 'Commercial',
  'office': 'Office',
  'bureaux': 'Office',
  'multifamily': 'Multifamily',
  'rental': 'Rental',
  'location': 'Rental',
  'landlord & other': 'Landlord & Other',
  'hospitality': 'Hospitality',
  'hotellerie': 'Hospitality',
  'hôtellerie': 'Hospitality',
  'rooms': 'Rooms',

  // Alimentaire / Consommation
  'alimentation': 'Food',
  'alimentaire': 'Food',
  'food': 'Food',
  'food and beverage': 'Food and Beverage',
  'food & beverage': 'Food & Beverage',
  'beverages': 'Beverages',
  'boissons': 'Beverages',
  'beauty': 'Beauty',
  'beaute': 'Beauty',
  'beauté': 'Beauty',
  'pet': 'Pet',
  'animal de compagnie': 'Pet',
  'garden': 'Garden',
  'jardin': 'Garden',
  'outdoor': 'Outdoor',

  // Corporate / Autres
  'corporate': 'Corporate',
  'corporate and other': 'Corporate and Other',
  'corporate and other ': 'Corporate and Other',
  'corporate & other': 'Corporate & Other',
  'corporate / others': 'Corporate / Others',
  'corporate/other': 'Corporate/Other',
  'corporate et autres': 'Corporate and Other',
  'corporate / autres': 'Corporate and Other',
  'corporate and other (incl. e-mobility)': 'Corporate and Other (incl. E-mobility)',
  'all other': 'All Other',
  'other revenue': 'Other revenue',
  'autres revenus': 'Other revenue',
  'other revenues': 'Other revenues',
  'unallocated': 'Unallocated',
  'non alloue': 'Unallocated',
  'non alloué': 'Unallocated',
  'consolidation adjustments': 'Consolidation adjustments',
  'central items & other': 'Central items & other',
  'group headquarters & group services': 'Group Headquarters & Group Services',
  'group development': 'Group Development',
  'other operations': 'Other operations',
  'central': 'Central',
  'rest of business': 'Rest of Business',
  'specialties': 'Specialties',
  'specialites': 'Specialties',
  'spécialités': 'Specialties',

  // Equipement / Operations operateurs
  'equipment revenue': 'Equipment revenue',
  'operator revenue': 'Operator revenue',
  'services and others': 'Services and Others',
  'marketplace': 'Marketplace',
  'place de marche': 'Marketplace',
  'place de marché': 'Marketplace',
};

// Build the lookup map: keys are normalized (NFKC, lower, trim, collapsed ws).
function norm(s) {
  if (typeof s !== 'string') return null;
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ ​-‍﻿]/g, ' ')
    .trim();
}

const MAP = new Map();
for (const [k, v] of Object.entries(MAP_RAW)) {
  const nk = norm(k);
  if (!nk) continue;
  if (!MAP.has(nk)) MAP.set(nk, v);
}

// ---------------------------------------------------------------------------
// Walker : modifie l'objet en place. Retourne stats.
// ---------------------------------------------------------------------------
// Mots FR caracteristiques : si le label contient l'un d'eux, on ne copie pas
// "as is" car ce n'est pas de l'anglais.
// Detecte du francais dans le label : accents ou mots/typonymes francais
// courants. Si match -> on NE COPIE PAS, on laisse pour un futur LLM.
const FR_HINT_WORDS = new RegExp(
  '\\b(' +
    [
      // determinants / liaisons
      'le','la','les','du','des','de','aux','et','ou','pour','avec','sans','hors','dont','chez','sur','sous',
      // mots structurels
      'reste','autres','autre','monde','pays','marche','marches','region','regions','marches',
      // pays/regions ecrits sans accent
      'Allemagne','Italie','Espagne','Chine','Japon','Coree','Bresil','Mexique','Inde','Russie','Suede','Suisse',
      'Norvege','Danemark','Finlande','Pologne','Hongrie','Roumanie','Turquie','Pologne','Grece','Belgique','Autriche',
      'Etats','Unis','Amerique','Amerique','Royaume','Uni','Canada','Australie','Afrique','Asie','Europe',
      // commun FR
      'hopitaux','hopital','medicaments','dispositifs','nutrition','clinique','incluant','infrastructures','renouvelables',
      'energies','services','vente','ventes','filiale','filiales','siege','marche',
    ].join('|') +
    ')\\b',
  'i'
);
const FR_HINT_ACCENT = /[éèêàâôûùçîïœÉÈÊÀÂÔÛÙÇÎÏŒ]/;
function hasFrenchHint(s) {
  if (FR_HINT_ACCENT.test(s)) return true;
  if (FR_HINT_WORDS.test(s)) return true;
  return false;
}

// Mots qui declenchent "ce label est probablement deja en anglais propre" :
// uniquement ASCII, pas de mot FR detecte, longueur raisonnable.
function looksEnglishAsIs(label) {
  if (!/^[\x20-\x7E]+$/.test(label)) return false; // ASCII pur
  if (label.length > 60) return false;
  if (hasFrenchHint(label)) return false;
  return true;
}

function processSliceList(list, kind, stats, applied) {
  if (!Array.isArray(list)) return false;
  let mutated = false;
  for (const slice of list) {
    if (!slice || typeof slice !== 'object') continue;
    if (typeof slice.label_en === 'string' && slice.label_en.trim()) continue;
    const label = slice.label;
    if (typeof label !== 'string') continue;
    const key = norm(label);
    if (!key) continue;
    let en = MAP.get(key);
    let viaCopy = false;
    if (!en && looksEnglishAsIs(label.trim())) {
      en = label.trim();
      viaCopy = true;
    }
    if (!en) {
      stats[kind].skipped++;
      continue;
    }
    slice.label_en = en;
    stats[kind].filled++;
    if (viaCopy) stats[kind].copied = (stats[kind].copied || 0) + 1;
    mutated = true;
    const tally = applied.get(label.trim());
    if (tally) {
      tally.count++;
    } else {
      applied.set(label.trim(), { count: 1, en });
    }
  }
  return mutated;
}

function visit(obj, stats, applied, depth) {
  if (depth > 8 || obj === null || typeof obj !== 'object') return false;
  let mutated = false;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (visit(item, stats, applied, depth + 1)) mutated = true;
    }
    return mutated;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'revenue_by_segment' && obj[key] && Array.isArray(obj[key].slices)) {
      if (processSliceList(obj[key].slices, 'segment', stats, applied)) mutated = true;
    } else if (key === 'revenue_by_geography' && obj[key] && Array.isArray(obj[key].slices)) {
      if (processSliceList(obj[key].slices, 'geography', stats, applied)) mutated = true;
    } else if (visit(obj[key], stats, applied, depth + 1)) {
      mutated = true;
    }
  }
  return mutated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const stats = {
    segment: { filled: 0, skipped: 0 },
    geography: { filled: 0, skipped: 0 },
  };
  const applied = new Map();
  let filesScanned = 0;
  let filesTouched = 0;

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      if (name.startsWith('_')) continue;
      const full = path.join(dir, name);
      let raw;
      try {
        raw = fs.readFileSync(full, 'utf8');
      } catch (e) {
        continue;
      }
      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      filesScanned++;
      const mutated = visit(json, stats, applied, 0);
      if (mutated && !DRY) {
        const out = JSON.stringify(json, null, 2) + '\n';
        fs.writeFileSync(full, out);
        filesTouched++;
      } else if (mutated && DRY) {
        filesTouched++;
      }
    }
  }

  console.log('---');
  console.log('Files scanned:', filesScanned);
  console.log('Files mutated:', filesTouched, DRY ? '(dry run, no write)' : '');
  console.log('Segment slices filled:', stats.segment.filled, '/ skipped:', stats.segment.skipped);
  console.log('Geography slices filled:', stats.geography.filled, '/ skipped:', stats.geography.skipped);
  console.log('Total filled:', stats.segment.filled + stats.geography.filled);
  console.log('---');
  console.log('TOP 25 mappings applied:');
  const top = [...applied.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 25);
  for (const [src, info] of top) {
    console.log('  ' + String(info.count).padStart(4) + '  "' + src + '" -> "' + info.en + '"');
  }
}

main();
