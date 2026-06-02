/**
 * Top 100 USA + Top 100 France pour la home/accueil V1.7.
 *
 * À l'arrivée d'un visiteur :
 *   - Locale française (URL /fr/...) -> liste TOP_FR
 *   - Locale anglaise (URL sans préfixe) -> liste TOP_USA
 *
 * Les tickers présents dans `_merged.json` (pipeline CONV-DATA) sont
 * directement cliquables avec leur fiche complète. Les autres affichent
 * une carte "à venir" (clickable mais redirige vers une 404 douce).
 *
 * À METTRE À JOUR par Yann avec les vraies listes (PJ pas reçues dans le
 * chat, scaffold provisoire ci-dessous basé sur le S&P 500 par capi et
 * le CAC 40 + extension).
 *
 * Format : { ticker: "<TICKER YAHOO>", name: "<Nom commercial>" }
 *   - USA : ticker court (AAPL, MSFT)
 *   - FR  : ticker avec suffixe .PA (MC.PA pour LVMH)
 */

export type TopCompany = { ticker: string; name: string };

// =============================================================================
// TOP 100 USA (provisoire, à remplacer par la PJ "top 100 USA")
// Source provisoire : top capi S&P 500 (mai 2026 approx) + acteurs clés tech.
// =============================================================================
export const TOP_USA: TopCompany[] = [
  { ticker: "AAPL",   name: "Apple" },
  { ticker: "MSFT",   name: "Microsoft" },
  { ticker: "NVDA",   name: "NVIDIA" },
  { ticker: "GOOGL",  name: "Alphabet (Google)" },
  { ticker: "AMZN",   name: "Amazon" },
  { ticker: "META",   name: "Meta Platforms" },
  { ticker: "TSLA",   name: "Tesla" },
  { ticker: "BRK.B",  name: "Berkshire Hathaway" },
  { ticker: "LLY",    name: "Eli Lilly" },
  { ticker: "AVGO",   name: "Broadcom" },
  { ticker: "JPM",    name: "JPMorgan Chase" },
  { ticker: "V",      name: "Visa" },
  { ticker: "WMT",    name: "Walmart" },
  { ticker: "UNH",    name: "UnitedHealth" },
  { ticker: "XOM",    name: "ExxonMobil" },
  { ticker: "MA",     name: "Mastercard" },
  { ticker: "PG",     name: "Procter & Gamble" },
  { ticker: "JNJ",    name: "Johnson & Johnson" },
  { ticker: "HD",     name: "Home Depot" },
  { ticker: "ORCL",   name: "Oracle" },
  { ticker: "COST",   name: "Costco" },
  { ticker: "ABBV",   name: "AbbVie" },
  { ticker: "BAC",    name: "Bank of America" },
  { ticker: "KO",     name: "Coca-Cola" },
  { ticker: "MRK",    name: "Merck" },
  { ticker: "CVX",    name: "Chevron" },
  { ticker: "CRM",    name: "Salesforce" },
  { ticker: "NFLX",   name: "Netflix" },
  { ticker: "ADBE",   name: "Adobe" },
  { ticker: "PEP",    name: "PepsiCo" },
  { ticker: "AMD",    name: "AMD" },
  { ticker: "TMO",    name: "Thermo Fisher" },
  { ticker: "ABT",    name: "Abbott Laboratories" },
  { ticker: "ACN",    name: "Accenture" },
  { ticker: "WFC",    name: "Wells Fargo" },
  { ticker: "MCD",    name: "McDonald's" },
  { ticker: "DIS",    name: "Disney" },
  { ticker: "CSCO",   name: "Cisco" },
  { ticker: "DHR",    name: "Danaher" },
  { ticker: "INTC",   name: "Intel" },
  { ticker: "VZ",     name: "Verizon" },
  { ticker: "T",      name: "AT&T" },
  { ticker: "TMUS",   name: "T-Mobile US" },
  { ticker: "CAT",    name: "Caterpillar" },
  { ticker: "BA",     name: "Boeing" },
  { ticker: "DE",     name: "John Deere" },
  { ticker: "HON",    name: "Honeywell" },
  { ticker: "UPS",    name: "UPS" },
  { ticker: "GE",     name: "GE Aerospace" },
  { ticker: "RTX",    name: "RTX" },
  { ticker: "LMT",    name: "Lockheed Martin" },
  { ticker: "AXP",    name: "American Express" },
  { ticker: "GS",     name: "Goldman Sachs" },
  { ticker: "MS",     name: "Morgan Stanley" },
  { ticker: "BLK",    name: "BlackRock" },
  { ticker: "SCHW",   name: "Charles Schwab" },
  { ticker: "C",      name: "Citigroup" },
  { ticker: "USB",    name: "U.S. Bancorp" },
  { ticker: "PNC",    name: "PNC Financial" },
  { ticker: "AMGN",   name: "Amgen" },
  { ticker: "PFE",    name: "Pfizer" },
  { ticker: "BMY",    name: "Bristol-Myers Squibb" },
  { ticker: "GILD",   name: "Gilead" },
  { ticker: "CVS",    name: "CVS Health" },
  { ticker: "MDT",    name: "Medtronic" },
  { ticker: "ISRG",   name: "Intuitive Surgical" },
  { ticker: "TGT",    name: "Target" },
  { ticker: "LOW",    name: "Lowe's" },
  { ticker: "NKE",    name: "Nike" },
  { ticker: "SBUX",   name: "Starbucks" },
  { ticker: "BKNG",   name: "Booking Holdings" },
  { ticker: "ABNB",   name: "Airbnb" },
  { ticker: "UBER",   name: "Uber" },
  { ticker: "MDLZ",   name: "Mondelez" },
  { ticker: "COP",    name: "ConocoPhillips" },
  { ticker: "SLB",    name: "Schlumberger" },
  { ticker: "EOG",    name: "EOG Resources" },
  { ticker: "PSX",    name: "Phillips 66" },
  { ticker: "LIN",    name: "Linde" },
  { ticker: "FCX",    name: "Freeport-McMoRan" },
  { ticker: "AMT",    name: "American Tower" },
  { ticker: "PLD",    name: "Prologis" },
  { ticker: "EQIX",   name: "Equinix" },
  { ticker: "NOW",    name: "ServiceNow" },
  { ticker: "INTU",   name: "Intuit" },
  { ticker: "SHOP",   name: "Shopify" },
  { ticker: "PLTR",   name: "Palantir" },
  { ticker: "COIN",   name: "Coinbase" },
  { ticker: "MSTR",   name: "MicroStrategy" },
  { ticker: "SPGI",   name: "S&P Global" },
  { ticker: "MCO",    name: "Moody's" },
  { ticker: "MSCI",   name: "MSCI" },
  { ticker: "MMM",    name: "3M" },
  { ticker: "CMCSA",  name: "Comcast" },
  { ticker: "F",      name: "Ford" },
  { ticker: "GM",     name: "General Motors" },
  { ticker: "PYPL",   name: "PayPal" },
  { ticker: "EL",     name: "Estée Lauder" },
  { ticker: "ZTS",    name: "Zoetis" },
  { ticker: "BX",     name: "Blackstone" },
  { ticker: "SO",     name: "Southern Company" },
  { ticker: "DUK",    name: "Duke Energy" },
];

