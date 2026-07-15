import { loadV17Company } from "/Users/yann/spx-app/src/lib/company-core/load-company";
import { buildChartSpec } from "/Users/yann/spx-app/src/lib/chart-template";
import { getKpiAggregationKind } from "/Users/yann/spx-app/src/lib/kpi-aggregation";
import { getFiscalAudit } from "/Users/yann/spx-app/src/lib/fiscal-calendar";

async function main() {
  const tickers = process.argv.slice(2);
  const out: Record<string, unknown> = {};
  for (const t of tickers) {
    try {
      const o = await loadV17Company(t, { mode: "v18" });
      if (o.kind !== "ready") { out[t] = { err: "not ready" }; continue; }
      const c = o.company;
      const norm = (s: string) => s.trim().toLowerCase();
      const hero = (c.kpis ?? []).find((k) => norm(k.short ?? "") === norm(c.hero_kpi ?? ""));
      if (!hero) { out[t] = { err: "no hero" }; continue; }
      const h = hero as unknown as { short?: string; history?: number[]; history_periods?: string[]; last_data_date?: string; unit?: string; period_type?: string; frequency?: string };
      const spec = buildChartSpec(hero as never, t, "year") as { values: number[]; labels: string[] };
      const audit = getFiscalAudit(t);
      out[t] = {
        short: h.short,
        unit: h.unit,
        pt: h.period_type,
        freq: h.frequency,
        ldd: h.last_data_date,
        fyEnd: audit?.fiscalYearEndMonth ?? 12,
        kind: getKpiAggregationKind(hero as never),
        nHist: (h.history ?? []).length,
        periods: h.history_periods ?? null,
        hist: h.history ?? [],
        yearLabels: spec.labels,
        yearValues: spec.values,
      };
    } catch (e) {
      out[t] = { err: String(e).slice(0, 200) };
    }
  }
  console.log(JSON.stringify(out, null, 1));
}
main();
