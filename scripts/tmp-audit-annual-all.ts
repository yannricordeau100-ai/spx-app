import fs from "node:fs";
import { loadV17Company } from "/Users/yann/spx-app/src/lib/company-core/load-company";
import { buildChartSpec } from "/Users/yann/spx-app/src/lib/chart-template";
async function main() {
  const sp = (JSON.parse(fs.readFileSync("/Users/yann/spx-app/src/data/sp500-tickers.json","utf8")) as string[]).map(s=>s.toUpperCase());
  let kpisChecked=0; const bad: Array<{t:string,kpi:string,pts:number}> = [];
  for (const t of sp) {
    try {
      const o = await loadV17Company(t,{mode:"v18"});
      if (o.kind!=="ready") continue;
      for (const k of (o.company.kpis??[])) {
        if ((k as {is_short_history?:boolean}).is_short_history) continue;
        if ((k as {period_type?:string}).period_type!=="quarter") continue;
        if (!(k.history??[]).length) continue;
        kpisChecked++;
        const spec = buildChartSpec(k as never, t, "year") as {values:number[]};
        if ((spec.values??[]).length===0) bad.push({t,kpi:k.short??"?",pts:(k.history??[]).length});
      }
    } catch {}
  }
  fs.writeFileSync("/Users/yann/spx-app/.conv-state/annual-empty-allkpi.json", JSON.stringify({kpisChecked, bad}, null, 1));
  console.log(JSON.stringify({kpisChecked, empty:bad.length, stes:new Set(bad.map(b=>b.t)).size}));
}
main();
