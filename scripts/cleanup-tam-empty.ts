/**
 * Cleanup TAM (market_positions) sur toutes les stés qui ont le champ
 * MAIS non rempli OU non à jour.
 *
 * Regles (cf. CLAUDE.md §6 TAM honesty rule) :
 *
 * GARDER le TAM si :
 *   - `market_positions` est un array non vide
 *   - ET au moins 1 item a un `tam` numérique > 0 (le champ s'appelle
 *     `tam` dans le pipeline actuel, pas `tam_value`)
 *   - ET la sté est "à jour" :
 *       * `last_data_date` ISO < 12 mois (dataset principal)
 *       OU `_extracted_at` < 6 mois
 *       OU `researched_at` < 6 mois (fichier .tam.json)
 *
 * SUPPRIMER le TAM si :
 *   - `market_positions` array vide / null / absent
 *   - OU contient uniquement des items SANS `tam` numérique > 0
 *   - OU fichier .tam.json ne contient QUE `no_tam_disclosed:true` ou
 *     un champ `error` (= rien d'utile)
 *   - OU la sté n'est pas à jour
 *
 * Actions :
 *   - `src/data/v2-pipeline/<ticker>.json` : si `market_positions`
 *     présent → delete clé proprement
 *   - `src/data/v2-pipeline-enrich/<ticker>.tam.json` : fs.unlink du
 *     fichier (suppression propre)
 *
 * Run : npx tsx scripts/cleanup-tam-empty.ts
 *       npx tsx scripts/cleanup-tam-empty.ts --dry-run
 */
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve, join } from "path";

const projectRoot = resolve(__dirname, "..");
const mainDir = join(projectRoot, "src/data/v2-pipeline");
const enrichDir = join(projectRoot, "src/data/v2-pipeline-enrich");

const DRY_RUN = process.argv.includes("--dry-run");

const FRESH_LDD_MONTHS = 12; // last_data_date max age
const FRESH_EXTRACTED_MONTHS = 6; // _extracted_at / researched_at max age
const NOW = new Date();

function monthsSince(iso: string | undefined | null): number | null {
  if (!iso || typeof iso !== "string") return null;
  // ISO can be "2025-04-29" or "2025-04-29T12:34:56Z"
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diffMs = NOW.getTime() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.44);
}

function isFresh(args: {
  lastDataDate?: string;
  extractedAt?: string;
  researchedAt?: string;
}): boolean {
  const ldd = monthsSince(args.lastDataDate);
  if (ldd !== null && ldd < FRESH_LDD_MONTHS) return true;
  const ex = monthsSince(args.extractedAt);
  if (ex !== null && ex < FRESH_EXTRACTED_MONTHS) return true;
  const r = monthsSince(args.researchedAt);
  if (r !== null && r < FRESH_EXTRACTED_MONTHS) return true;
  return false;
}

function hasValidTamItem(market_positions: unknown): boolean {
  if (!Array.isArray(market_positions) || market_positions.length === 0) return false;
  for (const item of market_positions) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    // Schema actuel utilise `tam` (number). Tolerer `tam_value` au cas où.
    const tam = rec.tam ?? rec.tam_value;
    if (typeof tam === "number" && tam > 0) return true;
  }
  return false;
}

type Stats = {
  scanned: number;
  mainHasMp: number;
  mainDeleted: number;
  enrichExisted: number;
  enrichDeleted: number;
  kept: number;
  cleanedTickers: string[];
};

