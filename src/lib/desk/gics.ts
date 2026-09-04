/**
 * GICS taxonomy (Global Industry Classification Standard) — canonical structure.
 *
 * Source : MSCI/S&P GICS structure 2023 (revision du 17 mars 2023). Noms FR
 * realignes et codes completes le 5 sept 2026 (163 sous-industries, cf gics-en.ts).
 *
 *   11 secteurs → 25 groupes → 74 industries → 163 sous-industries.
 *
 * Usage dans le desk : navigation hiérarchique, recherche, mapping vers les
 * sociétés Mettrik. Plus tard, le pipeline V2 utilisera ces codes pour ranger
 * automatiquement les 2000+ sociétés.
 */

export type GicsSubIndustry = { code: string; name: string };
export type GicsIndustry = { code: string; name: string; subs: GicsSubIndustry[] };
export type GicsGroup = { code: string; name: string; industries: GicsIndustry[] };
export type GicsSector = { code: string; name: string; nameEn: string; groups: GicsGroup[] };

export const GICS: GicsSector[] = [
  {
    code: "10", name: "Énergie", nameEn: "Energy",
    groups: [
      { code: "1010", name: "Énergie", industries: [
        { code: "101010", name: "Équipements & Services pétroliers", subs: [
          { code: "10101010", name: "Forage pétrolier & gazier" },
          { code: "10101020", name: "Équipements & services pétroliers & gaziers" },
        ]},
        { code: "101020", name: "Pétrole, gaz & combustibles", subs: [
          { code: "10102010", name: "Pétrole & gaz intégrés" },
          { code: "10102020", name: "Pétrole & gaz : exploration & production" },
          { code: "10102030", name: "Pétrole & gaz : raffinage & distribution" },
          { code: "10102040", name: "Pétrole & gaz : stockage & transport" },
          { code: "10102050", name: "Charbon & combustibles" },
        ]},
      ]},
    ],
  },
  {
    code: "15", name: "Matériaux", nameEn: "Materials",
    groups: [
      { code: "1510", name: "Matériaux", industries: [
        { code: "151010", name: "Produits chimiques", subs: [
          { code: "15101010", name: "Produits chimiques de base" },
          { code: "15101020", name: "Produits chimiques diversifiés" },
          { code: "15101030", name: "Engrais & produits agrochimiques" },
          { code: "15101040", name: "Gaz industriels" },
          { code: "15101050", name: "Produits chimiques de spécialité" },
        ]},
        { code: "151020", name: "Matériaux de construction", subs: [
          { code: "15102010", name: "Matériaux de construction" },
        ]},
        { code: "151030", name: "Conteneurs & emballages", subs: [
          { code: "15103010", name: "Contenants métal, verre & plastique" },
          { code: "15103020", name: "Emballages papier & plastique" },
        ]},
        { code: "151040", name: "Métaux & exploitation minière", subs: [
          { code: "15104010", name: "Aluminium" },
          { code: "15104020", name: "Métaux & mines diversifiés" },
          { code: "15104025", name: "Cuivre" },
          { code: "15104030", name: "Or" },
          { code: "15104040", name: "Métaux & minéraux précieux" },
          { code: "15104045", name: "Argent" },
          { code: "15104050", name: "Acier" },
        ]},
        { code: "151050", name: "Papier & forêt", subs: [
          { code: "15105010", name: "Produits forestiers" },
          { code: "15105020", name: "Produits papetiers" },
        ]},
      ]},
    ],
  },
  {
    code: "20", name: "Industrie", nameEn: "Industrials",
    groups: [
      { code: "2010", name: "Biens d'équipement", industries: [
        { code: "201010", name: "Aérospatiale & défense", subs: [
          { code: "20101010", name: "Aéronautique & défense" },
        ]},
        { code: "201020", name: "Produits du bâtiment", subs: [
          { code: "20102010", name: "Produits du bâtiment" },
        ]},
        { code: "201030", name: "Construction & génie civil", subs: [
          { code: "20103010", name: "Construction & ingénierie" },
        ]},
        { code: "201040", name: "Produits électriques", subs: [
          { code: "20104010", name: "Composants & équipements électriques" },
          { code: "20104020", name: "Équipements électriques lourds" },
        ]},
        { code: "201050", name: "Conglomérats industriels", subs: [
          { code: "20105010", name: "Conglomérats industriels" },
        ]},
        { code: "201060", name: "Machinerie", subs: [
          { code: "20106010", name: "Machines de construction & matériel de transport lourd" },
          { code: "20106015", name: "Machines agricoles" },
          { code: "20106020", name: "Machines industrielles, fournitures & composants" },
        ]},
        { code: "201070", name: "Distribution commerciale", subs: [
          { code: "20107010", name: "Sociétés de négoce & distributeurs" },
        ]},
      ]},
      { code: "2020", name: "Services commerciaux", industries: [
        { code: "202010", name: "Services commerciaux & fournitures", subs: [
          { code: "20201010", name: "Impression commerciale" },
          { code: "20201050", name: "Services environnementaux & d'installations" },
          { code: "20201060", name: "Services & fournitures de bureau" },
          { code: "20201070", name: "Services de soutien diversifiés" },
          { code: "20201080", name: "Services de sécurité & d'alarme" },
        ]},
        { code: "202020", name: "Services professionnels", subs: [
          { code: "20202010", name: "Services de personnel & d'emploi" },
          { code: "20202020", name: "Recherche & conseil" },
          { code: "20202030", name: "Traitement de données & services externalisés" },
        ]},
      ]},
      { code: "2030", name: "Transports", industries: [
        { code: "203010", name: "Fret aérien & logistique", subs: [
          { code: "20301010", name: "Fret aérien & logistique" },
        ]},
        { code: "203020", name: "Compagnies aériennes passagers", subs: [
          { code: "20302010", name: "Compagnies aériennes de passagers" },
        ]},
        { code: "203030", name: "Marine", subs: [
          { code: "20303010", name: "Transport maritime" },
        ]},
        { code: "203040", name: "Transport terrestre", subs: [
          { code: "20304010", name: "Transport ferroviaire" },
          { code: "20304030", name: "Transport routier de marchandises" },
          { code: "20304040", name: "Transport terrestre de passagers" },
        ]},
        { code: "203050", name: "Infrastructures transport", subs: [
          { code: "20305010", name: "Services aéroportuaires" },
          { code: "20305020", name: "Autoroutes & voies ferrées" },
          { code: "20305030", name: "Ports maritimes & services" },
        ]},
      ]},
    ],
  },
  {
    code: "25", name: "Consommation discrétionnaire", nameEn: "Consumer Discretionary",
    groups: [
      { code: "2510", name: "Automobile & composants", industries: [
        { code: "251010", name: "Composants automobiles", subs: [
          { code: "25101010", name: "Pièces & équipements automobiles" },
          { code: "25101020", name: "Pneus & caoutchouc" },
        ]},
        { code: "251020", name: "Automobile", subs: [
          { code: "25102010", name: "Constructeurs automobiles" },
          { code: "25102020", name: "Constructeurs de motos" },
        ]},
      ]},
      { code: "2520", name: "Biens durables & habillement", industries: [
        { code: "252010", name: "Biens durables ménagers", subs: [
          { code: "25201010", name: "Électronique grand public" },
          { code: "25201020", name: "Ameublement" },
          { code: "25201030", name: "Construction de logements" },
          { code: "25201040", name: "Appareils électroménagers" },
          { code: "25201050", name: "Articles ménagers & spécialités" },
        ]},
        { code: "252020", name: "Loisirs", subs: [
          { code: "25202010", name: "Produits de loisirs" },
        ]},
        { code: "252030", name: "Textile, habillement & luxe", subs: [
          { code: "25203010", name: "Habillement, accessoires & luxe" },
          { code: "25203020", name: "Chaussures" },
          { code: "25203030", name: "Textiles" },
        ]},
      ]},
      { code: "2530", name: "Services aux consommateurs", industries: [
        { code: "253010", name: "Hôtels, restaurants & loisirs", subs: [
          { code: "25301010", name: "Casinos & jeux" },
          { code: "25301020", name: "Hôtels, resorts & croisières" },
          { code: "25301030", name: "Installations de loisirs" },
          { code: "25301040", name: "Restaurants" },
        ]},
        { code: "253020", name: "Services divers aux consommateurs", subs: [
          { code: "25302010", name: "Services d'éducation" },
          { code: "25302020", name: "Services spécialisés aux consommateurs" },
        ]},
      ]},
      { code: "2550", name: "Distribution discrétionnaire", industries: [
        { code: "255010", name: "Distribution & marketing", subs: [
          { code: "25501010", name: "Distributeurs" },
        ]},
        { code: "255030", name: "Distribution généraliste", subs: [
          { code: "25503030", name: "Distribution généraliste" },
        ]},
        { code: "255040", name: "Distribution spécialisée", subs: [
          { code: "25504010", name: "Distribution d'habillement" },
          { code: "25504020", name: "Distribution informatique & électronique" },
          { code: "25504030", name: "Distribution bricolage & maison" },
          { code: "25504040", name: "Autres distributions spécialisées" },
          { code: "25504050", name: "Distribution automobile" },
          { code: "25504060", name: "Distribution d'ameublement" },
        ]},
      ]},
    ],
  },
  {
    code: "30", name: "Consommation de base", nameEn: "Consumer Staples",
    groups: [
      { code: "3010", name: "Distribution & vente alimentation", industries: [
        { code: "301010", name: "Distribution alimentation", subs: [
          { code: "30101010", name: "Pharmacies & parapharmacies" },
          { code: "30101020", name: "Distributeurs alimentaires" },
          { code: "30101030", name: "Distribution alimentaire" },
          { code: "30101040", name: "Distribution de produits de base" },
        ]},
      ]},
      { code: "3020", name: "Aliments, boissons & tabac", industries: [
        { code: "302010", name: "Boissons", subs: [
          { code: "30201010", name: "Brasseurs" },
          { code: "30201020", name: "Distillateurs & vignerons" },
          { code: "30201030", name: "Boissons sans alcool" },
        ]},
        { code: "302020", name: "Produits alimentaires", subs: [
          { code: "30202010", name: "Produits & services agricoles" },
          { code: "30202030", name: "Aliments emballés & viandes" },
        ]},
        { code: "302030", name: "Tabac", subs: [
          { code: "30203010", name: "Tabac" },
        ]},
      ]},
      { code: "3030", name: "Produits ménagers & personnels", industries: [
        { code: "303010", name: "Produits ménagers", subs: [
          { code: "30301010", name: "Produits ménagers" },
        ]},
        { code: "303020", name: "Produits personnels", subs: [
          { code: "30302010", name: "Produits de soins personnels" },
        ]},
      ]},
    ],
  },
  {
    code: "35", name: "Santé", nameEn: "Health Care",
    groups: [
      { code: "3510", name: "Équipements & services santé", industries: [
        { code: "351010", name: "Équipements & fournitures santé", subs: [
          { code: "35101010", name: "Équipements de santé" },
          { code: "35101020", name: "Fournitures de santé" },
        ]},
        { code: "351020", name: "Fournisseurs & services santé", subs: [
          { code: "35102010", name: "Distributeurs de santé" },
          { code: "35102015", name: "Services de santé" },
          { code: "35102020", name: "Établissements de santé" },
          { code: "35102030", name: "Assurance santé gérée" },
        ]},
        { code: "351030", name: "Technologies santé", subs: [
          { code: "35103010", name: "Technologies de la santé" },
        ]},
      ]},
      { code: "3520", name: "Pharmaceutique, biotechnologie & sciences", industries: [
        { code: "352010", name: "Biotechnologie", subs: [
          { code: "35201010", name: "Biotechnologie" },
        ]},
        { code: "352020", name: "Pharmaceutique", subs: [
          { code: "35202010", name: "Pharmacie" },
        ]},
        { code: "352030", name: "Sciences de la vie outils & services", subs: [
          { code: "35203010", name: "Outils & services des sciences de la vie" },
        ]},
      ]},
    ],
  },
  {
    code: "40", name: "Finance", nameEn: "Financials",
    groups: [
      { code: "4010", name: "Banques", industries: [
        { code: "401010", name: "Banques", subs: [
          { code: "40101010", name: "Banques diversifiées" },
          { code: "40101015", name: "Banques régionales" },
        ]},
      ]},
      { code: "4020", name: "Services financiers", industries: [
        { code: "402010", name: "Services financiers", subs: [
          { code: "40201020", name: "Services financiers diversifiés" },
          { code: "40201030", name: "Holdings multi-secteurs" },
          { code: "40201040", name: "Finance spécialisée" },
          { code: "40201050", name: "Financement hypothécaire commercial & résidentiel" },
          { code: "40201060", name: "Traitement des transactions & paiements" },
        ]},
        { code: "402020", name: "Crédit à la consommation", subs: [
          { code: "40202010", name: "Crédit à la consommation" },
        ]},
        { code: "402030", name: "Marchés de capitaux", subs: [
          { code: "40203010", name: "Gestion d'actifs & banques dépositaires" },
          { code: "40203020", name: "Banque d'investissement & courtage" },
          { code: "40203030", name: "Marchés de capitaux diversifiés" },
          { code: "40203040", name: "Bourses & données financières" },
        ]},
        { code: "402040", name: "Hypothèques REITs", subs: [
          { code: "40204010", name: "REITs hypothécaires" },
        ]},
      ]},
      { code: "4030", name: "Assurances", industries: [
        { code: "403010", name: "Assurance", subs: [
          { code: "40301010", name: "Courtiers d'assurance" },
          { code: "40301020", name: "Assurance vie & santé" },
          { code: "40301030", name: "Assurance multirisque" },
          { code: "40301040", name: "Assurance dommages" },
          { code: "40301050", name: "Réassurance" },
        ]},
      ]},
    ],
  },
  {
    code: "45", name: "Technologies de l'information", nameEn: "Information Technology",
    groups: [
      { code: "4510", name: "Logiciels & services", industries: [
        { code: "451020", name: "Services informatiques", subs: [
          { code: "45102010", name: "Conseil informatique & autres services" },
          { code: "45102030", name: "Services & infrastructures Internet" },
        ]},
        { code: "451030", name: "Logiciels", subs: [
          { code: "45103010", name: "Logiciels d'application" },
          { code: "45103020", name: "Logiciels système" },
        ]},
      ]},
      { code: "4520", name: "Matériel & équipement informatique", industries: [
        { code: "452010", name: "Équipements communications", subs: [
          { code: "45201020", name: "Équipements de communication" },
        ]},
        { code: "452020", name: "Matériel technologique, stockage & périphériques", subs: [
          { code: "45202030", name: "Matériel informatique, stockage & périphériques" },
        ]},
        { code: "452030", name: "Composants électroniques", subs: [
          { code: "45203010", name: "Équipements & instruments électroniques" },
          { code: "45203015", name: "Composants électroniques" },
          { code: "45203020", name: "Sous-traitance électronique" },
          { code: "45203030", name: "Distributeurs technologiques" },
        ]},
      ]},
      { code: "4530", name: "Semi-conducteurs", industries: [
        { code: "453010", name: "Semi-conducteurs & équipement", subs: [
          { code: "45301010", name: "Matériaux & équipements pour semi-conducteurs" },
          { code: "45301020", name: "Semi-conducteurs" },
        ]},
      ]},
    ],
  },
  {
    code: "50", name: "Services de communication", nameEn: "Communication Services",
    groups: [
      { code: "5010", name: "Services de télécommunications", industries: [
        { code: "501010", name: "Services télécommunications diversifiés", subs: [
          { code: "50101010", name: "Opérateurs alternatifs" },
          { code: "50101020", name: "Services de télécommunication intégrés" },
        ]},
        { code: "501020", name: "Services télécommunications sans fil", subs: [
          { code: "50102010", name: "Télécommunications sans fil" },
        ]},
      ]},
      { code: "5020", name: "Médias & divertissement", industries: [
        { code: "502010", name: "Médias", subs: [
          { code: "50201010", name: "Publicité" },
          { code: "50201020", name: "Radiodiffusion & télévision" },
          { code: "50201030", name: "Câble & satellite" },
          { code: "50201040", name: "Édition" },
        ]},
        { code: "502020", name: "Divertissement", subs: [
          { code: "50202010", name: "Cinéma & divertissement" },
          { code: "50202020", name: "Divertissement interactif à domicile" },
        ]},
        { code: "502030", name: "Médias interactifs & services", subs: [
          { code: "50203010", name: "Médias & services interactifs" },
        ]},
      ]},
    ],
  },
  {
    code: "55", name: "Services aux collectivités", nameEn: "Utilities",
    groups: [
      { code: "5510", name: "Services aux collectivités", industries: [
        { code: "551010", name: "Services électriques", subs: [
          { code: "55101010", name: "Électricité" },
        ]},
        { code: "551020", name: "Services gaz", subs: [
          { code: "55102010", name: "Gaz" },
        ]},
        { code: "551030", name: "Services multi-utilities", subs: [
          { code: "55103010", name: "Multi-services (électricité, gaz, eau)" },
        ]},
        { code: "551040", name: "Services eau", subs: [
          { code: "55104010", name: "Eau" },
        ]},
        { code: "551050", name: "Producteurs d'énergie & traders indépendants", subs: [
          { code: "55105010", name: "Producteurs indépendants & négociants d'énergie" },
          { code: "55105020", name: "Électricité renouvelable" },
        ]},
      ]},
    ],
  },
  {
    code: "60", name: "Immobilier", nameEn: "Real Estate",
    groups: [
      { code: "6010", name: "REITs (sociétés foncières)", industries: [
        { code: "601010", name: "REITs diversifiés", subs: [
          { code: "60101010", name: "REITs diversifiés" },
        ]},
        { code: "601025", name: "REITs industriels", subs: [
          { code: "60102510", name: "REITs industriels" },
        ]},
        { code: "601030", name: "REITs hôteliers & resorts", subs: [
          { code: "60103010", name: "REITs hôteliers & resorts" },
        ]},
        { code: "601040", name: "REITs de bureaux", subs: [
          { code: "60104010", name: "REITs de bureaux" },
        ]},
        { code: "601050", name: "REITs de santé", subs: [
          { code: "60105010", name: "REITs de santé" },
        ]},
        { code: "601060", name: "REITs résidentiels", subs: [
          { code: "60106010", name: "REITs résidentiels multi-familiaux" },
          { code: "60106020", name: "REITs de maisons individuelles" },
        ]},
        { code: "601070", name: "REITs de commerce de détail", subs: [
          { code: "60107010", name: "REITs de commerce de détail" },
        ]},
        { code: "601080", name: "REITs spécialisés", subs: [
          { code: "60108010", name: "Autres REITs spécialisés" },
          { code: "60108020", name: "REITs de self-stockage" },
          { code: "60108030", name: "REITs de tours télécoms" },
          { code: "60108040", name: "REITs forestiers" },
          { code: "60108050", name: "REITs de centres de données" },
        ]},
      ]},
      { code: "6020", name: "Gestion immobilière & développement", industries: [
        { code: "602010", name: "Gestion immobilière & développement", subs: [
          { code: "60201010", name: "Activités immobilières diversifiées" },
          { code: "60201020", name: "Sociétés d'exploitation immobilière" },
          { code: "60201030", name: "Promotion immobilière" },
          { code: "60201040", name: "Services immobiliers" },
        ]},
      ]},
    ],
  },
];

