import fs from "node:fs";
import { estKpiStandard } from "@/lib/kpi-standard";
import { isGenericKpi } from "@/lib/kpi-generic";
const plan = JSON.parse(fs.readFileSync("/tmp/hero-industrie-plan.json", "utf8")) as Record<string, { avant: string | null; apres: string; nom: string; points: number }>;
const B: Record<string, unknown> = {};
for (const [t, v] of Object.entries(plan)) {
  let kpis: any[] = [];
  try { kpis = JSON.parse(fs.readFileSync(`.batches-drafts-safe/kpis-haut/${t}.json`, "utf8")).kpis ?? []; } catch {}
  try { const b = JSON.parse(fs.readFileSync(`src/data/v2-pipeline/${t.toLowerCase()}.json`, "utf8")); const sh = new Set(kpis.map((k) => k.short)); kpis = kpis.concat((b.kpis ?? []).filter((k: any) => !sh.has(k.short))); } catch {}
  const cur = kpis.find((k) => k.short === v.avant);
  const pts = cur?.history?.length ?? 0;
  const generique = !cur || pts < 5 || isGenericKpi(cur.short) || estKpiStandard(cur);
  if (generique) B[t] = { ...v, hero_actuel_nom: cur?.name_fr ?? null, hero_actuel_points: pts };
}
fs.writeFileSync("/tmp/hero-industrie-B.json", JSON.stringify(B, null, 1));
console.log("B", Object.keys(B).length, "sur", Object.keys(plan).length);
for (const t of Object.keys(B).slice(0, 12)) console.log(" ", t, "|", (B[t] as any).hero_actuel_nom, "->", (B[t] as any).nom, (B[t] as any).points);
