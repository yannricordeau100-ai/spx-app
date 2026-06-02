/* Test PPI coverage on ~50 random tickers from V1.9 universe.
 * Estimates % coverage for the broader dataset.
 */
import { computeSuperKpis } from "../src/lib/super-kpi";
import { loadV17Company } from "../src/lib/company-core/load-company";
import fs from "node:fs";
import path from "node:path";

(async () => {
  // Pick ~50 representative tickers
  const universe = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "src/data/v1-8-tickers-sorted.json"), "utf-8")
  ) as string[];
  // Take every Nth to get a sample of 50
  const SIZE = parseInt(process.env.SAMPLE_SIZE || "100", 10);
  const step = Math.max(1, Math.floor(universe.length / SIZE));
  const sample = universe.filter((_, i) => i % step === 0).slice(0, SIZE);

  let ok = 0;
  let na = 0;
  let notFound = 0;
  const failures: string[] = [];
  const wins: string[] = [];

  for (const t of sample) {
    try {
      const outcome = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (outcome.kind !== "ready") {
        notFound++;
        continue;
      }
      const company = outcome.company;
      const skpis = computeSuperKpis(company, "fr");
      const ppi = skpis.find((k) => k.id === "ppi");
      if (ppi && ppi.value !== null) {
        ok++;
        wins.push(`${t}=${ppi.display}`);
      } else {
        na++;
        failures.push(t);
      }
    } catch {
      na++;
      failures.push(`${t}(err)`);
    }
  }

  const evaluable = ok + na;
  const pct = evaluable > 0 ? (ok * 100) / evaluable : 0;
  console.log(`\nSAMPLE (n=${sample.length}):`);
  console.log(`  Pass 3 ready: ${evaluable}`);
  console.log(`  Not ready: ${notFound}`);
  console.log(`  PPI calculé OK: ${ok}/${evaluable} (${pct.toFixed(1)}%)`);
  console.log(`  PPI n.d.: ${na}`);
  console.log(`\n  Wins (sample): ${wins.slice(0, 15).join(", ")}`);
  console.log(`\n  Failures (sample): ${failures.slice(0, 15).join(", ")}`);
})();
