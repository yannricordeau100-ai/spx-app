import { loadV17Company } from "@/lib/company-core/load-company";
import { __auditStories } from "@/lib/kpi-stories-ordering";
import { famillesDe } from "@/lib/kpi-standard";
const tickers = process.argv.slice(2);
(async () => {
  for (const t of tickers) {
    const c = await loadV17Company(t).catch(() => null);
    if (!c) { console.log(`${t}\tfiche introuvable`); continue; }
    const kpis = (((c as any).company ?? (c as any).data ?? c).kpis ?? []) as any[];
    const ic = kpis.filter((k) => !k.is_short_history && !(k.story_category && (k.history?.length ?? 0) <= 2));
    const { avant, apres } = __auditStories(kpis);
    const icVals = new Set(ic.map((k) => `${k.value}|${String(k.unit ?? "").toLowerCase()}`));
    const icFam = new Set(ic.flatMap((k) => famillesDe([k.short, k.name_fr, k.name_en])));
    const retenues = kpis.filter((k) => apres.includes(k.short));
    const doublons = retenues.filter((k) => icVals.has(`${k.value}|${String(k.unit ?? "").toLowerCase()}`)).map((k) => k.short);
    console.log(`${t}\tIC ${ic.length}\tstories ${avant.length} -> ${apres.length}\tvaleur deja en IC: ${doublons.length ? doublons.join(", ") : "0"}`);
  }
})();
