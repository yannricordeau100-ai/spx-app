/**
 * GICS taxonomy (Global Industry Classification Standard) — canonical structure.
 *
 * Source : MSCI/S&P GICS structure 2023. Public domain reference.
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
          { code: "10101010", name: "Forage pétrolier" },
          { code: "10101020", name: "Équipements & services pétroliers" },
        ]},
        { code: "101020", name: "Pétrole, gaz & combustibles", subs: [
          { code: "10102010", name: "Pétrole & gaz intégrés" },
          { code: "10102020", name: "Pétrole & gaz exploration & production" },
          { code: "10102030", name: "Pétrole & gaz raffinage & marketing" },
          { code: "10102040", name: "Pétrole & gaz stockage & transport" },
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
          { code: "15101010", name: "Produits chimiques de spécialité" },
          { code: "15101020", name: "Produits chimiques diversifiés" },
          { code: "15101030", name: "Produits chimiques industriels" },
          { code: "15101040", name: "Engrais & produits agrochimiques" },
          { code: "15101050", name: "Gaz industriels" },
        ]},
        { code: "151020", name: "Matériaux de construction", subs: [
          { code: "15102010", name: "Matériaux de construction" },
        ]},
        { code: "151030", name: "Conteneurs & emballages", subs: [
          { code: "15103010", name: "Conteneurs métaux & verre" },
          { code: "15103020", name: "Emballages papier & plastique" },
        ]},
        { code: "151040", name: "Métaux & exploitation minière", subs: [
          { code: "15104010", name: "Aluminium" },
          { code: "15104020", name: "Métaux divers & exploitation" },
          { code: "15104025", name: "Cuivre" },
          { code: "15104030", name: "Or" },
          { code: "15104040", name: "Métaux précieux & minéraux" },
          { code: "15104045", name: "Argent" },
          { code: "15104050", name: "Acier" },
        ]},
        { code: "151050", name: "Papier & forêt", subs: [
          { code: "15105010", name: "Produits forestiers" },
          { code: "15105020", name: "Produits papier" },
        ]},
      ]},
    ],
  },
  {
    code: "20", name: "Industrie", nameEn: "Industrials",
    groups: [
      { code: "2010", name: "Biens d'équipement", industries: [
        { code: "201010", name: "Aérospatiale & défense", subs: [
          { code: "20101010", name: "Aérospatiale & défense" },
        ]},
        { code: "201020", name: "Produits du bâtiment", subs: [
          { code: "20102010", name: "Produits du bâtiment" },
        ]},
        { code: "201030", name: "Construction & génie civil", subs: [
          { code: "20103010", name: "Construction & génie civil" },
        ]},
        { code: "201040", name: "Produits électriques", subs: [
          { code: "20104010", name: "Composants électriques & équipement" },
          { code: "20104020", name: "Production & équipement d'énergie pesante" },
        ]},
        { code: "201050", name: "Conglomérats industriels", subs: [
          { code: "20105010", name: "Conglomérats industriels" },
        ]},
        { code: "201060", name: "Machinerie", subs: [
          { code: "20106010", name: "Machines de construction & camions lourds" },
          { code: "20106015", name: "Composants agricoles & machinerie agricole" },
          { code: "20106020", name: "Machinerie industrielle" },
        ]},
        { code: "201070", name: "Distribution commerciale", subs: [
          { code: "20107010", name: "Distribution commerciale" },
        ]},
      ]},
      { code: "2020", name: "Services commerciaux", industries: [
        { code: "202010", name: "Services commerciaux & fournitures", subs: [
          { code: "20201010", name: "Services environnementaux & installations" },
          { code: "20201050", name: "Services commerciaux divers" },
          { code: "20201060", name: "Fournitures de bureau" },
        ]},
        { code: "202020", name: "Services professionnels", subs: [
          { code: "20202010", name: "Services de personnel & de l'emploi" },
          { code: "20202020", name: "Conseil & autres services professionnels" },
        ]},
      ]},
      { code: "2030", name: "Transports", industries: [
        { code: "203010", name: "Fret aérien & logistique", subs: [
          { code: "20301010", name: "Fret aérien & logistique" },
        ]},
        { code: "203020", name: "Compagnies aériennes passagers", subs: [
          { code: "20302010", name: "Compagnies aériennes passagers" },
        ]},
        { code: "203030", name: "Marine", subs: [
          { code: "20303010", name: "Marine" },
        ]},
        { code: "203040", name: "Transport ferroviaire & terrestre", subs: [
          { code: "20304010", name: "Camionnage" },
          { code: "20304030", name: "Voies ferrées" },
        ]},
        { code: "203050", name: "Infrastructures transport", subs: [
          { code: "20305010", name: "Aéroports & services aéroportuaires" },
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
          { code: "25101010", name: "Composants automobiles" },
          { code: "25101020", name: "Pneus & caoutchouc" },
        ]},
        { code: "251020", name: "Automobile", subs: [
          { code: "25102010", name: "Constructeurs automobiles" },
          { code: "25102020", name: "Motocycles" },
        ]},
      ]},
      { code: "2520", name: "Biens durables & habillement", industries: [
        { code: "252010", name: "Biens durables ménagers", subs: [
          { code: "25201010", name: "Appareils électroménagers" },
          { code: "25201020", name: "Maison & meubles" },
          { code: "25201030", name: "Construction maison" },
          { code: "25201040", name: "Produits de loisirs" },
          { code: "25201050", name: "Articles ménagers durables divers" },
        ]},
        { code: "252020", name: "Loisirs", subs: [
          { code: "25202010", name: "Loisirs" },
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
          { code: "25301020", name: "Hôtels, resorts & lignes de croisière" },
          { code: "25301030", name: "Activités de loisirs" },
          { code: "25301040", name: "Restaurants" },
        ]},
        { code: "253020", name: "Services divers aux consommateurs", subs: [
          { code: "25302010", name: "Services d'éducation" },
          { code: "25302020", name: "Services aux consommateurs spécialisés" },
        ]},
      ]},
      { code: "2550", name: "Distribution discrétionnaire", industries: [
        { code: "255010", name: "Distribution & marketing", subs: [
          { code: "25501010", name: "Distribution & marketing" },
        ]},
        { code: "255020", name: "Distribution discrétionnaire en ligne", subs: [
          { code: "25502020", name: "Vente détail discrétionnaire en ligne" },
        ]},
        { code: "255030", name: "Distribution multi-lignes", subs: [
          { code: "25503030", name: "Magasins discount" },
        ]},
        { code: "255040", name: "Distribution spécialisée", subs: [
          { code: "25504010", name: "Vente détail habillement" },
          { code: "25504030", name: "Magasins de produits informatiques & électroniques" },
          { code: "25504040", name: "Magasins d'amélioration maison" },
          { code: "25504050", name: "Magasins de spécialité" },
          { code: "25504060", name: "Distribution automobile" },
        ]},
      ]},
    ],
  },
  {
    code: "30", name: "Consommation de base", nameEn: "Consumer Staples",
    groups: [
      { code: "3010", name: "Distribution & vente alimentation", industries: [
        { code: "301010", name: "Distribution alimentation", subs: [
          { code: "30101010", name: "Distribution médicaments" },
          { code: "30101020", name: "Distribution alimentation" },
          { code: "30101030", name: "Hypermarchés & supercenters" },
          { code: "30101040", name: "Magasins alimentaires" },
        ]},
      ]},
      { code: "3020", name: "Aliments, boissons & tabac", industries: [
        { code: "302010", name: "Boissons", subs: [
          { code: "30201010", name: "Brasseurs" },
          { code: "30201020", name: "Distillateurs & vignerons" },
          { code: "30201030", name: "Boissons non alcoolisées" },
        ]},
        { code: "302020", name: "Produits alimentaires", subs: [
          { code: "30202010", name: "Produits agricoles & viandes emballées" },
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
          { code: "30302010", name: "Produits personnels" },
        ]},
      ]},
    ],
  },
  {
    code: "35", name: "Santé", nameEn: "Health Care",
    groups: [
      { code: "3510", name: "Équipements & services santé", industries: [
        { code: "351010", name: "Équipements & fournitures santé", subs: [
          { code: "35101010", name: "Équipement médical" },
          { code: "35101020", name: "Fournitures médicales" },
        ]},
        { code: "351020", name: "Fournisseurs & services santé", subs: [
          { code: "35102010", name: "Distributeurs santé" },
          { code: "35102015", name: "Établissements de soins" },
          { code: "35102020", name: "Services santé gérés" },
          { code: "35102030", name: "Services santé technologiques" },
        ]},
        { code: "351030", name: "Technologies santé", subs: [
          { code: "35103010", name: "Technologies santé" },
        ]},
      ]},
      { code: "3520", name: "Pharmaceutique, biotechnologie & sciences", industries: [
        { code: "352010", name: "Biotechnologie", subs: [
          { code: "35201010", name: "Biotechnologie" },
        ]},
        { code: "352020", name: "Pharmaceutique", subs: [
          { code: "35202010", name: "Pharmaceutique" },
        ]},
        { code: "352030", name: "Sciences de la vie outils & services", subs: [
          { code: "35203010", name: "Sciences de la vie outils & services" },
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
        { code: "402010", name: "Services financiers diversifiés", subs: [
          { code: "40201020", name: "Autres services financiers diversifiés" },
          { code: "40201030", name: "Services financiers multi-secteurs" },
          { code: "40201040", name: "Marchés financiers spécialisés" },
          { code: "40201050", name: "Bourses commerciales & boursières" },
        ]},
        { code: "402020", name: "Crédit à la consommation", subs: [
          { code: "40202010", name: "Financement à la consommation" },
        ]},
        { code: "402030", name: "Marchés de capitaux", subs: [
          { code: "40203010", name: "Gestion d'actifs & garde de valeurs" },
          { code: "40203020", name: "Banque d'investissement & courtage" },
          { code: "40203030", name: "Marchés financiers diversifiés" },
          { code: "40203040", name: "Bourses & échanges" },
        ]},
        { code: "402040", name: "Hypothèques REITs", subs: [
          { code: "40204010", name: "Hypothèques REITs" },
        ]},
      ]},
      { code: "4030", name: "Assurances", industries: [
        { code: "403010", name: "Assurance", subs: [
          { code: "40301010", name: "Assurance dommages" },
          { code: "40301020", name: "Courtiers d'assurance" },
          { code: "40301030", name: "Assurance vie & santé" },
          { code: "40301040", name: "Assurance multi-lignes" },
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
          { code: "45102010", name: "Conseil & services IT" },
          { code: "45102020", name: "Outsourcing services IT" },
          { code: "45102030", name: "Stockage & traitement des données Internet" },
        ]},
        { code: "451030", name: "Logiciels", subs: [
          { code: "45103010", name: "Logiciels d'application" },
          { code: "45103020", name: "Logiciels système" },
        ]},
      ]},
      { code: "4520", name: "Matériel & équipement informatique", industries: [
        { code: "452010", name: "Équipements communications", subs: [
          { code: "45201020", name: "Équipement communications" },
        ]},
        { code: "452020", name: "Matériel technologique, stockage & périphériques", subs: [
          { code: "45202030", name: "Matériel technologique, stockage & périphériques" },
        ]},
        { code: "452030", name: "Composants électroniques", subs: [
          { code: "45203010", name: "Composants électroniques" },
          { code: "45203015", name: "Équipements & instruments électroniques" },
          { code: "45203020", name: "Distributeurs électroniques" },
          { code: "45203030", name: "Production technologique" },
        ]},
      ]},
      { code: "4530", name: "Semi-conducteurs", industries: [
        { code: "453010", name: "Semi-conducteurs & équipement", subs: [
          { code: "45301010", name: "Équipement semi-conducteurs" },
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
          { code: "50101010", name: "Services de télécommunications alternatifs" },
          { code: "50101020", name: "Services de télécommunications intégrés" },
        ]},
        { code: "501020", name: "Services télécommunications sans fil", subs: [
          { code: "50102010", name: "Services de télécommunications sans fil" },
        ]},
      ]},
      { code: "5020", name: "Médias & divertissement", industries: [
        { code: "502010", name: "Médias", subs: [
          { code: "50201010", name: "Publicité" },
          { code: "50201020", name: "Diffusion" },
          { code: "50201030", name: "Câble & satellite" },
          { code: "50201040", name: "Édition" },
        ]},
        { code: "502020", name: "Divertissement", subs: [
          { code: "50202010", name: "Films & divertissement" },
          { code: "50202020", name: "Jeux & multimédia interactif" },
        ]},
        { code: "502030", name: "Médias interactifs & services", subs: [
          { code: "50203010", name: "Médias interactifs & services" },
        ]},
      ]},
    ],
  },
  {
    code: "55", name: "Services aux collectivités", nameEn: "Utilities",
    groups: [
      { code: "5510", name: "Services aux collectivités", industries: [
        { code: "551010", name: "Services électriques", subs: [
          { code: "55101010", name: "Services électriques" },
        ]},
        { code: "551020", name: "Services gaz", subs: [
          { code: "55102010", name: "Services gaz" },
        ]},
        { code: "551030", name: "Services multi-utilities", subs: [
          { code: "55103010", name: "Services multi-utilities" },
        ]},
        { code: "551040", name: "Services eau", subs: [
          { code: "55104010", name: "Services eau" },
        ]},
        { code: "551050", name: "Producteurs d'énergie & traders indépendants", subs: [
          { code: "55105010", name: "Producteurs d'énergie & traders indépendants" },
          { code: "55105020", name: "Énergies renouvelables" },
        ]},
      ]},
    ],
  },
  {
    code: "60", name: "Immobilier", nameEn: "Real Estate",
    groups: [
      { code: "6010", name: "REITs (sociétés foncières)", industries: [
        { code: "601010", name: "REITs spécialisés", subs: [
          { code: "60101010", name: "REITs diversifiés" },
          { code: "60101020", name: "REITs industriels" },
          { code: "60101030", name: "REITs hôteliers & resorts" },
          { code: "60101040", name: "REITs bureaux" },
          { code: "60101050", name: "REITs santé" },
          { code: "60101060", name: "REITs résidentiels" },
          { code: "60101070", name: "REITs commerce de détail" },
          { code: "60101080", name: "REITs spécialisés" },
        ]},
      ]},
      { code: "6020", name: "Gestion immobilière & développement", industries: [
        { code: "602010", name: "Gestion immobilière & développement", subs: [
          { code: "60201010", name: "Sociétés diversifiées immobilier" },
          { code: "60201020", name: "Opérateurs & développeurs immobiliers" },
          { code: "60201030", name: "Sociétés cotées de services immobiliers" },
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
