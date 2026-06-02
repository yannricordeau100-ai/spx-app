import { loadV17Company } from "../src/lib/company-core/load-company.ts";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  const auditPath = path.join(process.cwd(), "src/data/v1-9-pre-publication-audit.json");
  const raw = await fs.readFile(auditPath, "utf-8");
  const audit = JSON.parse(raw);
  const cleanAll = new Set(audit.audits.filter((a) => a.is_clean_all === true).map((a) => a.ticker.toUpperCase()));
  console.log("clean_all size:", cleanAll.size);
  console.log("GOOGL in clean_all:", cleanAll.has("GOOGL"));

  const r = await loadV17Company("googl", { mode: "v18", locale: "fr" });
  console.log("loadV17Company kind:", r.kind);
  if (r.kind === "company") {
    console.log("company.ticker:", r.company.ticker);
    console.log("company.name:", r.company.name);
    console.log("hero_kpi:", r.company.hero_kpi);
    console.log("kpis.length:", r.company.kpis?.length);
  } else if (r.kind === "missing") {
    console.log("MISSING");
  } else {
    console.log("OTHER:", JSON.stringify(r).substring(0, 200));
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
