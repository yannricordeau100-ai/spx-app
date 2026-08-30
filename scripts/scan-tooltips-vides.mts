/**
 * Détecteur "i" vides (Yann 30 août 2026, screen KO "Effet prix/mix").
 * Charge chaque sté via le VRAI loader (rendu final) et liste les KPI dont
 * le tooltip DÉFINITION serait vide (explanation absente ou blanche).
 * Usage : npx tsx --env-file=.env.local scripts/scan-tooltips-vides.mts [--all | TICKERS...]
 * Sortie : .conv-state/tooltips-vides.json + résumé stdout.
 */
import { loadV17Company } from "../src/lib/company-core/load-company";
import { readFileSync, writeFileSync } from "fs";

process.chdir(new URL("..", import.meta.url).pathname);

const args = process.argv.slice(2);
let tickers: string[];
if (!args.length || args[0] === "--all") {
  const d = JSON.parse(readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf-8"));
  tickers = d.tickers as string[];
} else tickers = args;

const vide = (v: unknown) => v == null || (typeof v === "string" && !v.trim());
const res: Record<string, { short: string; name: string }[]> = {};
let totalKpis = 0;
let done = 0;
for (const t of tickers) {
  try {
    const out = await loadV17Company(t, { mode: "v18" });
    const c = (out as { company?: { kpis?: unknown[] } }).company ?? out;
    const kpis = ((c as { kpis?: unknown[] }).kpis ?? []) as Record<string, unknown>[];
    for (const k of kpis) {
      totalKpis++;
      if (vide(k.explanation)) {
        (res[t] ||= []).push({
          short: String(k.short ?? "?"),
          name: String(k.name_fr ?? k.name ?? ""),
        });
      }
    }
  } catch {
    /* sté illisible : ignorée */
  }
  done++;
  if (done % 100 === 0) console.error(`... ${done}/${tickers.length}`);
}
const stes = Object.keys(res).sort();
const nb = stes.reduce((s, t) => s + res[t].length, 0);
console.log(`KPI rendus scannés: ${totalKpis} | tooltips vides: ${nb} | stés touchées: ${stes.length}/${tickers.length}`);
for (const t of stes.slice(0, 15)) console.log(`  ${t}: ${res[t].length} (${res[t].slice(0, 3).map((x) => x.short).join(", ")}...)`);
writeFileSync(".conv-state/tooltips-vides.json", JSON.stringify(res, null, 1));
console.log("détail -> .conv-state/tooltips-vides.json");
