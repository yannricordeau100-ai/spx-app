#!/usr/bin/env tsx
/**
 * Régénère `tests/golden/snapshots-proposed/<ticker>.proposed.json` pour
 * les 10 sociétés témoin de la Phase 2B Mettrik en lisant la value LIVE
 * affichée sur https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/<t>?audit_token=...
 *
 * Workflow Yann :
 *   1. `npm run test:golden:propose` → écrit dans snapshots-proposed/
 *   2. Yann review chaque .proposed.json, compare avec inspection-log.json
 *   3. Si OK : `cp snapshots-proposed/<t>.proposed.json snapshots/<t>.golden.json`
 *   4. `npm run test:golden` valide le golden vs live (tolérances)
 *
 * RAM Mac fragile → 1 instance Playwright à la fois (séquentiel).
 */
import { chromium } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

import { TICKERS_PHASE_2B, extractSnapshot, urlForTicker } from "../tests/golden/extract";

const PROPOSED_DIR = path.join(__dirname, "..", "tests", "golden", "snapshots-proposed");

async function main() {
  fs.mkdirSync(PROPOSED_DIR, { recursive: true });
  console.log(`[golden-snapshot] cible : ${PROPOSED_DIR}`);
  console.log(`[golden-snapshot] ${TICKERS_PHASE_2B.length} stés témoin : ${TICKERS_PHASE_2B.join(", ")}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
    reducedMotion: "reduce", // critique : sinon NumberTicker bloqué à opacity:0
  });

  const results: Array<{ ticker: string; ok: boolean; notes: string[] }> = [];

  for (const ticker of TICKERS_PHASE_2B) {
    const page = await context.newPage();
    const url = `https://mettrik-niveau2.vercel.app${urlForTicker(ticker)}`;
    console.log(`\n[${ticker}] → ${url}`);

    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      const status = resp?.status() ?? 0;
      console.log(`[${ticker}] HTTP ${status}`);
      if (status >= 400) {
        results.push({ ticker, ok: false, notes: [`HTTP ${status}`] });
        await page.close();
        continue;
      }
      // Laisser stock-price-block live fetch (yfinance) finir.
      // Mac fragile → on ne paralléise pas, donc on peut se permettre 5s.
      await page.waitForTimeout(5000);

      const snap = await extractSnapshot(page, ticker);
      const outFile = path.join(PROPOSED_DIR, `${ticker.toLowerCase()}.proposed.json`);
      fs.writeFileSync(outFile, JSON.stringify(snap, null, 2) + "\n", "utf-8");
      console.log(
        `[${ticker}] ✅ écrit : hero="${snap.hero_kpi_name}" value=${snap.hero_kpi_value} ${snap.hero_kpi_unit ?? ""} yoy=${snap.hero_yoy_pct} capi=${snap.capi_mds_dollar} top4=[${snap.top_4_kpi_shorts.join(", ")}]`,
      );
      if (snap._review_notes.length) {
        console.log(`[${ticker}] ⚠️  notes : ${snap._review_notes.join(" | ")}`);
      }
      results.push({ ticker, ok: true, notes: snap._review_notes });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${ticker}] ❌ ${msg}`);
      results.push({ ticker, ok: false, notes: [msg] });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\n=== Bilan ===`);
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`OK : ${ok}/${results.length}, échecs : ${fail}`);
  for (const r of results) {
    const status = r.ok ? "✅" : "❌";
    const notes = r.notes.length ? ` (${r.notes.join(" | ")})` : "";
    console.log(`  ${status} ${r.ticker}${notes}`);
  }

  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[golden-snapshot] fatal :", err);
  process.exit(2);
});
