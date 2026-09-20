/**
 * Indicateurs non financiers a envisager : acces a la table
 * desk_kpi_non_financiers (Yann, 21 sept 2026).
 *
 * Atelier /sandbox/kpi-non-financiers. Yann saisit un ou plusieurs tickers,
 * coche ses criteres, puis demande une recherche. Pour l instant aucune
 * recherche n est lancee : la demande cree seulement une ligne au statut
 * "a_traiter", et la recherche demarrera au feu vert de Yann.
 *
 * Non financier veut dire introuvable sur un comparateur boursier de
 * selection de titres. Le prix moyen d un abonnement, le prix du service le
 * plus cher ou le tarif d une option sont acceptes. Le benefice par action,
 * le rendement des capitaux ou la croissance du resultat sont refuses.
 *
 * Meme forme que src/lib/desk/special-kpis.ts : client admin, aucun acces
 * navigateur, tout passe par une route serveur.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TABLE_KPI_NON_FINANCIERS = "desk_kpi_non_financiers";

/** Statuts de la demande. "a_traiter" tant que la recherche n est pas ouverte. */
export type StatutKpiNonFinancier =
  | "a_traiter"
  | "en_cours"
  | "propose"
  | "enregistre"
  | "erreur";

/** Criteres coches par Yann au moment de la demande. */
export type CriteresKpiNonFinancier = {
  /** Au moins cinq points de donnees dans la serie. */
  min_cinq_points: boolean;
  /**
   * Maille annuelle avec cinq ans au minimum, ou maille trimestrielle ou
   * mensuelle avec trois ans au minimum.
   */
  profondeur_minimale: boolean;
  /** Source publiee depuis moins de dix huit mois. */
  source_recente_18_mois: boolean;
  /** Source adaptee au secteur de la societe. */
  source_adaptee_secteur: boolean;
  /** Source officielle seulement (documents publies par la societe). */
  source_officielle_seulement: boolean;
  /** Exclure les panels payants (Nielsen, Kantar, Circana et equivalents). */
  exclure_panels_payants: boolean;
  /** Consigne libre ajoutee par Yann. */
  consigne_libre: string;
};

export const CRITERES_PAR_DEFAUT: CriteresKpiNonFinancier = {
  min_cinq_points: true,
  profondeur_minimale: true,
  source_recente_18_mois: true,
  source_adaptee_secteur: true,
  source_officielle_seulement: false,
  exclure_panels_payants: false,
  consigne_libre: "",
};

/** Libelles affiches en face de chaque critere. */
export const LIBELLES_CRITERES: Record<
  Exclude<keyof CriteresKpiNonFinancier, "consigne_libre">,
  string
> = {
  min_cinq_points: "Au moins cinq points de données",
  profondeur_minimale:
    "Maille annuelle avec cinq ans minimum, ou maille trimestrielle ou mensuelle avec trois ans minimum",
  source_recente_18_mois: "Source publiée depuis moins de dix-huit mois",
  source_adaptee_secteur: "Source adaptée au secteur de la société",
  source_officielle_seulement: "Source officielle seulement",
  exclure_panels_payants: "Exclure les panels payants",
};

/** Une proposition d indicateur, meme presentation que /concepts/kpi-netflix. */
export type PropositionNonFinanciere = {
  /** Identifiant stable a l interieur de la ligne, sert aux cases a cocher. */
  cle: string;
  nom: string;
  /** Phrase d interet : ce que l indicateur apprend a un investisseur. */
  phrase?: string;
  unite?: string;
  frequence?: string;
  /** Serie de valeurs, chaque entree etant [periode, valeur]. */
  valeurs?: (number | string)[][];
  citation_verbatim?: string;
  source_nom?: string;
  source_url?: string;
  source_date?: string;
  /** Fiabilite de 0 a 5. */
  fiabilite?: number;
  /** Vrai quand Yann a coche la proposition et l a enregistree. */
  retenu?: boolean;
};

export type LigneKpiNonFinancier = {
  id: string;
  ticker: string;
  criteres: CriteresKpiNonFinancier;
  statut: StatutKpiNonFinancier;
  propositions: PropositionNonFinanciere[];
  commentaire: string | null;
  created_at: string;
  updated_at: string;
};

type LigneBrute = {
  id: string;
  ticker: string | null;
  criteres: Partial<CriteresKpiNonFinancier> | null;
  statut: string | null;
  propositions: PropositionNonFinanciere[] | null;
  commentaire: string | null;
  created_at: string;
  updated_at: string;
};

