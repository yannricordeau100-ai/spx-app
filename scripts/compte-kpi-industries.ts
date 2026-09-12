/**
 * Comptage des KPI par societe (Yann 12 sept 2026), memes regles que la fiche :
 * KPI IC avances + KPI IC standard (company-view groupesKpis) + KPI stories (buildStories).
 *   npx tsx scripts/compte-kpi-industries.ts <debut> <nb> <sortie.json>
 */
import { promises as fs } from "fs";
import { loadV17Company } from "@/lib/company-core/load-company";
import { orderKpis } from "@/lib/kpi-ordering";
import { estKpiStandard } from "@/lib/kpi-standard";
import { buildStories } from "@/lib/kpi-stories-ordering";
import type { KPI } from "@/lib/data";

function utilisable(k?: { value?: unknown } | null): boolean {
  if (!k) return false;
  const v = k.value;
  if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) > 0;
  if (typeof v === "string") { const s = v.trim(); if (s === "" || s === "—") return false; const n = parseFloat(s.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && Math.abs(n) > 0; }
  return false;
}

(async () => {
  const [debut, nb, sortie] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
  const uni = JSON.parse(await fs.readFile("src/data/v1-9-5-clean-all-tickers.json", "utf-8")) as { tickers: string[] };
  const out: Record<string, unknown> = {};
  for (const t of uni.tickers.slice(debut, debut + nb)) {
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") continue;
      const c = r.company as unknown as { kpis: KPI[]; hero_kpi: string; gics_code?: string; _kpis_hidden_by_history_rule?: string[] };
      const cache = new Set(c._kpis_hidden_by_history_rule ?? []);
      const req = (pt?: string) => (pt === "quarter" ? 4 : pt === "semester" ? 2 : 3);
      const f = orderKpis(c.kpis, c.hero_kpi).filter((k) => {
        if (!utilisable(k)) return false;
        if (k.short === c.hero_kpi) return true;
        if ((k as unknown as { hors_document?: boolean }).hors_document === true) return true;
        if (cache.has(k.short)) return false;
        return (Array.isArray(k.history) ? k.history.length : 0) >= req((k as { period_type?: string }).period_type);
      });
      const avances = f.filter((k) => k.short === c.hero_kpi || !estKpiStandard(k)).length;
      const standards = f.length - avances;
      const stories = buildStories(c.kpis, undefined).reduce((n, cat) => n + cat.slides.length, 0);
      out[t] = { gics: c.gics_code ?? null, avances, standards, stories };
    } catch (e) { out[t] = { erreur: String(e).slice(0, 100) }; }
  }
  await fs.writeFile(sortie, JSON.stringify(out));
  console.log("ok", Object.keys(out).length);
  process.exit(0);
})();
