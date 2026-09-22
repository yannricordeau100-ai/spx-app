/**
 * Extrait, pour chaque societe, la liste des indicateurs reellement servis sur sa fiche
 * (memes regles de visibilite que scripts/compte-kpi-industries.ts).
 *   npx tsx scripts/extrait-kpis-fiches.ts <debut> <nb> <sortie.json>
 */
import { promises as fs } from "fs";
import { readFileSync } from "fs";
import { resolve } from "path";
try {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch { /* pas de .env.local */ }

import { loadV17Company } from "@/lib/company-core/load-company";
import { orderKpis } from "@/lib/kpi-ordering";
import { estKpiStandard } from "@/lib/kpi-standard";
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
      if (r.kind !== "ready") { out[t] = { erreur: "non_servie:" + r.kind }; continue; }
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
      out[t] = {
        gics: c.gics_code ?? null,
        hero: c.hero_kpi ?? null,
        visibles: f.map((k) => ({
          short: k.short,
          name_fr: k.name_fr ?? null,
          name_en: (k as unknown as { name_en?: string }).name_en ?? null,
          standard: estKpiStandard(k),
          unit: k.unit ?? null,
          nature: (k as unknown as { nature?: string }).nature ?? null,
          type: (k as unknown as { type?: string }).type ?? null,
          tc: (k as unknown as { type_comparable?: { fr?: string; origine?: string } | null }).type_comparable ?? null,
        })),
        tous: c.kpis.map((k) => k.short),
      };
    } catch (e) { out[t] = { erreur: String(e).slice(0, 120) }; }
  }
  await fs.writeFile(sortie, JSON.stringify(out));
  console.log("ok", Object.keys(out).length);
  process.exit(0);
})();
