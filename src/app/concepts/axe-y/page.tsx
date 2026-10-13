import { promises as fs } from "fs";
import path from "path";
import { loadV17Company } from "@/lib/company-core/load-company";
import { assainirPourClient } from "@/lib/company-core/assainir-payload";
import type { Company } from "@/lib/data";
import { variablesPolicesAxeY } from "./polices";
import { AxeYClient } from "./client";

/**
 * /concepts/axe-y : 3 styles d ecriture de l axe Y (Yann 13 oct 2026), sur le
 * vrai graphique principal de CAT et un vrai KPI moyen terme. Rien n est en
 * ligne : le choix se fera dans src/lib/style-axe-y.json (« actif »).
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Concepts · Axe Y · Mettrik AI" };

const SLUG_MT = "cat-production-engins-chantier-us";
const STYLES = ["actuel", "A", "B", "C"] as const;

export default async function AxeYPage() {
  const r = await loadV17Company("CAT", { mode: "v18", locale: "fr" });
  const company = r.kind === "ready" ? (assainirPourClient(r.company as Company) as Company) : null;
  const mt: Record<string, string | null> = {};
  for (const s of STYLES) {
    const f = path.join(process.cwd(), "public/concepts/axe-y", `${SLUG_MT}-${s}-dark.svg`);
    mt[s] = await fs.access(f).then(() => `/concepts/axe-y/${SLUG_MT}-${s}-dark.svg`).catch(() => null);
  }
  return (
    <div className={variablesPolicesAxeY}>
      <AxeYClient company={company} mt={mt} />
    </div>
  );
}
