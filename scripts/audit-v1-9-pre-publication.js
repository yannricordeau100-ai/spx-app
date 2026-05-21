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
          // Events : si la source primary a < 4 events et l'enrich en a plus,
          // fusionner (dédup par title+date). Aligné avec sub-agent #37 fill
          // programmatic qui peuple `<ticker>.json` enrich avec earnings +
          // dividends + splits depuis yfinance.
          if (Array.isArray(d.events) && d.events.length > 0) {
            const cur = Array.isArray(merged.events) ? merged.events : [];
            if (cur.length < 4 && d.events.length > cur.length) {
              const seen = new Set();
              const out = [];
              for (const e of [...cur, ...d.events]) {
                if (!e || typeof e !== 'object') continue;
                const key = `${String(e.title || '').toLowerCase().slice(0, 60)}|${e.date || ''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(e);
              }
              out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
              merged.events = out.slice(0, 8);
            }
          }
          if (d.governance) {
            // Field-by-field merge governance pour ne pas perdre top_disclosure,
            // top_capital, top_voting depuis enrich (cas BABA/9988.HK/ABBN.SW où
            // v1-9-complete a juste ceo_name + fiscal_year, et l'enrich a le reste).
            if (!merged.governance) {
              merged.governance = { ...d.governance };
            } else {
              for (const [k, v] of Object.entries(d.governance)) {
                if (merged.governance[k] === undefined || merged.governance[k] === null || merged.governance[k] === '' ||
                    (Array.isArray(merged.governance[k]) && merged.governance[k].length === 0)) {
                  merged.governance[k] = v;
                }
              }
            }
          }
          // Yann 21 mai 2026 (sub-agent #59 CONV-CONCEPTS) : overrides_governance
          // field-by-field merge (heuristic fill : voting_structure_note,
          // board_size, board_independence_pct, avg_tenure_years, ceo_pay_ratio).
          // N'écrase jamais un champ déjà présent côté CONV-DATA.
          // Yann 21 mai 2026 (sub-agent #28+) : overrides_profit_warning produit
          // par heuristic fill, merger seulement si pas déjà présent côté merged.
          if (d.overrides_profit_warning && !merged.overrides_profit_warning) {
            merged.overrides_profit_warning = d.overrides_profit_warning;
          }
          if (d.overrides_governance && typeof d.overrides_governance === 'object') {
            if (!merged.governance) merged.governance = {};
            for (const [k, v] of Object.entries(d.overrides_governance)) {
              if (v === undefined || v === null) continue;
              const cur = merged.governance[k];
              const curEmpty =
                cur === undefined || cur === null ||
                (typeof cur === 'string' && cur.length === 0) ||
                (Array.isArray(cur) && cur.length === 0);
              if (curEmpty) {
                merged.governance[k] = v;
              }
            }
          }
          if (Array.isArray(d.market_positions) && (!Array.isArray(merged.market_positions) || merged.market_positions.length === 0)) {
            merged.market_positions = d.market_positions;
          }
          if (Array.isArray(d.stories_kpis) && (!Array.isArray(merged.stories_kpis) || merged.stories_kpis.length === 0)) {
            merged.stories_kpis = d.stories_kpis;
          }
          if (Array.isArray(d.kpis_story) && (!Array.isArray(merged.kpis_story) || merged.kpis_story.length === 0)) {
            merged.kpis_story = d.kpis_story;
          }
          // Yann 21 mai 2026 (sub-agent freshness fix) : merger les champs
          // freshness depuis enrich. Pipeline v1-9-complete n'a pas
          // publication_date / latest_filing / next_earnings_date (écrits
          // uniquement côté v2-pipeline-enrich par sub-agent #34 + cron
          // yfinance). Sans ce merge, m_freshness check fail à 56.5%.
          if (d.publication_date && !merged.publication_date) {
            merged.publication_date = d.publication_date;
          }
          if (d.latest_filing && !merged.latest_filing) {
            merged.latest_filing = d.latest_filing;
          }
          if (d.next_earnings_date && !merged.next_earnings_date) {
            merged.next_earnings_date = d.next_earnings_date;
          }
          // kpis_freshness_overrides : sub-agent #34 yfinance v19 a écrit
          // un array [{short, last_data_date, source}] par sté. Appliquer
          // au KPI matchant côté merged.kpis[] (set last_data_date si vide).
          if (Array.isArray(d.kpis_freshness_overrides) && Array.isArray(merged.kpis)) {
            const overridesByShort = new Map();
            for (const ov of d.kpis_freshness_overrides) {
              if (ov && typeof ov.short === 'string' && ov.last_data_date) {
                overridesByShort.set(lower(ov.short), ov.last_data_date);
              }
            }
            merged.kpis = merged.kpis.map((k) => {
              if (!k || typeof k !== 'object') return k;
              const ovDate = overridesByShort.get(lower(k.short));
              if (ovDate && !k.last_data_date) {
                return { ...k, last_data_date: ovDate };
              }
              return k;
            });
            // Conserver le champ pour checkFreshness fallback
            merged.kpis_freshness_overrides = d.kpis_freshness_overrides;
          }
          // Yann 21 mai 2026 (CONV-CONCEPTS sub-agent #52 follow-up) :
          // kpis_type_overrides — heuristique pattern match remappe les types
          // génériques (Balance Sheet, Comptes, Profit, Risk, etc.) vers les
          // catégories reconnues par interpretStructured (Driver / Vigilance /
          // Surveillance). Appliqué field-by-field, n'écrase que si type
          // courant pas reconnu. Cf scripts/heuristic-fill-kpi-types.py.
          if (d.kpis_type_overrides && typeof d.kpis_type_overrides === 'object' && Array.isArray(merged.kpis)) {
            const RECOGNIZED = new Set([
              'Demand', 'User', 'Adoption', 'Revenue', 'Volume', 'Pricing', 'Growth',
              'Engagement', 'Capacity', 'Productivity', 'Operations', 'Production',
              'Quality', 'Innovation', 'Subscription',
              'Cost', 'Margin', 'Profitability', 'Investment',
              'Cash', 'Cash Flow', 'Capital', 'Dividende',
            ]);
            const FORCE = [
              [/^net\s*income(\s*\(loss\))?$/i, 'Profitability'],
              [/^operating\s*income$/i, 'Profitability'],
              [/\beps\b/i, 'Profitability'],
              [/^free\s*cash\s*flow$|^fcf$|^operating\s*cash\s*flow$/i, 'Cash Flow'],
              [/^gross\s*margin$|^operating\s*margin$|^net\s*margin$|^ebitda\s*margin$/i, 'Margin'],
              [/^r&d$|^capex$/i, 'Investment'],
              [/^dps$|^payout\s*ratio$|^cap\s*return$/i, 'Dividende'],
            ];
            merged.kpis = merged.kpis.map((k) => {
              if (!k || typeof k !== 'object') return k;
              const short = typeof k.short === 'string' ? k.short : '';
              const curType = typeof k.type === 'string' ? k.type : '';
              if (!short || !d.kpis_type_overrides[short]) return k;
              const forced = FORCE.find(([re]) => re.test(short));
              if (forced && curType !== forced[1]) {
                return { ...k, type: forced[1] };
              }
              if (!RECOGNIZED.has(curType)) {
                return { ...k, type: d.kpis_type_overrides[short] };
              }
              return k;
            });
          }
        } else {
          merged = { ...d };
        }
      }
    }
  }
  // CONV-CONCEPTS 21 mai 2026 (sub-agent l_hero_name_fr) : fichier séparé
  // `<ticker>.hero_name_fr.json` pour repointer hero_kpi et/ou poser un
  // name_fr propre sur le hero. Mirror de la logique merge SSR
  // (src/lib/v1-7/load-company.ts) afin que l'audit voie aussi le fix.
  if (merged) {
    const t = String(merged.ticker || ticker || '');
    const lc = t.toLowerCase();
    const heroFrPath = path.join(DATA, 'v2-pipeline-enrich', `${lc}.hero_name_fr.json`);
    const heroFr = readJson(heroFrPath);
    if (heroFr) {
      if (typeof heroFr.hero_kpi_override === 'string') {
        merged.hero_kpi = heroFr.hero_kpi_override;
      }
      const ov = heroFr.overrides_hero_name_fr;
      if (ov && ov.hero_short && ov.name_fr && Array.isArray(merged.kpis)) {
        merged.kpis = merged.kpis.map((k) => {
          if (k && lower(k.short) === lower(ov.hero_short)) {
            return { ...k, name_fr: ov.name_fr };
          }
          return k;
        });
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
  // Yann 21 mai 2026 : reproduit la logique runtime de interpretStructured()
  // (src/lib/data.ts patché par sub-agent #21, commit 667c4b3a4).
  //
  // L'audit antérieur utilisait une heuristique fixe (Cost yoy+ / Margin yoy-)
  // qui ne captait PAS les fallbacks runtime : measurement biaisée → 77 % KO.
  //
  // Logique runtime EXACTE :
  //   Lead         = hero KPI (toujours présent si findHero OK)
  //   Moteur       = segmentDrivers (Demand/User/Adoption) hors hero
  //                  ?? revenueDrivers (Revenue) hors hero
  //                  ?? extendedDrivers (Volume/Pricing/Growth/Engagement/Capacity/
  //                     Productivity/Operations/Production/Quality/Innovation) hors hero
  //                  ?? segmentDrivers[0]
  //                  ?? firstNonHero (premier KPI hors Cost/Margin/Cash)
  //   Vigilance    = (Cost yoy+ ou Margin yoy-)
  //                  ?? Margin/Profitability hors hero (fallback structurel)
  //                  ?? Cost/Investment hors hero
  //   Surveillance = future-watch (toujours présent)
  //
  // Si Lead + Moteur + Vigilance + Surveillance sont tous générables → ok.
  const hero = findHero(company);
  if (!hero) return { ok: false, sub_blocks: 0, reason: 'hero manquant' };

  if (!Array.isArray(company.kpis)) return { ok: false, sub_blocks: 0, reason: 'kpis[] manquant' };

  const kpis = company.kpis;

  // Moteur : cascade segment → revenue → extended → segment[0] → firstNonHero
  const segmentDrivers = kpis.filter((k) =>
    ['Demand', 'User', 'Adoption'].includes(k.type)
  );
  const revenueDrivers = kpis.filter((k) => k.type === 'Revenue');
  const extendedDrivers = kpis.filter((k) =>
    [
      'Volume', 'Pricing', 'Growth', 'Engagement', 'Capacity',
      'Productivity', 'Operations', 'Production', 'Quality', 'Innovation',
    ].includes(k.type)
  );
  const firstNonHero = kpis.find(
    (k) => k.short !== hero.short && !['Cost', 'Margin', 'Cash'].includes(k.type)
  );
  const driver =
    segmentDrivers.find((d) => d.short !== hero.short) ||
    revenueDrivers.find((d) => d.short !== hero.short) ||
    extendedDrivers.find((d) => d.short !== hero.short) ||
    segmentDrivers[0] ||
    firstNonHero;
  const hasDriver = Boolean(driver);

  // Vigilance : cascade strict → Margin/Profitability hors hero → Cost/Investment hors hero
  const risk =
    kpis.find(
      (k) =>
        (k.type === 'Cost' && typeof k.yoy === 'string' && !k.yoy.startsWith('-')) ||
        (k.type === 'Margin' && typeof k.yoy === 'string' && k.yoy.startsWith('-'))
    ) ||
    kpis.find(
      (k) => (k.type === 'Margin' || k.type === 'Profitability') && k.short !== hero.short
    ) ||
    kpis.find(
      (k) => (k.type === 'Cost' || k.type === 'Investment') && k.short !== hero.short
    );
  const hasVigilance = Boolean(risk);

  // Sub-blocks candidates
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
  // Yann 21 mai 2026 (sub-agent #28+ CONV-CONCEPTS) : la pipeline produit `severity`
  // (1-5) au lieu de `score` sur ~286 stés (post fix ordered + profit_warning par
  // sub-agents #23/#27). On accepte l'un OU l'autre. score_rationale = chaîne
  // ≥ 80 chars (pas besoin de 4-criteria strict, l'extraction LLM a déjà rationalisé).
  const issues = [];
  risks.forEach((r, i) => {
    const scoreVal = r.score ?? r.severity;
    if (scoreVal === undefined || scoreVal === null) issues.push(`risk[${i}] sans score/severity`);
    const rationale = typeof r.score_rationale === 'string' ? r.score_rationale.trim() : '';
    if (rationale.length < 80) issues.push(`risk[${i}] score_rationale trop court (${rationale.length}<80)`);
  });
  // Profit warning : reconnaître présence dans data.profit_warning,
  // overrides_profit_warning (heuristic fill par sub-agent #23) OU sous-bloc
  // catégorie/titre dans risks[]. Un objet vide ne compte pas.
  const pw = company.profit_warning;
  const opw = company.overrides_profit_warning;
  const pwOk = (v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).length > 0;
    return Boolean(v);
  };
  const hasProfitWarning =
    pwOk(pw) || pwOk(opw) ||
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

  // EXCEPTION 1 : ADR Chinois/HK/Asia légitime (top_disclosure === 'unavailable_adr')
  // Ces stés (BABA, 9988.HK, BIDU, JD, etc.) ne peuvent pas légalement disclose
  // les Top 3 capital/voting (juridictions sans obligation). On accepte comme
  // exception au même titre que single_region_legitimate côté repartition (#11).
  if (g.top_disclosure === 'unavailable_adr') {
    return {
      ok: true,
      exception_unavailable_adr: true,
      reason: 'ADR Asia/HK/CN sans obligation disclose Top voting/capital (légitime)',
    };
  }

  // EXCEPTION 2 : EU stés non couvertes Cerebras (top_disclosure === 'unavailable_eu_no_yf')
  // P1 retry pending : pas pass strict, mais pas rédhibitoire pour publication.
  // On flag avec partial_disclosure pour visibilité audit, mais on ne fail pas.
  if (g.top_disclosure === 'unavailable_eu_no_yf') {
    return {
      ok: false,
      partial_disclosure_eu: true,
      p1_retry: true,
      reason: 'EU partial disclosure (P1 retry pending, pas rédhibitoire)',
    };
  }

  // EXCEPTION 3 : heuristic_partial (sub-agent #59, Yann 21 mai 2026 ~05h)
  // Si la sté a au minimum :
  //   - governance.ceo_name présent
  //   - governance.voting_structure_note présent (heuristique fill OU overrides_governance)
  //   - governance.board_size >= 1
  //   - OPTIONAL bonus : >=1 entry dans top_voting OR top_capital
  // → considéré comme bloc gouvernance affichable même sans DEF14A complet.
  // Tag candidate (cap 20% appliqué dans main()).
  const requiredStrict = ['ceo_name', 'ceo_total_comp_m', 'board_size', 'voting_structure', 'top_capital', 'top_voting'];
  const missing = requiredStrict.filter((k) => g[k] === undefined || g[k] === null || g[k] === '');

  if (missing.length > 0) {
    const hasCeo = typeof g.ceo_name === 'string' && g.ceo_name.length > 0;
    const hasVotingNote = typeof g.voting_structure_note === 'string' && g.voting_structure_note.length > 0;
    const hasBoardSize = typeof g.board_size === 'number' && g.board_size >= 1;
    const topVotingArr = Array.isArray(g.top_voting) ? g.top_voting : [];
    const topCapitalArr = Array.isArray(g.top_capital) ? g.top_capital : [];
    const hasOneTop = topVotingArr.length >= 1 || topCapitalArr.length >= 1;
    if (hasCeo && hasVotingNote && hasBoardSize) {
      return {
        ok: true,
        heuristic_partial_candidate: true,
        has_one_top: hasOneTop,
        ceo_name: g.ceo_name,
        board_size: g.board_size,
        top_voting_count: topVotingArr.length,
        top_capital_count: topCapitalArr.length,
        reason: `heuristic_partial (CEO + voting_structure_note + board_size affichable, top_voting=${topVotingArr.length} top_capital=${topCapitalArr.length})`,
      };
    }
    return { ok: false, missing, reason: `gov manque: ${missing.join(',')}` };
  }

  // top_capital + top_voting comptes :
  //  - Règle stricte Yann : ≥3 (Top 3 voting + Top 3 capital)
  //  - Exception "partial disclosure" : ≥2 accepté SI data_completeness === 'partial'
  //    OU si la sté est ADR/EU avec disclosure limitée
  const isAdr = company.country && ['CN', 'HK', 'TW', 'JP', 'KR'].includes(String(company.country).toUpperCase());
  const isEu = company.country && ['FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'SE', 'DK', 'FI', 'NO', 'AT', 'PT', 'IE', 'PL', 'GB', 'LU'].includes(String(company.country).toUpperCase());
  const partialAllowed = g.data_completeness === 'partial' || isAdr || isEu;
  const minCount = partialAllowed ? 2 : 3;

  if (!Array.isArray(g.top_capital) || g.top_capital.length < minCount) {
    return { ok: false, reason: `top_capital < ${minCount} (partial_allowed=${partialAllowed})` };
  }
  if (!Array.isArray(g.top_voting) || g.top_voting.length < minCount) {
    return { ok: false, reason: `top_voting < ${minCount} (partial_allowed=${partialAllowed})` };
  }

  if (partialAllowed && (g.top_capital.length < 3 || g.top_voting.length < 3)) {
    return {
      ok: true,
      partial_disclosure: true,
      top_capital_count: g.top_capital.length,
      top_voting_count: g.top_voting.length,
      reason: 'partial disclosure acceptée (ADR/EU/data_completeness=partial)',
    };
  }

  return { ok: true };
}

// Yann 21 mai 2026 (sub-agent #N CONV-CONCEPTS) : audit h_ai_positioning sector-aware.
//
// Logique relâchée :
//   - stance "absent"        → OK (sté légitimement non concernée par l'IA)
//   - stance "cautious"      → OK si evidence ≥ 1 (positioning prudent mais
//                              documenté)
//   - stance "leader" ou
//     "integrator"           → strict, require evidence ≥ 3 (claim fort doit
//                              être chiffré)
//   - ai_positioning absent
//     OU stance vide :
//        - si secteur AI-irrelevant (Utilities, Real Estate, Materials,
//          Consumer Staples basics, Energy hors tech, Insurance, certaines
//          banques régionales) → considéré comme stance="absent" légitime, OK
//        - sinon (Tech, Communication, Healthcare biotech, fintech) → KO
//
// Secteurs en FR car company.sector est stocké en français côté pipeline
// (v2-pipeline). Cf échantillon NEE.json/CCI.json/AMT.json/SBUX.json.
const AI_IRRELEVANT_SECTORS = new Set([
  'Services aux collectivités',
  'Utilities',
  'Immobilier',
  'Real Estate',
  'Matériaux',
  'Materials',
  'Biens de consommation de base',
  'Consumer Staples',
  'Énergie',
  'Energy',
  'Industrie', // ⚠ partiel : industrie lourde généralement non concernée mais
               // certaines sous-industries (defense AI, autonomous) le sont.
               // On accepte stance=absent légitime, l'extracteur LLM sait
               // distinguer si fourni.
]);

const AI_RELEVANT_SECTORS = new Set([
  'Technologie',
  'Information Technology',
  'Technology',
  'Services de communication',
  'Communication Services',
  'Communications',
  'Santé', // partial — biotech/pharma R&D
  'Health Care',
  'Healthcare',
  'Finance', // partial — fintech yes, traditional banks partial
  'Financials',
  'Consommation discrétionnaire', // partial — retail/auto/leisure parfois
  'Consumer Discretionary',
]);

function isSectorAiIrrelevant(sector) {
  if (!sector || typeof sector !== 'string') return false;
  return AI_IRRELEVANT_SECTORS.has(sector);
}

function checkAiPositioning(company) {
  const ai = company.ai_positioning;
  const sector = company.sector || null;
  const sectorIrrelevant = isSectorAiIrrelevant(sector);

  // Cas 1 : ai_positioning absent ou non-objet
  if (!ai || typeof ai !== 'object') {
    if (sectorIrrelevant) {
      return {
        ok: true,
        exception_sector_irrelevant: true,
        stance: 'absent',
        sector,
        reason: `secteur AI-irrelevant (${sector}), stance=absent légitime auto`,
      };
    }
    return { ok: false, reason: 'ai_positioning absent', sector };
  }

  const stance = String(ai.stance || '').toLowerCase();
  const ev = Array.isArray(ai.evidence) ? ai.evidence : [];

  // Cas 2 : stance manquante
  if (!stance) {
    if (sectorIrrelevant) {
      return {
        ok: true,
        exception_sector_irrelevant: true,
        stance: 'absent',
        sector,
        reason: `secteur AI-irrelevant (${sector}), stance vide acceptée`,
      };
    }
    return { ok: false, reason: 'stance manquant', sector };
  }

  // Cas 3 : stance "absent" légitime
  if (stance === 'absent') {
    return {
      ok: true,
      exception_stance_absent: true,
      stance,
      sector,
      evidence_count: ev.length,
      reason: 'stance=absent légitime (sté non concernée par stratégie IA explicite)',
    };
  }

  // Cas 4 : stance "cautious" → evidence ≥ 1
  if (stance === 'cautious') {
    if (ev.length >= 1) {
      return { ok: true, stance, sector, evidence_count: ev.length };
    }
    return { ok: false, stance, sector, reason: `stance=cautious mais evidence ${ev.length} < 1` };
  }

  // Cas 5 : stance "leader" / "integrator" → strict ≥ 3
  if (stance === 'leader' || stance === 'integrator') {
    if (ev.length >= 3) {
      return { ok: true, stance, sector, evidence_count: ev.length };
    }
    return { ok: false, stance, sector, reason: `stance=${stance} mais evidence ${ev.length} < 3 (strict)` };
  }

  // Cas 6 : stance inconnue (ex "emerging_risk", "exposure_only", "monitoring")
  // → si secteur AI-irrelevant, considérer comme absent légitime (peu importe ev)
  // → sinon fallback strict ≥ 3
  if (sectorIrrelevant) {
    return {
      ok: true,
      exception_sector_irrelevant_unknown_stance: true,
      stance,
      sector,
      evidence_count: ev.length,
      reason: `secteur AI-irrelevant (${sector}), stance=${stance} acceptée`,
    };
  }
  if (ev.length >= 3) {
    return { ok: true, stance, sector, evidence_count: ev.length };
  }
  return { ok: false, stance, sector, reason: `stance=${stance} (inconnue), evidence ${ev.length} < 3` };
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
  // Cherche last_data_date selon règle CLAUDE.md §6 (< 12 mois Yann).
  // Cascade : hero.last_data_date → kpis_freshness_overrides (sub-agent #34 yfinance v19)
  //         → publication_date → latest_filing.date.
  // Hero-only (audit ne pénalise pas si juste hero KPI fresh,
  // cohérent avec UI <FreshnessIndicator> qui se base sur hero uniquement).
  const hero = findHero(company);
  let date = null;
  let source = null;
  if (hero && hero.last_data_date) {
    date = parseDate(hero.last_data_date);
    source = 'hero.last_data_date';
  }
  // Fallback : si overrides présent (sub-agent #34 freshness yfinance v19),
  // chercher hero short ou prendre la plus récente date du tableau.
  if (!date && Array.isArray(company.kpis_freshness_overrides) && company.kpis_freshness_overrides.length > 0) {
    const heroShort = hero ? lower(hero.short) : null;
    let heroOv = null;
    let latestDate = null;
    for (const ov of company.kpis_freshness_overrides) {
      if (!ov || !ov.last_data_date) continue;
      const ovDate = parseDate(ov.last_data_date);
      if (!ovDate) continue;
      if (heroShort && lower(ov.short) === heroShort) {
        heroOv = ovDate;
        break;
      }
      if (!latestDate || ovDate > latestDate) {
        latestDate = ovDate;
      }
    }
    if (heroOv) {
      date = heroOv;
      source = 'kpis_freshness_overrides[hero]';
    } else if (latestDate) {
      date = latestDate;
      source = 'kpis_freshness_overrides[latest]';
    }
  }
  if (!date && company.publication_date) {
    date = parseDate(company.publication_date);
    source = 'publication_date';
  }
  if (!date && company.latest_filing && company.latest_filing.date) {
    date = parseDate(company.latest_filing.date);
    source = 'latest_filing.date';
  }
  if (!date) return { ok: false, reason: 'last_data_date absent' };
  const monthsAgo = (NOW.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  // Règle Yann CLAUDE.md §6 : < 12 mois OK (FreshnessIndicator orange si > 12 mois).
  if (monthsAgo > 12) {
    return { ok: false, months_ago: Math.round(monthsAgo), source, reason: `last_data_date ${monthsAgo.toFixed(0)} mois (source: ${source})` };
  }
  return { ok: true, months_ago: Math.round(monthsAgo), source };
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

  // Yann 21 mai 2026 (sub-agent #59) : appliquer cap 20% sur heuristic_partial.
  // Tri par priorité : stés avec >=1 entry top_voting OR top_capital d'abord
  // (bloc gouvernance plus complet), puis market_cap décroissant.
  // Au-delà du cap → downgrade vers ok=false (gov manque).
  const totalPublishable = audits.length;
  const heuristicCap = Math.floor(totalPublishable * 0.20);
  const heuristicCandidates = audits
    .filter((a) => a.extensions && a.extensions.g_governance && a.extensions.g_governance.heuristic_partial_candidate)
    .sort((x, y) => {
      const xt = x.extensions.g_governance;
      const yt = y.extensions.g_governance;
      if (xt.has_one_top !== yt.has_one_top) return xt.has_one_top ? -1 : 1;
      const mx = x.market_cap_usd || 0;
      const my = y.market_cap_usd || 0;
      return my - mx;
    });
  let heuristicAccepted = 0;
  let heuristicDowngraded = 0;
  for (const a of heuristicCandidates) {
    const gov = a.extensions.g_governance;
    if (heuristicAccepted < heuristicCap) {
      gov.exception_heuristic_partial = true;
      delete gov.heuristic_partial_candidate;
      heuristicAccepted += 1;
    } else {
      a.extensions.g_governance = {
        ok: false,
        heuristic_partial_capped: true,
        reason: `heuristic_partial éligible mais cap 20% atteint (${heuristicCap}/${totalPublishable})`,
      };
      heuristicDowngraded += 1;
    }
  }

  // Recompute failed_extensions + flags après downgrade cap.
  for (const a of audits) {
    if (!a.fatal) {
      a.failed_extensions = Object.entries(a.extensions).filter(([, v]) => !v.ok).map(([k]) => k);
      a.is_clean_all = a.failed_criteria.length === 0 && a.failed_extensions.length === 0;
    }
  }

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
  // NEW : tracker exceptions h_ai_positioning (stance absent légitime + sector-aware)
  stats.h_ai_positioning_exceptions = {
    stance_absent_legit: 0,
    sector_irrelevant_auto: 0,
    cautious_with_evidence: 0,
    by_sector_irrelevant: {},
  };
  // NEW : tracker exceptions g_governance (ADR unavailable + EU partial + partial_disclosure ≥2)
  stats.g_governance_exceptions = {
    unavailable_adr: 0,
    partial_disclosure_eu_p1: 0,
    partial_disclosure_ok: 0,
    heuristic_partial: 0,
    heuristic_partial_capped: 0,
    heuristic_partial_cap_limit: heuristicCap,
    heuristic_partial_pct_of_total: 0,
    under_20pct_cap_heuristic: true,
    unavailable_adr_pct_of_total: 0,
    under_15pct_cap_adr: true,
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
    // Track exception usage on h_ai_positioning
    const ai = a.extensions && a.extensions.h_ai_positioning;
    if (ai && ai.ok) {
      if (ai.exception_stance_absent) stats.h_ai_positioning_exceptions.stance_absent_legit += 1;
      if (ai.exception_sector_irrelevant || ai.exception_sector_irrelevant_unknown_stance) {
        stats.h_ai_positioning_exceptions.sector_irrelevant_auto += 1;
        const sec = ai.sector || 'unknown';
        stats.h_ai_positioning_exceptions.by_sector_irrelevant[sec] =
          (stats.h_ai_positioning_exceptions.by_sector_irrelevant[sec] || 0) + 1;
      }
      if (ai.stance === 'cautious' && !ai.exception_stance_absent) {
        stats.h_ai_positioning_exceptions.cautious_with_evidence += 1;
      }
    }
    // Track exception usage on g_governance
    const gov = a.extensions && a.extensions.g_governance;
    if (gov) {
      if (gov.ok && gov.exception_unavailable_adr) stats.g_governance_exceptions.unavailable_adr += 1;
      if (gov.ok && gov.partial_disclosure) stats.g_governance_exceptions.partial_disclosure_ok += 1;
      if (gov.ok && gov.exception_heuristic_partial) stats.g_governance_exceptions.heuristic_partial += 1;
      if (!gov.ok && gov.partial_disclosure_eu) stats.g_governance_exceptions.partial_disclosure_eu_p1 += 1;
      if (!gov.ok && gov.heuristic_partial_capped) stats.g_governance_exceptions.heuristic_partial_capped += 1;
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

  // Stats g_governance exceptions + cap 15 % unavailable_adr
  stats.g_governance_exceptions.unavailable_adr_pct_of_total = Number(
    ((stats.g_governance_exceptions.unavailable_adr / stats.total) * 100).toFixed(2)
  );
  stats.g_governance_exceptions.under_15pct_cap_adr =
    stats.g_governance_exceptions.unavailable_adr_pct_of_total < 15;
  stats.g_governance_exceptions.heuristic_partial_pct_of_total = Number(
    ((stats.g_governance_exceptions.heuristic_partial / stats.total) * 100).toFixed(2)
  );
  stats.g_governance_exceptions.under_20pct_cap_heuristic =
    stats.g_governance_exceptions.heuristic_partial_pct_of_total <= 20;

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
  console.log('\nExceptions g_governance (ADR Asia + EU partial + partial_disclosure ≥2) :');
  const gex = stats.g_governance_exceptions;
  console.log(`  unavailable_adr (ADR Asia/HK/CN légitime)     : ${gex.unavailable_adr} (${gex.unavailable_adr_pct_of_total} %)`);
  console.log(`  partial_disclosure_eu_p1 (EU retry pending)   : ${gex.partial_disclosure_eu_p1}`);
  console.log(`  partial_disclosure_ok (ADR/EU avec ≥2 entries): ${gex.partial_disclosure_ok}`);
  console.log(`  heuristic_partial (CEO+voting_note+board_size): ${gex.heuristic_partial} (${gex.heuristic_partial_pct_of_total} %)`);
  console.log(`  heuristic_partial_capped (>20% downgrade)     : ${gex.heuristic_partial_capped} (limit=${gex.heuristic_partial_cap_limit})`);
  console.log(`  cap unavailable_adr < 15 %                    : ${gex.under_15pct_cap_adr ? '✓ OUI' : '✗ NON'}`);
  console.log(`  cap heuristic_partial <= 20 %                 : ${gex.under_20pct_cap_heuristic ? '✓ OUI' : '✗ NON'}`);
  console.log('\nExceptions h_ai_positioning (stance absent légitime + sector-aware) :');
  const hex = stats.h_ai_positioning_exceptions;
  console.log(`  stance_absent_legit (stance=absent dans ai_positioning)   : ${hex.stance_absent_legit}`);
  console.log(`  sector_irrelevant_auto (ai_positioning absent + secteur)  : ${hex.sector_irrelevant_auto}`);
  console.log(`  cautious_with_evidence (stance=cautious + evidence ≥ 1)   : ${hex.cautious_with_evidence}`);
  if (Object.keys(hex.by_sector_irrelevant).length > 0) {
    console.log('  Détail sector_irrelevant_auto par secteur :');
    Object.entries(hex.by_sector_irrelevant)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sec, n]) => console.log(`    ${sec.padEnd(40)} : ${n}`));
  }
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
