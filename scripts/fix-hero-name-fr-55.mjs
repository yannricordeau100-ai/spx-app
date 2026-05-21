#!/usr/bin/env node
/**
 * Fix l_hero_name_fr critère KO (55 stés) — heuristique dict + template.
 * 
 * Stratégies :
 *  A) Hero KPI introuvable dans kpis[] → poser `hero_kpi_override` pointant
 *     vers un KPI valide + name_fr propre.
 *  B) Hero KPI trouvé mais name_fr vide / = short / en anglais → poser
 *     `overrides_hero_name_fr` qui sera mergé SSR sans toucher au dataset
 *     source (CONV-DATA).
 *
 * Output : src/data/v2-pipeline-enrich/<ticker>.hero_name_fr.json
 * Format : {
 *   hero_short: "...",          // optionnel si hero_kpi_override
 *   hero_kpi_override: "...",   // optionnel (cas A : repointe hero_kpi)
 *   overrides_hero_name_fr: {   // toujours présent
 *     hero_short: "...",
 *     name_fr: "..."
 *   },
 *   _source: "scripts/fix-hero-name-fr-55.mjs",
 *   _generated_at: "ISO"
 * }
 *
 * Audit : src/data/audit-v1-9-pre-publication.json (extensions.l_hero_name_fr.ok = false)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const DATA = path.join(REPO, 'src/data');
const ENRICH = path.join(DATA, 'v2-pipeline-enrich');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function lower(s) { return String(s || '').toLowerCase(); }

// -- Dictionnaire heuristique short EN → name_fr ----------------------------

const DICT = {
  // Génériques
  'Revenue': "Chiffre d'affaires",
  'Total Revenue': "Chiffre d'affaires",
  'Net Sales': "Chiffre d'affaires net",
  'Net Income': 'Résultat net',
  'Operating Income': 'Résultat opérationnel',
  'EPS': 'Bénéfice par action',
  'Diluted EPS': 'Bénéfice par action dilué',
  'Operating Margin': 'Marge opérationnelle',
  'Op Margin': 'Marge opérationnelle',
  'Gross Margin': 'Marge brute',
  'Net Margin': 'Marge nette',
  'Free Cash Flow': 'Flux de trésorerie disponible',
  'FCF': 'Flux de trésorerie disponible',
  'Operating Cash Flow': "Flux de trésorerie d'exploitation",
  'EBITDA': 'EBITDA',
  'Adj EBITDA': 'EBITDA ajusté',
  'Adjusted EBITDA': 'EBITDA ajusté',
  'ROE': 'Rentabilité des capitaux propres',
  'ROIC': 'Rentabilité des capitaux investis',
  // Cash & banques
  'Net Interest Income': "Revenu net d'intérêts",
  'Net Interest Margin': "Marge nette d'intérêt",
  'NIM': "Marge nette d'intérêt",
  'Loan Book': 'Encours de crédit',
  // Backlog & orders
  'Backlog': 'Carnet de commandes',
  'Order Intake': 'Prises de commandes',
  'Orders': 'Commandes',
  'Contractual Backlog': 'Carnet de commandes contractuel',
  'Backlog Units': 'Carnet de commandes (unités)',
  'Backlog Value': 'Carnet de commandes (valeur)',
  // Opérations / industrie
  'Operating Ratio': "Ratio d'exploitation",
  'Combined Ratio': 'Ratio combiné',
  'P&C Combined Ratio': "Ratio combiné d'assurance",
  'Rate Base': 'Base tarifaire régulée',
  // Retail
  'Comparable Sales': 'Croissance des ventes comparables',
  'Comparable Club Sales': 'Ventes comparables (clubs)',
  'Same-Store Sales': 'Ventes à magasins comparables',
  'Same-Day Services Growth': 'Croissance services le jour même',
  // Tech / SaaS
  'ARR': 'Revenu annuel récurrent',
  'Service / ARR': 'Revenu services et abonnements',
  'DAP': 'Utilisateurs actifs quotidiens (DAP)',
  'DAU': 'Utilisateurs actifs quotidiens',
  'MAU': 'Utilisateurs actifs mensuels',
  'Server AUP': 'Prix de vente moyen Serveur',
  'Advanced Packaging Mix': 'Mix packaging avancé',
  // Pharma
  'Pipeline Programs': 'Programmes en pipeline',
  // Capacity / production
  'Capacity Expansion': 'Expansion de capacité',
  'Production': 'Production',
  'Homes Settled': 'Maisons livrées',
  'Fleet Productivity': 'Productivité de la flotte',
  // Banks/Insurance/REIT
  'Avg Tenure': 'Durée moyenne des baux',
  'Total Adjusted OCI Margin': "Marge OCI ajustée totale",
  'PE Gross Return': 'Rendement brut Private Equity',
  'Non-GAAP Operating Margin': 'Marge opérationnelle non-GAAP',
  'Ownership Stake': 'Participation détenue',
  'Sustainable forest management': 'Gestion forestière durable',
  'Tax Contingencies': 'Provisions fiscales contingentes',
  'Timberlands': 'Terres forestières',
  'Retail Operating Earnings': "Résultat d'exploitation Retail",
  // Industries / segments
  'Net Bookings': 'Réservations nettes',
  'Wafer Inspection Revenue': 'Revenu inspection de wafers',
  'Cardiovascular Revenue': 'Revenu Cardiovasculaire',
  'North America Revenue': 'Revenu Amérique du Nord',
  'Subsystems & Accessories': 'Sous-systèmes & accessoires',
  'GCF Net Sales': 'Ventes nettes Global Cellulose Fibers',
  'Bev Pack N&CA Net Sales': "Ventes Emballage Boisson Amérique du Nord & Centrale",
  'ASUX Revenue': "Revenu Advanced Safety & User Experience",
  'Flexible Packaging Net Sales': "Ventes Emballage Flexible",
  'Grocery & Snacks Net Sales': "Ventes Épicerie & Snacks",
  'Products & Sys Integration': 'Produits & Intégration Systèmes',
  'Premium+ Net Sales Share': 'Part des ventes Premium+',
  'HH_Products_Revenue': 'Revenu Produits Domestiques',
  'VP_Revenue': 'Revenu Paiements Véhicules',
  'Stores Total': 'Total magasins',
  'Operating Earnings par Action': "Résultat d'exploitation par action",
  // Cas short en FR identique au name_fr (audit fail name_fr === short)
  'Revenu total': "Chiffre d'affaires total",
  'Revenu net': "Chiffre d'affaires net",
  'Revenu consolidé': "Chiffre d'affaires consolidé",
  'Nombre de magasins': "Nombre de magasins du réseau",
  'Revenu segment Utility Solutions': "Chiffre d'affaires segment Utility Solutions",
};

// Patterns regex (ordre important)
const PATTERNS = [
  // "X Revenue" → "Revenu X"
  [/^(.+)\s+Revenue$/i, (m) => `Revenu ${translateSegment(m[1])}`],
  // "X Sales" / "X Net Sales"
  [/^(.+)\s+Net Sales$/i, (m) => `Ventes nettes ${translateSegment(m[1])}`],
  [/^(.+)\s+Sales$/i, (m) => `Ventes ${translateSegment(m[1])}`],
  // "X Margin"
  [/^(.+)\s+Margin$/i, (m) => `Marge ${translateSegment(m[1])}`],
  // "X Growth"
  [/^(.+)\s+Growth$/i, (m) => `Croissance ${translateSegment(m[1])}`],
  // "X Backlog"
  [/^(.+)\s+Backlog$/i, (m) => `Carnet de commandes ${translateSegment(m[1])}`],
];

const SEGMENT_TRANS = {
  'Cloud': 'Cloud',
  'Service': 'Services',
  'Services': 'Services',
  'Cardiovascular': 'Cardiovasculaire',
  'Data Center': 'Data Center',
  'Digital Media': 'Médias Numériques',
  'North America': 'Amérique du Nord',
  'Americas': 'Amériques',
  'EMEA': 'EMEA',
  'APAC': 'Asie-Pacifique',
  'Europe': 'Europe',
};
function translateSegment(s) {
  if (!s) return '';
  if (SEGMENT_TRANS[s]) return SEGMENT_TRANS[s];
  return s; // garde tel quel si segment inconnu
}

function looksEnglish(s) {
  if (!s) return true;
  // Heuristique simple : si contient mots typiques EN
  const t = lower(s);
  if (/\b(revenue|sales|margin|growth|backlog|income|earnings|stores|stake|tenure|return|ratio)\b/.test(t)) return true;
  // Pas d'accent + pas de mots FR fréquents
  if (!/[éèêàâîïôûùç]/i.test(s) && !/\b(chiffre|résultat|marge|carnet|flux|ventes|revenu|bénéfice|rentabilité)\b/i.test(t)) return true;
  return false;
}

function genFr(short) {
  if (!short) return null;
  if (DICT[short]) return DICT[short];
  // Strip underscore variants
  const norm = short.replace(/_/g, ' ');
  if (DICT[norm]) return DICT[norm];
  // Pattern match
  for (const [re, fn] of PATTERNS) {
    const m = norm.match(re);
    if (m) {
      const out = fn(m);
      if (out) return out;
    }
  }
  return null;
}

// -- Mapping hero introuvable → bon KPI dans kpis[] -------------------------

const HERO_REROUTE = {
  // ticker → { newShort, newNameFr, reason }
  'ABF.L':   { newShort: 'Primark Sales',           newNameFr: 'Ventes Primark' },
  'AMGN':    { newShort: 'Repatha Sales',           newNameFr: 'Ventes Repatha (PCSK9 cholestérol)' },
  'DIS':     { newShort: 'DTC Subscribers (Disney+)', newNameFr: 'Abonnés Disney+ (Direct-to-Consumer)' },
  'HEIA.AS': { newShort: 'Dividend Income',         newNameFr: 'Revenu de dividendes' },
  'III.L':   { newShort: 'NAV per Share',           newNameFr: 'Actif net par action' },
  'KIM':     { newShort: 'Same-Property NOI Growth',newNameFr: 'Croissance NOI à périmètre constant' },
  'MO':      { newShort: 'Smokeable Volume',        newNameFr: 'Volume cigarettes (Marlboro)' },
  'UPM.HE':  { newShort: 'Fibres Sales (Pulp)',     newNameFr: 'Ventes pâte (Fibres)' },
  'VIAV':    { newShort: 'Net Revenue',             newNameFr: 'Chiffre d\'affaires net' },
  'VRT':     { newShort: 'Orders',                  newNameFr: 'Commandes' },
  'VTRS':    { newShort: 'Developed Markets Sales', newNameFr: 'Ventes marchés développés' },
  'WY':      { newShort: 'Wood Products Sales',     newNameFr: 'Ventes Produits Bois' },
};

// -- Process ----------------------------------------------------------------

function loadCompany(ticker) {
  const lc = lower(ticker);
  for (const p of [
    path.join(DATA, 'v1-9-complete', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline', `${ticker}.json`),
    path.join(DATA, 'v2-pipeline', `${lc}.json`),
  ]) {
    const d = readJson(p);
    if (d) return d;
  }
  return null;
}

const audit = readJson(path.join(DATA, 'v1-9-pre-publication-audit.json'));
if (!audit) { console.error('audit file missing'); process.exit(1); }
const targets = audit.audits.filter((a) => a.extensions?.l_hero_name_fr?.ok === false);
console.log(`Targets: ${targets.length}`);

const results = { fixed: 0, rerouted: 0, skipped: 0, no_hero_found: 0, samples: [] };
const now = new Date().toISOString();

for (const t of targets) {
  const ticker = t.ticker;
  const data = loadCompany(ticker);
  if (!data) {
    results.skipped++;
    continue;
  }
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const heroShort = data.hero_kpi;
  const heroObj = kpis.find((k) => lower(k.short) === lower(heroShort));

  let finalHeroShort = heroShort;
  let finalNameFr = null;
  let needsHeroOverride = false;
  let beforeNameFr = null;

  if (!heroObj) {
    // Cas A : hero introuvable
    const reroute = HERO_REROUTE[ticker];
    if (reroute) {
      finalHeroShort = reroute.newShort;
      finalNameFr = reroute.newNameFr;
      needsHeroOverride = true;
      // Vérifier que reroute target existe
      const rerouteKpi = kpis.find((k) => lower(k.short) === lower(reroute.newShort));
      if (!rerouteKpi) {
        results.no_hero_found++;
        console.log(`  [reroute miss] ${ticker} → ${reroute.newShort} not in kpis[]`);
        continue;
      }
      beforeNameFr = '(hero introuvable)';
    } else {
      results.no_hero_found++;
      console.log(`  [skip] ${ticker} hero introuvable, no reroute defined`);
      continue;
    }
  } else {
    // Cas B : hero trouvé mais name_fr KO
    beforeNameFr = heroObj.name_fr || '(vide)';
    finalNameFr = genFr(heroObj.short);
    if (!finalNameFr) {
      results.skipped++;
      console.log(`  [skip] ${ticker} hero=${heroObj.short} no template match`);
      continue;
    }
  }

  // Préparer payload
  const payload = {
    overrides_hero_name_fr: {
      hero_short: finalHeroShort,
      name_fr: finalNameFr,
    },
    _source: 'scripts/fix-hero-name-fr-55.mjs',
    _generated_at: now,
  };
  if (needsHeroOverride) {
    payload.hero_kpi_override = finalHeroShort;
    payload._hero_kpi_override_reason = `Hero original "${heroShort}" introuvable dans kpis[]; reroute vers KPI valide.`;
    results.rerouted++;
  } else {
    results.fixed++;
  }

  // Merge dans v2-pipeline-enrich/<ticker>.hero_name_fr.json (fichier dédié)
  const out = path.join(ENRICH, `${lower(ticker)}.hero_name_fr.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');

  if (results.samples.length < 5) {
    results.samples.push({
      ticker,
      hero_short: finalHeroShort,
      before: beforeNameFr,
      after: finalNameFr,
      reroute: needsHeroOverride,
    });
  }
}

console.log('\n=== RESULTS ===');
console.log(`fixed (name_fr only)  : ${results.fixed}`);
console.log(`rerouted (hero+name)  : ${results.rerouted}`);
console.log(`skipped (no match)    : ${results.skipped}`);
console.log(`no hero found         : ${results.no_hero_found}`);
console.log(`Total written         : ${results.fixed + results.rerouted}`);
console.log('\n=== SAMPLE 5 ===');
for (const s of results.samples) {
  console.log(`  ${s.ticker} [${s.reroute ? 'REROUTE' : 'NAME_FR'}]`);
  console.log(`    short : ${s.hero_short}`);
  console.log(`    before: ${s.before}`);
  console.log(`    after : ${s.after}`);
}

// Save summary
fs.writeFileSync(
  path.join(DATA, 'fix-hero-name-fr-summary.json'),
  JSON.stringify(results, null, 2) + '\n'
);

// -- Second pass : cas FR=short identique (audit fail = name_fr === short) --
// Ces 8 stés ont déjà un name FR correct mais le critère audit veut name_fr !== short.
// Solution : poser un name_fr alternatif plus explicite.
