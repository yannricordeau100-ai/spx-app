import { loadV17Company } from "/Users/yann/spx-app/src/lib/company-core/load-company";
import { buildChartSpec } from "/Users/yann/spx-app/src/lib/chart-template";
async function main() {
  const TIX = ["CPB","CRWD","CSCO","CSGP","CSX","CTAS","CTSH","CTVA","CVX","DASH","DD","DE","DELL","DHR","DHI","DIS","DLR","DLTR","DOC","DOV"];
  const out: Record<string, Array<{kpi:string,pts:number,ldd?:string,periods?:string[]|null,unit?:string,hist:number[]}>> = {};
  const shortSkip: Record<string, number> = {};
  for (const t of TIX) {
    out[t]=[]; shortSkip[t]=0;
    try {
      const o = await loadV17Company(t,{mode:"v18"});
      if (o.kind!=="ready") { out[t]=[{kpi:"__NOT_READY__",pts:0,hist:[]}]; continue; }
      for (const k of (o.company.kpis??[])) {
        const kk = k as {is_short_history?:boolean; period_type?:string; frequency?:string; history?:number[]; history_periods?:string[]; last_data_date?:string; short?:string; unit?:string};
        if (kk.period_type!=="quarter" && kk.frequency!=="quarterly") continue;
        if (kk.is_short_history) { shortSkip[t]++; continue; }
        if (!(kk.history??[]).length) continue;
        const spec = buildChartSpec(k as never, t, "year") as {values:number[]};
        if ((spec.values??[]).length===0) {
          out[t].push({kpi:kk.short??"?",pts:(kk.history??[]).length,ldd:kk.last_data_date,periods:kk.history_periods??null,unit:kk.unit,hist:(kk.history??[]).slice(-6)});
        }
      }
    } catch (e) { out[t]=[{kpi:"__ERR__:"+String(e).slice(0,80),pts:0,hist:[]}]; }
  }
  console.log(JSON.stringify({shortSkip,out},null,1));
}
main();
