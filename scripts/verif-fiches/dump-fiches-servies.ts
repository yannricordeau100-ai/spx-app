/**
 * Copie de chaque fiche telle qu elle est REELLEMENT servie (29 sept 2026).
 * Charge la societe par le vrai chargeur (loadV17Company, mode v18, francais),
 * applique l assainissement client, et ecrit un JSON par societe dans le
 * dossier donne. Sert de base a la verification exhaustive des 662 fiches
 * (controles mecaniques puis relecture par agents), sans navigateur.
 *
 * Usage : npx tsx scripts/dump-fiches-servies.ts <dossier de sortie> [TICKER ...]
 */
import fs from "node:fs";
import path from "node:path";
import { loadV17Company } from "../../src/lib/company-core/load-company";
import { assainirPourClient } from "../../src/lib/company-core/assainir-payload";

(async () => {
  const [dossier, ...tickersArg] = process.argv.slice(2);
  if (!dossier) { console.error("dossier de sortie requis"); process.exit(1); }
  fs.mkdirSync(dossier, { recursive: true });
  const univers: string[] = tickersArg.length
    ? tickersArg
    : JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")).tickers;
  const etats: Record<string, string> = {};
  let n = 0;
  for (const t of univers) {
    n++;
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      etats[t] = r.kind;
      if (r.kind === "ready") {
        const c = assainirPourClient(r.company);
        fs.writeFileSync(path.join(dossier, `${t}.json`), JSON.stringify(c));
      }
    } catch (e) {
      etats[t] = `erreur: ${String(e).slice(0, 120)}`;
    }
    if (n % 50 === 0) console.error(`... ${n}/${univers.length}`);
  }
  fs.writeFileSync(path.join(dossier, "_etats.json"), JSON.stringify(etats, null, 1));
  const nonPrets = Object.entries(etats).filter(([, k]) => k !== "ready");
  console.log(`${univers.length} societes, ${univers.length - nonPrets.length} servies, ${nonPrets.length} non pretes`);
  for (const [t, k] of nonPrets) console.log(`  ${t}: ${k}`);
})();
