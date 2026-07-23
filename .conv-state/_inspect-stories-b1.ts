import { loadV17Company } from "../src/lib/company-core/load-company";
const ticks = ["BBY","BDX","BEN","BKNG","BRK.B","BSX","CAG","CBRE","CCL","CDNS","CHTR","CL","CLX"];
function usable(k: any): boolean {
  const basic = new Set(["total revenue","revenue","net sales","sales","total sales","net revenue","chiffre d'affaires","chiffre d'affaires net","chiffre d'affaires total","revenu total","net income","net profit","net margin","net margin %","operating income","op income","operating profit","ebit","operating margin","op margin","operating margin %","gross margin","gross margin %","ebitda","ebitda margin","free cash flow","fcf","operating cash flow","ocf","eps","earnings per share","eps diluted","diluted eps","total assets","total debt","net debt","cash & equivalents","cash and equivalents","leverage ratio","roe","roic","return on equity","p/e ratio","market cap","market capitalization","shares outstanding","tax rate","effective tax rate","headcount","capex","r&d"]);
  if (basic.has((k.short??"").toLowerCase().replace(/\s+/g," ").trim())) return false;
  let hv=false;
  if (typeof k.value==="number") hv=Number.isFinite(k.value)&&Math.abs(k.value)>0;
  else if (typeof k.value==="string"){const s=k.value.trim();hv=s.length>0&&s!=="—"&&parseFloat(s.replace(/,/g,"."))!==0;}
  if(!hv) return false;
  if(!((k.name_fr??"").trim())) return false;
  return ((k.signal??"").trim().length>0)||((k.description??"").trim().length>0);
}
(async () => {
  const out: any = {};
  for (const t of ticks) {
    const o: any = await loadV17Company(t, { mode: "v18" });
    if (o.kind !== "ready") { out[t] = "LOAD:" + o.kind; continue; }
    const kpis = (o.company.kpis ?? []) as any[];
    const mp = (o.company as any).market_positions ?? [];
    const st = kpis.filter(k => k.is_short_history && usable(k));
    out[t] = {
      mp: mp.length,
      usable: st.map(k => ({ short: k.short, cat: k.story_category ?? null })),
    };
  }
  console.log("###JSON###");
  console.log(JSON.stringify(out, null, 1));
})();
