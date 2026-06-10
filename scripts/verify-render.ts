import { loadV17Company } from "../src/lib/company-core/load-company";
const tickers = ["intu","vz","mu","a","chtr","cmg","stld","regn","mtd","hii","cci","efx","es","mgm","goog"];
function num(x:any){ if(typeof x==="number")return x; if(x&&typeof x==="object"&&typeof x.value==="number")return x.value; return null; }
(async()=>{
  for(const t of tickers){
    try{
      const r:any = await loadV17Company(t, { mode: "v18" } as any);
      const co:any = r?.company ?? r?.data ?? r;
      if(!co || !co.kpis){ console.log(t.toUpperCase(),"-> pas de company/kpis (keys:",Object.keys(r||{}).join(","),")"); continue; }
      const hero = co.hero_kpi;
      const hk = (co.kpis||[]).find((k:any)=>k.short===hero);
      const hv = hk ? (hk.history||[]).map(num).filter((x:any)=>x!==null) : [];
      // total revenue kpi
      const tot = (co.kpis||[]).find((k:any)=>["total revenue","revenue","net sales","total revenues"].includes((k.short||"").toLowerCase()));
      const totv = tot ? num(tot.value) : null;
      const v = hk ? num(hk.value) : null;
      const contam = (v!==null && totv!==null && Math.abs(v-totv)<=Math.abs(totv)*0.01);
      console.log(t.toUpperCase(),"| hero AFFICHÉ =",JSON.stringify(hero),"| value=",hk?hk.value:"(KPI absent)","| n=",hv.length,"| =total?",contam,"| generic=",hk?hk.is_generic:"?");
    }catch(e:any){ console.log(t.toUpperCase(),"ERREUR:", String(e).slice(0,160)); }
  }
})();
