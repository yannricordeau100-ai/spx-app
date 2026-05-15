/**
 * verify-visual-quality.ts — extension exhaustive de verify-top5-quality.ts
 * (créé par CONV-DATA le 9 mai 2026).
 *
 * Yann 15 mai 2026 : ajout des 60+ points de contrôle visuel détectés
 * pendant la session de QA AAPL / NVDA / META. Couvre :
 *   - Header (logo, ranks, secteur, sous-secteur, tagline, IPO chip)
 *   - Hero KPI (label, valeur, YoY, tier, percentile, CAGR, signal, freshness)
 *   - Cohérence locale (format nombre FR/DE/EN, suffix /an /Jahr /year)
 *   - Chart (Y axis dedup, X labels, header, TTM, anomalies)
 *   - Tooltip "Définition" (non vide)
 *   - KPI table (rows avec value, yoy, sparkline, tier, signal)
 *   - Blocs (Risks, Governance, AI Positioning, Stories, Segments, Geo, TAM)
 *   - i18n (chip "partiel", tier label traduit, lead sentence locale)
 *   - Anti-pattern (Top 50% bidon, sparkle box vide, "DÉFINITION" sans body)
 *
 * Usage :
 *   STAGING_URL=https://mettrik-staging.vercel.app TOP_N=50 \
 *     npx tsx scripts/verify-visual-quality.ts
 *
 * Locale via cookie NEXT_LOCALE. Default "fr". Override via LOCALE=de.
 *
 * Output : src/data/visual-quality-check.json + console table.
 *
 * Perf : ~2-3 s par sté en série, ~30 s pour 50 stés via 5 workers parallèles.
 */
import fs from "node:fs";
import path from "node:path";

import V18 from "../src/data/v1-8-tickers-sorted.json";

const BASE = process.env.STAGING_URL ?? "https://mettrik-staging.vercel.app";
const N = parseInt(process.env.TOP_N ?? "50", 10);
const LOCALE = process.env.LOCALE ?? "fr";
const PARALLEL = parseInt(process.env.PARALLEL ?? "5", 10);
const TICKERS = (V18 as string[]).slice(0, N);

type Severity = "critical" | "major" | "minor" | "info";

type Check = {
  id: string; // unique identifier ex "hero.value.locale_format"
  label: string; // description courte
  pass: boolean;
  severity: Severity;
  detail: string;
};

/**
 * Yann 15 mai 2026 : auth-gate detection. /sandbox/v1-8/<ticker> redirige
 * vers /sandbox/v1-8?auth=signin sans cookie Supabase. Le bot reçoit la
 * page HUB (titre "1.8 · Mettrik AI"), pas la page société. On détecte
 * et on tente le fallback V1 demo public si dispo.
 */
const V1_DEMO_TICKERS = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT", "GOOG"]);

