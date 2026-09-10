/**
 * Comparer : extrait, pour chaque fiche servie, les KPI (short, libelles,
 * unite, periodicite, nb de points). Par tranches pour menager la RAM :
 *   npx tsx scripts/build-compare-index.ts <debut> <nb> <sortie.json>
 * Puis scripts/build-compare-index-merge.py assemble src/data/compare-index.json.
 */
import { promises as fs } from "fs";
import { loadV17Company } from "@/lib/company-core/load-company";

(async () => {
  const [debut, nb, sortie] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? 700), process.argv[4]];
  const uni = JSON.parse(await fs.readFile("src/data/v1-9-5-clean-all-tickers.json", "utf-8")) as { tickers: string[] };
  const out: Record<string, unknown> = {};
  for (const t of uni.tickers.slice(debut, debut + nb)) {
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") { out[t] = { absent: r.kind }; continue; }
      const c = r.company as unknown as { name: string; kpis: Array<Record<string, unknown>> };
      out[t] = {
        name: c.name,
        kpis: c.kpis.map((k) => ({
          s: k.short, en: k.name_en ?? null, fr: k.name_fr ?? null, u: k.unit ?? "",
          pt: k.period_type ?? "year", n: Array.isArray(k.history) ? (k.history as unknown[]).filter((v) => typeof v === "number").length : 0,
        })),
      };
    } catch (e) { out[t] = { erreur: String(e).slice(0, 120) }; }
  }
  await fs.writeFile(sortie, JSON.stringify(out));
  console.log("ok", Object.keys(out).length);
  process.exit(0);
})();
