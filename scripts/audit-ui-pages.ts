#!/usr/bin/env npx tsx
/**
 * audit-ui-pages.ts · CONV-MODULE-UI-AUDIT
 *
 * Auditeur léger qui visite chaque page V1.8 (`/sandbox/v1-8/<ticker>`) en local
 * (port 3000), parse le HTML brut et détecte les défauts d'affichage récurrents
 * via regex. Output : `src/data/v1-8-ui-audit.json`.
 *
 * Approche fetch-only (pas Playwright) car :
 *  - Mac fragile + RAM saturée par d'autres convs (chromium ~150 MB rejeté)
 *  - 90 % des bugs listés se détectent sur HTML brut SSR
 *  - Bugs qui demandent layout réel (overflow visuel) sont approximés par
 *    longueur de texte (heuristique).
 *
 * Codes défaut produits :
 *   UI_BAD_UNIT_NARRATIVE  · "M$" / "Mds$" sans espace dans texte narratif
 *   UI_BAD_UNIT_BS         · "B$" / "B €" / " B $" résiduels
 *   UI_PCT_NO_NBSP         · "10%" sans espace avant %
 *   UI_SUBSECTOR_EN        · sub-sector affiché en anglais
 *   UI_TAGLINE_LONG        · tagline > 90 chars (overflow probable)
 *   UI_ACRONYM_NO_TOOLTIP  · acronyme connu sans <sup> / title= / aria-label
 *   UI_RANK_MIX            · mix de "#42" et "Top 5 %" sur la même page
 *   UI_LANG_HTML_EN        · `<html lang="en">` (devrait être "fr")
 *   UI_PAGE_HTTP_ERROR     · réponse HTTP non-200
 *
 * Usage :
 *   npx tsx scripts/audit-ui-pages.ts            # top 30 (défaut)
 *   npx tsx scripts/audit-ui-pages.ts 100        # top 100
 *   npx tsx scripts/audit-ui-pages.ts all        # 305 stés V1.8
 *   npx tsx scripts/audit-ui-pages.ts NVDA AAPL  # tickers spécifiques
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const TICKERS_PATH = resolve(ROOT, "src/data/v1-8-tickers-sorted.json");
const OUTPUT_PATH = resolve(ROOT, "src/data/v1-8-ui-audit.json");
const BASE_URL = "http://127.0.0.1:3000/sandbox/v1-8";

type DefectCode =
  | "UI_BAD_UNIT_NARRATIVE"
  | "UI_BAD_UNIT_BS"
  | "UI_PCT_NO_NBSP"
  | "UI_SUBSECTOR_EN"
  | "UI_TAGLINE_LONG"
  | "UI_ACRONYM_NO_TOOLTIP"
  | "UI_RANK_MIX"
  | "UI_LANG_HTML_EN"
  | "UI_PAGE_HTTP_ERROR";

interface Defect {
  code: DefectCode;
  count: number;
  samples: string[]; // jusqu'à 3 exemples textuels
  note?: string;
}

interface TickerAudit {
  ticker: string;
  http_status: number;
  bytes: number;
  defects: Defect[];
  ms: number;
}

interface AuditOutput {
  generated_at: string;
  base_url: string;
  total_audited: number;
  total_with_defects: number;
  by_code: Record<DefectCode, number>;
  results: TickerAudit[];
}

// Acronymes Mettrik connus qui doivent porter un tooltip "i" pour FR 16 ans non-tech.
// On EXCLUT les abréviations triviales (B / M / Mds / $) et les noms propres.
const ACRONYMS = [
  "HPC", "CAGR", "TAM", "EBITDA", "ARPP", "TAC", "ABF",
  "ARR", "MRR", "GAAP", "FCF", "ROIC", "ROE", "NPS",
  "ADR", "IPO", "GICS", "GMV",
];

// Subsectors connus en EN (issus de GICS) qu'on ne veut PAS voir bruts dans l'UI.
// Liste non-exhaustive, à étendre via audit cumulatif.
const EN_SUBSECTORS_PATTERNS = [
  /Compute &amp; Networking/i,
  /Semiconductors &amp; Semiconductor Equipment/i,
  /Internet &amp; Direct Marketing Retail/i,
  /Software &amp; Services/i,
  /Capital Goods/i,
  /Health Care Equipment/i,
  /Pharmaceuticals?[ ,]/i,
  /Aerospace &amp; Defense/i,
  /Oil[, ]+Gas &amp; Consumable Fuels/i,
];

function loadTickers(): string[] {
  const raw = readFileSync(TICKERS_PATH, "utf-8");
  return JSON.parse(raw) as string[];
}

function pickTickers(arg: string[]): string[] {
  const all = loadTickers();
  if (arg.length === 0) return all.slice(0, 30);
  if (arg.length === 1 && arg[0] === "all") return all;
  if (arg.length === 1 && /^\d+$/.test(arg[0])) {
    return all.slice(0, parseInt(arg[0], 10));
  }
  return arg;
}

async function fetchPage(ticker: string): Promise<{ status: number; html: string; ms: number }> {
  const start = Date.now();
  // Encode ticker pour les symboles type 9984.T, ATCO-A.ST
  const url = `${BASE_URL}/${encodeURIComponent(ticker)}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept": "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    const html = await res.text();
    return { status: res.status, html, ms: Date.now() - start };
  } catch (err) {
    return { status: 0, html: "", ms: Date.now() - start };
  }
}

function extractTextNeighborhood(html: string, match: RegExpMatchArray, radius = 30): string {
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - radius);
  const end = Math.min(html.length, idx + (match[0]?.length ?? 0) + radius);
  return html.slice(start, end).replace(/\s+/g, " ").trim();
}

function detectDefects(ticker: string, html: string, status: number): Defect[] {
  const defects: Defect[] = [];

  if (status !== 200) {
    defects.push({
      code: "UI_PAGE_HTTP_ERROR",
      count: 1,
      samples: [`HTTP ${status}`],
    });
    return defects; // pas la peine de scanner si la page n'a pas chargé
  }

  // 1. UI_LANG_HTML_EN
  const langMatch = html.match(/<html[^>]*lang="(en|en-[A-Z]+)"/);
  if (langMatch) {
    defects.push({
      code: "UI_LANG_HTML_EN",
      count: 1,
      samples: [langMatch[0]],
      note: "balise <html> en anglais sur app FR",
    });
  }

  // 2. UI_BAD_UNIT_NARRATIVE : "60M$", "60 M$", "0.06 Mds$" (pas d'espace avant $)
  const narrUnit = [...html.matchAll(/[0-9][.,]?[0-9]* ?(?:M|Mds)\$/g)];
  if (narrUnit.length > 0) {
    defects.push({
      code: "UI_BAD_UNIT_NARRATIVE",
      count: narrUnit.length,
      samples: narrUnit.slice(0, 3).map(m => extractTextNeighborhood(html, m)),
    });
  }

  // 3. UI_BAD_UNIT_BS : "B$" residuels en valeur (pas "Mds")
  // pattern : chiffre + (espace optionnel) + B + (espace optionnel) + ($ ou €)
  // ATTENTION : "Mds$" matcherait pas car on cible juste "B" sans précédent "d"
  const bsResidual = [...html.matchAll(/(?<![A-Za-z])[0-9][.,]?[0-9]* ?B ?[\$€]/g)];
  if (bsResidual.length > 0) {
    defects.push({
      code: "UI_BAD_UNIT_BS",
      count: bsResidual.length,
      samples: bsResidual.slice(0, 3).map(m => extractTextNeighborhood(html, m)),
    });
  }

  // 4. UI_PCT_NO_NBSP : "10%" sans espace insécable
  // On compte uniquement les % AFFICHÉS dans le DOM, on ignore JS/JSON
  // Heuristique : "%" précédé d'un chiffre sans espace (ASCII ou nbsp).
  const pctNoNbsp = [...html.matchAll(/>[^<]*?[0-9]%/g)]; // % directement après digit dans texte affiché
  if (pctNoNbsp.length > 0) {
    defects.push({
      code: "UI_PCT_NO_NBSP",
      count: pctNoNbsp.length,
      samples: pctNoNbsp.slice(0, 3).map(m => extractTextNeighborhood(html, m, 15)),
      note: "convention FR : espace (idéalement nbsp) avant %",
    });
  }

  // 5. UI_SUBSECTOR_EN
  for (const pat of EN_SUBSECTORS_PATTERNS) {
    const m = html.match(pat);
    if (m) {
      defects.push({
        code: "UI_SUBSECTOR_EN",
        count: 1,
        samples: [m[0].replace(/&amp;/g, "&")],
      });
      break; // un seul subsector par sté
    }
  }

  // 6. UI_TAGLINE_LONG (heuristique overflow)
  // On cherche un élément avec class incluant "tagline" et on mesure son texte
  const taglineMatch = html.match(/class="[^"]*tagline[^"]*"[^>]*>([^<]{1,200})</);
  if (taglineMatch && taglineMatch[1].length > 90) {
    defects.push({
      code: "UI_TAGLINE_LONG",
      count: 1,
      samples: [taglineMatch[1].slice(0, 100)],
      note: `${taglineMatch[1].length} chars (>90 = risque overflow)`,
    });
  }

  // 7. UI_ACRONYM_NO_TOOLTIP
  // Pour chaque acronyme connu présent, on regarde s'il y a un tooltip "i" à proximité
  // (recherche d'un <sup>, title=, aria-label=, ou <InfoTooltip ... > près de la 1re occurrence)
  for (const ac of ACRONYMS) {
    const re = new RegExp(`>([^<]{0,3})${ac}([^<]{0,3})<`, "g");
    const matches = [...html.matchAll(re)];
    if (matches.length === 0) continue;
    // Pour la 1ère occurrence, regarde 200 chars autour pour signe de tooltip
    const m = matches[0];
    const idx = m.index ?? 0;
    const around = html.slice(Math.max(0, idx - 200), Math.min(html.length, idx + 200));
    const hasTooltip = /<sup|title="[^"]+"|aria-label="[^"]+"|InfoTooltip|info-tooltip|tooltip-trigger/.test(around);
    if (!hasTooltip) {
      defects.push({
        code: "UI_ACRONYM_NO_TOOLTIP",
        count: matches.length,
        samples: [`${ac} (${matches.length}× sans tooltip détecté)`],
      });
    }
  }

  // 8. UI_RANK_MIX : présence simultanée de "#XX" et "Top X %"
  const hashRanks = [...html.matchAll(/#[0-9]{1,4}\b/g)].length;
  const topRel = [...html.matchAll(/Top [0-9]+ %/g)].length;
  if (hashRanks > 0 && topRel > 0) {
    defects.push({
      code: "UI_RANK_MIX",
      count: hashRanks + topRel,
      samples: [`${hashRanks}× #XX et ${topRel}× Top X % sur la même page`],
    });
  }

  return defects;
}

async function auditOne(ticker: string): Promise<TickerAudit> {
  const { status, html, ms } = await fetchPage(ticker);
  const defects = detectDefects(ticker, html, status);
  return {
    ticker,
    http_status: status,
    bytes: html.length,
    defects,
    ms,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const tickers = pickTickers(args);
  console.log(`[audit-ui] ${tickers.length} tickers à auditer · base=${BASE_URL}`);

  const results: TickerAudit[] = [];
  let i = 0;
  for (const ticker of tickers) {
    i++;
    const a = await auditOne(ticker);
    results.push(a);
    const def = a.defects.length;
    const codes = a.defects.map(d => d.code).join(",");
    console.log(
      `  [${i}/${tickers.length}] ${ticker.padEnd(12)} HTTP=${a.http_status} ${a.bytes
        .toString()
        .padStart(7)} B  ${a.ms.toString().padStart(5)}ms  defects=${def} ${codes}`,
    );
    // throttle léger pour ne pas saturer le dev server
    await new Promise(r => setTimeout(r, 80));
  }

  const byCode: Record<string, number> = {};
  let withDefects = 0;
  for (const r of results) {
    if (r.defects.length > 0) withDefects++;
    for (const d of r.defects) {
      byCode[d.code] = (byCode[d.code] ?? 0) + 1;
    }
  }

  const output: AuditOutput = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    total_audited: results.length,
    total_with_defects: withDefects,
    by_code: byCode as Record<DefectCode, number>,
    results,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log("\n=== RÉCAP ===");
  console.log(`Total auditées : ${results.length}`);
  console.log(`Avec défauts   : ${withDefects} (${Math.round((withDefects / results.length) * 100)} %)`);
  console.log(`Par code :`);
  for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code.padEnd(28)} ${n}`);
  }
  console.log(`\nOutput : ${OUTPUT_PATH}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
