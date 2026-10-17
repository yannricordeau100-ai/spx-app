/**
 * Controle quotidien des dates de prochains resultats (Yann, 17 oct 2026).
 * Fait passer le VRAI chargeur des fiches (loadV17Company) sur les 662 societes
 * de src/data/v1-9-5-clean-all-tickers.json et releve la date servie
 * (next_earnings_date). Ecrit src/data/controle-dates-resultats.json, lu par
 * src/lib/mises-a-jour/etat.ts (bloc « dates_resultats ») : alerte rouge de
 * /api/cron/alertes-maj et de /sandbox/mises-a-jour si une date servie est
 * passee ou absente. Purement mecanique : aucun appel a Claude ni a Gemini.
 *   npx tsx scripts/controle-dates-resultats.ts
 */
import { promises as fs } from "fs";
import { loadV17Company } from "@/lib/company-core/load-company";

type Ligne = { servie: string | null; calendrier: string | null };

(async () => {
  const auj = new Date().toISOString().slice(0, 10);
  const uni = JSON.parse(await fs.readFile("src/data/v1-9-5-clean-all-tickers.json", "utf-8")) as { tickers: string[] };
  const cal = (JSON.parse(await fs.readFile("src/data/earnings-calendar.json", "utf-8")) as { par_ticker?: Record<string, { prochaine?: string | null }> }).par_ticker ?? {};
  const par: Record<string, Ligne> = {};
  const nonChargees: string[] = [];
  for (const t of uni.tickers) {
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") { nonChargees.push(t); continue; }
      const d = (r.company as unknown as { next_earnings_date?: unknown }).next_earnings_date;
      const servie = typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
      const c = cal[t.toUpperCase()]?.prochaine;
      par[t] = { servie, calendrier: typeof c === "string" ? c.slice(0, 10) : null };
    } catch {
      nonChargees.push(t);
    }
  }
  const absentes = Object.entries(par).filter(([, l]) => !l.servie).map(([t]) => t);
  const passees = Object.entries(par).filter(([, l]) => l.servie && l.servie < auj).map(([t]) => t);
  const sortie = { calcule_le: new Date().toISOString(), univers: uni.tickers.length, chargees: Object.keys(par).length, non_chargees: nonChargees, absentes, passees, par_ticker: par };
  await fs.writeFile("src/data/controle-dates-resultats.json", JSON.stringify(sortie, null, 1));
  console.log(`dates de resultats : ${Object.keys(par).length}/${uni.tickers.length} fiches chargees, ${absentes.length} absente(s), ${passees.length} passee(s)`);
  if (absentes.length) console.log("  absentes :", absentes.join(", "));
  if (passees.length) console.log("  passees :", passees.map((t) => `${t} (${par[t].servie})`).join(", "));
  if (nonChargees.length) console.log("  non chargees :", nonChargees.join(", "));
  process.exit(0);
})();
