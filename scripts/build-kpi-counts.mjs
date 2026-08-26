#!/usr/bin/env node
/**
 * Compte les KPI publies sur l app et ecrit src/data/_kpi-counts.json.
 *
 * Trois familles, celles que Yann veut afficher sur la home (26 aout 2026) :
 *   - indicateurs cles : lignes du tableau, KPI principal (hero) inclus
 *   - blocs graphiques : special-kpis publies (table Supabase)
 *   - stories          : cartes du carrousel
 *
 * Le comptage suit la MEME priorite que l app : kpis-haut ecrase v2-pipeline
 * pour les shorts en doublon, sinon on cumulerait deux fois le meme KPI.
 * Relance : node scripts/build-kpi-counts.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const UNIVERSE = path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json");
const PIPE = path.join(ROOT, "src/data/v2-pipeline");
const HAUT = path.join(ROOT, ".batches-drafts-safe/kpis-haut");
const OUT = path.join(ROOT, "src/data/_kpi-counts.json");

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

const universe = readJson(UNIVERSE)?.tickers ?? [];

// Meme filtre que l app : les KPI generiques (chiffre d affaires, resultat
// net, BPA...) sont masques du tableau, on ne les compte donc pas.
const GENERIC = new Set(
  (readJson(path.join(ROOT, "src/data/kpi-generic-library.json")) ?? [])
    .map((g) => String(g?.short ?? "").toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean),
);
const REVENUE_ALIASES = new Set([
  "revenue", "net sales", "net revenue", "sales", "total sales",
  "chiffre d'affaires net", "chiffre d'affaires", "total revenues",
]);
const isGeneric = (short) => {
  const n = String(short ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return false;
  return GENERIC.has(n) || (GENERIC.has("total revenue") && REVENUE_ALIASES.has(n));
};
let keyIndicators = 0;
let stories = 0;
let heroes = 0;
let tickers = 0;

for (const t of universe) {
  const pipe = readJson(path.join(PIPE, `${t.toLowerCase()}.json`));
  const haut = readJson(path.join(HAUT, `${t.toUpperCase()}.json`));
  const fromPipe = Array.isArray(pipe?.kpis) ? pipe.kpis : [];
  const fromHaut = Array.isArray(haut?.kpis) ? haut.kpis : [];
  if (fromPipe.length === 0 && fromHaut.length === 0) continue;
  tickers += 1;
  if (pipe?.hero_kpi) heroes += 1;

  const hautShorts = new Set(
    fromHaut.map((k) => String(k?.short ?? "").toLowerCase()).filter(Boolean),
  );
  const merged = [
    ...fromHaut,
    ...fromPipe.filter(
      (k) => !hautShorts.has(String(k?.short ?? "").toLowerCase()),
    ),
  ];
  for (const k of merged) {
    if (!k || !k.short) continue;
    if (k.is_short_history === true) stories += 1;
    else if (!isGeneric(k.short)) keyIndicators += 1;
  }
}

const counts = {
  generated_at: new Date().toISOString().slice(0, 10),
  universe: "V1.9.5",
  tickers,
  key_indicators: keyIndicators,
  heroes,
  stories,
  // Renseigne a l execution par l app (table desk_special_kpis).
  special_blocks: 0,
  total: keyIndicators + stories,
};
fs.writeFileSync(OUT, JSON.stringify(counts, null, 2));
console.log(JSON.stringify(counts));
