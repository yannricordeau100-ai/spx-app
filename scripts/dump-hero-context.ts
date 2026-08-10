/**
 * dump-hero-context.ts — sort le CONTEXTE de rendu reel d'une liste de tickers,
 * pour decider un fix hero / une decontamination sans re-extraire.
 *
 * Reprend a l'identique la selection de hero de qualify-stes.ts
 * (effectiveDefaultHero) : on veut le KPI REELLEMENT AFFICHE, pas co.hero_kpi.
 *
 * Usage : source .env.local && npx tsx scripts/dump-hero-context.ts AAPL MSFT ...
 * Sortie : /tmp/hero-context.json
 */
import { loadV17Company } from "../src/lib/company-core/load-company";
import { isGenericKpi } from "../src/lib/kpi-generic";
import fs from "fs";

const TOTAL_REV = new Set(["total revenue", "revenue", "revenues", "net sales", "total revenues", "total net sales", "operating revenue", "ca", "revenu", "revenus", "chiffre d affaires", "ca total", "revenu total", "total rev", "net revenue", "total sales", "sales",
  "revenu d exploitation", "revenus d exploitation", "produits d exploitation",
  "chiffre d affaires total", "ventes totales", "revenu net", "revenus totaux",
  "ca t", "rev fy", "rev y", "rev q", "group revenue", "group revenues",
  "consolidated revenue", "consolidated revenues", "consolidated net sales",
  "total group revenue", "revenue fy", "revenue total", "turnover",
  "group turnover", "total turnover", "ca annuel", "ca fy"]);

function normShort(s: unknown): string {
  return String(s || "").toLowerCase().replace(/[_\-.'’]+/g, " ").replace(/\s+/g, " ").trim();
}
function num(x: any): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const n = parseFloat(x.replace(/\s/g, "").replace(/,/g, "."));
    return isNaN(n) ? null : n;
  }
  if (x && typeof x === "object" && typeof x.value !== "undefined") return num(x.value);
  return null;
}
function hist(k: any): number[] {
  return (k.history || []).map(num).filter((x: any) => x !== null) as number[];
}
const pctMarg = (k: any) => {
  const u = String(k?.unit || "").trim();
  const s = String(k?.short || "");
  return u === "%" || /margin|marge|ratio|taux|growth|croissance|yield|rendement/i.test(s) || ["GM", "ROE", "ROTE", "ROIC", "ROA", "ROCE", "NIM", "ROTCE"].includes(s);
};

(async () => {
  const out: any[] = [];
  for (const t of process.argv.slice(2)) {
    const TU = t.toUpperCase();
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      if (!co || !Array.isArray(co.kpis) || !co.kpis.length) {
        out.push({ ticker: TU, error: "REDIRECT/empty" });
        continue;
      }
      const usableK = (k: any) => k && num(k.value) !== null && num(k.value) !== 0 && hist(k).length > 0;
      const bestQ = (() => {
        let b: any = null;
        for (const k of co.kpis) {
          if (k.period_type !== "quarter" || pctMarg(k) || isGenericKpi(k?.short)) continue;
          const h = hist(k).length;
          if (h < 16) continue;
          if (!b || h > b.h) b = { short: k.short, h };
        }
        return b ? b.short : null;
      })();
      const cfgK = co.kpis.find((k: any) => k.short === co.hero_kpi);
      const cfgQ = cfgK && cfgK.period_type === "quarter" && hist(cfgK).length >= 4;
      let heroShort: string;
      if (usableK(cfgK) && cfgQ && !pctMarg(cfgK)) heroShort = co.hero_kpi;
      else if (bestQ) heroShort = bestQ;
      else if (usableK(cfgK) && !pctMarg(cfgK)) heroShort = co.hero_kpi;
      else heroShort = co.kpis.find((k: any) => usableK(k) && hist(k).length >= 3 && !pctMarg(k) && !isGenericKpi(k?.short))?.short ?? co.hero_kpi;

      const totCands = co.kpis.filter((k: any) => TOTAL_REV.has(normShort(k.short))).map((k: any) => num(k.value)).filter((x: any): x is number => x !== null);
      const totv = totCands.length ? Math.max(...totCands) : null;

      out.push({
        ticker: TU,
        configured_hero: co.hero_kpi ?? null,
        effective_hero: heroShort,
        ca_total: totv,
        kpis: co.kpis.map((k: any) => ({
          short: k.short,
          name_fr: k.name_fr ?? k.name ?? null,
          name_en: k.name_en ?? null,
          unit: k.unit ?? null,
          period_type: k.period_type ?? null,
          value: k.value ?? null,
          hist_len: hist(k).length,
          history: hist(k),
          last_data_date: k.last_data_date ?? null,
          generic: isGenericKpi(k?.short),
          pct: pctMarg(k),
          total_rev_label: TOTAL_REV.has(normShort(k.short)),
        })),
      });
    } catch (e: any) {
      out.push({ ticker: TU, error: String(e).slice(0, 200) });
    }
  }
  fs.writeFileSync("/tmp/hero-context.json", JSON.stringify(out, null, 1));
  console.log("dump", out.length, "-> /tmp/hero-context.json");
})();
