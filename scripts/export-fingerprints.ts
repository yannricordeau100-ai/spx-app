/** Fingerprint attendu par sté (depuis le loader local = data du commit). */
import fs from "node:fs";
import path from "node:path";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { buildStories } from "../src/lib/kpi-stories-ordering";
const ROOT = process.cwd();
const STRUCTURAL = new Set(["GEV","PSKY","Q","SNDK","SOLV","SW"]);
async function main() {
  const sp = (JSON.parse(fs.readFileSync(path.join(ROOT,"src/data/sp500-tickers.json"),"utf8")) as string[]).map(s=>s.toUpperCase());
  const out: Record<string, unknown> = {};
  for (const t of sp) {
    if (STRUCTURAL.has(t)) continue;
    try {
      const o = await loadV17Company(t, { mode: "v18" });
      if (o.kind !== "ready") { out[t] = { error: o.kind }; continue; }
      const c = o.company;
      const scores = ((c.risks ?? []) as Array<{score?:number;severity?:number}>)
        .map(r => (typeof r.score === "number" && r.score > 0) ? r.score : ((r.severity as number) || 3));
      const norm = (s:string)=>s.trim().toLowerCase();
      const hero = (c.kpis ?? []).find(k => norm(k.short ?? "") === norm(c.hero_kpi ?? ""));
      const hist = (hero?.history ?? []) as Array<number|{v?:number}>;
      const lastRaw = hist.length ? hist[hist.length-1] : null;
      const heroLast = typeof lastRaw === "number" ? lastRaw : (lastRaw && typeof lastRaw === "object" ? (lastRaw as {v?:number}).v ?? null : null);
      const stories = buildStories(c.kpis ?? [], (c as unknown as {market_positions?:never[]}).market_positions);
      out[t] = { hero: c.hero_kpi, heroLast, heroPts: hist.length, scores, storyCats: (stories as unknown[]).length };
    } catch (e) { out[t] = { error: String(e).slice(0,120) }; }
  }
  fs.writeFileSync(path.join(ROOT,".conv-state/fingerprints-local.json"), JSON.stringify(out, null, 1));
  console.log("fingerprints:", Object.keys(out).length);
}
main();