function main() {
  console.log(`[cleanup-tam-empty] DRY_RUN=${DRY_RUN}`);

  // Index des fichiers principaux par ticker (lowercase, sans extension)
  const mainFiles = readdirSync(mainDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_") && !f.endsWith(".gemini.json")
  );
  const enrichFiles = readdirSync(enrichDir).filter((f) => f.endsWith(".tam.json"));

  // Union des tickers concernés : tous ceux qui ont SOIT market_positions dans
  // le dataset principal, SOIT un fichier .tam.json
  const candidateTickers = new Set<string>();
  for (const f of enrichFiles) {
    candidateTickers.add(f.replace(/\.tam\.json$/, ""));
  }
  // Pre-scan des principaux : ne charger que si market_positions present
  for (const f of mainFiles) {
    const p = join(mainDir, f);
    try {
      const raw = readFileSync(p, "utf-8");
      // quick string check avant JSON.parse
      if (raw.includes('"market_positions"')) {
        const ticker = f.replace(/\.json$/, "");
        candidateTickers.add(ticker);
      }
    } catch (e) {
      console.warn(`[skip read main] ${f}: ${(e as Error).message}`);
    }
  }

  const stats: Stats = {
    scanned: candidateTickers.size,
    mainHasMp: 0,
    mainDeleted: 0,
    enrichExisted: 0,
    enrichDeleted: 0,
    kept: 0,
    cleanedTickers: [],
  };

  for (const ticker of candidateTickers) {
    const mainPath = join(mainDir, `${ticker}.json`);
    const enrichPath = join(enrichDir, `${ticker}.tam.json`);

    let mainData: Record<string, unknown> | null = null;
    let hasMpInMain = false;
    if (existsSync(mainPath)) {
      try {
        mainData = JSON.parse(readFileSync(mainPath, "utf-8"));
        if (mainData && "market_positions" in mainData) {
          hasMpInMain = true;
          stats.mainHasMp++;
        }
      } catch (e) {
        console.warn(`[skip parse main] ${ticker}: ${(e as Error).message}`);
      }
    }

    let enrichData: Record<string, unknown> | null = null;
    if (existsSync(enrichPath)) {
      stats.enrichExisted++;
      try {
        enrichData = JSON.parse(readFileSync(enrichPath, "utf-8"));
      } catch (e) {
        console.warn(`[skip parse enrich] ${ticker}: ${(e as Error).message}`);
      }
    }

    // Recolte des infos pour evaluer "rempli + a jour"
    const mainMp = mainData?.market_positions;
    const enrichMp = enrichData?.market_positions;

    const validInMain = hasValidTamItem(mainMp);
    const validInEnrich = hasValidTamItem(enrichMp);
    const hasAnyValid = validInMain || validInEnrich;

    const lastDataDate =
      (mainData?.last_data_date as string | undefined) ??
      (enrichData?.last_data_date as string | undefined);
    const extractedAt =
      (mainData?._extracted_at as string | undefined) ??
      (enrichData?._extracted_at as string | undefined);
    const researchedAt = enrichData?.researched_at as string | undefined;

    const fresh = isFresh({
      lastDataDate,
      extractedAt,
      researchedAt,
    });

    const shouldKeep = hasAnyValid && fresh;

    if (shouldKeep) {
      stats.kept++;
      continue;
    }

    // SUPPRIMER
    stats.cleanedTickers.push(ticker);

    // 1) Dataset principal : delete cle market_positions si presente
    if (hasMpInMain && mainData) {
      delete mainData.market_positions;
      stats.mainDeleted++;
      if (!DRY_RUN) {
        writeFileSync(mainPath, JSON.stringify(mainData, null, 2) + "\n", "utf-8");
      }
    }

    // 2) Fichier .tam.json : suppression propre
    if (existsSync(enrichPath)) {
      stats.enrichDeleted++;
      if (!DRY_RUN) {
        unlinkSync(enrichPath);
      }
    }
  }

  console.log("");
  console.log("============ CLEANUP TAM REPORT ============");
  console.log(`Stés candidates scannées        : ${stats.scanned}`);
  console.log(`Datasets principaux avec MP     : ${stats.mainHasMp}`);
  console.log(`  → clé market_positions supprimée: ${stats.mainDeleted}`);
  console.log(`Fichiers .tam.json existants    : ${stats.enrichExisted}`);
  console.log(`  → fichiers .tam.json supprimés : ${stats.enrichDeleted}`);
  console.log(`Stés conservées (rempli + à jour): ${stats.kept}`);
  console.log(`Stés nettoyées                   : ${stats.cleanedTickers.length}`);
  console.log("");
  console.log("10 premiers tickers nettoyés     :");
  for (const t of stats.cleanedTickers.slice(0, 10)) {
    console.log(`  - ${t}`);
  }
  if (DRY_RUN) {
    console.log("\n(DRY_RUN — aucun fichier modifié)");
  }
}

main();
