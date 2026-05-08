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

/**
 * Configuration par version. Permet d'auditer V1.6, V1.7, V1.8 avec le même
 * script. Exemple : `npx tsx scripts/audit-ui-pages.ts --version v1-7 30`.
 */
const VERSION_CONFIG: Record<string, { tickers: string; output: string; base: string }> = {
  "v1-6": {
    tickers: "src/data/v1-8-tickers-sorted.json", // V1.6 utilise même base sociétés
    output: "src/data/v1-6-ui-audit.json",
    base: "http://127.0.0.1:3000/sandbox/v1-6",
  },
  "v1-7": {
    tickers: "src/data/v1-8-tickers-sorted.json", // V1.7 idem
    output: "src/data/v1-7-ui-audit.json",
    base: "http://127.0.0.1:3000/sandbox/v1-7",
  },
  "v1-8": {
    tickers: "src/data/v1-8-tickers-sorted.json",
    output: "src/data/v1-8-ui-audit.json",
    base: "http://127.0.0.1:3000/sandbox/v1-8",
  },
};

let SELECTED_VERSION = "v1-8";
let TICKERS_PATH = resolve(ROOT, VERSION_CONFIG[SELECTED_VERSION].tickers);
let OUTPUT_PATH = resolve(ROOT, VERSION_CONFIG[SELECTED_VERSION].output);
let BASE_URL = VERSION_CONFIG[SELECTED_VERSION].base;

type DefectCode =
  | "UI_BAD_UNIT_NARRATIVE"
  | "UI_BAD_UNIT_BS"
  | "UI_PCT_NO_NBSP"
  | "UI_LABEL_EN"
  | "UI_TAGLINE_LONG"
  | "UI_ACRONYM_NO_TOOLTIP"
  | "UI_RANK_FORMAT_MIXED"      // ex-UI_RANK_MIX, renommé suite à ping CONV-SYSTEMS (8 mai 16h31)
  | "UI_NO_LABEL_PRICE_HEADER"  // ajouté suite à ping CONV-SYSTEMS (cas AMAT 8 mai)
  | "UI_TOGGLE_SINGLE"          // toggle à 1 seul choix (ex : Annuel sans Trimestriel)
  | "UI_FRESHNESS_LABEL_EN"     // label freshness en anglais (Recent/Fresh/Stale)
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

