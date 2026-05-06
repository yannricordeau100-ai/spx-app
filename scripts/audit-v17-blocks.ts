#!/usr/bin/env tsx
/**
 * audit-v17-blocks.ts — fait l'inventaire des blocs présents / absents
 * sur les stés V1.7 Pass 3 strict, sortie JSON pour suivi en boucle.
 *
 * Pour chaque sté du `v1-7-public.json` :
 *  - logo PNG dans `public/logos/<TICKER>.png`
 *  - ranks complets (4 champs non vides ni "-" ni "Not ranked")
 *  - risks ≥1 (scope partagé CONV-DATA / CONV-SYSTEMS)
 *  - governance non vide
 *  - ai_positioning rempli (stance + ≥1 evidence)
 *  - market_positions (TAM) ≥1 (V1.7 ou enrich .tam.json)
 *  - events ≥1 (V1.7 ou enrich)
 *  - revenue_by_segment ≥1
 *  - revenue_by_geography ≥1
 *
 * Sortie :
 *   - stdout : compteurs globaux + listes des manquants par bloc
 *   - fichier : `src/data/v1-7-blocks-audit.json`
 *     { "ticker": ["MISSING_LOGO","MISSING_RANKS",…], … }
 *
 * Utilisation : tournée régulièrement par CONV-SYSTEMS pour décider quoi
 * compléter en autonomie. Idempotent, gratuit (aucun appel réseau).
 *
 *   $ npx tsx scripts/audit-v17-blocks.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const V17 = path.join(ROOT, "src/data/v1-7-public.json");
const V2 = path.join(ROOT, "src/data/v2-pipeline");
const ENR = path.join(ROOT, "src/data/v2-pipeline-enrich");
const LOGOS = path.join(ROOT, "public/logos");
const OUT = path.join(ROOT, "src/data/v1-7-blocks-audit.json");

const HARDCODED = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT"]);

type AnyRec = Record<string, unknown>;

function readJsonOrNull<T>(p: string): T | null {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function isUsableRank(s: unknown): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t || t === "-" || t === "—") return false;
  if (/not\s*ranked/i.test(t)) return false;
  if (/non\s*class/i.test(t)) return false;
  if (t === "...") return false;
  return true;
}

function nonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function nonEmptyObject(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

function aiPositioningOk(v: unknown): boolean {
  if (!nonEmptyObject(v)) return false;
  const a = v as AnyRec;
  const stance = a.stance;
  const ev = a.evidence;
  const stanceOk = typeof stance === "string" && stance.trim().length > 0;
  const evOk = nonEmptyArray(ev);
  return stanceOk && evOk;
}

function existingLogos(): Set<string> {
  return new Set(readdirSync(LOGOS).map((f) => f.replace(".png", "").toUpperCase()));
}

function safeFilename(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, "-");
}

function main() {
  const v17 = readJsonOrNull<Record<string, AnyRec>>(V17);
  if (!v17) {
    console.error("❌ v1-7-public.json introuvable");
    process.exit(1);
  }
  const tickers = Object.keys(v17);
  const logos = existingLogos();

  const audit: Record<string, string[]> = {};
  const counters: Record<string, number> = {
    MISSING_LOGO: 0,
    MISSING_RANKS: 0,
    MISSING_RISKS: 0,
    MISSING_GOVERNANCE: 0,
    MISSING_AI_POSITIONING: 0,
    MISSING_MARKET_POSITIONS: 0,
    MISSING_EVENTS: 0,
    MISSING_SEGMENTS: 0,
    MISSING_GEOGRAPHY: 0,
  };

  for (const t of tickers) {
    const lower = t.toLowerCase();
    const upper = t.toUpperCase();
    const flags: string[] = [];

    // Logo
    if (!HARDCODED.has(upper) && !logos.has(safeFilename(t))) {
      flags.push("MISSING_LOGO");
      counters.MISSING_LOGO++;
    }

    const full = readJsonOrNull<AnyRec>(path.join(V2, `${lower}.json`));
    const enrich = readJsonOrNull<AnyRec>(path.join(ENR, `${lower}.json`));
    const tam = readJsonOrNull<AnyRec>(path.join(ENR, `${lower}.tam.json`));

    if (!full) continue;

    // Ranks
    const ranks = (full.ranks as AnyRec | undefined) ?? {};
    const ranksOk =
      isUsableRank(ranks.global_world) &&
      isUsableRank(ranks.global_us) &&
      isUsableRank(ranks.sector) &&
      isUsableRank(ranks.subsector);
    if (!ranksOk) {
      flags.push("MISSING_RANKS");
      counters.MISSING_RANKS++;
    }

    // Risks
    if (!nonEmptyArray(full.risks) && !nonEmptyArray(enrich?.risks)) {
      flags.push("MISSING_RISKS");
      counters.MISSING_RISKS++;
    }

    // Governance
    if (!nonEmptyObject(full.governance) && !nonEmptyObject(enrich?.governance)) {
      flags.push("MISSING_GOVERNANCE");
      counters.MISSING_GOVERNANCE++;
    }

    // AI positioning
    if (!aiPositioningOk(full.ai_positioning) && !aiPositioningOk(enrich?.ai_positioning)) {
      flags.push("MISSING_AI_POSITIONING");
      counters.MISSING_AI_POSITIONING++;
    }

    // Market positions (TAM honesty rule : seuls les disclosed comptent)
    const mp1 = nonEmptyArray(full.market_positions);
    const mp2 = nonEmptyArray(tam?.market_positions);
    if (!mp1 && !mp2) {
      flags.push("MISSING_MARKET_POSITIONS");
      counters.MISSING_MARKET_POSITIONS++;
    }

    // Events
    if (!nonEmptyArray(full.events) && !nonEmptyArray(enrich?.events)) {
      flags.push("MISSING_EVENTS");
      counters.MISSING_EVENTS++;
    }

    // Revenue by segment
    if (!nonEmptyArray(full.revenue_by_segment) && !nonEmptyArray(enrich?.revenue_by_segment)) {
      flags.push("MISSING_SEGMENTS");
      counters.MISSING_SEGMENTS++;
    }

    // Revenue by geography
    if (!nonEmptyArray(full.revenue_by_geography) && !nonEmptyArray(enrich?.revenue_by_geography)) {
      flags.push("MISSING_GEOGRAPHY");
      counters.MISSING_GEOGRAPHY++;
    }

    if (flags.length > 0) audit[t] = flags;
  }

  writeFileSync(OUT, JSON.stringify(audit, null, 2));

  const total = tickers.length;
  console.log(`📊 Audit V1.7 Pass 3 strict (${total} stés)\n`);
  for (const [k, n] of Object.entries(counters)) {
    const pct = Math.round((n * 100) / total);
    const bar = "█".repeat(Math.round((n * 30) / total));
    console.log(`  ${k.padEnd(28)} ${String(n).padStart(4)} (${String(pct).padStart(3)}%) ${bar}`);
  }
  console.log(`\n✅ Détail des manques : ${OUT}`);
}

main();
