import fs from "node:fs";
import { loadV17Company } from "/Users/yann/spx-app/src/lib/company-core/load-company";
import { buildStories } from "/Users/yann/spx-app/src/lib/kpi-stories-ordering";
async function main() {
  const sp = (JSON.parse(fs.readFileSync("/Users/yann/spx-app/src/data/sp500-tickers.json","utf8")) as string[]).map(s=>s.toUpperCase());
  const dist: Record<number, number> = {};
  const under5: Array<[string, number]> = [];
  for (const t of sp) {
    try {
      const o = await loadV17Company(t, { mode: "v18" });
      if (o.kind !== "ready") continue;
      const cats = buildStories(o.company.kpis ?? [], (o.company as any).market_positions) as Array<{slides: unknown[]}>;
      const slides = cats.reduce((n, c) => n + c.slides.length, 0);
      dist[slides] = (dist[slides] ?? 0) + 1;
      if (slides < 5) under5.push([t, slides]);
    } catch {}
  }
  console.log("distribution nb slides:", JSON.stringify(Object.fromEntries(Object.entries(dist).sort((a,b)=>+a[0]-+b[0]))));
  console.log("stés <5 slides:", under5.length);
  console.log(JSON.stringify(under5));
}
main();
