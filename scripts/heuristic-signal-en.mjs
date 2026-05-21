#!/usr/bin/env node
/**
 * Heuristic signal_en filler — NON-LLM.
 *
 * Cible la coverage signal_en pour tous les KPIs sans signal EN.
 * Génère un signal court (1 phrase analyse type "Strong growth, robust momentum")
 * à partir du yoy + type du KPI.
 *
 * Logique :
 *   1. Parse yoy field ("+12.5%", "-3.2%", "+12pts", "+12 pts")
 *   2. Détecte type (Margin / Revenue / Cost / Cash / etc) depuis kpi.type ou short
 *   3. Génère signal_en :
 *      - Si yoy + type connus : template raffiné par type
 *      - Si yoy seul : template générique par bucket
 *      - Si ni yoy parsable ni type : SKIP (laissé à cron LLM)
 *
 * Source de KPIs :
 *   - src/data/v2-pipeline/*.json
 *   - src/data/v2-pipeline-enrich/*.json
 *
 * Skip les fichiers annexes (.i18n. / .events. / .ranks. / .description.
 * / .ai-pos. / .quarterly-history. / .gemini. / _*).
 *
 * Pas de réseau, pas de LLM, déterministe. Idempotent.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const DIRS = [
  path.join(ROOT, 'src/data/v2-pipeline'),
  path.join(ROOT, 'src/data/v2-pipeline-enrich'),
];

const SKIP_TAGS = [
  '.i18n.',
  '.events.',
  '.ranks.',
  '.description.',
  '.ai-pos.',
  '.quarterly-history.',
  '.gemini.',
];

/* -------------------------------------------------------------------------- */
/*                              YOY PARSING                                   */
/* -------------------------------------------------------------------------- */

/**
 * Parse yoy field into a number (percent value).
 * Returns { value: number, unit: 'pct'|'pts' } or null if unparsable.
 * Examples:
 *   "+12.5%"  -> { value: 12.5, unit: 'pct' }
 *   "-3.2%"   -> { value: -3.2, unit: 'pct' }
 *   "+12pts"  -> { value: 12, unit: 'pts' }
 *   "+12 pts" -> { value: 12, unit: 'pts' }
 *   "stable"  -> { value: 0, unit: 'pct' }   (treated as ~0%)
 *   "N/A"     -> null
 */
function parseYoy(yoy) {
  if (yoy === null || yoy === undefined) return null;
  const s = String(yoy).trim();
  if (!s) return null;

  // Reject obvious non-values
  const lower = s.toLowerCase();
  const noDataMarkers = [
    'n/a', 'na', 'n.a.', 'n.d.', 'nd', 'null',
    'non disponible', 'not available', 'not disponible',
    'unknown', 'inconnu', 'non spécifié', 'non specifie',
    '...', '—', '-',
    'pas de variation trouvée', "pas d'information trouvée",
    'aucune information trouvée',
    '+x%', '-x%', 'x%',
    '+n/a', '-n/a', '+na', '-na',
    'new', 'nouveau',
  ];
  if (noDataMarkers.includes(lower)) return null;

  // "stable" / "Stable" → treat as ~0%
  if (lower === 'stable') return { value: 0, unit: 'pct' };

  // Check for "pts" / "pp" → percentage points
  const isPts = /\b(pts?|pp)\b/i.test(s);

  // Extract first numeric value
  const m = s.match(/([-+]?\d+(?:[.,]\d+)?)/);
  if (!m) return null;

  const num = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(num)) return null;

  return { value: num, unit: isPts ? 'pts' : 'pct' };
}

/* -------------------------------------------------------------------------- */
/*                              TYPE DETECTION                                */
/* -------------------------------------------------------------------------- */

/**
 * Normalize the KPI type to a canonical bucket.
 * Returns one of: 'margin' | 'revenue' | 'cost' | 'user' | 'backlog'
 *                 | 'cashflow' | 'dividend' | 'cash' | 'capital'
 *                 | 'balance' | 'risk' | 'profitability' | 'demand'
 *                 | 'mix' | 'engagement' | 'pipeline' | 'adoption'
 *                 | 'capacity' | 'return' | 'recurring' | 'operational'
 *                 | 'investment' | null
 */
