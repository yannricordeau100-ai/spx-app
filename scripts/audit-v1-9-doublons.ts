/**
 * Audit des doublons US <-> foreign listings dans l'univers V1.9.
 *
 * Pour chaque sté foreign (suffix .L .DE .PA .SW .BR .MI .AS .CO
 * .HE .OL .VI .TO .LS .ST .MC), cherche s'il existe une sté US
 * (sans suffix ou listed NYSE/NASDAQ) avec le même issuer/parent
 * group.
 *
 * Heuristique matching :
 *   1. Normalisation noms officiels (drop AG, SA, plc, NV, SE, Ltd, Holding…)
 *   2. Match exact normalisé → confidence=high
 *   3. Match strict du premier mot signifiant + 1 autre token → medium
 *   4. Sinon → keep_separate
 *
 * Output : src/data/v1-9-doublons-audit.json
 *
 * MISSION 2 du prompt REEXTRACT-OPUS-29MAY.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const UNIVERSE = path.join(ROOT, "src/data/v1-9-universe.json");
const V2 = path.join(ROOT, "src/data/v2-pipeline");
const OUT = path.join(ROOT, "src/data/v1-9-doublons-audit.json");

const FOREIGN_SUFFIXES = [
  ".L", ".DE", ".PA", ".SW", ".BR", ".MI", ".AS", ".CO",
  ".HE", ".OL", ".VI", ".TO", ".LS", ".ST", ".MC", ".IR",
];

type UniverseEntry = { ticker: string; name: string; country: string };
type V2File = { ticker?: string; name?: string };

/** Normalise un nom de société pour matching. */
function normalizeName(name: string | undefined | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    // Retire suffixes corporate
    .replace(
      /\b(plc|s\.?a\.?(?:s)?|n\.?v\.?|s\.?e\.?|ag|spa|s\.?p\.?a\.?|gmbh|ltd|limited|inc|corp(?:oration)?|group|holding(?:s)?|company|co\.?|the|llc|kgaa|asa|oyj|abp|ab|s\.?a\.?b\.?\s*de\s*c\.?v\.?|adr|holdings)\b/gi,
      "",
    )
    .replace(/[\.,'"&\(\)\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadV2Name(ticker: string): string | null {
  const lc = ticker.toLowerCase();
  const candidates = [
    path.join(V2, `${lc}.json`),
    path.join(V2, `${ticker}.json`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const data: V2File = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.name) return data.name;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function isForeign(ticker: string): boolean {
  return FOREIGN_SUFFIXES.some((s) => ticker.toUpperCase().endsWith(s));
}

type AuditRow = {
  ticker_foreign: string;
  ticker_us: string | null;
  issuer_name: string;
  us_name: string | null;
  confidence: "high" | "medium" | "low";
  recommendation: "merge" | "keep_separate" | "investigate";
  match_reason: string;
};

function main(): void {
  const universe: UniverseEntry[] = JSON.parse(fs.readFileSync(UNIVERSE, "utf-8"));

  // Construire l'index des US tickers (sans suffix exotic)
  const usEntries = universe.filter(
    (u) => !FOREIGN_SUFFIXES.some((s) => u.ticker.toUpperCase().endsWith(s)) &&
           !/\.(T|TW|HK|KS|SA|JO|SR|MX|JK|TA|NZ|AX|SI|KL)$/i.test(u.ticker),
  );

  // Index : normalized name -> {ticker, fullName}
  const usByNorm = new Map<string, { ticker: string; name: string }>();
  const usByFirstWord = new Map<string, Array<{ ticker: string; name: string; norm: string }>>();

  for (const u of usEntries) {
    const fullName = loadV2Name(u.ticker) ?? u.name;
    const norm = normalizeName(fullName);
    if (!norm) continue;
    if (!usByNorm.has(norm)) usByNorm.set(norm, { ticker: u.ticker, name: fullName });
    const firstWord = norm.split(" ")[0];
    if (firstWord && firstWord.length >= 3) {
      if (!usByFirstWord.has(firstWord)) usByFirstWord.set(firstWord, []);
      usByFirstWord.get(firstWord)!.push({ ticker: u.ticker, name: fullName, norm });
    }
  }

  const foreigners = universe.filter((u) => isForeign(u.ticker));
  const rows: AuditRow[] = [];

  for (const f of foreigners) {
    const fullName = loadV2Name(f.ticker) ?? f.name;
    const norm = normalizeName(fullName);
    if (!norm) {
      rows.push({
        ticker_foreign: f.ticker,
        ticker_us: null,
        issuer_name: fullName,
        us_name: null,
        confidence: "low",
        recommendation: "keep_separate",
        match_reason: "no_name_available",
      });
      continue;
    }

    // 1. Match exact normalisé
    const exact = usByNorm.get(norm);
    if (exact) {
      rows.push({
        ticker_foreign: f.ticker,
        ticker_us: exact.ticker,
        issuer_name: fullName,
        us_name: exact.name,
        confidence: "high",
        recommendation: "merge",
        match_reason: "exact_normalized_name",
      });
      continue;
    }

    // 2. Match premier mot + au moins 1 autre token commun
    const firstWord = norm.split(" ")[0];
    const tokens = new Set(norm.split(" ").filter((t) => t.length >= 3));
    const candidates = (firstWord && firstWord.length >= 3)
      ? (usByFirstWord.get(firstWord) ?? [])
      : [];

    let bestMatch: { ticker: string; name: string; overlap: number; norm: string } | null = null;
    for (const c of candidates) {
      const cTokens = new Set(c.norm.split(" ").filter((t) => t.length >= 3));
      let overlap = 0;
      for (const t of tokens) if (cTokens.has(t)) overlap++;
      if (!bestMatch || overlap > bestMatch.overlap) {
        bestMatch = { ticker: c.ticker, name: c.name, overlap, norm: c.norm };
      }
    }

    if (bestMatch && bestMatch.overlap >= 2) {
      rows.push({
        ticker_foreign: f.ticker,
        ticker_us: bestMatch.ticker,
        issuer_name: fullName,
        us_name: bestMatch.name,
        confidence: bestMatch.overlap >= 3 ? "high" : "medium",
        recommendation: bestMatch.overlap >= 3 ? "merge" : "investigate",
        match_reason: `${bestMatch.overlap}_tokens_overlap`,
      });
      continue;
    }

    rows.push({
      ticker_foreign: f.ticker,
      ticker_us: null,
      issuer_name: fullName,
      us_name: null,
      confidence: "low",
      recommendation: "keep_separate",
      match_reason: "no_us_match_found",
    });
  }

  // Known historic false-positives : sociétés portant un nom proche
  // mais juridiquement séparées. Flag pour review humaine.
  const KNOWN_FALSE_POSITIVES = new Set<string>([
    "MRK.DE", // Merck KGaA != Merck & Co. (US) — split historique
    "CCH.L",  // Coca-Cola HBC != Coca-Cola Europacific Partners
    "QIA.DE", // Qiagen N.V. (data label "Amgen Inc." est faux dans universe)
  ]);
  for (const r of rows) {
    if (KNOWN_FALSE_POSITIVES.has(r.ticker_foreign)) {
      r.recommendation = "investigate";
      r.confidence = "low";
      r.match_reason = `${r.match_reason}_KNOWN_FALSE_POSITIVE`;
    }
  }

  // Stats
  const stats = {
    foreign_total: foreigners.length,
    us_total: usEntries.length,
    duplicates_high: rows.filter((r) => r.confidence === "high").length,
    duplicates_medium: rows.filter((r) => r.confidence === "medium").length,
    keep_separate: rows.filter((r) => r.recommendation === "keep_separate").length,
    merge_recommended: rows.filter((r) => r.recommendation === "merge").length,
    investigate: rows.filter((r) => r.recommendation === "investigate").length,
  };

  const out = {
    _generated_at: new Date().toISOString(),
    _signed_by: "REEXTRACT-OPUS-29MAY-residual",
    _mission: "MISSION 2 audit doublons univers V1.9",
    _method: "Normalisation noms officiels + match exact ou token overlap >=2. Pas de cross-check EDGAR CIK (pas d'API externe).",
    stats,
    rows,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nOutput: ${OUT}`);
}

main();