// =============================================================================
// TOP 100 FRANCE (provisoire, à remplacer par la PJ "top 100 France")
// Source provisoire : CAC 40 + élargissement SBF 120 par capi.
// Suffixe `.PA` = Euronext Paris (ticker Yahoo Finance).
// =============================================================================
export const TOP_FR: TopCompany[] = [
  // CAC 40
  { ticker: "MC.PA",     name: "LVMH" },
  { ticker: "OR.PA",     name: "L'Oréal" },
  { ticker: "TTE.PA",    name: "TotalEnergies" },
  { ticker: "SAN.PA",    name: "Sanofi" },
  { ticker: "AIR.PA",    name: "Airbus" },
  { ticker: "SU.PA",     name: "Schneider Electric" },
  { ticker: "RMS.PA",    name: "Hermès" },
  { ticker: "BNP.PA",    name: "BNP Paribas" },
  { ticker: "DG.PA",     name: "Vinci" },
  { ticker: "AI.PA",     name: "Air Liquide" },
  { ticker: "EL.PA",     name: "EssilorLuxottica" },
  { ticker: "CS.PA",     name: "AXA" },
  { ticker: "BN.PA",     name: "Danone" },
  { ticker: "SAF.PA",    name: "Safran" },
  { ticker: "KER.PA",    name: "Kering" },
  { ticker: "RI.PA",     name: "Pernod Ricard" },
  { ticker: "DSY.PA",    name: "Dassault Systèmes" },
  { ticker: "ENGI.PA",   name: "Engie" },
  { ticker: "HO.PA",     name: "Thales" },
  { ticker: "GLE.PA",    name: "Société Générale" },
  { ticker: "ACA.PA",    name: "Crédit Agricole" },
  { ticker: "BVI.PA",    name: "Bureau Veritas" },
  { ticker: "STLAP.PA",  name: "Stellantis" },
  { ticker: "STMPA.PA",  name: "STMicroelectronics" },
  { ticker: "ML.PA",     name: "Michelin" },
  { ticker: "PUB.PA",    name: "Publicis" },
  { ticker: "CAP.PA",    name: "Capgemini" },
  { ticker: "TEP.PA",    name: "Teleperformance" },
  { ticker: "URW.PA",    name: "Unibail-Rodamco-Westfield" },
  { ticker: "VIE.PA",    name: "Veolia" },
  { ticker: "EN.PA",     name: "Bouygues" },
  { ticker: "CA.PA",     name: "Carrefour" },
  { ticker: "ORA.PA",    name: "Orange" },
  { ticker: "EDEN.PA",   name: "Edenred" },
  { ticker: "LR.PA",     name: "Legrand" },
  { ticker: "WLN.PA",    name: "Worldline" },
  { ticker: "RNO.PA",    name: "Renault" },
  { ticker: "VIV.PA",    name: "Vivendi" },
  { ticker: "SGO.PA",    name: "Saint-Gobain" },
  { ticker: "RXL.PA",    name: "Rexel" },
  // SBF 120 / mid-cap (extension)
  { ticker: "ALO.PA",    name: "Alstom" },
  { ticker: "ATO.PA",    name: "Atos" },
  { ticker: "FR.PA",     name: "Valeo" },
  { ticker: "AKE.PA",    name: "Arkema" },
  { ticker: "GET.PA",    name: "Getlink" },
  { ticker: "FDJ.PA",    name: "FDJ" },
  { ticker: "SOI.PA",    name: "Soitec" },
  { ticker: "ICAD.PA",   name: "Icade" },
  { ticker: "RUI.PA",    name: "Rubis" },
  { ticker: "GTT.PA",    name: "GTT" },
  { ticker: "DIM.PA",    name: "Sartorius Stedim Biotech" },
  { ticker: "MAU.PA",    name: "Maurel & Prom" },
  { ticker: "SOP.PA",    name: "Sopra Steria" },
  { ticker: "EDF.PA",    name: "EDF" },
  { ticker: "NK.PA",     name: "Imerys" },
  { ticker: "NXI.PA",    name: "Nexity" },
  { ticker: "PVL.PA",    name: "Plastic Omnium" },
  { ticker: "AMUN.PA",   name: "Amundi" },
  { ticker: "VK.PA",     name: "Vallourec" },
  { ticker: "EXE.PA",    name: "Exel Industries" },
  { ticker: "SK.PA",     name: "SEB" },
  { ticker: "AC.PA",     name: "Accor" },
  { ticker: "ALD.PA",    name: "ALD Automotive" },
  { ticker: "RCO.PA",    name: "Rémy Cointreau" },
  { ticker: "BIM.PA",    name: "bioMérieux" },
  { ticker: "GFC.PA",    name: "Gecina" },
  { ticker: "ELIS.PA",   name: "Elis" },
  { ticker: "ERA.PA",    name: "Eramet" },
  { ticker: "IPN.PA",    name: "Ipsen" },
  { ticker: "TRI.PA",    name: "Trigano" },
  { ticker: "CO.PA",     name: "Casino Guichard" },
  { ticker: "CGG.PA",    name: "Viridien (ex-CGG)" },
];

/** Retourne la liste appropriée selon la locale détectée. */
export function getTopCompaniesForLocale(locale: "fr" | "en"): TopCompany[] {
  return locale === "fr" ? TOP_FR : TOP_USA;
}