function detectType(kpi) {
  const rawType = (kpi.type || '').toString().trim().toLowerCase();
  const short = (kpi.short || '').toString().toLowerCase();
  const nameEn = (kpi.name_en || '').toString().toLowerCase();
  const nameFr = (kpi.name_fr || '').toString().toLowerCase();
  const combined = `${short} ${nameEn} ${nameFr}`;

  // 1) Direct type field
  if (rawType) {
    if (rawType.includes('margin')) return 'margin';
    if (rawType === 'revenue' || rawType.includes('revenue')) return 'revenue';
    if (rawType === 'cost' || rawType.includes('cost')) return 'cost';
    if (rawType === 'user' || rawType.includes('user')) return 'user';
    if (rawType === 'backlog' || rawType.includes('backlog')) return 'backlog';
    if (rawType === 'cash flow' || rawType === 'cashflow' || rawType.includes('cash flow')) return 'cashflow';
    if (rawType === 'dividend' || rawType === 'dividende' || rawType.includes('dividend')) return 'dividend';
    if (rawType === 'cash' || rawType.includes('cash')) return 'cash';
    if (rawType === 'capital' || rawType.includes('capital')) return 'capital';
    if (rawType === 'balance sheet' || rawType.includes('balance')) return 'balance';
    if (rawType === 'risk' || rawType.includes('risk')) return 'risk';
    if (rawType === 'profitability' || rawType === 'profit') return 'profitability';
    if (rawType === 'demand' || rawType.includes('demand')) return 'demand';
    if (rawType === 'mix') return 'mix';
    if (rawType === 'engagement') return 'engagement';
    if (rawType === 'pipeline') return 'pipeline';
    if (rawType === 'adoption') return 'adoption';
    if (rawType === 'capacity') return 'capacity';
    if (rawType === 'return') return 'return';
    if (rawType === 'recurring') return 'recurring';
    if (rawType === 'operational') return 'operational';
    if (rawType === 'investment') return 'investment';
  }

  // 2) Inference from short / name
  if (/\bmargin\b|marge/.test(combined)) return 'margin';
  if (/\brevenue\b|sales\b|chiffre.d.affaires/.test(combined)) return 'revenue';
  if (/\bbacklog\b|carnet.de.commande/.test(combined)) return 'backlog';
  if (/\bdps\b|dividend|dividende/.test(combined)) return 'dividend';
  if (/\bfcf\b|free.cash.flow/.test(combined)) return 'cashflow';
  if (/\busers?\b|\bdau\b|\bmau\b|abonn|subscribers?/.test(combined)) return 'user';
  if (/\bopex\b|\bcapex\b|expenses?|cost\b/.test(combined)) return 'cost';

  return null;
}

/* -------------------------------------------------------------------------- */
/*                              SIGNAL TEMPLATES                              */
/* -------------------------------------------------------------------------- */

/**
 * Generic templates by yoy bucket (when no type info).
 */
function genericSignal(yoyValue, isPts) {
  // For percentage points: similar thresholds but interpretation slightly different
  if (yoyValue > 20) return 'Strong growth, robust momentum';
  if (yoyValue > 10) return 'Solid expansion, positive trajectory';
  if (yoyValue > 5) return 'Steady growth, healthy trend';
  if (yoyValue > 0) return 'Moderate growth, slightly positive';
  if (yoyValue === 0) return 'Flat year-over-year, monitor closely';
  if (yoyValue > -5) return 'Stable, slight decline to monitor';
  if (yoyValue > -10) return 'Pressure, deteriorating trend';
  return 'Significant decline, warning signal';
}

/**
 * Refined templates by (type, direction).
 */