/** Helpers */
export function countAll(): { sectors: number; groups: number; industries: number; subs: number } {
  let groups = 0, industries = 0, subs = 0;
  for (const s of GICS) {
    groups += s.groups.length;
    for (const g of s.groups) {
      industries += g.industries.length;
      for (const i of g.industries) subs += i.subs.length;
    }
  }
  return { sectors: GICS.length, groups, industries, subs };
}

export function searchGics(q: string): { sector: GicsSector; group?: GicsGroup; industry?: GicsIndustry; sub?: GicsSubIndustry }[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  const out: { sector: GicsSector; group?: GicsGroup; industry?: GicsIndustry; sub?: GicsSubIndustry }[] = [];
  for (const sector of GICS) {
    if (sector.name.toLowerCase().includes(ql) || sector.nameEn.toLowerCase().includes(ql) || sector.code.includes(ql)) {
      out.push({ sector });
    }
    for (const group of sector.groups) {
      if (group.name.toLowerCase().includes(ql) || group.code.includes(ql)) {
        out.push({ sector, group });
      }
      for (const industry of group.industries) {
        if (industry.name.toLowerCase().includes(ql) || industry.code.includes(ql)) {
          out.push({ sector, group, industry });
        }
        for (const sub of industry.subs) {
          if (sub.name.toLowerCase().includes(ql) || sub.code.includes(ql)) {
            out.push({ sector, group, industry, sub });
          }
        }
      }
    }
  }
  return out;
}
