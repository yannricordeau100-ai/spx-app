const fs = require("fs");
const m = JSON.parse(fs.readFileSync("src/data/v2-pipeline/_merged.json", "utf-8"));
const v18 = JSON.parse(fs.readFileSync("src/data/v1-8-tickers-sorted.json", "utf-8")).slice(0, 307);
const top307Set = new Set(v18.map((t) => t.toUpperCase()));

const stats = { geq5: 0, between3and4: 0, under3: 0, heroEmpty: 0, total: 0 };
const lists = { geq5: [], under5: [] };
for (const t of Object.keys(m)) {
  const c = m[t];
  if (!c?.hero_kpi) { stats.heroEmpty++; continue; }
  const k = c.kpis?.find((x) => x.short === c.hero_kpi);
  if (!k) { stats.heroEmpty++; continue; }
  const h = Array.isArray(k.history) ? k.history : [];
  const periodType = k.period_type || "year";
  const yearsCoverage = periodType === "quarter" ? h.length / 4 : (periodType === "semester" ? h.length / 2 : h.length);
  stats.total++;
  const entry = {
    ticker: t,
    country: c.country || "?",
    name: c.name,
    sector: c.sector || "",
    hero_kpi: k.short,
    period_type: periodType,
    history_len: h.length,
    years_coverage: Number(yearsCoverage.toFixed(2)),
    in_top307_v18: top307Set.has(t.toUpperCase()),
  };
  if (yearsCoverage >= 5) { stats.geq5++; lists.geq5.push(entry); }
  else if (yearsCoverage >= 3) { stats.between3and4++; lists.under5.push({ ...entry, bucket: "3-4 ans" }); }
  else { stats.under3++; lists.under5.push({ ...entry, bucket: "<3 ans" }); }
}

console.log("=== Stats _merged.json (" + Object.keys(m).length + " stés) ===");
console.log("  ≥5 ans hero history:", stats.geq5);
console.log("  3-4 ans:", stats.between3and4);
console.log("  <3 ans:", stats.under3);
console.log("  hero KPI vide ou KPI absent:", stats.heroEmpty);
console.log("  total avec hero:", stats.total);

fs.writeFileSync("src/data/kpi-history-geq5.json", JSON.stringify(lists.geq5, null, 2));
fs.writeFileSync("src/data/kpi-history-under5.json", JSON.stringify(lists.under5, null, 2));
console.log("\nFichiers écrits :");
console.log("  src/data/kpi-history-geq5.json (" + lists.geq5.length + " stés)");
console.log("  src/data/kpi-history-under5.json (" + lists.under5.length + " stés)");