function normaliser(ligne: LigneBrute): LigneKpiNonFinancier {
  return {
    id: ligne.id,
    ticker: (ligne.ticker ?? "").toUpperCase(),
    criteres: { ...CRITERES_PAR_DEFAUT, ...(ligne.criteres ?? {}) },
    statut: (ligne.statut ?? "a_traiter") as StatutKpiNonFinancier,
    propositions: Array.isArray(ligne.propositions) ? ligne.propositions : [],
    commentaire: ligne.commentaire ?? null,
    created_at: ligne.created_at,
    updated_at: ligne.updated_at,
  };
}

/** Nettoie les criteres recus du navigateur, sans faire confiance au client. */
export function lireCriteres(
  entree: Partial<CriteresKpiNonFinancier> | null | undefined,
): CriteresKpiNonFinancier {
  const e = entree ?? {};
  return {
    min_cinq_points: e.min_cinq_points ?? CRITERES_PAR_DEFAUT.min_cinq_points,
    profondeur_minimale:
      e.profondeur_minimale ?? CRITERES_PAR_DEFAUT.profondeur_minimale,
    source_recente_18_mois:
      e.source_recente_18_mois ?? CRITERES_PAR_DEFAUT.source_recente_18_mois,
    source_adaptee_secteur:
      e.source_adaptee_secteur ?? CRITERES_PAR_DEFAUT.source_adaptee_secteur,
    source_officielle_seulement:
      e.source_officielle_seulement ??
      CRITERES_PAR_DEFAUT.source_officielle_seulement,
    exclure_panels_payants:
      e.exclure_panels_payants ?? CRITERES_PAR_DEFAUT.exclure_panels_payants,
    consigne_libre: String(e.consigne_libre ?? "").slice(0, 2000),
  };
}

/** Decoupe une saisie libre en tickers propres, sans doublon. */
export function decouperTickers(saisie: string): string[] {
  const vus = new Set<string>();
  for (const brut of saisie.split(/[\s,;]+/)) {
    const t = brut.trim().toUpperCase();
    if (!t) continue;
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(t)) continue;
    vus.add(t);
  }
  return Array.from(vus).slice(0, 30);
}

/** Les demandes, la plus recente en tete. */
export async function listerDemandes(
  limite = 60,
): Promise<LigneKpiNonFinancier[]> {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from(TABLE_KPI_NON_FINANCIERS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as LigneBrute[]).map(normaliser);
}

export async function lireDemande(
  id: string,
): Promise<LigneKpiNonFinancier | null> {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from(TABLE_KPI_NON_FINANCIERS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normaliser(data as LigneBrute) : null;
}

/**
 * Cree une demande au statut "a_traiter". Aucune recherche n est declenchee :
 * la ligne attend le feu vert de Yann.
 */
export async function creerDemande(entree: {
  ticker: string;
  criteres: Partial<CriteresKpiNonFinancier>;
  commentaire?: string | null;
}): Promise<LigneKpiNonFinancier> {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from(TABLE_KPI_NON_FINANCIERS)
    .insert({
      ticker: entree.ticker.toUpperCase(),
      criteres: lireCriteres(entree.criteres),
      statut: "a_traiter" satisfies StatutKpiNonFinancier,
      propositions: [],
      commentaire: entree.commentaire ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normaliser(data as LigneBrute);
}

/**
 * Enregistre les cases cochees : marque "retenu" sur les propositions dont la
 * cle est dans la liste, remet les autres a faux, et passe la ligne au statut
 * "enregistre" des qu au moins une proposition est retenue.
 */
export async function enregistrerPropositionsCochees(
  id: string,
  clesCochees: string[],
  commentaire?: string | null,
): Promise<LigneKpiNonFinancier> {
  const existante = await lireDemande(id);
  if (!existante) throw new Error(`Demande introuvable : ${id}`);
  const cochees = new Set(clesCochees);
  const propositions = existante.propositions.map((p) => ({
    ...p,
    retenu: cochees.has(p.cle),
  }));
  const statut: StatutKpiNonFinancier = propositions.some((p) => p.retenu)
    ? "enregistre"
    : existante.statut;
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from(TABLE_KPI_NON_FINANCIERS)
    .update({
      propositions,
      statut,
      commentaire: commentaire ?? existante.commentaire,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normaliser(data as LigneBrute);
}
