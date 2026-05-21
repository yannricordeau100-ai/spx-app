#!/usr/bin/env tsx
/**
 * Stoxx 600 gap analysis vs V1.9 universe.
 * - Input: scripts/stoxx-gap/wikipedia-raw.txt (TICKER|NAME|COUNTRY)
 * - Input: src/data/v1-9-universe.json (990 stés)
 * - Input: sec-data/cat3-european/<TICKER.SUFFIX>/annual-text/*.txt
 * - Output: src/data/v1-9-stoxx600-gap.json
 *
 * Sub-agent CONV-CONCEPTS, lecture filesystem only.
 */
import * as fs from "node:fs";
import * as path from "node:path";

type Constituent = { ticker: string; name: string; country: string };
type UniverseRow = { ticker: string; name: string; country: string; sources: string[] };
type GapRow = {
  ticker: string;
  name: string;
  country_iso: string;
  has_local_docs: boolean;
  file_count: number;
  priority: "P0" | "P1" | "P2";
  matched_local_dir?: string;
};

const ROOT = "/Users/yann/spx-app";
const SEC_DIR = path.join(ROOT, "sec-data", "cat3-european");
const UNIVERSE_PATH = path.join(ROOT, "src", "data", "v1-9-universe.json");
const WIKI_PATH = path.join(ROOT, "scripts", "stoxx-gap", "wikipedia-raw.txt");
const OUT_PATH = path.join(ROOT, "src", "data", "v1-9-stoxx600-gap.json");

// Country code -> typical Yahoo Finance suffix(es) used in sec-data dirs.
const COUNTRY_SUFFIX: Record<string, string[]> = {
  CH: [".SW"],
  GB: [".L"],
  FR: [".PA"],
  DE: [".DE"],
  IT: [".MI"],
  NL: [".AS"],
  BE: [".BR"],
  ES: [".MC"],
  SE: [".ST"],
  DK: [".CO"],
  FI: [".HE"],
  NO: [".OL"],
  AT: [".VI"],
  PT: [".LS"],
  IE: [".IR", ".L"],
  PL: [".WA"],
  LU: [".AS", ".PA"],
  GR: [".AT"],
  BM: [".L"],
};

