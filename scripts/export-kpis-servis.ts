/**
 * Export des KPI tels que la fiche les sert (8 oct 2026).
 * Meme chargeur et meme assainissement que la page societe. Lu par
 * scripts/build-home-wow.py pour que l accueil et la carte des pays ne
 * montrent que des KPI reellement presents sur la fiche.
 *
 * Usage : npx tsx scripts/export-kpis-servis.ts <fichier de sortie> [TICKER ...]
 */
import fs from "node:fs";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { isGenericHeroKpi } from "../src/lib/kpi-hero-generic";
import { assainirPourClient } from "../src/lib/company-core/assainir-payload";

(async () => {
  const [sortie, ...tickersArg] = process.argv.slice(2);
  if (!sortie) { console.error("fichier de sortie requis"); process.exit(1); }
  const univers: string[] = tickersArg.length
    ? tickersArg
    : JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")).tickers;
  const out: Record<string, { name: string; kpis: unknown[] }> = {};
  for (const t of univers) {
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") continue;
      const c = assainirPourClient(r.company) as { name?: string; kpis?: Array<Record<string, unknown>> };
      out[t.toUpperCase()] = {
        name: c.name ?? t,
        kpis: (c.kpis ?? []).map((k) => ({
          short: k.short, name_fr: k.name_fr, name_en: k.name_en, value: k.value, unit: k.unit,
          yoy: k.yoy, history: k.history, history_periods: k.history_periods,
          period_type: k.period_type, frequency: k.frequency, is_wow: k.is_wow,
          is_generic: k.is_generic, is_short_history: k.is_short_history,
          story_category: k.story_category, generique: isGenericHeroKpi(k as never), last_data_date: k.last_data_date,
        })),
      };
    } catch (e) {
      console.error(`${t}: ${String(e).slice(0, 100)}`);
    }
  }
  fs.writeFileSync(sortie, JSON.stringify(out));
  console.log(`${Object.keys(out).length} societes exportees`);
})();
