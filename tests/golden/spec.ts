import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  TICKERS_PHASE_2B,
  extractSnapshot,
  urlForTicker,
  type ExtractedSnapshot,
} from "./extract";

/**
 * Tests Golden Phase 2B Mettrik.
 *
 * Pour chaque sté témoin :
 *   1. Charge `snapshots/<TICKER>.golden.json` (validé manuellement par Yann)
 *   2. Navigate sur niveau2 + audit_token
 *   3. Extract le snapshot live (extract.ts)
 *   4. Compare avec tolérances :
 *      - hero_kpi_name   : exact match
 *      - hero_kpi_value  : ±5 %
 *      - hero_kpi_unit   : exact match
 *      - hero_yoy_pct    : ±2 pts (différence absolue)
 *      - capi_mds_dollar : ±10 % (varie quotidien)
 *      - top_4_kpi_shorts: exact match (ordre + valeurs)
 *
 * Si `snapshots/<TICKER>.golden.json` n'existe pas, le test est skipé
 * (avec un warning lisible) plutôt que fail : Yann doit valider chaque
 * proposed.json avant de le promouvoir en golden.
 */

const SNAPSHOTS_DIR = path.join(__dirname, "snapshots");

type GoldenSnapshot = ExtractedSnapshot;

function loadGolden(ticker: string): GoldenSnapshot | null {
  const file = path.join(SNAPSHOTS_DIR, `${ticker.toLowerCase()}.golden.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as GoldenSnapshot;
}

function withinPct(actual: number | null, expected: number | null, pct: number): boolean {
  if (actual == null || expected == null) return false;
  if (expected === 0) return Math.abs(actual) <= 0.0001;
  return Math.abs(actual - expected) / Math.abs(expected) <= pct / 100;
}

function withinAbsPts(actual: number | null, expected: number | null, pts: number): boolean {
  if (actual == null || expected == null) return false;
  return Math.abs(actual - expected) <= pts;
}

for (const ticker of TICKERS_PHASE_2B) {
  test(`golden ${ticker}`, async ({ page }) => {
    const golden = loadGolden(ticker);
    test.skip(!golden, `pas de snapshots/${ticker.toLowerCase()}.golden.json — valider proposed/ d'abord`);
    if (!golden) return;

    await page.goto(urlForTicker(ticker), { waitUntil: "networkidle" });
    // Laisser NumberTicker s'animer et stock-price live fetch finir
    await page.waitForTimeout(2000);

    const live = await extractSnapshot(page, ticker);

    // 1. hero_kpi_name : exact match
    expect(live.hero_kpi_name, "hero_kpi_name").toBe(golden.hero_kpi_name);

    // 2. hero_kpi_unit : exact match
    expect(live.hero_kpi_unit, "hero_kpi_unit").toBe(golden.hero_kpi_unit);

    // 3. hero_kpi_value : ±5 %
    expect(
      withinPct(live.hero_kpi_value, golden.hero_kpi_value, 5),
      `hero_kpi_value tolérance ±5 % (live=${live.hero_kpi_value} golden=${golden.hero_kpi_value})`,
    ).toBe(true);

    // 4. hero_yoy_pct : ±2 pts absolus
    expect(
      withinAbsPts(live.hero_yoy_pct, golden.hero_yoy_pct, 2),
      `hero_yoy_pct tolérance ±2 pts (live=${live.hero_yoy_pct} golden=${golden.hero_yoy_pct})`,
    ).toBe(true);

    // 5. capi_mds_dollar : ±10 % (varie quotidien)
    expect(
      withinPct(live.capi_mds_dollar, golden.capi_mds_dollar, 10),
      `capi_mds_dollar tolérance ±10 % (live=${live.capi_mds_dollar} golden=${golden.capi_mds_dollar})`,
    ).toBe(true);

    // 6. top_4_kpi_shorts : exact match array (ordre + valeurs)
    expect(live.top_4_kpi_shorts, "top_4_kpi_shorts").toEqual(golden.top_4_kpi_shorts);
  });
}
