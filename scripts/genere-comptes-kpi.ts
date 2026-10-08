/**
 * Totaux automatiques des KPI (Yann 8 oct 2026).
 *   npx tsx scripts/genere-comptes-kpi.ts [--sec]
 *
 * Charge chaque fiche de l univers comme la page publique (loadV17Company,
 * blocs desactives en base), compte les KPI servis par bloc
 * (src/lib/comptes-kpi.ts) et ecrit src/data/kpi-comptes-industries.json.
 * Appele par scripts/deploy-niveau2.sh a chaque mise en ligne.
 * --sec : calcule et affiche sans ecrire le fichier.
 *
 * Garde-fous : rien n est ecrit si plus de 3 % des fiches echouent, ou si le
 * total ou le moyen terme s effondre (> 25 % de baisse) par rapport au fichier
 * precedent (Supabase injoignable, chargeur casse).
 */
import { promises as fs, readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
// .env.local (Supabase : graphiques approuves, blocs desactives).
try {
  for (const l of readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env.local : les blocs en base seront comptes a zero, le garde-fou bloquera */
}

const SORTIE = path.join(ROOT, "src/data/kpi-comptes-industries.json");
const PARALLELE = 4;

(async () => {
  const sec = process.argv.includes("--sec");
  const { loadV17Company } = await import("../src/lib/company-core/load-company");
  const { resolveDisabledForTicker } = await import("../src/lib/disabled-blocks-server");
  const { estAlias } = await import("../src/lib/ticker-aliases");
  const { compteBlocsSociete, agregeComptes, REGLE_COMPTES } = await import("../src/lib/comptes-kpi");
  type CS = import("../src/lib/comptes-kpi").CompteSociete;

  const uni = JSON.parse(await fs.readFile("src/data/v1-9-5-clean-all-tickers.json", "utf-8")) as { tickers: string[] };
  const retirees = Object.keys((JSON.parse(await fs.readFile("src/data/societes-retirees.json", "utf-8")) as { tickers: Record<string, string> }).tickers);
  const tickers = [...new Set(uni.tickers.map((t) => t.toUpperCase()))].filter((t) => !t.startsWith("_") && !estAlias(t) && !retirees.includes(t));

  const parSociete: Record<string, CS> = {};
  const echecs: string[] = [];
  let i = 0;
  const t0 = Date.now();
  async function ouvrier() {
    while (i < tickers.length) {
      const t = tickers[i++];
      try {
        const [r, off] = await Promise.all([loadV17Company(t, { mode: "v18", locale: "fr" }), resolveDisabledForTicker(t)]);
        if (r.kind !== "ready") { echecs.push(`${t} (${r.kind})`); continue; }
        parSociete[r.company.ticker.toUpperCase()] = compteBlocsSociete(r.company, off);
      } catch (e) {
        echecs.push(`${t} (${String(e).slice(0, 80)})`);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLELE }, ouvrier));
  const { global, par_industrie } = agregeComptes(parSociete);
  const sansGics = Object.entries(parSociete).filter(([, s]) => !s.gics || s.gics.length < 6).map(([t]) => t);

  console.log(`fiches ${Object.keys(parSociete).length}/${tickers.length} en ${Math.round((Date.now() - t0) / 1000)} s, echecs ${echecs.length}${echecs.length ? " : " + echecs.slice(0, 10).join(", ") : ""}`);
  if (sansGics.length) console.log(`sans code GICS (comptees dans le total general seulement) : ${sansGics.join(", ")}`);
  console.log(`industries ${Object.keys(par_industrie).length}`);
  console.log(JSON.stringify(global));

  // Garde-fous
  const erreurs: string[] = [];
  if (echecs.length > tickers.length * 0.03) erreurs.push(`${echecs.length} fiches en echec (> 3 %)`);
  try {
    const avant = JSON.parse(await fs.readFile(SORTIE, "utf-8")) as { global?: { total?: number; moyen_terme?: number } };
    const a = avant.global ?? {};
    if (a.total && global.total < a.total * 0.75) erreurs.push(`total ${global.total} contre ${a.total} avant (baisse > 25 %)`);
    if (a.moyen_terme && global.moyen_terme < a.moyen_terme * 0.75) erreurs.push(`moyen terme ${global.moyen_terme} contre ${a.moyen_terme} avant (baisse > 25 %)`);
  } catch {
    /* premier passage */
  }
  if (erreurs.length) {
    console.error("REFUS d ecrire le fichier : " + erreurs.join(" ; "));
    process.exit(2);
  }
  if (sec) { console.log("--sec : fichier non ecrit"); process.exit(0); }

  const maintenant = new Date();
  const out = {
    maj: maintenant.toISOString().slice(0, 10),
    genere_le: maintenant.toISOString(),
    regle: REGLE_COMPTES,
    global,
    par_industrie,
    par_societe: Object.fromEntries(Object.entries(parSociete).sort(([a], [b]) => a.localeCompare(b))),
  };
  await fs.writeFile(SORTIE, JSON.stringify(out, null, 1) + "\n");
  console.log(`ecrit ${path.relative(ROOT, SORTIE)}`);
  process.exit(0);
})();
