import { loadV17Company } from "@/lib/company-core/load-company";
(async () => { for (const t of process.argv.slice(2)) { const c: any = await loadV17Company(t); console.log(t, c.kind, c.reason ?? "", Object.keys(c).join(",")); } })();
