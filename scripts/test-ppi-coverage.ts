/* eslint-disable @typescript-eslint/no-var-requires */
import { computeSuperKpis } from "../src/lib/super-kpi";
import { loadV17Company } from "../src/lib/company-core/load-company";

const witnesses = ["nvda", "aapl", "jpm", "bnp.pa", "asml", "msft", "tte.pa", "rog.sw", "mu"];

(async () => {
  console.log("Ticker     | PPI display | Tier      | Inputs | R40   | Margin | Conc   | Trend");
  console.log("-----------|-------------|-----------|--------|-------|--------|--------|--------");
  for (const t of witnesses) {
    try {
      const outcome = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (outcome.kind !== "ready") {
        console.log(`${t.padEnd(10)} | ${outcome.kind.padEnd(10)}`);
        continue;
      }
      const company = outcome.company;
      const skpis = computeSuperKpis(company, "fr");
      const ppi = skpis.find((k) => k.id === "ppi");
      const r40 = skpis.find((k) => k.id === "rule40");
      const conc = skpis.find((k) => k.id === "conc");
      if (ppi) {
        const ppiVal = (ppi.display || "N/A").padEnd(11);
        const tier = (ppi.tier || "").padEnd(9);
        const nIn = String(ppi.inputs.length).padEnd(6);
        const r40Val = (r40?.value !== null && r40?.value !== undefined ? r40.value.toFixed(1) : "N/A").padEnd(5);
        const concVal = (conc?.value !== null && conc?.value !== undefined ? conc.value.toFixed(1) + "%" : "N/A").padEnd(6);
        console.log(`${t.padEnd(10)} | ${ppiVal} | ${tier} | ${nIn} | ${r40Val} | ${"".padEnd(6)} | ${concVal} |`);
        if (ppi.tier === "na") {
          console.log(`           >> interpretation: ${ppi.interpretation.slice(0, 120)}`);
        }
      } else {
        console.log(`${t.padEnd(10)}: no PPI`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`${t.padEnd(10)}: ERROR ${msg.slice(0, 100)}`);
    }
  }
})();
