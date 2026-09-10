/** Assemble src/data/compare-index.json depuis les tranches (voir build-compare-index.ts). */
import { promises as fs } from "fs";
import { cleComparaison } from "@/lib/compare-keys";
(async () => {
  const dir = process.argv[2];
  const parts = (await fs.readdir(dir)).filter((f) => f.startsWith("part-"));
  const names: Record<string, string> = {}, byT: Record<string, Record<string, string>> = {}, keys: Record<string, Array<[string, string]>> = {};
  let nk = 0, stes = 0;
  for (const f of parts) {
    const j = JSON.parse(await fs.readFile(`${dir}/${f}`, "utf-8"));
    for (const [t, v] of Object.entries(j) as Array<[string, { name?: string; kpis?: Array<{ s: string; en: string; u: string; n: number }> }]>) {
      if (!v.kpis) continue;
      stes++; names[t] = v.name ?? t;
      for (const k of v.kpis) {
        nk++;
        if (k.n < 2) continue;
        const c = cleComparaison({ name_en: k.en, short: k.s, unit: k.u });
        if (!c) continue;
        (byT[t] ??= {})[k.s] = c;
        const l = (keys[c] ??= []);
        if (!l.some(([x]) => x === t)) l.push([t, k.s]);
      }
    }
  }
  for (const c of Object.keys(keys)) if (keys[c].length < 2) delete keys[c];
  for (const t of Object.keys(byT)) for (const s of Object.keys(byT[t])) if (!keys[byT[t][s]]) delete byT[t][s];
  const couverts = Object.values(byT).reduce((a, m) => a + Object.keys(m).length, 0);
  await fs.writeFile("src/data/compare-index.json", JSON.stringify({ generated: new Date().toISOString(), names, byT, keys }));
  console.log(JSON.stringify({ stes, kpis: nk, kpis_comparables: couverts, cles: Object.keys(keys).length }));
  process.exit(0);
})();
