/**
 * Etat de completude des blocs, mesure sur la fiche REELLEMENT CHARGEE
 * (Yann 23 sept 2026). Compter dans src/data/companies donne un resultat faux :
 * plusieurs blocs sont injectes au chargement depuis d autres dossiers.
 * Sortie : /tmp/etat-blocs.json (tableau par bloc et liste des manquants).
 */
import fs from "node:fs";
import { loadV17Company } from "../src/lib/company-core/load-company";

type Bloc = { cle: string; libelle: string; plein: (c: Record<string, unknown>) => boolean };

const nonVide = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
};

const BLOCS: Bloc[] = [
  { cle: "company_description", libelle: "Comprendre la societe", plein: (c) => nonVide(c.company_description) },
  { cle: "kpis", libelle: "Indicateurs", plein: (c) => Array.isArray(c.kpis) && (c.kpis as unknown[]).length > 0 },
  { cle: "risks", libelle: "Facteurs de risque", plein: (c) => nonVide(c.risks) },
  { cle: "governance", libelle: "Gouvernance et remuneration", plein: (c) => nonVide(c.governance) },
  { cle: "revenue_by_segment", libelle: "Repartition du chiffre d affaires", plein: (c) => nonVide(c.revenue_by_segment) },
  { cle: "revenue_by_geography", libelle: "Repartition geographique", plein: (c) => nonVide(c.revenue_by_geography) },
  {
    cle: "ai_positioning", libelle: "Positionnement IA",
    plein: (c) => {
      const a = c.ai_positioning as { stance?: string; evidence?: unknown[] } | undefined;
      return !!a && a.stance !== "absent" && Array.isArray(a.evidence) && a.evidence.length > 0;
    },
  },
  { cle: "these", libelle: "These d investissement", plein: (c) => nonVide(c.these) },
  { cle: "att", libelle: "Anti these", plein: (c) => nonVide(c.att) },
  { cle: "moat", libelle: "Avantage concurrentiel", plein: (c) => nonVide(c.moat) },
  { cle: "market_positions", libelle: "Positions de marche", plein: (c) => nonVide(c.market_positions) },
  { cle: "clients_concentration", libelle: "Concentration clients", plein: (c) => nonVide(c.clients_concentration) },
  { cle: "mettrik_description", libelle: "Description Mettrik", plein: (c) => nonVide(c.mettrik_description) },
  { cle: "hero_kpi", libelle: "Indicateur phare", plein: (c) => nonVide(c.hero_kpi) },
  { cle: "next_earnings_date", libelle: "Prochaine publication", plein: (c) => nonVide(c.next_earnings_date) },
];

(async () => {
  const univers: string[] = JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")).tickers;
  const manquants: Record<string, string[]> = {};
  for (const b of BLOCS) manquants[b.cle] = [];
  const illisibles: string[] = [];
  let n = 0;
  for (const t of univers) {
    n++;
    let c: Record<string, unknown> | null = null;
    try {
      const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind === "ready") c = r.company as unknown as Record<string, unknown>;
    } catch { /* fiche illisible */ }
    if (!c) { illisibles.push(t); continue; }
    for (const b of BLOCS) if (!b.plein(c)) manquants[b.cle].push(t);
    if (n % 100 === 0) console.error(`... ${n}/${univers.length}`);
  }
  const total = univers.length;
  const lignes = BLOCS.map((b) => ({
    bloc: b.libelle, cle: b.cle,
    manquants: manquants[b.cle].length,
    couverture: +(100 * (total - manquants[b.cle].length) / total).toFixed(1),
  })).sort((a, b) => b.manquants - a.manquants);
  fs.writeFileSync("/tmp/etat-blocs.json", JSON.stringify({ total, illisibles, lignes, manquants }, null, 1));
  console.log(`univers ${total}, illisibles ${illisibles.length}`);
  console.log("BLOC".padEnd(34) + "MANQUE".padStart(8) + "COUVERTURE".padStart(12));
  for (const l of lignes) console.log(l.bloc.padEnd(34) + String(l.manquants).padStart(8) + `${l.couverture} %`.padStart(12));
})();
