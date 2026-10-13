/**
 * KPI de chaque fiche tels qu ils sont REELLEMENT servis (13 oct 2026), toutes
 * sources confondues (kpis-haut, v2-pipeline, v2-pipeline-enrich, reperes
 * annuels...), apres fusion par le vrai chargeur (loadV17Company, mode v18, fr).
 * Pour chaque KPI : identifiant, noms, unite, type comparable, periodes et
 * valeurs, _source, et groupe d affichage (groupesKpisFiche : avances,
 * standards, arretes ; « non » = present dans les donnees mais pas au tableau).
 * Sert a scripts/scan-kpi-doublons-servis.py.
 *
 * Usage : npx tsx scripts/verif-fiches/dump-kpis-servis.ts <fichier.json> [TICKER ...]
 */
import fs from "node:fs";
import { loadV17Company } from "../../src/lib/company-core/load-company";
import { groupesKpisFiche } from "../../src/lib/groupes-kpis-fiche";

type K = Record<string, unknown>;

(async () => {
  const [sortie, ...tickersArg] = process.argv.slice(2);
  if (!sortie) { console.error("fichier de sortie requis"); process.exit(1); }
  const univers: string[] = tickersArg.length
    ? tickersArg
    : JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")).tickers;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const t of univers) {
    n++;
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") { out[t] = { etat: r.kind }; continue; }
      const c = r.company as unknown as K & { kpis?: K[]; hero_kpi?: string; kpi_instit?: { kpis?: { short: string; fr: string }[] } };
      const g = groupesKpisFiche(r.company);
      const groupe = new Map<unknown, string>();
      for (const [nom, l] of [["avance", g.avances], ["standard", g.standards], ["arrete", g.arretes]] as const)
        for (const k of l ?? []) groupe.set(k, nom);
      out[t] = {
        etat: "ready",
        hero: c.hero_kpi ?? null,
        instit: (c.kpi_instit?.kpis ?? []).map((x) => ({ short: x.short, fr: x.fr })),
        kpis: (c.kpis ?? []).map((k) => {
          const h = Array.isArray(k.history) ? (k.history as unknown[]) : [];
          const hp = Array.isArray(k.history_periods) ? (k.history_periods as unknown[]) : [];
          const hist = h.map((x, i) =>
            x && typeof x === "object" ? { q: String((x as K).q ?? ""), v: (x as K).v } : { q: String(hp[i] ?? ""), v: x },
          );
          return {
            short: k.short, name_fr: k.name_fr, name_en: k.name_en, unit: k.unit,
            type_comparable: k.type_comparable ?? null, period_type: k.period_type ?? null,
            _source: k._source ?? null, history: hist, groupe: groupe.get(k) ?? "non",
          };
        }),
      };
    } catch (e) {
      out[t] = { etat: `erreur: ${String(e).slice(0, 120)}` };
    }
    if (n % 50 === 0) console.error(`... ${n}/${univers.length}`);
  }
  fs.writeFileSync(sortie, JSON.stringify(out));
  const ko = Object.entries(out).filter(([, v]) => (v as K).etat !== "ready");
  console.log(`${univers.length} societes, ${univers.length - ko.length} servies, ${ko.length} non pretes`);
})();
