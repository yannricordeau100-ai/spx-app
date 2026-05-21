#!/usr/bin/env node
/**
 * Classifie les 236 stés KO sur critère a_hero_history :
 *   - quarterly_short  : period=quarter & len<18  → extension data 10-Q needed
 *   - annual_short     : period=annual/year & len<5 → extension data 10-K older needed
 *   - trop_recent_legitimate : KPI lancé récemment (<5 ans réels dans filings)
 *   - fatal_no_hero    : hero_kpi introuvable dans kpis[]
 *
 * Heuristiques "trop_recent_legitimate" :
 *   - Hero name match patterns AI / GenAI / Cloud AI Titans
 *   - Ticker IPO >= 2021 (post-IPO < 5 ans réels)
 *   - Hero name match patterns service / ARR launched recently (Vision Pro, Service ARR, etc.)
 *   - Hero name explicit "Bookings AI", "AI Bookings", "AI Ad Revenue"
 *
 * Output :
 *   - src/data/v1-9-hero-history-classification.json (objet par ticker)
 *   - Tagge v2-pipeline-enrich/<ticker>.json avec kpi.is_short_history_legitimate=true
 *     UNIQUEMENT pour les "trop_recent_legitimate"
 *
 * Usage : node scripts/classify-v1-9-hero-history.js
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA = path.join(REPO, 'src/data');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function lower(s) {
  return String(s || '').toLowerCase();
}

const CURRENT_YEAR = 2026;

// Patterns "trop récent légitime" : KPI dont l'existence dans les filings est
// objectivement < 5 ans (IPO récente, segment AI nouveau, produit lancé récemment).
const RECENT_KPI_PATTERNS = [
  // AI / GenAI explicit
  { rx: /\bai\s*(ad|bookings|revenue|compute|capacity|titans)\b/i, reason: 'KPI AI explicit launched <5 ans' },
  { rx: /\bgenerative\s*ai\b/i, reason: 'GenAI KPI launched <5 ans' },
  { rx: /\bcloud\s+and\s+ai\b/i, reason: 'Cloud+AI Titans KPI (post-2023)' },
  // Service ARR récents
  { rx: /\b(vision\s*pro|apple\s*intelligence)\b/i, reason: 'Apple Vision/Intelligence launched 2024' },
  // Specific drug / product launches récents (post-2020)
  { rx: /\bvyvgart\b/i, reason: 'VYVGART launched 2021 (argenx)' },
  { rx: /\belevidys\b/i, reason: 'ELEVIDYS launched 2023 (Sarepta)' },
  { rx: /\bmounjaro|zepbound\b/i, reason: 'Mounjaro/Zepbound launched 2022' },
  { rx: /\bwegovy\b/i, reason: 'Wegovy GLP-1 launched 2021 (Novo)' },
  { rx: /\bdupixent\b/i, reason: 'Dupixent expanded indications post-2020' },
];

// Hero KPI rename "récent" : segments splittés/réorganisés récemment
// (donc history pre-2021 indisponible structurellement)
const STRUCTURAL_RECENT_PATTERNS = [
  { rx: /\belectrification\s*(revenue|segment)?$/i, reason: 'Segment Electrification créé 2023 (ABB/Schneider)' },
  { rx: /\bdata\s*center\s*revenue$/i, reason: 'Segment Data Center disclosed séparément depuis 2022' },
];

function ipoYear(company) {
  const ipo = company && company.ipo;
  if (!ipo) return null;
  const m = String(ipo).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function loadCompany(ticker) {
  const candidates = [
    path.join(DATA, 'v1-9-complete', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline', `${ticker.toLowerCase()}.json`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const d = readJson(p);
      if (d) return { data: d, path: p };
    }
  }
  return { data: null, path: null };
}

function findHeroKpi(company) {
  if (!company || !Array.isArray(company.kpis)) return null;
  const heroName = company.hero_kpi;
  if (!heroName) return null;
  const norm = (s) => lower(s).trim();
  return (
    company.kpis.find((k) => norm(k.short) === norm(heroName)) ||
    company.kpis.find((k) => norm(k.name_en) === norm(heroName)) ||
    company.kpis.find((k) => norm(k.name_fr) === norm(heroName)) ||
    null
  );
}

function classifyTicker(audit) {
  const ticker = audit.ticker;
  const a = audit.criteria.a_hero_history;

  // Fatal : hero introuvable
  if (a.fatal) {
    return {
      ticker,
      classification: 'fatal_no_hero',
      reason: a.reason || 'hero_kpi introuvable',
    };
  }

  const len = a.len ?? 0;
  const period = a.period || 'year';
  const isQuarter = period === 'quarter';
  const isSemester = period === 'semester' || period === 'half';

  // Load company data pour heuristique
  const { data: company } = loadCompany(ticker);
  const hero = findHeroKpi(company);
  const heroName = (hero && (hero.short || hero.name_en || hero.name_fr)) || company?.hero_kpi || '';
  const ipo = ipoYear(company);

  // Test patterns "trop récent légitime"
  const legitimateMatch =
    RECENT_KPI_PATTERNS.find((p) => p.rx.test(heroName)) ||
    STRUCTURAL_RECENT_PATTERNS.find((p) => p.rx.test(heroName));
  let postIpoLegitimate = null;
  if (ipo && ipo >= 2021 && len >= 3 && CURRENT_YEAR - ipo < 5) {
    postIpoLegitimate = { reason: `IPO ${ipo} (<5 ans réels)` };
  }

  if (legitimateMatch || postIpoLegitimate) {
    return {
      ticker,
      classification: 'trop_recent_legitimate',
      hero_name: heroName,
      ipo,
      period,
      len,
      reason:
        (legitimateMatch && legitimateMatch.reason) ||
        (postIpoLegitimate && postIpoLegitimate.reason) ||
        'KPI lancé récemment',
    };
  }

  // Sinon : c'est une vraie extension data à demander
  if (isQuarter) {
    return {
      ticker,
      classification: 'quarterly_short',
      hero_name: heroName,
      ipo,
      period,
      len,
      target: 18,
      gap: 18 - len,
      reason: `quarterly history ${len}<18 → extension via 10-Q`,
    };
  }
  if (isSemester) {
    return {
      ticker,
      classification: 'semester_short',
      hero_name: heroName,
      ipo,
      period,
      len,
      target: 8,
      gap: 8 - len,
      reason: `semester history ${len}<8 → extension via half-year`,
    };
  }
  return {
    ticker,
    classification: 'annual_short',
    hero_name: heroName,
    ipo,
    period,
    len,
    target: 5,
    gap: 5 - len,
    reason: `annual history ${len}<5 → extension via older annual reports`,
  };
}

function tagShortHistoryLegitimate(ticker, reason) {
  // Patche v2-pipeline-enrich/<ticker>.json + v2-pipeline/<ticker>.json
  // pour ajouter is_short_history_legitimate=true sur le hero KPI.
  const candidates = [
    path.join(DATA, 'v2-pipeline-enrich', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline-enrich', `${ticker.toLowerCase()}.json`),
    path.join(DATA, 'v2-pipeline', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline', `${ticker.toLowerCase()}.json`),
    path.join(DATA, 'v1-9-complete', `${ticker}.json`),
  ];
  let written = 0;
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const d = readJson(p);
    if (!d || !Array.isArray(d.kpis)) continue;
    const heroName = d.hero_kpi;
    if (!heroName) continue;
    const norm = (s) => lower(s).trim();
    const hero = d.kpis.find(
      (k) =>
        norm(k.short) === norm(heroName) ||
        norm(k.name_en) === norm(heroName) ||
        norm(k.name_fr) === norm(heroName)
    );
    if (!hero) continue;
    if (hero.is_short_history_legitimate === true && hero.short_history_legitimate_reason === reason) {
      continue; // déjà tagué, idempotent
    }
    hero.is_short_history_legitimate = true;
    hero.short_history_legitimate_reason = reason;
    writeJson(p, d);
    written += 1;
  }
  return written;
}

function main() {
  const auditPath = path.join(DATA, 'v1-9-pre-publication-audit.json');
  const audit = readJson(auditPath);
  if (!audit) {
    console.error('Cannot read', auditPath);
    process.exit(1);
  }

  const ko = audit.audits.filter((x) => x.failed_criteria.includes('a_hero_history'));
  console.log(`Classification de ${ko.length} stés KO sur a_hero_history…`);

  const classifications = {};
  const buckets = {
    quarterly_short: [],
    semester_short: [],
    annual_short: [],
    trop_recent_legitimate: [],
    fatal_no_hero: [],
  };

  for (const a of ko) {
    const c = classifyTicker(a);
    classifications[c.ticker] = c;
    if (buckets[c.classification]) buckets[c.classification].push(c);
  }

  // Tag is_short_history_legitimate
  let taggedFiles = 0;
  for (const c of buckets.trop_recent_legitimate) {
    taggedFiles += tagShortHistoryLegitimate(c.ticker, c.reason);
  }

  // Stats
  const totalPublishable = audit.publishable_count_input;
  const totalLegit = buckets.trop_recent_legitimate.length;
  const legitPctOfPublishable = ((totalLegit / totalPublishable) * 100).toFixed(2);

  const output = {
    generated_at: new Date().toISOString(),
    summary: {
      total_a_hero_history_ko: ko.length,
      quarterly_short: buckets.quarterly_short.length,
      semester_short: buckets.semester_short.length,
      annual_short: buckets.annual_short.length,
      trop_recent_legitimate: totalLegit,
      fatal_no_hero: buckets.fatal_no_hero.length,
      publishable_input: totalPublishable,
      legitimate_pct_of_publishable: Number(legitPctOfPublishable),
      legitimate_under_21pct_cap: Number(legitPctOfPublishable) < 21,
      tagged_files_written: taggedFiles,
    },
    buckets,
    classifications,
  };

  const outPath = path.join(DATA, 'v1-9-hero-history-classification.json');
  writeJson(outPath, output);
  console.log('\nClassification écrite :', path.relative(REPO, outPath));
  console.log('\nSummary :');
  console.log(JSON.stringify(output.summary, null, 2));

  // Liste stés à notifier CONV-DATA pour extension data
  const extensionList = [
    ...buckets.quarterly_short.map((c) => ({ ticker: c.ticker, kind: 'quarterly', gap: c.gap, hero: c.hero_name })),
    ...buckets.annual_short.map((c) => ({ ticker: c.ticker, kind: 'annual', gap: c.gap, hero: c.hero_name })),
    ...buckets.semester_short.map((c) => ({ ticker: c.ticker, kind: 'semester', gap: c.gap, hero: c.hero_name })),
  ];
  const extPath = path.join(DATA, 'v1-9-hero-history-extension-needed.json');
  writeJson(extPath, {
    generated_at: new Date().toISOString(),
    total: extensionList.length,
    extensions: extensionList,
  });
  console.log('Extension list :', path.relative(REPO, extPath));
}

main();