function parseWiki(): Constituent[] {
  const raw = fs.readFileSync(WIKI_PATH, "utf8");
  const out: Constituent[] = [];
  const seen = new Set<string>();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split("|");
    if (parts.length < 3) continue;
    const [ticker, name, country] = parts;
    const key = `${ticker}|${country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ticker: ticker.trim(), name: name.trim(), country: country.trim() });
  }
  return out;
}

function loadUniverse(): UniverseRow[] {
  return JSON.parse(fs.readFileSync(UNIVERSE_PATH, "utf8"));
}

function buildUniverseIndex(rows: UniverseRow[]): {
  byBase: Map<string, UniverseRow>;
  byNameNorm: Map<string, UniverseRow>;
} {
  const byBase = new Map<string, UniverseRow>();
  const byNameNorm = new Map<string, UniverseRow>();
  for (const r of rows) {
    const base = r.ticker.split(".")[0].toUpperCase();
    if (!byBase.has(base)) byBase.set(base, r);
    byBase.set(r.ticker.toUpperCase(), r);
    byNameNorm.set(normName(r.name), r);
  }
  return { byBase, byNameNorm };
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(plc|sa|s\.a\.|ag|nv|n\.v\.|spa|s\.p\.a\.|asa|ab|ltd|inc|corporation|corp|group|holdings?|holding)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function listSecDirs(): string[] {
  return fs.readdirSync(SEC_DIR).filter((d) => {
    try {
      return fs.statSync(path.join(SEC_DIR, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

function findLocalDir(ticker: string, country: string, secDirs: Set<string>): string | undefined {
  const base = ticker.toUpperCase();
  const suffixes = COUNTRY_SUFFIX[country] ?? [];
  // Try base + each suffix.
  for (const suf of suffixes) {
    const cand = base + suf;
    if (secDirs.has(cand)) return cand;
  }
  // Try variants stripping/adding letter suffix (e.g. VOLVB -> VOLV-B.ST).
  if (/[A-Z]$/.test(base) && base.length > 2) {
    const stem = base.slice(0, -1);
    const tail = base.slice(-1);
    for (const suf of suffixes) {
      const c1 = `${stem}-${tail}${suf}`;
      const c2 = `${stem} ${tail}${suf}`;
      if (secDirs.has(c1)) return c1;
      if (secDirs.has(c2)) return c2;
    }
  }
  // Last-chance: base ticker no-suffix as-is.
  if (secDirs.has(base)) return base;
  // Exact stem match across sec-dirs (e.g. ASSAB matches ASSA-B.ST or ASSAB.ST).
  // Strips hyphens/spaces inside the ticker stem but requires full equality.
  for (const suf of suffixes) {
    const arr = Array.from(secDirs);
    for (const d of arr) {
      if (!d.endsWith(suf)) continue;
      const stem = d.slice(0, -suf.length).replace(/[-\s]/g, "").toUpperCase();
      if (stem === base) return d;
    }
  }
  return undefined;
}

function countAnnualText(dir: string): number {
  const p = path.join(SEC_DIR, dir, "annual-text");
  try {
    if (!fs.statSync(p).isDirectory()) return 0;
    return fs.readdirSync(p).filter((f) => f.endsWith(".txt")).length;
  } catch {
    return 0;
  }
}

function classify(fileCount: number): "P0" | "P1" | "P2" {
  if (fileCount >= 3) return "P0";
  if (fileCount >= 1) return "P1";
  return "P2";
}

function main() {
  const constituents = parseWiki();
  const universe = loadUniverse();
  const { byBase, byNameNorm } = buildUniverseIndex(universe);
  const secDirs = new Set(listSecDirs());

  const absent: Constituent[] = [];
  for (const c of constituents) {
    const baseTicker = c.ticker.toUpperCase();
    const inByBase = byBase.has(baseTicker);
    const inByName = byNameNorm.has(normName(c.name));
    if (!inByBase && !inByName) absent.push(c);
  }

  const rows: GapRow[] = absent.map((c) => {
    const dir = findLocalDir(c.ticker, c.country, secDirs);
    const count = dir ? countAnnualText(dir) : 0;
    return {
      ticker: c.ticker,
      name: c.name,
      country_iso: c.country,
      has_local_docs: count > 0,
      file_count: count,
      priority: classify(count),
      matched_local_dir: dir,
    };
  });

  // Sort: P0 first by file_count desc, then P1, then P2 alpha by ticker.
  rows.sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2 } as const;
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    if (a.priority !== "P2") return b.file_count - a.file_count;
    return a.ticker.localeCompare(b.ticker);
  });

  const summary = {
    generated_at: new Date().toISOString(),
    source_wikipedia_constituents: constituents.length,
    universe_v1_9_size: universe.length,
    absent_from_universe: rows.length,
    distribution: {
      P0: rows.filter((r) => r.priority === "P0").length,
      P1: rows.filter((r) => r.priority === "P1").length,
      P2: rows.filter((r) => r.priority === "P2").length,
    },
    note:
      "Wikipedia table was truncated by WebFetch model output (~300/600). Re-run with extended fetch or another source for full 600 coverage.",
    rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(JSON.stringify({ ...summary, rows: undefined }, null, 2));

  // Top 30 P0.
  const top30 = rows.filter((r) => r.priority === "P0").slice(0, 30);
  console.log("\nTOP 30 P0 (ticker, country, files, name, local_dir):");
  for (const r of top30) {
    console.log(`  ${r.ticker.padEnd(10)} ${r.country_iso} ${String(r.file_count).padStart(2)}  ${r.name}  [${r.matched_local_dir}]`);
  }

  // P2 list (for CONV-DATA notification).
  const p2 = rows.filter((r) => r.priority === "P2");
  const p2Path = path.join(ROOT, "scripts", "stoxx-gap", "p2-tickers.txt");
  fs.writeFileSync(p2Path, p2.map((r) => `${r.ticker}|${r.country_iso}|${r.name}`).join("\n") + "\n");
  console.log(`\nWrote ${p2Path} (${p2.length} P2 stés à scraper)`);
}

main();
