import { formatHeroValue } from "../src/lib/data";
for (const [v,u] of [[970,"M $"],[15.742,"Mds $"],[3.812,"Mds $"],[23000,"salariés"],[23,"milliers"],[6630,"brevets"],[6.63,"milliers"]] as [number,string][]) {
  const r = formatHeroValue(v,u); console.log(v,"|",u,"=>",r.value,"|",r.unit);
}
