#!/usr/bin/env tsx
/**
 * fix-translations-fr-to-en.ts — corrige les valeurs FR sur sector /
 * subsector / industry des sés V1.7 / V1.8 (qui doivent rester en EN
 * canonique GICS pour matcher le pipeline et les agrégations).
 *
 * Yann 8 mai 2026 : bug "Industrie" vs "Industrials" empêchait CAT
 * d'avoir des peers car aucun sé V1.7 ne matchait son sector.
 *
 * Stratégie : dictionnaire FR canonique → EN, replace en place dans
 * src/data/v2-pipeline/<ticker>.json. Idempotent.
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";

const PIPELINE = path.join(process.cwd(), "src/data/v2-pipeline");

// Dictionnaire FR canonique → EN GICS-aligned (Yann 8 mai 2026)
// Important : on remplace l'ENTIRE valeur, pas un sous-mot. Une seule
// passe d'égalité stricte (case-insensitive) pour éviter les
// mauvais remplacements ("Communication Services" est déjà EN OK).
const SECTOR_FR_TO_EN: Record<string, string> = {
  // Sectors GICS canoniques
  "industrie": "Industrials",
  "industries": "Industrials",
  "énergie": "Energy",
  "energie": "Energy",
  "santé": "Health Care",
  "soins de santé": "Health Care",
  "consommation cyclique": "Consumer Discretionary",
  "consommation discrétionnaire": "Consumer Discretionary",
  "consommation discretionnaire": "Consumer Discretionary",
  "biens de consommation cyclique": "Consumer Discretionary",
  "biens de consommation": "Consumer Staples",
  "consommation de base": "Consumer Staples",
  "produits de consommation de base": "Consumer Staples",
  "matériaux": "Materials",
  "materiaux": "Materials",
  "services de communication": "Communication Services",
  "communication": "Communication Services",
  "technologies de l'information": "Information Technology",
  "technologie": "Information Technology",
  "technologies": "Information Technology",
  "télécommunications": "Communication Services",
  "telecommunications": "Communication Services",
  "immobilier": "Real Estate",
  "services publics": "Utilities",
  "services collectifs": "Utilities",
  "finances": "Financials",
  "secteur financier": "Financials",
};

const SUBSECTOR_FR_TO_EN: Record<string, string> = {
  "banques": "Banks",
  "logiciels": "Software",
  "semi-conducteurs": "Semiconductors",
  "semi-conducteurs et logiciels": "Semiconductors & Semiconductor Equipment",
  "semi-conducteurs et équipement de semi-conducteurs": "Semiconductors & Semiconductor Equipment",
  "construction": "Construction & Engineering",
  "construction et ingénierie": "Construction & Engineering",
  "construction et ingenierie": "Construction & Engineering",
  "construction & ingénierie": "Construction & Engineering",
  "construction et matériaux": "Construction Materials",
  "machines lourdes": "Construction Machinery & Heavy Trucks",
  "machines lourdes & énergie": "Construction Machinery & Heavy Trucks",
  "aliments": "Food Products",
  "boissons": "Beverages",
  "tabac": "Tobacco",
  "pétrole": "Oil, Gas & Consumable Fuels",
  "pétrole et gaz": "Oil, Gas & Consumable Fuels",
  "petrole et gaz": "Oil, Gas & Consumable Fuels",
  "détail": "Specialty Retail",
  "commerce de détail": "Retail",
  "automobile": "Automobiles",
  "pharmaceutique": "Pharmaceuticals",
  "pharmacie": "Pharmaceuticals",
  "biotechnologie": "Biotechnology",
  "assurance": "Insurance",
  "assurances": "Insurance",
  "médias": "Media & Entertainment",
  "medias": "Media & Entertainment",
  "aérospatial": "Aerospace & Defense",
  "aerospatial": "Aerospace & Defense",
  "défense": "Aerospace & Defense",
  "transports": "Transportation",
  "compagnies aériennes": "Airlines",
  "lignes aériennes": "Airlines",
};

function fixField(val: unknown, dict: Record<string, string>): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  return dict[lower] ?? null;
}

let sectorFixed = 0;
let subsectorFixed = 0;
let touched = 0;

for (const f of readdirSync(PIPELINE)) {
  if (!f.endsWith(".json") || f.startsWith("_")) continue;
  const p = path.join(PIPELINE, f);
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    continue;
  }
  let dirty = false;

  const newSector = fixField(d.sector, SECTOR_FR_TO_EN);
  if (newSector && newSector !== d.sector) {
    d.sector = newSector;
    sectorFixed++;
    dirty = true;
  }
  const newSubsector = fixField(d.subsector, SUBSECTOR_FR_TO_EN);
  if (newSubsector && newSubsector !== d.subsector) {
    d.subsector = newSubsector;
    subsectorFixed++;
    dirty = true;
  }

  if (dirty) {
    writeFileSync(p, JSON.stringify(d, null, 2));
    touched++;
  }
}

console.log(`✅ Traduction FR→EN :`);
console.log(`  - sectors fixés : ${sectorFixed}`);
console.log(`  - subsectors fixés : ${subsectorFixed}`);
console.log(`  - fichiers touchés : ${touched}`);
