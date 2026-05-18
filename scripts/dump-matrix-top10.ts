import { buildMatrix } from "@/lib/desk/data-quality-matrix";

(async () => {
  const sections = await buildMatrix({ limit: 10 });
  for (const sec of sections) {
    for (const row of sec.rows) {
      const cells = row.cells as Record<string, any>;
      const issues: string[] = [];
      for (const [k, c] of Object.entries(cells)) {
        const status = c?.auto?.status ?? c?.status ?? "?";
        if (["auto_ko", "auto_partial", "auto_stale"].includes(status)) {
          issues.push(`${k}:${status.replace("auto_", "")}`);
        }
      }
      console.log(`${row.ticker.padEnd(8)} ${(row.name || "").slice(0,28).padEnd(28)} | issues=${issues.length}`);
      if (issues.length) console.log(`         → ${issues.join(", ")}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
