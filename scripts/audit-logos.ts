#!/usr/bin/env npx tsx
/**
 * audit-logos.ts · CONV-MODULE-LOGOS-V175
 *
 * Audit qualité des logos sur l'union V1.7 + V1.7.5 (~700-800 stés).
 * Output : `src/data/v175-logos-audit.json` avec liste des suspects par code.
 *
 * Codes défaut détectés :
 *   LOGO_MISSING        · ticker présent dans dataset, pas de PNG sur disque
 *   LOGO_TINY_FILE      · fichier < 2 KB (suspicion favicon)
 *   LOGO_SMALL_FILE     · fichier 2-5 KB (logo low-res probable)
 *   LOGO_TINY_DIMS      · dimensions < 64×64 (trop petit pour rendu Mettrik)
 *   LOGO_HASH_DUPLICATE · 2+ stés partagent le même fichier (placeholder)
 *   LOGO_RATIO_EXTREME  · ratio largeur/hauteur < 0.3 ou > 3.5
 *   LOGO_NOT_PNG        · extension PNG mais format invalide
 *
 * Note : ne peut PAS détecter "faux logo de la mauvaise société" (cas TTE.PA)
 * sans source de référence. Cette détection nécessite Phase 2 (comparaison
 * avec source officielle Clearbit/Brandfetch).
 *
 * Usage :
 *   npx tsx scripts/audit-logos.ts          # audit complet
 *   npx tsx scripts/audit-logos.ts TTE.PA   # 1 ticker spécifique
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = resolve(__dirname, "..");
const LOGOS_DIR = resolve(ROOT, "public/logos");
const OUT_PATH = resolve(ROOT, "src/data/v175-logos-audit.json");

type DefectCode =
  | "LOGO_MISSING"
  | "LOGO_TINY_FILE"
  | "LOGO_SMALL_FILE"
  | "LOGO_TINY_DIMS"
  | "LOGO_HASH_DUPLICATE"
  | "LOGO_RATIO_EXTREME"
  | "LOGO_NOT_PNG";

interface TickerLogo {
  ticker: string;
  filename: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  ratio: number | null;
  md5: string | null;
  defects: DefectCode[];
  shared_with?: string[]; // si hash duplicate, liste les autres tickers
  in_datasets: string[];   // v1-7, v1-7-5, v1-8
}

/**
 * Convertit un ticker en filename : "TTE.PA" → "TTE-PA.png", "AAPL" → "AAPL.png"
 */
function tickerToFilename(ticker: string): string {
  return ticker.replace(/\./g, "-") + ".png";
}

function loadDatasetTickers(): {
  union: string[];
  by_version: Record<string, Set<string>>;
} {
  const v17 = JSON.parse(readFileSync(resolve(ROOT, "src/data/v1-7-tickers-sorted.json"), "utf-8")) as string[];
  const v18 = JSON.parse(readFileSync(resolve(ROOT, "src/data/v1-8-tickers-sorted.json"), "utf-8")) as string[];
  const v175Raw = JSON.parse(readFileSync(resolve(ROOT, "src/data/v1-7-5-public.json"), "utf-8")) as Record<string, unknown>;
  const v175 = Object.keys(v175Raw);

  const set17 = new Set(v17);
  const set18 = new Set(v18);
  const set175 = new Set(v175);

  const allSet = new Set<string>([...v17, ...v18, ...v175]);
  return {
    union: [...allSet].sort(),
    by_version: { "v1-7": set17, "v1-7-5": set175, "v1-8": set18 },
  };
}

function getPngDimensions(filepath: string): { width: number; height: number } | null {
  try {
    // Utilise `file` commande (plus rapide que PIL via subprocess Python)
    const out = execSync(`file "${filepath}"`, { encoding: "utf-8" });
    // Match "PNG image data, 128 x 128"
    const m = out.match(/PNG image data,\s*(\d+)\s*x\s*(\d+)/);
    if (m) return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
    return null;
  } catch {
    return null;
  }
}

function md5OfFile(filepath: string): string {
  const buf = readFileSync(filepath);
  return createHash("md5").update(buf).digest("hex");
}