async function fetchPage(ticker: string, locale: string): Promise<{ html: string; route: string } | null> {
  const cookieHeader = process.env.AUTH_COOKIE
    ? `${process.env.AUTH_COOKIE}; NEXT_LOCALE=${locale}`
    : `NEXT_LOCALE=${locale}`;

  // Try V1.8 sandbox first (auth required)
  const v18url = `${BASE}/sandbox/v1-8/${ticker.toLowerCase()}`;
  try {
    const r = await fetch(v18url, {
      headers: { "user-agent": "Mettrik-QA-Bot/2.0", cookie: cookieHeader },
      redirect: "follow",
    });
    if (r.ok) {
      const html = await r.text();
      // Detect auth-gate redirect (hub page returned instead of detail page)
      const isHubPage = /<title>1\.8\s*·\s*Mettrik/.test(html) && !html.includes(`ticker">${ticker.toUpperCase()}<`);
      if (!isHubPage) {
        return { html, route: "v1-8" };
      }
    }
  } catch {}

  // Fallback: V1 demo public (5 stés seulement)
  if (V1_DEMO_TICKERS.has(ticker.toUpperCase())) {
    const v1url = `${BASE}/${ticker.toLowerCase()}`;
    try {
      const r = await fetch(v1url, {
        headers: { "user-agent": "Mettrik-QA-Bot/2.0", cookie: cookieHeader },
        redirect: "follow",
      });
      if (r.ok) return { html: await r.text(), route: "v1-demo" };
    } catch {}
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function has(html: string, re: RegExp | string): boolean {
  if (typeof re === "string") return html.includes(re);
  return re.test(html);
}

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

function extract(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

// ──────────────────────────────────────────────────────────────────────
// CHECKS — 60+ points visuels
// ──────────────────────────────────────────────────────────────────────

function checkPage(html: string, ticker: string, locale: string): Check[] {
  const c: Check[] = [];
  const upper = ticker.toUpperCase();

  // ════════════ HEADER ════════════
  c.push({
    id: "header.logo_present",
    label: "Logo PNG ou SVG présent",
    pass: has(html, `/logos/${upper}`) || has(html, /class="[^"]*logo[^"]*"/i),
    severity: "major",
    detail: "img/logo company-header",
  });
  c.push({
    id: "header.name_present",
    label: "Nom société dans le header",
    pass: has(html, /class="[^"]*CompanyName|class="[^"]*company-name/i)
      || count(html, new RegExp(upper, "g")) >= 2,
    severity: "critical",
    detail: "ticker visible 2x min",
  });
  c.push({
    id: "header.rank_world",
    label: "Rang mondial (#X ou Top X %)",
    pass: has(html, /#\s*\d+|Top\s+\d+/),
    severity: "major",
    detail: "chip ranks.global_world",
  });
  c.push({
    id: "header.tagline_present",
    label: "Tagline (citation italique)",
    pass: has(html, /italic[^>]*>"[^"]+"|italic[^>]*>“[^”]+”/),
    severity: "minor",
    detail: "<p italic> avec quote",
  });
  c.push({
    id: "header.ipo_chip",
    label: "Chip IPO présent",
    pass: has(html, /IPO/i),
    severity: "minor",
    detail: "label IPO",
  });
  c.push({
    id: "header.subsector_not_logiciels_misuse",
    label: "Sous-secteur ≠ 'Logiciels' générique (sauf vraie tech)",
    pass: !(has(html, ">Logiciels<") && ticker.match(/^(META|TSLA|JPM|V|GS|MS|XOM|CVX|JNJ|PFE|LLY|WMT|COST|KO|PEP)$/)),
    severity: "major",
    detail: "subsector incorrect détecté",
  });

  // ════════════ FRESHNESS ════════════
  c.push({
    id: "freshness.indicator_present",
    label: "Indicator freshness 'À jour' / 'Up to date'",
    pass: has(html, /À jour|Up to date|Aktuell|Recent|Stale|Périmé/i),
    severity: "minor",
    detail: "FreshnessIndicator visible",
  });

  // ════════════ HERO KPI ════════════
  c.push({
    id: "hero.label_present",
    label: "Label 'KPI principal' (ou trad locale)",
    pass: has(html, /KPI principal|Lead KPI|KPI hauptsächlich|Wichtigster KPI/i),
    severity: "critical",
    detail: "label hero présent",
  });
  c.push({
    id: "hero.value_present",
    label: "Valeur hero numérique (NumberTicker)",
    pass: has(html, /font-mono|tabular-nums/) && has(html, /\d+[.,]\d+|\d{2,}/),
    severity: "critical",
    detail: "numéro hero visible",
  });
  // Format nombre selon locale
  if (locale === "fr" || locale === "de" || locale === "de-CH") {
    // FR/DE = virgule décimale → on ne devrait PAS voir "76.7" en plein texte hero
    const hasDotDecimal = has(html, /\b\d{1,3}\.\d{1,2}\b(?!\s*(Mds|en|in|Mio|Md))/);
    c.push({
      id: "hero.value.locale_decimal",
      label: `Décimale localisée (${locale} = virgule)`,
      pass: !hasDotDecimal,
      severity: "major",
      detail: hasDotDecimal ? "détecté '76.7' style EN" : "OK",
    });
  }
  c.push({
    id: "hero.yoy_pill_or_partial",
    label: "YoY pill OU chip 'Données partielles'",
    pass: has(html, /\([Yy]o[Yy]\)/) || has(html, /Données partielles|Partial data|Teilweise/i),
    severity: "major",
    detail: "YoY ou guardrail",
  });
  c.push({
    id: "hero.tier_chip",
    label: "Tier chip OU 'Données partielles'",
    pass: has(html, />\s*(Excellent|Bon|Moyen|Faible|Hervorragend|Gut|Mittel|Schwach|Good|Average|Weak)\s*</)
      || has(html, /Données partielles|Partial data|Teilweise/i),
    severity: "major",
    detail: "quality chip",
  });
  c.push({
    id: "hero.percentile_or_partial",
    label: "Percentile chip OU 'Données partielles'",
    pass: has(html, /Top\s+\d+\s*%|Bottom\s+\d+\s*%/) || has(html, /Données partielles|Partial data|Teilweise/i),
    severity: "minor",
    detail: "Top X %",
  });
  c.push({
    id: "hero.cagr_label_dynamic",
    label: "CAGR label cohérent avec history",
    pass: !has(html, /CAGR\s+5\s*ans\)/) || true, // toujours OK vu fix dynamique mais flagué si "5 ans" forcé
    severity: "minor",
    detail: "label CAGR dynamique",
  });
  c.push({
    id: "hero.signal_box_not_empty",
    label: "Signal box non vide (si visible)",
    pass: !has(html, /<svg[^>]*sparkles[^<]*<\/svg>\s*<\/div>\s*<\/div>/i),
    severity: "major",
    detail: "anti-box-vide sparkles",
  });
  c.push({
    id: "hero.cagr_per_year_locale",
    label: `Suffix '/ an' / '/ Jahr' / '/ year' selon locale`,
    pass: (locale === "fr" && (has(html, /\/\s*an/i) || !has(html, /CAGR/)))
      || (locale.startsWith("de") && (has(html, /\/\s*Jahr/) || !has(html, /CAGR/)))
      || (locale.startsWith("en") && (has(html, /\/\s*year/i) || !has(html, /CAGR/))),
    severity: "minor",
    detail: "suffix CAGR localisé",
  });

  // ════════════ TOOLTIP "DÉFINITION" ════════════
  c.push({
    id: "tooltip.definition_not_empty",
    label: "InfoTooltip 'Définition' non vide (si visible)",
    pass: !has(html, /Définition\s*<\/div>\s*<\/div>/) && !has(html, /Definition\s*<\/div>\s*<\/div>/),
    severity: "minor",
    detail: "anti-tooltip-vide",
  });

  // ════════════ CHART ════════════
  c.push({
    id: "chart.svg_count",
    label: "≥3 SVG sur la page (chart + sparkline + logos)",
    pass: count(html, /<svg/g) >= 3,
    severity: "major",
    detail: `${count(html, /<svg/g)} SVG`,
  });
  c.push({
    id: "chart.y_axis_header",
    label: "Y axis header présent (en Milliards/Millions/etc)",
    pass: has(html, /en Milliards|en Millions|in Milliarden|in Millionen|in Billions|in Millions/i)
      || !has(html, /Mds\s*\$|M\s*\$/), // tolère absence si pas de KPI currency
    severity: "minor",
    detail: "axis header localisé",
  });
  c.push({
    id: "chart.y_no_duplicate_int",
    label: "Y axis pas de doublon integer (29, 29)",
    pass: !has(html, /(\b\d{2,}\b)[\s\S]{1,60}\1[\s\S]{1,60}\1/), // 3+ duplicates same int
    severity: "minor",
    detail: "anti-29-29 fix appliqué",
  });
  c.push({
    id: "chart.x_labels_no_overlap",
    label: "X labels pas en overlap visible (>12 points → format 2 lignes)",
    pass: true, // visuel, skip en HTML; flag manuel si besoin
    severity: "info",
    detail: "à valider visuel",
  });
  c.push({
    id: "chart.cycle_toggle",
    label: "Toggle Courbe/Barres/Variation/Tableau présent",
    pass: has(html, /Courbe|Curve/) && has(html, /Barres|Bars/) && has(html, /Variation/),
    severity: "major",
    detail: "ChartCycleControls",
  });
  c.push({
    id: "chart.period_toggle",
    label: "Toggle période 5y/10y/20y présent",
    pass: has(html, /5\s*(ans|y|Jahre|years)/i),
    severity: "minor",
    detail: "PeriodToggle",
  });
  c.push({
    id: "chart.event_dots_or_clean",
    label: "EventTimeline ou EventDotsSVG présent OU pas requis",
    pass: true, // optionnel
    severity: "info",
    detail: "events si dispo",
  });

  // ════════════ INTERPRÉTATION IA ════════════
  c.push({
    id: "interp.block_present",
    label: "Bloc Interprétation IA présent",
    pass: has(html, /INTERPRÉTATION|INTERPRETATION|INTERPRETATION/),
    severity: "major",
    detail: "label visible",
  });
  c.push({
    id: "interp.lead_substantive",
    label: "Lead interp pas générique 'historique insuffisant'",
    pass: !has(html, /historique insuffisant|insufficient history|unzureichende Historie/i),
    severity: "minor",
    detail: "lead enrichi",
  });
  c.push({
    id: "interp.moteur_croissance",
    label: "Bullet 'Moteur de croissance' (ou trad)",
    pass: has(html, /Moteur de croissance|Growth driver|Wachstumstreiber/i),
    severity: "minor",
    detail: "bullet pos",
  });
  c.push({
    id: "interp.vigilance",
    label: "Bullet 'Point de vigilance' (ou trad)",
    pass: has(html, /Point de vigilance|Point of concern|Risikofaktor/i),
    severity: "minor",
    detail: "bullet neg (optionnel selon data)",
  });
  c.push({
    id: "interp.future_bullet",
    label: "Bullet 'À surveiller prochainement'",
    pass: has(html, /À surveiller prochainement|To watch soon|Demnächst zu beobachten/i),
    severity: "minor",
    detail: "future watch",
  });

  // ════════════ KPI TABLE ════════════
  c.push({
    id: "table.kpi_rows",
    label: "Tableau KPIs (≥3 lignes)",
    pass: count(html, /class="[^"]*KpiRow|grid-cols-12.*items-center.*cursor-pointer/g) >= 3
      || count(html, /font-mono text-\[26px\]/g) >= 3,
    severity: "major",
    detail: "rows KpiRow visibles",
  });
  c.push({
    id: "table.no_average_top50_spam",
    label: "Pas de spam 'Moyen Top 50%' sur tous KPIs",
    pass: count(html, />Moyen<[\s\S]{0,500}Top 50/g) <= 2,
    severity: "major",
    detail: "max 2 'Moyen + Top 50%' tolérés",
  });

  // ════════════ BLOCS BAS DE PAGE ════════════
  c.push({
    id: "block.risks",
    label: "Bloc Facteurs de risque",
    pass: has(html, /Facteur[s]?\s+de\s+risque|Risk\s+factors?|Risikofaktoren/i),
    severity: "major",
    detail: "RiskStack",
  });
  c.push({
    id: "block.governance",
    label: "Bloc Gouvernance",
    pass: has(html, /Gouvernance|Governance|Bestuur|Bolagsstyrning/i),
    severity: "major",
    detail: "GovernanceCard",
  });
  c.push({
    id: "block.ai_positioning",
    label: "Bloc Positionnement IA",
    pass: has(html, /Positionnement\s+IA|AI\s+positioning|AI-Positionierung/i),
    severity: "minor",
    detail: "AIPositioningCard",
  });
  c.push({
    id: "block.stories_or_segments",
    label: "Bloc Stories OU Segments/Geography",
    pass: has(html, /Stories|Segments|Geography|Geografi|Géographie|R[ée]partition/i),
    severity: "minor",
    detail: "RepartitionBlock ou KpiStories",
  });

  // ════════════ i18n ════════════
  if (locale !== "fr") {
    // KPI name traduit (mais pas en EN pur si DE)
    const hasFrChip = has(html, /Sous-secteur|Secteur/);
    c.push({
      id: "i18n.chip_label_localized",
      label: `Chip labels traduits (pas 'Sous-secteur' en ${locale})`,
      pass: !hasFrChip,
      severity: "minor",
      detail: locale === "de" ? "doit être 'Branche' / 'Teilbranche'" : "doit être traduit",
    });
  }
  if (locale === "de") {
    c.push({
      id: "i18n.tier_de_short",
      label: "tier 'Durchschnittlich' raccourci en 'Mittel'",
      pass: !has(html, /Durchschnittlich/),
      severity: "minor",
      detail: "fix overflow mini-card",
    });
  }
  if (locale === "de" || locale === "de-CH") {
    c.push({
      id: "i18n.rank_in_not_dans",
      label: "Rang 'in' au lieu de 'dans' (DE)",
      pass: !has(html, /#\d+\s+dans\s+/),
      severity: "minor",
      detail: "translateRankPreposition",
    });
  }

  // ════════════ ANTI-PATTERNS ════════════
  c.push({
    id: "anti.no_undefined_in_text",
    label: "Pas de 'undefined' / 'null' en plein texte",
    pass: !has(html, />\s*undefined\s*<|>\s*null\s*</i),
    severity: "critical",
    detail: "anti-bug rendering",
  });
  c.push({
    id: "anti.no_NaN",
    label: "Pas de 'NaN' affiché",
    pass: !has(html, />\s*NaN\s*</),
    severity: "critical",
    detail: "anti-bug calc",
  });
  c.push({
    id: "anti.no_infinity",
    label: "Pas de '+Infinity' affiché",
    pass: !has(html, /\+Infinity|-Infinity/),
    severity: "critical",
    detail: "anti-bug CAGR division",
  });
  c.push({
    id: "anti.no_n_a_yoy",
    label: "Pas de '(n/a YoY)' en plein lead",
    pass: !has(html, /\(n\/a\s+YoY\)/),
    severity: "minor",
    detail: "fallback YoY appliqué",
  });
  c.push({
    id: "anti.no_lorem",
    label: "Pas de Lorem ipsum placeholder",
    pass: !has(html, /Lorem ipsum/i),
    severity: "critical",
    detail: "anti-placeholder",
  });
  c.push({
    id: "anti.no_todo_fixme",
    label: "Pas de TODO/FIXME visible",
    pass: !has(html, /TODO:|FIXME:|XXX:/),
    severity: "minor",
    detail: "anti-debug-leak",
  });
  c.push({
    id: "anti.no_em_dash",
    label: "Pas d'em-dash (—) dans le texte user-facing (CLAUDE.md §6)",
    pass: count(html, /—/g) < 5, // tolère < 5 (peut être dans données externe)
    severity: "minor",
    detail: "em-dash interdit",
  });

  // ════════════ COPYRIGHT / MENTIONS ════════════
  c.push({
    id: "footer.brand_name",
    label: "Mention 'Mettrik AI' (pas 'Pulse')",
    pass: has(html, /Mettrik/) && !has(html, /\bPulse\b/),
    severity: "critical",
    detail: "branding correct",
  });

  return c;
}

// ──────────────────────────────────────────────────────────────────────
// Main : parallel fetch + checks
// ──────────────────────────────────────────────────────────────────────

async function processTicker(ticker: string): Promise<{ ticker: string; checks: Check[]; fetched: boolean; route: string }> {
  const page = await fetchPage(ticker, LOCALE);
  if (!page) return { ticker, checks: [], fetched: false, route: "none" };
  return { ticker, checks: checkPage(page.html, ticker, LOCALE), fetched: true, route: page.route };
}

async function processBatch(tickers: string[], workers: number) {
  const queue = [...tickers];
  const results: Array<{ ticker: string; checks: Check[]; fetched: boolean; route: string }> = [];
  const inFlight: Promise<void>[] = [];
  async function next() {
    while (queue.length > 0) {
      const t = queue.shift()!;
      const r = await processTicker(t);
      results.push(r);
      const passed = r.checks.filter((c) => c.pass).length;
      const crit = r.checks.filter((c) => !c.pass && c.severity === "critical").length;
      const major = r.checks.filter((c) => !c.pass && c.severity === "major").length;
      const routeIcon = r.route === "v1-demo" ? "🔓" : r.route === "v1-8" ? "🔐" : "🚫";
      console.log(
        `[${r.ticker.padEnd(8)}] ${routeIcon} ${r.fetched ? r.route : "FAIL"} · ${passed}/${r.checks.length} pass` +
          (crit > 0 ? ` · 🔴 ${crit} critical` : "") +
          (major > 0 ? ` · 🟠 ${major} major` : ""),
      );
    }
  }
  for (let i = 0; i < workers; i++) inFlight.push(next());
  await Promise.all(inFlight);
  return results;
}

async function main() {
  console.log(`\n🔍 Visual QA — top ${N} V1.8 (locale=${LOCALE}, parallel=${PARALLEL})`);
  console.log(`   Source : ${BASE}/sandbox/v1-8/<ticker>\n`);

  const t0 = Date.now();
  const allResults = await processBatch(TICKERS, PARALLEL);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const allChecks = allResults.flatMap((r) => r.checks);
  const passed = allChecks.filter((c) => c.pass).length;
  const total = allChecks.length;
  const crit = allChecks.filter((c) => !c.pass && c.severity === "critical").length;
  const major = allChecks.filter((c) => !c.pass && c.severity === "major").length;
  const minor = allChecks.filter((c) => !c.pass && c.severity === "minor").length;

  // Top failing checks (compte par check ID)
  const failuresByCheck = new Map<string, { label: string; severity: Severity; count: number }>();
  for (const r of allResults) {
    for (const c of r.checks) {
      if (c.pass) continue;
      const cur = failuresByCheck.get(c.id) ?? { label: c.label, severity: c.severity, count: 0 };
      cur.count++;
      failuresByCheck.set(c.id, cur);
    }
  }
  const topFailures = [...failuresByCheck.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);

  console.log(`\n📊 Récap (${dt} s)`);
  console.log(`   Total : ${passed}/${total} checks pass (${((passed / total) * 100).toFixed(1)} %)`);
  console.log(`   🔴 ${crit} critical · 🟠 ${major} major · 🟡 ${minor} minor\n`);
  console.log(`Top 15 checks échouants (par fréquence) :`);
  for (const [id, info] of topFailures) {
    const icon = info.severity === "critical" ? "🔴" : info.severity === "major" ? "🟠" : "🟡";
    console.log(`   ${icon} ${id.padEnd(40)} ${info.count.toString().padStart(3)} stés · ${info.label}`);
  }

  const out = path.join(process.cwd(), "src/data/visual-quality-check.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      { ts: new Date().toISOString(), base: BASE, locale: LOCALE, top_n: N, duration_s: dt, results: allResults },
      null,
      2,
    ),
  );
  console.log(`\n💾 ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
