/**
 * Controle des fiches de la vague sp5001000 par le VRAI chargeur, en mode
 * niveau 1 (Yann, 9 oct 2026). Appele par scripts/sp5001000-onboard.py.
 *
 *   UNIVERS=sp5001000 npx tsx scripts/sp5001000-verif-fiches.ts <sortie.json> SNOW TWLO ...
 *
 * Le chargeur refuse toute societe hors de src/data/univers-sp5001000.json
 * en mode niveau 1 : les candidats lui sont passes par UNIVERS_N1_CANDIDATS,
 * variable lue par src/lib/univers-actif.ts HORS Vercel seulement. Rien n est
 * ecrit hors de <sortie.json>.
 */
import { promises as fs } from "fs";

(async () => {
  const [sortie, ...tickers] = process.argv.slice(2);
  if (!sortie || tickers.length === 0) {
    console.error("usage : UNIVERS=sp5001000 npx tsx scripts/sp5001000-verif-fiches.ts <sortie.json> T1 T2 ...");
    process.exit(2);
  }
  process.env.UNIVERS = "sp5001000";
  // Les candidats ne sont pas encore dans la liste du niveau 1 : src/lib/univers-actif.ts
  // les accepte via UNIVERS_N1_CANDIDATS, hors Vercel uniquement, lue au chargement du module.
  process.env.UNIVERS_N1_CANDIDATS = tickers.join(",");
  const { loadV17Company } = await import("../src/lib/company-core/load-company");
  const out: Record<string, unknown> = {};
  for (const t of tickers) {
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") {
        out[t] = { kind: r.kind };
        continue;
      }
      const c = r.company as unknown as {
        name?: string;
        hero_kpi?: string;
        kpis?: Array<{ short?: string; value?: unknown; unit?: string; yoy?: unknown; type?: unknown; history?: unknown[]; is_short_history?: boolean }>;
        risks?: unknown[];
        governance?: unknown;
        ai_positioning?: unknown;
      };
      const kpis = c.kpis ?? [];
      const hero = kpis.find((k) => k.short === c.hero_kpi);
      out[t] = {
        kind: "ready",
        nom: c.name ?? null,
        hero: c.hero_kpi ?? null,
        hero_valeur: hero ? hero.value ?? null : null,
        hero_unite: hero ? hero.unit ?? "" : "",
        hero_yoy: hero ? hero.yoy ?? "" : "",
        hero_type: hero && typeof hero.type === "string" ? hero.type : "",
        hero_points: hero && Array.isArray(hero.history) ? hero.history.length : 0,
        kpis: kpis.length,
        kpis_tableau: kpis.filter((k) => !k.is_short_history).length,
        risques: Array.isArray(c.risks) ? c.risks.length : 0,
        gouvernance: !!c.governance,
        ia: !!c.ai_positioning,
      };
    } catch (e) {
      out[t] = { kind: "erreur", erreur: String(e).slice(0, 200) };
    }
  }
  await fs.writeFile(sortie, JSON.stringify(out, null, 1));
  console.log("ok", Object.keys(out).length);
  process.exit(0);
})();
