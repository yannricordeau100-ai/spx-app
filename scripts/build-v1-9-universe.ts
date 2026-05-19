/**
 * build-v1-9-universe.ts
 *
 * Construit l'univers V1.9 = union de :
 *   1. SP500 (depuis src/data/sp500-tickers.json)
 *   2. Top 307 V1.8 (depuis src/data/v1-8-tickers-sorted.json)
 *   3. Indices européens principaux (CAC 40, FTSE 100, DAX 40, SMI,
 *      BEL 20, FTSE MIB, AEX, ATX) — listes embarquées ci-dessous.
 *
 * Sortie :
 *   - src/data/v1-9-universe.json
 *       Array d'objets { ticker, name, country, sources[] }
 *   - src/data/v1-9-missing-from-merged.json
 *       Tickers EU indices absents de _merged.json (à scraper par CONV-DATA)
 *
 * Règles :
 *   - Dédoublonnage par ticker (case-insensitive UPPER)
 *   - Cross-check avec src/data/v2-pipeline/_merged.json :
 *       - si présent : utiliser le `name` officiel (sauf blocklist
 *         cross-pollution connue, ex DG.PA = Virbac dans _merged)
 *       - si absent : flag dans v1-9-missing-from-merged.json
 *   - Suffixes Yahoo Finance critiques : .PA, .L, .DE, .SW, .BR, .MI,
 *     .AS, .VI
 *
 * Usage : npx tsx scripts/build-v1-9-universe.ts
 * Idempotent : ré-exécutable, ré-écrit les fichiers de sortie.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "src", "data");
const MERGED_PATH = join(DATA_DIR, "v2-pipeline", "_merged.json");
const SP500_PATH = join(DATA_DIR, "sp500-tickers.json");
const V18_PATH = join(DATA_DIR, "v1-8-tickers-sorted.json");
const OUT_UNIVERSE = join(DATA_DIR, "v1-9-universe.json");
const OUT_MISSING = join(DATA_DIR, "v1-9-missing-from-merged.json");

type SourceKey =
  | "sp500"
  | "top307"
  | "cac40"
  | "ftse100"
  | "dax40"
  | "smi"
  | "bel20"
  | "ftsemib"
  | "aex"
  | "atx";

type Country = "US" | "FR" | "GB" | "DE" | "CH" | "BE" | "IT" | "NL" | "AT";

interface UniverseEntry {
  ticker: string;
  name: string;
  country: Country;
  sources: SourceKey[];
}

// Blocklist : tickers où _merged.json contient un name issu d'une mauvaise
// extraction (cross-pollution scraping). Pour ces tickers on garde le nom
// Wikipedia / listing officiel plutôt que celui de _merged.json.
// Source : broadcasts CONV-TRANSCRIPTS 13 mai + CONV-CONCEPTS 16 mai.
const MERGED_NAME_BLOCKLIST = new Set<string>([
  "DG.PA", "SIE.DE", "VOD.L", "BCP.LS", "NG.L", "RMS.PA",
  "ATEYY", "ADTTF", "BP", "BPAQF", "BBVA.MC",
  // Cross-pollution détectée au build initial V1.9 (19 mai 2026)
  "ABI.BR", "ENI.MI",
]);

// =============================================================
// LISTES INDICES EU (snapshot 2025, à actualiser annuellement)
// =============================================================

// CAC 40 — France — suffixe .PA — 40 stés
const CAC40: Array<[string, string]> = [
  ["AC.PA", "Accor"],
  ["AI.PA", "Air Liquide"],
  ["AIR.PA", "Airbus"],
  ["MT.AS", "ArcelorMittal"], // listing principal AS, présent dans CAC via dual listing
  ["CS.PA", "AXA"],
  ["BNP.PA", "BNP Paribas"],
  ["EN.PA", "Bouygues"],
  ["CAP.PA", "Capgemini"],
  ["CA.PA", "Carrefour"],
  ["ACA.PA", "Crédit Agricole"],
  ["BN.PA", "Danone"],
  ["DSY.PA", "Dassault Systèmes"],
  ["EDEN.PA", "Edenred"],
  ["ENGI.PA", "Engie"],
  ["EL.PA", "EssilorLuxottica"],
  ["ERF.PA", "Eurofins Scientific"],
  ["RMS.PA", "Hermès International"],
  ["KER.PA", "Kering"],
  ["LR.PA", "Legrand"],
  ["OR.PA", "L'Oréal"],
  ["MC.PA", "LVMH"],
  ["ML.PA", "Michelin"],
  ["ORA.PA", "Orange"],
  ["RI.PA", "Pernod Ricard"],
  ["PUB.PA", "Publicis Groupe"],
  ["RNO.PA", "Renault"],
  ["SAF.PA", "Safran"],
  ["SGO.PA", "Saint-Gobain"],
  ["SAN.PA", "Sanofi"],
  ["SU.PA", "Schneider Electric"],
  ["GLE.PA", "Société Générale"],
  ["STLAP.PA", "Stellantis"],
  ["STMPA.PA", "STMicroelectronics"],
  ["TEP.PA", "Teleperformance"],
  ["HO.PA", "Thales"],
  ["TTE.PA", "TotalEnergies"],
  ["URW.PA", "Unibail-Rodamco-Westfield"],
  ["VIE.PA", "Veolia Environnement"],
  ["DG.PA", "Vinci"],
  ["VIV.PA", "Vivendi"],
];

// FTSE 100 — UK — suffixe .L — 100 stés
const FTSE100: Array<[string, string]> = [
  ["III.L", "3i Group"],
  ["ABF.L", "Associated British Foods"],
  ["ADM.L", "Admiral Group"],
  ["AAF.L", "Airtel Africa"],
  ["AAL.L", "Anglo American"],
  ["ANTO.L", "Antofagasta"],
  ["AHT.L", "Ashtead Group"],
  ["ABDN.L", "Abrdn"],
  ["AUTO.L", "Auto Trader Group"],
  ["AV.L", "Aviva"],
  ["BME.L", "B&M European Value Retail"],
  ["BA.L", "BAE Systems"],
  ["BARC.L", "Barclays"],
  ["BDEV.L", "Barratt Redrow"],
  ["BTRW.L", "Bellway"],
  ["BKG.L", "Berkeley Group Holdings"],
  ["BP.L", "BP"],
  ["BATS.L", "British American Tobacco"],
  ["BLND.L", "British Land"],
  ["BT-A.L", "BT Group"],
  ["BNZL.L", "Bunzl"],
  ["CNA.L", "Centrica"],
  ["CCH.L", "Coca-Cola HBC"],
  ["CPG.L", "Compass Group"],
  ["CTEC.L", "ConvaTec Group"],
  ["CRDA.L", "Croda International"],
  ["DCC.L", "DCC plc"],
  ["DGE.L", "Diageo"],
  ["DPLM.L", "Diploma plc"],
  ["EDV.L", "Endeavour Mining"],
  ["ENT.L", "Entain"],
  ["EZJ.L", "EasyJet"],
  ["EXPN.L", "Experian"],
  ["FCIT.L", "F&C Investment Trust"],
  ["FRES.L", "Fresnillo"],
  ["FRAS.L", "Frasers Group"],
  ["GSK.L", "GSK"],
  ["GLEN.L", "Glencore"],
  ["HLN.L", "Haleon"],
  ["HLMA.L", "Halma"],
  ["HIK.L", "Hikma Pharmaceuticals"],
  ["HSBA.L", "HSBC Holdings"],
  ["HWDN.L", "Howden Joinery Group"],
  ["IMI.L", "IMI plc"],
  ["IMB.L", "Imperial Brands"],
  ["INF.L", "Informa"],
  ["IHG.L", "InterContinental Hotels Group"],
  ["IAG.L", "International Consolidated Airlines Group"],
  ["ITRK.L", "Intertek Group"],
  ["JD.L", "JD Sports Fashion"],
  ["KGF.L", "Kingfisher"],
  ["LAND.L", "Land Securities Group"],
  ["LGEN.L", "Legal & General"],
  ["LLOY.L", "Lloyds Banking Group"],
  ["LMP.L", "LondonMetric Property"],
  ["LSEG.L", "London Stock Exchange Group"],
  ["MNG.L", "M&G plc"],
  ["MKS.L", "Marks & Spencer"],
  ["MRO.L", "Melrose Industries"],
  ["MNDI.L", "Mondi"],
  ["NG.L", "National Grid"],
  ["NWG.L", "NatWest Group"],
  ["NXT.L", "Next plc"],
  ["PSON.L", "Pearson"],
  ["PSH.L", "Pershing Square Holdings"],
  ["PSN.L", "Persimmon"],
  ["PHNX.L", "Phoenix Group Holdings"],
  ["POLY.L", "Polymetal International"],
  ["PRU.L", "Prudential plc"],
  ["RKT.L", "Reckitt Benckiser"],
  ["REL.L", "RELX"],
  ["RTO.L", "Rentokil Initial"],
  ["RMV.L", "Rightmove"],
  ["RIO.L", "Rio Tinto"],
  ["RR.L", "Rolls-Royce Holdings"],
  ["SGE.L", "Sage Group"],
  ["SBRY.L", "Sainsbury's"],
  ["SDR.L", "Schroders"],
  ["SMT.L", "Scottish Mortgage Investment Trust"],
  ["SVT.L", "Severn Trent"],
  ["SHEL.L", "Shell"],
  ["SN.L", "Smith & Nephew"],
  ["SMIN.L", "Smiths Group"],
  ["SMDS.L", "Smurfit Kappa"], // remplacé par Smurfit Westrock
  ["SPX.L", "Spirax-Sarco Engineering"],
  ["SSE.L", "SSE plc"],
  ["STAN.L", "Standard Chartered"],
  ["STJ.L", "St. James's Place"],
  ["TW.L", "Taylor Wimpey"],
  ["TSCO.L", "Tesco"],
  ["ULVR.L", "Unilever"],
  ["UTG.L", "Unite Group"],
  ["UU.L", "United Utilities"],
  ["VOD.L", "Vodafone Group"],
  ["WEIR.L", "Weir Group"],
  ["WTB.L", "Whitbread"],
  ["WPP.L", "WPP plc"],
  ["WIZZ.L", "Wizz Air"],
  ["BEZ.L", "Beazley plc"],
  ["DRX.L", "Drax Group"],
];

// DAX 40 — Allemagne — suffixe .DE — 40 stés
const DAX40: Array<[string, string]> = [
  ["ADS.DE", "Adidas"],
  ["AIR.DE", "Airbus"],
  ["ALV.DE", "Allianz"],
  ["BAS.DE", "BASF"],
  ["BAYN.DE", "Bayer"],
  ["BEI.DE", "Beiersdorf"],
  ["BMW.DE", "BMW"],
  ["BNR.DE", "Brenntag"],
  ["CBK.DE", "Commerzbank"],
  ["CON.DE", "Continental"],
  ["1COV.DE", "Covestro"],
  ["DTG.DE", "Daimler Truck"],
  ["DBK.DE", "Deutsche Bank"],
  ["DB1.DE", "Deutsche Börse"],
  ["DPW.DE", "Deutsche Post (DHL Group)"],
  ["DTE.DE", "Deutsche Telekom"],
  ["EOAN.DE", "E.ON"],
  ["FRE.DE", "Fresenius"],
  ["HNR1.DE", "Hannover Rück"],
  ["HEI.DE", "Heidelberg Materials"],
  ["HEN3.DE", "Henkel"],
  ["IFX.DE", "Infineon Technologies"],
  ["MBG.DE", "Mercedes-Benz Group"],
  ["MRK.DE", "Merck KGaA"],
  ["MTX.DE", "MTU Aero Engines"],
  ["MUV2.DE", "Munich Re"],
  ["P911.DE", "Porsche AG"],
  ["PAH3.DE", "Porsche SE"],
  ["QIA.DE", "Qiagen"],
  ["RHM.DE", "Rheinmetall"],
  ["RWE.DE", "RWE"],
  ["SAP.DE", "SAP"],
  ["SRT3.DE", "Sartorius"],
  ["SIE.DE", "Siemens"],
  ["ENR.DE", "Siemens Energy"],
  ["SHL.DE", "Siemens Healthineers"],
  ["SY1.DE", "Symrise"],
  ["VNA.DE", "Vonovia"],
  ["VOW3.DE", "Volkswagen (Pref)"],
  ["ZAL.DE", "Zalando"],
];

// SMI — Suisse — suffixe .SW — 20 stés
const SMI: Array<[string, string]> = [
  ["ABBN.SW", "ABB"],
  ["ALC.SW", "Alcon"],
  ["GEBN.SW", "Geberit"],
  ["GIVN.SW", "Givaudan"],
  ["HOLN.SW", "Holcim"],
  ["KNIN.SW", "Kühne + Nagel"],
  ["LOGN.SW", "Logitech"],
  ["LONN.SW", "Lonza Group"],
  ["NESN.SW", "Nestlé"],
  ["NOVN.SW", "Novartis"],
  ["PGHN.SW", "Partners Group"],
  ["ROG.SW", "Roche Holding"],
  ["CFR.SW", "Richemont"],
  ["SIKA.SW", "Sika"],
  ["SOON.SW", "Sonova"],
  ["SCMN.SW", "Swisscom"],
  ["SLHN.SW", "Swiss Life"],
  ["SREN.SW", "Swiss Re"],
  ["UBSG.SW", "UBS Group"],
  ["ZURN.SW", "Zurich Insurance Group"],
];

// BEL 20 — Belgique — suffixe .BR — 20 stés
const BEL20: Array<[string, string]> = [
  ["ABI.BR", "AB InBev"],
  ["ACKB.BR", "Ackermans & van Haaren"],
  ["AED.BR", "Aedifica"],
  ["AGS.BR", "Ageas"],
  ["ARGX.BR", "Argenx"],
  ["AZE.BR", "Azelis Group"],
  ["COFB.BR", "Cofinimmo"],
  ["COLR.BR", "Colruyt"],
  ["DIE.BR", "D'Ieteren Group"],
  ["ELI.BR", "Elia Group"],
  ["GBLB.BR", "Groupe Bruxelles Lambert"],
  ["KBC.BR", "KBC Group"],
  ["LOTB.BR", "Lotus Bakeries"],
  ["MELE.BR", "Melexis"],
  ["PROX.BR", "Proximus"],
  ["SOF.BR", "Sofina"],
  ["SOLB.BR", "Solvay"],
  ["UCB.BR", "UCB"],
  ["UMI.BR", "Umicore"],
  ["WDP.BR", "Warehouses De Pauw"],
];

// FTSE MIB — Italie — suffixe .MI — 40 stés
const FTSEMIB: Array<[string, string]> = [
  ["A2A.MI", "A2A"],
  ["AMP.MI", "Amplifon"],
  ["AZM.MI", "Azimut Holding"],
  ["BAMI.MI", "Banco BPM"],
  ["BMED.MI", "Banca Mediolanum"],
  ["BPE.MI", "BPER Banca"],
  ["BGN.MI", "Banca Generali"],
  ["BPSO.MI", "Banca Popolare di Sondrio"],
  ["BZU.MI", "Buzzi"],
  ["CPR.MI", "Davide Campari-Milano"],
  ["DIA.MI", "DiaSorin"],
  ["ENEL.MI", "Enel"],
  ["ENI.MI", "Eni"],
  ["RACE.MI", "Ferrari"],
  ["FBK.MI", "FinecoBank"],
  ["G.MI", "Assicurazioni Generali"],
  ["HER.MI", "Hera"],
  ["IP.MI", "Interpump Group"],
  ["IG.MI", "Italgas"],
  ["ISP.MI", "Intesa Sanpaolo"],
  ["IVG.MI", "Iveco Group"],
  ["LDO.MI", "Leonardo"],
  ["MB.MI", "Mediobanca"],
  ["MONC.MI", "Moncler"],
  ["NEXI.MI", "Nexi"],
  ["PIRC.MI", "Pirelli"],
  ["PRY.MI", "Prysmian"],
  ["PST.MI", "Poste Italiane"],
  ["REC.MI", "Recordati"],
  ["SPM.MI", "Saipem"],
  ["SRG.MI", "Snam"],
  ["STLAM.MI", "Stellantis"],
  ["STMMI.MI", "STMicroelectronics"],
  ["TIT.MI", "Telecom Italia"],
  ["TEN.MI", "Tenaris"],
  ["TRN.MI", "Terna"],
  ["UCG.MI", "UniCredit"],
  ["UNI.MI", "Unipol Gruppo"],
  ["DAN.MI", "Danieli"],
  ["ENV.MI", "Enav"],
];

// AEX — Pays-Bas — suffixe .AS — 25 stés
const AEX: Array<[string, string]> = [
  ["ABN.AS", "ABN AMRO"],
  ["ADYEN.AS", "Adyen"],
  ["AGN.AS", "Aegon"],
  ["AD.AS", "Ahold Delhaize"],
  ["AKZA.AS", "AkzoNobel"],
  ["MT.AS", "ArcelorMittal"],
  ["ASM.AS", "ASM International"],
  ["ASML.AS", "ASML Holding"],
  ["ASRNL.AS", "ASR Nederland"],
  ["BESI.AS", "BE Semiconductor Industries"],
  ["DSFIR.AS", "DSM-Firmenich"],
  ["EXO.AS", "Exor"],
  ["HEIA.AS", "Heineken"],
  ["IMCD.AS", "IMCD"],
  ["INGA.AS", "ING Group"],
  ["KPN.AS", "KPN"],
  ["NN.AS", "NN Group"],
  ["PHIA.AS", "Philips"],
  ["PRX.AS", "Prosus"],
  ["RAND.AS", "Randstad"],
  ["REN.AS", "Relx"],
  ["SHELL.AS", "Shell"],
  ["UNA.AS", "Unilever"],
  ["URW.AS", "Unibail-Rodamco-Westfield"],
  ["WKL.AS", "Wolters Kluwer"],
];

// ATX — Autriche — suffixe .VI — 20 stés
const ATX: Array<[string, string]> = [
  ["EBS.VI", "Erste Group Bank"],
  ["OMV.VI", "OMV"],
  ["VER.VI", "Verbund"],
  ["ANDR.VI", "Andritz"],
  ["VOE.VI", "voestalpine"],
  ["BG.VI", "BAWAG Group"],
  ["RBI.VI", "Raiffeisen Bank International"],
  ["WIE.VI", "Wienerberger"],
  ["IIA.VI", "Immofinanz"],
  ["CAI.VI", "CA Immobilien Anlagen"],
  ["UQA.VI", "Uniqa Insurance Group"],
  ["VIG.VI", "Vienna Insurance Group"],
  ["EVN.VI", "EVN"],
  ["LNZ.VI", "Lenzing"],
  ["TKA.VI", "Telekom Austria"],
  ["POST.VI", "Österreichische Post"],
  ["MMK.VI", "Mayr-Melnhof Karton"],
  ["DOC.VI", "DO & CO"],
  ["SBO.VI", "Schoeller-Bleckmann Oilfield Equipment"],
  ["PYT.VI", "Polytec Holding"],
];

const INDEX_TO_COUNTRY: Record<SourceKey, Country | "US"> = {
  sp500: "US",
  top307: "US", // override par cas si suffixe EU
  cac40: "FR",
  ftse100: "GB",
  dax40: "DE",
  smi: "CH",
  bel20: "BE",
  ftsemib: "IT",
  aex: "NL",
  atx: "AT",
};

function detectCountryFromSuffix(ticker: string): Country | null {
  const up = ticker.toUpperCase();
  if (up.endsWith(".PA")) return "FR";
  if (up.endsWith(".L")) return "GB";
  if (up.endsWith(".DE")) return "DE";
  if (up.endsWith(".SW")) return "CH";
  if (up.endsWith(".BR")) return "BE";
  if (up.endsWith(".MI")) return "IT";
  if (up.endsWith(".AS")) return "NL";
  if (up.endsWith(".VI")) return "AT";
  return null;
}

function normalizeTicker(t: string): string {
  return t.trim().toUpperCase();
}

interface MergedEntry {
  ticker?: string;
  name?: string;
  [k: string]: unknown;
}

function main(): void {
  // ---- 1. Charger sources ----
  const sp500: string[] = JSON.parse(readFileSync(SP500_PATH, "utf8"));
  const v18: string[] = JSON.parse(readFileSync(V18_PATH, "utf8"));
  const merged: Record<string, MergedEntry> = JSON.parse(
    readFileSync(MERGED_PATH, "utf8"),
  );

  const top307 = v18.slice(0, 307);

  // ---- 2. Construire union ----
  // Map clé = ticker UPPER, valeur = { name, country, sources Set }
  const universe = new Map<
    string,
    {
      name: string;
      country: Country;
      sources: Set<SourceKey>;
    }
  >();

  function add(
    rawTicker: string,
    name: string,
    country: Country,
    source: SourceKey,
  ): void {
    const ticker = normalizeTicker(rawTicker);
    const existing = universe.get(ticker);
    if (existing) {
      existing.sources.add(source);
      // Si l'existing.name est vide/null, prendre le nouveau
      if (!existing.name && name) existing.name = name;
    } else {
      universe.set(ticker, {
        name,
        country,
        sources: new Set([source]),
      });
    }
  }

  // 2.1 SP500 (US par défaut, on déduit le nom plus tard via _merged)
  for (const t of sp500) {
    add(t, "", "US", "sp500");
  }

  // 2.2 Top 307 V1.8
  for (const t of top307) {
    const country = detectCountryFromSuffix(t) || "US";
    add(t, "", country, "top307");
  }

  // 2.3 Indices EU
  const indices: Array<[SourceKey, Array<[string, string]>]> = [
    ["cac40", CAC40],
    ["ftse100", FTSE100],
    ["dax40", DAX40],
    ["smi", SMI],
    ["bel20", BEL20],
    ["ftsemib", FTSEMIB],
    ["aex", AEX],
    ["atx", ATX],
  ];

  for (const [source, list] of indices) {
    const country = INDEX_TO_COUNTRY[source] as Country;
    for (const [ticker, name] of list) {
      add(ticker, name, country, source);
    }
  }

  // ---- 3. Cross-check avec _merged.json ----
  // Construire une map merged UPPER → entry pour lookup case-insensitive
  const mergedByUpper = new Map<string, MergedEntry>();
  for (const [k, v] of Object.entries(merged)) {
    mergedByUpper.set(normalizeTicker(k), v);
  }

  const missing: Array<{
    ticker: string;
    country: Country;
    sources: SourceKey[];
    name_wikipedia: string;
  }> = [];

  const conflicts: Array<{
    ticker: string;
    name_wikipedia: string;
    name_merged: string;
  }> = [];

  for (const [ticker, entry] of Array.from(universe.entries())) {
    const mergedEntry = mergedByUpper.get(ticker);
    if (mergedEntry && mergedEntry.name) {
      // Sté présente dans _merged.json
      if (MERGED_NAME_BLOCKLIST.has(ticker)) {
        // Cross-pollution connue : on garde le name Wikipedia
        if (
          entry.name &&
          entry.name.trim().toLowerCase() !==
            mergedEntry.name.trim().toLowerCase()
        ) {
          conflicts.push({
            ticker,
            name_wikipedia: entry.name,
            name_merged: mergedEntry.name,
          });
        }
        // entry.name reste tel quel (Wikipedia)
      } else {
        // Conflict tracking si écart
        if (
          entry.name &&
          entry.name.trim().toLowerCase() !==
            mergedEntry.name.trim().toLowerCase()
        ) {
          conflicts.push({
            ticker,
            name_wikipedia: entry.name,
            name_merged: mergedEntry.name,
          });
        }
        // Utiliser le name de _merged.json
        entry.name = mergedEntry.name;
      }
    } else {
      // Absent de _merged.json
      if (entry.sources.has("sp500") || entry.sources.has("top307")) {
        // Source US connue, _merged.json devrait l'avoir : signaler quand même
      }
      // Le signaler dans missing
      missing.push({
        ticker,
        country: entry.country,
        sources: Array.from(entry.sources),
        name_wikipedia: entry.name || "(unknown)",
      });
    }
  }

  // ---- 4. Construire array final, tri par ticker ----
  const output: UniverseEntry[] = [];
  const sortedTickers = Array.from(universe.keys()).sort();
  for (const ticker of sortedTickers) {
    const entry = universe.get(ticker)!;
    output.push({
      ticker,
      name: entry.name || ticker, // fallback au ticker si pas de name
      country: entry.country,
      sources: Array.from(entry.sources).sort(),
    });
  }

  // ---- 5. Écrire les fichiers ----
  writeFileSync(OUT_UNIVERSE, JSON.stringify(output, null, 2) + "\n", "utf8");
  writeFileSync(
    OUT_MISSING,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_universe: output.length,
        total_missing_from_merged: missing.length,
        missing: missing.sort((a, b) => a.ticker.localeCompare(b.ticker)),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  // ---- 6. Stats ----
  const bySource: Record<SourceKey, number> = {
    sp500: 0,
    top307: 0,
    cac40: 0,
    ftse100: 0,
    dax40: 0,
    smi: 0,
    bel20: 0,
    ftsemib: 0,
    aex: 0,
    atx: 0,
  };
  for (const e of output) {
    for (const s of e.sources) bySource[s]++;
  }

  const missingBySource: Record<string, number> = {};
  for (const m of missing) {
    for (const s of m.sources) {
      missingBySource[s] = (missingBySource[s] || 0) + 1;
    }
  }

  console.log("=== V1.9 universe build ===");
  console.log(`Total stés V1.9 : ${output.length}`);
  console.log("\nPar source :");
  for (const [k, v] of Object.entries(bySource)) {
    console.log(`  ${k.padEnd(10)} : ${v}`);
  }
  console.log(`\nMissing from _merged.json : ${missing.length}`);
  console.log("Missing par source :");
  for (const [k, v] of Object.entries(missingBySource)) {
    console.log(`  ${k.padEnd(10)} : ${v}`);
  }
  console.log(`\nNom conflicts (Wikipedia vs _merged) : ${conflicts.length}`);
  if (conflicts.length > 0) {
    console.log("Top 5 conflicts :");
    for (const c of conflicts.slice(0, 5)) {
      console.log(`  ${c.ticker}: '${c.name_wikipedia}' vs '${c.name_merged}'`);
    }
  }
  console.log(`\nWrote : ${OUT_UNIVERSE}`);
  console.log(`Wrote : ${OUT_MISSING}`);
}

main();