function typedSignal(type, yoyValue, isPts) {
  const positive = yoyValue > 0;
  const negative = yoyValue < 0;
  const strongPositive = yoyValue > 10;
  const strongNegative = yoyValue < -10;

  switch (type) {
    case 'margin':
      if (positive) return 'Margin expansion, operating leverage';
      if (negative) return 'Margin compression, watch profitability';
      return 'Margin stable, monitor cost dynamics';

    case 'revenue':
      if (strongPositive) return 'Strong top-line growth, market traction';
      if (positive) return 'Top-line growth, market traction';
      if (strongNegative) return 'Significant revenue decline, warning signal';
      if (negative) return 'Revenue pressure, demand softening';
      return 'Revenue stable, monitor outlook';

    case 'cost':
      if (positive) return 'Cost pressure, investment phase';
      if (negative) return 'Cost discipline, efficiency gains';
      return 'Cost base stable';

    case 'user':
    case 'adoption':
      if (strongPositive) return 'Adoption accelerating, user base expanding';
      if (positive) return 'User base expansion, adoption building';
      if (negative) return 'User base contraction, monitor churn';
      return 'User base stable';

    case 'backlog':
    case 'pipeline':
      if (positive) return 'Forward visibility increasing, pipeline strengthening';
      if (negative) return 'Pipeline contraction, future revenue at risk';
      return 'Pipeline stable, monitor conversion';

    case 'cashflow':
      if (positive) return 'Cash generation improving, financial flexibility rising';
      if (negative) return 'Cash generation deteriorating, monitor liquidity';
      return 'Cash flow stable';

    case 'dividend':
      if (positive) return 'Shareholder returns growing, dividend policy supportive';
      if (negative) return 'Dividend cut risk, monitor payout sustainability';
      return 'Dividend stable, payout consistent';

    case 'cash':
      if (positive) return 'Cash position strengthening, balance-sheet flexibility';
      if (negative) return 'Cash position eroding, monitor liquidity';
      return 'Cash position stable';

    case 'profitability':
    case 'return':
      if (positive) return 'Profitability improving, returns strengthening';
      if (negative) return 'Profitability under pressure, monitor returns';
      return 'Profitability stable';

    case 'capital':
    case 'balance':
      if (positive) return 'Capital base expanding, balance-sheet growth';
      if (negative) return 'Capital base contracting, monitor structure';
      return 'Capital base stable';

    case 'demand':
      if (positive) return 'Demand strengthening, end-market traction';
      if (negative) return 'Demand softening, monitor end-markets';
      return 'Demand stable';

    case 'engagement':
      if (positive) return 'Engagement rising, user behavior improving';
      if (negative) return 'Engagement declining, monitor retention';
      return 'Engagement stable';

    case 'capacity':
      if (positive) return 'Capacity expanding, future growth supported';
      if (negative) return 'Capacity contraction, monitor utilization';
      return 'Capacity stable';

    case 'recurring':
      if (positive) return 'Recurring base growing, revenue visibility rising';
      if (negative) return 'Recurring base eroding, monitor retention';
      return 'Recurring base stable';

    case 'mix':
      if (positive) return 'Mix improving, premiumization underway';
      if (negative) return 'Mix deteriorating, monitor pricing power';
      return 'Mix stable';

    case 'operational':
    case 'investment':
    case 'risk':
      // Fall through to generic
      return genericSignal(yoyValue, isPts);

    default:
      return genericSignal(yoyValue, isPts);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 FILE WALK                                  */
/* -------------------------------------------------------------------------- */

function isMainPipelineFile(filename) {
  if (filename.startsWith('_')) return false;
  for (const tag of SKIP_TAGS) {
    if (filename.includes(tag)) return false;
  }
  return filename.endsWith('.json');
}

function listFiles() {
  const all = [];
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const names = fs.readdirSync(dir);
    for (const n of names) {
      if (!isMainPipelineFile(n)) continue;
      all.push(path.join(dir, n));
    }
  }
  return all;
}

/* -------------------------------------------------------------------------- */
/*                                   MAIN                                     */
/* -------------------------------------------------------------------------- */

function main() {
  const files = listFiles();
  console.log(`Scanning ${files.length} pipeline files...`);

  let totalKpis = 0;
  let alreadyHasEn = 0;
  let filledTyped = 0;
  let filledGeneric = 0;
  let skipNoYoy = 0;
  let skipNoData = 0;
  let filesChanged = 0;

  const samples = [];
  const SEEN_TEMPLATES = new Set();

  for (const f of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      continue;
    }
    if (!data || !Array.isArray(data.kpis)) continue;

    let changed = false;
    for (const k of data.kpis) {
      totalKpis += 1;
      if (k.signal_en && String(k.signal_en).trim().length > 0) {
        alreadyHasEn += 1;
        continue;
      }

      const parsed = parseYoy(k.yoy);
      if (!parsed) {
        skipNoYoy += 1;
        continue;
      }

      const type = detectType(k);
      let signal;
      let source;
      if (type) {
        signal = typedSignal(type, parsed.value, parsed.unit === 'pts');
        source = `typed:${type}`;
        filledTyped += 1;
      } else {
        signal = genericSignal(parsed.value, parsed.unit === 'pts');
        source = 'generic';
        filledGeneric += 1;
      }

      if (!signal) {
        skipNoData += 1;
        continue;
      }

      k.signal_en = signal;
      changed = true;

      // Sample diversity: keep up to 10 samples covering different templates
      if (samples.length < 10 && !SEEN_TEMPLATES.has(signal)) {
        SEEN_TEMPLATES.add(signal);
        samples.push({
          file: path.basename(f),
          short: k.short,
          yoy: k.yoy,
          type: k.type || '(inferred)',
          source,
          signal_en: signal,
        });
      }
    }

    if (changed) {
      fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
      filesChanged += 1;
    }
  }

  const beforeEn = alreadyHasEn;
  const afterEn = alreadyHasEn + filledTyped + filledGeneric;

  console.log('\n=== Heuristic signal_en — Stats ===');
  console.log(`Total KPIs scanned        : ${totalKpis}`);
  console.log(`Already had signal_en     : ${alreadyHasEn} (${pct(alreadyHasEn, totalKpis)}%)`);
  console.log(`Filled via typed template : ${filledTyped}`);
  console.log(`Filled via generic        : ${filledGeneric}`);
  console.log(`Skipped (no yoy parsable) : ${skipNoYoy}`);
  console.log(`Skipped (no data)         : ${skipNoData}`);
  console.log(`Files changed             : ${filesChanged}`);
  console.log('');
  console.log(`Coverage before : ${beforeEn}/${totalKpis} (${pct(beforeEn, totalKpis)}%)`);
  console.log(`Coverage after  : ${afterEn}/${totalKpis} (${pct(afterEn, totalKpis)}%)`);
  console.log(`Delta           : +${afterEn - beforeEn} KPIs (+${pct(afterEn - beforeEn, totalKpis)} pts)`);
  console.log('');
  console.log('=== Sample 10 signaux générés (templates différents) ===');
  for (const s of samples) {
    console.log(`- [${s.source}] ${s.file} :: "${s.short}" (yoy=${s.yoy}, type=${s.type})`);
    console.log(`    → ${s.signal_en}`);
  }
}

function pct(n, d) {
  if (!d) return '0.00';
  return ((100 * n) / d).toFixed(2);
}

main();
