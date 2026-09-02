import { loadV17Company } from "../src/lib/company-core/load-company";
import { orderKpis, isPhysicalKpi } from "../src/lib/kpi-ordering";
import * as fs from "fs";
(async () => {
  const state = JSON.parse(fs.readFileSync(".conv-state/att-state.json", "utf-8"));
  const out: Record<string, { pos1: string; unit: string; phys: boolean }> = {};
  let phys = 0, err = 0;
  for (const t of state.done) {
    try {
      const r: any = await loadV17Company(t, { mode: "v18", locale: "fr" });
      const c = r?.company ?? r;
      if (!c?.kpis) { err++; continue; }
      const o = orderKpis(c.kpis, c.hero_kpi);
      const k = o[0];
      const ok = k ? isPhysicalKpi(k) : false;
      if (ok) phys++;
      out[t] = { pos1: k?.short ?? "AUCUN", unit: k?.unit ?? "", phys: ok };
    } catch { err++; }
  }
  fs.writeFileSync(".conv-state/audit-pos1-651.json", JSON.stringify({ phys, err, total: state.done.length, items: out }, null, 1));
  console.log("phys:", phys, "/", state.done.length, "err:", err);
})();
