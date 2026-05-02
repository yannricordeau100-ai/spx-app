/**
 * Build kpi-templates-by-gics.ts → kpi-templates-by-gics.json
 * Run : npx tsx scripts/build-kpi-templates-json.ts
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  KPI_TEMPLATES,
  UNIVERSAL_KPIS,
  PIPELINE_NOTES,
} from "../src/lib/kpi-templates-by-gics";

const out = {
  UNIVERSAL_KPIS,
  KPI_TEMPLATES,
  PIPELINE_NOTES,
};

const path = resolve(__dirname, "..", "src/lib/kpi-templates-by-gics.json");
writeFileSync(path, JSON.stringify(out, null, 2), "utf-8");
console.log(`✅ Built ${path}`);
console.log(
  `   ${Object.keys(KPI_TEMPLATES).length} secteurs, ${UNIVERSAL_KPIS.length} KPI universels`,
);
