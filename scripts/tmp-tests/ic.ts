import { loadV17Company } from "@/lib/company-core/load-company";
(async () => { for (const t of process.argv.slice(2)) { const c: any = await loadV17Company(t); const co = c.company ?? c.data ?? c; const ks = (co.kpis ?? []) as any[]; console.log(t, ks.length, ks.filter((k) => !k.is_short_history).map((k) => k.short).slice(0, 12).join(" | ")); } })();
