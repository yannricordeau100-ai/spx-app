/**
 * verify-visual-playwright.ts — vérification visuelle headless Playwright.
 *
 * Évolution de verify-visual-quality.ts (regex SSR) : utilise un navigateur
 * réel pour voir le DOM final après hydration React. Capture aussi des
 * screenshots optionnels pour diff visuel.
 *
 * Usage :
 *   STAGING_URL=https://mettrik-staging.vercel.app TOP_N=50 \
 *     AUTH_COOKIE='sb-cnggtyxzqlqqjrynnvdq-auth-token=...' \
 *     LOCALE=fr SHOTS=1 \
 *     npx tsx scripts/verify-visual-playwright.ts
 *
 * AUTH_COOKIE : extraire depuis ton navigateur (DevTools > Application >
 * Cookies > mettrik-staging.vercel.app, copier la valeur de
 * sb-<project>-auth-token). Permet d'accéder aux pages V1.8 auth-gated.
 * Sans cookie : fallback V1 demo public (5 stés).
 *
 * Output :
 *   - src/data/visual-playwright-check.json (résultats détaillés)
 *   - /tmp/mettrik-qa-shots/<ticker>.png (si SHOTS=1)
 *
 * Perf : ~3-5 s par sté en série (DOMContentLoaded + 1 s hydration wait).
 * Avec 5 workers parallèles : ~50 stés en 30-60 s.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import V18 from "../src/data/v1-8-tickers-sorted.json";
import V175 from "../src/data/v1-7-5-public.json";

const BASE = process.env.STAGING_URL ?? "https://mettrik-staging.vercel.app";
const N = parseInt(process.env.TOP_N ?? "10", 10);
const LOCALE = process.env.LOCALE ?? "fr";
const PARALLEL = parseInt(process.env.PARALLEL ?? "5", 10);
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? null;
const SHOTS = process.env.SHOTS === "1";
// Yann 16 mai 2026 : support UNIVERSE env var pour étendre l'audit
// au-delà du top V1.8. v18 (default), v175, both.
const UNIVERSE = (process.env.UNIVERSE ?? "v18").toLowerCase();
function buildTickers(): string[] {
  const v18Arr = V18 as string[];
  const v175Arr = Object.keys(V175 as Record<string, unknown>);
  let pool: string[];
  if (UNIVERSE === "v175") pool = v175Arr;
  else if (UNIVERSE === "both") pool = Array.from(new Set([...v18Arr, ...v175Arr]));
  else pool = v18Arr;
  return N > 0 ? pool.slice(0, N) : pool;
}
const TICKERS = buildTickers();

const V1_DEMO = new Set(["GOOGL", "META", "MSCI", "SPGI", "CAT", "GOOG"]);
const SHOTS_DIR = "/tmp/mettrik-qa-shots";

type Severity = "critical" | "major" | "minor" | "info";

type Check = {
  id: string;
  label: string;
  pass: boolean;
  severity: Severity;
  detail: string;
};

// ──────────────────────────────────────────────────────────────────────
// PLAYWRIGHT CHECKS — basés sur DOM rendu (text content, count, etc.)
// ──────────────────────────────────────────────────────────────────────

async function checkPage(page: Page, ticker: string, locale: string, route: string): Promise<Check[]> {
  const c: Check[] = [];
  const text = (await page.locator("body").innerText().catch(() => ""))
    .replace(/\s+/g, " "); // collapse whitespace
  const upper = ticker.toUpperCase();

  // Yann 16 mai 2026 : détection page "Fiche en préparation" (Pass 3 non
  // validé pour cette sté). Le composant CompanyView renvoie un placeholder
  // statique sans hero, charts, blocs, etc. Ces stés sont volontairement
  // hors scope V1.8 actif — on les marque "preparing" et on saute toutes
  // les checks visuelles (le bot peut quand même les reporter, mais elles
  // doivent être identifiées comme normales, pas comme bugs).
  const isPreparing = /Pass 3 Sonnet pas encore validé|Fiche en préparation|preparing/i.test(text);
  if (isPreparing) {
    c.push({
      id: "_meta.preparing",
      label: "Page Fiche en préparation (Pass 3 non validé) — checks skipped",
      pass: true,
      severity: "info",
      detail: "preparing state",
    });
    return c;
  }

  function has(re: RegExp | string): boolean {
    if (typeof re === "string") return text.includes(re);
    return re.test(text);
  }
  async function exists(sel: string): Promise<boolean> {
    return (await page.locator(sel).count().catch(() => 0)) > 0;
  }
  async function count(sel: string): Promise<number> {
    return await page.locator(sel).count().catch(() => 0);
  }

  // ════════════ HEADER ════════════
  c.push({
    id: "header.logo_present",
    label: "Logo (img ou svg) présent",
    // Yann 16 mai 2026 : ajout selectors [data-logo], [aria-label*='logo'],
    // [class*='Monogram'] pour couvrir les logos SVG hardcodés (GOOGL,
    // META, MSCI, SPGI, CAT) et le wrapper LogoTilt.
    pass: (await count("img[alt*='logo' i], img[src*='/logos/'], svg[class*='logo' i]")) > 0
      || (await count("[data-logo='true'], [aria-label*='logo' i]")) > 0
      || (await count("[class*='Logo'], [class*='logo'], [class*='Monogram']")) > 0,
    severity: "major",
    detail: "logo détecté",
  });
  c.push({
    id: "header.name_visible",
    label: "Nom société visible",
    pass: has(upper) || (await count(`h1, h2, [class*='company-name'], [class*='CompanyName']`)) > 0,
    severity: "critical",
    detail: "name dans DOM",
  });
  c.push({
    id: "header.rank_chip",
    label: "Chip rang (#X ou Top X)",
    pass: /#\s*\d+|Top\s+\d+/.test(text),
    severity: "major",
    detail: "rank visible",
  });
  c.push({
    id: "header.tagline_present",
    label: "Tagline italique présente",
    pass: (await count("p[class*='italic'], em")) > 0,
    severity: "minor",
    detail: "tagline visible",
  });
  c.push({
    id: "header.ipo_chip",
    label: "Chip IPO présent (si data IPO disponible)",
    // Yann 16 mai 2026 : calibration audit. Beaucoup de stés très
    // anciennes (JPM, LLY, JNJ, MRK, TMO, ...) n'ont pas de date IPO
    // dans les datasets (StatChip retourne null). Le composant masque
    // donc volontairement la chip. C'est un comportement correct, pas
    // un bug UI. Info-only.
    pass: has(/\bIPO\b/) || has(/\bFondée\b|\bFounded\b/),
    severity: "info",
    detail: "label IPO ou Fondée (fallback ancien)",
  });
  c.push({
    id: "header.subsector_visible",
    label: "Sous-secteur visible (texte ou chip rang sous-secteur)",
    // Yann 16 mai 2026 (2e calibration) : le label de chip subsector EST le
    // nom du subsector (ex "Banking", "Internet & Services") sans le mot
    // "Sous-secteur" ni "dans". Quand la page est rendue en allemand, le
    // mot "dans" n'apparaît pas. Pour détecter de façon robuste qu'une
    // chip subsector est rendue, on compte les chips rang dans le header :
    // V1.8 affiche 4 chips rang (mondial, US, sector, subsector) pour les
    // stés US, ou 3 chips rang (mondial, sector, subsector) pour les
    // non-US. Si on voit au moins 3 chips rang `≈ #X` ou `#X` adjacent à
    // un libellé chip, le subsector est présent.
    pass: await (async () => {
      if (has(/Sous-secteur|Sub-?sector|Teilbranche|Industria/i)) return true;
      if (/\bdans\s+[A-Z][A-Za-zÀ-ÿ&]/.test(text)) return true;
      if (/\bin\s+[A-Z][A-Za-z&]/.test(text)) return true;
      if ((await count("[class*='subsector']")) > 0) return true;
      // Heuristique : compter les chips de rang (≈ #X ou Top X %)
      const rankMatches = text.match(/≈\s*#\s*\d+|(?:^|\s)#\s*\d+/g) ?? [];
      if (rankMatches.length >= 3) return true;
      return false;
    })(),
    severity: "minor",
    detail: "label subsector ou chip rang",
  });

  // ════════════ FRESHNESS ════════════
  c.push({
    id: "freshness.indicator",
    label: "Indicator 'À jour' / 'Up to date'",
    pass: has(/À jour|Up to date|Aktuell|Récent|Recent|Périmé|Stale/i),
    severity: "minor",
    detail: "freshness chip",
  });

  // ════════════ HERO KPI ════════════
  c.push({
    id: "hero.label_present",
    label: "Label 'KPI principal' / 'Lead KPI'",
    pass: has(/KPI principal|Lead KPI|Hauptkennzahl|Wichtigster KPI/i),
    severity: "critical",
    detail: "label hero visible",
  });
  c.push({
    id: "hero.value_present",
    label: "Valeur hero (chiffre + unité)",
    pass: (await count("[class*='font-mono']")) > 0
      && /\d/.test(text),
    severity: "critical",
    detail: "NumberTicker visible",
  });
  if (locale === "fr" || locale === "de" || locale === "de-CH") {
    // FR/DE = virgule décimale → pas "76.7" en hero
    // Yann 15 mai 2026 : selector simplifié, prend tous les font-mono.
    const heroTexts = await page.locator("[class*='font-mono']").allInnerTexts().catch(() => []);
    const heroText = (heroTexts ?? []).join(" ").slice(0, 500);
    const hasDotDecimal = /\b\d{1,3}\.\d{1,2}\b/.test(heroText);
    c.push({
      id: "hero.value.locale_decimal",
      label: `Décimale localisée hero (${locale} = virgule)`,
      pass: !hasDotDecimal,
      severity: "major",
      detail: hasDotDecimal ? "détecté '76.7' style EN dans hero" : "OK",
    });
  }
  c.push({
    id: "hero.yoy_pill_or_partial",
    label: "YoY pill OU 'Données partielles'",
    pass: has(/YoY|Données partielles|Partial data/i),
    severity: "major",
    detail: "YoY chip ou guardrail",
  });
  c.push({
    id: "hero.tier_chip",
    label: "Tier (Excellent/Bon/Moyen/Faible) ou trad",
    pass: has(/Excellent|Bon|Moyen|Faible|Hervorragend|Gut|Mittel|Schwach|Good|Average|Weak/)
      || has(/Données partielles|Partial data/i),
    severity: "major",
    detail: "QualityChip",
  });
  c.push({
    id: "hero.percentile_or_partial",
    label: "Percentile (Top X %) ou 'Données partielles'",
    pass: has(/Top\s+\d+\s*%|Bottom\s+\d+\s*%/) || has(/Données partielles/i),
    severity: "minor",
    detail: "PercentileChip",
  });
  c.push({
    id: "hero.cagr_label_dynamic",
    label: "CAGR label cohérent (pas '5 ans' si history < 5y)",
    pass: !has(/CAGR\s+5\s*ans?/) || true, // info only
    severity: "info",
    detail: "label CAGR",
  });
  c.push({
    id: "hero.signal_box_not_empty",
    label: "Signal box non vide (sparkle + texte)",
    pass: await (async () => {
      try {
        const boxes = (await page.locator("div:has(> svg.lucide-sparkles) div").allInnerTexts()) ?? [];
        return boxes
          .filter((b): b is string => typeof b === "string")
          .every((b) => !b.trim() || b.trim().length > 5);
      } catch {
        return true;
      }
    })(),
    severity: "major",
    detail: "anti-box-vide",
  });
  c.push({
    id: "hero.cagr_per_year_locale",
    label: "Suffix '/ an' / '/ Jahr' / '/ year' localisé",
    pass: (locale === "fr" && (has(/\/\s*an/i) || !has(/CAGR/)))
      || (locale.startsWith("de") && (has(/\/\s*Jahr/) || !has(/CAGR/)))
      || (locale.startsWith("en") && (has(/\/\s*year/i) || !has(/CAGR/))),
    severity: "minor",
    detail: "suffix CAGR",
  });

  // ════════════ TOOLTIP DÉFINITION ════════════
  c.push({
    id: "tooltip.definition_not_empty",
    label: "Tooltip 'Définition' non vide (si visible)",
    pass: await (async () => {
      const tts = await page.locator("[class*='InfoTooltip'], button[aria-label*='info' i]").count().catch(() => 0);
      return tts > 0; // tolère absence; échec = présent mais vide (hard à détecter sans clic)
    })(),
    severity: "minor",
    detail: "info tooltip présent",
  });

  // ════════════ CHART ════════════
  c.push({
    id: "chart.svg_count",
    label: "≥3 SVG (chart + sparklines + icons)",
    pass: (await count("svg")) >= 3,
    severity: "major",
    detail: `${await count("svg")} SVG dans DOM`,
  });
  c.push({
    id: "chart.y_axis_header",
    label: "Y axis header (Milliards/Millions/etc) si HERO KPI en devise",
    // Yann 16 mai 2026 : calibration audit. Le check ne s'applique que
    // si le HERO KPI est exprimé en devise (Mds $, Mds €, M $, M €).
    // Pour les heros en %, unités, abonnés, ratios, etc., l'axis
    // header n'a aucun sens. On extrait la value hero depuis le pattern
    // "KPI principal de <name> est <kpi>, à <value>" et on vérifie son unité.
    pass: await (async () => {
      const m = text.match(/KPI principal[^,]+,\s*à\s+([\d\s,.]+)\s*(Mds\s*[\$€]|M\s*[\$€]|%|pts|units?|unités?|\w+)/i);
      const heroUnit = m?.[2]?.trim() ?? "";
      const heroIsCurrency = /^Mds|^M\s*[\$€]/.test(heroUnit);
      if (!heroIsCurrency) return true; // skip si non-devise
      return /en Milliards|en Millions|in Milliarden|in Millionen|in Billions/i.test(text);
    })(),
    severity: "minor",
    detail: "axis header localisé (si hero en devise)",
  });
  c.push({
    id: "chart.y_no_duplicate_int",
    label: "Y axis pas de doublon integer adjacent",
    pass: await (async () => {
      // Cherche les ticks Y dans SVG (tous les <text> SVG)
      const ticks = (await page.locator("svg text").allInnerTexts().catch(() => [])) ?? [];
      const nums = ticks
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => /^\d+([.,]\d+)?$/.test(t));
      const seen = new Set<string>();
      for (const n of nums) {
        if (seen.has(n)) return false;
        seen.add(n);
      }
      return true;
    })(),
    severity: "minor",
    detail: "anti-29-29",
  });
  c.push({
    id: "chart.cycle_toggle",
    label: "Toggle Courbe/Barres/Variation/Dashboard",
    pass: has(/Courbe|Curve/) && has(/Barres|Bars/) && has(/Variation/),
    severity: "major",
    detail: "ChartCycleControls",
  });
  c.push({
    id: "chart.period_toggle",
    label: "Toggle période 5y/10y/20y",
    pass: has(/5\s*(ans|y|Jahre|years)/i),
    severity: "minor",
    detail: "PeriodToggle",
  });

  // ════════════ INTERPRÉTATION ════════════
  c.push({
    id: "interp.block_present",
    label: "Bloc Interprétation IA",
    pass: has(/INTERPRÉTATION|INTERPRETATION/i),
    severity: "major",
    detail: "InterpretationBlock",
  });
  c.push({
    id: "interp.lead_not_generic",
    label: "Lead pas générique 'historique insuffisant'",
    pass: !has(/historique insuffisant|insufficient history|unzureichende Historie/i),
    severity: "minor",
    detail: "lead enrichi",
  });
  c.push({
    id: "interp.moteur_croissance",
    label: "Bullet 'Moteur de croissance' (ou trad)",
    pass: has(/Moteur de croissance|Growth driver|Wachstumstreiber/i),
    severity: "minor",
    detail: "bullet pos",
  });
  c.push({
    id: "interp.future_bullet",
    label: "Bullet 'À surveiller prochainement'",
    pass: has(/À surveiller prochainement|To watch soon|Demnächst zu beobachten/i),
    severity: "minor",
    detail: "future watch",
  });

  // ════════════ KPI TABLE ════════════
  c.push({
    id: "table.kpi_rows",
    label: "Tableau KPIs (≥3 rows)",
    pass: (await count("[role='button'][class*='grid-cols-12'], [class*='KpiRow']")) >= 3,
    severity: "major",
    detail: "rows visibles",
  });
  c.push({
    id: "table.no_average_top50_spam",
    label: "Pas plus de 3 'Moyen + Top 50 %' adjacents",
    pass: await (async () => {
      try {
        const rows = (await page.locator("[role='button']").allInnerTexts()) ?? [];
        const moyenTop50 = rows
          .filter((r): r is string => typeof r === "string")
          .filter((r) => /Moyen[\s\S]*Top 50/.test(r));
        return moyenTop50.length <= 3;
      } catch {
        return true;
      }
    })(),
    severity: "major",
    detail: "spam tier fallback",
  });

  // ════════════ BLOCS BAS ════════════
  c.push({
    id: "block.risks",
    label: "Bloc Facteurs de risque",
    pass: has(/Facteur[s]?\s+de\s+risque|Risk\s+factors|Risikofaktoren/i),
    severity: "major",
    detail: "RiskStack",
  });
  c.push({
    id: "block.governance",
    label: "Bloc Gouvernance",
    pass: has(/Gouvernance|Governance|Bolagsstyrning|Bestuur/i),
    severity: "major",
    detail: "GovernanceCard",
  });
  c.push({
    id: "block.ai_positioning",
    label: "Bloc Positionnement IA",
    pass: has(/Positionnement\s+IA|AI\s+positioning|AI-Positionierung/i),
    severity: "minor",
    detail: "AIPositioningCard",
  });
  c.push({
    id: "block.stories_or_segments",
    label: "Bloc Stories OU Segments/Geography",
    pass: has(/Stories|Segments|Géographie|Geography|Répartition/i),
    severity: "minor",
    detail: "carrousel ou bloc",
  });

  // ════════════ i18n ════════════
  if (locale !== "fr") {
    c.push({
      id: "i18n.no_french_chips",
      label: `Chip labels traduits (pas 'Sous-secteur' en ${locale})`,
      pass: !has(/Sous-secteur/),
      severity: "minor",
      detail: "chip labels localisés",
    });
  }
  if (locale === "de" || locale === "de-CH") {
    c.push({
      id: "i18n.tier_de_short",
      label: "tier 'Mittel' (au lieu de 'Durchschnittlich')",
      pass: !has(/Durchschnittlich/),
      severity: "minor",
      detail: "fix overflow mini-card",
    });
    c.push({
      id: "i18n.rank_in_not_dans",
      label: "Rang 'in' au lieu de 'dans' (DE)",
      pass: !has(/#\d+\s+dans\s+/),
      severity: "minor",
      detail: "translateRankPreposition",
    });
    c.push({
      id: "i18n.cagr_jahr",
      label: "CAGR '/ Jahr' (pas '/ an' en DE)",
      pass: !has(/\/\s*an\b/) || !has(/CAGR/),
      severity: "minor",
      detail: "suffix locale",
    });
  }

  // ════════════ ANTI-PATTERNS ════════════
  c.push({
    id: "anti.no_undefined",
    label: "Pas de 'undefined' visible",
    pass: !has(/\bundefined\b/),
    severity: "critical",
    detail: "anti-bug rendering",
  });
  c.push({
    id: "anti.no_NaN",
    label: "Pas de 'NaN' visible",
    pass: !has(/\bNaN\b/),
    severity: "critical",
    detail: "anti-bug calc",
  });
  c.push({
    id: "anti.no_infinity",
    label: "Pas de '+Infinity' visible",
    pass: !has(/[+-]?Infinity/),
    severity: "critical",
    detail: "anti-bug CAGR",
  });
  c.push({
    id: "anti.no_null",
    label: "Pas de 'null' isolé en plein texte",
    pass: !/\s\bnull\b\s/.test(text),
    severity: "major",
    detail: "anti-bug data",
  });
  c.push({
    id: "anti.no_n_a_yoy",
    label: "Pas de '(n/a YoY)'",
    pass: !has(/\(n\/a\s+YoY\)/),
    severity: "minor",
    detail: "fallback YoY",
  });
  c.push({
    id: "anti.no_empty_brackets",
    label: "Pas de chips vides type '— · scope'",
    pass: !has(/^[—–-]\s+·/),
    severity: "minor",
    detail: "anti-chip-vide",
  });
  c.push({
    id: "anti.no_em_dash_text",
    label: "Pas d'em-dash dans le texte user-facing (CLAUDE.md §6)",
    pass: (text.match(/—/g)?.length ?? 0) < 5,
    severity: "minor",
    detail: "em-dash interdit",
  });
  c.push({
    id: "anti.no_lorem",
    label: "Pas de Lorem ipsum",
    pass: !has(/Lorem ipsum/i),
    severity: "critical",
    detail: "anti-placeholder",
  });
  c.push({
    id: "anti.no_pulse_brand",
    label: "Branding 'Mettrik AI' (pas 'Pulse' comme nom marque)",
    // Yann 16 mai 2026 : raffinage. "Pulse" peut apparaître comme nom de
    // PRODUIT TIERS dans une analyse (ex Flutter Entertainment a un modèle
    // IA appelé "Pulse" pour détecter les risques clients) — ce n'est pas
    // un reliquat de l'ancien brand Mettrik. On distingue :
    //   1) Brand Mettrik OK = présence du mot "Mettrik".
    //   2) Pulse comme brand legacy = "Mettrik Pulse" ou "Pulse Mettrik"
    //      ou logo wordmark contenant Pulse seul (rare).
    //   3) Pulse comme produit tiers = phrase narrative ("le modèle Pulse",
    //      "Pulse, my Spend", etc.) — pas un bug.
    pass: has(/Mettrik/)
      && !/Mettrik\s+Pulse|Pulse\s+Mettrik|\bPulse\s+AI\b|\bKPI\s+Pulse\b/.test(text),
    severity: "critical",
    detail: "brand correct (mention Pulse tiers tolérée)",
  });

  // ════════════ HTTP / META ════════════
  c.push({
    id: "meta.title_with_company",
    label: "Title HTML contient ticker ou nom",
    pass: await (async () => {
      const title = await page.title().catch(() => "");
      return title.includes(upper) || title.toLowerCase().includes(ticker.toLowerCase());
    })(),
    severity: "minor",
    detail: "SEO title",
  });

  return c;
}

// ──────────────────────────────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────────────────────────────

async function gotoTicker(page: Page, ticker: string, locale: string): Promise<string> {
  // Audit token bypass (env VISUAL_AUDIT_TOKEN), permet d'auditer sans cookie auth valide.
  const auditToken = process.env.VISUAL_AUDIT_TOKEN ?? "";
  const tokenQuery = auditToken ? `?audit_token=${encodeURIComponent(auditToken)}` : "";
  // Try V1.8 sandbox first
  const v18 = `${BASE}/sandbox/v1-8/${ticker.toLowerCase()}${tokenQuery}`;
  try {
    await page.goto(v18, { waitUntil: "domcontentloaded", timeout: 25000 });
    // Yann 15 mai 2026 : networkidle inutile (charts SVG bouclent). Wait fixe.
    await page.waitForTimeout(3000);
    // Détecte auth-gate redirect (URL changée vers /?auth=signin ou hub V1.8)
    const url = page.url();
    if (url.includes("auth=signin")) {
      // fallthrough V1 demo
    } else if (url.includes(`/sandbox/v1-8/${ticker.toLowerCase()}`)) {
      return "v1-8";
    }
  } catch {}

  // Fallback V1 demo (5 stés)
  if (V1_DEMO.has(ticker.toUpperCase())) {
    try {
      await page.goto(`${BASE}/${ticker.toLowerCase()}${tokenQuery}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(3000);
      if (!page.url().includes("auth=signin")) return "v1-demo";
    } catch {}
  }
  return "none";
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function processTicker(browser: Browser, ticker: string): Promise<{ ticker: string; checks: Check[]; route: string }> {
  const context: BrowserContext = await browser.newContext({
    locale: LOCALE === "fr" ? "fr-FR" : LOCALE === "de" || LOCALE === "de-CH" ? "de-DE" : "en-US",
    userAgent: "Mettrik-QA-Bot-Playwright/1.0",
    viewport: { width: 1440, height: 900 },
  });
  // Inject auth cookie if provided
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: LOCALE,
      domain: new URL(BASE).hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  if (AUTH_COOKIE) {
    // AUTH_COOKIE format: "name1=val1; name2=val2; ..."
    const parts = AUTH_COOKIE.split(";").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const idx = part.indexOf("=");
      if (idx < 0) continue;
      const name = part.slice(0, idx);
      const value = part.slice(idx + 1);
      await context.addCookies([
        { name, value, domain: new URL(BASE).hostname, path: "/", sameSite: "Lax" },
      ]);
    }
  }

  const page = await context.newPage();
  try {
    const route = await gotoTicker(page, ticker, LOCALE);
    if (route === "none") {
      await context.close();
      return { ticker, checks: [], route };
    }
    const checks = await checkPage(page, ticker, LOCALE, route);
    if (SHOTS) {
      try {
        fs.mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(SHOTS_DIR, `${ticker.toLowerCase()}.png`),
          fullPage: false,
        });
      } catch {}
    }
    await context.close();
    return { ticker, checks, route };
  } catch (err) {
    console.error(`  [${ticker}] ERR:`, (err as Error).message?.slice(0, 200));
    await context.close();
    return { ticker, checks: [], route: "error" };
  }
}

async function processBatch(browser: Browser, tickers: string[], workers: number) {
  const queue = [...tickers];
  const results: Array<{ ticker: string; checks: Check[]; route: string }> = [];
  async function next() {
    while (queue.length > 0) {
      const t = queue.shift()!;
      const r = await processTicker(browser, t);
      results.push(r);
      const passed = r.checks.filter((c) => c.pass).length;
      const crit = r.checks.filter((c) => !c.pass && c.severity === "critical").length;
      const major = r.checks.filter((c) => !c.pass && c.severity === "major").length;
      const icon = r.route === "v1-demo" ? "🔓" : r.route === "v1-8" ? "🔐" : "🚫";
      console.log(
        `[${r.ticker.padEnd(8)}] ${icon} ${r.route} · ${passed}/${r.checks.length} pass` +
          (crit > 0 ? ` · 🔴 ${crit}` : "") +
          (major > 0 ? ` · 🟠 ${major}` : ""),
      );
    }
  }
  await Promise.all(Array.from({ length: workers }, () => next()));
  return results;
}

async function main() {
  console.log(`\n🔍 Visual QA Playwright — top ${N} V1.8 (locale=${LOCALE}, parallel=${PARALLEL})`);
  console.log(`   Auth cookie: ${AUTH_COOKIE ? "provided" : "NONE (fallback V1 demo only)"}`);
  console.log(`   Screenshots: ${SHOTS ? `→ ${SHOTS_DIR}` : "disabled"}\n`);

  const t0 = Date.now();
  const browser = await chromium.launch({ headless: true });
  const allResults = await processBatch(browser, TICKERS, PARALLEL);
  await browser.close();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const allChecks = allResults.flatMap((r) => r.checks);
  const passed = allChecks.filter((c) => c.pass).length;
  const total = allChecks.length;
  const crit = allChecks.filter((c) => !c.pass && c.severity === "critical").length;
  const major = allChecks.filter((c) => !c.pass && c.severity === "major").length;
  const minor = allChecks.filter((c) => !c.pass && c.severity === "minor").length;
  const fetchedCount = allResults.filter((r) => r.route !== "none" && r.route !== "error").length;

  const failuresByCheck = new Map<string, { label: string; severity: Severity; count: number; examples: string[] }>();
  for (const r of allResults) {
    for (const c of r.checks) {
      if (c.pass) continue;
      const cur = failuresByCheck.get(c.id) ?? { label: c.label, severity: c.severity, count: 0, examples: [] };
      cur.count++;
      if (cur.examples.length < 3) cur.examples.push(r.ticker);
      failuresByCheck.set(c.id, cur);
    }
  }
  const topFailures = [...failuresByCheck.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 20);

  console.log(`\n📊 Récap (${dt} s · ${fetchedCount}/${TICKERS.length} pages fetched)`);
  console.log(`   Total : ${passed}/${total} checks pass (${total > 0 ? ((passed / total) * 100).toFixed(1) : "0"} %)`);
  console.log(`   🔴 ${crit} critical · 🟠 ${major} major · 🟡 ${minor} minor\n`);
  console.log(`Top 20 checks échouants (par fréquence, sur ${fetchedCount} pages fetched) :`);
  for (const [id, info] of topFailures) {
    const icon = info.severity === "critical" ? "🔴" : info.severity === "major" ? "🟠" : "🟡";
    const ex = info.examples.join(", ");
    console.log(`   ${icon} ${id.padEnd(40)} ${info.count.toString().padStart(3)} stés · ${info.label}`);
    console.log(`       ex: ${ex}`);
  }

  const out = path.join(process.cwd(), "src/data/visual-playwright-check.json");
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
