/**
 * 13 oct 2026 : ecart d unite entre le gros chiffre du KPI principal et sa ligne
 * dans le tableau « Indicateurs cles » (CAT « 25,1 Mds $ » contre « 25,1 M $ »).
 * Rejoue, sur les fiches servies (dump-fiches-servies.ts), le calcul du hero
 * (computeChartDisplay puis formatHeroValue) et celui de la ligne AVANT la
 * correction (valeur du graphe collee a kpi.unit).
 * Usage : npx tsx scripts/verif-fiches/ecart-unite-hero.ts <dossier du dump>
 */
import fs from "node:fs";
import path from "node:path";
import { computeChartDisplay } from "../../src/components/chart-cycle";
import { formatHeroValue } from "../../src/lib/data";

const dossier = process.argv[2];
const touches: string[] = [];
let n = 0;
for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith(".json") && !x.startsWith("_"))) {
  const c = JSON.parse(fs.readFileSync(path.join(dossier, f), "utf8"));
  const k = (c.kpis ?? []).find((x: { short?: string }) => x.short === c.hero_kpi);
  if (!k) continue;
  n++;
  const hist = (Array.isArray(k.history) ? k.history : []).map((v: unknown) => (typeof v === "number" ? v : null));
  const unit = String(k.unit ?? "");
  const g = computeChartDisplay(hist, unit, null, 1);
  if (g.lastValue == null) continue;
  const hero = formatHeroValue(g.lastValue, g.displayUnit);
  const ligneAvant = formatHeroValue(g.lastValue, unit);
  if (hero.unit !== ligneAvant.unit || hero.value !== ligneAvant.value) {
    touches.push(`${c.ticker}\t${k.short}\thero ${hero.value} ${hero.unit}\tligne ${ligneAvant.value} ${ligneAvant.unit}`);
  }
}
console.log(`${n} fiches avec KPI principal, ${touches.length} avec ecart hero / tableau`);
console.log(touches.join("\n"));
