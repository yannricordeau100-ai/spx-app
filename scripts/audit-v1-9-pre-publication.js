#!/usr/bin/env node
/**
 * Audit V1.9 pré-publication.
 *
 * Vérifie chaque sté du publishable actuel (src/data/v1-9-publishable.json) contre
 * les critères tacites Yann (21 mai 2026) :
 *
 *   a) Hero graph ≥ 5 ans :
 *      - period_type=year   → history.length ≥ 5
 *      - period_type=quarter→ history.length ≥ 18
 *      - period_type=semester→history.length ≥ 8
 *      - Exception : si KPI trop récent (KPI dispo < 5 ans dans filings),
 *        on tolère 3 ans (annuel) / 10 trims / 4 sem. Stat globale doit
 *        rester ≤ 21 % de KPIs courts sur l'app.
 *
 *   b) Bloc Interprétation 4 sous-blocs (Lead / Moteur / Vigilance / Surveillance) :
 *      L'interp est buildée runtime via interpretStructured(company). On audit
 *      sa "buildabilité" : présence d'un hero KPI utilisable + au moins 1 driver
 *      (Demand/User/Adoption/Revenue/...) + au moins 1 KPI de risque-style (Cost ↑
 *      ou Margin ↓ — sinon bloc Vigilance vide). Bloc Surveillance = future watch
 *      reste systématique. Si <2 sous-blocs candidates → fail.
 *
 *   c) Indicateurs clés : ≥ 5 KPIs (kpis.length). Si market_cap > 100 Mds USD → 8+.
 *
 *   d) Stories : ≥ 5 stories (kpis_story.length OU stories_kpis.length). Si market_cap
 *      > 10 Mds USD → 8+. Plafond 20.
 *
 *   e) Risks : ≥ 3 risks. Chaque risk doit avoir score (1-5) + score_rationale.
 *      Vérif présence d'un sous-bloc profit_warning (dans risks ou racine).
 *
 *   f) Répartition CA :
 *      - revenue_by_segment.slices ≥ 1 et revenue_by_geography.slices ≥ 1
 *      - Chaque slice doit avoir value entre 1 et 999 (virgule autorisée < 10),
 *        avec une unité parsable (Mds $, M €, etc.)
 *      - Chaque slice doit avoir share_pct (calculable depuis value/sum si manquant)
 *
 * Extensions (signalées en _extension_failed, séparées de a-f) :
 *   g) governance complète (ceo_name, ceo_total_comp_m, board_size, voting_structure,
 *      top_capital, top_voting non vides)
 *   h) ai_positioning (stance + evidence ≥ 3)
 *   i) events ≥ 4
 *   j) company_description ≥ 100 chars
 *   k) ranks (global_world, global_us, sector, subsector) non tous "#1" (sauf si vrai)
 *   l) hero KPI a name_fr
 *   m) last_data_date < 12 mois
 *
 * Output:
 *   src/data/v1-9-pre-publication-audit.json
 *
 * Usage:
 *   node scripts/audit-v1-9-pre-publication.js
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DATA = path.join(REPO, 'src/data');

// ---------------------------------------------------------------------------
// Helpers

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function lower(t) {
  return String(t || '').toLowerCase();
}

function loadCompany(ticker) {
  // Charge depuis v1-9-complete (priorité) + merge avec v2-pipeline / v2-pipeline-enrich
  // pour les champs manquants (profit_warning, stories_kpis EN, etc.). Replicate
  // grossièrement la logique de load-company.ts.
  const sources = [];
  const completePath = path.join(DATA, 'v1-9-complete', `${ticker}.json`);
  const v2Path = path.join(DATA, 'v2-pipeline', `${ticker}.json`);
  const v2PathLower = path.join(DATA, 'v2-pipeline', `${lower(ticker)}.json`);
  const enrichPath = path.join(DATA, 'v2-pipeline-enrich', `${ticker}.json`);
  const enrichPathLower = path.join(DATA, 'v2-pipeline-enrich', `${lower(ticker)}.json`);

  let merged = null;
  for (const c of [completePath, v2Path, v2PathLower]) {
    if (fs.existsSync(c)) {
      const d = readJson(c);
      if (d) {
        sources.push(path.relative(REPO, c));
        merged = merged ? { ...d, ...merged } : { ...d };
        // Strategy : keep first-found values (v1-9-complete prioritaire),
        // mais ajouter les champs absents depuis sources suivantes
        if (d.profit_warning && !merged.profit_warning) merged.profit_warning = d.profit_warning;
        if (d.stories_kpis && (!merged.stories_kpis || merged.stories_kpis.length === 0)) {
          merged.stories_kpis = d.stories_kpis;
        }
        if (d.kpis_story && (!merged.kpis_story || merged.kpis_story.length === 0)) {
          merged.kpis_story = d.kpis_story;
        }
        if (d.revenue_by_geography && !merged.revenue_by_geography) {
          merged.revenue_by_geography = d.revenue_by_geography;
        }
        if (d.revenue_by_segment && !merged.revenue_by_segment) {
          merged.revenue_by_segment = d.revenue_by_segment;
        }
        // market_positions = source pour la catégorie "Marché" du bloc Stories
        if (Array.isArray(d.market_positions) && (!Array.isArray(merged.market_positions) || merged.market_positions.length === 0)) {
          merged.market_positions = d.market_positions;
        }
        // kpis[] : si la source courante a plus de KPIs (utile quand v2-pipeline
        // contient l'enrichment is_short_history que v1-9-complete n'a pas)
        if (Array.isArray(d.kpis) && (!Array.isArray(merged.kpis) || merged.kpis.length === 0)) {
          merged.kpis = d.kpis;
        }
      }
    }
  }
  for (const c of [enrichPath, enrichPathLower]) {
    if (fs.existsSync(c)) {
      const d = readJson(c);
      if (d) {
        sources.push(path.relative(REPO, c));
        // Enrich ne touche que les champs vides côté merged
        if (merged) {
          if (d.profit_warning && !merged.profit_warning) merged.profit_warning = d.profit_warning;
          if (d.events && (!merged.events || merged.events.length === 0)) merged.events = d.events;
          if (d.governance && !merged.governance) merged.governance = d.governance;
          if (Array.isArray(d.market_positions) && (!Array.isArray(merged.market_positions) || merged.market_positions.length === 0)) {
            merged.market_positions = d.market_positions;
          }
          if (Array.isArray(d.stories_kpis) && (!Array.isArray(merged.stories_kpis) || merged.stories_kpis.length === 0)) {
            merged.stories_kpis = d.stories_kpis;
          }
          if (Array.isArray(d.kpis_story) && (!Array.isArray(merged.kpis_story) || merged.kpis_story.length === 0)) {
            merged.kpis_story = d.kpis_story;
          }
        } else {
          merged = { ...d };
        }
      }
    }
  }
  return { data: merged, source: sources.join('+') || null };
}

// Smart-rescale value × unit pour vérifier si l'affichage tomberait en [1,999].
// Ex: value=178353 unit="M $" → displayed value = 178.4 Mds $ (in range).
function isDisplayValueOk(value, unit) {
  if (value === null || value === undefined) return false;
  const v = Math.abs(Number(value));
  if (!Number.isFinite(v)) return false;
  if (v === 0) return false;
  // Test plusieurs rescale autour de la valeur brute
  // unit "M $" / "M €" / "M £" → si v > 1000, on passerait à "Mds" (× /1000)
  // unit "Mds $" / "Mds €" → si v < 1, on passerait à "M" (× 1000)
  const candidates = [v, v / 1000, v * 1000, v / 1_000_000, v * 1_000_000];
  return candidates.some((x) => x >= 1 && x < 1000);
}

function findHero(company) {
  if (!company || !Array.isArray(company.kpis)) return null;
  const heroName = company.hero_kpi;
  if (!heroName) return null;
  const norm = (s) => lower(s).trim();
  // Match by short, name_en, name_fr (case-insensitive)
  return (
    company.kpis.find((k) => norm(k.short) === norm(heroName)) ||
    company.kpis.find((k) => norm(k.name_en) === norm(heroName)) ||
    company.kpis.find((k) => norm(k.name_fr) === norm(heroName)) ||
    null
  );
}

function historyLength(kpi) {
  if (!kpi || !Array.isArray(kpi.history)) return 0;
  // Filter out nulls
  return kpi.history.filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).length;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const NOW = new Date('2026-05-21');

// ---------------------------------------------------------------------------
// Criteria checks

function checkHeroHistory(company) {
  const hero = findHero(company);
  if (!hero) {
    return { ok: false, reason: 'hero_kpi introuvable dans kpis[]', fatal: true };
  }
  const len = historyLength(hero);
  const period = lower(hero.period_type || 'year');
  const isShortMarked = hero.is_short_history === true || hero._hero_history_unverified === true;
  const isLegitimate = hero.is_short_history_legitimate === true;

  let minRequired, minTolerated;
  if (period === 'quarter') {
    minRequired = 18;
    minTolerated = 10;
  } else if (period === 'semester' || period === 'half') {
    minRequired = 8;
    minTolerated = 4;
  } else {
    minRequired = 5;
    minTolerated = 3;
  }

  if (len >= minRequired) {
    return { ok: true, len, period, required: minRequired };
  }
  // NEW : exception "KPI trop récent légitime" (tagué is_short_history_legitimate).
  // Yann règle : on tolère ce qui existe vraiment dans les filings (KPI lancé <5 ans),
  // exiger juste assez de data pour afficher un graph utile (len >= 3).
  if (isLegitimate && len >= 3) {
    return {
      ok: true,
      exception_legitimate: true,
      len,
      period,
      required: minRequired,
      legitimate_reason: hero.short_history_legitimate_reason || null,
      reason: `KPI trop récent légitime (${len} dispo, flag is_short_history_legitimate)`,
    };
  }
  if (len >= minTolerated && isShortMarked) {
    // Exception : KPI flag short_history (assumé "KPI trop récent")
    return {
      ok: true,
      exception_short: true,
      len,
      period,
      required: minRequired,
      reason: `tolérance KPI court (${len} < ${minRequired}, flag is_short_history)`,
    };
  }
  return {
    ok: false,
    len,
    period,
    required: minRequired,
    tolerated: minTolerated,
    reason: `history insuffisant (${len} < ${minRequired})`,
  };
}

function checkInterpretation(company) {
  // Bloc interprétation buildable :
  // Lead = hero KPI (déjà vérif a)
  // Moteur = au moins 1 KPI dans Demand/User/Adoption/Revenue/Volume/Pricing/Growth/Engagement/Capacity/Productivity/Operations/Production/Quality/Innovation
  // Vigilance = au moins 1 KPI Cost (yoy positif) ou Margin (yoy négatif) — sinon le bloc est vide
  // Surveillance = future-watch, toujours possible
  const hero = findHero(company);
  if (!hero) return { ok: false, sub_blocks: 0, reason: 'hero manquant' };

  if (!Array.isArray(company.kpis)) return { ok: false, sub_blocks: 0, reason: 'kpis[] manquant' };

  const DRIVER_TYPES = new Set([
    'Demand', 'User', 'Adoption', 'Revenue', 'Volume', 'Pricing', 'Growth',
    'Engagement', 'Capacity', 'Productivity', 'Operations', 'Production',
    'Quality', 'Innovation',
  ]);
  const hasDriver = company.kpis.some(
    (k) => k.short !== hero.short && DRIVER_TYPES.has(k.type)
  );

  const hasVigilance = company.kpis.some((k) => {
    const yoy = typeof k.yoy === 'string' ? k.yoy : '';
    return (
      (k.type === 'Cost' && yoy && !yoy.startsWith('-')) ||
      (k.type === 'Margin' && yoy.startsWith('-'))
    );
  });

  // Sub-blocks "candidates"
  let count = 2; // Lead + Surveillance toujours
  if (hasDriver) count += 1;
  if (hasVigilance) count += 1;

  if (count < 4) {
    return {
      ok: false,
      sub_blocks: count,
      has_driver: hasDriver,
      has_vigilance: hasVigilance,
      reason: `sous-blocs interp = ${count}/4 (driver=${hasDriver}, vigilance=${hasVigilance})`,
    };
  }
  return { ok: true, sub_blocks: 4 };
}

function checkKpiCount(company, marketCapUsd) {
  const kpis = Array.isArray(company.kpis) ? company.kpis : [];
  const count = kpis.length;
  const isMega = marketCapUsd && marketCapUsd >= 100e9;
  const minRequired = isMega ? 8 : 5;
  if (count >= minRequired) return { ok: true, count, required: minRequired };
  return { ok: false, count, required: minRequired, reason: `KPIs ${count} < ${minRequired}` };
}

function checkStoriesCount(company, marketCapUsd) {
  // Le bloc Stories UI (cf src/lib/kpi-stories-ordering.ts) construit ses slides
  // depuis 3 sources :
  //   1. kpis[] filtrés sur is_short_history:true
  //   2. market_positions[] (catégorie "Marché")
  //   3. legacy kpis_story[] / stories_kpis[] (anciens datasets)
  // Le critère "Stories" doit donc additionner ces 3 sources, pas regarder
  // uniquement le champ legacy (ancien bug qui faisait sortir 100 % KO).
  const legacy = Array.isArray(company.kpis_story)
    ? company.kpis_story
    : Array.isArray(company.stories_kpis)
      ? company.stories_kpis
      : [];
  const shortHistoryKpis = Array.isArray(company.kpis)
    ? company.kpis.filter((k) => k && k.is_short_history === true)
    : [];
  const marketPositions = Array.isArray(company.market_positions)
    ? company.market_positions
    : [];
  // Dédup par "short" pour ne pas compter 2× un KPI présent dans legacy ET dans kpis[]
  const seen = new Set();
  let count = 0;
  for (const item of [...legacy, ...shortHistoryKpis]) {
    const key = lower(item?.short || item?.name_fr || item?.name_en || JSON.stringify(item));
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  count += marketPositions.length;
  const breakdown = {
    legacy_stories_kpis: legacy.length,
    short_history_kpis: shortHistoryKpis.length,
    market_positions: marketPositions.length,
  };
  const isLarge = marketCapUsd && marketCapUsd >= 10e9;
  const minRequired = isLarge ? 8 : 5;
  const maxCap = 20;
  if (count > maxCap) {
    return { ok: false, count, required: minRequired, max: maxCap, breakdown, reason: `Stories ${count} > ${maxCap}` };
  }
  if (count >= minRequired) return { ok: true, count, required: minRequired, breakdown };
  return { ok: false, count, required: minRequired, breakdown, reason: `Stories ${count} < ${minRequired}` };
}

function checkRisks(company) {
  const risks = Array.isArray(company.risks) ? company.risks : [];
  if (risks.length < 3) {
    return { ok: false, count: risks.length, reason: `Risks ${risks.length} < 3` };
  }
  // Chaque risk doit avoir score + score_rationale
  const issues = [];
  risks.forEach((r, i) => {
    if (r.score === undefined || r.score === null) issues.push(`risk[${i}] sans score`);
    if (!r.score_rationale) issues.push(`risk[${i}] sans score_rationale`);
  });
  // Profit warning
  const hasProfitWarning =
    company.profit_warning !== undefined ||
    risks.some((r) => lower(r.category).includes('profit') || lower(r.title).includes('profit warning'));
  if (!hasProfitWarning) issues.push('profit_warning absent');

  if (issues.length > 0) {
    return { ok: false, count: risks.length, issues, reason: issues.join('; ') };
  }
  return { ok: true, count: risks.length };
}

function checkRepartition(company) {
  const seg = company.revenue_by_segment;
  const geo = company.revenue_by_geography;
  const issues = [];

  function auditBlock(name, block) {
    if (!block || !Array.isArray(block.slices) || block.slices.length === 0) {
      issues.push(`${name} vide`);
      return;
    }
    if (!block.unit) issues.push(`${name} sans unit`);
    let totalShare = 0;
    let hasShare = true;
    block.slices.forEach((s, i) => {
      if (s.value === undefined || s.value === null) {
        issues.push(`${name}.slices[${i}] sans value`);
        return;
      }
      const v = Number(s.value);
      if (!Number.isFinite(v)) {
        issues.push(`${name}.slices[${i}].value non numérique`);
        return;
      }
      // Yann : value entre 1 et 999 (avec smart-rescale unit-aware)
      if (!isDisplayValueOk(v, block.unit)) {
        issues.push(`${name}.slices[${i}].value=${v} ${block.unit || '?'} ne rescale pas en [1,999]`);
      }
      if (s.share_pct !== undefined && s.share_pct !== null) {
        totalShare += Number(s.share_pct) || 0;
      } else {
        hasShare = false;
      }
    });
    if (!hasShare) {
      issues.push(`${name} : share_pct manquant sur au moins 1 slice`);
    } else if (totalShare > 0 && Math.abs(totalShare - 100) > 5) {
      issues.push(`${name} : Σ share_pct=${totalShare.toFixed(1)} ≠ 100`);
    }
  }

  auditBlock('segment', seg);
  auditBlock('geography', geo);

  if (issues.length > 0) {
    return { ok: false, issues, reason: issues.slice(0, 3).join('; ') };
  }
  return { ok: true };
}

// ----- Extensions -----

function checkGovernance(company) {
  const g = company.governance;
  if (!g || typeof g !== 'object') return { ok: false, reason: 'governance absente' };
  const required = ['ceo_name', 'ceo_total_comp_m', 'board_size', 'voting_structure', 'top_capital', 'top_voting'];
  const missing = required.filter((k) => g[k] === undefined || g[k] === null || g[k] === '');
  if (missing.length > 0) return { ok: false, missing, reason: `gov manque: ${missing.join(',')}` };
  // top_capital + top_voting devraient être listes ≥ 3
  if (!Array.isArray(g.top_capital) || g.top_capital.length < 3) return { ok: false, reason: 'top_capital < 3' };
  if (!Array.isArray(g.top_voting) || g.top_voting.length < 3) return { ok: false, reason: 'top_voting < 3' };
  return { ok: true };
}

function checkAiPositioning(company) {
  const ai = company.ai_positioning;
  if (!ai || typeof ai !== 'object') return { ok: false, reason: 'ai_positioning absent' };
  if (!ai.stance) return { ok: false, reason: 'stance manquant' };
  const ev = Array.isArray(ai.evidence) ? ai.evidence : [];
  if (ev.length < 3) return { ok: false, reason: `evidence ${ev.length} < 3` };
  return { ok: true };
}

function checkEvents(company) {
  const ev = Array.isArray(company.events) ? company.events : [];
  if (ev.length < 4) return { ok: false, count: ev.length, reason: `events ${ev.length} < 4` };
  return { ok: true, count: ev.length };
}

function checkDescription(company) {
  const d = company.company_description || company.description || '';
  if (d.length < 100) return { ok: false, len: d.length, reason: `description ${d.length} < 100 chars` };
  return { ok: true, len: d.length };
}

function checkRanks(company) {
  const r = company.ranks;
  if (!r || typeof r !== 'object') return { ok: false, reason: 'ranks absent' };
  const fields = ['global_world', 'global_us', 'sector', 'subsector'];
  const present = fields.filter((f) => r[f] !== undefined && r[f] !== null && r[f] !== '' && r[f] !== '-');
  if (present.length < 2) return { ok: false, reason: `ranks remplis ${present.length}/4` };
  // Cohérence : pas tous "#1"
  const allOne = present.every((f) => String(r[f]).trim() === '#1');
  if (allOne && present.length >= 3) return { ok: false, reason: 'tous ranks=#1 (incohérent)' };
  return { ok: true };
}

function checkHeroNameFr(company) {
  const hero = findHero(company);
  if (!hero) return { ok: false, reason: 'hero introuvable' };
  if (!hero.name_fr || hero.name_fr === hero.short) {
    return { ok: false, reason: `hero name_fr manquant ou = short` };
  }
  return { ok: true };
}

function checkFreshness(company) {
  // Cherche last_data_date du hero KPI ou racine
  const hero = findHero(company);
  let date = null;
  if (hero && hero.last_data_date) date = parseDate(hero.last_data_date);
  if (!date && company.publication_date) date = parseDate(company.publication_date);
  if (!date && company.latest_filing && company.latest_filing.date) date = parseDate(company.latest_filing.date);
  if (!date) return { ok: false, reason: 'last_data_date absent' };
  const monthsAgo = (NOW.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsAgo > 12) {
    return { ok: false, months_ago: Math.round(monthsAgo), reason: `last_data_date ${monthsAgo.toFixed(0)} mois` };
  }
  return { ok: true, months_ago: Math.round(monthsAgo) };
}

// ---------------------------------------------------------------------------
// Main

function auditTicker(ticker, marketCapMap) {
  const { data, source } = loadCompany(ticker);
  if (!data) {
    return {
      ticker,
      source: null,
      fatal: 'dataset introuvable',
      market_cap_usd: marketCapMap.get(ticker) || null,
      criteria: {},
      extensions: {},
      failed_count: 99,
    };
  }
  const mc = marketCapMap.get(ticker) || null;
  const criteria = {
    a_hero_history: checkHeroHistory(data),
    b_interpretation: checkInterpretation(data),
    c_kpi_count: checkKpiCount(data, mc),
    d_stories: checkStoriesCount(data, mc),
    e_risks: checkRisks(data),
    f_repartition: checkRepartition(data),
  };
  const extensions = {
    g_governance: checkGovernance(data),
    h_ai_positioning: checkAiPositioning(data),
    i_events: checkEvents(data),
    j_description: checkDescription(data),
    k_ranks: checkRanks(data),
    l_hero_name_fr: checkHeroNameFr(data),
    m_freshness: checkFreshness(data),
  };
  const failedCriteria = Object.entries(criteria).filter(([, v]) => !v.ok).map(([k]) => k);
  const failedExtensions = Object.entries(extensions).filter(([, v]) => !v.ok).map(([k]) => k);
  return {
    ticker,
    source,
    market_cap_usd: mc,
    criteria,
    extensions,
    failed_criteria: failedCriteria,
    failed_extensions: failedExtensions,
    failed_count: failedCriteria.length,
    is_clean_af: failedCriteria.length === 0,
    is_clean_all: failedCriteria.length === 0 && failedExtensions.length === 0,
  };
}

function main() {
  console.log('=== AUDIT V1.9 pré-publication ===');
  const publishable = readJson(path.join(DATA, 'v1-9-publishable.json'));
  if (!publishable || !Array.isArray(publishable.tickers)) {
    console.error('v1-9-publishable.json introuvable');
    process.exit(1);
  }
  const tickers = publishable.tickers;
  console.log(`Cible : ${tickers.length} tickers publishable`);

  // Market caps depuis top307-breakdown
  const top307 = readJson(path.join(DATA, 'top307-breakdown.json')) || [];
  const mcMap = new Map();
  top307.forEach((row) => {
    if (row.ticker && row.market_cap_usd) mcMap.set(row.ticker, row.market_cap_usd);
  });
  console.log(`Market caps connus : ${mcMap.size} stés (depuis top307-breakdown)`);

  const audits = tickers.map((t) => auditTicker(t, mcMap));

  // Stats globales
  const stats = {
    total: audits.length,
    fatal_no_dataset: audits.filter((a) => a.fatal).length,
    clean_af: audits.filter((a) => a.is_clean_af).length,
    clean_all: audits.filter((a) => a.is_clean_all).length,
    by_failed_count: {},
    by_failed_criterion: {
      a_hero_history: 0,
      b_interpretation: 0,
      c_kpi_count: 0,
      d_stories: 0,
      e_risks: 0,
      f_repartition: 0,
    },
    by_failed_extension: {
      g_governance: 0,
      h_ai_positioning: 0,
      i_events: 0,
      j_description: 0,
      k_ranks: 0,
      l_hero_name_fr: 0,
      m_freshness: 0,
    },
  };
  // NEW : tracker exceptions a_hero_history (KPI trop récent légitime + tolérance short)
  stats.a_hero_history_exceptions = {
    legitimate: 0,
    short_marked: 0,
    legitimate_pct_of_total: 0,
    under_21pct_cap: true,
  };
  audits.forEach((a) => {
    const n = a.fatal ? 'fatal' : String(a.failed_count);
    stats.by_failed_count[n] = (stats.by_failed_count[n] || 0) + 1;
    a.failed_criteria.forEach((c) => {
      stats.by_failed_criterion[c] = (stats.by_failed_criterion[c] || 0) + 1;
    });
    a.failed_extensions.forEach((e) => {
      stats.by_failed_extension[e] = (stats.by_failed_extension[e] || 0) + 1;
    });
    // Track exception usage on a_hero_history
    const ah = a.criteria && a.criteria.a_hero_history;
    if (ah && ah.ok) {
      if (ah.exception_legitimate) stats.a_hero_history_exceptions.legitimate += 1;
      if (ah.exception_short) stats.a_hero_history_exceptions.short_marked += 1;
    }
  });
  const totalExceptions =
    stats.a_hero_history_exceptions.legitimate + stats.a_hero_history_exceptions.short_marked;
  stats.a_hero_history_exceptions.total = totalExceptions;
  stats.a_hero_history_exceptions.legitimate_pct_of_total = Number(
    ((stats.a_hero_history_exceptions.legitimate / stats.total) * 100).toFixed(2)
  );
  stats.a_hero_history_exceptions.total_exceptions_pct_of_total = Number(
    ((totalExceptions / stats.total) * 100).toFixed(2)
  );
  stats.a_hero_history_exceptions.under_21pct_cap =
    stats.a_hero_history_exceptions.total_exceptions_pct_of_total < 21;

  // Top 20 stés à fixer en priorité (1-2 critères failed)
  const toFix = audits
    .filter((a) => !a.fatal && a.failed_count > 0 && a.failed_count <= 2)
    .sort((x, y) => {
      if (x.failed_count !== y.failed_count) return x.failed_count - y.failed_count;
      const mx = x.market_cap_usd || 0;
      const my = y.market_cap_usd || 0;
      return my - mx;
    })
    .slice(0, 20)
    .map((a) => ({
      ticker: a.ticker,
      market_cap_usd: a.market_cap_usd,
      failed_count: a.failed_count,
      failed_criteria: a.failed_criteria,
      reasons: a.failed_criteria.map((c) => `${c}: ${a.criteria[c].reason}`),
    }));

  // Sample détaillé majors
  const sampleMajors = ['AMZN', 'MSFT', 'GOOGL', 'NVDA', 'META']
    .map((t) => audits.find((a) => a.ticker === t))
    .filter(Boolean);

  // Top 5 critères failing
  const top5Failed = Object.entries(stats.by_failed_criterion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const output = {
    generated_at: new Date().toISOString(),
    publishable_source: 'src/data/v1-9-publishable.json',
    publishable_count_input: tickers.length,
    stats,
    top5_failed_criteria: top5Failed,
    top20_to_fix: toFix,
    sample_majors: sampleMajors,
    audits,
  };

  const outPath = path.join(DATA, 'v1-9-pre-publication-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Audit écrit : ${path.relative(REPO, outPath)}`);

  // Rapport stdout
  console.log('\n=== STATS ===');
  console.log(`Total audité : ${stats.total}`);
  console.log(`Dataset introuvable : ${stats.fatal_no_dataset}`);
  console.log(`✓ Clean a-f (vraiment publishable) : ${stats.clean_af}`);
  console.log(`✓✓ Clean a-f + extensions g-m : ${stats.clean_all}`);
  console.log('\nDistribution par nb critères a-f failed :');
  Object.entries(stats.by_failed_count)
    .sort((a, b) => (a[0] === 'fatal' ? 1 : b[0] === 'fatal' ? -1 : Number(a[0]) - Number(b[0])))
    .forEach(([k, v]) => console.log(`  ${k} critère(s) failed : ${v} stés`));
  console.log('\nTop 5 critères qui échouent le plus :');
  top5Failed.forEach(([k, v]) => console.log(`  ${k} : ${v} stés (${((v / stats.total) * 100).toFixed(1)} %)`));
  console.log('\nExtensions qui échouent :');
  Object.entries(stats.by_failed_extension)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k} : ${v} stés (${((v / stats.total) * 100).toFixed(1)} %)`));
  console.log('\nExceptions a_hero_history (KPI trop récent / short marked) :');
  const ex = stats.a_hero_history_exceptions;
  console.log(`  legitimate (is_short_history_legitimate)     : ${ex.legitimate} (${ex.legitimate_pct_of_total} %)`);
  console.log(`  short_marked (is_short_history)               : ${ex.short_marked}`);
  console.log(`  total exceptions                              : ${ex.total} (${ex.total_exceptions_pct_of_total} %)`);
  console.log(`  cap < 21 % respecté                           : ${ex.under_21pct_cap ? '✓ OUI' : '✗ NON'}`);
  console.log('\nTop 20 stés à fixer en priorité (1-2 critères manquants) :');
  toFix.slice(0, 20).forEach((t) => {
    const mc = t.market_cap_usd ? `MC=${(t.market_cap_usd / 1e9).toFixed(0)} Mds` : 'MC?';
    console.log(`  ${t.ticker.padEnd(10)} ${mc.padEnd(12)} → ${t.failed_criteria.join(', ')}`);
  });
  console.log('\nSample majors :');
  sampleMajors.forEach((a) => {
    const status = a.is_clean_af ? 'OK a-f' : `KO (${a.failed_criteria.join(',')})`;
    const ext = a.failed_extensions.length === 0 ? '+ext OK' : `+ext KO (${a.failed_extensions.join(',')})`;
    console.log(`  ${a.ticker.padEnd(8)} : ${status} ${ext}`);
  });
}

main();
