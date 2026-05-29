import type { Page } from "@playwright/test";

/**
 * Phase 2B Golden snapshot — extraction de la value affichee live sur
 * /sandbox/v1-9-5/<ticker>?audit_token=... (mettrik-niveau2).
 *
 * On ne fait PAS confiance au dataset JSON : on extrait ce que le DOM
 * sert au browser (= ce que Yann voit), pour figer un snapshot reference
 * et detecter toute regression visuelle apres re-extraction LLM, fix
 * mapping, etc. qui changerait silencieusement la value affichee.
 *
 * IMPORTANT : Playwright DOIT etre lance avec reducedMotion: "reduce"
 * pour que le NumberTicker affiche la valeur finale (sinon motion/react
 * garde opacity:0 sur le wrapper et la value est invisible).
 */

export const AUDIT_TOKEN = "phYUd19KP3T_apdLQmugGzF0yEEoAwM6C5JVp9-2z0Y";

export function urlForTicker(ticker: string): string {
  return `/sandbox/v1-9-5/${ticker.toLowerCase()}?audit_token=${AUDIT_TOKEN}`;
}

export type ExtractedSnapshot = {
  ticker: string;
  fetched_at: string;
  url: string;
  hero_kpi_name: string | null;
  hero_kpi_value: number | null;
  hero_kpi_unit: string | null;
  hero_yoy_pct: number | null;
  capi_mds_dollar: number | null;
  top_4_kpi_shorts: string[];
  _review_notes: string[];
};

/**
 * Parse un nombre formate FR ("68,0", "5 189", "1 234,56") -> number.
 * Gere les espaces classiques + insecables.
 */
function parseFrNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[  ]/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrait le snapshot live d'une page ste.
 *
 * Prerequis : context Playwright avec reducedMotion: "reduce" et
 * page.goto + waitForTimeout(5000) pour laisser yfinance fetch finir.
 */
