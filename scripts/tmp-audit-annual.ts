import fs from "node:fs";
import { loadV17Company } from "/Users/yann/spx-app/src/lib/company-core/load-company";
import { buildChartSpec } from "/Users/yann/spx-app/src/lib/chart-template";
import { aggregateQuarterlyToAnnual, } from "/Users/yann/spx-app/src/lib/kpi-aggregation";
import { getKpiAggregationKind } from "/Users/yann/spx-app/src/lib/kpi-aggregation";
import { getFiscalAudit } from "/Users/yann/spx-app/src/lib/fiscal-calendar";
async function main() {
  const sp = (JSON.parse(fs.readFileSync("/Users/yann/spx-app/src/data/sp500-tickers.json","utf8")) as string[]).map(s=>s.toUpperCase());
  const issues: Array<[string,string]> = [];
  for (const t of sp) {
    try {
      const o = await loadV17Company(t,{mode:"v18"});
      if (o.kind!=="ready") continue;
      const c=o.company; const norm=(s:string)=>s.trim().toLowerCase();
      const hero=(c.kpis??[]).find(k=>norm(k.short??"")===norm(c.hero_kpi??""));
      if (!hero) continue;
      const pt=(hero as {period_type?:string}).period_type;
      const freq=(hero as {frequency?:string}).frequency;
      if (pt!=="quarter" && freq!=="quarterly") continue; // vue annuelle = agrégation seulement pour quarterly
      // valeurs (chart-template, comme le graph)
      const spec = buildChartSpec(hero as never, t, "year") as {values:number[];labels:string[];ttm:number|null};
      // labels (company-view, comme l'axe X) — MÊME appel depuis le fix
      const audit=getFiscalAudit(t); const fyEnd=audit?.fiscalYearEndMonth ?? 12;
      const kind=getKpiAggregationKind(hero as never);
      const agg=aggregateQuarterlyToAnnual((hero.history as number[])??[], (hero as {last_data_date?:string}).last_data_date, kind, fyEnd, (hero as {history_periods?:string[]}).history_periods);
      if (spec.values.length !== agg.years.length) issues.push([t,`values=${spec.values.length} vs labels=${agg.years.length}`]);
      else if (spec.values.length===0) issues.push([t,"0 FY complète en vue annuelle"]);
    } catch (e) { issues.push([t,"crash "+String(e).slice(0,60)]); }
  }
  console.log(JSON.stringify({checked:sp.length, issues:issues.length, detail:issues.slice(0,20)}));
}
main();