// Labels chip de la CompanyHeader rendus en EN dans la sandbox V1.8.
// Doivent être en FR sur l'app FR. On cible le markup `<span class="...">Label[ ...]</span>`.
const EN_LABEL_PATTERNS: { en: string; fr: string }[] = [
  { en: "Sector",     fr: "Secteur" },
  { en: "Sub-sector", fr: "Sous-secteur" },
  { en: "Founded",    fr: "Fondée" },
  { en: "Headquarters", fr: "Siège social" },
  { en: "Tagline",    fr: "Accroche" },
];
function buildLabelRegex(en: string): RegExp {
  // Cherche `<span ...>Label</span>` ou `<span ...>Label (XXX)</span>`
  const esc = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<span[^>]+>${esc}(?:\\s*\\([^<)]+\\))?</span>`, "g");
}

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

  // 5. UI_LABEL_EN — labels de chips en anglais (Sector / Sub-sector / Founded …)
  const labelHits: string[] = [];
  for (const { en } of EN_LABEL_PATTERNS) {
    const re = buildLabelRegex(en);
    const matches = [...html.matchAll(re)];
    if (matches.length > 0) labelHits.push(`${en}×${matches.length}`);
  }
  if (labelHits.length > 0) {
    defects.push({
      code: "UI_LABEL_EN",
      count: labelHits.length,
      samples: labelHits.slice(0, 5),
      note: "labels chip à traduire en FR (Sector → Secteur, etc.)",
    });
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
  // Détection restrictive : on cherche l'acronyme uniquement en isolation
  // dans une balise dédiée (chip / dt / span avec class spécifique). Évite
  // les faux positifs sur le mot "IPO" en plein texte de description.
  const flagged: string[] = [];
  for (const ac of ACRONYMS) {
    // Pattern : `>ACRONYM<` ou `>ACRONYM </` (acronyme isolé dans une balise courte).
    const re = new RegExp(`>(?:\\s)*${ac}(?:\\s)*<`, "g");
    const matches = [...html.matchAll(re)];
    if (matches.length === 0) continue;
    // On ne garde que les occurrences où la balise est étroite (chip, label).
    // On regarde 80 chars autour de chaque match pour confirmer la présence
    // d'un tooltip à proximité.
    let withoutTooltip = 0;
    for (const m of matches) {
      const idx = m.index ?? 0;
      const around = html.slice(Math.max(0, idx - 200), Math.min(html.length, idx + 200));
      if (!/<sup|title="[^"]+"|aria-label="[^"]+"|InfoTooltip|info-tooltip|tooltip-trigger/.test(around)) {
        withoutTooltip++;
      }
    }
    if (withoutTooltip > 0) {
      flagged.push(`${ac}×${withoutTooltip}`);
    }
  }
  if (flagged.length > 0) {
    defects.push({
      code: "UI_ACRONYM_NO_TOOLTIP",
      count: flagged.length,
      samples: flagged.slice(0, 5),
      note: "acronymes isolés sans tooltip 'i' à proximité",
    });
  }

  // 8. UI_RANK_FORMAT_MIXED : présence simultanée de "#XX" et "Top X %" sur même page
  // (renommé sur ping CONV-SYSTEMS 8 mai 16h31, code UI_RANK_FORMAT_MIXED demandé)
  const hashRanks = [...html.matchAll(/#[0-9]{1,4}\b/g)].length;
  const topRel = [...html.matchAll(/Top [0-9]+ %/g)].length;
  if (hashRanks > 0 && topRel > 0) {
    defects.push({
      code: "UI_RANK_FORMAT_MIXED",
      count: hashRanks + topRel,
      samples: [`${hashRanks}× #XX absolu et ${topRel}× Top X % relatif sur la même page`],
      note: "choisir UNE convention de rang (absolu OU relatif) et la garder",
    });
  }

  // 9. UI_NO_LABEL_PRICE_HEADER : 3 valeurs chiffrées (capi / variation / prix) côte
  // à côte sans label sémantique. Heuristique : on cherche dans un même bloc de
  // ~400 chars, 3 occurrences de valeurs format `<nombre>+<devise/%>`, sans mot
  // français étiquette ("Capitalisation", "Variation", "Prix", "Cours") entre.
  // Cas concret AMAT 8 mai : "326 Mds $", "-4,19 %", "410,64 $" sans étiquette.
  const labelKeywords = /Capitalisation|Variation|Prix|Cours|Capi[. ]/i;
  // Capture seulement les valeurs AFFICHÉES (entre `>` et `<`), pas dans
  // les attributs style="width:80%" ou similaires.
  const valueRe = /(?<=>)\s*[0-9][.,]?[0-9]{0,4}\s?(?:Mds\s\$|Mds\s€|M\s\$|M\s€|\$|€|%)\s*(?=<)/g;
  const allValues = [...html.matchAll(valueRe)];
  let priceHeaderHit = false;
  for (let i = 0; i < allValues.length - 2; i++) {
    const a = allValues[i];
    const c = allValues[i + 2];
    const span = (c.index ?? 0) - (a.index ?? 0);
    if (span > 0 && span < 400) {
      const window = html.slice(a.index ?? 0, (c.index ?? 0) + (c[0]?.length ?? 0));
      // Si le bloc ne contient AUCUN mot-clé étiquette FR → probablement bug
      if (!labelKeywords.test(window)) {
        priceHeaderHit = true;
        defects.push({
          code: "UI_NO_LABEL_PRICE_HEADER",
          count: 3,
          samples: [`${a[0]} ... ${allValues[i + 1][0]} ... ${c[0]} (sans label)`],
          note: "3 valeurs chiffrées côte à côte sans étiquette Capi/Variation/Prix",
        });
        break;
      }
    }
  }
  void priceHeaderHit; // marker

  // 10. UI_TOGGLE_SINGLE : "Annuel" présent en tant que bouton/onglet, mais pas
  // "Trimestriel" / "Trim." / "TTM". Heuristique côté SSR : cherche `>Annuel<`
  // (texte de bouton, pas mention dans phrase) sans `>Trim` / `>TTM` à proximité.
  const annuelBtn = [...html.matchAll(/>Annuel</g)];
  if (annuelBtn.length > 0) {
    const trimBtn = /(>Trim|>TTM|>Trimestriel)/.test(html);
    if (!trimBtn) {
      defects.push({
        code: "UI_TOGGLE_SINGLE",
        count: 1,
        samples: ["Annuel présent sans Trimestriel/Trim/TTM"],
        note: "toggle à 1 seul choix → devrait être hidden ou compléter avec quarterly data",
      });
    }
  }

  // 11. UI_FRESHNESS_LABEL_EN : labels Recent / Fresh / Stale en anglais
  // (le composant FreshnessIndicator les affiche en EN actuellement, devraient
  // être "Récent" / "À jour" / "Périmé").
  const freshnessHits: string[] = [];
  for (const en of ["Recent", "Fresh", "Stale", "Unknown"]) {
    // Cherche balise courte `>Recent<` ou `>Recent\W` (label de chip)
    const re = new RegExp(`>${en}(?=[<\\s])`, "g");
    const matches = [...html.matchAll(re)];
    if (matches.length > 0) freshnessHits.push(`${en}×${matches.length}`);
  }
  if (freshnessHits.length > 0) {
    defects.push({
      code: "UI_FRESHNESS_LABEL_EN",
      count: freshnessHits.length,
      samples: freshnessHits,
      note: "labels FreshnessIndicator à traduire FR (Recent → Récent, Fresh → À jour, Stale → Périmé)",
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
  let args = process.argv.slice(2);
  // Parse --version <key>
  const vIdx = args.indexOf("--version");
  if (vIdx >= 0) {
    const v = args[vIdx + 1];
    if (!VERSION_CONFIG[v]) {
      console.error(`Version inconnue : ${v}. Choix : ${Object.keys(VERSION_CONFIG).join(", ")}`);
      process.exit(1);
    }
    SELECTED_VERSION = v;
    TICKERS_PATH = resolve(ROOT, VERSION_CONFIG[v].tickers);
    OUTPUT_PATH = resolve(ROOT, VERSION_CONFIG[v].output);
    BASE_URL = VERSION_CONFIG[v].base;
    args = [...args.slice(0, vIdx), ...args.slice(vIdx + 2)];
  }
  const tickers = pickTickers(args);
  console.log(`[audit-ui] version=${SELECTED_VERSION} · ${tickers.length} tickers à auditer · base=${BASE_URL}`);

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
