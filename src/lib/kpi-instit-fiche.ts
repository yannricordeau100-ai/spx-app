/**
 * Yann 13 oct 2026 : KPI d industrie suivis par les investisseurs
 * institutionnels, rattaches aux KPI de la fiche (affichage seulement).
 *
 * Referentiel : src/data/kpi-industries-etat.json (74 industries GICS).
 * Correspondance, la meme que /admin/kpis-toggle (categorie « industrie ») :
 *   1. la societe figure dans `stes_avec` du KPI d industrie (pastille admin n/16) ;
 *   2. un KPI de la fiche porte ce KPI comme type comparable du referentiel
 *      (type_comparable.origine = "referentiel", meme libelle anglais).
 * Aucune donnee n est modifiee : on renvoie seulement quels KPI de la fiche
 * sont concernes, pour les mettre en tete du tableau et en jaune.
 */

type Raisons = Record<string, string>;
type KpiEtat = {
  fr: string;
  en: string;
  stes_avec?: string[];
  sans_objet?: string[];
  non_applicable?: Raisons;
};
type Industrie = { code: string; industrie: string; stes: string[]; kpis: KpiEtat[] };
export type EtatIndustries = { industries?: Industrie[] };

export type KpiInstitFiche = {
  /** Industrie GICS (libelle francais). */
  industrie: string;
  /** Nombre de KPI de l industrie applicables a la societe (hors sans objet). */
  total: number;
  /** KPI de la fiche suivis par les institutionnels, avec le libelle du referentiel. */
  kpis: { short: string; fr: string }[];
};

const variantes = (t: string) => {
  const u = t.toUpperCase();
  return [u, u.replace(/-/g, "."), u.replace(/\./g, "-")];
};
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function kpiInstitPourFiche(
  etat: EtatIndustries | null | undefined,
  ticker: string,
  kpis: { short?: unknown; type_comparable?: unknown }[],
): KpiInstitFiche | null {
  const cles = variantes(ticker);
  const ind = (etat?.industries ?? []).find((i) => i.stes.some((s) => cles.includes(s.toUpperCase())));
  if (!ind) return null;
  const dans = (l?: string[]) => (l ?? []).some((s) => cles.includes(s.toUpperCase()));
  const dansRaisons = (r?: Raisons) => Object.keys(r ?? {}).some((s) => cles.includes(s.toUpperCase()));
  const applicables = ind.kpis.filter((k) => dans(k.stes_avec) || !(dans(k.sans_objet) || dansRaisons(k.non_applicable)));
  const parEn = new Map<string, string>();
  for (const k of ind.kpis) if (dans(k.stes_avec)) parEn.set(norm(k.en), k.fr);
  const lignes: { short: string; fr: string }[] = [];
  const vus = new Set<string>();
  for (const k of kpis) {
    const tc = k.type_comparable as { en?: string; origine?: string } | null | undefined;
    if (!tc || tc.origine !== "referentiel") continue;
    const fr = parEn.get(norm(tc.en));
    const short = typeof k.short === "string" ? k.short : "";
    if (!fr || !short || vus.has(short)) continue;
    vus.add(short);
    lignes.push({ short, fr });
  }
  return { industrie: ind.industrie, total: applicables.length, kpis: lignes };
}
