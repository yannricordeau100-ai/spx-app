import { loadV17Company } from "../src/lib/company-core/load-company";
import fs from "fs";
const top = JSON.parse(fs.readFileSync("/tmp/top50.json","utf-8"));
function num(x:any){ if(typeof x==="number")return x; if(typeof x==="string"){const n=parseFloat(x.replace(/,/g,"."));return isNaN(n)?null:n;} if(x&&typeof x==="object"&&typeof x.value!=="undefined")return num(x.value); return null; }
function hv(k:any){ return (k.history||[]).map(num).filter((x:any)=>x!==null); }
(async()=>{
  const GEN=["total revenue","revenue","net sales","total revenues","net revenue","operating revenue","ca"];
  for(const t of top){
    try{
      const r:any=await loadV17Company(t,{mode:"v18"} as any);
      const co:any=r?.company??r;
      if(!co||!co.kpis){console.log(t.toUpperCase(),"REDIRECT/empty");continue;}
      const kpis=co.kpis.filter((k:any)=>!k.is_generic && (num(k.value)!==null||(k.history||[]).length));
      const totK=co.kpis.find((k:any)=>GEN.includes((k.short||"").toLowerCase()));
      const totv=totK?num(totK.value):null;
      const flags:string[]=[];
      for(const k of co.kpis){
        const v=num(k.value); const h=hv(k);
        if((k.value===null||v===0)&&!k.is_generic && k.short===co.hero_kpi) flags.push(k.short+":VIDE/0");
        if(v!==null && totv!==null && Math.abs(v-totv)<=Math.abs(totv)*0.01 && (k.short||"").toLowerCase() !in GEN && !GEN.includes((k.short||"").toLowerCase())) {}
      }
      // dup + =total parmi KPI affichés
      const sigs:Record<string,string[]>={};
      for(const k of co.kpis){const h=hv(k); if(h.length>=4){const s=h.map((x:any)=>Math.round(x*1000)/1000).join(",");(sigs[s]=sigs[s]||[]).push(k.short);}}
      for(const s in sigs){if(sigs[s].length>1) flags.push("DUP["+sigs[s].join("=")+"]");}
      const hero=co.hero_kpi; const hk=co.kpis.find((k:any)=>k.short===hero); const hvv=hk?num(hk.value):null;
      const heroTot=(hvv!==null&&totv!==null&&Math.abs(hvv-totv)<=Math.abs(totv)*0.01&&!GEN.includes((hero||"").toLowerCase()));
      console.log(t.toUpperCase(),"| heroAffiché="+JSON.stringify(hero)+" v="+(hk?hk.value:"?"),(heroTot?"⚠️HERO=TOTAL":""),(flags.length?"| "+flags.slice(0,4).join(" "):"| ok"));
    }catch(e:any){console.log(t.toUpperCase(),"ERR",String(e).slice(0,80));}
  }
})();
