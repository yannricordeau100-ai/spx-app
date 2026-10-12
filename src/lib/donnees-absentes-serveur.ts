/**
 * Absences « publiées » d une fiche (Yann, 13 oct 2026), établies CÔTÉ SERVEUR.
 *
 * Une absence n est déclarée que sur une marque certaine posée dans les
 * données ou dans un registre vérifié ; sans marque, rien n est affirmé et le
 * bloc garde son comportement habituel (masqué). Les raisons internes lues
 * ici (motifs d extraction, registres) ne quittent jamais le serveur : seul
 * l identifiant de l absence part au navigateur, les textes affichés sont dans
 * src/lib/donnees-absentes.ts.
 *
 * Module serveur : ne jamais l importer depuis un composant "use client".
 */
import SANS_APPEL from "@/data/sans-appel-resultats.json";
import type { Company } from "@/lib/data";
import type { AbsencesFiche, ManqueGouvernance } from "@/lib/donnees-absentes";

type Brut = Record<string, unknown> | null | undefined;

const estNombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const sansTranches = (b: Brut) => !b || !Array.isArray((b as { slices?: unknown }).slices) || ((b as { slices: unknown[] }).slices.length === 0);
const textes = (...b: Brut[]) =>
  b
    .flatMap((o) => (o ? ["_reason", "reason", "_legit_reason", "label"].map((k) => o[k]) : []))
    .filter((x): x is string => typeof x === "string")
    .join(" ");

/** Formulaires réservés aux émetteurs étrangers cotés aux États-Unis. */
const FORMULAIRES_ETRANGERS = /^(20-F|6-K|40-F)\b/i;

export function absencesFiche(c: Company): AbsencesFiche {
  const a: AbsencesFiche = {};
  const o = c as unknown as Record<string, unknown>;
  const geo = o.revenue_by_geography as Brut;
  const seg = o.revenue_by_segment as Brut;

  // 1-2. Répartition du chiffre d affaires : marques posées à l extraction
  // (segment unique déclaré dans le rapport annuel, activité dans un seul pays).
  const holding = /holding/i.test(textes(geo, seg));
  if (sansTranches(seg) && seg && (seg.single_segment === true || seg._single_segment === true)) {
    a.segment = holding ? "holding_sans_ca" : "segment_unique";
  }
  if (sansTranches(geo) && geo && (geo.single_region_legitimate === true || typeof geo._single_geography === "string")) {
    a.geo = holding ? "holding_sans_ca" : /maille|segment fait foi/i.test(textes(geo)) ? "geo_par_segment" : "geo_marche_unique";
  }

  // 3. TAM : arbitrage du propriétaire « aucun TAM pertinent » (liste vide posée).
  const sansTam = !(Array.isArray(c.market_positions) && c.market_positions.length > 0) && !((c.evenement?.tam?.length ?? 0) > 0);
  if (o.tam_absence_arbitree === true && sansTam) a.tam = "tam_sans_etude";

  // 4. Année de fondation ou d introduction : seulement sur marque explicite
  // (aucune aujourd hui : un champ vide est le plus souvent un oubli).
  if (o.founded_non_documente === true && !c.founded) a.fondation = "fondation_non_documentee";
  if (o.ipo_non_documente === true && !c.ipo) a.ipo = "ipo_non_documentee";

  // 5 et 7. Gouvernance : émetteur étranger (formulaires 20-F / 6-K / 40-F),
  // ou rémunération publiée seulement en montant global.
  const g = c.governance as unknown as Brut;
  if (g) {
    const manque: ManqueGouvernance[] = [];
    if (!estNombre(g.ceo_total_comp_m)) manque.push("remuneration");
    if (!estNombre(g.ceo_pay_ratio)) manque.push("ratio");
    if (!estNombre(g.exec_comp_approval_pct)) manque.push("vote");
    const etranger = FORMULAIRES_ETRANGERS.test(String(c.latest_filing?.form ?? ""));
    const montantGlobal = estNombre(g.comp_aggregate_directors_officers_m) || estNombre(g.remuneration_dirigeants_total_m);
    if (etranger && manque.length > 0) a.gouvernance = { id: "etranger_gouvernance", manque };
    else if (montantGlobal && manque.includes("remuneration")) a.gouvernance = { id: "remuneration_globale", manque: ["remuneration"] };
  }

  // 6. Moat : pas de date de note en vigueur = première évaluation.
  const moat = o.moat as Brut;
  if (moat && typeof moat.niveau === "string" && !moat.depuis) a.moat = "moat_premiere_evaluation";

  // 8. Conférence de résultats : registre vérifié société par société.
  const registre = (SANS_APPEL as { tickers: Record<string, string> }).tickers;
  const motif = registre[String(c.ticker ?? "").toUpperCase()];
  if (typeof motif === "string") {
    a.conference = /suspendu|plus d.appel|rachat|fusion|offre|rapprochement/i.test(motif) ? "conference_suspendue" : "sans_conference";
  }

  // 9. Dividende : rendement publié à zéro (une valeur vide reste « non renseigné »).
  if (c.financial_snapshot?.dividend_yield_pct === 0) a.dividende = "sans_dividende";

  return a;
}