export async function extractSnapshot(page: Page, ticker: string): Promise<ExtractedSnapshot> {
  const url = urlForTicker(ticker);
  const reviewNotes: string[] = [];

  // 1. HERO KPI short : sticker `text-[12px] font-mono uppercase` distinct
  // de la table (text-[11px]). Position : juste au-dessus du NumberTicker.
  let heroKpiName: string | null = null;
  try {
    const all = await page.locator("span.font-mono.font-bold.uppercase").all();
    for (const c of all) {
      const cls = (await c.getAttribute("class")) ?? "";
      if (cls.includes("text-[12px]")) {
        heroKpiName = ((await c.textContent()) ?? "").trim();
        break;
      }
    }
  } catch {
    reviewNotes.push("hero_kpi_name extraction failed");
  }

  // 2. HERO value + unit : container avec style "font-size: clamp(40px, 7vw, 72px)"
  // contient soit "194,0 Mds $" (NVDA, value+unit ensemble) soit "27,4" (META,
  // value seule + unit dans sibling clamp(15px, 2vw, 22px)).
  let heroKpiValue: number | null = null;
  let heroKpiUnit: string | null = null;
  try {
    const heroEl = page
      .locator('div[style*="clamp(40px, 7vw, 72px)"], div[style*="clamp(40px,7vw,72px)"]')
      .first();
    if (await heroEl.count()) {
      const heroText = ((await heroEl.textContent()) ?? "").trim();
      heroKpiValue = parseFrNumber(heroText);
      // Cas 1 : value + unit dans le meme textContent
      const m = heroText.match(/^[\-+]?[\d\s,.  ]+(.*)$/);
      if (m && m[1]) {
        const u = m[1].trim().replace(/\s+/g, " ");
        if (u) heroKpiUnit = u;
      }
      // Cas 2 : unit dans un sibling separe
      if (!heroKpiUnit) {
        const parent = heroEl.locator("xpath=..").first();
        const unitCandidates = await parent.locator("div").all();
        for (const uel of unitCandidates) {
          const style = (await uel.getAttribute("style")) ?? "";
          if (!/clamp\(15px[\s,]+2vw/i.test(style)) continue;
          const txt = ((await uel.textContent()) ?? "").trim();
          if (txt && !/^[+\-]?[\d\s,.]+$/.test(txt)) {
            heroKpiUnit = txt.replace(/\s+/g, " ");
            break;
          }
        }
      }
    }
  } catch {
    reviewNotes.push("hero_kpi_value/unit extraction failed");
  }

  // 3. YoY pill : chip rounded-full sous la value, contenu "+73,0 %"
  let heroYoyPct: number | null = null;
  try {
    const pills = await page.locator("div.rounded-full span.tabular-nums").all();
    for (const p of pills) {
      const txt = ((await p.textContent()) ?? "").trim();
      if (/^[+\-]?\d+([.,]\d+)?\s*%$/.test(txt)) {
        heroYoyPct = parseFrNumber(txt);
        break;
      }
    }
  } catch {
    reviewNotes.push("hero_yoy_pct extraction failed");
  }

  // 4. Capi boursiere : remonte du label "Capitalisation" et lit le span
  // font-display tabular-nums. Note : en mode freemium-blocked le span
  // contient "0 Mds $" (placeholder bloque) → on detecte et on signale.
  let capiMdsDollar: number | null = null;
  try {
    const labelEl = page.locator("text=/Capitalisation/i").first();
    if (await labelEl.count()) {
      const colContainer = labelEl.locator("xpath=ancestor::div[1]").first();
      const amountEl = colContainer
        .locator("span.font-display.tabular-nums")
        .first();
      if (await amountEl.count()) {
        const txt = ((await amountEl.textContent()) ?? "").trim();
        if (txt && txt !== "—") {
          capiMdsDollar = parseFrNumber(txt);
        }
      }
    }
  } catch {
    reviewNotes.push("capi extraction failed");
  }

  // 5. Top 4 KPI shorts : 4 premiers `kpi.short` dans la table KPI.
  // Filtres :
  //   - text-[11px] (exclut hero text-[12px])
  //   - exclut text-zinc-500/400 (chips ranks #1, #2)
  //   - exclut text-[10.5px] (badges quality Solide/Moyen)
  //   - exclut shorts matchant /^#\d+$/ ou /^Top\s+\d+\s*%?$/
  const top4KpiShorts: string[] = [];
  try {
    const allShorts = await page.locator("span.font-mono.font-bold.uppercase").all();
    for (const el of allShorts) {
      const cls = (await el.getAttribute("class")) ?? "";
      if (!cls.includes("text-[11px]")) continue;
      if (cls.includes("text-zinc-500") || cls.includes("text-zinc-400")) continue;
      if (cls.includes("text-[10.5px]")) continue;
      const txt = ((await el.textContent()) ?? "").trim();
      if (!txt || txt.length > 64 || txt.length < 2) continue;
      if (/^#\d+$/.test(txt)) continue;
      if (/^Top\s+\d+\s*%?$/i.test(txt)) continue;
      top4KpiShorts.push(txt);
      if (top4KpiShorts.length >= 4) break;
    }
  } catch {
    reviewNotes.push("top_4_kpi_shorts extraction failed");
  }

  if (!heroKpiName) reviewNotes.push("hero_kpi_name = null");
  if (heroKpiValue == null) reviewNotes.push("hero_kpi_value = null");
  if (heroKpiUnit == null) reviewNotes.push("hero_kpi_unit = null");
  if (capiMdsDollar == null) reviewNotes.push("capi_mds_dollar = null (placeholder blocked freemium ?)");
  if (top4KpiShorts.length < 4) reviewNotes.push(`top_4_kpi_shorts incomplet (${top4KpiShorts.length}/4)`);

  return {
    ticker: ticker.toUpperCase(),
    fetched_at: new Date().toISOString(),
    url,
    hero_kpi_name: heroKpiName,
    hero_kpi_value: heroKpiValue,
    hero_kpi_unit: heroKpiUnit,
    hero_yoy_pct: heroYoyPct,
    capi_mds_dollar: capiMdsDollar,
    top_4_kpi_shorts: top4KpiShorts,
    _review_notes: reviewNotes,
  };
}

export const TICKERS_PHASE_2B = [
  "NVDA",
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
  "V",
  "JPM",
  "BRK-B",
];
