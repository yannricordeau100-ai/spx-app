/**
 * verif-hero-generique.ts : CONTROLE BLOQUANT du hero servi (7 oct 2026).
 *
 * Charge le VRAI chargeur (loadV17Company, mode v18) sur toutes les societes de
 * src/data/v1-9-5-clean-all-tickers.json et echoue (code 1) si :
 *  - un override Supabase desk_hero_kpi_overrides est ORPHELIN (son short n'est
 *    pas dans la liste servie) ;
 *  - un hero servi est generique ou comptable (definition partagee,
 *    src/lib/kpi-hero-generic.ts) alors qu'un KPI specifique eligible existe
 *    et que le hero ne vient pas d'un override pose a la main.
 * Non bloquants, listes pour arbitrage : override pose a la main mais generique
 * (alors qu'un specifique existe) ; hero generique faute de specifique.
 *
 * Usage : set -a; source .env.local; set +a; npx tsx scripts/verif-hero-generique.ts [sortie.json] [T1 T2 ...]
 */
import { loadV17Company } from "../src/lib/company-core/load-company";
import { heroSpecifiqueValide, type HeroKpiLike } from "../src/lib/hero-select";
import { raisonGenerique } from "../src/lib/kpi-hero-generic";
import V195FILE from "../src/data/v1-9-5-clean-all-tickers.json";
import fs from "fs";

const args = process.argv.slice(2);
const OUT = args[0] && args[0].endsWith(".json") ? args.shift()! : "/tmp/verif-hero-generique.json";
const universe = args.length ? args.map((t) => t.toUpperCase()) : (V195FILE as { tickers: string[] }).tickers.map((t) => t.toUpperCase());

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i]); }
  }));
  return out;
}

(async () => {
  const rows = await pool(universe, 4, async (t) => {
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      const kpis: HeroKpiLike[] = Array.isArray(co?.kpis) ? co.kpis : [];
      if (!co || kpis.length === 0) return { t, vide: true } as any;
      const hero = String(co.hero_kpi ?? "");
      const hk = kpis.find((k) => k.short === hero);
      const specifiques = kpis.filter(heroSpecifiqueValide);
      return {
        t,
        hero,
        nom: hk?.name_fr ?? null,
        source: co.hero_kpi_source ?? null,
        orphelin: co.hero_kpi_orphelin ?? null,
        generique: hk ? raisonGenerique(hk) : null,
        nb_specifiques: specifiques.length,
        meilleur_specifique: specifiques.length ? String(specifiques[0].short) : null,
      };
    } catch (e: any) {
      return { t, vide: true, err: String(e).slice(0, 80) } as any;
    }
  });
  const ok = rows.filter((r: any) => !r.vide);
  const orphelins = ok.filter((r: any) => r.orphelin);
  const generiques = ok.filter((r: any) => r.generique);
  const bloquants = generiques.filter((r: any) => r.source !== "override" && r.nb_specifiques > 0);
  const overrideGeneriques = generiques.filter((r: any) => r.source === "override" && r.nb_specifiques > 0);
  const restants = generiques.filter((r: any) => r.nb_specifiques === 0);
  fs.writeFileSync(OUT, JSON.stringify({ univers: universe.length, charges: ok.length, vides: rows.length - ok.length, orphelins, bloquants, overrideGeneriques, restants, rows: ok }, null, 1));
  console.log(`Univers ${universe.length}, charges ${ok.length}, vides ${rows.length - ok.length}`);
  console.log(`Heros generiques servis : ${generiques.length} (bloquants ${bloquants.length}, override pose a la main ${overrideGeneriques.length}, sans specifique disponible ${restants.length})`);
  console.log(`Overrides orphelins : ${orphelins.length}`);
  for (const r of orphelins as any[]) console.log(`  ORPHELIN ${r.t}: "${r.orphelin}" -> ${r.hero}`);
  for (const r of bloquants as any[]) console.log(`  BLOQUANT ${r.t}: ${r.hero} (${r.generique}) alors que ${r.meilleur_specifique} existe`);
  for (const r of overrideGeneriques as any[]) console.log(`  ARBITRAGE ${r.t}: override ${r.hero} (${r.generique}), specifique dispo ${r.meilleur_specifique}`);
  for (const r of restants as any[]) console.log(`  SANS SPECIFIQUE ${r.t}: ${r.hero} (${r.generique})`);
  process.exit(orphelins.length || bloquants.length ? 1 : 0);
})();