function auditOne(ticker: string, versions: Set<string>[]): TickerLogo {
  const filename = tickerToFilename(ticker);
  const filepath = resolve(LOGOS_DIR, filename);
  const defects: DefectCode[] = [];
  const inDatasets: string[] = [];
  const versionNames = ["v1-7", "v1-7-5", "v1-8"];
  versions.forEach((s, i) => {
    if (s.has(ticker)) inDatasets.push(versionNames[i]);
  });

  if (!existsSync(filepath)) {
    defects.push("LOGO_MISSING");
    return {
      ticker,
      filename: null,
      file_size: null,
      width: null,
      height: null,
      ratio: null,
      md5: null,
      defects,
      in_datasets: inDatasets,
    };
  }

  const stat = statSync(filepath);
  const file_size = stat.size;
  const dims = getPngDimensions(filepath);
  const md5 = md5OfFile(filepath);

  if (!dims) defects.push("LOGO_NOT_PNG");
  else {
    if (dims.width < 64 || dims.height < 64) defects.push("LOGO_TINY_DIMS");
    const ratio = dims.width / dims.height;
    if (ratio < 0.3 || ratio > 3.5) defects.push("LOGO_RATIO_EXTREME");
  }

  if (file_size < 2000) defects.push("LOGO_TINY_FILE");
  else if (file_size < 5000) defects.push("LOGO_SMALL_FILE");

  return {
    ticker,
    filename,
    file_size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    ratio: dims ? +(dims.width / dims.height).toFixed(2) : null,
    md5,
    defects,
    in_datasets: inDatasets,
  };
}

function main() {
  const argTickers = process.argv.slice(2).filter(a => !a.startsWith("-"));
  const { union, by_version } = loadDatasetTickers();
  const targets = argTickers.length > 0 ? argTickers : union;
  const versions = [by_version["v1-7"], by_version["v1-7-5"], by_version["v1-8"]];

  console.log(`[audit-logos] ${targets.length} tickers à auditer (union V1.7+V1.7.5+V1.8)`);

  const results: TickerLogo[] = [];
  for (const t of targets) {
    results.push(auditOne(t, versions));
  }

  // Détection des hash dupliqués (placeholder)
  const byHash = new Map<string, string[]>();
  for (const r of results) {
    if (!r.md5) continue;
    byHash.set(r.md5, [...(byHash.get(r.md5) ?? []), r.ticker]);
  }
  for (const r of results) {
    if (!r.md5) continue;
    const others = byHash.get(r.md5)!.filter(t => t !== r.ticker);
    if (others.length > 0) {
      r.defects.push("LOGO_HASH_DUPLICATE");
      r.shared_with = others.slice(0, 5);
    }
  }

  // Stats globales
  const byCode: Record<string, number> = {};
  let withDefects = 0;
  for (const r of results) {
    if (r.defects.length > 0) withDefects++;
    for (const c of r.defects) byCode[c] = (byCode[c] ?? 0) + 1;
  }

  // Top 10 hashs partagés (placeholders)
  const placeholders = [...byHash.entries()]
    .filter(([, ts]) => ts.length >= 3)
    .map(([h, ts]) => ({ md5: h, count: ts.length, sample: ts.slice(0, 5) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const output = {
    generated_at: new Date().toISOString(),
    total_audited: results.length,
    total_with_defects: withDefects,
    by_code: byCode,
    placeholders_top10: placeholders,
    results: results.filter(r => r.defects.length > 0),
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n=== RÉCAP audit logos ===`);
  console.log(`Total audités : ${results.length}`);
  console.log(`Avec défauts  : ${withDefects} (${Math.round((withDefects / results.length) * 100)} %)`);
  console.log(`Par code :`);
  for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code.padEnd(24)} ${n}`);
  }
  if (placeholders.length > 0) {
    console.log(`\nTop placeholders (hash partagé par ≥3 stés) :`);
    for (const p of placeholders) {
      console.log(`  ${p.md5.slice(0, 8)}…  ${p.count}× : ${p.sample.join(", ")}…`);
    }
  }
  console.log(`\nOutput : ${OUT_PATH}`);
}

main();
