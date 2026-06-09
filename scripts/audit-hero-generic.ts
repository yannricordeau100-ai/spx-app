/**
 * audit-hero-generic.ts — AUDIT du vrai périmètre "hero générique".
 *
 * Pour chaque sté online (Supabase desk_curated_companies, min_plan != hidden)
 * UNION chaque V195 (src/data/v1-9-5-clean-all-tickers.json), calcule le hero
 * RÉEL rendu par loadV17Company(t,{mode:'v18'}).company.hero_kpi et flag celles
 * dont le hero est GÉNÉRIQUE au sens de la page (isGenericKpi, par NOM via
 * kpi-generic-library.json). = pages genuinement fausses (comme MCHP).
 *
 * Usage : source .env.local && npx tsx scripts/audit-hero-generic.ts [outPath]
 * Sortie : console + outPath (defaut /tmp/hero-audit.json).
 */
import { loadV17Company } from "../src/lib/company-core/load-company";
import { isGenericKpi } from "../src/lib/kpi-generic";
import { createClient } from "@supabase/supabase-js";
import V195FILE from "../src/data/v1-9-5-clean-all-tickers.json";
import fs from "fs";

const V195 = (V195FILE as { tickers: string[] }).tickers;

const OUT = process.argv[2] || "/tmp/hero-audit.json";
const CONCURRENCY = 6;

async function onlineTickers(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.from("desk_curated_companies").select("ticker, min_plan");
  if (error) { console.error("Supabase online err:", error.message); return []; }
  return (data ?? [])
    .filter((r: { min_plan?: string | null }) => r.min_plan && r.min_plan !== "hidden")
    .map((r: { ticker: string }) => String(r.ticker).toUpperCase());
}

async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

(async () => {
  const online = await onlineTickers();
  const v195 = (V195 as string[]).map((t) => String(t).toUpperCase());
  const onlineSet = new Set(online);
  // Univers = union, dédup par uppercase.
  const universe = Array.from(new Set([...online, ...v195]));
  console.log(`Univers: ${universe.length} (online=${online.length}, V195=${v195.length})`);

  const rows = await pool(universe, CONCURRENCY, async (t) => {
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      const hero: string | null = co && typeof co.hero_kpi === "string" ? co.hero_kpi : null;
      const empty = !co || !Array.isArray(co.kpis) || co.kpis.length === 0;
      return { ticker: t, hero, isGeneric: hero ? isGenericKpi(hero) : false, empty, online: onlineSet.has(t) };
    } catch (e: any) {
      return { ticker: t, hero: null, isGeneric: false, empty: true, err: String(e).slice(0, 80), online: onlineSet.has(t) };
    }
  });

  const generic = rows.filter((r) => r.isGeneric);
  const genericOnline = generic.filter((r) => r.online);
  const empties = rows.filter((r) => r.empty);
  const map: Record<string, { hero: string | null; isGeneric: boolean; empty: boolean; online: boolean }> = {};
  for (const r of rows) map[r.ticker] = { hero: r.hero, isGeneric: r.isGeneric, empty: r.empty, online: r.online };

  const payload = {
    universe: universe.length,
    online: online.length,
    v195: v195.length,
    rendered: rows.filter((r) => !r.empty).length,
    empty: empties.length,
    genericCount: generic.length,
    genericOnlineCount: genericOnline.length,
    generic: generic.map((r) => ({ ticker: r.ticker, hero: r.hero, online: r.online })),
    map,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n=== HERO GÉNÉRIQUE (page fausse) : ${generic.length} stés / ${rows.filter((r) => !r.empty).length} rendues ===`);
  console.log(`    dont ONLINE : ${genericOnline.length}`);
  console.log(generic.map((r) => `${r.ticker}${r.online ? "*" : ""}=${r.hero}`).join(", ") || "(aucune)");
  console.log(`\nSortie: ${OUT}  (empties/redirect: ${empties.length})`);
})();
